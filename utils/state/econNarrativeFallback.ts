import type { StateVarDomainSheetFieldAllowlist, TavernCommand } from '../../types';
import { extractValisAmountMatches } from './currencyAmount';

type RecordLike = Record<string, unknown>;

const EXPENSE_KEYWORDS = [
  '支付',
  '付款',
  '付钱',
  '花费',
  '消费',
  '买单',
  '结账',
  '购入',
  '购买',
  '买了',
  '买下',
  '花了',
  '花掉',
  '掏出',
  '摸出',
  '拍在柜台'
];
const INCOME_KEYWORDS = [
  '获得',
  '得到',
  '收入',
  '赚到',
  '报酬',
  '奖励',
  '赏金',
  '卖出',
  '售出',
  '变卖',
  '收到'
];
const BALANCE_HINT_KEYWORDS = [
  '口袋里有',
  '余额',
  '现有',
  '拥有',
  '持有',
  '总计',
  '还剩',
  '剩余'
];

const asRecord = (value: unknown): RecordLike | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as RecordLike;
};

const parseJsonRecord = (text: string): RecordLike | null => {
  if (typeof text !== 'string') return null;
  const normalized = text.trim();
  if (!normalized || !normalized.startsWith('{')) return null;
  try {
    return asRecord(JSON.parse(normalized));
  } catch {
    return null;
  }
};

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
};

const resolveCommandAction = (cmd: TavernCommand): string => String(
  (cmd as any)?.action
  ?? (cmd as any)?.type
  ?? (cmd as any)?.command
  ?? (cmd as any)?.name
  ?? (cmd as any)?.mode
  ?? (cmd as any)?.cmd
  ?? ''
).trim().toLowerCase();

const resolveSheetIdFromCommand = (cmd: TavernCommand): string => {
  const payload = asRecord(parseMaybeJson((cmd as any)?.value))
    || asRecord(parseMaybeJson((cmd as any)?.args))
    || asRecord(parseMaybeJson((cmd as any)?.arguments));
  if (!payload) return '';
  const sheetId = String(payload.sheetId ?? payload.sheet_id ?? '').trim();
  return sheetId;
};

const countKeywordHits = (text: string, keywords: string[]): number => {
  let hits = 0;
  for (const keyword of keywords) {
    if (!keyword) continue;
    if (text.includes(keyword.toLowerCase())) hits += 1;
  }
  return hits;
};

const resolveDeltaSign = (windowText: string): number => {
  const normalized = windowText.toLowerCase();
  const expenseHits = countKeywordHits(normalized, EXPENSE_KEYWORDS);
  const incomeHits = countKeywordHits(normalized, INCOME_KEYWORDS);
  if (expenseHits === 0 && incomeHits === 0) return 0;
  if (expenseHits === incomeHits) return 0;
  return expenseHits > incomeHits ? -1 : 1;
};

const containsBalanceHint = (text: string): boolean => {
  const normalized = text.toLowerCase();
  return BALANCE_HINT_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
};

const resolveNarrativeTexts = (payload: RecordLike): string[] => {
  const result: string[] = [];
  const narrative = payload.叙事;
  if (Array.isArray(narrative)) {
    for (const item of narrative) {
      if (typeof item === 'string') {
        const text = item.trim();
        if (text) result.push(text);
        continue;
      }
      const row = asRecord(item);
      if (!row) continue;
      const text = String(row.text ?? row.内容 ?? '').trim();
      if (text) result.push(text);
    }
  } else if (typeof narrative === 'string') {
    const text = narrative.trim();
    if (text) result.push(text);
  }
  const playerInput = String(payload.玩家输入 ?? '').trim();
  if (playerInput) result.push(playerInput);
  return result;
};

const hasEconomSheetAccess = (payload: RecordLike): boolean => {
  const fillTask = asRecord(payload.填表任务);
  if (!fillTask) return true;
  const targetSheet = String(fillTask.targetSheet ?? '').trim();
  if (targetSheet && targetSheet !== 'ECON_Ledger') return false;
  if (!Array.isArray(fillTask.requiredSheets) || fillTask.requiredSheets.length === 0) return true;
  return fillTask.requiredSheets.some((item) => String(item || '').trim() === 'ECON_Ledger');
};

const deriveNarrativeEconomicDelta = (texts: string[]): number => {
  if (texts.length === 0) return 0;
  const merged = texts.join('\n');
  const normalizedAll = merged.toLowerCase();
  const globalExpenseHits = countKeywordHits(normalizedAll, EXPENSE_KEYWORDS);
  const globalIncomeHits = countKeywordHits(normalizedAll, INCOME_KEYWORDS);
  let totalDelta = 0;
  let matched = false;
  const amountMatches = extractValisAmountMatches(merged);
  for (const amountMatch of amountMatches) {
    const amount = Number(amountMatch.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const start = Math.max(0, amountMatch.index - 28);
    const end = Math.min(merged.length, amountMatch.index + amountMatch.raw.length + 28);
    const windowText = merged.slice(start, end);
    let sign = resolveDeltaSign(windowText);
    if (sign === 0) {
      if (containsBalanceHint(windowText)) continue;
      if (globalExpenseHits > globalIncomeHits) sign = -1;
      else if (globalIncomeHits > globalExpenseHits) sign = 1;
      else continue;
    }
    totalDelta += sign * amount;
    matched = true;
  }
  if (!matched) return 0;
  return Number(totalDelta.toFixed(2));
};

export const hasEconomicMutationCommand = (commands: TavernCommand[]): boolean => {
  if (!Array.isArray(commands) || commands.length === 0) return false;
  return commands.some((cmd) => {
    const action = resolveCommandAction(cmd);
    if (action === 'apply_econ_delta' || action === 'append_econ_ledger') return true;
    if (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') {
      return resolveSheetIdFromCommand(cmd) === 'ECON_Ledger';
    }
    const key = String((cmd as any)?.key ?? (cmd as any)?.path ?? '').trim();
    return key === 'gameState.角色.法利' || key === 'gameState.眷族.资金';
  });
};

const hasAllowlistedField = (
  allowlist: StateVarDomainSheetFieldAllowlist | undefined,
  sheetId: string,
  field: string
): boolean => {
  if (!allowlist || typeof allowlist !== 'object') return false;
  const normalizedSheetId = String(sheetId || '').trim();
  const normalizedField = String(field || '').trim();
  if (!normalizedSheetId || !normalizedField) return false;
  return Object.values(allowlist).some((sheetMap) => {
    const fields = Array.isArray((sheetMap as Record<string, unknown>)?.[normalizedSheetId])
      ? ((sheetMap as Record<string, unknown>)[normalizedSheetId] as unknown[])
      : [];
    return fields.some((item) => String(item || '').trim() === normalizedField);
  });
};

export type EconomyFallbackReasonClass =
  | 'applied'
  | 'existing-economic-mutation'
  | 'non-structured-input'
  | 'no-access'
  | 'no-delta'
  | 'out-of-scope';

export type ApplyNarrativeEconomicFallbackOptions = {
  strictAllowlist?: boolean;
  allowlist?: StateVarDomainSheetFieldAllowlist;
};

export type ApplyNarrativeEconomicFallbackResult = {
  commands: TavernCommand[];
  applied: boolean;
  delta?: number;
  reasonClass: EconomyFallbackReasonClass;
  marker?: string;
};

export const applyNarrativeEconomicFallback = (
  input: string,
  commands: TavernCommand[],
  options: ApplyNarrativeEconomicFallbackOptions = {}
): ApplyNarrativeEconomicFallbackResult => {
  const safeCommands = Array.isArray(commands) ? commands : [];
  if (hasEconomicMutationCommand(safeCommands)) {
    return { commands: safeCommands, applied: false, reasonClass: 'existing-economic-mutation' };
  }
  const payload = parseJsonRecord(input);
  if (!payload) {
    return { commands: safeCommands, applied: false, reasonClass: 'non-structured-input' };
  }
  if (!hasEconomSheetAccess(payload)) {
    return { commands: safeCommands, applied: false, reasonClass: 'no-access' };
  }
  const texts = resolveNarrativeTexts(payload);
  const delta = deriveNarrativeEconomicDelta(texts);
  if (!Number.isFinite(delta) || delta === 0) {
    return { commands: safeCommands, applied: false, reasonClass: 'no-delta' };
  }
  const strictAllowlist = options.strictAllowlist !== false;
  if (
    strictAllowlist
    && options.allowlist
    && !hasAllowlistedField(options.allowlist, 'CHARACTER_Resources', '法利')
  ) {
    return { commands: safeCommands, applied: false, reasonClass: 'out-of-scope' };
  }
  const direction = delta < 0 ? 'expense' : 'income';
  const marker = `econ-fallback(delta=${delta},direction=${direction})`;
  const fallbackCommand: TavernCommand = {
    action: 'apply_econ_delta',
    value: {
      account: '角色.法利',
      delta,
      reason: 'state-fallback:narrative-econ',
      commandRef: 'state-fallback:narrative-econ'
    }
  };
  return {
    commands: [...safeCommands, fallbackCommand],
    applied: true,
    delta,
    reasonClass: 'applied',
    marker
  };
};

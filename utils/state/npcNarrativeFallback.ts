import type { GameState, StateVarDomainSheetFieldAllowlist, TavernCommand } from '../../types';

type RecordLike = Record<string, unknown>;

type NarrativeRow = {
  sender: string;
  text: string;
};

const NARRATION_SENDERS = new Set([
  '旁白',
  '系统',
  '战斗结算',
  'narrator',
  'system'
]);

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

const resolveAction = (cmd: TavernCommand): string => String(
  (cmd as any)?.action
  ?? (cmd as any)?.type
  ?? (cmd as any)?.command
  ?? (cmd as any)?.name
  ?? (cmd as any)?.mode
  ?? (cmd as any)?.cmd
  ?? ''
).trim().toLowerCase();

const unwrapRows = (raw: unknown): RecordLike[] => {
  const parsed = parseMaybeJson(raw);
  if (Array.isArray(parsed)) {
    return parsed
      .filter((item): item is RecordLike => !!item && typeof item === 'object' && !Array.isArray(item))
      .flatMap((item) => {
        if (Array.isArray((item as any).rows)) {
          return (item as any).rows.filter((row: any) => !!row && typeof row === 'object' && !Array.isArray(row));
        }
        return [item];
      });
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const obj = parsed as RecordLike;
  if (Array.isArray(obj.rows)) {
    return obj.rows.filter((row): row is RecordLike => !!row && typeof row === 'object' && !Array.isArray(row));
  }
  return [obj];
};

const normalizeNarrativeRows = (payload: RecordLike): NarrativeRow[] => {
  const rawNarrative = payload.叙事;
  if (!Array.isArray(rawNarrative)) return [];
  return rawNarrative
    .map((item) => {
      if (typeof item === 'string') {
        const text = item.trim();
        if (!text) return null;
        return { sender: '旁白', text } as NarrativeRow;
      }
      const row = asRecord(item);
      if (!row) return null;
      const sender = String(row.sender ?? row.发送者 ?? row.说话者 ?? '').trim();
      const text = String(row.text ?? row.内容 ?? '').trim();
      if (!sender || !text) return null;
      return { sender, text } as NarrativeRow;
    })
    .filter((row): row is NarrativeRow => !!row);
};

const resolveFillTaskSheetAccess = (payload: RecordLike): { allowNpcRegistry: boolean; allowInteractionLog: boolean } => {
  const fillTask = asRecord(payload.填表任务);
  if (!fillTask) {
    return { allowNpcRegistry: true, allowInteractionLog: true };
  }

  const targetSheet = String(fillTask.targetSheet ?? '').trim();
  if (targetSheet) {
    return {
      allowNpcRegistry: targetSheet === 'NPC_Registry',
      allowInteractionLog: targetSheet === 'NPC_InteractionLog'
    };
  }

  const requiredSheets = Array.isArray(fillTask.requiredSheets)
    ? fillTask.requiredSheets.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  if (requiredSheets.length === 0) {
    return { allowNpcRegistry: true, allowInteractionLog: true };
  }

  return {
    allowNpcRegistry: requiredSheets.includes('NPC_Registry'),
    allowInteractionLog: requiredSheets.includes('NPC_InteractionLog')
  };
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

const buildExistingNpcMaps = (stateSnapshot: GameState): { idByName: Map<string, string>; nameById: Map<string, string> } => {
  const idByName = new Map<string, string>();
  const nameById = new Map<string, string>();
  const social = Array.isArray(stateSnapshot.社交) ? stateSnapshot.社交 : [];
  social.forEach((npc) => {
    const npcName = String((npc as any)?.姓名 || '').trim();
    const npcId = String((npc as any)?.id || '').trim();
    if (npcName && npcId) {
      idByName.set(npcName, npcId);
      nameById.set(npcId, npcName);
      nameById.set(npcId.toLowerCase(), npcName);
    }
  });
  return { idByName, nameById };
};

const isNarrationSender = (sender: string, playerName: string): boolean => {
  const normalized = String(sender || '').trim();
  if (!normalized) return true;
  if (normalized === playerName) return true;
  return NARRATION_SENDERS.has(normalized) || NARRATION_SENDERS.has(normalized.toLowerCase());
};

const resolveCoveredNpcNames = (
  commands: TavernCommand[],
  nameById: Map<string, string>
): Set<string> => {
  const covered = new Set<string>();
  if (!Array.isArray(commands)) return covered;

  commands.forEach((cmd) => {
    const action = resolveAction(cmd);
    if (action === 'upsert_npc') {
      const rows = unwrapRows((cmd as any)?.value ?? (cmd as any)?.rows ?? (cmd as any)?.data);
      rows.forEach((row) => {
        const name = String((row as any)?.姓名 ?? (row as any)?.npc_name ?? (row as any)?.NPC ?? '').trim();
        const id = String((row as any)?.id ?? (row as any)?.npc_id ?? '').trim();
        if (name) covered.add(name);
        if (id) {
          const mappedName = nameById.get(id) || nameById.get(id.toLowerCase()) || '';
          if (mappedName) covered.add(mappedName);
        }
      });
      return;
    }

    if (action === 'upsert_sheet_rows') {
      const payload = asRecord(parseMaybeJson((cmd as any)?.value));
      const sheetId = String(payload?.sheetId ?? payload?.sheet_id ?? '').trim();
      if (sheetId !== 'NPC_Registry' && sheetId !== 'NPC_InteractionLog') return;
      const rows = unwrapRows(payload);
      rows.forEach((row) => {
        const name = String((row as any)?.姓名 ?? (row as any)?.npc_name ?? '').trim();
        const id = String((row as any)?.NPC_ID ?? (row as any)?.npc_id ?? '').trim();
        if (name) covered.add(name);
        if (id) {
          const mappedName = nameById.get(id) || nameById.get(id.toLowerCase()) || '';
          if (mappedName) covered.add(mappedName);
        }
      });
    }
  });

  return covered;
};

const trimSummary = (text: string, maxLength = 120): string => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
};

const createStableNpcId = (name: string): string => {
  const normalized = String(name || '').trim();
  if (!normalized) return 'NPC_AUTO_UNKNOWN';
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  const tag = Math.abs(hash).toString(36).slice(0, 8);
  return `NPC_AUTO_${tag || '0'}`;
};

export type NpcFallbackReasonClass =
  | 'applied'
  | 'non-structured-input'
  | 'no-access'
  | 'no-dialogue'
  | 'out-of-scope'
  | 'already-covered';

export type ApplyNarrativeNpcFallbackOptions = {
  strictAllowlist?: boolean;
  allowlist?: StateVarDomainSheetFieldAllowlist;
};

export type ApplyNarrativeNpcFallbackResult = {
  commands: TavernCommand[];
  applied: boolean;
  reasonClass: NpcFallbackReasonClass;
  marker?: string;
  createdNpcCount?: number;
  createdInteractionCount?: number;
};

export const applyNarrativeNpcFallback = (
  input: string,
  commands: TavernCommand[],
  stateSnapshot: GameState,
  options: ApplyNarrativeNpcFallbackOptions = {}
): ApplyNarrativeNpcFallbackResult => {
  const safeCommands = Array.isArray(commands) ? commands : [];
  const payload = parseJsonRecord(input);
  if (!payload) {
    return { commands: safeCommands, applied: false, reasonClass: 'non-structured-input' };
  }

  const access = resolveFillTaskSheetAccess(payload);
  if (!access.allowNpcRegistry && !access.allowInteractionLog) {
    return { commands: safeCommands, applied: false, reasonClass: 'no-access' };
  }

  const strictAllowlist = options.strictAllowlist !== false;
  if (strictAllowlist && options.allowlist) {
    const allowNpc = !access.allowNpcRegistry
      || hasAllowlistedField(options.allowlist, 'NPC_Registry', 'NPC_ID');
    const allowLog = !access.allowInteractionLog
      || hasAllowlistedField(options.allowlist, 'NPC_InteractionLog', 'interaction_id');
    if (!allowNpc && !allowLog) {
      return { commands: safeCommands, applied: false, reasonClass: 'out-of-scope' };
    }
  }

  const narrativeRows = normalizeNarrativeRows(payload);
  if (narrativeRows.length === 0) {
    return { commands: safeCommands, applied: false, reasonClass: 'no-dialogue' };
  }

  const playerName = String(stateSnapshot?.角色?.姓名 || '').trim();
  const { idByName, nameById } = buildExistingNpcMaps(stateSnapshot);
  const coveredNpcNames = resolveCoveredNpcNames(safeCommands, nameById);

  const latestLineBySpeaker = new Map<string, string>();
  narrativeRows.forEach((row) => {
    if (isNarrationSender(row.sender, playerName)) return;
    latestLineBySpeaker.set(row.sender, row.text);
  });

  if (latestLineBySpeaker.size === 0) {
    return { commands: safeCommands, applied: false, reasonClass: 'no-dialogue' };
  }

  const fallbackNpcRows: Array<Record<string, unknown>> = [];
  const fallbackInteractionRows: Array<Record<string, unknown>> = [];
  const gameTime = String(payload.游戏时间 ?? stateSnapshot.游戏时间 ?? '').trim();
  const location = String(payload.当前地点 ?? stateSnapshot.当前地点 ?? '').trim();
  const turn = Math.max(1, Math.floor(Number((payload.回合数 ?? stateSnapshot.回合数 ?? 1) as number)));

  Array.from(latestLineBySpeaker.entries()).forEach(([speaker, line], index) => {
    if (coveredNpcNames.has(speaker)) return;

    const npcId = idByName.get(speaker) || createStableNpcId(speaker);
    const summary = trimSummary(`${speaker}：${line}`);
    if (!summary) return;

    if (access.allowNpcRegistry) {
      fallbackNpcRows.push({
        id: npcId,
        姓名: speaker,
        当前状态: '在场',
        是否在场: true,
        所在位置: location || undefined
      });
    }

    if (access.allowInteractionLog) {
      fallbackInteractionRows.push({
        interaction_id: `${npcId}_auto_${turn}_${index + 1}`,
        npc_id: npcId,
        npc_name: speaker,
        timestamp: gameTime,
        type: 'dialogue',
        summary,
        source: 'state-fallback:narrative-npc'
      });
    }
  });

  if (fallbackNpcRows.length === 0 && fallbackInteractionRows.length === 0) {
    return { commands: safeCommands, applied: false, reasonClass: 'already-covered' };
  }

  const nextCommands: TavernCommand[] = [...safeCommands];
  if (fallbackNpcRows.length > 0) {
    nextCommands.push({
      action: 'upsert_npc',
      value: fallbackNpcRows
    } as TavernCommand);
  }
  if (fallbackInteractionRows.length > 0) {
    nextCommands.push({
      action: 'upsert_sheet_rows',
      value: {
        sheetId: 'NPC_InteractionLog',
        keyField: 'interaction_id',
        rows: fallbackInteractionRows
      }
    } as TavernCommand);
  }

  const marker = `npc-fallback(npc=${fallbackNpcRows.length},interaction=${fallbackInteractionRows.length})`;
  return {
    commands: nextCommands,
    applied: true,
    reasonClass: 'applied',
    marker,
    createdNpcCount: fallbackNpcRows.length,
    createdInteractionCount: fallbackInteractionRows.length
  };
};

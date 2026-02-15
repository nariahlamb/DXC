import type { EconomicLedgerEntry, GameState, TavernCommand } from '../../types';

type AccountSpec = {
  id: EconomicLedgerEntry['account'];
  keyPath: string;
  readValue: (state: GameState) => number | null;
};

const ACCOUNT_SPECS: AccountSpec[] = [
  {
    id: '角色.法利',
    keyPath: 'gameState.角色.法利',
    readValue: (state) => (typeof state.角色?.法利 === 'number' && Number.isFinite(state.角色.法利) ? state.角色.法利 : null)
  },
  {
    id: '眷族.资金',
    keyPath: 'gameState.眷族.资金',
    readValue: (state) => (typeof state.眷族?.资金 === 'number' && Number.isFinite(state.眷族.资金) ? state.眷族.资金 : null)
  }
];

const getCommandAction = (cmd: TavernCommand): string => String(
  (cmd as any)?.action
  ?? (cmd as any)?.type
  ?? (cmd as any)?.command
  ?? (cmd as any)?.mode
  ?? ''
).trim().toLowerCase();

const getCommandKey = (cmd: TavernCommand): string => String((cmd as any)?.key ?? (cmd as any)?.path ?? '').trim();

const findCommandRefs = (commands: TavernCommand[], accountPath: string): string[] => {
  const accountAlias = accountPath.replace(/^gameState\./, '');
  return commands
    .map((cmd, index) => {
      const action = getCommandAction(cmd);
      const key = getCommandKey(cmd);
      if (!key) return '';
      if (!key.includes(accountPath) && !key.includes(accountAlias)) return '';
      return `${index + 1}:${action}:${key}`;
    })
    .filter(Boolean)
    .slice(0, 5);
};

const makeLedgerId = (turn: number, account: EconomicLedgerEntry['account']) => {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `ECO_${turn}_${account.replace('.', '_')}_${suffix}`;
};

export const collectEconomicLedgerEntries = (
  beforeState: GameState,
  afterState: GameState,
  commands: TavernCommand[],
  turn: number,
  timestamp: string
): EconomicLedgerEntry[] => {
  const entries: EconomicLedgerEntry[] = [];
  ACCOUNT_SPECS.forEach((spec) => {
    const before = spec.readValue(beforeState);
    const after = spec.readValue(afterState);
    if (before === null || after === null || before === after) return;
    const refs = findCommandRefs(commands, spec.keyPath);
    const commandRef = refs.length > 0 ? refs.join(' | ') : undefined;
    const reason = refs.length > 0
      ? `命令批次更新 ${spec.id}`
      : `状态推导更新 ${spec.id}`;
    entries.push({
      id: makeLedgerId(turn, spec.id),
      turn,
      timestamp,
      account: spec.id,
      before,
      delta: after - before,
      after,
      reason,
      commandRef
    });
  });
  return entries;
};

export const appendEconomicLedgerEntries = (
  state: GameState,
  entries: EconomicLedgerEntry[],
  maxEntries: number = 300
): GameState => {
  if (!Array.isArray(entries) || entries.length === 0) return state;
  const prev = Array.isArray(state.经济流水) ? state.经济流水 : [];
  const merged = [...prev, ...entries];
  return {
    ...state,
    经济流水: merged.length > maxEntries ? merged.slice(-maxEntries) : merged
  };
};


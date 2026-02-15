import type { GameState, TavernCommand } from '../../types';

const AM_INDEX_PATTERN = /^AM(\d+)$/i;

const getCommandAction = (cmd: TavernCommand): string => {
  return String(
    (cmd as any)?.action
      ?? (cmd as any)?.type
      ?? (cmd as any)?.command
      ?? (cmd as any)?.mode
      ?? ''
  ).trim().toLowerCase();
};

const toRecord = (value: unknown): Record<string, any> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, any>;
};

const amIndexToNumber = (amIndex: string): number => {
  const normalized = normalizeAmIndex(amIndex);
  if (!normalized) return 0;
  const matched = normalized.match(AM_INDEX_PATTERN);
  return matched ? Number.parseInt(matched[1], 10) : 0;
};

const sortAmIndexes = (list: string[]): string[] => {
  return [...list].sort((a, b) => amIndexToNumber(a) - amIndexToNumber(b));
};

export const normalizeAmIndex = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const matched = trimmed.match(AM_INDEX_PATTERN);
  if (!matched) return null;
  const numeric = Number.parseInt(matched[1], 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return `AM${numeric.toString().padStart(4, '0')}`;
};

export const formatAmIndex = (numeric: number): string => {
  const safe = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 1;
  return `AM${safe.toString().padStart(4, '0')}`;
};

export const getMaxAmNumericFromState = (state: Pick<GameState, '日志摘要' | '日志大纲'>): number => {
  const values: string[] = [];
  const appendIndexes = (rows: unknown[] | undefined) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      const record = toRecord(row);
      if (!record) return;
      const normalized = normalizeAmIndex(record.编码索引);
      if (normalized) values.push(normalized);
    });
  };

  appendIndexes(state.日志摘要 as unknown[] | undefined);
  appendIndexes(state.日志大纲 as unknown[] | undefined);

  return values.reduce((max, current) => {
    const numeric = amIndexToNumber(current);
    return numeric > max ? numeric : max;
  }, 0);
};

export const assignAmIndexesForLogCommands = (
  commands: TavernCommand[],
  state: Pick<GameState, '日志摘要' | '日志大纲'>
): TavernCommand[] => {
  if (!Array.isArray(commands) || commands.length === 0) return [];

  let nextNumeric = getMaxAmNumericFromState(state);
  const usedNumerics = new Set<number>();

  const rememberNumeric = (amIndex: string | null) => {
    if (!amIndex) return;
    const numeric = amIndexToNumber(amIndex);
    if (numeric <= 0) return;
    usedNumerics.add(numeric);
    if (numeric > nextNumeric) nextNumeric = numeric;
  };

  const cloned = commands.map((cmd) => {
    const rawValue = (cmd as any)?.value;
    const copiedValue = (rawValue && typeof rawValue === 'object')
      ? structuredClone(rawValue)
      : rawValue;
    return {
      ...(cmd as any),
      value: copiedValue
    } as TavernCommand;
  });

  const summaryPositions: number[] = [];
  const outlinePositions: number[] = [];

  cloned.forEach((cmd, index) => {
    const action = getCommandAction(cmd);
    if (action === 'append_log_summary') summaryPositions.push(index);
    if (action === 'append_log_outline') outlinePositions.push(index);
  });

  const pairCount = Math.min(summaryPositions.length, outlinePositions.length);
  const pairedPositions = new Set<number>([
    ...summaryPositions.slice(0, pairCount),
    ...outlinePositions.slice(0, pairCount)
  ]);

  cloned.forEach((cmd, index) => {
    if (pairedPositions.has(index)) return;
    const action = getCommandAction(cmd);
    if (action !== 'append_log_summary' && action !== 'append_log_outline') return;
    const payload = toRecord((cmd as any)?.value);
    rememberNumeric(normalizeAmIndex(payload?.编码索引));
  });

  const allocateNext = () => {
    do {
      nextNumeric += 1;
    } while (usedNumerics.has(nextNumeric));
    usedNumerics.add(nextNumeric);
    return formatAmIndex(nextNumeric);
  };

  for (let pairOffset = 0; pairOffset < pairCount; pairOffset += 1) {
    const summaryCommand = cloned[summaryPositions[pairOffset]];
    const outlineCommand = cloned[outlinePositions[pairOffset]];
    const summaryPayload = toRecord((summaryCommand as any)?.value);
    const outlinePayload = toRecord((outlineCommand as any)?.value);
    if (!summaryPayload || !outlinePayload) continue;

    const summaryProvided = normalizeAmIndex(summaryPayload.编码索引);
    const outlineProvided = normalizeAmIndex(outlinePayload.编码索引);
    const provided =
      (summaryProvided && outlineProvided && summaryProvided === outlineProvided)
        ? summaryProvided
        : (summaryProvided ?? outlineProvided);
    const expectedNext = nextNumeric + 1;

    let resolved: string | null = null;
    if (provided) {
      const providedNumeric = amIndexToNumber(provided);
      if (providedNumeric === expectedNext && !usedNumerics.has(providedNumeric)) {
        usedNumerics.add(providedNumeric);
        nextNumeric = providedNumeric;
        resolved = provided;
      }
    }
    if (!resolved) {
      resolved = allocateNext();
    }

    summaryPayload.编码索引 = resolved;
    outlinePayload.编码索引 = resolved;
    rememberNumeric(resolved);
  }

  return cloned;
};

export interface LogPairingIssues {
  missingOutline: string[];
  missingSummary: string[];
}

export const collectIndexedLogPairingIssues = (
  state: Pick<GameState, '日志摘要' | '日志大纲'>
): LogPairingIssues => {
  const summaryIndexes = new Set<string>();
  const outlineIndexes = new Set<string>();

  const collectIndexes = (rows: unknown[] | undefined, target: Set<string>) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      const record = toRecord(row);
      if (!record) return;
      const normalized = normalizeAmIndex(record.编码索引);
      if (!normalized) return;
      target.add(normalized);
    });
  };

  collectIndexes(state.日志摘要 as unknown[] | undefined, summaryIndexes);
  collectIndexes(state.日志大纲 as unknown[] | undefined, outlineIndexes);

  const missingOutline = sortAmIndexes(
    Array.from(summaryIndexes).filter((index) => !outlineIndexes.has(index))
  );
  const missingSummary = sortAmIndexes(
    Array.from(outlineIndexes).filter((index) => !summaryIndexes.has(index))
  );

  return { missingOutline, missingSummary };
};

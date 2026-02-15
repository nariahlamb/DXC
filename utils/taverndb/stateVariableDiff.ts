import type { TavernDBTableRow } from '../../types/taverndb';
import {
  STATE_VARIABLE_PILOT_SHEETS,
  type StateVariablePilotSheetId
} from './stateVariableMapping';

export type StateVariableDiffSheetSnapshot = {
  keyField: string;
  rows: TavernDBTableRow[];
};

export type StateVariableDiffSnapshot = Partial<Record<StateVariablePilotSheetId, StateVariableDiffSheetSnapshot>>;

export type StateVariableSheetDiffNoise = {
  missingKeyFieldRowsBaseline: number;
  missingKeyFieldRowsReplay: number;
  duplicateKeyRowsBaseline: number;
  duplicateKeyRowsReplay: number;
  rowOrderChanged: boolean;
};

export type StateVariableSheetDiffSummary = {
  sheetId: StateVariablePilotSheetId;
  keyField: string;
  baselineRows: number;
  replayRows: number;
  missingInReplay: number;
  missingInBaseline: number;
  changedRows: number;
  changedCells: number;
  noise: StateVariableSheetDiffNoise;
};

export type StateVariableDiffResult = {
  matched: boolean;
  sheetSummaries: StateVariableSheetDiffSummary[];
  totals: {
    missingInReplay: number;
    missingInBaseline: number;
    changedRows: number;
    changedCells: number;
  };
  noiseTotals: {
    missingKeyFieldRows: number;
    duplicateKeyRows: number;
    rowOrderChanges: number;
  };
};

export type StateVariableReplayGateThresholds = {
  invalidRowsWarn: number;
  invalidRowsError: number;
  missingRowsWarn: number;
  missingRowsError: number;
  changedRowsWarn: number;
  changedRowsError: number;
  changedCellsWarn: number;
  changedCellsError: number;
};

export type StateVariableReplayGateResult = {
  status: 'pass' | 'warn' | 'fail';
  reasons: string[];
  thresholds: StateVariableReplayGateThresholds;
};

export const DEFAULT_STATE_VARIABLE_REPLAY_GATE_THRESHOLDS: StateVariableReplayGateThresholds = {
  invalidRowsWarn: 1,
  invalidRowsError: 3,
  missingRowsWarn: 1,
  missingRowsError: 3,
  changedRowsWarn: 1,
  changedRowsError: 3,
  changedCellsWarn: 1,
  changedCellsError: 5
};

const DEFAULT_PILOT_KEY_FIELDS: Record<StateVariablePilotSheetId, string> = {
  SYS_GlobalState: '_global_id',
  CHARACTER_Resources: 'CHAR_ID',
  ITEM_Inventory: '物品ID'
};

const normalizeRows = (rows: unknown): TavernDBTableRow[] => {
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is TavernDBTableRow => !!row && typeof row === 'object' && !Array.isArray(row));
};

const resolveRowIdentity = (
  row: TavernDBTableRow,
  keyField: string,
  index: number
): { rowId: string; missingKeyField: boolean } => {
  const value = row?.[keyField];
  if (typeof value === 'string' && value.trim()) {
    return { rowId: value.trim(), missingKeyField: false };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { rowId: String(value), missingKeyField: false };
  }
  return { rowId: `__missing_id_${index + 1}`, missingKeyField: true };
};

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
};

const buildRowStats = (rows: TavernDBTableRow[], keyField: string): {
  map: Map<string, TavernDBTableRow>;
  order: string[];
  missingKeyFieldRows: number;
  duplicateKeyRows: number;
} => {
  const map = new Map<string, TavernDBTableRow>();
  const order: string[] = [];
  let missingKeyFieldRows = 0;
  let duplicateKeyRows = 0;

  rows.forEach((row, index) => {
    const identity = resolveRowIdentity(row, keyField, index);
    if (identity.missingKeyField) missingKeyFieldRows += 1;
    order.push(identity.rowId);
    if (map.has(identity.rowId)) {
      duplicateKeyRows += 1;
      return;
    }
    map.set(identity.rowId, row);
  });

  return {
    map,
    order,
    missingKeyFieldRows,
    duplicateKeyRows
  };
};

const isRowOrderChanged = (baselineOrder: string[], replayOrder: string[]): boolean => {
  const baselineFiltered = baselineOrder.filter((id) => replayOrder.includes(id));
  const replayFiltered = replayOrder.filter((id) => baselineOrder.includes(id));
  if (baselineFiltered.length <= 1 || replayFiltered.length <= 1) return false;
  return baselineFiltered.join('|') !== replayFiltered.join('|');
};

export const diffStateVariableSnapshots = (
  baseline: StateVariableDiffSnapshot,
  replay: StateVariableDiffSnapshot
): StateVariableDiffResult => {
  const sheetSummaries: StateVariableSheetDiffSummary[] = [];

  let totalMissingInReplay = 0;
  let totalMissingInBaseline = 0;
  let totalChangedRows = 0;
  let totalChangedCells = 0;
  let totalMissingKeyFieldRows = 0;
  let totalDuplicateKeyRows = 0;
  let totalRowOrderChanges = 0;

  STATE_VARIABLE_PILOT_SHEETS.forEach((sheetId) => {
    const baselineSheet = baseline?.[sheetId];
    const replaySheet = replay?.[sheetId];
    const keyField = String(
      baselineSheet?.keyField
      || replaySheet?.keyField
      || DEFAULT_PILOT_KEY_FIELDS[sheetId]
    ).trim() || DEFAULT_PILOT_KEY_FIELDS[sheetId];

    const baselineRows = normalizeRows(baselineSheet?.rows);
    const replayRows = normalizeRows(replaySheet?.rows);
    const baselineStats = buildRowStats(baselineRows, keyField);
    const replayStats = buildRowStats(replayRows, keyField);
    const rowIds = new Set<string>([...baselineStats.map.keys(), ...replayStats.map.keys()]);

    let missingInReplay = 0;
    let missingInBaseline = 0;
    let changedRows = 0;
    let changedCells = 0;

    rowIds.forEach((rowId) => {
      const baseRow = baselineStats.map.get(rowId);
      const replayRow = replayStats.map.get(rowId);

      if (!baseRow) {
        missingInBaseline += 1;
        return;
      }
      if (!replayRow) {
        missingInReplay += 1;
        return;
      }

      const fields = new Set<string>([
        ...Object.keys(baseRow),
        ...Object.keys(replayRow)
      ]);
      let rowChanged = false;
      fields.forEach((field) => {
        const baselineValue = stableStringify(baseRow[field]);
        const replayValue = stableStringify(replayRow[field]);
        if (baselineValue === replayValue) return;
        rowChanged = true;
        changedCells += 1;
      });
      if (rowChanged) changedRows += 1;
    });

    const rowOrderChanged = isRowOrderChanged(baselineStats.order, replayStats.order);
    const noise: StateVariableSheetDiffNoise = {
      missingKeyFieldRowsBaseline: baselineStats.missingKeyFieldRows,
      missingKeyFieldRowsReplay: replayStats.missingKeyFieldRows,
      duplicateKeyRowsBaseline: baselineStats.duplicateKeyRows,
      duplicateKeyRowsReplay: replayStats.duplicateKeyRows,
      rowOrderChanged
    };

    sheetSummaries.push({
      sheetId,
      keyField,
      baselineRows: baselineRows.length,
      replayRows: replayRows.length,
      missingInReplay,
      missingInBaseline,
      changedRows,
      changedCells,
      noise
    });

    totalMissingInReplay += missingInReplay;
    totalMissingInBaseline += missingInBaseline;
    totalChangedRows += changedRows;
    totalChangedCells += changedCells;
    totalMissingKeyFieldRows += noise.missingKeyFieldRowsBaseline + noise.missingKeyFieldRowsReplay;
    totalDuplicateKeyRows += noise.duplicateKeyRowsBaseline + noise.duplicateKeyRowsReplay;
    if (noise.rowOrderChanged) totalRowOrderChanges += 1;
  });

  const totals = {
    missingInReplay: totalMissingInReplay,
    missingInBaseline: totalMissingInBaseline,
    changedRows: totalChangedRows,
    changedCells: totalChangedCells
  };

  return {
    matched: totals.missingInReplay === 0
      && totals.missingInBaseline === 0
      && totals.changedRows === 0
      && totals.changedCells === 0,
    sheetSummaries,
    totals,
    noiseTotals: {
      missingKeyFieldRows: totalMissingKeyFieldRows,
      duplicateKeyRows: totalDuplicateKeyRows,
      rowOrderChanges: totalRowOrderChanges
    }
  };
};

export const evaluateStateVariableReplayGate = (params: {
  diff: StateVariableDiffResult;
  invalidRows?: number;
  thresholds?: Partial<StateVariableReplayGateThresholds>;
}): StateVariableReplayGateResult => {
  const thresholds: StateVariableReplayGateThresholds = {
    ...DEFAULT_STATE_VARIABLE_REPLAY_GATE_THRESHOLDS,
    ...(params.thresholds || {})
  };
  const invalidRows = Math.max(0, Math.floor(Number(params.invalidRows || 0)));
  const missingRows = Math.max(0, params.diff.totals.missingInReplay + params.diff.totals.missingInBaseline);
  const changedRows = Math.max(0, params.diff.totals.changedRows);
  const changedCells = Math.max(0, params.diff.totals.changedCells);
  const reasons: string[] = [];
  let status: StateVariableReplayGateResult['status'] = 'pass';

  if (invalidRows >= thresholds.invalidRowsError) {
    reasons.push(`invalidRows>=${thresholds.invalidRowsError}`);
    status = 'fail';
  } else if (invalidRows >= thresholds.invalidRowsWarn) {
    reasons.push(`invalidRows>=${thresholds.invalidRowsWarn}`);
    status = 'warn';
  }

  if (missingRows >= thresholds.missingRowsError) {
    reasons.push(`missingRows>=${thresholds.missingRowsError}`);
    status = 'fail';
  } else if (missingRows >= thresholds.missingRowsWarn && status !== 'fail') {
    reasons.push(`missingRows>=${thresholds.missingRowsWarn}`);
    status = 'warn';
  }

  if (changedRows >= thresholds.changedRowsError) {
    reasons.push(`changedRows>=${thresholds.changedRowsError}`);
    status = 'fail';
  } else if (changedRows >= thresholds.changedRowsWarn && status !== 'fail') {
    reasons.push(`changedRows>=${thresholds.changedRowsWarn}`);
    status = 'warn';
  }

  if (changedCells >= thresholds.changedCellsError) {
    reasons.push(`changedCells>=${thresholds.changedCellsError}`);
    status = 'fail';
  } else if (changedCells >= thresholds.changedCellsWarn && status !== 'fail') {
    reasons.push(`changedCells>=${thresholds.changedCellsWarn}`);
    status = 'warn';
  }

  if (!params.diff.matched && reasons.length === 0) {
    reasons.push('diff-not-matched');
    status = 'warn';
  }

  return {
    status,
    reasons,
    thresholds
  };
};

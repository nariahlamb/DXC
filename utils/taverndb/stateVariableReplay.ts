import type { GameState, TavernCommand } from '../../types';
import type { TavernDBTableRow } from '../../types/taverndb';
import { consumeStateVariableEvents } from '../../hooks/gameLogic/microservice/stateVariableWriter';
import {
  STATE_VARIABLE_PILOT_SHEETS,
  type StateVariablePilotSheetId
} from './stateVariableMapping';
import type { StateVariableEvent } from './stateVariableEvent';
import { normalizeStateVariableEvent } from './stateVariableEvent';
import type { StateVariableDiffSnapshot } from './stateVariableDiff';
import { projectGameStateToTavernTables } from './tableProjection';

const PILOT_KEY_FIELDS: Record<StateVariablePilotSheetId, string> = {
  SYS_GlobalState: '_global_id',
  CHARACTER_Resources: 'CHAR_ID',
  ITEM_Inventory: '物品ID'
};

type ReplaySheetStore = {
  keyField: string;
  rows: Map<string, TavernDBTableRow>;
};

const cloneRow = (row: unknown): TavernDBTableRow => {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
  return { ...(row as Record<string, unknown>) };
};

const readRowId = (row: TavernDBTableRow, keyField: string, index: number): string => {
  const raw = row?.[keyField];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return `__row_${index + 1}`;
};

const readSheetRowsFromState = (state: GameState, sheetId: StateVariablePilotSheetId): TavernDBTableRow[] => {
  const direct = (state as any)?.__tableRows?.[sheetId];
  if (Array.isArray(direct)) {
    return direct.map((row: unknown) => cloneRow(row));
  }
  const projected = projectGameStateToTavernTables(state, { includeEmptySheets: true })
    .find((table) => table.id === sheetId);
  return Array.isArray(projected?.rows) ? projected!.rows.map((row) => cloneRow(row)) : [];
};

const normalizeSheetStore = (snapshot: StateVariableDiffSnapshot): Record<StateVariablePilotSheetId, ReplaySheetStore> => {
  const store = {} as Record<StateVariablePilotSheetId, ReplaySheetStore>;
  STATE_VARIABLE_PILOT_SHEETS.forEach((sheetId) => {
    const keyField = String(snapshot?.[sheetId]?.keyField || PILOT_KEY_FIELDS[sheetId]).trim() || PILOT_KEY_FIELDS[sheetId];
    const rowMap = new Map<string, TavernDBTableRow>();
    const rows = Array.isArray(snapshot?.[sheetId]?.rows) ? snapshot![sheetId]!.rows : [];
    rows.forEach((row, index) => {
      const normalized = cloneRow(row);
      rowMap.set(readRowId(normalized, keyField, index), normalized);
    });
    store[sheetId] = { keyField, rows: rowMap };
  });
  return store;
};

const parseUpsertPayloads = (command: TavernCommand): Array<{ sheetId: string; keyField?: string; rows: TavernDBTableRow[] }> => {
  const value = (command as any)?.value;
  const source = Array.isArray(value) ? value : [value];
  const payloads: Array<{ sheetId: string; keyField?: string; rows: TavernDBTableRow[] }> = [];
  source.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const sheetId = String((item as any).sheetId || (item as any).sheet_id || '').trim();
    const rows = Array.isArray((item as any).rows)
      ? (item as any).rows.map((row: unknown) => cloneRow(row))
      : [];
    if (!sheetId || rows.length === 0) return;
    const keyField = typeof (item as any).keyField === 'string'
      ? String((item as any).keyField || '').trim()
      : undefined;
    payloads.push({ sheetId, keyField, rows });
  });
  return payloads;
};

const parseDeletePayload = (command: TavernCommand): { sheetId: string; rowIds: string[] } | null => {
  const value = (command as any)?.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const sheetId = String((value as any).sheetId || (value as any).sheet_id || '').trim();
  const rowIds = Array.isArray((value as any).rowIds)
    ? (value as any).rowIds.map((rowId: unknown) => String(rowId || '').trim()).filter(Boolean)
    : [];
  if (!sheetId || rowIds.length === 0) return null;
  return { sheetId, rowIds };
};

const applyWriterCommandsToSnapshot = (
  baseSnapshot: StateVariableDiffSnapshot,
  commands: TavernCommand[]
): StateVariableDiffSnapshot => {
  const store = normalizeSheetStore(baseSnapshot);
  const pilotSet = new Set<StateVariablePilotSheetId>(STATE_VARIABLE_PILOT_SHEETS);

  commands.forEach((command) => {
    const action = String((command as any)?.action || (command as any)?.type || '').trim().toLowerCase();
    if (action === 'upsert_sheet_rows') {
      const payloads = parseUpsertPayloads(command);
      payloads.forEach((payload) => {
        const sheetId = payload.sheetId as StateVariablePilotSheetId;
        if (!pilotSet.has(sheetId)) return;
        const sheetStore = store[sheetId];
        const keyField = payload.keyField || sheetStore.keyField;
        payload.rows.forEach((row, rowIndex) => {
          const rowId = readRowId(row, keyField, rowIndex);
          const prev = sheetStore.rows.get(rowId) || {};
          sheetStore.rows.set(rowId, { ...prev, ...row });
        });
      });
      return;
    }

    if (action !== 'delete_sheet_rows') return;
    const payload = parseDeletePayload(command);
    if (!payload) return;
    const sheetId = payload.sheetId as StateVariablePilotSheetId;
    if (!pilotSet.has(sheetId)) return;
    payload.rowIds.forEach((rowId) => {
      store[sheetId].rows.delete(rowId);
    });
  });

  const snapshot = {} as StateVariableDiffSnapshot;
  STATE_VARIABLE_PILOT_SHEETS.forEach((sheetId) => {
    snapshot[sheetId] = {
      keyField: store[sheetId].keyField,
      rows: Array.from(store[sheetId].rows.values())
    };
  });
  return snapshot;
};

const parsePayload = (rawPayload: unknown): unknown => {
  if (rawPayload === null || rawPayload === undefined) return undefined;
  if (typeof rawPayload !== 'string') return rawPayload;
  const text = rawPayload.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return rawPayload;
  }
};

export const collectStateVariableDiffSnapshot = (state: GameState): StateVariableDiffSnapshot => {
  const snapshot = {} as StateVariableDiffSnapshot;
  STATE_VARIABLE_PILOT_SHEETS.forEach((sheetId) => {
    snapshot[sheetId] = {
      keyField: PILOT_KEY_FIELDS[sheetId],
      rows: readSheetRowsFromState(state, sheetId)
    };
  });
  return snapshot;
};

export const parseStateVariableEventLogRows = (
  rows: TavernDBTableRow[]
): { events: StateVariableEvent[]; invalidRows: number; invalidRowsByReason: Record<string, number> } => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const events: StateVariableEvent[] = [];
  let invalidRows = 0;
  const invalidRowsByReason: Record<string, number> = {};
  const bumpInvalidReason = (reason: string) => {
    invalidRows += 1;
    invalidRowsByReason[reason] = Number(invalidRowsByReason[reason] || 0) + 1;
  };

  sourceRows.forEach((row, index) => {
    try {
      const requiredKeys: Array<keyof TavernDBTableRow> = [
        'event_id',
        'turn_id',
        'source',
        'domain',
        'entity_id',
        'path',
        'op',
        'idempotency_key'
      ];
      const missingRequired = requiredKeys.some((key) => String(row?.[key] ?? '').trim() === '');
      const createdAt = Number(row?.created_at);
      if (missingRequired || !Number.isFinite(createdAt)) {
        bumpInvalidReason(missingRequired ? 'missing_required' : 'invalid_created_at');
        return;
      }
      const event = normalizeStateVariableEvent({
        event_id: row.event_id ?? `event_log_${index + 1}`,
        turn_id: row.turn_id ?? '',
        source: row.source ?? '',
        domain: row.domain ?? '',
        entity_id: row.entity_id ?? '',
        path: row.path ?? '',
        op: row.op ?? 'upsert',
        value: parsePayload(row.payload),
        expected_version: row.expected_version === null || row.expected_version === undefined
          ? undefined
          : Number(row.expected_version),
        idempotency_key: row.idempotency_key ?? '',
        created_at: createdAt
      });
      events.push(event);
    } catch {
      bumpInvalidReason('invalid_event_payload');
    }
  });

  events.sort((left, right) => {
    if (left.created_at !== right.created_at) return left.created_at - right.created_at;
    return String(left.event_id).localeCompare(String(right.event_id));
  });

  return { events, invalidRows, invalidRowsByReason };
};

export const readStateVariableEventLogRowsFromState = (state: GameState): TavernDBTableRow[] => {
  const direct = (state as any)?.__tableRows?.SYS_StateVarEventLog;
  if (Array.isArray(direct)) {
    return direct.map((row: unknown) => cloneRow(row));
  }
  return [];
};

export type StateVariableReplayResult = {
  snapshot: StateVariableDiffSnapshot;
  acceptedEvents: number;
  skippedEvents: number;
  commands: TavernCommand[];
  auditCommands: TavernCommand[];
};

export const replayStateVariableEventsToSnapshot = (
  stateSnapshot: GameState,
  events: Array<StateVariableEvent | Partial<StateVariableEvent>>
): StateVariableReplayResult => {
  const normalizedEvents = Array.isArray(events) ? events : [];
  const consumed = consumeStateVariableEvents({
    stateSnapshot,
    events: normalizedEvents,
    shadowMode: true
  });
  const baseSnapshot = collectStateVariableDiffSnapshot(stateSnapshot);
  const replaySnapshot = applyWriterCommandsToSnapshot(baseSnapshot, consumed.commands);
  return {
    snapshot: replaySnapshot,
    acceptedEvents: consumed.acceptedEvents.length,
    skippedEvents: consumed.skippedEvents.length,
    commands: consumed.commands,
    auditCommands: consumed.auditCommands
  };
};

export const replayStateVariableEventLogFromState = (
  baseState: GameState,
  eventLogState: GameState
): {
  snapshot: StateVariableDiffSnapshot;
  acceptedEvents: number;
  skippedEvents: number;
  invalidEventLogRows: number;
  invalidEventLogRowsByReason: Record<string, number>;
  commands: TavernCommand[];
  auditCommands: TavernCommand[];
} => {
  const eventRows = readStateVariableEventLogRowsFromState(eventLogState);
  const parsed = parseStateVariableEventLogRows(eventRows);
  const replayed = replayStateVariableEventsToSnapshot(baseState, parsed.events);
  return {
    ...replayed,
    invalidEventLogRows: parsed.invalidRows,
    invalidEventLogRowsByReason: parsed.invalidRowsByReason
  };
};

export const createStateVariableEventLogRows = (events: StateVariableEvent[]): TavernDBTableRow[] => {
  return (Array.isArray(events) ? events : []).map((event) => ({
    event_id: event.event_id,
    turn_id: event.turn_id,
    source: event.source,
    domain: event.domain,
    entity_id: event.entity_id,
    path: event.path,
    op: event.op,
    idempotency_key: event.idempotency_key,
    expected_version: event.expected_version ?? null,
    payload: JSON.stringify(event.value ?? null),
    created_at: event.created_at
  }));
};

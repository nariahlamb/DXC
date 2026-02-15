import type { TavernCommand } from '../../types';
import {
  createStateVariableEvent,
  type StateVariableEvent,
  type StateVariableEventOp
} from './stateVariableEvent';
import {
  isStateVariablePilotSheet,
  mapLegacyPathToStateVariableTarget,
  mapSheetRowToStateVariableTarget
} from './stateVariableMapping';

export type BuildStateVariableEventsOptions = {
  turnId: string;
  source: string;
  includeSheets?: string[];
};

const LEGACY_EVENT_ACTIONS = new Set(['set', 'add', 'push', 'delete']);

const normalizeAction = (cmd: TavernCommand): string => {
  return String((cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? '').trim().toLowerCase();
};

const normalizeSheetPayloads = (value: unknown): Array<{ sheetId: string; rows: Array<Record<string, unknown>> }> => {
  if (!value || typeof value !== 'object') return [];
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const payload = item as Record<string, unknown>;
      const sheetId = String(payload.sheetId ?? payload.sheet_id ?? '').trim();
      const rows = Array.isArray(payload.rows)
        ? payload.rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object')
        : [];
      if (!sheetId || rows.length === 0) return null;
      return { sheetId, rows };
    })
    .filter((item): item is { sheetId: string; rows: Array<Record<string, unknown>> } => !!item);
};

const resolveExpectedVersion = (cmd: TavernCommand): number | undefined => {
  // 仅透传 row version。sheet version 属于事务层并发控制，不应映射为事件的 expected_version。
  const rowVersion = Number((cmd as any)?.expectedRowVersion ?? (cmd as any)?.expected_row_version);
  if (Number.isFinite(rowVersion)) return Math.max(0, Math.floor(rowVersion));
  return undefined;
};

export const buildStateVariableEventsFromCommands = (
  commands: TavernCommand[],
  options: BuildStateVariableEventsOptions
): StateVariableEvent[] => {
  const commandList = Array.isArray(commands) ? commands : [];
  const includeSheets = new Set((options.includeSheets || []).map((sheet) => String(sheet).trim()).filter(Boolean));
  const shouldFilterBySheets = includeSheets.size > 0;
  const events: StateVariableEvent[] = [];

  commandList.forEach((cmd, commandIndex) => {
    const action = normalizeAction(cmd);
    const expectedVersion = resolveExpectedVersion(cmd);

    if (LEGACY_EVENT_ACTIONS.has(action)) {
      const target = mapLegacyPathToStateVariableTarget((cmd as any)?.key ?? (cmd as any)?.path);
      if (!target) return;
      events.push(createStateVariableEvent({
        turn_id: options.turnId,
        source: options.source,
        domain: target.domain,
        entity_id: target.entityId,
        path: target.path,
        op: action as StateVariableEventOp,
        value: (cmd as any)?.value,
        expected_version: expectedVersion,
        event_id: `legacy_${options.turnId}_${commandIndex}`,
        idempotency_key: `${options.turnId}:legacy:${commandIndex}:${action}:${target.path}`
      }));
      return;
    }

    if (action !== 'upsert_sheet_rows') return;

    const payloads = normalizeSheetPayloads((cmd as any)?.value);
    payloads.forEach((payload, payloadIndex) => {
      if (!isStateVariablePilotSheet(payload.sheetId)) return;
      if (shouldFilterBySheets && !includeSheets.has(payload.sheetId)) return;
      payload.rows.forEach((row, rowIndex) => {
        const target = mapSheetRowToStateVariableTarget(payload.sheetId, row);
        if (!target) return;
        events.push(createStateVariableEvent({
          turn_id: options.turnId,
          source: options.source,
          domain: target.domain,
          entity_id: target.entityId,
          path: target.path,
          op: 'upsert',
          value: row,
          expected_version: expectedVersion,
          event_id: `sheet_${options.turnId}_${commandIndex}_${payloadIndex}_${rowIndex}`,
          idempotency_key: `${options.turnId}:sheet:${payload.sheetId}:${target.entityId}:${commandIndex}:${rowIndex}`
        }));
      });
    });
  });

  return events;
};

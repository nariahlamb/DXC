import type { StateVarDomainSheetFieldAllowlist, TavernCommand } from '../../../types';

const MEMORY_OWNED_ACTIONS = new Set(['append_log_summary', 'append_log_outline']);
const MEMORY_OWNED_SHEETS = new Set(['LOG_Summary', 'LOG_Outline']);

export type CommandGuardContext = {
  serviceKey: string;
  commands: TavernCommand[];
  stateWorldCadenceDue: boolean;
  stateForumCadenceDue: boolean;
  legacyPathActions: Set<string>;
  resolveSheetIdFromCommand: (cmd: TavernCommand) => string;
  worldIntervalControlledSheets: Set<string>;
  forumIntervalControlledSheets: Set<string>;
  strictAllowlist?: boolean;
  allowlist?: StateVarDomainSheetFieldAllowlist;
};

export type CommandGuardRejectReason =
  | 'memory_owned'
  | 'cadence_not_due'
  | 'sheet_not_allowed'
  | 'field_not_allowed'
  | 'not_supported_action';

export type CommandGuardReject = {
  reason: CommandGuardRejectReason;
  action: string;
  sheetId?: string;
  field?: string;
};

export type CommandGuardResult = {
  commands: TavernCommand[];
  rejected: CommandGuardReject[];
};

const normalizeAction = (cmd: any): string => {
  return String(cmd?.action ?? cmd?.type ?? cmd?.command ?? cmd?.name ?? cmd?.cmd ?? '').trim().toLowerCase();
};

const normalizeSheetPayloads = (value: unknown): Array<{ sheetId: string; keyField?: string; rows: Array<Record<string, unknown>> }> => {
  if (!value || typeof value !== 'object') return [];
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const sheetId = String((item as any).sheetId ?? (item as any).sheet_id ?? '').trim();
      const rows = Array.isArray((item as any).rows)
        ? (item as any).rows.filter((row: any) => !!row && typeof row === 'object' && !Array.isArray(row))
        : [];
      if (!sheetId || rows.length === 0) return null;
      const keyField = typeof (item as any).keyField === 'string' ? String((item as any).keyField || '').trim() : undefined;
      return { sheetId, keyField, rows };
    })
    .filter(Boolean) as Array<{ sheetId: string; keyField?: string; rows: Array<Record<string, unknown>> }>;
};

const buildAllowedFieldsBySheet = (allowlist: StateVarDomainSheetFieldAllowlist): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  Object.values(allowlist || {}).forEach((sheetMap) => {
    Object.entries(sheetMap || {}).forEach(([sheetId, fields]) => {
      const normalizedSheetId = String(sheetId || '').trim();
      if (!normalizedSheetId) return;
      const fieldSet = map.get(normalizedSheetId) || new Set<string>();
      (Array.isArray(fields) ? fields : [])
        .map((field) => String(field ?? '').trim())
        .filter(Boolean)
        .forEach((field) => fieldSet.add(field));
      map.set(normalizedSheetId, fieldSet);
    });
  });
  return map;
};

export const filterCommandsForServiceWithDiagnostics = (context: CommandGuardContext): CommandGuardResult => {
  const {
    serviceKey,
    commands,
    stateWorldCadenceDue,
    stateForumCadenceDue,
    legacyPathActions,
    resolveSheetIdFromCommand,
    worldIntervalControlledSheets,
    forumIntervalControlledSheets,
    strictAllowlist,
    allowlist
  } = context;

  const safeCommands = Array.isArray(commands) ? commands : [];
  const normalizedServiceKey = serviceKey === 'memory' || serviceKey === 'map' ? serviceKey : 'state';
  const rejected: CommandGuardReject[] = [];

  const allowedFieldsBySheet = strictAllowlist && allowlist
    ? buildAllowedFieldsBySheet(allowlist)
    : null;

  const out: TavernCommand[] = [];

  safeCommands.forEach((cmd: any) => {
    const k = String(cmd?.key ?? cmd?.path ?? '').trim();
    const action = normalizeAction(cmd);
    const sheetId = (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows')
      ? resolveSheetIdFromCommand(cmd as TavernCommand)
      : '';

    if (normalizedServiceKey === 'memory') {
      if (MEMORY_OWNED_ACTIONS.has(action)) {
        out.push(cmd as TavernCommand);
        return;
      }
      if (action === 'upsert_sheet_rows') {
        if (MEMORY_OWNED_SHEETS.has(sheetId)) {
          out.push(cmd as TavernCommand);
          return;
        }
        rejected.push({ reason: 'memory_owned', action, sheetId });
        return;
      }
      rejected.push({ reason: 'not_supported_action', action, sheetId: sheetId || undefined });
      return;
    }

    if (normalizedServiceKey === 'state') {
      // 迁移边界：LOG_Summary / LOG_Outline 不在本次 state variable writer 迁移范围内。
      if (MEMORY_OWNED_ACTIONS.has(action)) {
        rejected.push({ reason: 'memory_owned', action });
        return;
      }
      if (legacyPathActions.has(action)) {
        if (!stateWorldCadenceDue && /^gameState\.世界(\.|$)/.test(k)) {
          rejected.push({ reason: 'cadence_not_due', action });
          return;
        }
        if (!stateForumCadenceDue && /^gameState\.手机\.公共帖子(\.|$)/.test(k)) {
          rejected.push({ reason: 'cadence_not_due', action });
          return;
        }
      }
      if (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') {
        if (MEMORY_OWNED_SHEETS.has(sheetId)) {
          rejected.push({ reason: 'memory_owned', action, sheetId });
          return;
        }
        if (!stateWorldCadenceDue && worldIntervalControlledSheets.has(sheetId)) {
          rejected.push({ reason: 'cadence_not_due', action, sheetId });
          return;
        }
        if (!stateForumCadenceDue && forumIntervalControlledSheets.has(sheetId)) {
          rejected.push({ reason: 'cadence_not_due', action, sheetId });
          return;
        }
        if (allowedFieldsBySheet) {
          const allowed = allowedFieldsBySheet.get(sheetId);
          if (!allowed || allowed.size === 0) {
            rejected.push({ reason: 'sheet_not_allowed', action, sheetId });
            return;
          }
          if (action === 'delete_sheet_rows') {
            out.push(cmd as TavernCommand);
            return;
          }
          const payloads = normalizeSheetPayloads((cmd as any)?.value);
          if (payloads.length === 0) {
            rejected.push({ reason: 'sheet_not_allowed', action, sheetId });
            return;
          }
          const nextPayloads: any[] = [];
          payloads.forEach((payload) => {
            const sheetAllowed = allowedFieldsBySheet.get(payload.sheetId);
            if (!sheetAllowed || sheetAllowed.size === 0) {
              rejected.push({ reason: 'sheet_not_allowed', action, sheetId: payload.sheetId });
              return;
            }
            const nextRows: Array<Record<string, unknown>> = [];
            payload.rows.forEach((row) => {
              const nextRow: Record<string, unknown> = {};
              Object.entries(row).forEach(([field, value]) => {
                if (sheetAllowed.has(field)) {
                  nextRow[field] = value;
                } else {
                  rejected.push({ reason: 'field_not_allowed', action, sheetId: payload.sheetId, field });
                }
              });
              if (Object.keys(nextRow).length > 0) {
                nextRows.push(nextRow);
              }
            });
            if (nextRows.length > 0) {
              nextPayloads.push({ ...payload, rows: nextRows });
            }
          });
          if (nextPayloads.length === 0) {
            rejected.push({ reason: 'sheet_not_allowed', action, sheetId });
            return;
          }
          const originalValue = (cmd as any)?.value;
          const nextValue = Array.isArray(originalValue) ? nextPayloads : nextPayloads[0];
          out.push({ ...(cmd as any), value: nextValue } as TavernCommand);
          return;
        }
      }
      out.push(cmd as TavernCommand);
      return;
    }

    if (normalizedServiceKey === 'map') {
      if (
        action === 'upsert_exploration_map'
        || action === 'set_map_visuals'
        || action === 'upsert_battle_map_rows'
      ) {
        out.push(cmd as TavernCommand);
        return;
      }
      rejected.push({ reason: 'not_supported_action', action });
      return;
    }

    rejected.push({ reason: 'not_supported_action', action });
  });

  return { commands: out, rejected };
};

export const filterCommandsForService = (context: CommandGuardContext): TavernCommand[] => {
  return filterCommandsForServiceWithDiagnostics(context).commands;
};

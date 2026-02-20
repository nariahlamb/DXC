import type { StateVarDomainSheetFieldAllowlist, TavernCommand } from '../../../types';
import { buildDefaultStateVariableAllowlist } from '../../../utils/taverndb/sheetRegistry';

const MEMORY_OWNED_ACTIONS = new Set(['append_log_summary', 'append_log_outline']);
const MEMORY_OWNED_SHEETS = new Set(['LOG_Summary', 'LOG_Outline']);
const UI_TRANSIENT_LEGACY_PATH_PREFIXES = [
  'gameState.处理中',
  'gameState.当前界面',
  'gameState.日常仪表盘'
];

const normalizeLegacyPath = (value: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.startsWith('gameState.') ? raw : `gameState.${raw}`;
};

const isUiTransientLegacyPath = (value: unknown): boolean => {
  const path = normalizeLegacyPath(value);
  if (!path) return false;
  return UI_TRANSIENT_LEGACY_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}.`));
};

const isBlockedLegacyBusinessPath = (value: unknown): boolean => {
  const path = normalizeLegacyPath(value);
  if (!path || !path.startsWith('gameState.')) return false;
  return !isUiTransientLegacyPath(path);
};

export type CommandGuardContext = {
  serviceKey: string;
  commands: TavernCommand[];
  stateWorldCadenceDue: boolean;
  stateForumCadenceDue: boolean;
  stateWorldCadenceManualMode?: boolean;
  stateForumCadenceManualMode?: boolean;
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
  | 'legacy_path_blocked'
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
  const primary = String(cmd?.action ?? cmd?.type ?? '').trim().toLowerCase();
  const fallback = String(cmd?.command ?? cmd?.name ?? cmd?.mode ?? cmd?.cmd ?? '').trim().toLowerCase();
  if (!primary) return fallback;
  if (primary === 'table_op' && fallback) return fallback;
  return primary;
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

const cloneAllowedFieldsBySheet = (source: Map<string, Set<string>>): Map<string, Set<string>> => {
  const cloned = new Map<string, Set<string>>();
  source.forEach((fields, sheetId) => {
    cloned.set(sheetId, new Set<string>(fields));
  });
  return cloned;
};

const DEFAULT_ALLOWED_FIELDS_BY_SHEET = buildAllowedFieldsBySheet(buildDefaultStateVariableAllowlist());

const buildStrictAllowedFieldsBySheet = (
  allowlist?: StateVarDomainSheetFieldAllowlist
): Map<string, Set<string>> => {
  const merged = cloneAllowedFieldsBySheet(DEFAULT_ALLOWED_FIELDS_BY_SHEET);
  if (!allowlist) return merged;
  const custom = buildAllowedFieldsBySheet(allowlist);
  custom.forEach((fields, sheetId) => {
    merged.set(sheetId, new Set<string>(fields));
  });
  return merged;
};

export const filterCommandsForServiceWithDiagnostics = (context: CommandGuardContext): CommandGuardResult => {
  const {
    serviceKey,
    commands,
    stateWorldCadenceDue,
    stateForumCadenceDue,
    stateWorldCadenceManualMode,
    stateForumCadenceManualMode,
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

  const allowedFieldsBySheet = strictAllowlist
    ? buildStrictAllowedFieldsBySheet(allowlist)
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
        const canonicalLegacyPath = normalizeLegacyPath(k);
        if (!stateWorldCadenceManualMode && !stateWorldCadenceDue && /^gameState\.世界(\.|$)/.test(canonicalLegacyPath)) {
          rejected.push({ reason: 'cadence_not_due', action });
          return;
        }
        if (!stateForumCadenceManualMode && !stateForumCadenceDue && /^gameState\.手机\.公共帖子(\.|$)/.test(canonicalLegacyPath)) {
          rejected.push({ reason: 'cadence_not_due', action });
          return;
        }
        if (isBlockedLegacyBusinessPath(canonicalLegacyPath)) {
          rejected.push({ reason: 'legacy_path_blocked', action });
          return;
        }
      }
      if (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') {
        if (MEMORY_OWNED_SHEETS.has(sheetId)) {
          rejected.push({ reason: 'memory_owned', action, sheetId });
          return;
        }
        if (!stateWorldCadenceManualMode && !stateWorldCadenceDue && worldIntervalControlledSheets.has(sheetId)) {
          rejected.push({ reason: 'cadence_not_due', action, sheetId });
          return;
        }
        if (!stateForumCadenceManualMode && !stateForumCadenceDue && forumIntervalControlledSheets.has(sheetId)) {
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

import { LogEntry, TavernCommand } from '../../types';
import type {
  TavernDBPatchConflict,
  TavernDBPatchTrace,
  TavernDBRuntimeMeta,
  TavernDBSheetPatch,
  TavernDBTransactionTrace
} from '../../types/taverndb';
import { TableStore } from './tableStore';

export interface CommandApplyResult<TState> {
  newState: TState;
  logs: LogEntry[];
  hasError?: boolean;
  sheetPatches?: TavernDBSheetPatch[];
}

export interface TurnTransactionResult<TState> extends CommandApplyResult<TState> {
  rolledBack: boolean;
  appliedPatches: number;
}

interface TurnTransactionOptions {
  forceAtomic?: boolean;
  transactionalActions?: Iterable<string>;
}

const DEFAULT_TRANSACTIONAL_ACTIONS = new Set([
  'set_encounter_rows',
  'upsert_battle_map_rows',
  'set_map_visuals',
  'set_initiative',
  'consume_dice_rows',
  'refill_dice_pool',
  'roll_dice_check',
  'set_action_economy',
  'spend_action_resource',
  'resolve_attack_check',
  'resolve_saving_throw',
  'resolve_damage_roll',
  'append_combat_resolution'
]);

const ERROR_LOG_PATTERN = /失败|异常|错误|invalid|missing|out of bounds/i;
const TX_JOURNAL_LIMIT = 80;
const LOG_SHEET_IDS = new Set(['LOG_Summary', 'LOG_Outline']);

const isAllowedLogSheetPatchSource = (rawSource: unknown): boolean => {
  const source = String(rawSource || '').trim();
  // Backward compatibility: legacy/unified command paths may not stamp source.
  if (!source) return true;
  return source.startsWith('ms:memory');
};

const normalizeAction = (cmd: TavernCommand) =>
  String((cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? (cmd as any)?.mode ?? '')
    .trim()
    .toLowerCase();

const getTransactionMarker = (cmd: TavernCommand) => {
  const marker =
    (cmd as any)?.transactionId
    ?? (cmd as any)?.txId
    ?? (cmd as any)?.turnId
    ?? (cmd as any)?.turn
    ?? (cmd as any)?.回合;

  if (marker === undefined || marker === null || marker === '') return '';
  return String(marker);
};

const shouldUseTransaction = (
  commands: TavernCommand[],
  options: TurnTransactionOptions
) => {
  if (commands.length <= 1) return false;
  if (options.forceAtomic) return true;

  if (commands.some((cmd) => (cmd as any)?.atomic === true || (cmd as any)?.transaction === true)) {
    return true;
  }

  const markerSet = new Set(commands.map(getTransactionMarker).filter(Boolean));
  if (markerSet.size > 0) return true;

  const actionSet = options.transactionalActions
    ? new Set(Array.from(options.transactionalActions, (item) => String(item).trim().toLowerCase()))
    : DEFAULT_TRANSACTIONAL_ACTIONS;

  const transactionalCount = commands.reduce((count, cmd) => {
    return actionSet.has(normalizeAction(cmd)) ? count + 1 : count;
  }, 0);

  return transactionalCount > 1;
};

const hasApplyError = <TState>(result: CommandApplyResult<TState>) => {
  if (result.hasError) return true;
  return (result.logs || []).some((log) => ERROR_LOG_PATTERN.test(String(log?.text || '')));
};

const cloneStateWithMeta = <TState>(state: TState, tableMeta: unknown): TState => {
  if (!state || typeof state !== 'object') return state;
  const next = Array.isArray(state) ? [...(state as unknown as any[])] : { ...(state as any) };
  (next as any).__tableMeta = tableMeta;
  return next as TState;
};

const buildTxId = (): string => `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const extractCommandSource = (cmd: TavernCommand): string => {
  const source = (cmd as any)?.source;
  if (typeof source === 'string' && source.trim()) return source.trim();
  return normalizeAction(cmd) || 'unknown';
};

const toPatchTraces = (patches: TavernDBSheetPatch[] = []): TavernDBPatchTrace[] => {
  return patches.map((patch) => ({
    sheetId: patch.sheetId,
    rowId: patch.rowId,
    operation: patch.operation,
    changedFields: Array.isArray(patch.changedFields)
      ? patch.changedFields.map((field) => String(field || '').trim()).filter(Boolean)
      : undefined
  }));
};

const appendTransactionTrace = <TState>(state: TState, trace: TavernDBTransactionTrace): TState => {
  if (!state || typeof state !== 'object') return state;
  const next = Array.isArray(state) ? [...(state as unknown as any[])] : { ...(state as any) };
  const currentMeta = ((next as any).__tableMeta || {}) as TavernDBRuntimeMeta;
  const journal = Array.isArray(currentMeta.txJournal) ? currentMeta.txJournal : [];
  (next as any).__tableMeta = {
    ...currentMeta,
    txJournal: [...journal, trace].slice(-TX_JOURNAL_LIMIT)
  };
  return next as TState;
};

const formatConflictLine = (conflict: TavernDBPatchConflict): string => {
  const rowId = String(conflict.rowId);
  if (conflict.reason === 'sheet_version_conflict' || conflict.reason === 'row_version_conflict') {
    return `${conflict.sheetId}/${rowId} ${conflict.reason} expected=${conflict.expected ?? '-'} actual=${conflict.actual ?? '-'}`;
  }
  if (conflict.reason === 'cell_locked') {
    return `${conflict.sheetId}/${rowId} cell_locked field=${conflict.field || '-'}`;
  }
  if (conflict.reason === 'source_not_allowed') {
    return `${conflict.sheetId}/${rowId} source_not_allowed ${conflict.message}`;
  }
  return `${conflict.sheetId}/${rowId} ${conflict.reason}`;
};

const resolveSourceOwnershipConflicts = (patches: TavernDBSheetPatch[]): TavernDBPatchConflict[] => {
  if (!Array.isArray(patches) || patches.length === 0) return [];
  return patches
    .filter((patch) => LOG_SHEET_IDS.has(String(patch.sheetId || '')))
    .filter((patch) => !isAllowedLogSheetPatchSource(patch.source))
    .map((patch) => {
      const source = String(patch.source || '').trim() || 'unspecified';
      return {
        sheetId: patch.sheetId,
        rowId: patch.rowId,
        reason: 'source_not_allowed',
        message: `source=${source}`
      } as TavernDBPatchConflict;
    });
};

const resolvePatchConflicts = <TState>(
  baseState: TState,
  nextState: TState,
  patches: TavernDBSheetPatch[],
  txId?: string
): { ok: boolean; nextState: TState; logs: LogEntry[]; appliedPatchCount: number } => {
  if (!Array.isArray(patches) || patches.length === 0) {
    return { ok: true, nextState, logs: [], appliedPatchCount: 0 };
  }

  const tableMeta = (baseState as any)?.__tableMeta || {};
  const store = TableStore.fromRuntimeMeta(tableMeta);
  const sourceOwnershipConflicts = resolveSourceOwnershipConflicts(patches);
  if (sourceOwnershipConflicts.length > 0) {
    const exportedMeta = store.exportMeta();
    const existingStats = exportedMeta.conflictStats;
    const byReason = {
      ...((existingStats?.byReason || {}) as Record<string, number>)
    };
    byReason.source_not_allowed = Number(byReason.source_not_allowed || 0) + sourceOwnershipConflicts.length;
    const nextMeta = {
      ...exportedMeta,
      conflictStats: {
        total: Number(existingStats?.total || 0) + sourceOwnershipConflicts.length,
        byReason,
        updatedAt: Date.now()
      }
    };
    const conflictSummary = sourceOwnershipConflicts
      .slice(0, 3)
      .map((item) => formatConflictLine(item))
      .join(' | ');
    const blockedLog: LogEntry = {
      id: txId ? `${txId}:source-blocked` : `sys-${Date.now()}-source-conflict`,
      sender: '系统',
      text: `回合事务阻断：校验失败 source_not_allowed ${sourceOwnershipConflicts.length} 条。${conflictSummary}`,
      timestamp: Date.now(),
      type: 'system'
    };
    return {
      ok: false,
      nextState: cloneStateWithMeta(baseState, nextMeta),
      logs: [blockedLog],
      appliedPatchCount: 0
    };
  }
  const report = store.applyPatchesWithReport(patches);

  if (report.conflicts.length === 0) {
    patches.forEach((patch) => {
      const isLogSheet = patch.sheetId === 'LOG_Summary' || patch.sheetId === 'LOG_Outline';
      const rowId = String(patch.rowId || '').trim().toUpperCase();
      const shouldAutoLock = isLogSheet
        && patch.operation === 'upsert'
        && /^AM\d+$/.test(rowId)
        && String(patch.source || '').startsWith('ms:memory');
      if (shouldAutoLock) {
        store.lockRow({
          sheetId: patch.sheetId,
          rowId,
          owner: 'am-special',
          reason: 'memory-autolock',
          createdAt: Date.now()
        });
      }
    });
    if (nextState && typeof nextState === 'object') {
      (nextState as any).__tableMeta = store.exportMeta();
    }
    return {
      ok: true,
      nextState,
      logs: [],
      appliedPatchCount: report.applied
    };
  }

  const conflictSummary = report.conflicts.slice(0, 3).map((item) => formatConflictLine(item)).join(' | ');
  const blockedLog: LogEntry = {
    id: txId ? `${txId}:blocked` : `sys-${Date.now()}-tx-conflict`,
    sender: '系统',
    text: `回合事务阻断：检测到并发冲突 ${report.conflicts.length} 条。${conflictSummary}`,
    timestamp: Date.now(),
    type: 'system'
  };
  return {
    ok: false,
    nextState: cloneStateWithMeta(baseState, store.exportMeta()),
    logs: [blockedLog],
    appliedPatchCount: 0
  };
};

export const applyTurnTransaction = <TState>(
  baseState: TState,
  commands: TavernCommand[],
  applyCommands: (state: TState, cmds: TavernCommand[]) => CommandApplyResult<TState>,
  options: TurnTransactionOptions = {}
): TurnTransactionResult<TState> => {
  const txId = buildTxId();
  const txSources = Array.from(new Set(commands.map(extractCommandSource).filter(Boolean)));

  if (!Array.isArray(commands) || commands.length === 0) {
    return {
      newState: baseState,
      logs: [],
      hasError: false,
      rolledBack: false,
      appliedPatches: 0
    };
  }

  if (!shouldUseTransaction(commands, options)) {
    const directResult = applyCommands(baseState, commands);
    const directPatches = Array.isArray(directResult.sheetPatches) ? directResult.sheetPatches : [];
    if (!hasApplyError(directResult) && directPatches.length > 0) {
      const conflictCheck = resolvePatchConflicts(baseState, directResult.newState, directPatches, txId);
      if (!conflictCheck.ok) {
        const tracedState = appendTransactionTrace(conflictCheck.nextState, {
          txId,
          timestamp: Date.now(),
          status: 'blocked',
          commandCount: commands.length,
          patchCount: directPatches.length,
          patches: toPatchTraces(directPatches),
          sources: txSources,
          reason: 'patch-conflict'
        });
        return {
          newState: tracedState,
          logs: [...(directResult.logs || []), ...conflictCheck.logs],
          hasError: true,
          rolledBack: true,
          appliedPatches: 0
        };
      }
      const tracedState = appendTransactionTrace(conflictCheck.nextState, {
        txId,
        timestamp: Date.now(),
        status: 'committed',
        commandCount: commands.length,
        patchCount: conflictCheck.appliedPatchCount,
        patches: toPatchTraces(directPatches),
        sources: txSources
      });
      return {
        ...directResult,
        newState: tracedState,
        logs: [...(directResult.logs || []), ...conflictCheck.logs],
        rolledBack: false,
        appliedPatches: conflictCheck.appliedPatchCount
      };
    }
    return {
      ...directResult,
      rolledBack: false,
      appliedPatches: directPatches.length
    };
  }

  const draftState = structuredClone(baseState);
  const applied = applyCommands(draftState, commands);
  const patchCount = Array.isArray(applied.sheetPatches) ? applied.sheetPatches.length : 0;

  if (!hasApplyError(applied)) {
    const conflictCheck = resolvePatchConflicts(baseState, applied.newState, applied.sheetPatches || [], txId);
    if (!conflictCheck.ok) {
      const tracedState = appendTransactionTrace(conflictCheck.nextState, {
        txId,
        timestamp: Date.now(),
        status: 'blocked',
        commandCount: commands.length,
        patchCount,
        patches: toPatchTraces(applied.sheetPatches || []),
        sources: txSources,
        reason: 'patch-conflict'
      });
      return {
        newState: tracedState,
        logs: [...(applied.logs || []), ...conflictCheck.logs],
        hasError: true,
        rolledBack: true,
        appliedPatches: 0
      };
    }
    const commitLog: LogEntry = {
      id: `${txId}:commit`,
      sender: '系统',
      text: `回合事务提交成功：命令 ${commands.length} 条，sheet patch ${conflictCheck.appliedPatchCount} 条。`,
      timestamp: Date.now(),
      type: 'system'
    };
    const tracedState = appendTransactionTrace(conflictCheck.nextState, {
      txId,
      timestamp: Date.now(),
      status: 'committed',
      commandCount: commands.length,
      patchCount: conflictCheck.appliedPatchCount,
      patches: toPatchTraces(applied.sheetPatches || []),
      sources: txSources
    });
    return {
      ...applied,
      newState: tracedState,
      logs: [...(applied.logs || []), ...conflictCheck.logs, commitLog],
      rolledBack: false,
      appliedPatches: conflictCheck.appliedPatchCount
    };
  }

  const rollbackLog: LogEntry = {
    id: `${txId}:rollback`,
    sender: '系统',
    text: `回合事务回滚：命令 ${commands.length} 条，sheet patch ${patchCount} 条，已撤销本批次状态变更。`,
    timestamp: Date.now(),
    type: 'system'
  };
  const rollbackState = appendTransactionTrace(baseState, {
    txId,
    timestamp: Date.now(),
    status: 'rollback',
    commandCount: commands.length,
    patchCount,
    patches: toPatchTraces(applied.sheetPatches || []),
    sources: txSources,
    reason: 'apply-error'
  });

  return {
    newState: rollbackState,
    logs: [...(applied.logs || []), rollbackLog],
    hasError: true,
    rolledBack: true,
    appliedPatches: 0
  };
};

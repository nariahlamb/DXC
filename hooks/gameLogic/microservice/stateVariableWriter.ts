import type { GameState, TavernCommand } from '../../../types';
import type { StateVariableEvent } from '../../../utils/taverndb/stateVariableEvent';
import { normalizeStateVariableEvent } from '../../../utils/taverndb/stateVariableEvent';
import { normalizeQualityLabel } from '../../../utils/itemUtils';

type WriterApplyResult = {
  newState: GameState;
  hasError: boolean;
  logs?: unknown[];
  rolledBack?: boolean;
};

export type ConsumeStateVariableEventsParams = {
  stateSnapshot: GameState;
  events: Array<StateVariableEvent | Partial<StateVariableEvent>>;
  shadowMode?: boolean;
  applyCommands?: (state: GameState, commands: TavernCommand[]) => WriterApplyResult;
};

export type ConsumeStateVariableEventsResult = {
  newState: GameState;
  acceptedEvents: StateVariableEvent[];
  skippedEvents: Array<{ event: StateVariableEvent; reason: WriterSkipReason }>;
  commands: TavernCommand[];
  auditCommands: TavernCommand[];
  hasError: boolean;
  rolledBack: boolean;
};

export type WriterSkipReason = 'duplicate_idempotency' | 'invalid_event' | 'no_command' | 'stale_event';

type WriterConflictReason = 'idempotency_conflict' | 'stale_event';

type WriterConflictCounters = Record<WriterConflictReason, number>;

type WriterRuntimeMetrics = {
  backlog: number;
  retryCount: number;
  failedByDomain: Record<string, number>;
  skipByReason: Record<WriterSkipReason, number>;
  acceptedCount: number;
  skippedCount: number;
  commandCount: number;
  auditCommandCount: number;
  updatedAt: number;
};

const readWriterIdempotencyKeys = (state: GameState): Set<string> => {
  const raw = (state as any)?.__stateVarWriter?.idempotencyKeys;
  if (!Array.isArray(raw)) return new Set<string>();
  return new Set(raw.map((item) => String(item || '').trim()).filter(Boolean));
};

const writeWriterIdempotencyKeys = (state: GameState, keys: Set<string>) => {
  const next = Array.from(keys);
  (state as any).__stateVarWriter = {
    ...((state as any).__stateVarWriter || {}),
    idempotencyKeys: next
  };
};

const bumpWriterConflict = (counters: WriterConflictCounters, reason: WriterConflictReason) => {
  counters[reason] = Number(counters[reason] || 0) + 1;
};

const writeWriterConflictStats = (state: GameState, counters: WriterConflictCounters) => {
  const totalDelta = Object.values(counters).reduce((sum, value) => sum + Number(value || 0), 0);
  if (totalDelta <= 0) return;
  const meta = ((state as any)?.__tableMeta && typeof (state as any).__tableMeta === 'object')
    ? (state as any).__tableMeta
    : {};
  const rawStats = (meta.conflictStats && typeof meta.conflictStats === 'object')
    ? meta.conflictStats
    : {};
  const byReason: Record<string, number> = {
    ...((rawStats.byReason && typeof rawStats.byReason === 'object') ? rawStats.byReason : {})
  };
  Object.entries(counters).forEach(([reason, delta]) => {
    if (!delta) return;
    byReason[reason] = Number(byReason[reason] || 0) + Number(delta || 0);
  });
  (state as any).__tableMeta = {
    ...meta,
    conflictStats: {
      total: Number(rawStats.total || 0) + totalDelta,
      byReason,
      updatedAt: Date.now()
    }
  };
};

const bumpFailedByDomain = (failedByDomain: Record<string, number>, domain: unknown) => {
  const key = String(domain || 'unknown').trim() || 'unknown';
  failedByDomain[key] = Number(failedByDomain[key] || 0) + 1;
};

const createSkipByReason = (): Record<WriterSkipReason, number> => ({
  duplicate_idempotency: 0,
  invalid_event: 0,
  no_command: 0,
  stale_event: 0
});

const bumpSkipByReason = (counters: Record<WriterSkipReason, number>, reason: WriterSkipReason) => {
  counters[reason] = Number(counters[reason] || 0) + 1;
};

const writeWriterRuntimeMetrics = (state: GameState, metrics: WriterRuntimeMetrics) => {
  (state as any).__stateVarWriter = {
    ...((state as any).__stateVarWriter || {}),
    metrics: {
      backlog: Math.max(0, Math.floor(Number(metrics.backlog || 0))),
      retryCount: Math.max(0, Math.floor(Number(metrics.retryCount || 0))),
      failedByDomain: { ...(metrics.failedByDomain || {}) },
      skipByReason: {
        duplicate_idempotency: Math.max(0, Math.floor(Number(metrics.skipByReason?.duplicate_idempotency || 0))),
        invalid_event: Math.max(0, Math.floor(Number(metrics.skipByReason?.invalid_event || 0))),
        no_command: Math.max(0, Math.floor(Number(metrics.skipByReason?.no_command || 0))),
        stale_event: Math.max(0, Math.floor(Number(metrics.skipByReason?.stale_event || 0)))
      },
      acceptedCount: Math.max(0, Math.floor(Number(metrics.acceptedCount || 0))),
      skippedCount: Math.max(0, Math.floor(Number(metrics.skippedCount || 0))),
      commandCount: Math.max(0, Math.floor(Number(metrics.commandCount || 0))),
      auditCommandCount: Math.max(0, Math.floor(Number(metrics.auditCommandCount || 0))),
      updatedAt: Number(metrics.updatedAt || Date.now())
    }
  };
};

const resolveFieldFromPath = (path: string): string => {
  const normalized = String(path || '').replace(/^gameState\./, '').replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.').filter(Boolean);
  if (parts.length === 0) return '';
  if (parts[0] === '角色' && parts.length >= 2) return parts[1];
  if (parts[0] === '背包' && parts.length >= 3) return parts[2];
  if (parts[0] === '世界坐标' && parts.length >= 2) {
    if (parts[1] === 'x') return '世界坐标X';
    if (parts[1] === 'y') return '世界坐标Y';
  }
  const tail = parts[parts.length - 1] || '';
  if (tail === '当前地点') return '当前场景';
  if (tail === '天气') return '天气状况';
  return tail;
};

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeGlobalStatePayload = (payload: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...payload };
  if (Object.prototype.hasOwnProperty.call(next, '当前地点') && !Object.prototype.hasOwnProperty.call(next, '当前场景')) {
    next.当前场景 = next.当前地点;
  }
  if (Object.prototype.hasOwnProperty.call(next, '天气') && !Object.prototype.hasOwnProperty.call(next, '天气状况')) {
    next.天气状况 = next.天气;
  }
  const worldCoord = next.世界坐标;
  if (worldCoord && typeof worldCoord === 'object' && !Array.isArray(worldCoord)) {
    const x = normalizeNumber((worldCoord as any).x ?? (worldCoord as any).X ?? (worldCoord as any).世界坐标X);
    const y = normalizeNumber((worldCoord as any).y ?? (worldCoord as any).Y ?? (worldCoord as any).世界坐标Y);
    if (x !== null && !Object.prototype.hasOwnProperty.call(next, '世界坐标X')) next.世界坐标X = Math.round(x);
    if (y !== null && !Object.prototype.hasOwnProperty.call(next, '世界坐标Y')) next.世界坐标Y = Math.round(y);
  }
  delete (next as any).当前地点;
  delete (next as any).天气;
  delete (next as any).世界坐标;
  return next;
};

const getGlobalNumber = (state: GameState, field: string): number | null => {
  if (field === '世界坐标X') return normalizeNumber((state as any)?.世界坐标?.x);
  if (field === '世界坐标Y') return normalizeNumber((state as any)?.世界坐标?.y);
  return normalizeNumber((state as any)?.[field]);
};

const getCharacterNumber = (state: GameState, field: string): number | null => {
  const player = (state as any)?.角色;
  if (!player || typeof player !== 'object') return null;
  return normalizeNumber((player as any)[field]);
};

const toInventoryRow = (item: Record<string, unknown>, index: number): Record<string, unknown> | null => {
  const itemId = String(item.物品ID ?? item.id ?? item.item_id ?? '').trim();
  const itemName = String(item.物品名称 ?? item.名称 ?? item.name ?? '').trim();
  if (!itemId && !itemName) return null;
  const qualityRaw = String(item.品质 ?? item.稀有度 ?? item.quality ?? item.rarity ?? item.rank ?? item.tier ?? '').trim();
  const quality = qualityRaw ? normalizeQualityLabel(qualityRaw) : undefined;
  const category = String(item.类别 ?? item.类型 ?? item.type ?? '').trim();
  return {
    ...item,
    物品ID: itemId || `item_${Date.now()}_${index + 1}`,
    物品名称: itemName || itemId,
    数量: Number.isFinite(Number(item.数量 ?? item.count)) ? Number(item.数量 ?? item.count) : 1,
    类别: category,
    类型: category || undefined,
    描述: String(item.描述 ?? item.description ?? '').trim(),
    品质: quality,
    稀有度: quality
  };
};

const resolveInventoryDeleteRowIds = (event: StateVariableEvent, state: GameState): string[] => {
  const direct = String(
    (event.value as any)?.物品ID
    ?? (event.value as any)?.id
    ?? (event.value as any)?.item_id
    ?? event.value
    ?? ''
  ).trim();
  if (direct) return [direct];
  const match = String(event.path || '').match(/背包(?:\.|\[)(\d+)(?:\]|\.)?/);
  if (!match) return [];
  const index = Number(match[1]);
  if (!Number.isFinite(index)) return [];
  const bag = Array.isArray((state as any)?.背包) ? (state as any).背包 : [];
  const target = bag[index];
  if (!target || typeof target !== 'object') return [];
  const rowId = String((target as any).物品ID ?? (target as any).id ?? '').trim();
  return rowId ? [rowId] : [];
};

const resolveInventoryRowId = (event: StateVariableEvent, state: GameState): string | null => {
  if (event.op === 'delete') {
    const rowIds = resolveInventoryDeleteRowIds(event, state);
    return rowIds[0] || null;
  }
  const direct = String(
    (event.value as any)?.物品ID
    ?? (event.value as any)?.id
    ?? (event.value as any)?.item_id
    ?? ''
  ).trim();
  return direct || null;
};

const resolveVersionTarget = (
  event: StateVariableEvent,
  state: GameState
): { sheetId: 'SYS_GlobalState' | 'CHARACTER_Resources' | 'ITEM_Inventory'; rowId: string } | null => {
  if (event.domain === 'global_state') {
    return { sheetId: 'SYS_GlobalState', rowId: 'GLOBAL_STATE' };
  }
  if (event.domain === 'character_resources') {
    return { sheetId: 'CHARACTER_Resources', rowId: event.entity_id || 'PLAYER' };
  }
  if (event.domain === 'inventory') {
    const rowId = resolveInventoryRowId(event, state);
    return rowId ? { sheetId: 'ITEM_Inventory', rowId } : null;
  }
  return null;
};

const isStaleEvent = (event: StateVariableEvent, state: GameState): boolean => {
  if (typeof event.expected_version !== 'number' || !Number.isFinite(event.expected_version)) return false;
  const target = resolveVersionTarget(event, state);
  if (!target) return false;
  const expected = Math.max(0, Math.floor(event.expected_version));
  const rowVersions = (state as any)?.__tableMeta?.rowVersions;
  const actual = Number(rowVersions?.[`${target.sheetId}::${target.rowId}`] ?? 0);
  if (!Number.isFinite(actual)) return false;
  return actual > expected;
};

const withExpectedVersion = (commands: TavernCommand[], event: StateVariableEvent): TavernCommand[] => {
  if (typeof event.expected_version !== 'number' || !Number.isFinite(event.expected_version)) return commands;
  const expectedRowVersion = Math.max(0, Math.floor(event.expected_version));
  return commands.map((command) => ({
    ...command,
    expectedRowVersion
  }));
};

export const buildWriterCommandsFromEvent = (event: StateVariableEvent, stateSnapshot: GameState): TavernCommand[] => {
  const field = resolveFieldFromPath(event.path);
  if (event.domain === 'global_state') {
    if (event.op === 'upsert') {
      const payload = (event.value && typeof event.value === 'object' && !Array.isArray(event.value))
        ? event.value as Record<string, unknown>
        : null;
      if (!payload) return [];
      const normalizedPayload = normalizeGlobalStatePayload(payload);
      if (Object.keys(normalizedPayload).length === 0) return [];
      return [{
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'SYS_GlobalState',
          keyField: '_global_id',
          rows: [{
            _global_id: 'GLOBAL_STATE',
            ...normalizedPayload
          }]
        },
        source: 'ms:state-writer'
      }];
    }
    if (!field) return [];
    const row: Record<string, unknown> = { _global_id: 'GLOBAL_STATE' };
    if (field === '世界坐标') {
      if (event.op === 'delete') {
        row.世界坐标X = null;
        row.世界坐标Y = null;
      } else {
        const coord = (event.value && typeof event.value === 'object' && !Array.isArray(event.value))
          ? event.value as Record<string, unknown>
          : {};
        const x = normalizeNumber((coord as any).x ?? (coord as any).X ?? (coord as any).世界坐标X);
        const y = normalizeNumber((coord as any).y ?? (coord as any).Y ?? (coord as any).世界坐标Y);
        if (x === null && y === null) return [];
        if (x !== null) row.世界坐标X = Math.round(x);
        if (y !== null) row.世界坐标Y = Math.round(y);
      }
    } else if (event.op === 'delete') row[field] = null;
    else if (event.op === 'add') {
      const delta = normalizeNumber(event.value);
      if (delta === null) return [];
      const current = getGlobalNumber(stateSnapshot, field) ?? 0;
      row[field] = current + delta;
    } else {
      row[field] = event.value;
    }
    return [{
      action: 'upsert_sheet_rows',
      value: {
        sheetId: 'SYS_GlobalState',
        keyField: '_global_id',
        rows: [row]
      },
      source: 'ms:state-writer'
    }];
  }

  if (event.domain === 'character_resources') {
    if (event.op === 'upsert') {
      const payload = (event.value && typeof event.value === 'object' && !Array.isArray(event.value))
        ? event.value as Record<string, unknown>
        : null;
      if (!payload) return [];
      return [{
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'CHARACTER_Resources',
          keyField: 'CHAR_ID',
          rows: [{
            CHAR_ID: event.entity_id || 'PLAYER',
            ...payload
          }]
        },
        source: 'ms:state-writer'
      }];
    }
    if (!field) return [];
    const row: Record<string, unknown> = { CHAR_ID: event.entity_id || 'PLAYER' };
    if (event.op === 'delete') row[field] = null;
    else if (event.op === 'add') {
      const delta = normalizeNumber(event.value);
      if (delta === null) return [];
      const current = getCharacterNumber(stateSnapshot, field) ?? 0;
      row[field] = current + delta;
    } else {
      row[field] = event.value;
    }
    return [{
      action: 'upsert_sheet_rows',
      value: {
        sheetId: 'CHARACTER_Resources',
        keyField: 'CHAR_ID',
        rows: [row]
      },
      source: 'ms:state-writer'
    }];
  }

  if (event.domain !== 'inventory') return [];

  if (event.op === 'delete') {
    const rowIds = resolveInventoryDeleteRowIds(event, stateSnapshot);
    if (rowIds.length === 0) return [];
    return [{
      action: 'delete_sheet_rows',
      value: {
        sheetId: 'ITEM_Inventory',
        rowIds,
        keyField: '物品ID'
      },
      source: 'ms:state-writer'
    }];
  }

  if (event.op === 'add') {
    const payload = event.value as any;
    const itemId = String(payload?.物品ID ?? payload?.id ?? payload?.item_id ?? '').trim();
    const delta = normalizeNumber(payload?.delta ?? payload?.数量变更 ?? payload?.quantityDelta);
    if (!itemId || delta === null) return [];
    const bag = Array.isArray((stateSnapshot as any)?.背包) ? (stateSnapshot as any).背包 : [];
    const currentItem = bag.find((item: any) => String(item?.物品ID ?? item?.id ?? '').trim() === itemId) || {};
    const current = normalizeNumber(currentItem?.数量 ?? currentItem?.count) ?? 0;
    return [{
      action: 'upsert_sheet_rows',
      value: {
        sheetId: 'ITEM_Inventory',
        keyField: '物品ID',
        rows: [{
          物品ID: itemId,
          物品名称: String(currentItem?.物品名称 ?? currentItem?.名称 ?? itemId),
          数量: current + delta
        }]
      },
      source: 'ms:state-writer'
    }];
  }

  const list = Array.isArray(event.value) ? event.value : [event.value];
  const rows = list
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => toInventoryRow(item, index))
    .filter((item): item is Record<string, unknown> => !!item);
  if (rows.length === 0) return [];
  return [{
    action: 'upsert_sheet_rows',
    value: {
      sheetId: 'ITEM_Inventory',
      keyField: '物品ID',
      rows
    },
    source: 'ms:state-writer'
  }];
};

const buildAuditCommands = (events: StateVariableEvent[]): TavernCommand[] => {
  if (events.length === 0) return [];
  const now = Date.now();
  const eventRows = events.map((event) => ({
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
  const applyRows = events.map((event, index) => ({
    apply_id: `${event.event_id}:shadow:${index + 1}`,
    event_id: event.event_id,
    tx_id: '',
    sheet_id: event.domain,
    row_id: event.entity_id,
    result: 'queued',
    conflict_reason: '',
    retry_count: 0,
    latency_ms: 0,
    applied_at: now
  }));
  return [
    {
      action: 'upsert_sheet_rows',
      value: {
        sheetId: 'SYS_StateVarEventLog',
        keyField: 'event_id',
        rows: eventRows
      },
      source: 'ms:state-writer'
    },
    {
      action: 'upsert_sheet_rows',
      value: {
        sheetId: 'SYS_StateVarApplyLog',
        keyField: 'apply_id',
        rows: applyRows
      },
      source: 'ms:state-writer'
    }
  ];
};

export const consumeStateVariableEvents = (params: ConsumeStateVariableEventsParams): ConsumeStateVariableEventsResult => {
  const workingState = structuredClone(params.stateSnapshot);
  const inputEvents = Array.isArray(params.events) ? params.events : [];
  const seenIdempotencyKeys = readWriterIdempotencyKeys(workingState);
  const acceptedEvents: StateVariableEvent[] = [];
  const skippedEvents: ConsumeStateVariableEventsResult['skippedEvents'] = [];
  const commands: TavernCommand[] = [];
  const conflictCounters: WriterConflictCounters = {
    idempotency_conflict: 0,
    stale_event: 0
  };
  const skipByReason = createSkipByReason();
  const failedByDomain: Record<string, number> = {};

  inputEvents.forEach((item) => {
    let normalized: StateVariableEvent;
    try {
      normalized = normalizeStateVariableEvent(item);
    } catch {
      skippedEvents.push({
        event: {
          event_id: 'invalid',
          turn_id: 'invalid',
          source: 'invalid',
          domain: 'invalid',
          entity_id: 'invalid',
          path: 'invalid',
          op: 'upsert',
          idempotency_key: 'invalid',
          created_at: Date.now()
        },
        reason: 'invalid_event'
      });
      bumpSkipByReason(skipByReason, 'invalid_event');
      bumpFailedByDomain(failedByDomain, 'invalid');
      return;
    }
    if (seenIdempotencyKeys.has(normalized.idempotency_key)) {
      skippedEvents.push({ event: normalized, reason: 'duplicate_idempotency' });
      bumpSkipByReason(skipByReason, 'duplicate_idempotency');
      bumpWriterConflict(conflictCounters, 'idempotency_conflict');
      bumpFailedByDomain(failedByDomain, normalized.domain);
      return;
    }
    if (isStaleEvent(normalized, workingState)) {
      skippedEvents.push({ event: normalized, reason: 'stale_event' });
      bumpSkipByReason(skipByReason, 'stale_event');
      bumpWriterConflict(conflictCounters, 'stale_event');
      bumpFailedByDomain(failedByDomain, normalized.domain);
      return;
    }
    const eventCommands = withExpectedVersion(buildWriterCommandsFromEvent(normalized, workingState), normalized);
    if (eventCommands.length === 0) {
      skippedEvents.push({ event: normalized, reason: 'no_command' });
      bumpSkipByReason(skipByReason, 'no_command');
      bumpFailedByDomain(failedByDomain, normalized.domain);
      return;
    }
    seenIdempotencyKeys.add(normalized.idempotency_key);
    acceptedEvents.push(normalized);
    commands.push(...eventCommands);
  });

  const auditCommands = buildAuditCommands(acceptedEvents);
  const runtimeMetrics: WriterRuntimeMetrics = {
    backlog: 0,
    retryCount: 0,
    failedByDomain,
    skipByReason,
    acceptedCount: acceptedEvents.length,
    skippedCount: skippedEvents.length,
    commandCount: commands.length,
    auditCommandCount: auditCommands.length,
    updatedAt: Date.now()
  };
  const shadowMode = params.shadowMode !== false;
  const shouldApply = !shadowMode && typeof params.applyCommands === 'function' && commands.length > 0;
  if (shouldApply) {
    const applied = params.applyCommands!(workingState, commands);
    writeWriterIdempotencyKeys(applied.newState, seenIdempotencyKeys);
    writeWriterConflictStats(applied.newState, conflictCounters);
    writeWriterRuntimeMetrics(applied.newState, runtimeMetrics);
    return {
      newState: applied.newState,
      acceptedEvents,
      skippedEvents,
      commands,
      auditCommands,
      hasError: Boolean(applied.hasError),
      rolledBack: Boolean(applied.rolledBack)
    };
  }

  writeWriterIdempotencyKeys(workingState, seenIdempotencyKeys);
  writeWriterConflictStats(workingState, conflictCounters);
  writeWriterRuntimeMetrics(workingState, runtimeMetrics);
  return {
    newState: workingState,
    acceptedEvents,
    skippedEvents,
    commands,
    auditCommands,
    hasError: false,
    rolledBack: false
  };
};

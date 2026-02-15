import type {
  TavernDBCellLock,
  TavernDBPatchConflict,
  TavernDBProjectedTable,
  TavernDBRowId,
  TavernDBRowLock,
  TavernDBRuntimeMeta,
  TavernDBSheetId,
  TavernDBSheetPatch,
  TavernDBTableRow
} from '../../types/taverndb';

type TableState = {
  keyField: string;
  rows: TavernDBTableRow[];
  rowById: Map<string, TavernDBTableRow>;
  indexById: Map<string, number>;
  rowVersionById: Map<string, number>;
  sheetVersion: number;
};

export interface TableStoreSnapshot {
  keyField: string;
  rows: TavernDBTableRow[];
  sheetVersion: number;
}

export type TableStoreSnapshotRecord = Partial<Record<TavernDBSheetId, TableStoreSnapshot>>;

export interface TableStoreApplyReport {
  applied: number;
  conflicts: TavernDBPatchConflict[];
}

const DEFAULT_KEY_FIELDS: Partial<Record<TavernDBSheetId, string>> = {
  SYS_GlobalState: '_global_id',
  SYS_CommandAudit: 'command_id',
  SYS_TransactionAudit: 'tx_id',
  SYS_ValidationIssue: 'issue_id',
  SYS_MappingRegistry: 'domain',
  NPC_Registry: 'NPC_ID',
  ITEM_Inventory: '物品ID',
  QUEST_Active: '任务ID',
  FACTION_Standing: '势力ID',
  ECON_Ledger: 'ledger_id',
  COMBAT_Encounter: '单位名称',
  COMBAT_BattleMap: '单位名称',
  LOG_Summary: '编码索引',
  LOG_Outline: '编码索引',
  DICE_Pool: 'ID',
  SKILL_Library: 'SKILL_ID',
  CHARACTER_Skills: 'LINK_ID',
  FEAT_Library: 'FEAT_ID',
  CHARACTER_Feats: 'LINK_ID',
  CHARACTER_Registry: 'CHAR_ID',
  CHARACTER_Attributes: 'CHAR_ID',
  CHARACTER_Resources: 'CHAR_ID',
  PHONE_Device: 'device_id',
  PHONE_Contacts: 'contact_id',
  PHONE_Threads: 'thread_id',
  PHONE_Messages: 'message_id',
  PHONE_Pending: 'pending_id',
  STORY_Mainline: 'mainline_id',
  STORY_Triggers: 'trigger_id',
  STORY_Milestones: 'milestone_id',
  CONTRACT_Registry: 'contract_id',
  EXPLORATION_Map_Data: 'LocationName',
  COMBAT_Map_Visuals: 'SceneName'
};

const toIdKey = (value: TavernDBRowId): string => String(value);
const toVersion = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : 0;
};
const rowVersionKey = (sheetId: TavernDBSheetId, rowId: TavernDBRowId): string => `${sheetId}::${String(rowId)}`;

const readRowId = (row: TavernDBTableRow, keyField: string): TavernDBRowId | null => {
  const value = row?.[keyField];
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
};

const cloneRow = (row: TavernDBTableRow): TavernDBTableRow => ({ ...row });
const cloneRowLock = (lock: TavernDBRowLock): TavernDBRowLock => ({ ...lock });
const cloneCellLock = (lock: TavernDBCellLock): TavernDBCellLock => ({ ...lock });

export class TableStore {
  private readonly tables = new Map<TavernDBSheetId, TableState>();
  private readonly seedSheetVersions = new Map<TavernDBSheetId, number>();
  private readonly seedRowVersions = new Map<string, number>();
  private rowLocks: TavernDBRowLock[] = [];
  private cellLocks: TavernDBCellLock[] = [];
  private conflictTotal = 0;
  private conflictByReason = new Map<string, number>();

  constructor(meta?: TavernDBRuntimeMeta | null) {
    if (!meta) return;

    const sheetVersions = meta.sheetVersions || {};
    Object.entries(sheetVersions).forEach(([sheetId, version]) => {
      this.seedSheetVersions.set(sheetId as TavernDBSheetId, toVersion(version));
    });

    const rowVersions = meta.rowVersions || {};
    Object.entries(rowVersions).forEach(([key, version]) => {
      this.seedRowVersions.set(key, toVersion(version));
    });

    this.rowLocks = Array.isArray(meta.rowLocks) ? meta.rowLocks.map(cloneRowLock) : [];
    this.cellLocks = Array.isArray(meta.cellLocks) ? meta.cellLocks.map(cloneCellLock) : [];
    const stats = meta.conflictStats;
    if (stats) {
      this.conflictTotal = toVersion(stats.total);
      Object.entries(stats.byReason || {}).forEach(([reason, count]) => {
        this.conflictByReason.set(reason, toVersion(count));
      });
    }
  }

  private getOrCreateSheet(sheetId: TavernDBSheetId, keyField?: string): TableState {
    const existing = this.tables.get(sheetId);
    if (existing) {
      if (keyField && keyField !== existing.keyField) {
        existing.keyField = keyField;
      }
      return existing;
    }
    const table: TableState = {
      keyField: keyField || DEFAULT_KEY_FIELDS[sheetId] || 'id',
      rows: [],
      rowById: new Map<string, TavernDBTableRow>(),
      indexById: new Map<string, number>(),
      rowVersionById: new Map<string, number>(),
      sheetVersion: toVersion(this.seedSheetVersions.get(sheetId))
    };

    this.seedRowVersions.forEach((version, key) => {
      if (!key.startsWith(`${sheetId}::`)) return;
      const rowId = key.slice(sheetId.length + 2);
      table.rowVersionById.set(rowId, version);
    });

    this.tables.set(sheetId, table);
    return table;
  }

  private assertRowId(
    table: TableState,
    row: TavernDBTableRow,
    rowId?: TavernDBRowId
  ): TavernDBRowId {
    const resolved = rowId ?? readRowId(row, table.keyField);
    if (resolved === null || resolved === undefined || resolved === '') {
      throw new Error(`Missing row id for keyField '${table.keyField}'`);
    }
    return resolved;
  }

  private setRow(table: TableState, rowId: TavernDBRowId, row: TavernDBTableRow): void {
    const idKey = toIdKey(rowId);
    const cloned = cloneRow(row);
    const existingIndex = table.indexById.get(idKey);
    if (typeof existingIndex === 'number') {
      table.rows[existingIndex] = cloned;
    } else {
      table.indexById.set(idKey, table.rows.length);
      table.rows.push(cloned);
    }
    table.rowById.set(idKey, cloned);
  }

  private bumpVersions(table: TableState, sheetId: TavernDBSheetId, rowId: TavernDBRowId): void {
    table.sheetVersion += 1;
    const rowKey = toIdKey(rowId);
    const prev = toVersion(table.rowVersionById.get(rowKey));
    const next = prev + 1;
    table.rowVersionById.set(rowKey, next);
    this.seedSheetVersions.set(sheetId, table.sheetVersion);
    this.seedRowVersions.set(rowVersionKey(sheetId, rowId), next);
  }

  private recordConflict(reason: string): void {
    this.conflictTotal += 1;
    this.conflictByReason.set(reason, toVersion(this.conflictByReason.get(reason)) + 1);
  }

  private findRowLock(sheetId: TavernDBSheetId, rowId: TavernDBRowId): TavernDBRowLock | null {
    const rowKey = String(rowId);
    return this.rowLocks.find((lock) => lock.sheetId === sheetId && String(lock.rowId) === rowKey) || null;
  }

  private findCellLocks(sheetId: TavernDBSheetId, rowId: TavernDBRowId): TavernDBCellLock[] {
    const rowKey = String(rowId);
    return this.cellLocks.filter((lock) => lock.sheetId === sheetId && String(lock.rowId) === rowKey);
  }

  private buildConflict(
    patch: TavernDBSheetPatch,
    reason: TavernDBPatchConflict['reason'],
    message: string,
    expected?: number,
    actual?: number,
    field?: string
  ): TavernDBPatchConflict {
    this.recordConflict(reason);
    return {
      sheetId: patch.sheetId,
      rowId: patch.rowId,
      reason,
      message,
      expected,
      actual,
      field
    };
  }

  private checkPatchConflict(table: TableState, patch: TavernDBSheetPatch): TavernDBPatchConflict | null {
    if (typeof patch.expectedSheetVersion === 'number') {
      const expected = Math.max(0, Math.floor(patch.expectedSheetVersion));
      const actual = table.sheetVersion;
      if (expected !== actual) {
        return this.buildConflict(
          patch,
          'sheet_version_conflict',
          `sheet version conflict: expected ${expected}, actual ${actual}`,
          expected,
          actual
        );
      }
    }

    if (typeof patch.expectedRowVersion === 'number') {
      const expected = Math.max(0, Math.floor(patch.expectedRowVersion));
      const actual = toVersion(table.rowVersionById.get(toIdKey(patch.rowId)));
      if (expected !== actual) {
        return this.buildConflict(
          patch,
          'row_version_conflict',
          `row version conflict: expected ${expected}, actual ${actual}`,
          expected,
          actual
        );
      }
    }

    const rowLock = this.findRowLock(patch.sheetId, patch.rowId);
    if (rowLock && rowLock.owner !== patch.lockOwner) {
      return this.buildConflict(
        patch,
        'row_locked',
        `row locked by ${rowLock.owner || 'unknown'}`
      );
    }

    const cellLocks = this.findCellLocks(patch.sheetId, patch.rowId);
    if (cellLocks.length > 0) {
      const changedFields = Array.isArray(patch.changedFields)
        ? patch.changedFields.map((field) => String(field || '').trim()).filter(Boolean)
        : [];
      const lock = cellLocks.find((item) => {
        if (item.owner === patch.lockOwner) return false;
        if (patch.operation === 'delete') return true;
        if (changedFields.length === 0) return true;
        return changedFields.includes(item.field);
      });
      if (lock) {
        return this.buildConflict(
          patch,
          'cell_locked',
          `cell locked by ${lock.owner || 'unknown'} (${lock.field})`,
          undefined,
          undefined,
          lock.field
        );
      }
    }

    return null;
  }

  upsert(sheetId: TavernDBSheetId, row: TavernDBTableRow, rowId?: TavernDBRowId, keyField?: string): TavernDBTableRow {
    const table = this.getOrCreateSheet(sheetId, keyField);
    const resolvedId = this.assertRowId(table, row, rowId);
    const withKey = row[table.keyField] === undefined ? { ...row, [table.keyField]: resolvedId } : row;
    this.setRow(table, resolvedId, withKey);
    this.bumpVersions(table, sheetId, resolvedId);
    return cloneRow(withKey);
  }

  delete(sheetId: TavernDBSheetId, rowId: TavernDBRowId, keyField?: string): boolean {
    const table = this.getOrCreateSheet(sheetId, keyField);
    const idKey = toIdKey(rowId);
    const index = table.indexById.get(idKey);
    if (index === undefined) return false;
    table.rows.splice(index, 1);
    table.rowById.delete(idKey);
    table.indexById.delete(idKey);
    table.rows.forEach((row, idx) => {
      const nextId = readRowId(row, table.keyField);
      if (nextId !== null) {
        table.indexById.set(toIdKey(nextId), idx);
      }
    });
    this.bumpVersions(table, sheetId, rowId);
    return true;
  }

  select(sheetId: TavernDBSheetId, predicate?: (row: TavernDBTableRow) => boolean): TavernDBTableRow[] {
    const table = this.getOrCreateSheet(sheetId);
    if (!predicate) return table.rows.map(cloneRow);
    return table.rows.filter(predicate).map(cloneRow);
  }

  getById(sheetId: TavernDBSheetId, rowId: TavernDBRowId): TavernDBTableRow | null {
    const table = this.getOrCreateSheet(sheetId);
    const row = table.rowById.get(toIdKey(rowId));
    return row ? cloneRow(row) : null;
  }

  getSheetVersion(sheetId: TavernDBSheetId): number {
    const table = this.getOrCreateSheet(sheetId);
    return toVersion(table.sheetVersion);
  }

  getRowVersion(sheetId: TavernDBSheetId, rowId: TavernDBRowId): number {
    const table = this.getOrCreateSheet(sheetId);
    return toVersion(table.rowVersionById.get(toIdKey(rowId)));
  }

  lockRow(lock: TavernDBRowLock): void {
    const normalized: TavernDBRowLock = {
      ...lock,
      createdAt: lock.createdAt || Date.now()
    };
    const exists = this.rowLocks.find((item) =>
      item.sheetId === normalized.sheetId
      && String(item.rowId) === String(normalized.rowId)
      && item.owner === normalized.owner
    );
    if (!exists) this.rowLocks.push(normalized);
  }

  unlockRow(sheetId: TavernDBSheetId, rowId: TavernDBRowId, owner?: string): void {
    this.rowLocks = this.rowLocks.filter((lock) => {
      if (lock.sheetId !== sheetId) return true;
      if (String(lock.rowId) !== String(rowId)) return true;
      if (owner && lock.owner !== owner) return true;
      return false;
    });
  }

  lockCell(lock: TavernDBCellLock): void {
    const normalized: TavernDBCellLock = {
      ...lock,
      field: String(lock.field || '').trim(),
      createdAt: lock.createdAt || Date.now()
    };
    if (!normalized.field) return;
    const exists = this.cellLocks.find((item) =>
      item.sheetId === normalized.sheetId
      && String(item.rowId) === String(normalized.rowId)
      && item.field === normalized.field
      && item.owner === normalized.owner
    );
    if (!exists) this.cellLocks.push(normalized);
  }

  unlockCell(sheetId: TavernDBSheetId, rowId: TavernDBRowId, field: string, owner?: string): void {
    this.cellLocks = this.cellLocks.filter((lock) => {
      if (lock.sheetId !== sheetId) return true;
      if (String(lock.rowId) !== String(rowId)) return true;
      if (lock.field !== field) return true;
      if (owner && lock.owner !== owner) return true;
      return false;
    });
  }

  tryApplyPatch(patch: TavernDBSheetPatch, keyField?: string): { applied: boolean; conflict?: TavernDBPatchConflict } {
    const table = this.getOrCreateSheet(patch.sheetId, keyField);
    const conflict = this.checkPatchConflict(table, patch);
    if (conflict) {
      return { applied: false, conflict };
    }

    if (patch.operation === 'delete') {
      return { applied: this.delete(patch.sheetId, patch.rowId, keyField) };
    }

    if (!patch.row) {
      throw new Error(`Missing row payload for upsert patch on ${patch.sheetId}`);
    }

    this.upsert(patch.sheetId, patch.row, patch.rowId, keyField);
    return { applied: true };
  }

  applyPatch(patch: TavernDBSheetPatch, keyField?: string): boolean {
    const result = this.tryApplyPatch(patch, keyField);
    if (result.conflict) {
      throw new Error(result.conflict.message);
    }
    return result.applied;
  }

  applyPatches(patches: TavernDBSheetPatch[]): void {
    patches.forEach((patch) => {
      this.applyPatch(patch);
    });
  }

  applyPatchesWithReport(patches: TavernDBSheetPatch[]): TableStoreApplyReport {
    const conflicts: TavernDBPatchConflict[] = [];
    let applied = 0;
    patches.forEach((patch) => {
      const result = this.tryApplyPatch(patch);
      if (result.conflict) {
        conflicts.push(result.conflict);
        return;
      }
      if (result.applied) {
        applied += 1;
      }
    });
    return { applied, conflicts };
  }

  snapshot(sheetId?: TavernDBSheetId): TableStoreSnapshotRecord {
    if (sheetId) {
      const table = this.getOrCreateSheet(sheetId);
      return {
        [sheetId]: {
          keyField: table.keyField,
          rows: table.rows.map(cloneRow),
          sheetVersion: table.sheetVersion
        }
      };
    }
    const output: TableStoreSnapshotRecord = {};
    this.tables.forEach((table, id) => {
      output[id] = {
        keyField: table.keyField,
        rows: table.rows.map(cloneRow),
        sheetVersion: table.sheetVersion
      };
    });
    return output;
  }

  exportMeta(): TavernDBRuntimeMeta {
    const sheetVersions: TavernDBRuntimeMeta['sheetVersions'] = {};
    const rowVersions: Record<string, number> = {};

    this.tables.forEach((table, sheetId) => {
      sheetVersions![sheetId] = toVersion(table.sheetVersion);
      table.rowVersionById.forEach((version, rowId) => {
        rowVersions[rowVersionKey(sheetId, rowId)] = toVersion(version);
      });
    });

    this.seedSheetVersions.forEach((version, sheetId) => {
      if (sheetVersions![sheetId] === undefined) {
        sheetVersions![sheetId] = toVersion(version);
      }
    });
    this.seedRowVersions.forEach((version, key) => {
      if (rowVersions[key] === undefined) {
        rowVersions[key] = toVersion(version);
      }
    });

    const byReason: Record<string, number> = {};
    this.conflictByReason.forEach((value, key) => {
      byReason[key] = toVersion(value);
    });

    return {
      sheetVersions,
      rowVersions,
      rowLocks: this.rowLocks.map(cloneRowLock),
      cellLocks: this.cellLocks.map(cloneCellLock),
      conflictStats: {
        total: toVersion(this.conflictTotal),
        byReason,
        updatedAt: Date.now()
      }
    };
  }

  static fromRuntimeMeta(meta?: TavernDBRuntimeMeta | null): TableStore {
    return new TableStore(meta);
  }

  static fromProjectedTables(tables: TavernDBProjectedTable[], meta?: TavernDBRuntimeMeta | null): TableStore {
    const store = new TableStore(meta);
    tables.forEach((table) => {
      const keyField = DEFAULT_KEY_FIELDS[table.id] || 'id';
      table.rows.forEach((row, index) => {
        const rowId = readRowId(row, keyField) ?? `${table.id}_${index + 1}`;
        store.upsert(table.id, row, rowId, keyField);
      });
    });
    return store;
  }
}

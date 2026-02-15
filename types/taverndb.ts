export const TAVERNDB_TEMPLATE_SHEET_IDS = [
  'SYS_GlobalState',
  'SYS_CommandAudit',
  'SYS_TransactionAudit',
  'SYS_ValidationIssue',
  'SYS_MappingRegistry',
  'SYS_StateVarEventLog',
  'SYS_StateVarApplyLog',
  'NPC_Registry',
  'ITEM_Inventory',
  'QUEST_Active',
  'FACTION_Standing',
  'ECON_Ledger',
  'COMBAT_Encounter',
  'COMBAT_BattleMap',
  'LOG_Summary',
  'LOG_Outline',
  'UI_ActionOptions',
  'DICE_Pool',
  'SKILL_Library',
  'CHARACTER_Skills',
  'FEAT_Library',
  'CHARACTER_Feats',
  'CHARACTER_Registry',
  'CHARACTER_Attributes',
  'CHARACTER_Resources',
  'PHONE_Device',
  'PHONE_Contacts',
  'PHONE_Threads',
  'PHONE_Messages',
  'PHONE_Pending',
  'FORUM_Boards',
  'FORUM_Posts',
  'FORUM_Replies',
  'PHONE_Moments',
  'WORLD_NpcTracking',
  'WORLD_News',
  'WORLD_Rumors',
  'WORLD_Denatus',
  'WORLD_WarGame',
  'STORY_Mainline',
  'STORY_Triggers',
  'STORY_Milestones',
  'CONTRACT_Registry',
  'MAP_SurfaceLocations',
  'MAP_DungeonLayers',
  'MAP_MacroLocations',
  'MAP_MidLocations',
  'NPC_RelationshipEvents',
  'NPC_LocationTrace',
  'NPC_InteractionLog',
  'QUEST_Objectives',
  'QUEST_ProgressLog',
  'EXPLORATION_Map_Data',
  'COMBAT_Map_Visuals'
] as const;

export const CORE_TAVERNDB_SHEET_IDS = [
  'SYS_GlobalState',
  'NPC_Registry',
  'ITEM_Inventory',
  'QUEST_Active',
  'FACTION_Standing',
  'ECON_Ledger',
  'COMBAT_Encounter',
  'COMBAT_BattleMap',
  'LOG_Summary',
  'LOG_Outline',
  'UI_ActionOptions',
  'DICE_Pool',
  'EXPLORATION_Map_Data',
  'COMBAT_Map_Visuals',
  'CHARACTER_Registry',
  'CHARACTER_Attributes',
  'CHARACTER_Resources'
] as const;

export type TavernDBSheetId = typeof TAVERNDB_TEMPLATE_SHEET_IDS[number];
export type CoreTavernDBSheetId = typeof CORE_TAVERNDB_SHEET_IDS[number];

export interface TavernDBSheetColumnDefinition {
  key: string;
  required?: boolean;
}

export interface TavernDBSheetDefinition {
  id: TavernDBSheetId;
  label: string;
  description: string;
  order: number;
  columns: TavernDBSheetColumnDefinition[];
}

export type TavernDBTableRow = Record<string, unknown>;
export type TavernDBRowId = string | number;

export type TavernDBSheetPatchOperation = 'upsert' | 'delete';

export type TavernDBPatchConflictReason =
  | 'sheet_version_conflict'
  | 'row_version_conflict'
  | 'row_locked'
  | 'cell_locked'
  | 'source_not_allowed'
  | 'idempotency_conflict'
  | 'stale_event';

export interface TavernDBRowLock {
  sheetId: TavernDBSheetId;
  rowId: TavernDBRowId;
  owner?: string;
  reason?: string;
  createdAt?: number;
}

export interface TavernDBCellLock extends TavernDBRowLock {
  field: string;
}

export interface TavernDBRuntimeMeta {
  sheetVersions?: Partial<Record<TavernDBSheetId, number>>;
  rowVersions?: Record<string, number>;
  rowLocks?: TavernDBRowLock[];
  cellLocks?: TavernDBCellLock[];
  txJournal?: TavernDBTransactionTrace[];
  conflictStats?: {
    total: number;
    byReason?: Partial<Record<TavernDBPatchConflictReason, number>>;
    updatedAt?: number;
  };
}

export interface TavernDBPatchTrace {
  sheetId: TavernDBSheetId;
  rowId: TavernDBRowId;
  operation: TavernDBSheetPatchOperation;
  changedFields?: string[];
}

export interface TavernDBTransactionTrace {
  txId: string;
  timestamp: number;
  status: 'committed' | 'blocked' | 'rollback';
  commandCount: number;
  patchCount: number;
  patches: TavernDBPatchTrace[];
  sources?: string[];
  reason?: string;
}

export interface TavernDBPatchConflict {
  sheetId: TavernDBSheetId;
  rowId: TavernDBRowId;
  reason: TavernDBPatchConflictReason;
  message: string;
  expected?: number;
  actual?: number;
  field?: string;
}

export interface TavernDBSheetPatch {
  sheetId: TavernDBSheetId;
  operation: TavernDBSheetPatchOperation;
  rowId: TavernDBRowId;
  row?: TavernDBTableRow;
  reason?: string;
  commandRef?: string;
  expectedSheetVersion?: number;
  expectedRowVersion?: number;
  changedFields?: string[];
  lockOwner?: string;
  source?: string;
}

export interface TavernDBDomainMapping {
  domain: string;
  module: string;
  sheetId: TavernDBSheetId;
  primaryKey: string;
  description: string;
}

export interface TavernDBProjectedTable {
  id: TavernDBSheetId;
  label: string;
  columns: string[];
  rows: TavernDBTableRow[];
}

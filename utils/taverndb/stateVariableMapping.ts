import type { TavernDBSheetId } from '../../types/taverndb';

export const STATE_VARIABLE_PILOT_SHEETS = [
  'SYS_GlobalState',
  'CHARACTER_Resources',
  'ITEM_Inventory'
] as const satisfies TavernDBSheetId[];

export type StateVariablePilotSheetId = typeof STATE_VARIABLE_PILOT_SHEETS[number];

export type StateVariableTarget = {
  domain: 'global_state' | 'character_resources' | 'inventory';
  sheetId: StateVariablePilotSheetId;
  entityId: string;
  path: string;
};

const GLOBAL_STATE_KEYS = new Set([
  '当前场景',
  '场景描述',
  '当前日期',
  '游戏时间',
  '上轮时间',
  '流逝时长',
  '世界坐标X',
  '世界坐标Y',
  '天气状况',
  '战斗模式',
  '当前回合',
  '系统通知',
  '当前地点'
]);

export const isStateVariablePilotSheet = (sheetId: unknown): sheetId is StateVariablePilotSheetId => {
  return STATE_VARIABLE_PILOT_SHEETS.includes(String(sheetId) as StateVariablePilotSheetId);
};

export const normalizeGameStatePath = (rawPath: unknown): string => {
  const source = String(rawPath ?? '').trim();
  if (!source) return '';
  const path = source.replace(/^gameState\./, '');
  return path.replace(/\[(\d+)\]/g, '.$1');
};

export const mapLegacyPathToStateVariableTarget = (rawPath: unknown): StateVariableTarget | null => {
  const path = normalizeGameStatePath(rawPath);
  if (!path) return null;
  const firstSegment = path.split('.')[0] || '';

  if (GLOBAL_STATE_KEYS.has(firstSegment)) {
    return {
      domain: 'global_state',
      sheetId: 'SYS_GlobalState',
      entityId: 'GLOBAL',
      path: `gameState.${path}`
    };
  }

  if (path.startsWith('角色.')) {
    return {
      domain: 'character_resources',
      sheetId: 'CHARACTER_Resources',
      entityId: 'PLAYER',
      path: `gameState.${path}`
    };
  }

  if (path === '背包' || path.startsWith('背包.') || path.startsWith('背包[')) {
    return {
      domain: 'inventory',
      sheetId: 'ITEM_Inventory',
      entityId: 'INVENTORY',
      path: `gameState.${path}`
    };
  }

  return null;
};

const toEntityId = (value: unknown, fallback: string): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

export const mapSheetRowToStateVariableTarget = (
  sheetId: unknown,
  row: Record<string, unknown>
): StateVariableTarget | null => {
  const normalizedSheet = String(sheetId) as TavernDBSheetId;
  if (!isStateVariablePilotSheet(normalizedSheet)) return null;

  if (normalizedSheet === 'SYS_GlobalState') {
    const globalId = toEntityId(row._global_id ?? row.id, 'GLOBAL_STATE');
    return {
      domain: 'global_state',
      sheetId: normalizedSheet,
      entityId: globalId,
      path: `sheet.SYS_GlobalState.${globalId}`
    };
  }

  if (normalizedSheet === 'CHARACTER_Resources') {
    const charId = toEntityId(row.CHAR_ID ?? row.char_id ?? row.id, 'PLAYER');
    return {
      domain: 'character_resources',
      sheetId: normalizedSheet,
      entityId: charId,
      path: `sheet.CHARACTER_Resources.${charId}`
    };
  }

  const itemId = toEntityId(row.物品ID ?? row.item_id ?? row.id ?? row.物品名称, 'INVENTORY');
  return {
    domain: 'inventory',
    sheetId: normalizedSheet,
    entityId: itemId,
    path: `sheet.ITEM_Inventory.${itemId}`
  };
};

import { InventoryItem } from '../types';

export const normalizeItemNameKey = (value?: string): string => {
  if (!value) return '';
  return value.toLowerCase().replace(/[\s·・_.\-]/g, '');
};

const calcNameMatchScore = (left: string, right: string): number => {
  if (!left || !right) return 0;
  if (left === right) return 1000;
  if (left.length < 2 || right.length < 2) return 0;

  let score = 0;
  if (left.includes(right)) score = Math.max(score, right.length * 10);
  if (right.includes(left)) score = Math.max(score, left.length * 10);
  if (left.startsWith(right) || right.startsWith(left)) score += 8;

  return score;
};

export const findBestInventoryMatch = (
  inventory: InventoryItem[],
  ref: { id?: string; name?: string }
): InventoryItem | null => {
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  if (safeInventory.length === 0) return null;

  if (ref.id) {
    const byId = safeInventory.find((item) => item.id && item.id === ref.id);
    if (byId) return byId;
  }

  const refNameKey = normalizeItemNameKey(ref.name);
  if (!refNameKey) return null;

  const exact = safeInventory.find((item) => normalizeItemNameKey(item.名称) === refNameKey);
  if (exact) return exact;

  let best: { item: InventoryItem; score: number } | null = null;

  safeInventory.forEach((item) => {
    const nameKey = normalizeItemNameKey(item.名称);
    const score = calcNameMatchScore(refNameKey, nameKey);
    if (score <= 0) return;

    if (!best || score > best.score) {
      best = { item, score };
    }
  });

  return best ? best.item : null;
};

export const reconcileEquipmentNameByInventory = (
  equipment: Record<string, string> | undefined,
  inventory: InventoryItem[]
): { equipment: Record<string, string>; changed: boolean } => {
  const baseEquip = equipment && typeof equipment === 'object' ? equipment : {};
  const nextEquip: Record<string, string> = { ...baseEquip };
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  let changed = false;

  Object.entries(baseEquip).forEach(([slot, rawName]) => {
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name) return;

    const matched = findBestInventoryMatch(safeInventory, { name });
    if (!matched) {
      if (nextEquip[slot] !== '') {
        nextEquip[slot] = '';
        changed = true;
      }
      return;
    }

    if (nextEquip[slot] !== matched.名称) {
      nextEquip[slot] = matched.名称;
      changed = true;
    }
  });

  return { equipment: nextEquip, changed };
};

export const buildEquippedKeySet = (equipment: Record<string, unknown> | undefined): Set<string> => {
  const slots = equipment && typeof equipment === 'object' ? equipment : {};
  const keys = new Set<string>();

  Object.values(slots).forEach((raw) => {
    if (typeof raw === 'string') {
      const text = raw.trim();
      if (!text) return;
      const key = normalizeItemNameKey(text);
      if (!key) return;
      keys.add(key);
      return;
    }
    if (!raw || typeof raw !== 'object') return;
    const record = raw as Record<string, unknown>;
    const text = String(record.名称 ?? record.name ?? record.id ?? '').trim();
    if (!text) return;
    const key = normalizeItemNameKey(text);
    if (!key) return;
    keys.add(key);
  });

  return keys;
};

export const isInventoryItemEquipped = (
  item: InventoryItem,
  equippedKeys: Set<string>
): boolean => {
  if (!item || !(equippedKeys instanceof Set) || equippedKeys.size === 0) return false;
  const idKey = normalizeItemNameKey(String(item.id || '').trim());
  if (idKey && equippedKeys.has(idKey)) return true;
  const nameKey = normalizeItemNameKey(String(item.名称 || '').trim());
  if (nameKey && equippedKeys.has(nameKey)) return true;
  return false;
};

const parseEquippedFlag = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['1', 'true', 'yes', 'y', '是', '开', 'on', 'equipped'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', '否', '关', 'off', 'unequipped'].includes(normalized)) return false;
  }
  return null;
};

export const syncInventoryEquippedByEquipment = (
  inventory: InventoryItem[],
  equipment: Record<string, unknown> | undefined
): { inventory: InventoryItem[]; changed: boolean } => {
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  if (safeInventory.length === 0) {
    return { inventory: safeInventory, changed: false };
  }

  const equippedKeys = buildEquippedKeySet(equipment);
  let changed = false;
  const nextInventory = safeInventory.map((item) => {
    const expectedEquipped = isInventoryItemEquipped(item, equippedKeys);
    const parsed = parseEquippedFlag((item as any)?.已装备);
    const currentEquipped = parsed === null ? false : parsed;
    if (currentEquipped === expectedEquipped) return item;
    changed = true;
    return {
      ...item,
      已装备: expectedEquipped
    };
  });

  return { inventory: nextInventory, changed };
};

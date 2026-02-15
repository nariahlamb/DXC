import { InventoryItem } from '../types';
import { IconName } from './iconMapper';

const WEAPON_TYPES = new Set([
  'weapon',
  '武器',
  '兵器',
  '主手',
  '副手'
]);

const ARMOR_TYPES = new Set([
  'armor',
  '防具',
  '护甲',
  '盔甲',
  '饰品'
]);

const CONSUMABLE_TYPES = new Set([
  'consumable',
  '消耗品',
  '药剂',
  '道具',
  '补给'
]);

const MATERIAL_TYPES = new Set([
  'material',
  '材料',
  '素材'
]);

const KEY_TYPES = new Set([
  'key_item',
  '关键',
  '关键物品',
  '钥匙',
  '钥匙物品'
]);

const LOOT_TYPES = new Set([
  'loot',
  '战利品',
  '掉落'
]);

export type ItemQualityKey = 'Broken' | 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Pristine';
export type ItemQualityLabel = '破损' | '普通' | '稀有' | '史诗' | '传说' | '神话';

const QUALITY_KEY_TO_LABEL: Record<ItemQualityKey, ItemQualityLabel> = {
  Broken: '破损',
  Common: '普通',
  Rare: '稀有',
  Epic: '史诗',
  Legendary: '传说',
  Pristine: '神话'
};

const QUALITY_ALIAS_TO_KEY: Record<string, ItemQualityKey> = {
  broken: 'Broken',
  damaged: 'Broken',
  ruined: 'Broken',
  common: 'Common',
  normal: 'Common',
  basic: 'Common',
  uncommon: 'Rare',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Pristine',
  pristine: 'Pristine',
  perfect: 'Pristine',
  artifact: 'Pristine',
  n: 'Common',
  c: 'Common',
  r: 'Rare',
  sr: 'Epic',
  s: 'Epic',
  ss: 'Legendary',
  ssr: 'Legendary',
  ur: 'Pristine',
  ex: 'Pristine',
  sss: 'Pristine',
  破损: 'Broken',
  损坏: 'Broken',
  普通: 'Common',
  常见: 'Common',
  精良: 'Rare',
  稀有: 'Rare',
  史诗: 'Epic',
  传说: 'Legendary',
  神话: 'Pristine',
  完美: 'Pristine'
};

const normalizeQualityAlias = (quality?: string): string => {
  if (!quality) return '';
  return String(quality).trim().toLowerCase().replace(/[\s_-]/g, '');
};

export const normalizeQuality = (quality?: string): ItemQualityKey => {
  if (!quality) return 'Common';
  const raw = String(quality).trim();
  if (!raw) return 'Common';
  const keyByRaw = QUALITY_ALIAS_TO_KEY[raw];
  if (keyByRaw) return keyByRaw;
  const keyByAlias = QUALITY_ALIAS_TO_KEY[normalizeQualityAlias(raw)];
  return keyByAlias || 'Common';
};

export const normalizeQualityLabel = (quality?: string): ItemQualityLabel => {
  const normalized = normalizeQuality(quality);
  return QUALITY_KEY_TO_LABEL[normalized];
};

export const getQualityRank = (quality?: string): number => {
  const normalized = normalizeQuality(quality);
  switch (normalized) {
    case 'Pristine': return 6;
    case 'Legendary': return 5;
    case 'Epic': return 4;
    case 'Rare': return 3;
    case 'Common': return 1;
    case 'Broken': return 0;
    default: return 1;
  }
};

export const getQualityLabel = (quality?: string): string => {
  return normalizeQualityLabel(quality);
};

export const getTypeLabel = (type?: string): string => {
  if (!type) return '未知';
  const normalized = type.toLowerCase();
  if (WEAPON_TYPES.has(type) || WEAPON_TYPES.has(normalized)) return '武器';
  if (ARMOR_TYPES.has(type) || ARMOR_TYPES.has(normalized)) return '防具';
  if (CONSUMABLE_TYPES.has(type) || CONSUMABLE_TYPES.has(normalized)) return '消耗品';
  if (MATERIAL_TYPES.has(type) || MATERIAL_TYPES.has(normalized)) return '材料';
  if (KEY_TYPES.has(type) || KEY_TYPES.has(normalized)) return '关键物品';
  if (LOOT_TYPES.has(type) || LOOT_TYPES.has(normalized)) return '战利品';
  return type;
};

export type ItemCategory = 'WEAPON' | 'ARMOR' | 'CONSUMABLE' | 'MATERIAL' | 'KEY_ITEM' | 'LOOT' | 'OTHER';

export const getItemCategory = (item: InventoryItem): ItemCategory => {
  if (isWeaponItem(item)) return 'WEAPON';
  if (isArmorItem(item)) return 'ARMOR';
  const raw = item.类型;
  const normalized = typeof raw === 'string' ? raw.toLowerCase() : raw;
  const matches = (set: Set<string>) => (raw && set.has(raw)) || (typeof normalized === 'string' && set.has(normalized));
  if (matches(CONSUMABLE_TYPES)) return 'CONSUMABLE';
  if (matches(MATERIAL_TYPES)) return 'MATERIAL';
  if (matches(KEY_TYPES)) return 'KEY_ITEM';
  if (matches(LOOT_TYPES)) return 'LOOT';
  return 'OTHER';
};

export const isWeaponItem = (item: InventoryItem): boolean => {
  if (!item) return false;
  if (item.武器) return true;
  if (!item.类型) return false;
  const raw = item.类型;
  const normalized = typeof raw === 'string' ? raw.toLowerCase() : raw;
  return WEAPON_TYPES.has(raw) || (typeof normalized === 'string' && WEAPON_TYPES.has(normalized));
};

export const isArmorItem = (item: InventoryItem): boolean => {
  if (!item) return false;
  if (item.防具) return true;
  if (!item.类型) return false;
  const raw = item.类型;
  const normalized = typeof raw === 'string' ? raw.toLowerCase() : raw;
  return ARMOR_TYPES.has(raw) || (typeof normalized === 'string' && ARMOR_TYPES.has(normalized));
};

export const getDefaultEquipSlot = (item: InventoryItem): string => {
  if (!item) return '';
  if (item.装备槽位) return item.装备槽位;
  if (isWeaponItem(item)) return '主手';
  if (isArmorItem(item)) return '身体';
  return '';
};

export const ensureTypeTag = (item: InventoryItem, category: ItemCategory): InventoryItem => {
  if (!item) return item;
  if (item.类型) return item;
  const type = category === 'WEAPON'
    ? 'weapon'
    : category === 'ARMOR'
      ? 'armor'
      : category === 'CONSUMABLE'
        ? 'consumable'
        : category === 'MATERIAL'
          ? 'material'
          : category === 'KEY_ITEM'
            ? 'key_item'
            : category === 'LOOT'
              ? 'loot'
              : 'loot';
  return { ...item, 类型: type };
};

export const getItemIconName = (item: InventoryItem): IconName => {
  if (!item) return 'Backpack';
  const category = getItemCategory(item);
  const name = item.名称 || '';
  
  if (category === 'WEAPON') {
    if (name.includes('剑') || name.includes('Sword')) return 'WeaponSword';
    if (name.includes('匕首') || name.includes('短刀') || name.includes('Dagger')) return 'WeaponDagger';
    if (name.includes('斧') || name.includes('Axe')) return 'WeaponAxe';
    if (name.includes('枪') || name.includes('矛') || name.includes('Spear')) return 'WeaponSpear';
    if (name.includes('弓') || name.includes('Bow')) return 'WeaponBow';
    if (name.includes('杖') || name.includes('Staff')) return 'WeaponStaff';
    if (name.includes('锤') || name.includes('Hammer')) return 'WeaponHammer';
    if (name.includes('拳') || name.includes('爪') || name.includes('Fist')) return 'WeaponFist';
    return 'WeaponSword';
  }
  
  if (category === 'ARMOR') {
    const slot = getDefaultEquipSlot(item);
    if (slot.includes('头')) return 'SlotHead';
    if (slot.includes('身') || slot.includes('胸')) return 'SlotBody';
    if (slot.includes('手')) return 'SlotHand';
    if (slot.includes('腿')) return 'SlotLegs';
    if (slot.includes('足') || slot.includes('脚') || slot.includes('靴')) return 'SlotFeet';
    if (slot.includes('饰品') || slot.includes('指环') || slot.includes('项链')) return 'SlotAccessory';
    return 'Shield';
  }
  
  if (category === 'CONSUMABLE') {
    if (name.includes('药') || name.includes('Potion')) return 'Potion';
    if (name.includes('卷轴') || name.includes('书') || name.includes('Scroll')) return 'Scroll';
    if (name.includes('肉') || name.includes('Food')) return 'ItemConsumable'; 
    return 'ItemConsumable';
  }
  
  if (category === 'MATERIAL') {
    if (name.includes('矿') || name.includes('金') || name.includes('Ingot')) return 'ItemMaterial';
    if (name.includes('革') || name.includes('皮')) return 'ItemMaterial';
    if (name.includes('骨')) return 'ItemMaterial';
    return 'ItemMaterial';
  }

  if (category === 'KEY_ITEM') return 'Key';
  
  if (category === 'LOOT') return 'Loot';

  return 'Backpack'; 
};

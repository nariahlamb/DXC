import { describe, expect, it } from 'vitest';
import { buildEquippedKeySet, isInventoryItemEquipped, syncInventoryEquippedByEquipment } from '../../utils/equipmentLinking';

describe('equipment linking helpers', () => {
  it('builds equipped key set from equipment slot values', () => {
    const equipped = buildEquippedKeySet({
      主手: ' 御币 ',
      副手: '',
      饰品1: 'ITEM_REIMU_CHARM'
    });

    expect(equipped.has('御币')).toBe(true);
    expect(equipped.has('itemreimucharm')).toBe(true);
    expect(equipped.size).toBe(2);
  });

  it('syncs inventory 已装备 flags to equipment slots as single source of truth', () => {
    const inventory = [
      { id: 'ITEM_REIMU_GOHEI', 名称: '御币', 描述: '', 数量: 1, 类型: '武器', 已装备: false },
      { id: 'ITEM_REIMU_OFUDA', 名称: '符纸', 描述: '', 数量: 5, 类型: '消耗品', 已装备: true }
    ] as any;

    const synced = syncInventoryEquippedByEquipment(inventory, {
      主手: '御币'
    });

    expect(synced.changed).toBe(true);
    expect(synced.inventory[0].已装备).toBe(true);
    expect(synced.inventory[1].已装备).toBe(false);
    expect(isInventoryItemEquipped(synced.inventory[0] as any, buildEquippedKeySet({ 主手: '御币' }))).toBe(true);
  });
});

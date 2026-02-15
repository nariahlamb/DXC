import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InventoryModal } from './InventoryModal';
import type { InventoryItem } from '../../../types';

const createItem = (overrides: Partial<InventoryItem>): InventoryItem => ({
  id: 'item-1',
  名称: '物品',
  描述: '物品描述',
  数量: 1,
  类型: 'material',
  品质: 'Common',
  ...overrides
});

const defaultItems: InventoryItem[] = [
  createItem({
    id: 'weapon-1',
    名称: '青铜短剑',
    描述: '适合新手的短剑',
    类型: 'weapon',
    品质: 'Rare'
  }),
  createItem({
    id: 'weapon-2',
    名称: '守卫长剑',
    描述: '守卫制式长剑',
    类型: 'weapon',
    已装备: true,
    品质: 'Epic'
  }),
  createItem({
    id: 'consumable-1',
    名称: '治疗药水',
    描述: '回复生命值',
    类型: 'consumable',
    数量: 2
  })
];

const createProps = (
  overrides: Partial<React.ComponentProps<typeof InventoryModal>> = {}
): React.ComponentProps<typeof InventoryModal> => ({
  isOpen: true,
  onClose: vi.fn(),
  items: defaultItems,
  equipment: {},
  onEquipItem: vi.fn(),
  onUnequipItem: vi.fn(),
  onUseItem: vi.fn(),
  ...overrides
});

const renderModal = (
  overrides: Partial<React.ComponentProps<typeof InventoryModal>> = {}
) => {
  const props = createProps(overrides);
  render(<InventoryModal {...props} />);
  return props;
};

describe('InventoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title, slots and default detail hint', () => {
    renderModal();

    expect(screen.getByText('物品清单')).toBeInTheDocument();
    expect(screen.getByText('SLOTS: 3 / 100')).toBeInTheDocument();
    expect(screen.getByText('选择物品查看详情')).toBeInTheDocument();
  });

  it('filters items by search text and shows empty state for no matches', () => {
    renderModal();

    const input = screen.getByPlaceholderText('搜索物品...');
    fireEvent.change(input, { target: { value: '治疗' } });

    expect(screen.getByText('治疗药水')).toBeInTheDocument();
    expect(screen.queryByText('青铜短剑')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: '不存在' } });
    expect(screen.getByText('没有找到物品')).toBeInTheDocument();
  });

  it('filters items by category button', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: '道具' }));

    expect(screen.getByText('治疗药水')).toBeInTheDocument();
    expect(screen.queryByText('青铜短剑')).not.toBeInTheDocument();
    expect(screen.queryByText('守卫长剑')).not.toBeInTheDocument();
  });

  it('shows detail panel after selecting an item', () => {
    renderModal();

    fireEvent.click(screen.getByText('青铜短剑'));

    expect(screen.queryByText('选择物品查看详情')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '装备' })).toBeInTheDocument();
  });

  it('calls onEquipItem for an unequipped weapon', () => {
    const props = renderModal();

    fireEvent.click(screen.getByText('青铜短剑'));
    fireEvent.click(screen.getByRole('button', { name: '装备' }));

    expect(props.onEquipItem).toHaveBeenCalledTimes(1);
    expect(props.onEquipItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'weapon-1', 名称: '青铜短剑' })
    );
  });

  it('calls onUnequipItem for an equipped weapon', () => {
    const props = renderModal();

    fireEvent.click(screen.getByText('守卫长剑'));
    fireEvent.click(screen.getByRole('button', { name: '卸下装备' }));

    expect(props.onUnequipItem).toHaveBeenCalledTimes(1);
    expect(props.onUnequipItem).toHaveBeenCalledWith('主手', '守卫长剑', 'weapon-2');
  });

  it('calls onUseItem for a consumable item', () => {
    const props = renderModal();

    fireEvent.click(screen.getByText('治疗药水'));
    fireEvent.click(screen.getByRole('button', { name: '使用物品' }));

    expect(props.onUseItem).toHaveBeenCalledTimes(1);
    expect(props.onUseItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'consumable-1', 名称: '治疗药水' })
    );
  });
});

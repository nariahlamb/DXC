import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../../types';
import { getItemCategory, getQualityLabel, getTypeLabel, isWeaponItem, isArmorItem, getQualityRank, getDefaultEquipSlot } from '../../utils/itemUtils';
import { UnifiedItemDetailSections } from '../game/UnifiedItemDetailSections';
import { InventoryItemCard, getRarityConfig, getItemIcon } from '../game/InventoryItemCard';
import { BaseModal } from '../ui/base/BaseModal';
import { BaseButton } from '../ui/base/BaseButton';
import { Icons } from '../../utils/iconMapper';
import clsx from 'clsx';

interface MobileInventoryViewProps {
  items: InventoryItem[];
  equipment: { [key: string]: string };
  onEquipItem: (item: InventoryItem) => void;
  onUnequipItem: (slotKey: string, itemName?: string, itemId?: string) => void;
  onUseItem: (item: InventoryItem) => void;
  publicLoot?: InventoryItem[];
  lootVault?: InventoryItem[];
  initialTab?: 'BACKPACK' | 'PUBLIC_LOOT' | 'LOOT_VAULT';
}

export const MobileInventoryView: React.FC<MobileInventoryViewProps> = ({
    items,
    equipment: _equipment, // Intentionally unused - equipped status comes from items prop
    onEquipItem,
    onUnequipItem,
    onUseItem,
    publicLoot = [],
    lootVault = [],
    initialTab = 'BACKPACK',
}) => {
  const [sourceTab, setSourceTab] = useState<'BACKPACK' | 'PUBLIC_LOOT' | 'LOOT_VAULT'>(initialTab);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  React.useEffect(() => {
      setSourceTab(initialTab);
      setSelectedItem(null);
  }, [initialTab]);

  React.useEffect(() => {
      setSelectedItem(null);
  }, [sourceTab]);

  // Use items directly from props - equipped status is already set by parent
  // The equipment prop is kept for API compatibility but not used for derivation
  const currentItems = useMemo(() => {
      if (sourceTab === 'PUBLIC_LOOT') return Array.isArray(publicLoot) ? publicLoot : [];
      if (sourceTab === 'LOOT_VAULT') return Array.isArray(lootVault) ? lootVault : [];
      return Array.isArray(items) ? items : [];
  }, [sourceTab, items, publicLoot, lootVault]);

  const allItems = useMemo(() => currentItems, [currentItems]);

  const TAB_LABELS: Record<string, string> = {
      'ALL': '全部',
      'WEAPON': '武器',
      'ARMOR': '防具',
      'CONSUMABLE': '物品',
      'MATERIAL': '素材',
      'KEY_ITEM': '重要',
      'LOOT': '掉落',
      'OTHER': '杂项'
  };

  const categories = useMemo(() => {
      const cats = new Set<string>(['ALL']);
      allItems.forEach(item => {
          cats.add(getItemCategory(item));
      });
      return Array.from(cats);
  }, [allItems]);

  const filteredItems = useMemo(() => {
      let filtered = allItems;
      if (activeTab !== 'ALL') {
          filtered = allItems.filter(i => getItemCategory(i) === activeTab);
      }
      return filtered.sort((a, b) => {
          if (a.已装备 !== b.已装备) return a.已装备 ? -1 : 1;
          const rankA = getQualityRank(a.品质);
          const rankB = getQualityRank(b.品质);
          if (rankA !== rankB) return rankB - rankA;
          return 0;
      });
  }, [allItems, activeTab]);

    return (
    <div className="w-full h-full relative flex flex-col bg-surface-base animate-in fade-in duration-300 overflow-hidden">

        <div className="h-12 bg-black/35 border-b border-white/5 flex items-center px-2 gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
                onClick={() => setSourceTab('BACKPACK')}
                className={clsx(
                    'px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border',
                    sourceTab === 'BACKPACK'
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-black/20 text-zinc-400 border-white/5 hover:text-zinc-200'
                )}
            >
                背包 ({items.length})
            </button>
            <button
                onClick={() => setSourceTab('PUBLIC_LOOT')}
                className={clsx(
                    'px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border',
                    sourceTab === 'PUBLIC_LOOT'
                        ? 'bg-amber-900/35 text-amber-200 border-amber-500/30'
                        : 'bg-black/20 text-zinc-400 border-white/5 hover:text-amber-200/80'
                )}
            >
                公共战利品 ({publicLoot.length})
            </button>
            <button
                onClick={() => setSourceTab('LOOT_VAULT')}
                className={clsx(
                    'px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border',
                    sourceTab === 'LOOT_VAULT'
                        ? 'bg-purple-900/35 text-purple-200 border-purple-500/30'
                        : 'bg-black/20 text-zinc-400 border-white/5 hover:text-purple-200/80'
                )}
            >
                仓库 ({lootVault.length})
            </button>
        </div>
        
        {/* Top Category Filter (Horizontal Scroll) */}
        <div className="h-14 bg-surface-glass backdrop-blur-md border-b border-white/5 flex items-center px-3 gap-3 overflow-x-auto no-scrollbar shrink-0 z-10 mask-fade-right">
            {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveTab(cat)}
                    className={clsx(
                        "px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border shadow-sm active:scale-95",
                        activeTab === cat
                            ? "bg-accent-blue/20 text-accent-blue border-accent-blue/50 shadow-[0_0_10px_rgba(37,99,235,0.2)]"
                            : "bg-surface-base text-content-muted border-white/5 hover:bg-white/5"
                    )}
                >
                    {TAB_LABELS[cat] || cat}
                </button>
            ))}
        </div>

        {/* Item List (Grid) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 pb-safe">
            <div className="grid grid-cols-1 gap-2.5 pb-24">
                {filteredItems.map((item) => (
                    <InventoryItemCard
                        key={item.id}
                        item={item}
                        isSelected={selectedItem?.id === item.id}
                        onClick={() => setSelectedItem(item)}
                        variant="compact"
                        className="h-auto min-h-[72px] py-2.5 touch-manipulation active:scale-[0.99] transition-transform" // Optimized for touch
                    />
                ))}

                {filteredItems.length === 0 && (
                     <div className="flex flex-col items-center justify-center py-32 opacity-30 text-content-muted">
                        <Icons.Backpack size={64} className="mb-6 stroke-1 text-slate-500" />
                        <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Inventory Empty</span>
                        <span className="text-xs text-slate-600 mt-2">No items in this category</span>
                    </div>
                )}
            </div>
        </div>

        {/* Item Detail Modal (BaseModal) */}
        {selectedItem && (
            <BaseModal
                isOpen={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                title={selectedItem.名称}
                size="full"
                className="bg-surface-base"
            >
                <div className="flex flex-col h-full p-6 space-y-6">
                    {/* Header with Large Icon */}
                    <div className="flex flex-col items-center justify-center py-6 bg-surface-overlay rounded-2xl border border-white/5 relative overflow-hidden">
                        <div className={clsx("absolute inset-0 opacity-20", getRarityConfig(selectedItem.品质).bg)} />
                        <div className="relative z-10 scale-[2.0] drop-shadow-2xl animate-float">
                            {getItemIcon(selectedItem, 48, getRarityConfig(selectedItem.品质).text)}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-center gap-3">
                            <span className={clsx("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-black/40", getRarityConfig(selectedItem.品质).border, getRarityConfig(selectedItem.品质).text)}>
                                {getQualityLabel(selectedItem.品质)}
                            </span>
                            <span className="text-xs text-content-muted font-bold uppercase">{getTypeLabel(selectedItem.类型)}</span>
                        </div>

                        <UnifiedItemDetailSections item={selectedItem} />
                    </div>

                    {/* Actions */}
                    <div className="mt-auto grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                        <BaseButton variant="ghost" onClick={() => setSelectedItem(null)}>
                            关闭
                        </BaseButton>
                        
                        {(isWeaponItem(selectedItem) || isArmorItem(selectedItem)) ? (
                            selectedItem.已装备 ? (
                                <BaseButton variant="danger" onClick={() => { onUnequipItem(getDefaultEquipSlot(selectedItem), selectedItem.名称, selectedItem.id); setSelectedItem(null); }}>
                                    卸下
                                </BaseButton>
                            ) : (
                                sourceTab === 'BACKPACK' ? (
                                    <BaseButton variant="solid" onClick={() => { onEquipItem(selectedItem); setSelectedItem(null); }}>
                                        装备
                                    </BaseButton>
                                ) : (
                                    <div className="text-xs text-zinc-500 flex items-center justify-center border border-dashed border-zinc-700/50 rounded-lg px-3">
                                        仅背包物品可装备
                                    </div>
                                )
                            )
                        ) : getItemCategory(selectedItem) === 'CONSUMABLE' ? (
                            sourceTab === 'BACKPACK' ? (
                                <BaseButton variant="glass" onClick={() => { onUseItem(selectedItem); setSelectedItem(null); }}>
                                    使用
                                </BaseButton>
                            ) : (
                                <div className="text-xs text-zinc-500 flex items-center justify-center border border-dashed border-zinc-700/50 rounded-lg px-3">
                                    仅背包物品可使用
                                </div>
                            )
                        ) : (
                            <div />
                        )}
                    </div>
                </div>
            </BaseModal>
        )}
    </div>
  );
};

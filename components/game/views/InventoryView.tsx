import React, { useState, useMemo } from 'react';
import { Search, Package, X, Filter } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { InventoryItemCard, getRarityConfig, getItemIcon } from '../InventoryItemCard';
import { getItemCategory, getQualityLabel, getTypeLabel, isWeaponItem, isArmorItem, getDefaultEquipSlot, getQualityRank } from '../../../utils/itemUtils';
import clsx from 'clsx';
import { BaseButton } from '../../ui/base/BaseButton';
import { UnifiedItemDetailSections } from '../UnifiedItemDetailSections';

interface InventoryViewProps {
  items: InventoryItem[];
  equipment: { [key: string]: string };
  onEquipItem: (item: InventoryItem) => void;
  onUnequipItem: (slotKey: string, itemName?: string, itemId?: string) => void;
  onUseItem: (item: InventoryItem) => void;
  onClose?: () => void;
  publicLoot?: InventoryItem[];
  lootVault?: InventoryItem[];
  initialTab?: 'BACKPACK' | 'PUBLIC_LOOT' | 'LOOT_VAULT';
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  items, equipment, onEquipItem, onUnequipItem, onUseItem, onClose,
  publicLoot = [], lootVault = [], initialTab = 'BACKPACK'
}) => {
  const [activeTab, setActiveTab] = useState<'BACKPACK' | 'PUBLIC_LOOT' | 'LOOT_VAULT'>(initialTab);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Determine current items based on tab
  const currentItems = useMemo(() => {
      switch (activeTab) {
          case 'PUBLIC_LOOT': return publicLoot;
          case 'LOOT_VAULT': return lootVault;
          default: return items;
      }
  }, [activeTab, items, publicLoot, lootVault]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = currentItems ? [...currentItems] : [];
    
    if (categoryFilter !== 'ALL') {
        result = result.filter(item => getItemCategory(item) === categoryFilter);
    }

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(item => 
            item.名称.toLowerCase().includes(lower) || 
            (item.描述 && item.描述.toLowerCase().includes(lower))
        );
    }
    
    return result.sort((a, b) => {
        if (a.已装备 !== b.已装备) return a.已装备 ? -1 : 1;
        const rankA = getQualityRank(a.品质);
        const rankB = getQualityRank(b.品质);
        if (rankA !== rankB) return rankB - rankA;
        return 0;
    });
  }, [currentItems, categoryFilter, searchTerm]);

  // CATEGORIES
  const categories = [
      { id: 'ALL', label: '全部' },
      { id: 'WEAPON', label: '武器' },
      { id: 'ARMOR', label: '防具' },
      { id: 'CONSUMABLE', label: '道具' },
      { id: 'MATERIAL', label: '素材' },
      { id: 'KEY_ITEM', label: '关键' },
  ];

  const rarity = selectedItem ? getRarityConfig(selectedItem.品质) : getRarityConfig('Common');

  return (
    <div className="w-full h-full flex flex-col bg-[#050508] relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-surface-overlay/20 to-transparent pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-accent-blue/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex flex-1 overflow-hidden z-10">
            {/* LEFT: Filter & Grid */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-white/5 bg-surface-glass backdrop-blur-sm">
                 {/* Toolbar */}
                 <div className="p-4 border-b border-white/5 flex flex-col gap-4 bg-surface-overlay/50 backdrop-blur-md sticky top-0 z-20">
                     
                     {/* Tabs */}
                     <div className="flex p-1 bg-black/40 rounded-lg border border-white/5 relative">
                         <button 
                             onClick={() => { setActiveTab('BACKPACK'); setSelectedItem(null); }}
                             className={clsx(
                                 "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-md relative z-10",
                                 activeTab === 'BACKPACK' ? "text-white bg-white/10 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                             )}
                         >
                             背包 ({items?.length || 0})
                         </button>
                         <button 
                             onClick={() => { setActiveTab('PUBLIC_LOOT'); setSelectedItem(null); }}
                             className={clsx(
                                 "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-md relative z-10",
                                 activeTab === 'PUBLIC_LOOT' ? "text-amber-200 bg-amber-900/40 shadow-sm" : "text-zinc-500 hover:text-amber-200/60"
                             )}
                         >
                             公共战利品 ({publicLoot?.length || 0})
                         </button>
                         <button 
                             onClick={() => { setActiveTab('LOOT_VAULT'); setSelectedItem(null); }}
                             className={clsx(
                                 "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-md relative z-10",
                                 activeTab === 'LOOT_VAULT' ? "text-purple-200 bg-purple-900/40 shadow-sm" : "text-zinc-500 hover:text-purple-200/60"
                             )}
                         >
                             战利品仓库 ({lootVault?.length || 0})
                         </button>
                     </div>

                     <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" size={14} />
                            <input
                                type="text"
                                placeholder="搜索物品..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-surface-base/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-content-primary focus:border-accent-blue/50 outline-none transition-all placeholder:text-content-muted/50"
                            />
                        </div>
                        {onClose && (
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-content-muted hover:text-content-primary">
                                <X size={18} />
                            </button>
                        )}
                     </div>
                     
                     <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                         {categories.map(cat => (
                             <button
                                key={cat.id}
                                onClick={() => setCategoryFilter(cat.id)}
                                className={clsx(
                                    "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border",
                                    categoryFilter === cat.id 
                                        ? "bg-accent-blue/10 text-accent-blue border-accent-blue/30 shadow-sm" 
                                        : "bg-transparent text-content-muted border-transparent hover:bg-white/5 hover:text-content-secondary"
                                )}
                             >
                                 {cat.label}
                             </button>
                         ))}
                     </div>
                 </div>

                 {/* Grid Content */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-4 relative">
                     {filteredItems.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-20">
                            {filteredItems.map(item => (
                                <InventoryItemCard 
                                    key={item.id} 
                                    item={item} 
                                    isSelected={selectedItem?.id === item.id}
                                    onClick={() => setSelectedItem(item)}
                                    variant="grid"
                                />
                            ))}
                        </div>
                     ) : (
                         <div className="absolute inset-0 flex flex-col items-center justify-center text-content-muted opacity-40">
                            <Package size={64} strokeWidth={1} className="mb-4" />
                            <span className="text-xs font-bold uppercase tracking-[0.2em]">背包为空</span>
                         </div>
                     )}
                 </div>
                 
                 {/* Footer Status */}
                 <div className="px-6 py-3 border-t border-white/5 bg-surface-base/80 backdrop-blur text-[10px] text-content-muted font-mono flex justify-between items-center">
                     <div className="flex gap-6">
                        <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
                            <span>法利: 0</span>
                        </span>
                        <span className="flex items-center gap-2">
                            <span className={clsx("w-1.5 h-1.5 rounded-full", filteredItems.length > 90 ? "bg-accent-red" : "bg-accent-green")} />
                            <span>容量: {filteredItems.length} / 100</span>
                        </span>
                     </div>
                 </div>
            </div>

            {/* RIGHT: Detail Inspector (Sidebar) */}
            <div className={clsx(
                "w-96 shrink-0 bg-surface-base border-l border-white/5 flex flex-col overflow-y-auto custom-scrollbar relative transition-all duration-300",
                selectedItem ? "translate-x-0" : "translate-x-full hidden md:flex md:translate-x-0" // Hide on mobile if no selection
            )}>
                 {selectedItem ? (
                     <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                         {/* 3D Item Showcase Area */}
                         <div className="h-64 relative flex items-center justify-center overflow-hidden bg-gradient-to-b from-surface-overlay to-surface-base">
                             <div className={clsx("absolute inset-0 opacity-20", rarity.bg)} />
                             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),transparent_70%)]" />
                             
                             {/* Rotating/Floating Icon Container */}
                             <div className="relative z-10 scale-[2.5] drop-shadow-2xl transition-transform duration-700 animate-float">
                                 {getItemIcon(selectedItem, 64, rarity.text)}
                             </div>

                             {/* Rarity Badge */}
                             <div className="absolute top-4 left-4">
                                 <span className={clsx(
                                     "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border backdrop-blur-md shadow-lg",
                                     rarity.text, rarity.border, rarity.bg
                                 )}>
                                     {getQualityLabel(selectedItem.品质)}
                                 </span>
                             </div>
                         </div>

                         {/* Info Body */}
                         <div className="flex-1 p-6 space-y-6 bg-surface-base relative">
                             {/* Header */}
                             <div>
                                 <h2 className={clsx("text-2xl font-display font-bold uppercase tracking-wide leading-tight mb-2", rarity.text)}>
                                     {selectedItem.名称}
                                 </h2>
                                 <div className="flex items-center gap-2 text-xs font-bold text-content-muted uppercase tracking-wider">
                                     <span>{getTypeLabel(selectedItem.类型)}</span>
                                     <span className="opacity-30">•</span>
                                     <span>{getQualityLabel(selectedItem.品质)}</span>
                                 </div>
                             </div>

                             <UnifiedItemDetailSections item={selectedItem} />

                             {/* Action Footer */}
                             <div className="pt-6 mt-auto">
                                 {(isWeaponItem(selectedItem) || isArmorItem(selectedItem)) ? (
                                     activeTab === 'BACKPACK' ? (
                                         selectedItem.已装备 ? (
                                            <BaseButton variant="danger" className="w-full" onClick={() => onUnequipItem(getDefaultEquipSlot(selectedItem), selectedItem.名称, selectedItem.id)}>
                                                卸下
                                            </BaseButton>
                                         ) : (
                                            <BaseButton variant="solid" className="w-full" onClick={() => onEquipItem(selectedItem)}>
                                                装备
                                            </BaseButton>
                                         )
                                     ) : (
                                         <div className="text-center text-xs text-zinc-500 py-2 border border-dashed border-zinc-700/50 rounded">
                                             仅背包中的物品可装备
                                         </div>
                                     )
                                 ) : getItemCategory(selectedItem) === 'CONSUMABLE' ? (
                                     activeTab === 'BACKPACK' ? (
                                         <BaseButton variant="glass" className="w-full" onClick={() => onUseItem(selectedItem)}>
                                             使用
                                         </BaseButton>
                                     ) : (
                                         <div className="text-center text-xs text-zinc-500 py-2 border border-dashed border-zinc-700/50 rounded">
                                             仅背包中的物品可使用
                                         </div>
                                     )
                                 ) : null}
                             </div>
                         </div>
                     </div>
                 ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-content-muted opacity-30 p-10 text-center space-y-4">
                         <Filter size={48} strokeWidth={1} />
                         <p className="text-xs font-bold uppercase tracking-widest">选择物品查看详情</p>
                     </div>
                 )}
            </div>
        </div>
    </div>
  );
};


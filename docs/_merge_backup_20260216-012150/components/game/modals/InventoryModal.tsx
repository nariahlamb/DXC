
import React, { useState, useMemo } from 'react';
import { Archive, Search, Package } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { ModalWrapper } from '../../ui/ModalWrapper';
import { InventoryItemCard, getRarityConfig, getItemIcon } from '../InventoryItemCard';
import { getItemCategory, getQualityLabel, getTypeLabel, isWeaponItem, isArmorItem, getDefaultEquipSlot, getQualityRank } from '../../../utils/itemUtils';
import clsx from 'clsx';
import { UnifiedItemDetailSections } from '../UnifiedItemDetailSections';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  equipment: { [key: string]: string };
  onEquipItem: (item: InventoryItem) => void;
  onUnequipItem: (slotKey: string, itemName?: string, itemId?: string) => void;
  onUseItem: (item: InventoryItem) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen, onClose, items, equipment, onEquipItem, onUnequipItem, onUseItem
}) => {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items ? [...items] : [];
    
    // Category Filter
    if (categoryFilter !== 'ALL') {
        result = result.filter(item => getItemCategory(item) === categoryFilter);
    }

    // Search
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
  }, [items, categoryFilter, searchTerm]);

  // CATEGORIES
  const categories = [
      { id: 'ALL', label: '全部' },
      { id: 'WEAPON', label: '武器' },
      { id: 'ARMOR', label: '防具' },
      { id: 'CONSUMABLE', label: '道具' },
      { id: 'MATERIAL', label: '素材' },
      { id: 'KEY_ITEM', label: '关键' },
      { id: 'LOOT', label: '掉落' },
  ];

  const rarity = selectedItem ? getRarityConfig(selectedItem.品质) : getRarityConfig('Common');

  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title="物品清单"
        icon={<Archive size={20} />}
        size="xl"
        theme="guild"
        className="flex flex-col h-[80vh]"
    >
        <div className="flex flex-1 overflow-hidden">
            {/* LEFT: Inventory Grid */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#050508] relative border-r border-white/5">
                 {/* Toolbar */}
                 <div className="p-4 border-b border-white/5 flex items-center justify-between gap-4 bg-zinc-950/50">
                     <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                        <input 
                            type="text" 
                            placeholder="搜索物品..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded pl-9 pr-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-800 transition-colors"
                        />
                     </div>
                     <div className="flex gap-1 overflow-x-auto no-scrollbar">
                         {categories.map(cat => (
                             <button
                                key={cat.id}
                                onClick={() => setCategoryFilter(cat.id)}
                                className={clsx(
                                    "px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border",
                                    categoryFilter === cat.id 
                                        ? "bg-cyan-900/40 text-cyan-200 border-cyan-800" 
                                        : "bg-transparent text-zinc-500 border-transparent hover:bg-white/5"
                                )}
                             >
                                 {cat.label}
                             </button>
                         ))}
                     </div>
                 </div>

                 {/* Grid Content */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                     {filteredItems.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pr-2">
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
                         <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <Package size={48} className="text-zinc-600 mb-2" />
                            <span className="text-xs uppercase tracking-widest text-zinc-500">
                                {searchTerm ? '没有找到物品' : '背包为空'}
                            </span>
                         </div>
                     )}
                 </div>
                 
                 {/* Footer Status */}
                 <div className="p-2 border-t border-white/5 bg-zinc-950/80 text-[10px] text-zinc-600 font-mono flex justify-between px-4">
                     <span>FUNDS: 0 Valis</span>
                     <span>SLOTS: {items.length} / 100</span>
                 </div>
            </div>

            {/* RIGHT: Detail View (Sidebar) */}
            <div className="w-80 shrink-0 bg-zinc-950 border-l border-white/5 flex flex-col overflow-y-auto custom-scrollbar relative">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.03),transparent_40%)] pointer-events-none" />
                 
                 {selectedItem ? (
                     <div className="p-6 flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
                         {/* Header */}
                         <div className="text-center relative">
                             <div className="w-32 h-32 mx-auto mb-6 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm relative z-10" style={{ boxShadow: rarity.glow }}>
                                 <div className={clsx("absolute inset-0 rounded-full opacity-20 animate-pulse", rarity.bg)} />
                                 <div className="relative z-10 drop-shadow-2xl scale-125">
                                     {getItemIcon(selectedItem, 64, rarity.text)}
                                 </div>
                             </div>
                             
                             <h2 className={clsx("text-2xl font-bold font-display uppercase tracking-widest mb-2 drop-shadow-lg", rarity.text)}>
                                 {selectedItem.名称}
                             </h2>
                             
                             <div className="flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                                 <span className={clsx("px-2 py-0.5 rounded-full border bg-black/60 backdrop-blur-md shadow-lg border-current", rarity.text)}>
                                     {getQualityLabel(selectedItem.品质)}
                                 </span>
                                 <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                 <span className="text-zinc-400">{getTypeLabel(selectedItem.类型)}</span>
                             </div>
                         </div>

                         {/* Actions */}
                         <div className="grid grid-cols-1 gap-3 px-4">
                             {(isWeaponItem(selectedItem) || isArmorItem(selectedItem)) && (
                                 selectedItem.已装备 ? (
                                    <button 
                                        onClick={() => onUnequipItem(getDefaultEquipSlot(selectedItem), selectedItem.名称, selectedItem.id)}
                                        className="relative group w-full py-3 overflow-hidden bg-red-950/40 border border-red-500/30 hover:border-red-400/60 text-red-200 transition-all uppercase text-xs font-bold tracking-[0.15em]"
                                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-900/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                        <span className="relative z-10 drop-shadow-md group-hover:text-white transition-colors">卸下装备</span>
                                    </button>
                                 ) : (
                                    <button 
                                        onClick={() => onEquipItem(selectedItem)}
                                        className="relative group w-full py-3 overflow-hidden bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-200 transition-all uppercase text-xs font-bold tracking-[0.15em] shadow-[0_0_20px_rgba(6,182,212,0.1)] hover:shadow-[0_0_30px_rgba(6,182,212,0.2)]"
                                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-cyan-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                        <span className="relative z-10 drop-shadow-md group-hover:text-white transition-colors">装备</span>
                                    </button>
                                 )
                             )}
                             {getItemCategory(selectedItem) === 'CONSUMABLE' && (
                                 <button 
                                    onClick={() => onUseItem(selectedItem)}
                                    className="relative group w-full py-3 overflow-hidden bg-indigo-950/40 border border-indigo-500/30 hover:border-indigo-400/60 text-indigo-200 transition-all uppercase text-xs font-bold tracking-[0.15em] shadow-[0_0_20px_rgba(99,102,241,0.1)]"
                                    style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}
                                 >
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-indigo-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <span className="relative z-10 drop-shadow-md group-hover:text-white transition-colors">使用物品</span>
                                 </button>
                             )}
                         </div>

                         <div className="space-y-6 px-2">
                            <UnifiedItemDetailSections item={selectedItem} />
                        </div>
                     </div>
                 ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 gap-4 opacity-50 p-10 text-center">
                         <Search size={48} strokeWidth={1} />
                         <p className="text-sm uppercase tracking-widest">选择物品查看详情</p>
                     </div>
                 )}
            </div>
        </div>
    </ModalWrapper>
  );
};

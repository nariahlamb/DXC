import React, { useState, useMemo } from 'react';
import { Package, Sword, Shield, Box, Gem, ArrowRightCircle, LogOut, Beaker, Leaf, Zap, Tag, Clock, AlertTriangle, Hammer, X } from 'lucide-react';
import { InventoryItem } from '../../types';
import { getItemCategory, getDefaultEquipSlot, getTypeLabel, getQualityLabel, normalizeQuality, isWeaponItem, isArmorItem } from '../../utils/itemUtils';

interface MobileInventoryViewProps {
  items: InventoryItem[];
  equipment: { [key: string]: string };
  onEquipItem: (item: InventoryItem) => void;
  onUnequipItem: (slotKey: string, itemName?: string, itemId?: string) => void;
  onUseItem: (item: InventoryItem) => void;
}

// --- Styled Components ---

const RarityBadge = ({ quality }: { quality: string }) => {
  const config = getRarityConfig(quality);
  return (
    <span className={`px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider border ${config.border} ${config.bg} ${config.text} transform -skew-x-12 inline-block`}>
      {getQualityLabel(quality)}
    </span>
  );
};

const StatRow = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
    <span className="text-zinc-500 text-[10px] uppercase tracking-widest">{label}</span>
    <span className="text-cyan-100 font-mono text-xs text-right break-words max-w-[70%]">{value}</span>
  </div>
);

const SectionHeader = ({ title, icon }: { title: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-1.5 mb-1.5 mt-3 pb-1 border-b border-blue-900/50 first:mt-0">
    {icon && <span className="text-blue-500">{icon}</span>}
    <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">{title}</h4>
  </div>
);

const DurabilityBar = ({ current, max }: { current: number; max: number }) => {
  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  const color = percent < 25 ? 'bg-red-500' : percent < 50 ? 'bg-yellow-500' : 'bg-green-500';
  
  return (
    <div className="w-full mt-2">
      <div className="flex justify-between text-[8px] uppercase tracking-wider text-zinc-500 font-mono mb-0.5">
        <span>耐久度</span>
        <span>{current}/{max}</span>
      </div>
      <div className="h-1 w-full bg-zinc-800 skew-x-[-12deg] overflow-hidden border border-zinc-700">
        <div 
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

// --- Helper Functions ---

const getRarityConfig = (quality: string = 'Common') => {
  switch(normalizeQuality(quality)) {
    case 'Legendary': return { border: 'border-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-900/20' };
    case 'Epic': return { border: 'border-purple-400', text: 'text-purple-300', bg: 'bg-purple-900/20' };
    case 'Rare': return { border: 'border-cyan-400', text: 'text-cyan-300', bg: 'bg-cyan-900/20' };
    case 'Broken': return { border: 'border-red-500', text: 'text-red-400', bg: 'bg-red-950/20' };
    default: return { border: 'border-blue-800', text: 'text-blue-200', bg: 'bg-blue-900/10' };
  }
};

const getItemIcon = (item: InventoryItem, size: number = 20) => {
  const category = getItemCategory(item);
  switch(category) {
    case 'WEAPON': return <Sword size={size} />;
    case 'ARMOR': return <Shield size={size} />;
    case 'LOOT': return <Gem size={size} />;
    case 'CONSUMABLE': return <Beaker size={size} />;
    case 'MATERIAL': return <Leaf size={size} />;
    case 'KEY_ITEM': return <Box size={size} />;
    default: return <Package size={size} />;
  }
};

export const MobileInventoryView: React.FC<MobileInventoryViewProps> = ({
  items,
  equipment,
  onEquipItem,
  onUnequipItem,
  onUseItem
}) => {
  const [filter, setFilter] = useState<'ALL' | 'WEAPON' | 'ARMOR' | 'CONSUMABLE' | 'MATERIAL'>('ALL');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const allItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    const safeEquipment = equipment || {};

    const equippedList: InventoryItem[] = [];
    Object.entries(safeEquipment).forEach(([slot, itemName]) => {
      if (itemName) {
        const existsInInventory = safeItems.some(i => i.名称 === itemName);
        if (!existsInInventory) {
          equippedList.push({
            id: `equipped-${slot}`,
            名称: itemName as string,
            描述: '当前已装备',
            数量: 1,
            类型: slot === '主手' || slot === '副手' ? 'weapon' : 'armor',
            品质: 'Common',
            已装备: true,
            装备槽位: slot
          });
        }
      }
    });
    return [...safeItems, ...equippedList];
  }, [items, equipment]);

  const filteredItems = useMemo(() => {
    if (filter === 'ALL') return allItems;
    return allItems.filter(i => getItemCategory(i) === filter);
  }, [allItems, filter]);

  const LABELS = {
    'ALL': '全部',
    'WEAPON': '武器',
    'ARMOR': '防具',
    'CONSUMABLE': '消耗品',
    'MATERIAL': '材料'
  };

  const toggleExpand = (id: string) => {
    setExpandedItemId(prev => prev === id ? null : id);
  };

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10" />
         <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400" />
      </div>

      {/* Filter Tabs */}
      <div className="relative z-10 flex overflow-x-auto bg-black/80 border-b border-blue-900 shrink-0 no-scrollbar py-2 px-2 gap-2">
        {(['ALL', 'WEAPON', 'ARMOR', 'CONSUMABLE', 'MATERIAL'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setExpandedItemId(null); }}
            className={`px-4 py-2 text-[10px] font-bold uppercase whitespace-nowrap transition-all transform skew-x-[-10deg] border border-transparent
              ${filter === f 
                ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]' 
                : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-blue-800 hover:text-blue-400'
              }
            `}
          >
            <span className="block transform skew-x-[10deg]">{LABELS[f]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-3 pb-24 custom-scrollbar">
        {filteredItems.length > 0 ? filteredItems.map(item => {
          const isExpanded = expandedItemId === item.id;
          const rarity = getRarityConfig(item.品质 || 'Common');
          const hasDurability = item.耐久 !== undefined && item.最大耐久 !== undefined;
          
          return (
            <div 
              key={item.id}
              className={`group relative border transition-all duration-200 overflow-hidden
                ${isExpanded 
                  ? `bg-black/90 border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.2)]` 
                  : `bg-zinc-900/60 border-zinc-800 hover:border-zinc-600`
                }
              `}
            >
              {/* Item Header (Always Visible) */}
              <div 
                className="flex items-center p-3 gap-3 cursor-pointer"
                onClick={() => toggleExpand(item.id)}
              >
                <div className={`w-10 h-10 flex items-center justify-center border ${rarity.border} bg-black/50 ${rarity.text} relative shrink-0`}>
                  {getItemIcon(item, 20)}
                </div>
                
                <div className="flex-1 min-w-0">
                   <div className="flex justify-between items-start">
                      <h4 className={`font-bold text-sm truncate uppercase font-display tracking-wide ${isExpanded ? 'text-white' : 'text-zinc-300'}`}>
                        {item.名称}
                      </h4>
                      {item.数量 > 1 && <span className="text-[10px] text-zinc-400 font-mono">x{item.数量}</span>}
                   </div>
                   <div className="flex items-center gap-2 mt-1">
                      <RarityBadge quality={item.品质 || 'Common'} />
                      {item.已装备 && <span className="text-[9px] text-black font-bold bg-cyan-500 px-1 uppercase">已装备</span>}
                      <span className="text-[9px] text-zinc-500 uppercase">{getTypeLabel(item.类型)}</span>
                   </div>
                   
                   {/* Durability Bar Preview */}
                   {!isExpanded && hasDurability && item.最大耐久 && (
                      <div className="mt-1 h-0.5 w-16 bg-zinc-800">
                         <div 
                           className={`h-full ${((item.耐久 || 0) / item.最大耐久) < 0.25 ? 'bg-red-500' : 'bg-green-500'}`} 
                           style={{ width: `${((item.耐久 || 0) / item.最大耐久) * 100}%` }} 
                         />
                      </div>
                   )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-3 pb-3 animate-in slide-in-from-top-2 duration-200">
                  {hasDurability && item.最大耐久 && (
                      <div className="mb-3">
                          <DurabilityBar current={item.耐久 || 0} max={item.最大耐久} />
                      </div>
                  )}

                  <p className="text-xs text-cyan-200/70 italic font-serif border-l-2 border-cyan-500/30 pl-2 mb-3 leading-relaxed">
                    “{item.描述}”
                  </p>

                  <div className="bg-black/40 p-2 rounded border border-white/5 space-y-2">
                      
                      {/* Basic & Combat */}
                      <SectionHeader title="基础参数" icon={<Tag size={10} />} />
                      {(item.攻击力 || item.防御力) && (
                        <>
                           {item.攻击力 && <StatRow label="攻击力" value={item.攻击力} />}
                           {item.防御力 && <StatRow label="防御力" value={item.防御力} />}
                        </>
                      )}
                      <StatRow label="价值" value={item.价值 ? `${item.价值} G` : '-'} />
                      <StatRow label="重量" value={item.重量 || '-'} />

                      {/* Weapon Specific */}
                      {item.武器 && (
                        <>
                           <SectionHeader title="武器详情" icon={<Sword size={10} />} />
                           <StatRow label="伤害类型" value={item.武器.伤害类型 || '-'} />
                           <StatRow label="射程" value={item.武器.射程 || '-'} />
                           <StatRow label="特性" value={Array.isArray(item.武器.特性) ? item.武器.特性.join(', ') : (item.武器.特性 || '-')} />
                        </>
                      )}

                      {/* Armor Specific */}
                      {item.防具 && (
                         <>
                            <SectionHeader title="防具详情" icon={<Shield size={10} />} />
                            <StatRow label="护甲等级" value={item.防具.护甲等级 || '-'} />
                            <StatRow label="抗性" value={Array.isArray(item.防具.抗性) ? item.防具.抗性.join(', ') : (item.防具.抗性 || '-')} />
                         </>
                      )}

                      {/* Magic Sword Specific */}
                      {item.魔剑 && (
                         <>
                            <SectionHeader title="魔剑属性" icon={<Zap size={10} />} />
                            <StatRow label="魔法名称" value={item.魔剑.魔法名称 || '-'} />
                            <StatRow label="威力" value={item.魔剑.威力 || '-'} />
                            <StatRow label="剩余次数" value={`${item.魔剑.剩余次数}/${item.魔剑.最大次数}`} />
                            <StatRow label="破损率" value={typeof item.魔剑.破损率 === 'number' ? `${item.魔剑.破损率}%` : item.魔剑.破损率 || '-'} />
                         </>
                      )}

                      {/* Consumable Specific */}
                      {item.消耗 && (
                        <>
                           <SectionHeader title="消耗属性" icon={<Beaker size={10} />} />
                           <StatRow label="持续" value={item.消耗.持续 || '-'} />
                           <StatRow label="冷却" value={item.消耗.冷却 || '-'} />
                           <StatRow label="副作用" value={item.消耗.副作用 || '-'} />
                        </>
                      )}

                      {/* Material Specific */}
                      {item.材料 && (
                        <>
                           <SectionHeader title="材料信息" icon={<Hammer size={10} />} />
                           <StatRow label="来源" value={item.材料.来源 || '-'} />
                           <StatRow label="用途" value={item.材料.用途 || '-'} />
                        </>
                      )}

                      {/* Effects */}
                      {(item.效果 || item.攻击特效 || item.防御特效) && (
                        <>
                           <SectionHeader title="特效" icon={<Zap size={10} />} />
                           {item.效果 && <p className="text-[10px] text-zinc-400">{item.效果}</p>}
                           {item.攻击特效 && <p className="text-[10px] text-red-400">[攻] {item.攻击特效}</p>}
                           {item.防御特效 && <p className="text-[10px] text-blue-400">[防] {item.防御特效}</p>}
                        </>
                      )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800">
                    {(isWeaponItem(item) || isArmorItem(item)) && (
                      item.已装备 ? (
                         <button 
                          onClick={(e) => { e.stopPropagation(); onUnequipItem(getDefaultEquipSlot(item), item.名称, item.id); }}
                          className="flex-1 py-3 bg-yellow-600 text-black font-bold uppercase text-xs flex items-center justify-center gap-1 hover:bg-yellow-500 shadow-lg"
                         >
                           <LogOut size={14} /> 卸下
                         </button>
                      ) : (
                         <button 
                          onClick={(e) => { e.stopPropagation(); onEquipItem(item); }}
                          className="flex-1 py-3 bg-cyan-600 text-black font-bold uppercase text-xs flex items-center justify-center gap-1 hover:bg-cyan-500 shadow-lg"
                         >
                           <Shield size={14} /> 装备
                         </button>
                      )
                    )}

                    {getItemCategory(item) === 'CONSUMABLE' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUseItem(item); }}
                        className="flex-1 py-3 bg-green-600 text-black font-bold uppercase text-xs flex items-center justify-center gap-1 hover:bg-green-500 shadow-lg"
                      >
                        <ArrowRightCircle size={14} /> 使用
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="flex flex-col items-center justify-center py-20 text-blue-900/50">
            <Package size={48} className="mb-2" />
            <span className="uppercase font-display tracking-widest text-sm">背包为空</span>
          </div>
        )}
      </div>
    </div>
  );
};
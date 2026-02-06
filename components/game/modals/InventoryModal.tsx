import React, { useState, useMemo, useEffect } from 'react';
import { Package, Shield, Sword, Box, Gem, ArrowRightCircle, LogOut, Beaker, Leaf, Moon, X, Crosshair, Zap, Anchor, Clock, AlertTriangle, Hammer, Tag } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { getItemCategory, getDefaultEquipSlot, getTypeLabel, normalizeQuality, getQualityLabel, isWeaponItem, isArmorItem } from '../../../utils/itemUtils';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  equipment: { [key: string]: string }; 
  initialTab?: string;
  onEquipItem: (item: InventoryItem) => void;
  onUnequipItem: (slotKey: string, itemName?: string, itemId?: string) => void;
  onUseItem: (item: InventoryItem) => void;
}

// --- Utility Components ---

const RarityBadge = ({ quality }: { quality: string }) => {
  const config = getRarityConfig(quality);
  return (
    <div className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider border ${config.border} ${config.bg} ${config.text} transform -skew-x-12 shadow-sm`}>
      {getQualityLabel(quality)}
    </div>
  );
};

const StatRow = ({ label, value, icon }: { label: string; value: string | number | undefined; icon?: React.ReactNode }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors px-2">
      <div className="flex items-center gap-2">
        {icon && <span className="text-zinc-500">{icon}</span>}
        <span className="text-zinc-500 text-xs uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-cyan-100 font-mono text-sm text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
};

const SectionHeader = ({ title, subTitle, icon }: { title: string; subTitle?: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-2 mt-4 pb-1 border-b-2 border-blue-900/50">
    {icon && <span className="text-blue-500">{icon}</span>}
    <div>
      <h4 className="text-sm font-bold text-blue-400">{title}</h4>
      {subTitle && <div className="text-[9px] uppercase font-bold text-blue-900 tracking-[0.2em] leading-none">{subTitle}</div>}
    </div>
  </div>
);

const DurabilityBar = ({ current, max }: { current: number; max: number }) => {
  const percent = Math.max(0, Math.min(100, (current / max) * 100));
  const color = percent < 25 ? 'bg-red-500' : percent < 50 ? 'bg-yellow-500' : 'bg-green-500';
  
  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-[9px] uppercase tracking-wider text-zinc-500 font-mono">
        <span>耐久度 Durability</span>
        <span>{current} / {max}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 skew-x-[-12deg] overflow-hidden border border-zinc-700">
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
    case 'Legendary': return { border: 'border-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-900/40', shadow: 'shadow-yellow-500/50' };
    case 'Epic': return { border: 'border-purple-400', text: 'text-purple-300', bg: 'bg-purple-900/40', shadow: 'shadow-purple-500/50' };
    case 'Rare': return { border: 'border-cyan-400', text: 'text-cyan-300', bg: 'bg-cyan-900/40', shadow: 'shadow-cyan-500/50' };
    case 'Broken': return { border: 'border-red-500', text: 'text-red-400', bg: 'bg-red-950/40', shadow: 'shadow-red-500/50' };
    case 'Pristine': return { border: 'border-white', text: 'text-white', bg: 'bg-zinc-800', shadow: 'shadow-white/20' };
    default: return { border: 'border-blue-800', text: 'text-blue-200', bg: 'bg-blue-900/20', shadow: 'shadow-blue-900/30' };
  }
};

const getItemIcon = (item: InventoryItem, size: number = 24) => {
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

// --- Main Component ---

export const InventoryModal: React.FC<InventoryModalProps> = ({ 
  isOpen, 
  onClose, 
  items, 
  equipment,
  initialTab = 'ALL',
  onEquipItem,
  onUnequipItem,
  onUseItem
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Merge equipped items logic 
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

  const TAB_LABELS: Record<string, string> = {
    'ALL': '全部',
    'WEAPON': '武器',
    'ARMOR': '防具',
    'CONSUMABLE': '消耗品',
    'MATERIAL': '材料',
    'KEY_ITEM': '关键物品',
    'LOOT': '战利品',
    'OTHER': '杂项'
  };

  const categories = useMemo(() => {
    const cats = new Set<string>(['ALL']);
    allItems.forEach(item => {
      cats.add(getItemCategory(item));
    });
    return Array.from(cats);
  }, [allItems]);

  // Filter items
  const filteredItems = useMemo(() => {
    let filtered = allItems;
    if (activeTab !== 'ALL') {
      filtered = allItems.filter(i => getItemCategory(i) === activeTab);
    }
    return filtered.sort((a, b) => {
      if (a.已装备 !== b.已装备) return a.已装备 ? -1 : 1;
      return 0;
    });
  }, [allItems, activeTab]);

  // Update selected item when list changes
  useEffect(() => {
    if (isOpen) {
      if (filteredItems.length > 0) {
         // Keep selection if it exists in new list, otherwise select first
         const stillExists = filteredItems.find(i => i.id === selectedItemId);
         if (!stillExists) setSelectedItemId(filteredItems[0].id);
      } else {
        setSelectedItemId(null);
      }
    }
  }, [isOpen, activeTab, filteredItems]);

  const selectedItem = useMemo(() => 
    allItems.find(i => i.id === selectedItemId) || null
  , [allItems, selectedItemId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 lg:p-12 animate-in fade-in duration-300">
      {/* Main Container - P5 Style skewed box */}
      <div className="w-full h-full max-w-[1600px] flex relative overflow-hidden bg-zinc-950 border-2 border-blue-900 shadow-[0_0_100px_rgba(30,58,138,0.3)]">
        
        {/* Background Decor */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-50%] right-[-20%] w-full h-[200%] bg-blue-900/10 transform -rotate-12 transform-origin-center" />
          <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-cyan-400 to-transparent" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 blur-[100px] rounded-full" />
          {/* Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(30,58,138,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,138,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        {/* Global Close Button (Top Right) - Re-positioned to avoid overlap */}
        <div className="absolute top-0 right-0 p-4 z-[100]">
           <button 
               onClick={onClose} 
               className="p-2 bg-zinc-900/90 border-2 border-red-500/80 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all transform hover:scale-110 hover:rotate-90 duration-300 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.3)] group"
               title="关闭"
           >
               <X size={20} strokeWidth={3} className="group-hover:scale-125 transition-transform" />
           </button>
        </div>

        {/* --- LEFT COLUMN: CATEGORIES --- */}
        <div className="w-64 flex-shrink-0 flex flex-col z-10 border-r border-blue-900/50 bg-black/60 backdrop-blur-md relative">
          {/* Header */}
          <div className="p-8 pb-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500" />
            <h2 className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-blue-400 transform -skew-x-12">
              ITEM
            </h2>
            <div className="text-xs font-mono text-cyan-500 tracking-[0.5em] ml-1 mt-1 uppercase">
              物品 / Inventory
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-1 overflow-y-auto custom-scrollbar py-6 space-y-1">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`w-full group relative h-14 flex items-center px-8 transition-all duration-300 outline-none
                  ${activeTab === cat ? 'translate-x-4' : 'hover:translate-x-2'}
                `}
              >
                {/* Active Background Shape */}
                <div className={`absolute inset-0 transform -skew-x-12 transition-all duration-300 origin-left
                  ${activeTab === cat 
                    ? 'bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.5)] scale-x-100 opacity-100' 
                    : 'bg-zinc-800 scale-x-0 opacity-0 group-hover:opacity-50 group-hover:scale-x-75'}
                `} />
                
                <span className={`relative z-10 font-black italic text-xl uppercase tracking-wider transition-colors duration-200
                  ${activeTab === cat ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}
                `}>
                  {TAB_LABELS[cat] || cat}
                </span>
              </button>
            ))}
          </div>

          {/* Footer Decor */}
          <div className="p-6 opacity-30 pointer-events-none">
             <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-900 to-transparent" />
             <div className="text-[10px] font-mono text-center text-blue-900 mt-2 tracking-widest">PHANTOM SYSTEM</div>
          </div>
        </div>

        {/* --- MIDDLE COLUMN: ITEM LIST --- */}
        <div className="flex-1 flex flex-col min-w-0 z-10 bg-gradient-to-b from-black/40 to-black/80">
          {/* List Header */}
          <div className="h-16 flex items-center px-8 border-b border-white/10">
            <div className="flex items-center gap-2 text-zinc-400 font-mono text-sm">
              <Crosshair size={14} />
              <span>选择物品 // {filteredItems.length} ITEMS FOUND</span>
            </div>
          </div>

          {/* Items Grid/List */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {filteredItems.map(item => {
                const isSelected = selectedItemId === item.id;
                const rarity = getRarityConfig(item.品质 || 'Common');
                
                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`group relative h-20 flex items-center gap-4 px-4 cursor-pointer transition-all duration-200 border-l-4 overflow-hidden
                      ${isSelected 
                        ? 'bg-gradient-to-r from-blue-900/80 to-transparent border-cyan-400 translate-x-2' 
                        : 'bg-black/40 hover:bg-white/5 border-zinc-800 hover:border-zinc-600'}
                    `}
                  >
                    {/* Selection Highlight */}
                    {isSelected && <div className="absolute inset-0 bg-cyan-400/5 animate-pulse" />}

                    {/* Icon Box */}
                    <div className={`w-12 h-12 flex items-center justify-center border ${rarity.border} bg-black/50 ${rarity.text} relative z-10`}>
                      {getItemIcon(item, 24)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 z-10">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-bold uppercase tracking-wide truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                          {item.名称}
                        </h4>
                        {item.已装备 && (
                          <span className="px-1.5 py-0.5 bg-cyan-900 text-cyan-200 text-[9px] font-bold uppercase tracking-wider border border-cyan-700">
                            已装备
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="text-xs font-mono text-zinc-500">x{item.数量}</span>
                         <span className="text-[10px] text-zinc-600 uppercase border border-zinc-800 px-1">{getTypeLabel(item.类型)}</span>
                         {item.耐久 !== undefined && (
                            <span className={`text-[10px] uppercase px-1 border ${item.耐久 > 0 ? 'text-zinc-500 border-zinc-700' : 'text-red-500 border-red-800'}`}>
                                {item.耐久 <= 0 ? '损坏' : `${Math.floor((item.耐久 / (item.最大耐久 || 100)) * 100)}%`}
                            </span>
                         )}
                      </div>
                    </div>

                    {/* Arrow Indicator for selection */}
                    <div className={`opacity-0 transition-opacity transform -rotate-45 ${isSelected ? 'opacity-100' : 'group-hover:opacity-50'}`}>
                      <ArrowRightCircle className="text-cyan-500" size={20} />
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-30">
                   <Package size={64} className="mx-auto mb-4 text-blue-500" />
                   <p className="text-2xl font-black italic text-blue-200">背包为空</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: DETAILS --- */}
        <div className="w-[450px] flex-shrink-0 bg-zinc-900/95 border-l border-blue-900/50 flex flex-col z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] relative">
          {selectedItem ? (
            <>
              {/* Item Preview Header */}
              {/* Reduced height and icon size to avoid blocking, also padding-top added for close button clearance */}
              <div className="relative h-56 bg-black flex items-center justify-center overflow-hidden border-b-4 border-blue-600">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-20" />
                 <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent" />
                 
                 {/* Main Icon Circle - Reduced Size */}
                 <div className={`relative z-10 p-6 rounded-full border-4 ${getRarityConfig(selectedItem.品质).border} bg-zinc-900/80 shadow-[0_0_50px_rgba(30,58,138,0.5)] animate-in zoom-in duration-500`}>
                    <div className={getRarityConfig(selectedItem.品质).text}>
                      {getItemIcon(selectedItem, 48)}
                    </div>
                 </div>

                 {/* Rarity Badge - Moved to Top Left to balance */}
                 <div className="absolute top-4 left-4">
                    <RarityBadge quality={selectedItem.品质 || 'Common'} />
                 </div>
                 
                 <div className="absolute bottom-4 left-4 right-4">
                    {selectedItem.最大耐久 && (
                        <DurabilityBar current={selectedItem.耐久 || 0} max={selectedItem.最大耐久} />
                    )}
                 </div>
              </div>

              {/* Item Info Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <div>
                  <h3 className="text-3xl font-black uppercase italic tracking-wide text-white leading-tight mb-2 drop-shadow-lg">
                    {selectedItem.名称}
                  </h3>
                  <p className="text-sm text-cyan-200/70 font-serif italic border-l-2 border-cyan-500/30 pl-3 leading-relaxed">
                    “{selectedItem.描述}”
                  </p>
                </div>

                {/* Basic Info */}
                <div className="bg-black/40 p-4 border border-white/5 rounded-sm">
                   <SectionHeader title="基础信息" subTitle="BASIC INFO" icon={<Tag size={12} />} />
                   <StatRow label="类型" value={getTypeLabel(selectedItem.类型)} />
                   <StatRow label="堆叠" value={selectedItem.堆叠上限 || 99} />
                   <StatRow label="重量" value={selectedItem.重量} />
                   <StatRow label="价值" value={selectedItem.价值 ? `${selectedItem.价值} G` : undefined} />
                   <StatRow label="来源" value={selectedItem.来源} />
                   <StatRow label="制作者" value={selectedItem.制作者} />
                   <StatRow label="材质" value={selectedItem.材质} />
                </div>

                {/* Combat Stats */}
                {(selectedItem.攻击力 || selectedItem.防御力 || selectedItem.恢复量) && (
                   <div className="bg-black/40 p-4 border border-white/5 rounded-sm">
                       <SectionHeader title="战斗数值" subTitle="STATS" icon={<Sword size={12} />} />
                       <StatRow label="攻击力" value={selectedItem.攻击力} icon={<Sword size={10} />} />
                       <StatRow label="防御力" value={selectedItem.防御力} icon={<Shield size={10} />} />
                       <StatRow label="恢复量" value={selectedItem.恢复量} icon={<Beaker size={10} />} />
                   </div>
                )}

                {/* Weapon Specific */}
                {selectedItem.武器 && (
                   <div className="bg-black/40 p-4 border border-white/5 rounded-sm">
                       <SectionHeader title="武器详情" subTitle="WEAPON" icon={<Crosshair size={12} />} />
                       <StatRow label="类型" value={selectedItem.武器.类型} />
                       <StatRow label="伤害类型" value={selectedItem.武器.伤害类型} />
                       <StatRow label="射程" value={selectedItem.武器.射程} />
                       <StatRow label="攻速" value={selectedItem.武器.攻速} />
                       <StatRow label="双手" value={selectedItem.武器.双手 ? '是' : '否'} />
                       <StatRow label="特性" value={Array.isArray(selectedItem.武器.特性) ? selectedItem.武器.特性.join(', ') : selectedItem.武器.特性} />
                   </div>
                )}

                {/* Armor Specific */}
                {selectedItem.防具 && (
                   <div className="bg-black/40 p-4 border border-white/5 rounded-sm">
                       <SectionHeader title="防具详情" subTitle="ARMOR" icon={<Shield size={12} />} />
                       <StatRow label="类型" value={selectedItem.防具.类型} />
                       <StatRow label="部位" value={selectedItem.防具.部位} />
                       <StatRow label="护甲等级" value={selectedItem.防具.护甲等级} />
                       <StatRow label="抗性" value={Array.isArray(selectedItem.防具.抗性) ? selectedItem.防具.抗性.join(', ') : selectedItem.防具.抗性} />
                   </div>
                )}

                {/* Magic Sword Specific */}
                {selectedItem.魔剑 && (
                   <div className="bg-black/40 p-4 border border-purple-500/20 rounded-sm">
                       <SectionHeader title="魔剑属性" subTitle="MAGIC SWORD" icon={<Zap size={12} />} />
                       <StatRow label="魔法名称" value={selectedItem.魔剑.魔法名称} />
                       <StatRow label="属性" value={selectedItem.魔剑.属性} />
                       <StatRow label="威力" value={selectedItem.魔剑.威力} />
                       <StatRow label="触发方式" value={selectedItem.魔剑.触发方式} />
                       <StatRow label="次数" value={`${selectedItem.魔剑.剩余次数} / ${selectedItem.魔剑.最大次数}`} />
                       <StatRow label="破损率" value={typeof selectedItem.魔剑.破损率 === 'number' ? `${selectedItem.魔剑.破损率}%` : selectedItem.魔剑.破损率} />
                       <StatRow label="过载惩罚" value={selectedItem.魔剑.过载惩罚} />
                   </div>
                )}

                {/* Consumable Specific */}
                {selectedItem.消耗 && (
                   <div className="bg-black/40 p-4 border border-white/5 rounded-sm">
                       <SectionHeader title="消耗品" subTitle="CONSUMABLE" icon={<Beaker size={12} />} />
                       <StatRow label="类别" value={selectedItem.消耗.类别} />
                       <StatRow label="持续" value={selectedItem.消耗.持续} icon={<Clock size={10} />} />
                       <StatRow label="冷却" value={selectedItem.消耗.冷却} />
                       <StatRow label="副作用" value={selectedItem.消耗.副作用} icon={<AlertTriangle size={10} />} />
                   </div>
                )}

                {/* Material Specific */}
                {selectedItem.材料 && (
                   <div className="bg-black/40 p-4 border border-white/5 rounded-sm">
                       <SectionHeader title="材料信息" subTitle="MATERIAL" icon={<Hammer size={12} />} />
                       <StatRow label="来源" value={selectedItem.材料.来源} />
                       <StatRow label="用途" value={selectedItem.材料.用途} />
                       <StatRow label="处理" value={selectedItem.材料.处理} />
                   </div>
                )}

                {/* Affixes / Effects */}
                {(selectedItem.效果 || selectedItem.攻击特效 || selectedItem.防御特效 || (selectedItem.附加属性 && selectedItem.附加属性.length > 0)) && (
                  <div className="bg-black/40 p-4 border border-white/5 rounded-sm space-y-2">
                    <SectionHeader title="特效与词缀" subTitle="EFFECTS" icon={<Zap size={12} />} />
                    {selectedItem.效果 && <p className="text-xs text-zinc-300">{selectedItem.效果}</p>}
                    {selectedItem.攻击特效 && <p className="text-xs text-red-300">[攻] {selectedItem.攻击特效}</p>}
                    {selectedItem.防御特效 && <p className="text-xs text-blue-300">[防] {selectedItem.防御特效}</p>}
                    
                    {selectedItem.附加属性 && selectedItem.附加属性.map((affix, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                            <span className="text-purple-300">{affix.名称}</span>
                            <span className="text-purple-200">{affix.数值}</span>
                        </div>
                    ))}
                  </div>
                )}
                
                <div className="h-12" /> {/* Spacer */}
              </div>

              {/* Action Bar */}
              <div className="p-6 bg-black border-t border-zinc-800">
                <div className="flex gap-3">
                  {(isWeaponItem(selectedItem) || isArmorItem(selectedItem)) && (
                    selectedItem.已装备 ? (
                       <button 
                        onClick={() => { onUnequipItem(getDefaultEquipSlot(selectedItem), selectedItem.名称, selectedItem.id); }}
                        className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-500 text-black font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 transform skew-x-[-10deg] transition-transform hover:skew-x-[-15deg]"
                       >
                         <LogOut size={16} /> <span>卸下</span>
                       </button>
                    ) : (
                       <button 
                        onClick={() => onEquipItem(selectedItem)}
                        className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-black font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 transform skew-x-[-10deg] transition-transform hover:skew-x-[-15deg]"
                       >
                         <Shield size={16} /> <span>装备</span>
                       </button>
                    )
                  )}

                  {getItemCategory(selectedItem) === 'CONSUMABLE' && (
                    <button 
                      onClick={() => onUseItem(selectedItem)}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-black font-black uppercase tracking-wider text-sm flex items-center justify-center gap-2 transform skew-x-[-10deg] transition-transform hover:skew-x-[-15deg]"
                    >
                      <ArrowRightCircle size={16} /> <span>使用</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-blue-200">
              <Crosshair size={64} className="mb-4 animate-spin-slow" />
              <p className="font-mono uppercase tracking-widest">请选择物品</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
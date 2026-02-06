import React from 'react';
import { X, Gem, Archive, Box, Shield, Sword, Beaker, Leaf, Star, Tag } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { getItemCategory, getTypeLabel, getQualityLabel, normalizeQuality } from '../../../utils/itemUtils';

interface LootModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
}

export const LootModal: React.FC<LootModalProps> = ({ isOpen, onClose, items }) => {
  if (!isOpen) return null;

  const getQualityStyle = (quality: string = 'Common') => {
    switch (normalizeQuality(quality)) {
      case 'Legendary': return { border: 'border-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-900/20' };
      case 'Epic': return { border: 'border-purple-500', text: 'text-purple-300', bg: 'bg-purple-900/20' };
      case 'Rare': return { border: 'border-cyan-500', text: 'text-cyan-300', bg: 'bg-cyan-900/20' };
      case 'Broken': return { border: 'border-red-600', text: 'text-red-400', bg: 'bg-red-950/20' };
      default: return { border: 'border-amber-700', text: 'text-amber-100', bg: 'bg-amber-900/10' };
    }
  };

  const getItemIcon = (itemCategory: string, size: number = 24) => {
    switch (itemCategory) {
      case 'WEAPON': return <Sword size={size} />;
      case 'ARMOR': return <Shield size={size} />;
      case 'CONSUMABLE': return <Beaker size={size} />;
      case 'MATERIAL': return <Leaf size={size} />;
      case 'KEY_ITEM': return <Box size={size} />;
      default: return <Gem size={size} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl h-[85vh] bg-zinc-950 border-2 border-amber-500 relative flex flex-col shadow-[0_0_50px_rgba(245,158,11,0.3)] overflow-hidden">
        
        {/* Background Decor */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
           <div className="absolute top-0 right-[-20%] w-[50%] h-full bg-amber-500/5 transform skew-x-[-12deg]" />
           <div className="absolute bottom-0 left-[-10%] w-[60%] h-full bg-amber-900/5 transform skew-x-[-12deg]" />
           <div className="absolute top-4 left-4 w-32 h-1 bg-amber-500/50" />
        </div>

        {/* Header */}
        <div className="bg-black/80 p-6 flex justify-between items-center border-b-4 border-amber-600 relative z-10 shrink-0">
          <div className="flex items-center gap-6">
            <div className="p-3 bg-amber-600 text-black transform skew-x-[-12deg]">
                <Archive size={32} className="transform skew-x-[12deg]" />
            </div>
            <div>
              <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-[2px_2px_0_rgba(217,119,6,0.8)]">
                  LOOT
              </h2>
              <div className="text-xs font-mono text-amber-500 tracking-[0.5em] uppercase">
                  公共战利品 / Public Stash
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-3 bg-black border-2 border-white hover:bg-white hover:text-black transition-colors rounded-full group"
          >
            <X size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.length > 0 ? items.map((item) => {
              const quality = item.品质 || item.稀有度 || 'Common';
              const style = getQualityStyle(quality);
              const category = getItemCategory(item);
              
              return (
                <div key={item.id} className={`group relative bg-black/60 border-l-4 ${style.border} p-4 flex flex-col gap-3 hover:bg-zinc-900 transition-all hover:-translate-y-1 hover:shadow-lg`}>
                  {/* Top Right Label */}
                  <div className={`absolute top-0 right-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-black border-b border-l border-zinc-800 ${style.text}`}>
                      {getQualityLabel(quality)}
                  </div>

                  <div className="flex gap-4 mt-2">
                    <div className={`w-12 h-12 flex items-center justify-center border ${style.border} ${style.bg} ${style.text} shrink-0`}>
                      {getItemIcon(category, 24)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-sm truncate uppercase font-display tracking-wide ${style.text} group-hover:text-white transition-colors`}>
                          {item.名称}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-zinc-500 uppercase border border-zinc-800 px-1.5">{getTypeLabel(item.类型)}</span>
                          <span className="text-[10px] font-mono text-zinc-400">x{item.数量}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-zinc-400 text-xs italic line-clamp-2 leading-relaxed border-l-2 border-zinc-800 pl-2">
                      “{item.描述}”
                  </p>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[10px] bg-black/40 p-2 border border-zinc-800/50 mt-auto">
                    {item.攻击力 && <div className="flex justify-between text-zinc-400"><span>攻击</span><span className="text-zinc-200">{item.攻击力}</span></div>}
                    {item.防御力 && <div className="flex justify-between text-zinc-400"><span>防御</span><span className="text-zinc-200">{item.防御力}</span></div>}
                    {item.价值 && <div className="flex justify-between text-zinc-400"><span>价值</span><span className="text-amber-400">{item.价值} G</span></div>}
                    {item.等级需求 && <div className="flex justify-between text-zinc-400"><span>Req</span><span className="text-zinc-200">Lv.{item.等级需求}</span></div>}
                  </div>

                  {/* Footer Decoration */}
                  <div className={`h-0.5 w-full mt-2 opacity-20 ${style.bg.replace('/20', '')}`} />
                </div>
              );
            }) : (
              <div className="col-span-full flex flex-col items-center justify-center py-32 text-zinc-600">
                <Archive size={64} className="mb-4 opacity-20" />
                <span className="font-display text-2xl uppercase tracking-widest">暂无战利品</span>
                <span className="text-xs font-mono uppercase mt-2">No Items in Public Loot</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer Info */}
        <div className="bg-black border-t border-amber-900/30 p-2 flex justify-between items-center px-6 shrink-0">
            <div className="text-[10px] text-amber-700 font-mono uppercase tracking-widest">
                Dungeon Explorer System // Loot Distribution
            </div>
            <div className="text-[10px] text-amber-700 font-mono">
                Total Items: {items.length}
            </div>
        </div>

      </div>
    </div>
  );
};
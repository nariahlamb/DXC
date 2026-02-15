import React from 'react';
import { X, Gem, Archive, Box, Shield, Sword, Beaker, Leaf, Star, Sparkles } from 'lucide-react';
import { InventoryItem } from '../../../types';
import { getItemCategory, getTypeLabel, getQualityLabel, normalizeQuality } from '../../../utils/itemUtils';
import { ModalWrapper } from '../../ui/ModalWrapper';
import Icons from '../../../utils/iconMapper';
import clsx from 'clsx';

interface LootModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  carrier?: string;
}

export const LootModal: React.FC<LootModalProps> = ({ isOpen, onClose, items, carrier }) => {
  const getQualityStyle = (quality: string = 'Common') => {
      switch (normalizeQuality(quality)) {
          case 'Legendary': return {
              border: 'border-yellow-500/50',
              text: 'text-yellow-400',
              bg: 'bg-yellow-500/10',
              glow: 'shadow-[0_0_15px_rgba(234,179,8,0.3)]',
              badge: 'bg-yellow-500/20 text-yellow-300'
          };
          case 'Epic': return {
              border: 'border-purple-500/50',
              text: 'text-purple-300',
              bg: 'bg-purple-500/10',
              glow: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]',
              badge: 'bg-purple-500/20 text-purple-200'
          };
          case 'Rare': return {
              border: 'border-cyan-500/50',
              text: 'text-cyan-300',
              bg: 'bg-cyan-500/10',
              glow: 'shadow-[0_0_15px_rgba(34,211,238,0.3)]',
              badge: 'bg-cyan-500/20 text-cyan-200'
          };
          case 'Broken': return {
              border: 'border-red-600/50',
              text: 'text-red-400',
              bg: 'bg-red-900/10',
              glow: 'shadow-[0_0_15px_rgba(220,38,38,0.3)]',
              badge: 'bg-red-500/20 text-red-300'
          };
          default: return {
              border: 'border-slate-700/50',
              text: 'text-slate-300',
              bg: 'bg-slate-800/20',
              glow: 'shadow-none',
              badge: 'bg-slate-700/30 text-slate-400'
          };
      }
  };

  // Category to Icon mapping using the new icon system
  const CATEGORY_ICONS: Record<string, React.ElementType> = {
    WEAPON: Icons.Sword,
    ARMOR: Icons.Shield,
    CONSUMABLE: Icons.Potion,
    MATERIAL: Icons.ItemMaterial,
    KEY_ITEM: Icons.Key,
    LOOT: Icons.Gold,
    DEFAULT: Icons.Backpack
  };

  const getItemIcon = (item: InventoryItem, size = 24, className = '') => {
    // If item has a custom icon URL, use it
    if (item.图标) {
      const iconUrl = item.图标.includes(':') && !item.图标.startsWith('http') 
          ? `https://api.iconify.design/${item.图标}.svg`
          : item.图标;
      return <img src={iconUrl} alt={item.名称} style={{ width: size, height: size }} className={clsx("drop-shadow-md object-contain", className)} />;
    }

    // Otherwise use the new icon system
    const cat = getItemCategory(item);
    const IconComponent = CATEGORY_ICONS[cat] || CATEGORY_ICONS.DEFAULT;
    
    return <IconComponent size={size} className={clsx("drop-shadow-md", className)} />;
  };

  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title="战利品获取"
        icon={<Sparkles size={20} className="text-yellow-400 animate-pulse" />}
        size="m"
        theme="monitor"
        className="flex flex-col"
    >
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-dungeon-black/90">
            {carrier && (
                <div className="text-[10px] font-mono text-hestia-blue-300 mb-4 text-center border-b border-white/5 pb-2 uppercase tracking-widest">
                    Carrier: {carrier}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3">
                {items.length > 0 ? items.map((item) => {
                    const quality = item.品质 || item.稀有度 || 'Common';
                    const style = getQualityStyle(quality);
                    const category = getItemCategory(item);

                    return (
                        <div key={item.id} className={clsx(
                            "relative flex items-center p-3 rounded-lg border transition-all group overflow-hidden",
                            "bg-[#0e1016] hover:bg-[#151720]",
                            style.border,
                            style.glow
                        )}>
                            {/* Rarity BG */}
                            <div className={clsx("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none", style.bg)} />

                            {/* Icon */}
                            <div className={clsx(
                                "w-12 h-12 flex items-center justify-center rounded-lg border bg-black/40 shrink-0 mr-4 transition-transform group-hover:scale-105",
                                style.border
                            )}>
                                 {getItemIcon(item, 24, style.text)}
                            </div>

                            <div className="flex-1 min-w-0 relative z-10">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={clsx("font-display font-bold text-sm truncate", style.text)}>
                                        {item.名称}
                                    </h3>
                                    <span className="text-slate-400 font-mono text-xs bg-white/5 px-2 py-0.5 rounded ml-2">
                                        x{item.数量}
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={clsx("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded", style.badge)}>
                                        {getQualityLabel(quality)}
                                    </span>
                                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                                        {getTypeLabel(item.类型)}
                                    </span>
                                    {item.价值 !== undefined && (
                                        <span className="text-[9px] text-amber-400 font-mono ml-auto">
                                            {item.价值} G
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-600">
                        <Box size={48} className="mb-3 opacity-30" strokeWidth={1} />
                        <span className="font-display text-xs uppercase tracking-[0.2em]">没有战利品</span>
                    </div>
                )}
            </div>
        </div>
    </ModalWrapper>
  );
};
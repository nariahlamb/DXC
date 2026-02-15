import React from 'react';
import { Package } from 'lucide-react';
import { InventoryItem } from '../../types';
import { getItemCategory, normalizeQuality, getTypeLabel, isWeaponItem, isArmorItem, getItemIconName } from '../../utils/itemUtils';
import { getIcon } from '../../utils/iconMapper';
import clsx from 'clsx';

export interface InventoryItemCardProps {
  item: InventoryItem;
  variant?: 'grid' | 'list' | 'compact';
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  showQuantity?: boolean;
}

export const getRarityConfig = (quality?: string) => {
  switch (normalizeQuality(quality)) {
    case 'Legendary': return { 
      border: 'border-accent-gold/50',
      bg: 'bg-accent-gold/10',
      text: 'text-accent-gold',
      glow: 'shadow-[0_0_15px_rgba(251,191,36,0.2)]',
      gradient: 'from-accent-gold/20 via-accent-gold/5 to-transparent'
    };
    case 'Epic': return { 
      border: 'border-purple-500/50',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]',
      gradient: 'from-purple-500/20 via-purple-500/5 to-transparent'
    };
    case 'Rare': return { 
      border: 'border-accent-blue/50',
      bg: 'bg-accent-blue/10',
      text: 'text-accent-blue',
      glow: 'shadow-[0_0_15px_rgba(56,189,248,0.2)]',
      gradient: 'from-accent-blue/20 via-accent-blue/5 to-transparent'
    };
    case 'Broken': return { 
      border: 'border-accent-red/50',
      bg: 'bg-accent-red/10',
      text: 'text-accent-red',
      glow: 'shadow-[0_0_15px_rgba(244,63,94,0.2)]',
      gradient: 'from-accent-red/20 via-accent-red/5 to-transparent'
    };
    default: return { 
      border: 'border-white/10',
      bg: 'bg-white/5',
      text: 'text-content-secondary',
      glow: 'hover:shadow-[0_0_10px_rgba(255,255,255,0.05)]',
      gradient: 'from-white/10 via-white/5 to-transparent'
    };
  }
};

export const getItemIcon = (item: InventoryItem, size = 24, className = '') => {
  if (!item) return <Package size={size} className={className} />;

  // 1. Specific Icon URL defined in item (Highest Priority)
  if (item.图标) {
    if (item.图标.startsWith('http') || item.图标.includes(':')) {
      const iconUrl = item.图标.includes(':') && !item.图标.startsWith('http') 
        ? `https://api.iconify.design/${item.图标}.svg`
        : item.图标;
      return <img src={iconUrl} alt={item.名称} style={{ width: size, height: size }} className={clsx("drop-shadow-md object-contain", className)} />;
    }
  }

  // 2. Use Mapped RPG Icon (via react-icons/gi or lucide)
  const iconName = getItemIconName(item);
  const IconComponent = getIcon(iconName);
  
  if (IconComponent) {
    return <IconComponent size={size} className={clsx("drop-shadow-md", className)} />;
  }

  // 3. Fallback
  return <Package size={size} className={className} />;
};

export const InventoryItemCard: React.FC<InventoryItemCardProps> = React.memo(({
  item,
  variant = 'grid',
  isSelected,
  onClick,
  className,
}) => {
  const rarity = getRarityConfig(item.品质);
  const isEquipped = item.已装备;

  return (
    <div 
      onClick={onClick}
      className={clsx(
        "group relative overflow-hidden transition-all duration-300 cursor-pointer select-none",
        "bg-surface-glass backdrop-blur-sm border",
        // Size & Shape
        variant === 'grid' ? "h-24 rounded-xl flex flex-col" : "h-16 w-full rounded-lg flex items-center",
        // State Styles
        isSelected 
            ? clsx(rarity.border, "bg-surface-overlay translate-y-[-2px]", rarity.glow) 
            : "border-white/5 hover:border-white/20 hover:bg-surface-overlay hover:translate-y-[-2px] hover:shadow-lg",
        className
      )}
    >
      {/* Dynamic Gradient Background (Rarity) */}
      <div className={clsx(
          "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
          rarity.gradient,
          isSelected && "opacity-100"
      )} />

      {/* Equipped Marker (Top Right Corner Ribbon) */}
      {isEquipped && (
          <div className="absolute top-0 right-0 p-1.5 z-10">
              <div className="w-2 h-2 rounded-full bg-accent-blue shadow-[0_0_8px_rgba(56,189,248,0.8)] animate-pulse" />
          </div>
      )}

      {/* Content Container */}
      <div className={clsx(
          "relative z-10 w-full h-full flex", 
          variant === 'grid' ? "flex-col items-center justify-center p-2 gap-2" : "flex-row px-3 gap-3"
      )}>
          
          {/* Icon */}
          <div className={clsx(
              "flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6",
              isSelected && "scale-110"
          )}>
              {getItemIcon(item, variant === 'grid' ? 32 : 24, rarity.text)}
          </div>

          {/* Text Info */}
          <div className={clsx(
              "flex flex-col min-w-0",
              variant === 'grid' ? "items-center text-center w-full" : "flex-1 items-start"
          )}>
              <div className={clsx(
                  "font-bold truncate w-full",
                  variant === 'grid' ? "text-xs" : "text-sm",
                  isSelected ? "text-content-primary" : "text-content-secondary group-hover:text-content-primary"
              )}>
                  {item.名称}
              </div>
              
              {/* Meta Info Row */}
              <div className="flex items-center gap-2 mt-0.5 opacity-80">
                  <span className={clsx("text-[10px] uppercase font-bold tracking-wider", rarity.text)}>
                      {getTypeLabel(item.类型)}
                  </span>
                  {(item.数量 || 1) > 1 && (
                      <span className="text-[10px] font-mono text-content-muted bg-black/30 px-1.5 rounded-sm">
                          x{item.数量}
                      </span>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
});
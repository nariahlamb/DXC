import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BattleMapRow } from '../../../types/combat';
import { Skull, Ghost } from 'lucide-react';

interface MapEntityTokenProps {
  entity: BattleMapRow;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  gridUnit: number; // Size of one grid square in pixels
  isPlayer?: boolean;
  coordinateBase?: 0 | 1;
}

export const MapEntityToken: React.FC<MapEntityTokenProps> = ({
  entity,
  isSelected,
  onSelect,
  gridUnit,
  isPlayer,
  coordinateBase = 1
}) => {
  const { UNIT_ID, 名称, 位置, 状态, 图标, 类型, 生命值 } = entity;
  const [iconLoadFailed, setIconLoadFailed] = useState(false);

  const normalizeCoord = (value: number): number => Math.max(0, coordinateBase === 1 ? value - 1 : value);

  // Calculate position in pixels and center the token in the grid cell.
  const x = normalizeCoord(位置.x) * gridUnit;
  const y = normalizeCoord(位置.y) * gridUnit;
  const size = gridUnit * 0.8; // Token is 80% of cell size
  const offset = (gridUnit - size) / 2;

  const isDead = 状态 === '死亡' || (生命值 && 生命值.当前 <= 0);
  const isDown = 状态 === '倒地';
  
  // Dynamic Styles based on faction/type
  const baseColor = useMemo(() => {
    if (isPlayer || 类型 === '玩家') return 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
    if (类型 === '友方') return 'border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.3)]';
    if (类型 === '其他' || 类型 === '障碍物') return 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]';
    return 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'; // Enemy default
  }, [类型, isPlayer]);

  const hpPercent = useMemo(() => {
    if (!生命值 || !生命值.最大) return 100;
    return Math.max(0, Math.min(100, (生命值.当前 / 生命值.最大) * 100));
  }, [生命值]);

  const resolvedIcon = useMemo(() => {
    if (!图标 || typeof 图标 !== 'string') return undefined;
    const icon = 图标.trim();
    if (!icon) return undefined;
    if (/^(https?:\/\/|data:)/i.test(icon)) return icon;
    const diceBearMatch = icon.match(/^([a-z0-9_-]+)\s*:\s*(.+)$/i);
    if (diceBearMatch) {
      const style = diceBearMatch[1];
      const seed = encodeURIComponent(diceBearMatch[2].trim());
      return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
    }
    return icon;
  }, [图标]);

  return (
    <motion.div
      className="absolute cursor-pointer z-10"
      initial={{ x, y, opacity: 0, scale: 0 }}
      animate={{ 
        x: x + offset, 
        y: y + offset, 
        opacity: isDead ? 0.5 : 1,
        scale: isSelected ? 1.1 : 1,
        zIndex: isSelected ? 20 : 10
      }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 25
      }}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect && onSelect(UNIT_ID);
      }}
    >
      {/* Selection Glow Ring */}
      {isSelected && (
        <motion.div
          layoutId="selection-ring"
          className="absolute -inset-2 rounded-full border-2 border-white/80 opacity-80"
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ boxShadow: '0 0 20px rgba(255,255,255,0.2)' }}
        />
      )}

      {/* Main Token Body */}
      <div 
        className={`
          w-full h-full rounded-full border-2 overflow-hidden bg-black/80 backdrop-blur-sm relative transition-colors duration-300
          ${baseColor}
          ${isSelected ? 'brightness-110' : 'hover:brightness-110'}
          ${isDead ? 'grayscale' : ''}
        `}
      >
        {/* Avatar Image */}
        {resolvedIcon && !iconLoadFailed ? (
          <img 
            src={resolvedIcon}
            alt={名称} 
            className="w-full h-full object-cover"
            draggable={false}
            onError={() => setIconLoadFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-xs font-bold text-zinc-400 select-none">
            {名称.slice(0, 2)}
          </div>
        )}

        {/* Status Overlays */}
        {isDead && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Skull className="text-red-500 w-1/2 h-1/2" strokeWidth={1.5} />
          </div>
        )}
        {状态 === '隐身' && (
          <div className="absolute inset-0 bg-blue-900/30 backdrop-blur-[2px] flex items-center justify-center">
             <Ghost className="text-cyan-300 w-1/2 h-1/2 opacity-70" />
          </div>
        )}
      </div>

      {/* Health Bar (Curved or Bottom Bar?) - Let's do a clean bar below */}
      {!isDead && 生命值 && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[120%] h-1.5 bg-black/80 rounded-full overflow-hidden border border-white/10 pointer-events-none">
          <motion.div 
            className={`h-full ${hpPercent > 50 ? 'bg-emerald-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-600'}`}
            initial={{ width: 0 }}
            animate={{ width: `${hpPercent}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Name Label (Only on Hover or Selection) */}
      {(isSelected) && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-30 pointer-events-none">
            <div className="bg-black/80 text-white text-[10px] px-2 py-1 rounded border border-white/10 backdrop-blur-md shadow-xl">
                {名称}
            </div>
        </div>
      )}
    </motion.div>
  );
};

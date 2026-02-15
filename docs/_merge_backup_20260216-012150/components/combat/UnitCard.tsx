import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skull, Crosshair, Target } from 'lucide-react';
import { CombatUnit } from '../../types/combat-normalized';

interface UnitCardProps {
  unit: CombatUnit;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const threatColors: Record<string, string> = {
  CRITICAL: 'bg-red-950 border-red-500 text-red-200',
  HIGH: 'bg-orange-950 border-orange-500 text-orange-200',
  MID: 'bg-yellow-950 border-yellow-500 text-yellow-200',
  LOW: 'bg-emerald-950 border-emerald-500 text-emerald-200',
  TRIVIAL: 'bg-slate-900 border-slate-500 text-slate-200',
  UNKNOWN: 'bg-zinc-900 border-zinc-600 text-zinc-300'
};

const barColors: Record<string, string> = {
  CRITICAL: 'from-red-600 to-red-800',
  HIGH: 'from-orange-600 to-orange-800',
  MID: 'from-yellow-600 to-yellow-800',
  LOW: 'from-emerald-600 to-emerald-800',
  TRIVIAL: 'from-slate-600 to-slate-800',
  UNKNOWN: 'from-zinc-600 to-zinc-800'
};

export const UnitCard: React.FC<UnitCardProps> = ({ unit, isSelected, onSelect }) => {
  const hpPercent = Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100));
  const mpPercent = Math.max(0, Math.min(100, (unit.mp / unit.maxMp) * 100));

  const threatClass = threatColors[unit.threatTier] || threatColors.UNKNOWN;
  const barGradient = barColors[unit.threatTier] || barColors.UNKNOWN;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: isSelected ? 1.05 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0, transition: { duration: 0.3 } }}
      onClick={() => onSelect(unit.id)}
      className={`
        relative flex flex-col p-3 rounded-sm border-2 transition-all cursor-pointer backdrop-blur-sm
        ${isSelected
          ? 'border-red-500 bg-zinc-900/90 shadow-[0_0_20px_rgba(220,38,38,0.2)] z-10'
          : 'border-zinc-800 bg-zinc-950/80 hover:border-red-800/60 hover:bg-zinc-900/90'
        }
      `}
    >
      {/* Header / Badges */}
      <div className="flex justify-between items-start mb-2">
        <div className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${threatClass} rounded-xs`}>
          {unit.threatTier}
        </div>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, rotate: -45 }}
            animate={{ opacity: 1, rotate: 0 }}
            className="text-red-500"
          >
            <Crosshair size={16} />
          </motion.div>
        )}
      </div>

      {/* Main Info */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`
          w-10 h-10 flex items-center justify-center border rounded-sm
          ${isSelected ? 'border-red-500 bg-red-950/30 text-red-400' : 'border-zinc-700 bg-zinc-900 text-zinc-500'}
        `}>
          <Skull size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-hestia-blue-100 font-display font-bold text-sm uppercase tracking-wide truncate">
            {unit.name}
          </h3>
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-0.5">
            <span>LV.{unit.level}</span>
            <span className="w-px h-2 bg-zinc-700"/>
            <span>ATK {unit.attack}</span>
          </div>
        </div>
      </div>

      {/* Status Bars */}
      <div className="space-y-1.5 w-full">
        {/* HP */}
        <div className="relative h-2.5 bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden">
          <motion.div
            className={`absolute top-0 left-0 h-full bg-gradient-to-r ${barGradient}`}
            initial={{ width: 0 }}
            animate={{ width: `${hpPercent}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 15 }}
          />
        </div>

        {/* MP (Only show if maxMp > 1) */}
        {unit.maxMp > 1 && (
          <div className="relative h-1.5 bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-purple-800"
              initial={{ width: 0 }}
              animate={{ width: `${mpPercent}%` }}
              transition={{ type: "spring", stiffness: 50, damping: 15 }}
            />
          </div>
        )}
      </div>

      {/* Values */}
      <div className="flex justify-between mt-1 text-[9px] font-mono text-zinc-500">
        <span>HP {unit.hp}/{unit.maxHp}</span>
        {unit.maxMp > 1 && <span>MP {unit.mp}/{unit.maxMp}</span>}
      </div>

    </motion.div>
  );
};

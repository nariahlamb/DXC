import React, { useEffect, useMemo, useState } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import { CombatUnit } from '../../types/combat-normalized';
import { MapVisuals, BattleMapRow } from '../../types/combat';
import { UnitCard } from './UnitCard';
import { TacticalGrid } from './map/TacticalGrid';
import { Grid, Map as MapIcon } from 'lucide-react';
import { computeBattleMapAnchor, hasBattleMapData } from '../../utils/mapViewModel';

interface BattleStageProps {
  enemies: CombatUnit[];
  selectedId: string | null;
  onSelectEnemy: (id: string) => void;
  mapVisuals?: MapVisuals;
  battleMap?: BattleMapRow[];
  missingMapHint?: boolean;
}

export const BattleStage: React.FC<BattleStageProps> = ({
  enemies,
  selectedId,
  onSelectEnemy,
  mapVisuals,
  battleMap,
  missingMapHint = false
}) => {
  const hasMapData = hasBattleMapData(mapVisuals, battleMap);

  const [viewMode, setViewMode] = useState<'MAP' | 'CARDS'>(hasMapData ? 'MAP' : 'CARDS');
  const mapAnchor = useMemo(() => computeBattleMapAnchor(battleMap), [battleMap]);

  useEffect(() => {
    if (hasMapData) {
      setViewMode('MAP');
      return;
    }
    setViewMode('CARDS');
  }, [hasMapData]);

  // Simple grid background if map visuals present but using Card view
  const containerStyle = (mapVisuals && viewMode === 'CARDS') ? {
    backgroundImage: 'linear-gradient(rgba(60, 160, 240, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(60, 160, 240, 0.1) 1px, transparent 1px)',
    backgroundSize: '40px 40px'
  } : {};

  return (
    <div
      className="flex-1 w-full relative overflow-hidden flex flex-col"
      style={viewMode === 'CARDS' ? containerStyle : {}}
    >
      {/* View Toggle (Only if map data exists) */}
      {hasMapData && (
        <div className="absolute top-4 right-4 z-40 flex bg-black/60 border border-white/10 rounded-lg p-0.5 backdrop-blur-md">
            <button
                onClick={() => setViewMode('MAP')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${viewMode === 'MAP' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <MapIcon size={14} /> Map
            </button>
            <button
                onClick={() => setViewMode('CARDS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${viewMode === 'CARDS' ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
                <Grid size={14} /> Cards
            </button>
        </div>
      )}

      {viewMode === 'MAP' && hasMapData && mapAnchor && (
        <div className="absolute top-4 left-4 z-40 bg-cyan-950/40 border border-cyan-700/40 rounded-sm px-3 py-2 text-[11px] text-cyan-100 max-w-xs">
          战术地图锚点 X:{mapAnchor.x} Y:{mapAnchor.y} · 单位数 {battleMap?.length || 0}
        </div>
      )}

      {missingMapHint && !hasMapData && (
        <div className="absolute top-4 left-4 z-40 bg-amber-900/30 border border-amber-700/40 rounded-sm px-3 py-2 text-[11px] text-amber-200 max-w-xs">
          尚未收到战斗地图/视觉数据，当前显示卡片列表。
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full relative">
        {viewMode === 'MAP' && hasMapData ? (
             <TacticalGrid
                mapVisuals={mapVisuals}
                battleMap={battleMap!}
                selectedId={selectedId}
                onSelect={onSelectEnemy}
             />
        ) : (
            <div className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar p-4 md:p-8 flex items-center justify-center">
                 <LayoutGroup>
                    <motion.div
                        layout
                        className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6"
                    >
                        <AnimatePresence>
                            {enemies.map((enemy) => (
                            <UnitCard
                                key={enemy.id}
                                unit={enemy}
                                isSelected={enemy.id === selectedId}
                                onSelect={onSelectEnemy}
                            />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </LayoutGroup>

                {enemies.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-600 animate-pulse pointer-events-none">
                        <div className="text-center">
                            <div className="text-4xl mb-2 opacity-50">⚔️</div>
                            <div className="uppercase tracking-widest text-sm font-display">Searching for hostiles...</div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

    </div>
  );
};

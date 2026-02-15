import React, { useRef, useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { BattleMapRow, MapVisuals } from '../../../types/combat';
import { MapEntityToken } from './MapEntityToken';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface TacticalGridProps {
  mapVisuals?: MapVisuals;
  battleMap: BattleMapRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export const TacticalGrid: React.FC<TacticalGridProps> = ({
  mapVisuals,
  battleMap,
  selectedId,
  onSelect,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const sanitizedBattleMap = useMemo(() => {
    return battleMap.map((row) => {
      if (!row || !row.位置) return row;
      // Robust parsing: handle "(1,2)" or "1" or 1
      const parseCoord = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          // Remove parens and whitespace if present
          const clean = val.replace(/[()]/g, '').trim();
          return Number(clean);
        }
        return NaN;
      };

      const x = parseCoord(row.位置.x);
      const y = parseCoord(row.位置.y);
      return {
        ...row,
        位置: {
          ...row.位置,
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0
        }
      };
    });
  }, [battleMap]);

  const coordinateBase = useMemo<0 | 1>(() => {
    const points = sanitizedBattleMap
      .map((row) => row?.位置)
      .filter((pos): pos is { x: number; y: number } => !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y));
    if (points.length === 0) return 1;
    const minX = Math.min(...points.map((pos) => pos.x));
    const minY = Math.min(...points.map((pos) => pos.y));
    return minX >= 1 && minY >= 1 ? 1 : 0;
  }, [sanitizedBattleMap]);

  const toGridCoord = (value: number): number => Math.max(0, coordinateBase === 1 ? value - 1 : value);

  const inferredMapSize = useMemo(() => {
    const points = sanitizedBattleMap
      .map((row) => row?.位置)
      .filter((pos): pos is { x: number; y: number } => !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y));
    if (points.length === 0) {
      return { width: 20, height: 20 };
    }

    const maxX = Math.max(...points.map((pos) => toGridCoord(pos.x)));
    const maxY = Math.max(...points.map((pos) => toGridCoord(pos.y)));
    return {
      width: Math.max(20, maxX + 2),
      height: Math.max(20, maxY + 2)
    };
  }, [sanitizedBattleMap, coordinateBase]);

  // Default map size fallback from battle rows when visuals are missing/incomplete
  const visualWidth = Number(mapVisuals?.地图尺寸?.宽度);
  const visualHeight = Number(mapVisuals?.地图尺寸?.高度);
  const mapWidth = Number.isFinite(visualWidth) && visualWidth > 0 ? Math.round(visualWidth) : inferredMapSize.width;
  const mapHeight = Number.isFinite(visualHeight) && visualHeight > 0 ? Math.round(visualHeight) : inferredMapSize.height;
  const GRID_SIZE = 60; // Base pixel size of one grid cell
  
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const staticEntities = useMemo(() => {
    return sanitizedBattleMap.filter((entity) => {
      if (entity.类型 === '障碍物' || entity.类型 === '地形') return true;
      const text = `${entity.名称 || ''} ${entity.描述 || ''} ${(entity.状态效果 || []).join(' ')}`.toLowerCase();
      return /wall|墙|掩体|障碍|terrain|地形|zone|区域|法术|陷阱/.test(text);
    });
  }, [sanitizedBattleMap]);

  const staticIds = useMemo(() => new Set(staticEntities.map(entity => entity.UNIT_ID)), [staticEntities]);

  const tokenEntities = useMemo(
    () => sanitizedBattleMap.filter(entity => !staticIds.has(entity.UNIT_ID)),
    [sanitizedBattleMap, staticIds]
  );

  // Reset view when map changes and auto-focus visible tokens.
  useEffect(() => {
    setScale(1);
    const container = containerRef.current;
    if (!container || tokenEntities.length === 0) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    const points = tokenEntities
      .map((entity) => entity?.位置)
      .filter((pos): pos is { x: number; y: number } => !!pos && Number.isFinite(pos.x) && Number.isFinite(pos.y));
    if (points.length === 0) {
      setOffset({ x: 0, y: 0 });
      return;
    }

    const avgX = points.reduce((sum, pos) => sum + toGridCoord(pos.x), 0) / points.length;
    const avgY = points.reduce((sum, pos) => sum + toGridCoord(pos.y), 0) / points.length;
    const focusX = avgX * GRID_SIZE + GRID_SIZE / 2;
    const focusY = avgY * GRID_SIZE + GRID_SIZE / 2;

    setOffset({
      x: Math.round(container.clientWidth / 2 - focusX),
      y: Math.round(container.clientHeight / 2 - focusY)
    });
  }, [mapWidth, mapHeight, tokenEntities, coordinateBase]);

  // --- Interaction Handlers ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.5, scale * delta), 3); // Clamp zoom 0.5x to 3x
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  // Render Grid Lines (Optimized)
  const renderGrid = () => {
    return (
      <pattern id="tactical-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
        <path 
          d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} 
          fill="none" 
          stroke="rgba(56, 189, 248, 0.1)" // hestia-blue-400 with low opacity
          strokeWidth="1" 
        />
        {/* Subtle cross at center */}
        <path d={`M ${GRID_SIZE/2 - 2} ${GRID_SIZE/2} H ${GRID_SIZE/2 + 2} M ${GRID_SIZE/2} ${GRID_SIZE/2 - 2} V ${GRID_SIZE/2 + 2}`} stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
      </pattern>
    );
  };

  // Convert map size to pixel dimensions for SVG viewBox
  const viewWidth = mapWidth * GRID_SIZE;
  const viewHeight = mapHeight * GRID_SIZE;

  const getEntitySize = (entity: BattleMapRow): { width: number; height: number } => {
    const w = Number((entity as any).尺寸?.宽度 ?? 1);
    const h = Number((entity as any).尺寸?.高度 ?? 1);
    return {
      width: Number.isFinite(w) ? Math.max(1, Math.round(w)) : 1,
      height: Number.isFinite(h) ? Math.max(1, Math.round(h)) : 1
    };
  };

  const getTerrainStyle = (entity: BattleMapRow) => {
    const desc = `${entity.描述 || ''} ${(entity.状态效果 || []).join(' ')}`.toLowerCase();
    const isWall = entity.类型 === '障碍物' || /wall|墙|掩体|障碍/.test(desc);
    const isZoneLike = /zone|区域|法术|陷阱/.test(desc);
    if (isWall) {
      return {
        fill: 'rgba(106, 114, 128, 0.45)',
        stroke: 'rgba(209, 213, 219, 0.55)',
        dash: undefined as string | undefined
      };
    }
    if (isZoneLike) {
      return {
        fill: 'rgba(167, 139, 250, 0.24)',
        stroke: 'rgba(196, 181, 253, 0.7)',
        dash: '7 4'
      };
    }
    return {
      fill: 'rgba(74, 128, 87, 0.3)',
      stroke: 'rgba(110, 231, 183, 0.45)',
      dash: undefined as string | undefined
    };
  };

  return (
    <div 
      className={`relative w-full h-full overflow-hidden bg-[#0a0a0c] select-none ${className}`}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Texture Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} 
      />

      <div
        className="absolute inset-0 transform-gpu transition-transform duration-75 cursor-move origin-center"
        style={{ 
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ width: viewWidth, height: viewHeight, position: 'relative' }}>
            {/* Base Grid Layer */}
            <svg 
              width={viewWidth} 
              height={viewHeight} 
              viewBox={`0 0 ${viewWidth} ${viewHeight}`}
              className="absolute inset-0 pointer-events-none drop-shadow-2xl"
            >
              <defs>
                {renderGrid()}
                <radialGradient id="map-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stopColor="rgba(56, 189, 248, 0.05)" />
                    <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
                </radialGradient>
              </defs>
              
              {/* Map Border */}
              <rect width={viewWidth} height={viewHeight} fill="#050505" stroke="rgba(56, 189, 248, 0.3)" strokeWidth="2" />
              
              {/* Inner Glow */}
              <circle cx={viewWidth/2} cy={viewHeight/2} r={Math.min(viewWidth, viewHeight)/2} fill="url(#map-glow)" />

              {/* The Grid */}
              <rect width={viewWidth} height={viewHeight} fill="url(#tactical-grid)" />

              {/* Special Zones from map visuals */}
              {mapVisuals?.特殊区域?.map((zone, i) => (
                  <circle 
                    key={i}
                    cx={toGridCoord(zone.位置.x) * GRID_SIZE + GRID_SIZE/2}
                    cy={toGridCoord(zone.位置.y) * GRID_SIZE + GRID_SIZE/2}
                    r={(zone.范围 || 1) * GRID_SIZE}
                    fill="rgba(234, 179, 8, 0.1)" // Yellowish for danger/special
                    stroke="rgba(234, 179, 8, 0.3)"
                    strokeDasharray="4 4"
                  />
              ))}

              {/* Static battlefield entities (walls / terrain / zones from battle map rows) */}
              {staticEntities.map((entity) => {
                const size = getEntitySize(entity);
                const style = getTerrainStyle(entity);
                const widthPx = size.width * GRID_SIZE;
                const heightPx = size.height * GRID_SIZE;
                const x = toGridCoord(entity.位置.x) * GRID_SIZE + 2;
                const y = toGridCoord(entity.位置.y) * GRID_SIZE + 2;
                return (
                  <g key={`static-${entity.UNIT_ID}`}>
                    <rect
                      x={x}
                      y={y}
                      width={Math.max(8, widthPx - 4)}
                      height={Math.max(8, heightPx - 4)}
                      rx={6}
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth={1.5}
                      strokeDasharray={style.dash}
                    />
                    <text
                      x={x + 4}
                      y={y + 14}
                      fill="rgba(245, 245, 245, 0.82)"
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {entity.名称.slice(0, 6)}
                    </text>
                    <title>{[entity.名称, entity.描述, ...(entity.状态效果 || [])].filter(Boolean).join(' | ')}</title>
                  </g>
                );
              })}
            </svg>

            {/* Entities Layer */}
            <AnimatePresence>
              {tokenEntities.map((entity) => (
                <MapEntityToken 
                  key={entity.UNIT_ID}
                  entity={entity}
                  gridUnit={GRID_SIZE}
                  coordinateBase={coordinateBase}
                  isSelected={selectedId === entity.UNIT_ID}
                  onSelect={onSelect}
                  isPlayer={entity.类型 === '玩家'} 
                />
              ))}
            </AnimatePresence>
        </div>
      </div>

      {/* HUD: Zoom Controls & Info */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur border border-white/10 rounded-lg p-1 flex flex-col gap-1 shadow-xl">
             <button onClick={() => setScale(s => Math.min(s + 0.2, 3))} className="p-2 hover:bg-white/10 rounded text-cyan-400 transition-colors"><ZoomIn size={16} /></button>
             <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="p-2 hover:bg-white/10 rounded text-cyan-400 transition-colors"><ZoomOut size={16} /></button>
             <button onClick={() => { setScale(1); setOffset({x:0,y:0}); }} className="p-2 hover:bg-white/10 rounded text-zinc-400 hover:text-cyan-400 transition-colors"><Maximize size={16} /></button>
          </div>
      </div>
      
      {/* HUD: Legend / Mode Intent */}
      <div className="absolute top-4 left-4 z-50 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm border-l-2 border-cyan-500 pl-3 pr-2 py-1">
             <div className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold mb-0.5">TACTICAL VIEW</div>
             {mapVisuals?.光照 && <div className="text-[9px] text-zinc-400">LIGHT: {mapVisuals.光照}</div>}
             {mapVisuals?.地形描述 && <div className="text-[9px] text-zinc-500 italic max-w-[200px]">{mapVisuals.地形描述}</div>}
          </div>
      </div>

    </div>
  );
};


import React, { useState, useRef, useEffect } from 'react';
import { X, Map as MapIcon, Target, Plus, Minus, RotateCcw, Info, Layers, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { WorldMapData, GeoPoint, Confidant, MapMidLocation, MapSmallLocation } from '../../../types';
import { drawWorldMapCanvas, resizeCanvasToContainer } from '../../../utils/mapCanvas';

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldMap?: WorldMapData; 
  currentPos?: GeoPoint; 
  floor?: number;
  location?: string;
  playerName?: string;
  confidants?: Confidant[];
}

export const MapModal: React.FC<MapModalProps> = ({ 
  isOpen, 
  onClose, 
  worldMap,
  currentPos = { x: 5000, y: 5000 }, 
  floor = 0,
  location,
  playerName = "YOU",
  confidants = []
}) => {
  // Enhanced Scale: Limit minimum scale to 0.1 to prevent crash
  const [scale, setScale] = useState(0.5); 
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'macro' | 'mid' | 'small'>('macro');
  const [activeMid, setActiveMid] = useState<MapMidLocation | null>(null);
  const [activeSmall, setActiveSmall] = useState<MapSmallLocation | null>(null);
  
  // Navigation State
  const [viewingFloor, setViewingFloor] = useState<number>(floor);
  const [isFloorMenuOpen, setIsFloorMenuOpen] = useState(false); 

  // Layer Toggles - Removed Routes
  const [showTerritories, setShowTerritories] = useState(true);
  const [showNPCs, setShowNPCs] = useState(true);

  // Hover State
  const [hoverInfo, setHoverInfo] = useState<{title: string, sub?: string, desc?: string, x: number, y: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initial Data
  const mapData = worldMap || { 
      config: { width: 10000, height: 10000 },
      factions: [], territories: [], terrain: [], routes: [], surfaceLocations: [], dungeonStructure: [] 
  };

  const matchByName = (needle?: string, name?: string) => {
      if (!needle || !name) return false;
      return needle.includes(name) || name.includes(needle);
  };

  const resolveAutoView = () => {
      if (floor !== 0) {
          setViewMode('macro');
          setActiveMid(null);
          setActiveSmall(null);
          return;
      }
      const smallMatch = mapData.smallLocations?.find(s => matchByName(location, s.name)) || null;
      const midMatch = mapData.midLocations?.find(m => matchByName(location, m.name)) || null;
      if (smallMatch) {
          setViewMode('small');
          setActiveSmall(smallMatch);
          setActiveMid(midMatch);
      } else if (midMatch) {
          setViewMode('mid');
          setActiveMid(midMatch);
          setActiveSmall(null);
      } else {
          setViewMode('macro');
          setActiveMid(null);
          setActiveSmall(null);
      }
  };

  const centerOnArea = (center: GeoPoint, area?: { radius?: number; width?: number; height?: number }) => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const diameter = area?.radius ? area.radius * 2 : (area?.width && area?.height ? Math.max(area.width, area.height) : 1200);
      const desiredScale = Math.min(clientWidth / diameter, clientHeight / diameter) * 0.6;
      const targetScale = Math.max(0.3, Math.min(desiredScale, 3.0));
      setOffset({
          x: -center.x * targetScale + clientWidth / 2,
          y: -center.y * targetScale + clientHeight / 2
      });
      setScale(targetScale);
      setViewingFloor(floor);
  };

  const centerOnPlayer = () => {
      if (containerRef.current) {
          const { clientWidth, clientHeight } = containerRef.current;
          const targetScale = 1.0; 
          setOffset({
              x: -currentPos.x * targetScale + clientWidth / 2,
              y: -currentPos.y * targetScale + clientHeight / 2
          });
          setScale(targetScale);
          setViewingFloor(floor); 
      }
  };

  useEffect(() => {
      if (isOpen) {
          setViewingFloor(floor);
          resolveAutoView();
          // Small delay to let ref mount
          setTimeout(() => centerOnPlayer(), 100);
      }
  }, [isOpen, floor, location, worldMap]);

  useEffect(() => {
      if (!isOpen) return;
      if (viewingFloor !== 0) return;
      if (viewMode === 'mid' && activeMid) {
          centerOnArea(activeMid.area?.center || activeMid.coordinates, activeMid.area);
      }
      if (viewMode === 'macro') {
          centerOnPlayer();
      }
  }, [viewMode, activeMid, viewingFloor, isOpen]);

  useEffect(() => {
      if (!isOpen) return;
      if (viewMode === 'small' && viewingFloor === 0) return;
      const draw = () => {
          const canvas = canvasRef.current;
          const container = containerRef.current;
          if (!canvas || !container) return;
          resizeCanvasToContainer(canvas, container);
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          drawWorldMapCanvas(ctx, mapData, {
              floor: viewingFloor,
              scale,
              offset,
              showTerritories,
              showNPCs,
              showPlayer: viewingFloor === floor,
              showLabels: true,
              currentPos,
              confidants
          });
      };
      draw();
      window.addEventListener('resize', draw);
      return () => window.removeEventListener('resize', draw);
  }, [isOpen, mapData, scale, offset, viewingFloor, showTerritories, showNPCs, floor, currentPos, confidants, viewMode]);

  useEffect(() => {
      if (viewMode === 'small') {
          setHoverInfo(null);
      }
  }, [viewMode]);

  if (!isOpen) return null;

  // --- Zoom Logic ---
  const applyZoom = (deltaScale: number, containerCenterX?: number, containerCenterY?: number) => {
      if (viewMode === 'small') return;
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      
      // Safety: Prevent scale from going too small (crash risk) or too large
      const safeScale = Math.max(0.1, Math.min(scale + deltaScale, 5.0));
      if (Math.abs(safeScale - scale) < 0.001) return;

      const cx = containerCenterX !== undefined ? containerCenterX : clientWidth / 2;
      const cy = containerCenterY !== undefined ? containerCenterY : clientHeight / 2;

      const mapX = (cx - offset.x) / scale;
      const mapY = (cy - offset.y) / scale;

      const newOffsetX = cx - (mapX * safeScale);
      const newOffsetY = cy - (mapY * safeScale);

      setScale(safeScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (viewMode === 'small') return;
      e.preventDefault();
      const delta = -e.deltaY * 0.001; 
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
          applyZoom(delta, e.clientX - rect.left, e.clientY - rect.top);
      }
  };


  // --- Pan Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
      if (viewMode === 'small') return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
      if (viewMode === 'small') return;
      if (isDragging) {
          setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      } else {
          updateHoverInfo(e.clientX, e.clientY);
      }
  };

  const updateHoverInfo = (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mapX = (clientX - rect.left - offset.x) / scale;
      const mapY = (clientY - rect.top - offset.y) / scale;
      const loc = mapData.surfaceLocations
          .filter(l => (l.floor || 0) === viewingFloor)
          .find(l => {
              const dx = mapX - l.coordinates.x;
              const dy = mapY - l.coordinates.y;
              return Math.hypot(dx, dy) <= l.radius;
          });
      if (loc) {
          setHoverInfo({
              title: loc.name,
              sub: loc.type === 'FAMILIA_HOME' ? '眷族据点' : loc.type === 'SHOP' ? '商店' : '地标',
              desc: loc.description,
              x: clientX,
              y: clientY
          });
      } else {
          setHoverInfo(null);
      }
  };

  const renderSurfaceMap = () => (
      <div 
          ref={containerRef}
          className="flex-1 bg-[#050a14] relative overflow-hidden cursor-move border-t-2 border-b-2 border-blue-900"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => { setIsDragging(false); setHoverInfo(null); }}
          onWheel={handleWheel}
      >
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
  );

  const renderSmallLayout = () => {
      if (!activeSmall?.layout) {
          return (
              <div className="flex-1 bg-[#050a14] flex items-center justify-center text-zinc-400 text-sm border-t-2 border-b-2 border-blue-900">
                  未找到小地点布局数据
              </div>
          );
      }
      const layout = activeSmall.layout;
      const unit = 14;
      return (
          <div className="flex-1 bg-[#050a14] border-t-2 border-b-2 border-blue-900 overflow-auto">
              <div className="p-6 flex flex-col items-center gap-4">
                  <div className="text-xs text-blue-300 font-mono uppercase tracking-widest">
                      小地点布局 · {activeSmall.name}
                  </div>
                  <div
                      className="relative bg-[#f4f1e8] border-4 border-zinc-800 shadow-2xl"
                      style={{
                          width: layout.width * unit,
                          height: layout.height * unit,
                          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)`,
                          backgroundSize: `${unit}px ${unit}px`
                      }}
                  >
                      {layout.rooms.map(room => (
                          <div
                              key={room.id}
                              className="absolute border-2 border-zinc-900/80 bg-white/70 text-[10px] text-zinc-800 font-bold flex items-center justify-center"
                              style={{
                                  left: room.bounds.x * unit,
                                  top: room.bounds.y * unit,
                                  width: room.bounds.width * unit,
                                  height: room.bounds.height * unit
                              }}
                          >
                              {room.name}
                          </div>
                      ))}
                      {layout.furniture.map(item => (
                          <div
                              key={item.id}
                              className="absolute bg-amber-600/70 border border-amber-900 text-[8px] text-white flex items-center justify-center"
                              style={{
                                  left: item.position.x * unit,
                                  top: item.position.y * unit,
                                  width: (item.size?.width || 1) * unit,
                                  height: (item.size?.height || 1) * unit
                              }}
                              title={item.description || item.name}
                          >
                              {item.name}
                          </div>
                      ))}
                      {layout.entrances.map(entrance => (
                          <div
                              key={entrance.id}
                              className="absolute w-3 h-3 bg-blue-600 border border-blue-900 rounded-full"
                              style={{
                                  left: entrance.position.x * unit - 6,
                                  top: entrance.position.y * unit - 6
                              }}
                              title={entrance.name}
                          />
                      ))}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono">
                      比例: {layout.scale} | 尺寸: {layout.width} × {layout.height} 米
                  </div>
                  {layout.notes && layout.notes.length > 0 && (
                      <div className="max-w-3xl w-full bg-black/60 border border-zinc-700 p-3 text-[11px] text-zinc-200 space-y-1">
                          {layout.notes.map((note, idx) => (
                              <div key={idx}>• {note}</div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const LayerControl = () => (
      <div className="absolute top-24 left-6 z-30 flex flex-col gap-2 bg-black/80 p-2 border border-zinc-700 rounded shadow-xl">
          <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1 flex items-center gap-1">
              <Layers size={12} /> 图层控制
          </div>
          <button onClick={() => setShowTerritories(!showTerritories)} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${showTerritories ? 'bg-blue-900/50 text-blue-200' : 'text-zinc-500'}`}>
              {showTerritories ? <Eye size={12}/> : <EyeOff size={12}/>} 领地范围
          </button>
          <button onClick={() => setShowNPCs(!showNPCs)} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${showNPCs ? 'bg-blue-900/50 text-blue-200' : 'text-zinc-500'}`}>
              {showNPCs ? <Eye size={12}/> : <EyeOff size={12}/>} 人物定位
          </button>
      </div>
  );

  // Floor Jump Selector
  const FloorSelector = () => (
      <div className="absolute top-24 left-44 z-30">
          <div className="relative">
              <button 
                onClick={() => setIsFloorMenuOpen(!isFloorMenuOpen)}
                className="bg-black/90 text-white border border-blue-500 px-4 py-2 rounded flex items-center gap-2 shadow-lg"
              >
                  <span className="font-bold font-mono">
                      {viewingFloor === 0 ? "地表 (欧拉丽)" : `地下 ${viewingFloor} 层`}
                  </span>
                  <ChevronDown size={14} className={`transition-transform ${isFloorMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isFloorMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-black border border-zinc-700 max-h-64 overflow-y-auto custom-scrollbar shadow-xl z-40">
                      <button onClick={() => { handleSelectFloor(0); setIsFloorMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-white hover:bg-blue-900 border-b border-zinc-800">
                          欧拉丽地表
                      </button>
                      {Array.from({length: 50}, (_, i) => i + 1).map(f => (
                          <button 
                            key={f} 
                            onClick={() => { handleSelectFloor(f); setIsFloorMenuOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 border-b border-zinc-800 font-mono ${f === floor ? 'text-green-500 font-bold' : 'text-zinc-400'}`}
                          >
                              地下 {f} 层 {f === floor ? '(当前)' : ''}
                          </button>
                      ))}
                  </div>
              )}
          </div>
      </div>
  );

  const ViewModeToggle = () => {
      if (viewingFloor !== 0) return null;
      return (
          <div className="absolute top-24 left-[22rem] z-30 flex items-center bg-black/90 border border-blue-500 shadow-lg rounded overflow-hidden text-xs font-bold">
              <button
                  onClick={() => setViewMode('macro')}
                  className={`px-3 py-2 ${viewMode === 'macro' ? 'bg-blue-700 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                  大地图
              </button>
              <button
                  onClick={() => activeMid && setViewMode('mid')}
                  className={`px-3 py-2 ${viewMode === 'mid' ? 'bg-blue-700 text-white' : activeMid ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 cursor-not-allowed'}`}
              >
                  中地点
              </button>
              <button
                  onClick={() => activeSmall && setViewMode('small')}
                  className={`px-3 py-2 ${viewMode === 'small' ? 'bg-blue-700 text-white' : activeSmall ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 cursor-not-allowed'}`}
              >
                  小地点
              </button>
          </div>
      );
  };

  const handleSelectFloor = (nextFloor: number) => {
      setViewingFloor(nextFloor);
      if (nextFloor !== 0) {
          setViewMode('macro');
          setActiveMid(null);
          setActiveSmall(null);
      } else {
          resolveAutoView();
      }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-7xl h-[90vh] bg-black border-4 border-blue-600 relative flex flex-col shadow-[0_0_60px_rgba(37,99,235,0.4)]">
        
        {/* Header */}
        <div className="bg-zinc-900 p-4 flex justify-between items-center border-b-2 border-blue-800 shrink-0 z-20">
            <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-2 text-white shadow-lg"><MapIcon size={24} /></div>
                <div>
                    <h2 className="text-2xl font-display uppercase tracking-widest text-white text-shadow-blue">世界战术地图</h2>
                    <div className="text-xs font-mono text-blue-400">Coordinates: [{Math.round(currentPos.x)}, {Math.round(currentPos.y)}] | {location}</div>
                </div>
            </div>
            <div className="flex gap-4">
                <button onClick={centerOnPlayer} className="p-2 border border-zinc-700 text-zinc-400 hover:text-white hover:border-white transition-colors" title="定位玩家"><Target size={20} /></button>
                <button onClick={onClose} className="p-2 bg-red-900/20 border border-red-600 text-red-500 hover:bg-red-600 hover:text-white transition-colors"><X size={20} /></button>
            </div>
        </div>

        {/* Controls */}
        {!(viewMode === 'small' && viewingFloor === 0) && (
            <div className="absolute top-24 right-6 z-30 flex flex-col gap-2">
                <button onClick={() => applyZoom(0.1)} className="bg-zinc-800 border border-zinc-600 p-2 text-white hover:bg-blue-600 rounded"><Plus size={20}/></button>
                <button onClick={() => applyZoom(-0.1)} className="bg-zinc-800 border border-zinc-600 p-2 text-white hover:bg-blue-600 rounded"><Minus size={20}/></button>
                <button onClick={centerOnPlayer} className="bg-zinc-800 border border-zinc-600 p-2 text-white hover:bg-blue-600 rounded"><RotateCcw size={16}/></button>
            </div>
        )}

        {!(viewMode === 'small' && viewingFloor === 0) && <LayerControl />}
        <FloorSelector />
        <ViewModeToggle />

        {/* Legend */}
        <div className="absolute bottom-6 right-6 z-30 bg-black/90 border border-zinc-700 p-4 max-w-xs text-xs text-zinc-300 shadow-xl">
             <h4 className="font-bold text-white border-b border-zinc-600 pb-2 mb-2 uppercase">势力分布</h4>
             <div className="grid grid-cols-2 gap-2">
                 {mapData.factions.map(f => (
                     <div key={f.id} className="flex items-center gap-2">
                         <div className="w-3 h-3 border" style={{ backgroundColor: f.color, borderColor: f.borderColor }} />
                         <span style={{ color: f.textColor }}>{f.name}</span>
                     </div>
                 ))}
             </div>
        </div>

        {/* Map View */}
        {viewMode === 'small' && viewingFloor === 0 ? renderSmallLayout() : renderSurfaceMap()}

        {/* Tooltip */}
        {hoverInfo && (
            <div 
                className="fixed z-50 bg-black/95 border-2 border-blue-500 p-4 shadow-2xl pointer-events-none max-w-xs transform -translate-y-full mt-[-10px]"
                style={{ top: hoverInfo.y, left: hoverInfo.x }}
            >
                <div className="flex items-center gap-2 mb-2 border-b border-zinc-700 pb-2">
                    <span className="text-xl">📍</span>
                    <h4 className="text-blue-400 font-display text-lg uppercase tracking-wider">{hoverInfo.title}</h4>
                </div>
                {hoverInfo.sub && <div className="text-[10px] bg-blue-900/30 text-blue-200 px-2 py-0.5 inline-block mb-1 font-bold uppercase">{hoverInfo.sub}</div>}
                <p className="text-zinc-300 text-xs font-serif leading-relaxed">{hoverInfo.desc}</p>
            </div>
        )}

      </div>
    </div>
  );
};

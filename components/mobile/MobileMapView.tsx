
import React, { useState, useRef, useEffect } from 'react';
import { Target, Plus, Minus, Layers, Eye, EyeOff, Map as MapIcon, Info, X, ChevronDown } from 'lucide-react';
import { WorldMapData, GeoPoint, Confidant, MapMidLocation, MapSmallLocation } from '../../types';
import { drawWorldMapCanvas, resizeCanvasToContainer } from '../../utils/mapCanvas';

interface MobileMapViewProps {
  worldMap: WorldMapData;
  currentPos: GeoPoint;
  playerName: string;
  confidants: Confidant[];
  floor: number;
  location?: string;
}

export const MobileMapView: React.FC<MobileMapViewProps> = ({ 
  worldMap,
  currentPos,
  playerName,
  confidants,
  floor,
  location
}) => {
  // Zoom & Pan State
  const [scale, setScale] = useState(0.5); // Default closer zoom for mobile
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'macro' | 'mid' | 'small'>('macro');
  const [activeMid, setActiveMid] = useState<MapMidLocation | null>(null);
  const [activeSmall, setActiveSmall] = useState<MapSmallLocation | null>(null);
  
  // UI State
  const [showLayers, setShowLayers] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showFloorSelect, setShowFloorSelect] = useState(false);
  const [viewingFloor, setViewingFloor] = useState(floor);
  const [selectedLocation, setSelectedLocation] = useState<{
    name: string;
    type?: string;
    description?: string;
    coordinates: GeoPoint;
    floor?: number;
  } | null>(null);
  const [touchMoved, setTouchMoved] = useState(false);
  
  // Layers State
  const [showTerritories, setShowTerritories] = useState(true);
  const [showNPCs, setShowNPCs] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchStartRef = useRef({ x: 0, y: 0 });

  // Initial Data (Fallback if undefined)
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
      const targetScale = Math.max(0.3, Math.min(desiredScale, 2.0));
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
          const targetScale = 0.5; 
          setOffset({
              x: -currentPos.x * targetScale + clientWidth / 2,
              y: -currentPos.y * targetScale + clientHeight / 2
          });
          setScale(targetScale);
          setViewingFloor(floor);
      }
  };

  // Initial Center & Sync with Prop Updates
  useEffect(() => {
      setViewingFloor(floor);
      resolveAutoView();
      setTimeout(() => centerOnPlayer(), 100);
  }, [currentPos, floor, location, worldMap]); 

  useEffect(() => {
      if (viewingFloor !== 0) return;
      if (viewMode === 'mid' && activeMid) {
          centerOnArea(activeMid.area?.center || activeMid.coordinates, activeMid.area);
      }
      if (viewMode === 'macro') {
          centerOnPlayer();
      }
  }, [viewMode, activeMid, viewingFloor]);

  useEffect(() => {
      setSelectedLocation(null);
  }, [viewingFloor]);

  useEffect(() => {
      if (viewMode === 'small') {
          setSelectedLocation(null);
          setShowLayers(false);
          setShowLegend(false);
      }
  }, [viewMode]);

  useEffect(() => {
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
  }, [mapData, scale, offset, viewingFloor, showTerritories, showNPCs, floor, currentPos, confidants, viewMode]);

  // --- Zoom Logic (Visual Center) ---
  const applyZoom = (deltaScale: number) => {
      if (viewMode === 'small') return;
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      
      const newScale = Math.min(Math.max(0.05, scale + deltaScale), 3.0);
      if (Math.abs(newScale - scale) < 0.0001) return;

      const cx = clientWidth / 2;
      const cy = clientHeight / 2;

      const mapX = (cx - offset.x) / scale;
      const mapY = (cy - offset.y) / scale;

      const newOffsetX = cx - (mapX * newScale);
      const newOffsetY = cy - (mapY * newScale);

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
  };


  // --- Touch Pan Logic ---
  const handleTouchStart = (e: React.TouchEvent) => {
      if (viewMode === 'small') return;
      if(e.touches.length === 1) {
          setIsDragging(true);
          setTouchMoved(false);
          touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (viewMode === 'small') return;
      if (isDragging && e.touches.length === 1) {
          const dx = e.touches[0].clientX - touchStartRef.current.x;
          const dy = e.touches[0].clientY - touchStartRef.current.y;
          if (!touchMoved && Math.hypot(dx, dy) > 6) setTouchMoved(true);
          setOffset({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
      }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (viewMode === 'small') return;
      setIsDragging(false);
      if (touchMoved) {
          setTouchMoved(false);
          return;
      }
      const touch = e.changedTouches[0];
      if (!touch) return;
      const loc = findLocationAt(touch.clientX, touch.clientY);
      if (loc) {
          setSelectedLocation({
              name: loc.name,
              type: loc.type,
              description: loc.description,
              coordinates: loc.coordinates,
              floor: loc.floor
          });
      } else {
          setSelectedLocation(null);
      }
  };

  const findLocationAt = (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const mapX = (clientX - rect.left - offset.x) / scale;
      const mapY = (clientY - rect.top - offset.y) / scale;
      return mapData.surfaceLocations
          .filter(l => (l.floor || 0) === viewingFloor)
          .find(l => {
              const dx = mapX - l.coordinates.x;
              const dy = mapY - l.coordinates.y;
              return Math.hypot(dx, dy) <= l.radius;
          }) || null;
  };

  const getLocationTypeLabel = (type?: string) => {
      if (!type) return '地点';
      if (type === 'GUILD') return '公会';
      if (type === 'SHOP') return '商店';
      if (type === 'FAMILIA_HOME') return '眷族据点';
      if (type === 'DUNGEON_GATE' || type === 'DUNGEON_ENTRANCE') return '入口';
      return '地点';
  };

  const renderSmallLayout = () => {
      if (!activeSmall?.layout) {
          return (
              <div className="flex-1 bg-[#050a14] flex items-center justify-center text-zinc-400 text-xs">
                  未找到小地点布局数据
              </div>
          );
      }
      const layout = activeSmall.layout;
      const unit = 10;
      return (
          <div className="flex-1 bg-[#050a14] overflow-auto">
              <div className="p-4 flex flex-col items-center gap-3">
                  <div className="text-[10px] text-blue-300 font-mono uppercase tracking-widest">
                      小地点布局 · {activeSmall.name}
                  </div>
                  <div
                      className="relative bg-[#f4f1e8] border-2 border-zinc-800 shadow-xl"
                      style={{
                          width: layout.width * unit,
                          height: layout.height * unit,
                          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                          backgroundSize: `${unit}px ${unit}px`
                      }}
                  >
                      {layout.rooms.map(room => (
                          <div
                              key={room.id}
                              className="absolute border border-zinc-900/80 bg-white/70 text-[8px] text-zinc-800 font-bold flex items-center justify-center"
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
                              className="absolute bg-amber-600/70 border border-amber-900 text-[7px] text-white flex items-center justify-center"
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
                              className="absolute w-2.5 h-2.5 bg-blue-600 border border-blue-900 rounded-full"
                              style={{
                                  left: entrance.position.x * unit - 5,
                                  top: entrance.position.y * unit - 5
                              }}
                              title={entrance.name}
                          />
                      ))}
                  </div>
                  <div className="text-[9px] text-zinc-400 font-mono">
                      比例: {layout.scale} | 尺寸: {layout.width} × {layout.height} 米
                  </div>
              </div>
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
      setShowFloorSelect(false);
  };

  return (
    <div className="w-full h-full relative bg-[#050a14] overflow-hidden flex flex-col font-sans">
        
        {/* Map Canvas / Small Layout */}
        {viewMode === 'small' && viewingFloor === 0 ? (
            renderSmallLayout()
        ) : (
            <div 
                ref={containerRef}
                className="flex-1 w-full h-full touch-none"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>
        )}

        {/* --- UI Overlays --- */}

        {/* Floor Selection (Top Center) */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
            <button 
                onClick={() => setShowFloorSelect(!showFloorSelect)}
                className="bg-black/80 backdrop-blur-sm border border-blue-600 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg"
            >
                {viewingFloor === 0 ? "地表区域" : `地下 ${viewingFloor} 层`}
                <ChevronDown size={12} />
            </button>
            {showFloorSelect && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-40 bg-zinc-900 border border-zinc-700 rounded shadow-xl max-h-60 overflow-y-auto custom-scrollbar flex flex-col">
                    <button onClick={() => handleSelectFloor(0)} className="p-3 text-xs text-left text-white border-b border-zinc-800 hover:bg-blue-900">
                        地表 (欧拉丽)
                    </button>
                    {Array.from({length: 50}, (_, i) => i + 1).map(f => (
                        <button 
                            key={f} 
                            onClick={() => handleSelectFloor(f)}
                            className={`p-3 text-xs text-left border-b border-zinc-800 hover:bg-zinc-800 ${f === floor ? 'text-green-500 font-bold' : 'text-zinc-400'}`}
                        >
                            地下 {f} 层 {f === floor ? '(当前)' : ''}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {viewingFloor === 0 && (
            <div className="absolute top-28 left-1/2 -translate-x-1/2 z-20 bg-black/80 border border-blue-600 rounded-full overflow-hidden flex text-[10px] font-bold">
                <button
                    onClick={() => setViewMode('macro')}
                    className={`px-3 py-1.5 ${viewMode === 'macro' ? 'bg-blue-600 text-white' : 'text-zinc-300'}`}
                >
                    大地图
                </button>
                <button
                    onClick={() => activeMid && setViewMode('mid')}
                    className={`px-3 py-1.5 ${viewMode === 'mid' ? 'bg-blue-600 text-white' : activeMid ? 'text-zinc-300' : 'text-zinc-600'}`}
                >
                    中地点
                </button>
                <button
                    onClick={() => activeSmall && setViewMode('small')}
                    className={`px-3 py-1.5 ${viewMode === 'small' ? 'bg-blue-600 text-white' : activeSmall ? 'text-zinc-300' : 'text-zinc-600'}`}
                >
                    小地点
                </button>
            </div>
        )}

        {/* Coordinates Pill */}
        <div className="absolute top-4 left-4 bg-black/80 px-3 py-1.5 rounded-full text-xs text-white border border-zinc-700 pointer-events-none flex items-center gap-2 backdrop-blur-sm shadow-lg z-10">
            <Target size={14} className="text-blue-500"/>
            <span className="font-mono">{Math.round(currentPos.x)}, {Math.round(currentPos.y)}</span>
        </div>

        {/* Right Controls Group */}
        {!(viewMode === 'small' && viewingFloor === 0) && (
        <div className="absolute bottom-24 right-4 flex flex-col gap-3 z-20">
            {/* Layer Toggle */}
            <button 
                onClick={() => setShowLayers(!showLayers)}
                className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-lg transition-colors ${showLayers ? 'bg-blue-600 text-white border-blue-400' : 'bg-zinc-800 text-zinc-400 border-zinc-600'}`}
            >
                <Layers size={20} />
            </button>

            {/* Layer Menu (Popup) */}
            {showLayers && (
                <div className="absolute right-14 bottom-0 bg-black/90 border border-zinc-700 rounded-lg p-3 w-40 flex flex-col gap-2 shadow-xl animate-in slide-in-from-right-4 fade-in">
                    <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">图层控制</div>
                    <button onClick={() => setShowTerritories(!showTerritories)} className={`flex items-center gap-2 text-xs px-2 py-2 rounded border ${showTerritories ? 'bg-blue-900/30 text-blue-300 border-blue-800' : 'bg-transparent text-zinc-500 border-zinc-800'}`}>
                        {showTerritories ? <Eye size={12}/> : <EyeOff size={12}/>} <span>领地</span>
                    </button>
                    <button onClick={() => setShowNPCs(!showNPCs)} className={`flex items-center gap-2 text-xs px-2 py-2 rounded border ${showNPCs ? 'bg-blue-900/30 text-blue-300 border-blue-800' : 'bg-transparent text-zinc-500 border-zinc-800'}`}>
                        {showNPCs ? <Eye size={12}/> : <EyeOff size={12}/>} <span>人物</span>
                    </button>
                </div>
            )}

            <div className="h-px bg-zinc-700/50 my-1" />

            {/* Zoom Controls */}
            <button onClick={() => applyZoom(0.1)} className="w-12 h-12 bg-zinc-800/90 text-white rounded-full flex items-center justify-center border border-zinc-600 shadow-lg active:scale-95">
                <Plus size={24}/>
            </button>
            <button onClick={() => applyZoom(-0.1)} className="w-12 h-12 bg-zinc-800/90 text-white rounded-full flex items-center justify-center border border-zinc-600 shadow-lg active:scale-95">
                <Minus size={24}/>
            </button>
            <button onClick={centerOnPlayer} className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center border border-blue-400 shadow-lg active:scale-95">
                <Target size={24}/>
            </button>
        </div>
        )}

        {/* Legend Button (Bottom Left) */}
        {!(viewMode === 'small' && viewingFloor === 0) && (
            <button 
                onClick={() => setShowLegend(!showLegend)}
                className={`absolute bottom-24 left-4 p-2 rounded-lg border flex items-center gap-2 shadow-lg backdrop-blur-sm transition-colors z-20 ${showLegend ? 'bg-white text-black border-white' : 'bg-black/60 text-zinc-300 border-zinc-600'}`}
            >
                <Info size={16} />
                <span className="text-xs font-bold uppercase">图例</span>
            </button>
        )}

        {/* Legend Sheet Overlay */}
        {showLegend && (
            <>
                <div className="absolute inset-0 bg-black/40 z-30 animate-in fade-in duration-200" onClick={() => setShowLegend(false)} />
                <div className="absolute bottom-0 left-0 w-full bg-zinc-900 border-t border-blue-600 p-4 pb-6 z-40 animate-in slide-in-from-bottom-full rounded-t-2xl shadow-2xl">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-white font-display uppercase tracking-widest text-sm flex items-center gap-2">
                            <Info size={16} className="text-blue-500" />
                            势力 & 地标
                        </h4>
                        <button onClick={() => setShowLegend(false)} className="bg-zinc-800 p-1.5 rounded-full text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors">
                            <X size={16}/>
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar">
                        {mapData.factions.map(f => (
                            <div key={f.id} className="flex items-center gap-3 bg-black/50 p-2.5 rounded border border-zinc-800/50">
                                <div className="w-3 h-3 rounded-full border shadow-[0_0_5px_currentColor]" style={{ backgroundColor: f.color, borderColor: f.borderColor, color: f.color }} />
                                <span className="text-xs text-zinc-300 font-bold truncate">{f.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        )}

        {selectedLocation && (
            <div className="absolute bottom-0 left-0 w-full z-30 p-4 pb-safe">
                <div className="bg-black/90 border border-blue-600 rounded-xl p-4 shadow-2xl">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-blue-400">地点详情</div>
                            <div className="text-lg font-display text-white">{selectedLocation.name}</div>
                            <div className="text-[10px] text-blue-200 font-mono uppercase">
                                {getLocationTypeLabel(selectedLocation.type)} · {selectedLocation.floor ? `地下 ${selectedLocation.floor} 层` : '地表'}
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedLocation(null)}
                            className="text-zinc-400 hover:text-white transition-colors"
                            aria-label="关闭地点详情"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    {selectedLocation.description && (
                        <p className="mt-2 text-xs text-zinc-300 leading-relaxed">
                            {selectedLocation.description}
                        </p>
                    )}
                    <div className="mt-2 text-[10px] text-zinc-400 font-mono">
                        坐标: {Math.round(selectedLocation.coordinates.x)}, {Math.round(selectedLocation.coordinates.y)}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

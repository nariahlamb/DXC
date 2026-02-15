import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Map as MapIcon, ChevronDown, X, Locate, Plus, Minus, Target, RotateCcw, Layers, Eye, EyeOff } from 'lucide-react';
import { WorldMapData, GeoPoint, Confidant, MapMidLocation } from '../../../types';
import { computeZoomAnchor } from '../../../utils/mapMath';
import { ModalWrapper } from '../../ui/ModalWrapper';
import { MapStructureSVG } from '../map/MapStructureSVG';
import { useMapInteraction } from '../map/hooks/useMapInteraction';
import { useMapRender } from '../map/hooks/useMapRender';
import { parseMapStructure } from '../../../utils/mapStructure';
import { createEmptyWorldMap, resolveDailyMapViewState, matchLocationName } from '../../../utils/mapViewModel';

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldMap?: WorldMapData; 
  currentPos?: GeoPoint; 
  floor?: number;
  location?: string;
  playerName?: string;
  confidants?: Confidant[];
  onRequestMapUpdate?: (locationName?: string) => void;
  isMapUpdating?: boolean;
}

export const MapModal: React.FC<MapModalProps> = ({
  isOpen, 
  onClose, 
  worldMap,
  currentPos = { x: 5000, y: 5000 }, 
  floor = 0,
  location,
  playerName = "YOU",
  confidants = [],
  onRequestMapUpdate,
  isMapUpdating = false
}) => {
  // Enhanced Scale: Limit minimum scale to 0.05 to allow full map view
  const [scale, setScale] = useState(0.08); 
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'macro' | 'mid'>('macro');
  const [activeMid, setActiveMid] = useState<MapMidLocation | null>(null);
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null);
  const [selectedMidId, setSelectedMidId] = useState<string | null>(null);

  // Layout pan/zoom (for mid layouts)
  const [layoutScale, setLayoutScale] = useState(1);
  const [layoutOffset, setLayoutOffset] = useState({ x: 0, y: 0 });
  
  // Navigation State
  const [viewingFloor, setViewingFloor] = useState<number>(floor);
  const [isFloorMenuOpen, setIsFloorMenuOpen] = useState(false); 

  // Layer Toggles - Removed Routes
  const [showTerritories, setShowTerritories] = useState(true);
  const [showNPCs, setShowNPCs] = useState(true);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  const [jumpCoord, setJumpCoord] = useState({ x: '', y: '' });

  // Hover State
  const [hoverInfo, setHoverInfo] = useState<{title: string, sub?: string, desc?: string, x: number, y: number} | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutContainerRef = useRef<HTMLDivElement>(null);
  const hasAutoInitRef = useRef(false);
  const lastResolvedSignalRef = useRef<string>('');
  const autoMapRequestKeyRef = useRef<string>('');

  // Initial Data
  const mapData = {
      ...createEmptyWorldMap(),
      ...(worldMap || {})
  };

  const mapStructure = useMemo(() => {
      if (viewMode === 'mid' && activeMid) {
          return parseMapStructure(activeMid.mapStructure ?? null);
      }
      return null;
  }, [viewingFloor, viewMode, activeMid]);

  const isLayoutView = viewMode === 'mid';

  const macroLocations = mapData.macroLocations || [];
  const midLocations = mapData.midLocations || [];

  const resolveAutoView = () => {
      const resolved = resolveDailyMapViewState(mapData, location, floor, currentPos);
      setViewMode(resolved.viewMode);
      setActiveMid(resolved.activeMid);
      setSelectedMacroId(resolved.selectedMacroId);
      setSelectedMidId(resolved.selectedMidId);
  };

  const getStructureSize = (area?: { width?: number; height?: number }) => ({
      width: area?.width ?? mapStructure?.mapSize.width ?? 800,
      height: area?.height ?? mapStructure?.mapSize.height ?? 600
  });

  const centerLayoutOnPoint = (localX: number, localY: number) => {
      const container = layoutContainerRef.current;
      if (!container) return;
      const { clientWidth, clientHeight } = container;
      const targetOffset = {
          x: clientWidth / 2 - localX * layoutScale,
          y: clientHeight / 2 - localY * layoutScale
      };
      setLayoutOffset(targetOffset);
  };

  const centerOnArea = (center: GeoPoint, area?: { radius?: number; width?: number; height?: number }) => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const diameter = area?.radius ? area.radius * 2 : (area?.width && area?.height ? Math.max(area.width, area.height) : 1200);
      const desiredScale = Math.min(clientWidth / diameter, clientHeight / diameter) * 0.8;
      const targetScale = Math.max(0.05, Math.min(desiredScale, 2.0));
      setOffset({
          x: -center.x * targetScale + clientWidth / 2,
          y: -center.y * targetScale + clientHeight / 2
      });
      setScale(targetScale);
  };

  const centerOnStructure = (area?: { center?: GeoPoint; width?: number; height?: number }) => {
      if (!mapStructure) return;
      const { width: layoutWidth, height: layoutHeight } = getStructureSize(area);
      const target = { x: layoutWidth / 2, y: layoutHeight / 2 };
      centerLayoutOnPoint(target.x, target.y);
  };

  const fitStructureToScreen = (area?: { width?: number; height?: number }) => {
      const container = layoutContainerRef.current;
      if (!container) return;
      const { width: layoutWidth, height: layoutHeight } = getStructureSize(area);
      // Use 0.8 factor for more breathing room (less crowded edges)
      const targetScale = Math.min(container.clientWidth / layoutWidth, container.clientHeight / layoutHeight) * 0.8;
      // Allow slightly wider zoom range
      const safeScale = Math.max(0.15, Math.min(targetScale, 4.0));
      setLayoutScale(safeScale);
      setLayoutOffset({
          x: (container.clientWidth - layoutWidth * safeScale) / 2,
          y: (container.clientHeight - layoutHeight * safeScale) / 2
      });
  };

  const resetToPlayerView = () => {
      setViewingFloor(floor);
      resolveAutoView();
      setTimeout(() => centerOnPlayer(), 0);
  };

  const selectMacroById = (id: string) => {
      const macro = macroLocations.find(m => m.id === id) || null;
      setSelectedMacroId(id);
      setSelectedMidId(null);
      setActiveMid(null);
      setViewMode('macro');
      if (macro) {
          centerOnArea(macro.area?.center || macro.coordinates, macro.area);
      } else {
          centerOnPlayer();
      }
  };

  const selectMidById = (id: string) => {
      const mid = midLocations.find(m => m.id === id) || null;
      setSelectedMidId(id);
      setSelectedMacroId(mid?.parentId || selectedMacroId || null);
      setActiveMid(mid);
      setViewMode('mid');
  };

  const centerOnPlayer = () => {
      if (isLayoutView) {
          centerOnStructure(activeMid?.area);
          return;
      }
      if (containerRef.current) {
          const { clientWidth, clientHeight } = containerRef.current;
          // Auto-fit logic for macro view
          const fitScale = Math.min(clientWidth / mapData.config.width, clientHeight / mapData.config.height) * 0.85;
          const targetScale = Math.max(0.08, fitScale); // Minimum zoom bumped up slightly for clarity
          setOffset({
              x: -currentPos.x * targetScale + clientWidth / 2,
              y: -currentPos.y * targetScale + clientHeight / 2
          });
          setScale(targetScale);
      }
  };

  const handleJumpToCoord = () => {
      const x = parseFloat(jumpCoord.x);
      const y = parseFloat(jumpCoord.y);
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      if (isLayoutView) {
          const { width: layoutWidth, height: layoutHeight } = getStructureSize(activeMid?.area);
          const clampedX = Math.max(0, Math.min(x, layoutWidth));
          const clampedY = Math.max(0, Math.min(y, layoutHeight));
          centerLayoutOnPoint(clampedX, clampedY);
          return;
      }
      const container = containerRef.current;
      if (!container) return;
      const { clientWidth, clientHeight } = container;
      setOffset({
          x: -x * scale + clientWidth / 2,
          y: -y * scale + clientHeight / 2
      });
  };

  useEffect(() => {
      if (!isOpen) {
          hasAutoInitRef.current = false;
          lastResolvedSignalRef.current = '';
          autoMapRequestKeyRef.current = '';
          return;
      }
      if (!hasAutoInitRef.current) {
          setViewingFloor(floor);
          resolveAutoView();
          setTimeout(() => centerOnPlayer(), 100);
          hasAutoInitRef.current = true;
      }
  }, [isOpen, floor]);

  useEffect(() => {
      if (!isOpen || !isLayoutView || !!mapStructure || !onRequestMapUpdate || isMapUpdating) return;
      const targetId = activeMid?.id || 'mid-none';
      const requestKey = `${viewMode}|${targetId}|${location || ''}|${viewingFloor}`;
      if (autoMapRequestKeyRef.current === requestKey) return;
      autoMapRequestKeyRef.current = requestKey;
      onRequestMapUpdate(activeMid?.name || location);
  }, [isOpen, isLayoutView, mapStructure, onRequestMapUpdate, isMapUpdating, viewMode, activeMid?.id, activeMid?.name, location, viewingFloor]);

  useEffect(() => {
      if (mapStructure) {
          autoMapRequestKeyRef.current = '';
      }
  }, [mapStructure, viewMode]);

  useEffect(() => {
      if (!isOpen) return;
      const signal = `${location || ''}|${floor}|${mapData.midLocations?.length || 0}`;
      if (lastResolvedSignalRef.current === signal) return;
      lastResolvedSignalRef.current = signal;
      setViewingFloor(floor);
      resolveAutoView();
      setTimeout(() => centerOnPlayer(), 0);
  }, [isOpen, location, floor, mapData.midLocations?.length, currentPos.x, currentPos.y]);

  useEffect(() => {
      if (!isOpen) return;
      if (viewMode === 'mid') {
          const targetMidId = selectedMidId || activeMid?.id || null;
          const nextMid = targetMidId ? midLocations.find(m => m.id === targetMidId) || null : null;
          if (nextMid !== activeMid) setActiveMid(nextMid);
      }
  }, [isOpen, viewingFloor, viewMode, selectedMidId, worldMap]);

  // Intentionally avoid auto-switching map view on updates.

  useEffect(() => {
      if (!isOpen) return;
      if (viewMode === 'macro') {
          centerOnPlayer();
      }
  }, [viewMode, activeMid, viewingFloor, isOpen]);

  useEffect(() => {
      if (!isOpen) return;
      const macro = macroLocations[0];
      if (macro && !selectedMacroId) {
          setSelectedMacroId(macro.id);
      }
      if (activeMid?.id) setSelectedMidId(activeMid.id);
  }, [isOpen, macroLocations.length, activeMid, selectedMacroId]);

  useEffect(() => {
      if (isLayoutView) {
          setHoverInfo(null);
      }
  }, [viewMode, isLayoutView]);

  useEffect(() => {
      if (!isLayoutView) return;
      setLayoutScale(1);
      setLayoutOffset({ x: 0, y: 0 });
      setTimeout(() => fitStructureToScreen(activeMid?.area), 0);
  }, [isLayoutView, viewMode, activeMid]);

  const mapInteraction = useMapInteraction({
      enabled: isOpen && !isLayoutView,
      containerRef,
      scale,
      setScale,
      offset,
      setOffset,
      onHover: updateHoverInfo
  });

  const layoutInteraction = useMapInteraction({
      enabled: isOpen && isLayoutView,
      containerRef: layoutContainerRef,
      scale: layoutScale,
      setScale: setLayoutScale,
      offset: layoutOffset,
      setOffset: setLayoutOffset
  });

  useMapRender({
      enabled: isOpen && !isLayoutView,
      canvasRef,
      containerRef,
      mapData,
      floor: viewingFloor,
      scale,
      offset,
      showTerritories,
      showNPCs,
      showPlayer: viewingFloor === floor || viewingFloor === 0,
      showLabels: true,
      currentPos,
      confidants
  });

  if (!isOpen) return null;

  // --- Zoom Logic ---
  const applyZoom = (deltaScale: number, containerCenterX?: number, containerCenterY?: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const anchor = {
          x: containerCenterX !== undefined ? containerCenterX : rect.width / 2,
          y: containerCenterY !== undefined ? containerCenterY : rect.height / 2
      };
      const result = computeZoomAnchor({ scale, offset, deltaScale, anchor });
      setScale(result.scale);
      setOffset(result.offset);
  };

  const applyLayoutZoom = (deltaScale: number, containerCenterX?: number, containerCenterY?: number) => {
      const rect = layoutContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const anchor = {
          x: containerCenterX !== undefined ? containerCenterX : rect.width / 2,
          y: containerCenterY !== undefined ? containerCenterY : rect.height / 2
      };
      const result = computeZoomAnchor({ scale: layoutScale, offset: layoutOffset, deltaScale, anchor });
      setLayoutScale(result.scale);
      setLayoutOffset(result.offset);
  };

  const getLocationTypeLabel = (type?: string) => {
      if (!type) return '地点';
      if (type === 'GUILD') return '公会';
      if (type === 'SHOP') return '商店';
      if (type === 'FAMILIA_HOME') return '眷族据点';
      if (type === 'DUNGEON_GATE' || type === 'DUNGEON_ENTRANCE') return '入口';
      return '地标';
  };

  function updateHoverInfo(clientX: number, clientY: number) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mapX = (clientX - rect.left - offset.x) / scale;
      const mapY = (clientY - rect.top - offset.y) / scale;
      const loc = mapData.surfaceLocations
          .filter(l => (l.floor || 0) === viewingFloor && l.visited !== false)
          .find(l => {
              const dx = mapX - l.coordinates.x;
              const dy = mapY - l.coordinates.y;
              return Math.hypot(dx, dy) <= l.radius;
          });
      if (loc) {
          setHoverInfo({
              title: loc.name,
              sub: getLocationTypeLabel(loc.type),
              desc: loc.description,
              x: clientX,
              y: clientY
          });
      } else {
          setHoverInfo(null);
      }
  }

  // --- Render Components ---

  const renderSurfaceMap = () => (
      <div
          ref={containerRef}
          className="flex-1 bg-[#050505] relative overflow-hidden cursor-move"
          onMouseDown={mapInteraction.handleMouseDown}
          onMouseMove={mapInteraction.handleMouseMove}
          onMouseUp={mapInteraction.handleMouseUp}
          onMouseLeave={() => { mapInteraction.handleMouseLeave(); setHoverInfo(null); }}
          onTouchStart={mapInteraction.handleTouchStart}
          onTouchMove={mapInteraction.handleTouchMove}
          onTouchEnd={mapInteraction.handleTouchEnd}
      >
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: `linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
          }}></div>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
  );

  const renderLayoutView = (
      title: string,
      area?: { center?: GeoPoint; width?: number; height?: number }
  ) => {
      if (!mapStructure) {
          return (
              <div className="flex-1 bg-[#050505] flex items-center justify-center">
                  <div className="text-center max-w-md px-6">
                      <div className="text-zinc-300 text-sm mb-2">当前地点暂无 SVG 结构数据</div>
                      <div className="text-zinc-500 text-xs leading-relaxed">
                          请触发地图更新并返回 <span className="text-cyan-300">upsert_exploration_map</span>，写入
                          <span className="text-cyan-300"> MapStructureJSON</span>（rooms/doors/features）。
                      </div>
                      {onRequestMapUpdate && (
                          <div className="text-[11px] mt-3 text-cyan-400/85">
                               {isMapUpdating ? '正在自动请求地图更新...' : '缺失结构时会自动触发一次地图更新。'}
                          </div>
                      )}
                  </div>
              </div>
          );
      }
      const size = getStructureSize(area);
      const layoutWidth = size.width;
      const layoutHeight = size.height;
      return (
          <div
              ref={layoutContainerRef}
              className="flex-1 bg-[#050505] overflow-hidden cursor-grab relative"
              onMouseDown={layoutInteraction.handleMouseDown}
              onMouseMove={layoutInteraction.handleMouseMove}
              onMouseUp={layoutInteraction.handleMouseUp}
              onMouseLeave={layoutInteraction.handleMouseLeave}
              onTouchStart={layoutInteraction.handleTouchStart}
              onTouchMove={layoutInteraction.handleTouchMove}
              onTouchEnd={layoutInteraction.handleTouchEnd}
          >
               {/* Radial Dot Grid for Cleaner Look */}
               <div className="absolute inset-0 opacity-[0.05]" style={{
                   backgroundImage: `radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)`,
                   backgroundSize: '24px 24px'
               }}></div>

              <div className="p-6 flex flex-col items-center gap-4 relative z-10">
                  <div
                      className="relative"
                      style={{
                          transform: `translate(${layoutOffset.x}px, ${layoutOffset.y}px) scale(${layoutScale})`,
                          transformOrigin: '0 0'
                      }}
                  >
                      <MapStructureSVG data={mapStructure} />
                  </div>
              </div>

              {/* Bottom Layout Info Bar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md text-[11px] text-zinc-400">
                  <span>{mapStructure?.mapName ? `STRUCTURE · ${mapStructure.mapName}` : title}</span>
                  <div className="h-3 w-px bg-white/10" />
                  <span>{layoutWidth}m × {layoutHeight}m</span>
                  <div className="h-3 w-px bg-white/10" />
                  <button
                    onClick={() => fitStructureToScreen(area)}
                    className="hover:text-blue-400 transition-colors"
                  >
                    适配屏幕
                  </button>
              </div>
          </div>
      );
  };

  // --- Floating HUD Components ---

  const renderTopControlBar = () => {
    const isSurface = viewingFloor === 0;

    const pickDefaultMidId = () => {
        const selectedMid = selectedMidId ? midLocations.find(m => m.id === selectedMidId) || null : null;
        if (selectedMid) return selectedMidId;
        const pool = selectedMacroId
            ? midLocations.filter(m => m.parentId === selectedMacroId)
            : midLocations;
        const matchWithStructure = pool.find(m => m.mapStructure && matchLocationName(location, m.name));
        const matchByName = pool.find(m => matchLocationName(location, m.name));
        const anyWithStructure = pool.find(m => m.mapStructure);
        return (matchWithStructure || matchByName || anyWithStructure || pool[0])?.id || null;
    };
    const enterMidView = () => {
        const id = pickDefaultMidId();
        if (id) selectMidById(id);
    };

    return (
        <>
            {/* Backdrop for closing menus */}
            {isLayerMenuOpen && (
                <div 
                    className="fixed inset-0 z-[35]" 
                    onClick={() => setIsLayerMenuOpen(false)}
                />
            )}
            {/* Unified Map Header - Absolute Layout for Stability */}
            <div className="absolute top-2 md:top-4 left-2 md:left-4 right-2 md:right-4 z-40 h-14 pointer-events-none select-none">
                
                {/* Left: Title & Coordinates (Desktop Only) */}
                <div className="absolute left-0 top-0 hidden md:flex flex-col gap-1 pointer-events-auto bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl shadow-lg max-w-[250px] transition-all hover:bg-black/80">
                     <div className="flex items-center gap-2 text-blue-400 font-display font-bold text-lg tracking-wide">
                        <MapIcon className="w-5 h-5" />
                        <span>世界战术地图</span>
                     </div>
                     <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400 truncate">
                        <span>LOC: <span className="text-zinc-200">{Math.round(currentPos.x)}, {Math.round(currentPos.y)}</span></span>
                        <div className="w-px h-3 bg-white/10" />
                        <span className="text-blue-300 truncate">{location || '未知区域'}</span>
                     </div>
                </div>

                {/* Center: Controls (Floating Capsule) - Always Centered */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 pointer-events-auto w-max max-w-[calc(100%-80px)] md:max-w-[60%] flex justify-center">
                    <div className="flex items-center gap-1 md:gap-2 p-1 md:p-1.5 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl h-12 relative z-50">
                    
                    {/* 1. Floor Selector */}
                    <div className="relative group px-1 shrink-0">
                         <button 
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-full transition-colors text-zinc-300 hover:text-white"
                         >
                            <span className="text-xs font-bold whitespace-nowrap">{viewingFloor === 0 ? "欧拉丽地表" : `地下 ${viewingFloor} 层`}</span>
                            <ChevronDown size={12} className="opacity-50" />
                         </button>
                         {/* Dropdown */}
                         <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-[#0a0a0c] border border-white/10 rounded-xl overflow-hidden shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 max-h-[40vh] overflow-y-auto custom-scrollbar z-50">
                              <button onClick={() => { handleSelectFloor(0); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-blue-900/30 border-b border-white/5 transition-colors">
                                  欧拉丽地表
                              </button>
                              {Array.from({length: 50}, (_, i) => i + 1).map(f => (
                                  <button 
                                    key={f} 
                                    onClick={() => { handleSelectFloor(f); }}
                                    className={`w-full text-left px-4 py-2 text-xs hover:bg-white/5 border-b border-white/5 font-mono transition-colors ${f === viewingFloor ? 'text-emerald-500 font-bold bg-emerald-900/10' : 'text-zinc-400'}`}
                                  >
                                      地下 {f} 层 {f === viewingFloor && '📍'}
                                  </button>
                              ))}
                         </div>
                    </div>
    
                    <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />
    
                    {/* 2. View Mode (Only Surface) */}
                    {isSurface && (
                        <>
                        <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5 shrink-0">
                            <button
                                onClick={() => setViewMode('macro')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all whitespace-nowrap ${viewMode === 'macro' ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                MACRO
                            </button>
                            <button
                                onClick={enterMidView}
                                disabled={midLocations.length === 0}
                                className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all whitespace-nowrap ${viewMode === 'mid' ? 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.5)]' : 'text-zinc-500 hover:text-zinc-300 disabled:opacity-30'}`}
                            >
                                MID
                            </button>
                        </div>
                        <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />
                        </>
                    )}
    
                    {/* 3. Map Controls (Zoom/Nav) */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button 
                            onClick={() => (isLayoutView ? applyLayoutZoom(0.1) : applyZoom(0.1))}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                            title="放大"
                        >
                            <Plus size={16}/>
                        </button>
                        <button 
                            onClick={() => (isLayoutView ? applyLayoutZoom(-0.1) : applyZoom(-0.1))}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                            title="缩小"
                        >
                            <Minus size={16}/>
                        </button>
                        <button 
                            onClick={centerOnPlayer}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-full transition-all"
                            title="定位玩家"
                        >
                            <Target size={16}/>
                        </button>
                        <button 
                            onClick={resetToPlayerView}
                            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                            title="重置视图"
                        >
                            <RotateCcw size={14}/>
                        </button>
                    </div>
    
                    {/* 4. Extra Tools Group */}
                     {!isLayoutView && (
                        <>
                        <div className="w-px h-6 bg-white/10 mx-1 shrink-0" />
                        <div className="relative shrink-0">
                            <button 
                                onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
                                className={`p-1.5 rounded-full transition-all ${isLayerMenuOpen ? 'text-blue-400 bg-blue-500/20' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`}
                                title="图层控制"
                            >
                                <Layers size={16}/>
                            </button>
                            
                            {/* Dropdown Menu */}
                            {isLayerMenuOpen && (
                                <div className="absolute top-full right-0 mt-4 w-32 bg-black/90 border border-zinc-800 rounded-lg p-2 shadow-2xl backdrop-blur-xl flex flex-col gap-1 z-50">
                                    <button
                                        onClick={() => setShowTerritories(!showTerritories)}
                                        className={`flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${showTerritories ? 'text-blue-200 bg-blue-900/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        <span>领地</span>
                                        {showTerritories ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                    <button
                                        onClick={() => setShowNPCs(!showNPCs)}
                                        className={`flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${showNPCs ? 'text-blue-200 bg-blue-900/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        <span>NPC</span>
                                        {showNPCs ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                </div>
                            )}
                        </div>
                        </>
                    )}
                </div>
                </div>

                {/* Right: Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute right-0 top-0 pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-zinc-400 hover:text-white hover:bg-red-900/30 hover:border-red-500/50 transition-all shadow-lg"
                    title="关闭地图"
                >
                    <X size={20} />
                </button>
            </div>
        </>
    );
  };

  const handleSelectFloor = (nextFloor: number) => {
      setViewingFloor(nextFloor);
      if (nextFloor !== 0) {
          setViewMode('macro');
          setActiveMid(null);
      } else {
          resolveAutoView();
      }
  };

  const TitleWithCoords = () => (
      <div className="flex flex-col">
          <span>世界战术地图</span>
          <span className="text-[10px] font-mono opacity-70 tracking-normal text-blue-300">
              LOC: [{Math.round(currentPos.x)}, {Math.round(currentPos.y)}] | {location}
          </span>
      </div>
  );

  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title={<TitleWithCoords />}
        hideHeader={true}
        icon={null}
        theme="monitor"
        size="l"
        noBodyPadding={true}
    >
      <div className="w-full h-full relative flex flex-col bg-[#050505] overflow-hidden">
        
        {renderTopControlBar()}

        {/* Minimalist Legend */}
        {!isLayoutView && (
            <div className="absolute bottom-8 right-8 z-30 flex flex-col items-end gap-1 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm p-3 rounded-xl border border-white/5 space-y-2 pointer-events-auto">
                    {showTerritories && mapData.factions.map(f => (
                        <div key={f.id} className="flex items-center gap-2 text-[10px] text-zinc-400">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color, boxShadow: `0 0 4px ${f.color}` }} />
                             <span>{f.name}</span>
                        </div>
                    ))}
                     <div className="w-full h-px bg-white/5 my-1" />
                     <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                         <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]" />
                         <span>YOU</span>
                     </div>
                     {showNPCs && (
                         <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                             <div className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_4px_rgba(236,72,153,0.5)]" />
                             <span>OTHERS</span>
                         </div>
                     )}
                </div>
            </div>
        )}

        {/* Map View */}
        {isLayoutView
            ? renderLayoutView(
                viewingFloor !== 0 ? `DUNGEON B${viewingFloor}` : (activeMid?.name || "STRUCTURE"),
                activeMid?.area
              )
            : renderSurfaceMap()}

        {/* Tooltip */}
        {hoverInfo && (
            <div 
                className="fixed z-50 bg-black/80 border border-white/10 p-3 shadow-2xl pointer-events-none max-w-[200px] backdrop-blur-xl rounded-lg transform -translate-y-full mt-[-10px]"
                style={{ top: hoverInfo.y, left: hoverInfo.x }}
            >
                <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-blue-400 font-bold text-xs uppercase tracking-wider">{hoverInfo.title}</h4>
                </div>
                {hoverInfo.sub && <div className="text-[9px] text-zinc-500 uppercase mb-1">{hoverInfo.sub}</div>}
                <p className="text-zinc-300 text-[10px] leading-relaxed opacity-80">{hoverInfo.desc}</p>
            </div>
        )}

      </div>
    </ModalWrapper>
  );
};

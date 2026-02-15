
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Target, Plus, Minus, Layers, Eye, EyeOff, Map as MapIcon, Info, X, ChevronDown, ListTodo, BookOpen, Clock, GitBranch, ScrollText } from 'lucide-react';
import { WorldMapData, GeoPoint, Confidant, MapMidLocation, Task, StoryState } from '../../types';
import { MapStructureSVG } from '../game/map/MapStructureSVG';
import { useMapRender } from '../game/map/hooks/useMapRender';
import { parseMapStructure } from '../../utils/mapStructure';
import { computeZoomAnchor } from '../../utils/mapMath';
import { createEmptyWorldMap, resolveDailyMapViewState, matchLocationName } from '../../utils/mapViewModel';

const SURFACE_MIN_SCALE = 0.08;
const SURFACE_MAX_SCALE = 2.5;
const LAYOUT_MIN_SCALE = 0.25;
const LAYOUT_MAX_SCALE = 5;

interface MobileMapViewProps {
  worldMap: WorldMapData;
  currentPos: GeoPoint;
  playerName: string;
  confidants: Confidant[];
  floor: number;
  location?: string;
  tasks?: Task[];
  story?: StoryState;
  onDeleteTask?: (id: string) => void;
  onRequestMapUpdate?: (locationName?: string) => void;
  isMapUpdating?: boolean;
}

const TasksComponent: React.FC<{ tasks: Task[], onDeleteTask?: (id: string) => void }> = ({ tasks, onDeleteTask }) => {
    const [filter, setFilter] = useState<'ACTIVE' | 'COMPLETED' | 'FAILED'>('ACTIVE');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const filtered = tasks.filter(t => {
        if (filter === 'ACTIVE') return t.状态 === 'active';
        if (filter === 'COMPLETED') return t.状态 === 'completed';
        if (filter === 'FAILED') return t.状态 === 'failed';
        return true;
    });

    const getFilterLabel = (f: string) => {
        if (f === 'ACTIVE') return '进行中';
        if (f === 'COMPLETED') return '已完成';
        if (f === 'FAILED') return '失败';
        return f;
    };

    if (selectedTask) {
        return (
            <div className="h-full bg-[#050a14] p-4 overflow-y-auto">
                <button onClick={() => setSelectedTask(null)} className="mb-4 text-xs flex items-center gap-2 text-zinc-400">
                    <X size={16} /> 返回列表
                </button>
                <div className="bg-[#f0e6d2] text-[#4a3b32] p-6 shadow-xl relative min-h-[400px]">
                    <h2 className="text-2xl font-display uppercase tracking-tighter border-b-2 border-[#8b7e66] pb-2 mb-4">{selectedTask.标题}</h2>
                    <div className="flex gap-4 text-xs font-bold mb-6 text-[#786c5e]">
                        <span>等级: {selectedTask.评级}</span>
                        <span>截止: {selectedTask.截止时间 || "无"}</span>
                    </div>
                    <div className="mb-6">
                        <h4 className="font-bold uppercase tracking-widest text-[#8b7e66] mb-2 text-xs">描述</h4>
                        <p className="leading-relaxed text-sm whitespace-pre-wrap">{selectedTask.描述}</p>
                    </div>
                    <div className="bg-[#e6dbc4] p-3 border border-[#cfc4ad] mb-6">
                        <h4 className="font-bold uppercase tracking-widest text-[#8b7e66] mb-1 text-xs">奖励</h4>
                        <p className="font-bold">{selectedTask.奖励}</p>
                    </div>
                    {selectedTask.日志 && selectedTask.日志.length > 0 && (
                        <div className="border-t-2 border-[#8b7e66] pt-4">
                            <h4 className="font-bold uppercase tracking-widest text-[#8b7e66] mb-3 text-xs">历史记录</h4>
                            <div className="space-y-2">
                                {selectedTask.日志.map((log, idx) => (
                                    <div key={idx} className="flex gap-2 text-xs">
                                        <span className="font-mono text-[#8b7e66] bg-[#ded3be] px-1">{log.时间戳}</span>
                                        <span>{log.内容}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#0a0c10]">
            <div className="flex border-b border-white/5 bg-[#0e1217]">
                {['ACTIVE', 'COMPLETED', 'FAILED'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f as any)}
                        className={`flex-1 py-3 text-[10px] font-bold uppercase transition-colors ${filter === f ? 'bg-accent-gold text-surface-base' : 'text-content-muted hover:text-content-primary'}`}
                    >
                        {getFilterLabel(f)}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filtered.map(t => (
                    <div
                        key={t.id}
                        onClick={() => setSelectedTask(t)}
                        className={`p-3 border-l-4 cursor-pointer bg-[#151921] border-zinc-700 active:bg-zinc-800 transition-all rounded-r`}
                    >
                        <div className="font-bold text-xs text-slate-200 truncate mb-1">{t.标题}</div>
                        <div className="flex justify-between text-[10px] text-zinc-500">
                            <span className={`px-1 border rounded-sm ${t.评级 === 'S' ? 'border-yellow-500 text-yellow-500' : 'border-zinc-600'}`}>{t.评级}</span>
                            <span>{t.奖励}</span>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="text-center py-10 text-zinc-600 text-xs">无任务</div>
                )}
            </div>
        </div>
    );
};

const StoryComponent: React.FC<{ story: StoryState }> = ({ story }) => {
    const safeStory = story || {
        主线: { 当前卷数: 1, 当前篇章: "Unknown", 当前阶段: "Unknown", 关键节点: "Unknown", 节点状态: "Unknown" },
        引导: { 当前目标: "暂无目标" },
        时间轴: {},
        路线: { 是否正史: true, 偏移度: 0 },
        待触发: [],
        里程碑: []
    };

    return (
        <div className="h-full bg-[#0a0c10] overflow-y-auto custom-scrollbar p-6">
            <div className="space-y-8">
                <div className="text-center">
                    <BookOpen size={32} className="text-green-600 mx-auto mb-2" />
                    <h2 className="text-[10px] text-zinc-500 uppercase tracking-[0.5em] mb-1">Vol.{safeStory.主线?.当前卷数}</h2>
                    <h1 className="text-2xl font-display uppercase text-white">{safeStory.主线?.当前篇章}</h1>
                </div>

                <div className="bg-[#151921] border-l-2 border-green-600 p-4 rounded-r">
                    <div className="flex items-center gap-2 text-green-500 font-bold uppercase tracking-wider text-[10px] mb-2">
                        <Target size={12} /> 当前目标
                    </div>
                    <div className="text-sm text-white font-bold leading-relaxed">{safeStory.引导?.当前目标}</div>
                    {(safeStory.引导 as any)?.行动提示 && <div className="text-xs text-zinc-500 mt-2">{(safeStory.引导 as any).行动提示}</div>}
                </div>

                <div className="bg-[#151921] border border-white/5 p-4 rounded">
                    <div className="text-zinc-400 uppercase tracking-widest text-[10px] mb-3 font-bold flex items-center gap-2">
                        <Clock size={12} /> 里程碑
                    </div>
                    <div className="space-y-3">
                        {(safeStory.里程碑 || []).map((m: any, i: number) => (
                            <div key={i} className="flex gap-3 border-b border-white/5 pb-2 last:border-0 text-xs">
                                <span className="text-green-500 font-mono shrink-0">{m.时间}</span>
                                <span className="text-zinc-300">{m.事件}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const MobileMapView: React.FC<MobileMapViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<'MAP' | 'QUESTS' | 'STORY'>('MAP');

  // Zoom & Pan State (Keep existing Map Logic)
  const [scale, setScale] = useState(0.35);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'macro' | 'mid'>('macro');
  const [activeMid, setActiveMid] = useState<MapMidLocation | null>(null);
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null);
  const [selectedMidId, setSelectedMidId] = useState<string | null>(null);
  const [layoutScale, setLayoutScale] = useState(1);
  const [layoutOffset, setLayoutOffset] = useState({ x: 0, y: 0 });
  const [layoutDragging, setLayoutDragging] = useState(false);
  const [layoutDragStart, setLayoutDragStart] = useState({ x: 0, y: 0 });
  const [showLayers, setShowLayers] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showFloorSelect, setShowFloorSelect] = useState(false);
  const [viewingFloor, setViewingFloor] = useState(props.floor);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [touchMoved, setTouchMoved] = useState(false);
  const [showTerritories, setShowTerritories] = useState(true);
  const [showNPCs, setShowNPCs] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const autoMapRequestKeyRef = useRef<string>('');
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null);
  const layoutPinchStartRef = useRef<{ distance: number; scale: number } | null>(null);

  const mapData = {
      ...createEmptyWorldMap(),
      ...(props.worldMap || {})
  };
  const macroLocations = mapData.macroLocations || [];
  const midLocations = mapData.midLocations || [];
  const macroCandidates = useMemo(() => {
      const withChildren = macroLocations.filter(macro => midLocations.some(mid => mid.parentId === macro.id));
      return withChildren.length > 0 ? withChildren : macroLocations;
  }, [macroLocations, midLocations]);
  const mapStructure = useMemo(() => {
      if (viewMode === 'mid' && activeMid) {
          return parseMapStructure(activeMid.mapStructure ?? null);
      }
      return null;
  }, [viewingFloor, viewMode, activeMid]);
  const isLayoutView = viewMode === 'mid';

  const pickDefaultMidId = useCallback((macroId?: string | null, locationName?: string) => {
      const scopedPool = midLocations.filter(mid => !macroId || mid.parentId === macroId);
      const pool = scopedPool.length > 0 ? scopedPool : midLocations;
      if (pool.length === 0) return null;

      const renderablePool = pool.filter(mid => !!mid.mapStructure);
      const byNameWithStructure = renderablePool.find(mid => matchLocationName(locationName || props.location, mid.name));
      const anyRenderable = renderablePool[0] || null;
      const byName = pool.find(mid => matchLocationName(locationName || props.location, mid.name)) || null;

      return (byNameWithStructure || anyRenderable || byName || pool[0])?.id || null;
  }, [midLocations, props.location]);

  const applyResolvedDailyView = (floorValue: number, locationName?: string) => {
      const resolved = resolveDailyMapViewState(mapData, locationName, floorValue, props.currentPos);

      // 对齐 PC MapModal：直接使用 resolveDailyMapViewState 的结果，
      // 避免在局部地图场景下被二次回退到错误 mid（常表现为“公会本部”）。
      setViewMode(resolved.viewMode);
      setActiveMid(resolved.activeMid);
      setSelectedMacroId(resolved.selectedMacroId);
      setSelectedMidId(resolved.selectedMidId);
  };

  const selectMacroById = (id: string) => {
      const macro = macroLocations.find(item => item.id === id);
      setSelectedMacroId(id);
      setSelectedMidId(null);
      setActiveMid(null);
      setViewMode('macro');
      if (!containerRef.current || !macro) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const center = macro.area?.center || macro.coordinates;
      setOffset({ x: -center.x * scale + clientWidth / 2, y: -center.y * scale + clientHeight / 2 });
  };

  const selectMidById = (id: string) => {
      const mid = midLocations.find(item => item.id === id) || null;
      setSelectedMidId(id);
      setSelectedMacroId(mid?.parentId || selectedMacroId || null);
      setActiveMid(mid);
      setViewMode('mid');
  };

  const enterMidView = () => {
      const preferredId = pickDefaultMidId(selectedMacroId, props.location);
      if (preferredId) {
          selectMidById(preferredId);
      }
  };

  useEffect(() => {
      setViewingFloor(props.floor);
      applyResolvedDailyView(props.floor, props.location);
      setTimeout(() => {
          if (containerRef.current) {
              const { clientWidth, clientHeight } = containerRef.current;
              const fitScale = Math.min(clientWidth / mapData.config.width, clientHeight / mapData.config.height) * 0.85;
              const targetScale = Math.max(SURFACE_MIN_SCALE, Math.min(fitScale, 0.7));
              setScale(targetScale);
              setOffset({
                  x: -props.currentPos.x * targetScale + clientWidth / 2,
                  y: -props.currentPos.y * targetScale + clientHeight / 2
              });
          }
      }, 100);
  }, [props.floor, props.location, props.worldMap]);

  useMapRender({
      enabled: activeTab === 'MAP' && !isLayoutView,
      canvasRef,
      containerRef,
      mapData,
      floor: viewingFloor,
      scale,
      offset,
      showTerritories,
      showNPCs,
      showPlayer: viewingFloor === props.floor || viewingFloor === 0,
      showLabels: true,
      currentPos: props.currentPos,
      confidants: props.confidants
  });

  const fitStructureToScreen = useCallback(() => {
      if (!mapStructure || !layoutContainerRef.current) return;
      const container = layoutContainerRef.current;
      const targetScale = Math.min(
          container.clientWidth / mapStructure.mapSize.width,
          container.clientHeight / mapStructure.mapSize.height
      ) * 0.9;
      const safeScale = Math.max(LAYOUT_MIN_SCALE, Math.min(targetScale, LAYOUT_MAX_SCALE));
      setLayoutScale(safeScale);
      setLayoutOffset({
          x: (container.clientWidth - mapStructure.mapSize.width * safeScale) / 2,
          y: (container.clientHeight - mapStructure.mapSize.height * safeScale) / 2
      });
  }, [mapStructure]);

  const fitSurfaceToScreen = useCallback((focus?: GeoPoint) => {
      if (!containerRef.current) return;
      const center = focus || props.currentPos;
      const { clientWidth, clientHeight } = containerRef.current;
      const fitScale = Math.min(clientWidth / mapData.config.width, clientHeight / mapData.config.height) * 0.85;
      const targetScale = Math.max(SURFACE_MIN_SCALE, Math.min(fitScale, 0.7));
      setScale(targetScale);
      setOffset({
          x: -center.x * targetScale + clientWidth / 2,
          y: -center.y * targetScale + clientHeight / 2
      });
  }, [props.currentPos, mapData.config.width, mapData.config.height]);

  const applySurfaceZoom = useCallback((deltaScale: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const targetScale = Math.max(SURFACE_MIN_SCALE, Math.min(scale + deltaScale, SURFACE_MAX_SCALE));
      const safeDelta = targetScale - scale;
      if (safeDelta === 0) return;
      const result = computeZoomAnchor({
          scale,
          offset,
          deltaScale: safeDelta,
          anchor: { x: rect.width / 2, y: rect.height / 2 }
      });
      setScale(result.scale);
      setOffset(result.offset);
  }, [scale, offset]);

  const applyLayoutZoom = useCallback((deltaScale: number) => {
      const rect = layoutContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const targetScale = Math.max(LAYOUT_MIN_SCALE, Math.min(layoutScale + deltaScale, LAYOUT_MAX_SCALE));
      const safeDelta = targetScale - layoutScale;
      if (safeDelta === 0) return;
      const result = computeZoomAnchor({
          scale: layoutScale,
          offset: layoutOffset,
          deltaScale: safeDelta,
          anchor: { x: rect.width / 2, y: rect.height / 2 }
      });
      setLayoutScale(result.scale);
      setLayoutOffset(result.offset);
  }, [layoutScale, layoutOffset]);

  const getTouchDistance = (touches: React.TouchList) => {
      const first = touches[0];
      const second = touches[1];
      if (!first || !second) return 0;
      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  };

  useEffect(() => {
      if (activeTab !== 'MAP' || !isLayoutView || !mapStructure) return;
      const timer = window.setTimeout(() => fitStructureToScreen(), 0);
      return () => window.clearTimeout(timer);
  }, [activeTab, isLayoutView, mapStructure, fitStructureToScreen]);

  const requestTargetName = useMemo(() => {
      if (activeMid?.name) return activeMid.name;
      if (selectedMacroId) {
          return macroCandidates.find(macro => macro.id === selectedMacroId)?.name;
      }
      return undefined;
  }, [activeMid?.name, selectedMacroId, macroCandidates]);

  useEffect(() => {
      if (activeTab !== 'MAP' || !isLayoutView || !!mapStructure || !props.onRequestMapUpdate || props.isMapUpdating) return;
      if (!requestTargetName) return;
      const targetId = activeMid?.id || 'mid-none';
      const requestKey = `${viewMode}|${targetId}|${requestTargetName}|${viewingFloor}`;
      if (autoMapRequestKeyRef.current === requestKey) return;
      autoMapRequestKeyRef.current = requestKey;
      props.onRequestMapUpdate(requestTargetName);
  }, [activeTab, isLayoutView, mapStructure, props.onRequestMapUpdate, props.isMapUpdating, viewMode, activeMid?.id, requestTargetName, viewingFloor]);

  useEffect(() => {
      if (mapStructure) {
          autoMapRequestKeyRef.current = '';
      }
  }, [mapStructure, viewMode]);

  useEffect(() => {
      if (!selectedMacroId && macroCandidates.length > 0) {
          setSelectedMacroId(macroCandidates[0].id);
      }
  }, [selectedMacroId, macroCandidates]);

  const uniqueById = <T extends { id: string }>(items: T[]) => {
      const map = new Map<string, T>();
      items.forEach(item => {
          if (!map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
  };

  const midCandidates = useMemo(() => {
      const scoped = uniqueById(midLocations.filter(mid => !selectedMacroId || mid.parentId === selectedMacroId));
      const renderable = scoped.filter(mid => !!mid.mapStructure);
      return renderable.length > 0 ? renderable : scoped;
  }, [midLocations, selectedMacroId]);
  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          const distance = getTouchDistance(e.touches);
          if (distance <= 0) return;
          if (isLayoutView) {
              setLayoutDragging(false);
              layoutPinchStartRef.current = { distance, scale: layoutScale };
          } else {
              setIsDragging(false);
              pinchStartRef.current = { distance, scale };
          }
          setTouchMoved(true);
          return;
      }
      if (e.touches.length !== 1) return;
      if (isLayoutView) {
          setLayoutDragging(true);
          setLayoutDragStart({ x: e.touches[0].clientX - layoutOffset.x, y: e.touches[0].clientY - layoutOffset.y });
      } else {
          setIsDragging(true);
          setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y });
      }
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setTouchMoved(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          const first = e.touches[0];
          const second = e.touches[1];
          const distance = getTouchDistance(e.touches);
          if (!first || !second || distance <= 0) return;

          if (isLayoutView && layoutPinchStartRef.current && layoutContainerRef.current) {
              e.preventDefault();
              const ratio = distance / layoutPinchStartRef.current.distance;
              const targetScale = Math.max(
                  LAYOUT_MIN_SCALE,
                  Math.min(layoutPinchStartRef.current.scale * ratio, LAYOUT_MAX_SCALE)
              );
              const safeDelta = targetScale - layoutScale;
              if (safeDelta === 0) return;
              const rect = layoutContainerRef.current.getBoundingClientRect();
              const anchor = {
                  x: (first.clientX + second.clientX) / 2 - rect.left,
                  y: (first.clientY + second.clientY) / 2 - rect.top
              };
              const result = computeZoomAnchor({
                  scale: layoutScale,
                  offset: layoutOffset,
                  deltaScale: safeDelta,
                  anchor
              });
              setLayoutScale(result.scale);
              setLayoutOffset(result.offset);
          } else if (!isLayoutView && pinchStartRef.current && containerRef.current) {
              e.preventDefault();
              const ratio = distance / pinchStartRef.current.distance;
              const targetScale = Math.max(
                  SURFACE_MIN_SCALE,
                  Math.min(pinchStartRef.current.scale * ratio, SURFACE_MAX_SCALE)
              );
              const safeDelta = targetScale - scale;
              if (safeDelta === 0) return;
              const rect = containerRef.current.getBoundingClientRect();
              const anchor = {
                  x: (first.clientX + second.clientX) / 2 - rect.left,
                  y: (first.clientY + second.clientY) / 2 - rect.top
              };
              const result = computeZoomAnchor({
                  scale,
                  offset,
                  deltaScale: safeDelta,
                  anchor
              });
              setScale(result.scale);
              setOffset(result.offset);
          }
          return;
      }

      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      if (Math.hypot(dx, dy) > 6) setTouchMoved(true);

      if (isLayoutView && layoutDragging) {
          setLayoutOffset({ x: e.touches[0].clientX - layoutDragStart.x, y: e.touches[0].clientY - layoutDragStart.y });
      } else if (!isLayoutView && isDragging) {
          setOffset({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
      }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (e.touches.length < 2) {
          pinchStartRef.current = null;
          layoutPinchStartRef.current = null;
      }
      setIsDragging(false);
      setLayoutDragging(false);
      if (!touchMoved && activeTab === 'MAP' && !isLayoutView) {
          // Click detection logic
      }
  };

  return (
    <div className="w-full h-full flex bg-[#050a14]">
        {/* Sidebar Tabs (PC Style) */}
        <div className="w-14 bg-[#0a0c10] border-r border-white/5 flex flex-col items-center py-4 gap-4 z-20 shrink-0">
             <button onClick={() => setActiveTab('MAP')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'MAP' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white bg-white/5'}`}>
                 <MapIcon size={20} />
             </button>
             <button onClick={() => setActiveTab('QUESTS')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'QUESTS' ? 'bg-amber-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white bg-white/5'}`}>
                 <ListTodo size={20} />
             </button>
             <button onClick={() => setActiveTab('STORY')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'STORY' ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white bg-white/5'}`}>
                 <BookOpen size={20} />
             </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative overflow-hidden">
            {activeTab === 'MAP' && (
                <div className="w-full h-full relative">
                    {/* Simplified Map View for Mobile - Reusing existing render logic structure */}
                    {isLayoutView ? (
                        <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500 text-xs">
                            <div
                                ref={layoutContainerRef}
                                className="w-full h-full overflow-hidden relative"
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                            >
                                {mapStructure ? (
                                    <div
                                        className="absolute left-0 top-0"
                                        style={{
                                            transform: `translate(${layoutOffset.x}px, ${layoutOffset.y}px) scale(${layoutScale})`,
                                            transformOrigin: '0 0'
                                        }}
                                    >
                                        <MapStructureSVG data={mapStructure} />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center px-6 text-center">
                                        <div>
                                            <div className="text-zinc-300 text-xs mb-1">当前地点暂无 SVG 结构数据</div>
                                            <div className="text-zinc-500 text-[10px] leading-relaxed">
                                                请触发地图更新并返回 upsert_exploration_map（MapStructureJSON）。
                                            </div>
                                            {props.onRequestMapUpdate && (
                                                <div className="text-cyan-400/85 text-[10px] mt-2">
                                                    {props.isMapUpdating ? '正在自动请求地图更新...' : '缺失结构时会自动触发一次地图更新。'}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div
                            ref={containerRef}
                            className="w-full h-full bg-[#050a14] touch-none"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <canvas ref={canvasRef} className="w-full h-full block" />
                        </div>
                    )}

                    <div className="absolute top-4 left-4 right-4 z-30 space-y-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowFloorSelect(!showFloorSelect)}
                                className="bg-black/60 backdrop-blur text-white px-3 py-1 rounded-full text-xs border border-white/10 flex items-center gap-2"
                            >
                                {viewingFloor === 0 ? "欧拉丽" : `地下${viewingFloor}层`} <ChevronDown size={12} />
                            </button>
                            {viewingFloor === 0 && (
                                <div className="flex bg-black/60 border border-white/10 rounded-full p-0.5">
                                    <button
                                        onClick={() => {
                                            setViewMode('macro');
                                            setActiveMid(null);
                                            setSelectedMidId(null);
                                        }}
                                        className={`px-2 py-1 text-[10px] rounded-full transition-colors ${viewMode === 'macro' ? 'bg-blue-600 text-white' : 'text-zinc-400'}`}
                                    >
                                        宏观
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!activeMid) {
                                                enterMidView();
                                                return;
                                            }
                                            setViewMode('mid');
                                        }}
                                        disabled={!activeMid && midCandidates.length === 0}
                                        className={`px-2 py-1 text-[10px] rounded-full transition-colors ${viewMode === 'mid' ? 'bg-blue-600 text-white' : 'text-zinc-400 disabled:opacity-40'}`}
                                    >
                                        区域SVG
                                    </button>
                                </div>
                            )}
                        </div>

                        {showFloorSelect && (
                            <div className="bg-zinc-900 border border-zinc-700 rounded w-32 max-h-48 overflow-y-auto">
                                <button
                                    onClick={() => {
                                        setViewingFloor(0);
                                        applyResolvedDailyView(0, props.location);
                                        setShowFloorSelect(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-white border-b border-white/5"
                                >
                                    欧拉丽
                                </button>
                                {[1, 2, 3, 4, 5].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => {
                                            setViewingFloor(f);
                                            applyResolvedDailyView(f, props.location);
                                            setShowFloorSelect(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-zinc-400 border-b border-white/5"
                                    >
                                        地下{f}层
                                    </button>
                                ))}
                            </div>
                        )}

                        {viewingFloor === 0 && (
                            <div className="bg-black/50 border border-white/10 rounded-lg p-2 backdrop-blur-sm">
                                <div className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wide">地图聚焦</div>
                                {viewMode === 'macro' && (
                                    <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1">
                                        {macroCandidates.slice(0, 8).map(macro => (
                                            <button
                                                key={macro.id}
                                                onClick={() => selectMacroById(macro.id)}
                                                className={`px-2 py-1 text-[11px] rounded border transition-colors ${selectedMacroId === macro.id ? 'bg-blue-600/30 text-blue-200 border-blue-500/50' : 'bg-black/30 text-zinc-300 border-white/10'}`}
                                            >
                                                {macro.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {viewMode === 'mid' && (
                                    <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1">
                                        {midCandidates.slice(0, 10).map(mid => (
                                            <button
                                                key={mid.id}
                                                onClick={() => selectMidById(mid.id)}
                                                className={`px-2 py-1 text-[11px] rounded border transition-colors ${selectedMidId === mid.id ? 'bg-violet-600/30 text-violet-200 border-violet-500/50' : 'bg-black/30 text-zinc-300 border-white/10'}`}
                                            >
                                                {mid.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="absolute right-4 bottom-4 z-30 flex flex-col items-center gap-2">
                        <div className="px-2 py-1 text-[10px] text-zinc-300 bg-black/65 border border-white/10 rounded-full backdrop-blur">
                            {Math.round((isLayoutView ? layoutScale : scale) * 100)}%
                        </div>
                        <button
                            onClick={() => (isLayoutView ? applyLayoutZoom(0.12) : applySurfaceZoom(0.12))}
                            className="w-9 h-9 rounded-full bg-black/65 border border-white/10 text-white flex items-center justify-center active:scale-95"
                            aria-label="放大地图"
                        >
                            <Plus size={16} />
                        </button>
                        <button
                            onClick={() => (isLayoutView ? applyLayoutZoom(-0.12) : applySurfaceZoom(-0.12))}
                            className="w-9 h-9 rounded-full bg-black/65 border border-white/10 text-white flex items-center justify-center active:scale-95"
                            aria-label="缩小地图"
                        >
                            <Minus size={16} />
                        </button>
                        <button
                            onClick={() => (isLayoutView ? fitStructureToScreen() : fitSurfaceToScreen())}
                            className="w-9 h-9 rounded-full bg-blue-600/70 border border-blue-300/20 text-white flex items-center justify-center active:scale-95"
                            aria-label="重置缩放"
                        >
                            <Target size={16} />
                        </button>
                    </div>
                </div>
            )}
            {activeTab === 'QUESTS' && <TasksComponent tasks={props.tasks || []} onDeleteTask={props.onDeleteTask} />}
            {activeTab === 'STORY' && <StoryComponent story={props.story} />}
        </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { Map as MapIcon, ListTodo, BookOpen, Target, X, Plus, Minus, RotateCcw, Layers, Eye, EyeOff, ChevronDown, Clock, GitBranch, AlertTriangle, ScrollText, CheckCircle2, Circle, AlertCircle, MapPin, History, Trash2 } from 'lucide-react';
import { WorldMapData, GeoPoint, Confidant, Task, StoryState } from '../../../types';
import { computeZoomAnchor } from '../../../utils/mapMath';
import { MapControls } from '../map/MapControls';
import { useMapInteraction } from '../map/hooks/useMapInteraction';
import { useMapRender } from '../map/hooks/useMapRender';

interface WorldViewProps {
  worldMap?: WorldMapData;
  currentPos?: GeoPoint;
  floor?: number;
  location?: string;
  playerName?: string;
  confidants?: Confidant[];
  tasks?: Task[];
  story?: StoryState;
  onDeleteTask?: (id: string) => void;
  onClose?: () => void;
}

type WorldTab = 'MAP' | 'QUESTS' | 'STORY';

// --- Map Component ---
const MapComponent: React.FC<WorldViewProps> = ({
    worldMap, currentPos = { x: 5000, y: 5000 }, floor = 0, confidants = []
}) => {
  const [scale, setScale] = useState(0.5); 
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewingFloor, setViewingFloor] = useState<number>(floor);
  const [showTerritories, setShowTerritories] = useState(true);
  const [showNPCs, setShowNPCs] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const mapData = worldMap || { 
      config: { width: 10000, height: 10000 },
      factions: [], territories: [], terrain: [], routes: [], surfaceLocations: [], dungeonStructure: [],
      macroLocations: [], midLocations: []
  };

  // Center on player on mount
  useEffect(() => {
      if (containerRef.current) {
          const { clientWidth, clientHeight } = containerRef.current;
          setOffset({
              x: -currentPos.x * scale + clientWidth / 2,
              y: -currentPos.y * scale + clientHeight / 2
          });
      }
  }, []);

  const mapInteraction = useMapInteraction({
      enabled: true,
      containerRef,
      scale,
      setScale,
      offset,
      setOffset
  });

  useMapRender({
      enabled: true,
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

  const applyZoom = (deltaScale: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const anchor = { x: rect.width / 2, y: rect.height / 2 };
      const result = computeZoomAnchor({ scale, offset, deltaScale, anchor });
      setScale(result.scale);
      setOffset(result.offset);
  };

  return (
      <div className="flex-1 relative bg-[#050a14] overflow-hidden h-full flex flex-col">
          <div
              ref={containerRef}
              className="flex-1 relative cursor-move"
              onMouseDown={mapInteraction.handleMouseDown}
              onMouseMove={mapInteraction.handleMouseMove}
              onMouseUp={mapInteraction.handleMouseUp}
              onMouseLeave={mapInteraction.handleMouseLeave}
              onTouchStart={mapInteraction.handleTouchStart}
              onTouchMove={mapInteraction.handleTouchMove}
              onTouchEnd={mapInteraction.handleTouchEnd}
          >
              <canvas ref={canvasRef} className="absolute inset-0" />
          </div>
          
          <MapControls
              onZoomIn={() => applyZoom(0.2)}
              onZoomOut={() => applyZoom(-0.2)}
              onCenter={() => {
                  if (containerRef.current) {
                      const { clientWidth, clientHeight } = containerRef.current;
                      setOffset({ x: -currentPos.x * scale + clientWidth/2, y: -currentPos.y * scale + clientHeight/2 });
                  }
              }}
              showTerritories={showTerritories}
              onToggleTerritories={() => setShowTerritories(!showTerritories)}
              showNPCs={showNPCs}
              onToggleNPCs={() => setShowNPCs(!showNPCs)}
              className="absolute top-4 right-4 z-20"
          />

          <div className="absolute top-4 left-4 bg-black/80 p-2 rounded border border-zinc-700 text-xs text-white">
              <div className="font-bold mb-1">图层控制</div>
              <button onClick={() => setShowTerritories(!showTerritories)} className={`block w-full text-left px-2 py-1 ${showTerritories ? 'text-blue-400' : 'text-zinc-500'}`}>领地</button>
              <button onClick={() => setShowNPCs(!showNPCs)} className={`block w-full text-left px-2 py-1 ${showNPCs ? 'text-blue-400' : 'text-zinc-500'}`}>人物</button>
          </div>
          
          <div className="absolute bottom-4 left-4 text-xs font-mono text-blue-500 bg-black/60 px-2 py-1 rounded">
              坐标: {Math.round(currentPos.x)}, {Math.round(currentPos.y)} | 层数: {viewingFloor}
          </div>
      </div>
  );
};

// --- Tasks Component ---
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

    return (
        <div className="flex h-full bg-zinc-900">
            <div className="w-72 border-r border-zinc-800 flex flex-col bg-zinc-950">
                <div className="flex border-b border-zinc-800">
                    {['ACTIVE', 'COMPLETED', 'FAILED'].map(f => (
                        <button 
                            key={f} 
                            onClick={() => setFilter(f as any)} 
                            className={`flex-1 py-3 text-[10px] font-bold uppercase transition-all ${filter === f ? 'bg-accent-gold text-surface-base shadow-sm' : 'text-content-muted hover:text-content-primary hover:bg-white/5'}`}
                        >
                            {getFilterLabel(f)}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {filtered.map(t => (
                        <div 
                            key={t.id} 
                            onClick={() => setSelectedTask(t)}
                            className={`p-3 border-l-4 cursor-pointer transition-all ${selectedTask?.id === t.id ? 'bg-yellow-900/20 border-yellow-500' : 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800'}`}
                        >
                            <div className="font-bold text-xs text-white truncate mb-1">{t.标题}</div>
                            <div className="flex justify-between text-[10px] text-zinc-500">
                                <span className={`px-1 border ${t.评级 === 'S' ? 'border-yellow-500 text-yellow-500' : 'border-zinc-600'}`}>{t.评级}</span>
                                <span>{t.奖励}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/cork-board.png')] bg-zinc-800 p-8 overflow-y-auto relative">
                {selectedTask ? (
                    <div className="bg-[#f0e6d2] text-[#4a3b32] p-8 shadow-xl max-w-3xl mx-auto min-h-[600px] relative transform rotate-1">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 w-4 h-4 rounded-full bg-red-800 shadow-md border border-white z-20" />
                        <h2 className="text-3xl font-display uppercase tracking-tighter border-b-2 border-[#8b7e66] pb-2 mb-4">{selectedTask.标题}</h2>
                        <div className="flex gap-4 text-xs font-bold mb-6 text-[#786c5e]">
                            <span>等级: {selectedTask.评级}</span>
                            <span>截止: {selectedTask.截止时间 || "无"}</span>
                        </div>
                        <div className="mb-8">
                            <h4 className="font-bold uppercase tracking-widest text-[#8b7e66] mb-2 text-xs">描述</h4>
                            <p className="leading-relaxed text-sm whitespace-pre-wrap">{selectedTask.描述}</p>
                        </div>
                        <div className="bg-[#e6dbc4] p-4 border border-[#cfc4ad] mb-8">
                            <h4 className="font-bold uppercase tracking-widest text-[#8b7e66] mb-1 text-xs">奖励</h4>
                            <p className="font-bold text-lg">{selectedTask.奖励}</p>
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
                        {onDeleteTask && selectedTask.状态 !== 'active' && (
                            <button onClick={() => onDeleteTask(selectedTask.id)} className="absolute bottom-8 right-8 text-red-800 font-bold text-xs border-2 border-red-800 px-3 py-1 hover:bg-red-800 hover:text-white uppercase">
                                删除记录
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-50">
                        <ScrollText size={48} className="mb-4" />
                        <span className="font-display text-xl uppercase tracking-widest">选择任务</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Story Component ---
const StoryComponent: React.FC<{ story: StoryState }> = ({ story }) => {
    const safeStory = story || {
        主线: { 当前卷数: 1, 当前篇章: "Unknown", 当前阶段: "Unknown", 关键节点: "Unknown", 节点状态: "Unknown" },
        引导: { 当前目标: "暂无目标", 下一触发: "", 行动提示: "" },
        时间轴: {},
        路线: { 是否正史: true, 偏移度: 0 },
        待触发: [],
        里程碑: []
    };

    return (
        <div className="h-full bg-zinc-900 overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-4xl mx-auto space-y-10">
                <div className="text-center">
                    <BookOpen size={40} className="text-green-600 mx-auto mb-4" />
                    <h2 className="text-xs text-zinc-500 uppercase tracking-[0.5em] mb-2">当前篇章 (Vol.{safeStory.主线?.当前卷数})</h2>
                    <h1 className="text-5xl font-display uppercase text-white">{safeStory.主线?.当前篇章}</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-black/40 border-l-4 border-green-600 p-6">
                        <div className="flex items-center gap-2 text-green-500 font-bold uppercase tracking-wider text-xs mb-4">
                            <GitBranch size={14} /> 剧情路线
                        </div>
                        <div className="text-xl text-white font-display mb-2">{safeStory.路线?.是否正史 ? "原著正史" : "IF 分歧线"}</div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mb-2">
                            <div className={`h-full ${safeStory.路线?.偏移度 && safeStory.路线.偏移度 > 50 ? 'bg-yellow-500' : 'bg-green-600'}`} style={{ width: `${safeStory.路线?.偏移度 || 0}%` }} />
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase">偏移度: {safeStory.路线?.偏移度}%</div>
                    </div>

                    <div className="bg-black/40 border-r-4 border-green-600 p-6 text-right">
                        <div className="flex items-center justify-end gap-2 text-green-500 font-bold uppercase tracking-wider text-xs mb-4">
                            <Target size={14} /> 目标
                        </div>
                        <div className="text-lg text-white font-bold leading-relaxed">{safeStory.引导?.当前目标}</div>
                        {safeStory.引导?.行动提示 && <div className="text-xs text-zinc-500 mt-2">{safeStory.引导.行动提示}</div>}
                    </div>
                </div>

                <div className="bg-black/30 border border-zinc-800 p-6">
                    <div className="text-zinc-400 uppercase tracking-widest text-xs mb-4 font-bold flex items-center gap-2">
                        <Clock size={14} /> 里程碑
                    </div>
                    <div className="space-y-3">
                        {(safeStory.里程碑 || []).map((m: any, i: number) => (
                            <div key={i} className="flex gap-4 border-b border-zinc-800/50 pb-2 last:border-0 text-sm">
                                <span className="text-green-500 font-mono text-xs w-24 shrink-0">{m.时间}</span>
                                <span className="text-zinc-300">{m.事件}</span>
                            </div>
                        ))}
                        {(safeStory.里程碑 || []).length === 0 && <div className="text-zinc-600 italic text-xs">无里程碑记录。</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main View ---
export const WorldView: React.FC<WorldViewProps> = (props) => {
  const [activeTab, setActiveTab] = useState<WorldTab>('MAP');

  return (
    <div className="w-full h-full flex flex-col md:flex-row overflow-hidden bg-dungeon-black animate-in fade-in duration-300">
        <div className="md:w-16 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-4 gap-4 z-20">
             <button onClick={() => setActiveTab('MAP')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'MAP' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`} title="地图">
                 <MapIcon size={20} />
             </button>
             <button onClick={() => setActiveTab('QUESTS')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'QUESTS' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`} title="任务">
                 <ListTodo size={20} />
             </button>
             <button onClick={() => setActiveTab('STORY')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'STORY' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`} title="剧情">
                 <BookOpen size={20} />
             </button>
             
             {props.onClose && (
                 <div className="mt-auto">
                     <button onClick={props.onClose} className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all" title="返回">
                         <X size={20} />
                     </button>
                 </div>
             )}
        </div>

        <div className="flex-1 relative overflow-hidden">
            {activeTab === 'MAP' && <MapComponent {...props} />}
            {activeTab === 'QUESTS' && <TasksComponent tasks={props.tasks || []} onDeleteTask={props.onDeleteTask} />}
            {activeTab === 'STORY' && <StoryComponent story={props.story!} />}
        </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { Globe, Crown, Mic2, AlertTriangle, Scroll, Clock, Radar, ListChecks, Swords, Flag, Settings, Activity, RefreshCw, ChevronRight, Hash, TrendingUp, AlertCircle } from 'lucide-react';
import { NewsItem, RumorItem, WorldState, SystemSettings } from '../../../types';
import { normalizeWorldState } from '../../../utils/normalizers';
import { parseGameTime } from '../../../hooks/gameLogic/time';
import { ModalWrapper } from '../../ui/ModalWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface DynamicWorldModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldState?: WorldState;
  npcStates?: any[];
  gameTime?: string;
  turnCount?: number;
  onSilentWorldUpdate?: () => void;
  systemSettings?: SystemSettings;
  onUpdateSettings?: (settings: any) => void;
  embedded?: boolean;
}

type WorldTab = 'GUILD' | 'DENATUS' | 'RUMORS' | 'TRACKING' | 'FACTIONS' | 'WAR_GAME';

export const DynamicWorldModal: React.FC<DynamicWorldModalProps> = ({ 
    isOpen, 
    onClose,
    worldState,
    gameTime,
    turnCount,
    onSilentWorldUpdate,
    systemSettings,
    onUpdateSettings,
    embedded = false
}) => {
  const [activeTab, setActiveTab] = useState<WorldTab>('GUILD');
  const [showSettings, setShowSettings] = useState(false);

  const safeWorldState = worldState || {
      异常指数: 0,
      头条新闻: [],
      街头传闻: [],
      诸神神会: {
          下次神会开启时间: "未知",
          神会主题: "待定",
          讨论内容: [],
          最终结果: "待议"
      },
      NPC后台跟踪: [],
      派阀格局: { S级: [], A级: [], B级至I级: [], 备注: "未设定" },
      战争游戏: { 状态: "未开始", 参战眷族: [], 形式: "", 赌注: "", 举办时间: "", 结束时间: "", 结果: "", 备注: "" },
      下次更新回合: undefined
  };

  const normalizedWorld = normalizeWorldState(safeWorldState, gameTime) || safeWorldState;
  const rumorIndex = useMemo<Map<string, RumorItem>>(() => {
      const list: RumorItem[] = Array.isArray(normalizedWorld.街头传闻) ? normalizedWorld.街头传闻 : [];
      return new Map<string, RumorItem>(list.map(item => [String(item.id), item]));
  }, [normalizedWorld.街头传闻]);

  const currentTurn = typeof turnCount === 'number' ? turnCount : 0;
  const nextTurn = typeof normalizedWorld.下次更新回合 === 'number' ? normalizedWorld.下次更新回合 : null;
  const isUpdateDue = nextTurn !== null ? currentTurn >= nextTurn : false;

  const handleNavigateToRumor = (rumorId: string) => {
    setActiveTab('RUMORS');
  };

  const TAB_CONFIG: { id: WorldTab; label: string; icon: React.ReactNode }[] = [
      { id: 'GUILD', label: '公会公告', icon: <Scroll size={18}/> },
      { id: 'DENATUS', label: '诸神神会', icon: <Crown size={18}/> },
      { id: 'RUMORS', label: '街头传闻', icon: <Mic2 size={18}/> },
      { id: 'FACTIONS', label: '派阀格局', icon: <Flag size={18}/> },
      { id: 'WAR_GAME', label: '战争游戏', icon: <Swords size={18}/> },
      { id: 'TRACKING', label: '后台跟踪', icon: <Radar size={18}/> },
  ];

  const innerContent = (
        <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0f]">
        <div className="flex items-center gap-4 px-4 py-2 shrink-0 justify-end">
                <div className="hidden md:flex flex-col items-end leading-tight group cursor-default">
                    <div className="flex items-center gap-2 text-[10px] text-content-muted font-mono tracking-wider">
                         <span className={clsx("w-1.5 h-1.5 rounded-full animate-pulse", isUpdateDue ? "bg-accent-green shadow-[0_0_8px_lime]" : "bg-accent-blue shadow-[0_0_5px_cyan]")}/>
                         <span className="group-hover:text-accent-blue transition-colors">下次情报刷新: {nextTurn !== null ? `第 ${nextTurn} 回合` : "计算中..."}</span>
                    </div>
                </div>
                {isUpdateDue && onSilentWorldUpdate && (
                     <motion.button
                        whileHover={{ scale: 1.1, rotate: 180 }}
                        whileTap={{ scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        onClick={onSilentWorldUpdate}
                        className="p-1.5 rounded-full bg-accent-blue/10 text-accent-blue hover:bg-accent-blue hover:text-white transition-colors"
                        title="立即更新情报"
                     >
                        <RefreshCw size={16} />
                     </motion.button>
                )}
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={clsx(
                        "p-1.5 rounded-full transition-all duration-300",
                        showSettings ? "bg-white/10 text-content-primary rotate-90" : "text-content-muted hover:text-content-primary hover:bg-white/5"
                    )}
                >
                    <Settings size={18} />
                </button>
            </div>
        <div className="flex flex-1 overflow-hidden relative">
            
            <div className="hidden md:flex flex-col h-full w-56 bg-[#0f0f13] border-r border-white/5 shrink-0 p-3 z-20 overflow-hidden">
                <div className="text-[10px] text-content-muted font-bold tracking-[0.2em] uppercase mb-6 px-4 pt-2 border-b border-white/5 pb-2">
                    监控模块
                </div>
                <div className="space-y-1 flex-1 min-h-0 overflow-hidden">
                    {TAB_CONFIG.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setShowSettings(false); }}
                            className={clsx(
                                "w-full text-left px-4 py-3 text-xs font-bold tracking-wider rounded-lg transition-all duration-300 relative overflow-hidden group font-ui flex items-center gap-3",
                                activeTab === tab.id
                                    ? "bg-accent-blue/10 text-accent-blue shadow-[inset_2px_0_0_0_rgba(34,211,238,1)]"
                                    : "text-content-muted hover:text-content-secondary hover:bg-white/5"
                            )}
                        >
                            <span className={clsx("transition-transform duration-300", activeTab === tab.id ? "scale-110" : "group-hover:scale-110")}>
                                {tab.icon}
                            </span>
                            <span className="relative z-10">{tab.label}</span>
                            {activeTab === tab.id && (
                                <motion.div 
                                    layoutId="activeTabIndicator"
                                    className="absolute inset-0 bg-accent-blue/5 z-0"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                />
                            )}
                        </button>
                    ))}
                </div>
                
                <div className="mt-3 pt-4 border-t border-white/5 px-4 pb-2 shrink-0 bg-black/10 rounded-lg">
                    <div className="mb-2 text-[10px] text-content-muted font-mono uppercase tracking-wider opacity-70">系统状态</div>
                    
                    <div className="flex items-center gap-3 mb-2 p-2 bg-black/30 rounded border border-white/10">
                        <div className="relative">
                            <Activity size={14} className="text-accent-green" />
                            <span className="absolute inset-0 animate-ping opacity-75 bg-accent-green rounded-full blur-[2px]"/>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-accent-green font-mono font-bold leading-none">在线</span>
                            <span className="text-[9px] text-content-muted/70 font-mono leading-none mt-0.5">网络: 稳定</span>
                        </div>
                    </div>

                    <div className="text-[10px] text-content-muted font-mono flex justify-between items-center px-1 leading-none">
                        <span>刷新间隔</span>
                        <span className="text-content-primary">{typeof systemSettings?.世界更新间隔回合 === 'number' ? systemSettings.世界更新间隔回合 : 3} 回合</span>
                    </div>
                </div>
            </div>

            <div className="md:hidden flex overflow-x-auto border-b border-white/5 bg-[#0f0f13] shrink-0 p-2 gap-2 absolute top-0 left-0 right-0 z-30 custom-scrollbar-hide">
                {TAB_CONFIG.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setShowSettings(false); }}
                        className={clsx(
                            "px-4 py-2 text-xs font-bold whitespace-nowrap rounded-full transition-colors flex items-center gap-2 shadow-sm",
                            activeTab === tab.id
                                ? "bg-accent-blue/20 text-accent-blue border border-accent-blue/40 shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                                : "text-content-muted bg-white/5 border border-white/5"
                        )}
                    >
                       {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            <div className="flex-1 bg-[#050508] relative md:mt-0 mt-14 overflow-hidden flex flex-col">
                <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:40px_40px] pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.05),transparent_70%)] pointer-events-none" />

                <div className="relative z-10 w-full max-w-6xl mx-auto h-full flex flex-col p-4 md:p-8">
                    <AnimatePresence mode="wait">
                        {showSettings ? (
                            <motion.div 
                                key="settings"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="h-full overflow-y-auto custom-scrollbar"
                            >
                                <SettingsPanelContent systemSettings={systemSettings} onUpdateSettings={onUpdateSettings} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="h-full flex flex-col overflow-hidden"
                            >
                                {activeTab === 'GUILD' && <GuildPanel world={normalizedWorld} rumorIndex={rumorIndex} onNavigateToRumor={handleNavigateToRumor} />}
                                {activeTab === 'DENATUS' && <DenatusPanel world={normalizedWorld} />}
                                {activeTab === 'RUMORS' && <RumorsPanel world={normalizedWorld} />}
                                {activeTab === 'FACTIONS' && <FactionsPanel world={normalizedWorld} />}
                                {activeTab === 'WAR_GAME' && <WarGamePanel world={normalizedWorld} />}
                                {activeTab === 'TRACKING' && <TrackingPanel world={normalizedWorld} />}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
        </div>
  );

  if (embedded) return innerContent;

  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title="世界情报监测"
        icon={<Globe size={20} />}
        size="xl"
        theme="monitor"
        className="flex flex-col h-full overflow-hidden bg-[#0a0a0f] border-none"
        noBodyPadding={true}
        bodyClassName="!overflow-hidden"
    >
        {innerContent}
    </ModalWrapper>
  );
};

const SettingsPanelContent = ({ systemSettings, onUpdateSettings }: { systemSettings?: SystemSettings, onUpdateSettings?: (s: any) => void }) => {
    const intervalValue = typeof systemSettings?.世界更新间隔回合 === 'number' ? systemSettings.世界更新间隔回合 : 3;
    return (
    <div className="space-y-6">
        <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]"><Settings size={28}/></div>
            <div>
                <h3 className="text-2xl font-display text-content-primary tracking-widest uppercase">系统配置</h3>
                <p className="text-xs text-content-muted font-mono tracking-wider">系统级访问权限 // 需要管理员认证</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-surface-base/40 backdrop-blur-sm border border-white/10 p-6 rounded-xl space-y-5 hover:border-white/20 transition-all">
                <h4 className="text-sm font-bold text-content-primary uppercase tracking-wider flex items-center gap-3">
                    <Clock size={18} className="text-accent-blue"/> 更新周期
                </h4>
                <div className="flex items-center justify-between gap-4 bg-black/40 p-4 rounded-lg border border-white/5">
                    <span className="text-xs text-content-secondary font-mono">每更回合数</span>
                    <input
                        type="number"
                        min={0}
                        step={1}
                        className="w-20 bg-black/50 border border-white/10 rounded px-3 py-1.5 text-sm text-center text-content-primary outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 transition-all font-mono"
                        value={intervalValue}
                        onChange={(e) => {
                            const next = Number(e.target.value);
                            onUpdateSettings?.({ 世界更新间隔回合: Number.isFinite(next) ? Math.max(0, Math.floor(next)) : intervalValue });
                        }}
                    />
                </div>
                <p className="text-[10px] text-content-muted leading-relaxed pl-1 border-l-2 border-white/10 opacity-70">
                    * 设置为0以禁用自动更新并切换到手动刷新模式。
                </p>
             </div>

             <div className="bg-surface-base/40 backdrop-blur-sm border border-white/10 p-6 rounded-xl space-y-5 hover:border-white/20 transition-all">
                <h4 className="text-sm font-bold text-content-primary uppercase tracking-wider flex items-center gap-3">
                    <Radar size={18} className="text-emerald-500"/> 通知协议
                </h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5">
                        <span className="text-content-secondary text-xs font-mono uppercase">新闻推送</span>
                        <div className={clsx("w-2.5 h-2.5 rounded-full shadow-lg transition-all", systemSettings?.通知设置?.新闻推送 ? "bg-accent-green shadow-[0_0_8px_lime]" : "bg-zinc-700")} />
                    </div>
                     <button 
                        onClick={() => onUpdateSettings?.({ 通知设置: { ...systemSettings?.通知设置, 传闻更新: !systemSettings?.通知设置?.传闻更新 } })}
                        className="w-full flex items-center justify-between p-4 bg-black/40 rounded-lg border border-white/5 hover:bg-white/5 hover:border-emerald-500/30 transition-all group"
                    >
                        <span className="text-content-secondary text-xs font-mono uppercase group-hover:text-emerald-400 transition-colors">传闻情报注入</span>
                        <div className={clsx("px-3 py-1 text-[10px] font-bold rounded uppercase transition-colors tracking-wider border", systemSettings?.通知设置?.传闻更新 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-zinc-800/50 text-content-muted border-white/5")}>
                             {systemSettings?.通知设置?.传闻更新 ? "启用" : "禁用"}
                        </div>
                    </button>
                </div>
             </div>
        </div>
    </div>
    );
};

const NewsCard = ({ item, linkedRumor, onNavigateToRumor }: { item: NewsItem; linkedRumor?: RumorItem; onNavigateToRumor?: (id: string) => void }) => {
    const level = item.重要度 || 'normal';
    // RSS风格紧凑设计：左侧色条指示重要性，背景更轻量
    const config = level === 'urgent' 
        ? { border: 'border-l-2 border-l-red-500 border-y border-r border-white/5', bg: 'bg-red-950/10 hover:bg-red-950/20', text: 'text-red-200' }
        : level === 'minor' 
        ? { border: 'border-l-2 border-l-zinc-500 border-y border-r border-white/5', bg: 'bg-zinc-900/20 hover:bg-zinc-900/30', text: 'text-zinc-400' } 
        : { border: 'border-l-2 border-l-cyan-500 border-y border-r border-white/5', bg: 'bg-cyan-950/10 hover:bg-cyan-950/20', text: 'text-cyan-200' };
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx("relative p-3 mb-3 rounded-r-md transition-all duration-300 group break-inside-avoid", config.border, config.bg)}
        >
            <div className="flex justify-between items-start mb-1.5 opacity-70">
                <span className="text-[10px] uppercase tracking-wider font-mono flex items-center gap-1.5">
                   {level === 'urgent' && <AlertCircle size={10} className="text-red-500 animate-pulse"/>}
                   <span className="font-bold">{item.来源 || '系统'}</span>
                </span>
                <span className="text-[9px] font-mono">{item.时间戳}</span>
            </div>
            
            <h4 className={clsx("text-sm font-bold mb-2 font-display leading-tight group-hover:underline underline-offset-4 decoration-white/20", config.text)}>
                {item.标题}
            </h4>
            
            {item.内容 && (
                <p className="text-[11px] text-content-secondary leading-relaxed font-sans opacity-90 border-t border-white/5 pt-2">
                    {item.内容}
                </p>
            )}
            
            {linkedRumor && (
                 <button
                    onClick={() => onNavigateToRumor?.(linkedRumor.id)}
                    className="mt-2 w-full py-1.5 px-2 bg-black/20 rounded flex items-center justify-between group/link hover:bg-emerald-950/30 transition-colors border border-transparent hover:border-emerald-500/20"
                 >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Radar size={10} className="text-emerald-500 shrink-0" />
                         <span className="text-[10px] text-emerald-500/80 truncate">关联：{linkedRumor.主题}</span>
                    </div>
                    <ArrowUpRight size={10} className="text-emerald-500 opacity-50 group-hover/link:opacity-100 transition-opacity" />
                 </button>
            )}
        </motion.div>
    );
};

const DungeonIrregularityGauge = ({ value }: { value: number }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    
    const status = value < 30 ? '稳定' : value < 70 ? '警戒' : '危急';
    const color = value < 30 ? '#10b981' : value < 70 ? '#f59e0b' : '#ef4444';
    const glowColor = value < 30 ? 'rgba(16, 185, 129, 0.5)' : value < 70 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(239, 68, 68, 0.5)';

    return (
        <div className="bg-surface-base/40 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 pointer-events-none"/>
            <div className="absolute top-0 right-0 p-4 opacity-10 blur-xl" style={{ backgroundColor: color }}></div>
            
            <div className="flex items-center gap-2 mb-4 relative z-10 w-full justify-between px-2">
                <div className="flex items-center gap-2 text-content-muted">
                    <Activity size={14} className={clsx(status === '危急' ? "animate-pulse text-red-500" : "text-content-muted")}/>
                    <span className="text-[10px] font-bold uppercase tracking-widest">地下城稳定度</span>
                </div>
                <div className={clsx("w-2 h-2 rounded-full", status === '危急' ? "bg-red-500 animate-ping" : status === '警戒' ? "bg-amber-500" : "bg-emerald-500")} />
            </div>

            <div className="relative w-40 h-40 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="50%" cy="50%" r={radius}
                        fill="transparent"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="8"
                    />
                    <motion.circle
                        cx="50%" cy="50%" r={radius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeLinecap="round"
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
                    />
                </svg>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-4xl font-display font-bold text-white tracking-tighter"
                    >
                        {value}%
                    </motion.div>
                    <span style={{ color }} className="text-[10px] font-bold uppercase tracking-widest mt-1">{status}</span>
                </div>
            </div>

            <div className="mt-4 w-full grid grid-cols-3 gap-2 text-center text-[9px] font-mono text-content-muted/50 uppercase">
                <div className={clsx(value < 30 && "text-emerald-500 font-bold opacity-100")}>安全</div>
                <div className={clsx(value >= 30 && value < 70 && "text-amber-500 font-bold opacity-100")}>风险</div>
                <div className={clsx(value >= 70 && "text-red-500 font-bold opacity-100")}>危险</div>
            </div>
        </div>
    );
};

const GuildPanel = ({ world, rumorIndex, onNavigateToRumor }: { world: WorldState; rumorIndex: Map<string, RumorItem>; onNavigateToRumor: (id: string) => void }) => {
    const [filter, setFilter] = useState<'全部' | '紧急' | '普通' | '一般'>('全部');
    
    const newsItems = Array.isArray(world.头条新闻) ? world.头条新闻 : [];
    const filteredNews = useMemo(() => {
        const sorted = [...newsItems].sort((a, b) => (parseGameTime(b.时间戳) || 0) - (parseGameTime(a.时间戳) || 0));
        
        if (filter === '全部') return sorted;
        if (filter === '紧急') return sorted.filter(n => n.重要度 === 'urgent');
        if (filter === '普通') return sorted.filter(n => !n.重要度 || n.重要度 === 'normal');
        if (filter === '一般') return sorted.filter(n => n.重要度 === 'minor');
        return sorted;
    }, [newsItems, filter]);

    const urgentCount = newsItems.filter(n => n.重要度 === 'urgent').length;

    return (
        <div className="h-full flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 顶部固定监控区 */}
            <div className="shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                <DungeonIrregularityGauge value={world.异常指数} />

                <div className="md:col-span-2 bg-surface-base/40 border border-white/10 rounded-xl p-5 flex flex-col relative overflow-hidden h-full">
                    <div className="absolute top-0 right-0 p-24 bg-accent-blue/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"/>
                    
                    <div className="flex justify-between items-start mb-4 z-10 shrink-0">
                        <div>
                            <h3 className="text-xl font-display uppercase tracking-widest text-white drop-shadow-sm flex items-center gap-2">
                                <Globe size={20} className="text-accent-blue"/> 
                                全域监控
                            </h3>
                            <div className="text-[9px] text-content-muted font-mono mt-0.5 pl-1">公会官方频道 // 公共广播</div>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-red-400">
                           <AlertCircle size={12} />
                           <span className="text-[10px] font-bold tracking-wider">{urgentCount} 活跃警报</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-auto z-10">
                        <div className="bg-black/30 rounded p-2.5 border border-white/5">
                            <div className="text-[9px] text-content-muted uppercase mb-0.5">报告总数</div>
                            <div className="text-lg font-mono text-white leading-none">{newsItems.length}</div>
                        </div>
                        <div className="bg-black/30 rounded p-2.5 border border-white/5">
                            <div className="text-[9px] text-content-muted uppercase mb-0.5">传闻热度</div>
                            <div className="text-lg font-mono text-emerald-400 leading-none">{rumorIndex.size}</div>
                        </div>
                        <div className="bg-black/30 rounded p-2.5 border border-white/5">
                            <div className="text-[9px] text-content-muted uppercase mb-0.5">预测趋势</div>
                            <div className="text-lg font-mono text-accent-blue leading-none">稳定</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 紧凑筛选栏 (固定) */}
            <div className="shrink-0 flex items-center justify-between border-b border-white/10 pb-2">
                <div className="text-xs font-bold text-content-secondary uppercase tracking-wider flex items-center gap-2">
                    <ListChecks size={14}/> 信息流
                </div>
                <div className="flex bg-black/30 p-0.5 rounded border border-white/5">
                    {['全部', '紧急', '普通', '一般'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={clsx(
                                "px-3 py-1 text-[10px] uppercase font-bold rounded transition-all",
                                filter === f ? "bg-white/10 text-white shadow-sm" : "text-content-muted hover:text-content-secondary"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* 瀑布流内容区 (滚动) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                {filteredNews.length > 0 ? (
                    <div className="columns-1 md:columns-2 gap-3 space-y-3 pb-4">
                        {filteredNews.map((item) => (
                            <NewsCard key={item.id} item={item} linkedRumor={item.关联传闻 ? rumorIndex.get(item.关联传闻) : undefined} onNavigateToRumor={onNavigateToRumor} />
                        ))}
                    </div>
                ) : (
                     <div className="h-40 flex flex-col items-center justify-center text-content-muted/30 border-2 border-dashed border-white/5 rounded-xl">
                        <Scroll size={24} className="mb-2 opacity-50"/>
                        <span className="text-[10px] uppercase tracking-[0.2em]">暂无活跃公告</span>
                     </div>
                )}
            </div>
        </div>
    );
};

const DenatusPanel = ({ world }: { world: WorldState }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
        <div className="pb-4 border-b border-purple-500/20 flex justify-between items-end shrink-0">
            <div>
                <h3 className="text-3xl font-display uppercase tracking-widest text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.3)]">诸神神会</h3>
                <div className="text-[10px] text-purple-400/50 font-mono mt-1 tracking-widest">诸神神会协议 // 神圣集会</div>
            </div>
            <Crown size={32} className="text-purple-500/30" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
             {/* Left: Highlight Card */}
            <div className="md:col-span-1 bg-[#1a1025] border border-purple-500/20 p-8 rounded-xl flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.1),transparent_70%)] pointer-events-none"/>
                <div className="text-center relative z-10 overflow-y-auto custom-scrollbar max-h-full">
                     <span className="text-[10px] text-purple-400/70 uppercase tracking-[0.3em] mb-4 block">当前议题</span>
                     <h2 className="text-2xl font-display text-white mb-8 leading-tight drop-shadow-md">"{world.诸神神会?.神会主题 || "未定"}"</h2>
                     
                     <div className="w-full h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent mb-8"/>
                     
                     <div className="space-y-4">
                        <div>
                            <span className="text-[10px] text-purple-400/70 uppercase tracking-wider block mb-1">最终决议</span>
                            <div className="text-lg font-mono text-emerald-400">{world.诸神神会?.最终结果 || "待定"}</div>
                        </div>
                        <div>
                            <span className="text-[10px] text-purple-400/70 uppercase tracking-wider block mb-1">下次会议</span>
                            <div className="text-sm font-mono text-purple-300">{world.诸神神会?.下次神会开启时间 || "未知"}</div>
                        </div>
                     </div>
                </div>
            </div>

            {/* Right: Transcription Terminal */}
            <div className="md:col-span-2 bg-black/40 border border-white/10 rounded-xl flex flex-col overflow-hidden">
                 <div className="px-5 py-3 border-b border-white/5 bg-white/5 flex justify-between items-center shrink-0">
                     <span className="text-[10px] font-bold text-content-muted uppercase tracking-[0.2em] flex items-center gap-2">
                        <ListChecks size={14}/> 会议记录
                     </span>
                     <div className="flex gap-1">
                         <div className="w-2 h-2 rounded-full bg-red-500/20" />
                         <div className="w-2 h-2 rounded-full bg-amber-500/20" />
                         <div className="w-2 h-2 rounded-full bg-emerald-500/20" />
                     </div>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 font-mono text-sm relative">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,11,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 pointer-events-none bg-[length:100%_4px,3px_100%]"/>
                    
                    {world.诸神神会?.讨论内容?.length > 0 ? (
                        world.诸神神会.讨论内容.map((line, idx) => (
                            <motion.div 
                                key={idx} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="flex gap-4 relative z-10"
                            >
                                <span className={clsx("font-bold shrink-0 w-24 text-right truncate opacity-80", idx % 2 === 0 ? "text-purple-400" : "text-cyan-400")}>
                                    @{line.角色}
                                </span>
                                <span className="text-content-primary/90 font-serif border-l border-white/10 pl-4 py-0.5">
                                    {line.对话}
                                </span>
                            </motion.div>
                        ))
                    ) : (
                        <div className="h-full flex items-center justify-center text-content-muted text-xs italic opacity-50">
                            &gt; 未检测到音频数据_
                        </div>
                    )}
                 </div>
            </div>
        </div>
    </div>
);

const RumorCard = ({ rumor }: { rumor: RumorItem }) => {
    const cred = rumor.可信度 || 'unknown';
    const config = cred === 'verified' 
        ? { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-900/10', label: '已验证情报' }
        : cred === 'fake' 
        ? { text: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-900/10', label: '虚假情报' }
        : { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-900/10', label: '未核实情报' };

    return (
        <motion.div 
            whileHover={{ scale: 1.01 }}
            className="bg-surface-base/40 border border-white/5 hover:border-white/20 transition-all rounded-lg p-5 group flex flex-col justify-between"
        >
            <div>
                 <div className="flex items-start justify-between mb-3">
                     <div className="flex items-center gap-3">
                        <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-black/40 border shadow-inner", config.border)}>
                            <Mic2 size={14} className={config.text} />
                        </div>
                        <div className="flex flex-col">
                            <span className={clsx("text-[9px] uppercase tracking-wider font-bold", config.text)}>
                                {config.label}
                            </span>
                            <span className="text-[9px] text-content-muted font-mono">{rumor.发现时间 || '近期'}</span>
                        </div>
                     </div>
                     <div className="text-[10px] text-content-muted/50 font-mono">ID: {rumor.id}</div>
                 </div>
                 
                 <h4 className="text-sm font-bold text-content-primary group-hover:text-white transition-colors mb-2 leading-tight">"{rumor.主题}"</h4>
                 {rumor.内容 && <p className="text-xs text-content-secondary leading-relaxed mb-4 line-clamp-3">{rumor.内容}</p>}
             </div>
             
             <div>
                 <div className="flex items-center gap-2 mb-2 w-full">
                     <span className="text-[9px] text-content-muted uppercase shrink-0">传播度</span>
                     <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                         <div className={clsx("h-full opacity-80", config.bg.replace('/10', ''))} style={{ width: `${rumor.传播度}%` }} />
                     </div>
                     <span className="text-[9px] font-mono text-content-primary">{rumor.传播度}%</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {(rumor.话题标签 || []).map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-white/5 border border-white/5 rounded text-content-muted font-mono flex items-center gap-1 hover:text-white hover:border-white/20 transition-colors">
                            <Hash size={10}/> {tag}
                        </span>
                    ))}
                 </div>
             </div>
        </motion.div>
    );
};

const RumorsPanel = ({ world }: { world: WorldState }) => {
    const rumors = Array.isArray(world.街头传闻) ? world.街头传闻 : [];
    
    // Sort by spread (heat)
    const sortedRumors = [...rumors].sort((a,b) => b.传播度 - a.传播度);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="pb-4 border-b border-amber-500/20 flex justify-between items-end shrink-0">
                <div>
                    <h3 className="text-2xl font-display uppercase tracking-widest text-accent-gold drop-shadow-sm">街头传闻</h3>
                    <div className="text-[10px] text-amber-500/50 font-mono mt-1 tracking-widest">街头情报 // 热力图分析</div>
                </div>
                <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-2 text-amber-400">
                    <TrendingUp size={14} />
                    <span className="text-[10px] font-bold tracking-widest">{rumors.length} 活跃话题</span>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pb-4 pr-2">
                {sortedRumors.length > 0 ? sortedRumors.map(r => (
                    <RumorCard key={r.id} rumor={r} />
                )) : (
                     <div className="col-span-full py-20 flex flex-col items-center justify-center text-content-muted border border-dashed border-white/5 rounded-xl">
                        <span className="text-xs uppercase tracking-widest opacity-50">未检测到相关讨论</span>
                     </div>
                )}
            </div>
        </div>
    );
};

const FactionPyramidRow = ({ items, tier, color }: { items: string[], tier: string, color: string }) => (
    <div className="flex flex-col items-center w-full relative group">
        <div className={clsx(
            "w-full text-center py-2 border-b border-current mb-4 uppercase tracking-[0.3em] font-display font-bold text-sm bg-gradient-to-r from-transparent via-current to-transparent bg-clip-text text-transparent opacity-80 group-hover:opacity-100 transition-opacity",
            color
        )}>
            {tier}
        </div>
        <div className="flex flex-wrap justify-center gap-3 max-w-4xl">
            {items.length > 0 ? items.map(f => (
                <motion.div 
                    whileHover={{ scale: 1.05, y: -2 }}
                    key={f} 
                    className={clsx(
                        "px-4 py-2 bg-gradient-to-br border backdrop-blur-sm rounded-lg shadow-lg min-w-[120px] text-center",
                        tier === 'S级' 
                            ? "from-yellow-900/40 to-black/60 border-yellow-500/30 text-yellow-100" 
                            : tier === 'A级'
                            ? "from-indigo-900/40 to-black/60 border-indigo-500/30 text-indigo-100"
                            : "from-zinc-800/40 to-black/60 border-zinc-500/30 text-zinc-300"
                    )}
                >
                    <span className="text-xs font-bold tracking-wide">{f}</span>
                    <div className="h-0.5 w-full bg-white/10 mt-1 rounded-full overflow-hidden">
                        <div className={clsx("h-full w-2/3 opacity-50", 
                            tier === 'S级' ? "bg-yellow-500" : tier === 'A级' ? "bg-indigo-500" : "bg-zinc-500"
                        )}/>
                    </div>
                </motion.div>
            )) : <span className="text-xs text-content-muted italic opacity-50">无眷族</span>}
        </div>
        
        {tier !== 'B-I级' && (
            <div className="h-8 w-px bg-gradient-to-b from-white/20 to-transparent mt-4" />
        )}
    </div>
);

const FactionsPanel = ({ world }: { world: WorldState }) => {
    const tiers = world.派阀格局 || { S级: [], A级: [], B级至I级: [], 备注: "" };
    
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="pb-4 border-b border-indigo-500/20 shrink-0">
                <h3 className="text-2xl font-display uppercase tracking-widest text-indigo-400 drop-shadow-sm">派阀格局</h3>
                <div className="text-[10px] text-indigo-400/50 font-mono mt-1 tracking-widest">眷族层级 // 权力结构</div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-start pt-8 pb-12 overflow-y-auto custom-scrollbar relative">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                    <Flag size={300} />
                </div>

                <div className="w-full space-y-2 z-10">
                    <FactionPyramidRow items={tiers.S级 || []} tier="S级" color="text-yellow-500" />
                    <FactionPyramidRow items={tiers.A级 || []} tier="A级" color="text-indigo-400" />
                    <FactionPyramidRow items={tiers.B级至I级 || []} tier="B-I级" color="text-zinc-500" />
                </div>

                {tiers.备注 && (
                    <div className="mt-12 max-w-lg text-center p-4 border border-white/5 bg-black/40 rounded-lg text-xs text-content-secondary font-serif italic relative">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 bg-black text-[10px] text-content-muted uppercase tracking-wider">分析</div>
                        "{tiers.备注}"
                    </div>
                )}
            </div>
        </div>
    );
};

const WarGamePanel = ({ world }: { world: WorldState }) => {
    const war = world.战争游戏 || { 状态: "未开始", 参战眷族: [], 形式: "", 赌注: "", 举办时间: "", 结束时间: "", 结果: "", 备注: "" };
    const isActive = war.状态 === '进行中';
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
             <div className="pb-4 border-b border-red-500/20 shrink-0">
                <h3 className="text-2xl font-display uppercase tracking-widest text-accent-red drop-shadow-sm">战争游戏</h3>
                <div className="text-[10px] text-red-500/50 font-mono mt-1 tracking-widest">战争游戏协议 // PvP事件</div>
            </div>

            <div className={clsx(
                "flex-1 border rounded-xl p-8 relative overflow-hidden flex flex-col items-center justify-center text-center transition-all duration-500",
                isActive ? "bg-red-950/20 border-red-500/30 shadow-[0_0_50px_rgba(220,38,38,0.1)]" : "bg-black/20 border-zinc-800"
            )}>
                  {isActive && (
                       <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(220,38,38,0.05)_20px,rgba(220,38,38,0.05)_40px)] pointer-events-none"/>
                  )}
                  
                  <motion.div 
                    animate={isActive ? { scale: [1, 1.1, 1], filter: ["drop-shadow(0 0 0px red)", "drop-shadow(0 0 10px red)", "drop-shadow(0 0 0px red)"] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                      <Swords size={isActive ? 80 : 64} className={clsx("mb-8", isActive ? "text-accent-red" : "text-content-muted opacity-50")} />
                  </motion.div>
                  
                  <h2 className={clsx("text-4xl font-display uppercase mb-4 tracking-wider", isActive ? "text-accent-red" : "text-content-secondary")}>
                      {war.状态 || "无进行中的战争游戏"}
                  </h2>
                  
                  {isActive ? (
                      <div className="space-y-8 w-full max-w-2xl relative z-10 mt-8">
                          <div className="flex items-center justify-center gap-8 text-2xl font-display text-white">
                                <span className="text-red-400 drop-shadow-md">{war.参战眷族?.[0] || "未知"}</span>
                                <span className="text-5xl font-bold italic text-white/20">VS</span>
                                <span className="text-blue-400 drop-shadow-md">{war.参战眷族?.[1] || "未知"}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-8 text-left max-w-md mx-auto">
                                <div className="bg-black/40 p-4 rounded border border-red-500/30">
                                     <span className="text-[10px] text-red-400/70 uppercase tracking-wider block mb-1">对抗形式</span>
                                     <span className="text-content-primary font-bold">{war.形式}</span>
                                </div>
                                <div className="bg-black/40 p-4 rounded border border-red-500/30">
                                     <span className="text-[10px] text-red-400/70 uppercase tracking-wider block mb-1">赌注</span>
                                     <span className="text-content-primary font-bold">{war.赌注}</span>
                                </div>
                          </div>
                      </div>
                  ) : (
                      <p className="text-content-muted text-sm max-w-xs mt-4 leading-relaxed opacity-50">
                          未检测到活跃冲突。目前处于和平条约生效期。
                      </p>
                  )}
            </div>
        </div>
    );
};

const TrackingPanel = ({ world }: { world: WorldState }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
         <div className="pb-4 border-b border-cyan-500/20 shrink-0">
            <h3 className="text-2xl font-display uppercase tracking-widest text-accent-blue drop-shadow-sm">后台跟踪</h3>
            <div className="text-[10px] text-cyan-400/50 font-mono mt-1 tracking-widest">后台进程 // NPC追踪</div>
        </div>
        
        <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2 pb-4">
             {(world.NPC后台跟踪 || []).length > 0 ? world.NPC后台跟踪.map((track, i) => (
                 <div key={i} className="bg-surface-base/40 border border-white/5 p-4 flex items-center justify-between hover:border-cyan-500/30 transition-colors group rounded-lg">
                     <div className="flex items-center gap-5">
                         <div className="relative">
                            <div className="w-2.5 h-2.5 rounded-full bg-accent-blue animate-pulse" />
                            <div className="absolute inset-0 bg-accent-blue rounded-full animate-ping opacity-20"/>
                         </div>
                         <div>
                             <div className="text-sm font-bold text-content-primary group-hover:text-cyan-300 transition-colors font-display tracking-wide">{track.NPC}</div>
                             <div className="text-xs text-content-muted mt-0.5">{track.当前行动}</div>
                         </div>
                     </div>
                     <div className="text-right">
                         <div className="text-[9px] text-content-muted/50 font-mono uppercase tracking-wider mb-1">状态</div>
                         <div className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{track.进度 || '运行中'}</div>
                     </div>
                 </div>
             )) : (
                 <div className="h-full flex flex-col items-center justify-center text-content-muted border border-dashed border-white/5 rounded-xl opacity-50">
                    <Radar size={32} className="mb-3"/>
                    <span className="text-xs uppercase tracking-widest">无活跃追踪</span>
                 </div>
             )}
        </div>
    </div>
);

const ArrowUpRight = ({ size = 24, className, ...props }: any) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className} 
      {...props}
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );

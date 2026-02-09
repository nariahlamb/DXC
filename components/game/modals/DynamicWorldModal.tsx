import React, { useState } from 'react';
import { X, Globe, Mic2, AlertTriangle, Scroll, Radar, Swords, Activity, Zap, Radio, Target, Calendar, Clock } from 'lucide-react';
import { WorldState } from '../../../types';

interface DynamicWorldModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldState?: WorldState;
  npcStates?: any[];
  gameTime?: string;
  onSilentWorldUpdate?: () => void;
  onForceNpcBacklineUpdate?: () => void;
}

type WorldTab = 'GUILD' | 'RUMORS' | 'TRACKING' | 'WAR_GAME';

const parseGameTime = (input?: string) => {
  if (!input) return null;
  const dayMatch = input.match(/第\s*(\d+)\s*日/);
  const timeMatch = input.match(/(\d{1,2}):(\d{2})/);
  if (!dayMatch || !timeMatch) return null;
  const day = parseInt(dayMatch[1], 10);
  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  if ([day, hour, minute].some(n => Number.isNaN(n))) return null;
  return day * 24 * 60 + hour * 60 + minute;
};

const parseDay = (label?: string) => {
  if (!label) return null;
  const match = label.match(/第\s*(\d+)\s*日/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  return Number.isNaN(day) ? null : day;
};

export const DynamicWorldModal: React.FC<DynamicWorldModalProps> = ({ 
  isOpen, 
  onClose,
  worldState,
  gameTime,
  onSilentWorldUpdate,
  onForceNpcBacklineUpdate
}) => {
  const [activeTab, setActiveTab] = useState<WorldTab>('GUILD');

  const safeWorldState: WorldState = worldState || {
    地下城异常指数: 0,
    公会官方通告: [],
    街头传闻: [],
    NPC后台跟踪: [],
    战争游戏: { 状态: "未开始", 参战眷族: [], 形式: "", 赌注: "", 举办时间: "", 结束时间: "", 结果: "", 备注: "" },
    下次更新: "未知"
  };

  const nowValue = parseGameTime(gameTime);
  const nextValue = parseGameTime(safeWorldState.下次更新);
  const isUpdateDue = nowValue !== null && nextValue !== null ? nowValue >= nextValue : false;

  if (!isOpen) return null;

  // Theme colors configuration (using full classes for Tailwind JIT)
  const themeConfig = {
    GUILD: {
      main: 'border-cyan-900/50',
      bgDecor1: 'bg-cyan-900/5',
      bgDecor2: 'bg-cyan-900/5',
      iconBg: 'bg-cyan-600',
      iconShadow: 'shadow-cyan-500/20',
      titleAccent: 'text-cyan-500',
      updateBorder: 'border-green-500',
      cornerBorder: 'border-cyan-600/30'
    },
    RUMORS: {
      main: 'border-emerald-900/50',
      bgDecor1: 'bg-emerald-900/5',
      bgDecor2: 'bg-emerald-900/5',
      iconBg: 'bg-emerald-600',
      iconShadow: 'shadow-emerald-500/20',
      titleAccent: 'text-emerald-500',
      updateBorder: 'border-green-500',
      cornerBorder: 'border-emerald-600/30'
    },
    WAR_GAME: {
      main: 'border-rose-900/50',
      bgDecor1: 'bg-rose-900/5',
      bgDecor2: 'bg-rose-900/5',
      iconBg: 'bg-rose-600',
      iconShadow: 'shadow-rose-500/20',
      titleAccent: 'text-rose-500',
      updateBorder: 'border-green-500',
      cornerBorder: 'border-rose-600/30'
    },
    TRACKING: {
      main: 'border-violet-900/50',
      bgDecor1: 'bg-violet-900/5',
      bgDecor2: 'bg-violet-900/5',
      iconBg: 'bg-violet-600',
      iconShadow: 'shadow-violet-500/20',
      titleAccent: 'text-violet-500',
      updateBorder: 'border-green-500',
      cornerBorder: 'border-violet-600/30'
    }
  };

  const currentTheme = themeConfig[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/90 backdrop-blur-md p-3 md:p-4 animate-in zoom-in-95 duration-300 overflow-y-auto overscroll-contain">
      {/* Main Container */}
      <div className={`w-full max-w-7xl h-auto min-h-[90vh] md:h-[90vh] md:min-h-0 bg-zinc-950 border-2 ${currentTheme.main} relative flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden transition-colors duration-500 my-2 md:my-0`}>
        
        {/* Background Decor - Dynamic P5 Style Stripes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className={`absolute top-[-10%] right-[-10%] w-[60%] h-[120%] ${currentTheme.bgDecor1} transform -skew-x-12 transition-colors duration-500`} />
            <div className={`absolute bottom-[-10%] left-[-20%] w-[40%] h-[120%] ${currentTheme.bgDecor2} transform -skew-x-12 transition-colors duration-500`} />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        {/* Header Area */}
        <div className="relative z-20 flex justify-between items-start p-6 pb-2">
           <div className="flex items-center gap-6">
              <div className={`${currentTheme.iconBg} text-black p-3 transform -skew-x-12 shadow-lg ${currentTheme.iconShadow} transition-colors duration-500`}>
                <Globe className="transform skew-x-12" size={32} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className={`text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-[2px_2px_0_rgba(0,0,0,1)]`}>
                  世界情报监测
                  <span className={`${currentTheme.titleAccent} text-lg ml-2 not-italic tracking-normal`}>// SYSTEM.WORLD</span>
                </h2>
                <div className="flex items-center gap-4 mt-1">
                   <div className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] font-mono uppercase tracking-widest border-l-2 border-zinc-600">
                      EULALIE MONITORING NETWORK
                   </div>
                   <div className="text-xs font-bold text-zinc-500 flex items-center gap-2">
                      <Clock size={12} />
                      {gameTime || "TIME UNKNOWN"}
                   </div>
                </div>
              </div>
           </div>

           <div className="flex flex-col items-end gap-2">
              <button 
                onClick={onClose} 
                className="group relative px-6 py-2 bg-zinc-900 border border-zinc-700 hover:bg-red-600 hover:border-red-500 transition-all duration-300 transform -skew-x-12"
              >
                <div className="transform skew-x-12 flex items-center gap-2 font-black uppercase tracking-widest text-zinc-400 group-hover:text-white">
                  <span className="text-xs">Close</span>
                  <X size={20} />
                </div>
              </button>
              
              <div className={`flex items-center gap-2 px-4 py-1 bg-black/50 border-b-2 ${isUpdateDue ? 'border-green-500' : 'border-zinc-500'} text-xs font-mono`}>
                <span className="text-zinc-500">NEXT UPDATE:</span>
                <span className={isUpdateDue ? 'text-green-400 animate-pulse' : 'text-zinc-300'}>
                  {safeWorldState.下次更新 || "CALCULATING..."}
                </span>
              </div>
           </div>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden relative z-10">
          
          {/* Sidebar Navigation - Stylized Slanted Menu */}
          <div className="w-full md:w-72 max-h-[40vh] md:max-h-none p-4 md:p-6 flex flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar touch-pan-y overscroll-contain">
             <div className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] mb-2 px-2">Navigation</div>
             
             <NavButton 
               label="公会通告" 
               subLabel="GUILD NEWS" 
               icon={<Scroll size={20}/>} 
               isActive={activeTab === 'GUILD'} 
               onClick={() => setActiveTab('GUILD')}
               colorClass="cyan"
               activeBg="bg-cyan-600"
               activeBorder="border-cyan-400"
               hoverBorder="hover:border-cyan-500"
               activeText="text-cyan-400"
               hoverText="group-hover:text-cyan-400"
             />
             <NavButton 
               label="街头传闻" 
               subLabel="RUMORS" 
               icon={<Mic2 size={20}/>} 
               isActive={activeTab === 'RUMORS'} 
               onClick={() => setActiveTab('RUMORS')}
               colorClass="emerald"
               activeBg="bg-emerald-600"
               activeBorder="border-emerald-400"
               hoverBorder="hover:border-emerald-500"
               activeText="text-emerald-400"
               hoverText="group-hover:text-emerald-400"
             />
             <NavButton 
               label="战争游戏" 
               subLabel="WAR GAME" 
               icon={<Swords size={20}/>} 
               isActive={activeTab === 'WAR_GAME'} 
               onClick={() => setActiveTab('WAR_GAME')}
               colorClass="rose"
               activeBg="bg-rose-600"
               activeBorder="border-rose-400"
               hoverBorder="hover:border-rose-500"
               activeText="text-rose-400"
               hoverText="group-hover:text-rose-400"
             />
             <NavButton 
               label="后台跟踪" 
               subLabel="TRACKING" 
               icon={<Radar size={20}/>} 
               isActive={activeTab === 'TRACKING'} 
               onClick={() => setActiveTab('TRACKING')}
               colorClass="violet"
               activeBg="bg-violet-600"
               activeBorder="border-violet-400"
               hoverBorder="hover:border-violet-500"
               activeText="text-violet-400"
               hoverText="group-hover:text-violet-400"
             />

             <div className="mt-auto pt-6 border-t border-zinc-800/50">
                {isUpdateDue && onSilentWorldUpdate && (
                    <button 
                        onClick={onSilentWorldUpdate}
                        className="w-full group relative overflow-hidden p-4 bg-zinc-900 border border-green-900 hover:border-green-500 transition-all duration-300"
                    >
                        <div className="absolute inset-0 bg-green-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                        <div className="relative z-10 flex items-center justify-center gap-2 text-green-500 group-hover:text-green-300 font-black uppercase tracking-wider text-sm">
                            <Activity size={16} className="animate-pulse" /> 
                            <span>获取最新情报</span>
                        </div>
                    </button>
                )}
             </div>
          </div>

          {/* Main Panel Content */}
          <div className="flex-1 min-h-0 p-2 md:p-8 overflow-hidden relative">
             {/* Content Background Box */}
             <div className="w-full h-full min-h-0 bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm relative overflow-hidden">
                {/* Decorative Corner Lines */}
                <div className={`absolute top-0 left-0 w-32 h-32 border-l-4 border-t-4 ${currentTheme.cornerBorder} rounded-tl-3xl pointer-events-none transition-colors duration-500`} />
                <div className={`absolute bottom-0 right-0 w-32 h-32 border-r-4 border-b-4 ${currentTheme.cornerBorder} rounded-br-3xl pointer-events-none transition-colors duration-500`} />
                
                <div className="h-full overflow-y-auto custom-scrollbar touch-pan-y overscroll-contain p-4 md:p-6">
                  {activeTab === 'GUILD' && <GuildPanel world={safeWorldState} />}
                  {activeTab === 'RUMORS' && <RumorsPanel world={safeWorldState} gameTime={gameTime} />}
                  {activeTab === 'WAR_GAME' && <WarGamePanel world={safeWorldState} />}
                  {activeTab === 'TRACKING' && <TrackingPanel world={safeWorldState} onForceNpcBacklineUpdate={onForceNpcBacklineUpdate} />}
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// --- Components ---

interface NavButtonProps {
  label: string;
  subLabel: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  colorClass: string;
  activeBg: string;
  activeBorder: string;
  hoverBorder: string;
  activeText: string;
  hoverText: string;
}

const NavButton: React.FC<NavButtonProps> = ({ 
    label, subLabel, icon, isActive, onClick, 
    colorClass, activeBg, activeBorder, hoverBorder, activeText, hoverText 
}) => {
  return (
    <button 
      onClick={onClick}
      className={`group relative w-full h-16 transform transition-all duration-300 ${isActive ? 'translate-x-4' : 'hover:translate-x-2'}`}
    >
      {/* Background Shape */}
      <div className={`absolute inset-0 transform -skew-x-12 border-2 transition-all duration-300 
        ${isActive 
          ? `${activeBg} ${activeBorder} shadow-[4px_4px_0_rgba(0,0,0,0.5)]` 
          : `bg-zinc-900 border-zinc-800 ${hoverBorder}`
        }`}
      />
      
      {/* Content */}
      <div className="absolute inset-0 flex items-center px-6 gap-4 transform -skew-x-12">
        <div className={`transition-colors duration-300 ${isActive ? 'text-black' : `text-zinc-500 ${hoverText}`}`}>
          {icon}
        </div>
        <div className="flex flex-col items-start">
           <span className={`text-lg font-black italic uppercase tracking-tighter transition-colors duration-300 ${isActive ? 'text-black' : 'text-zinc-300'}`}>
             {label}
           </span>
           <span className={`text-[10px] font-mono tracking-widest uppercase transition-colors duration-300 ${isActive ? 'text-black/70' : 'text-zinc-600'}`}>
             {subLabel}
           </span>
        </div>
      </div>
    </button>
  );
};

const GuildPanel = ({ world }: { world: WorldState }) => (
  <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
    <PanelHeader title="公会官方通告" subtitle="GUILD ANNOUNCEMENTS" colorClass="text-cyan-500" gradientClass="from-cyan-900" subtitleColor="text-cyan-800" />

    {/* Irregularity Meter */}
    <div className="relative p-8 bg-zinc-950 border border-zinc-800 overflow-hidden group">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-transparent to-transparent" />
      
      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
         {/* Circle Meter */}
         <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="70" fill="none" stroke="#333" strokeWidth="12" />
              <circle 
                cx="80" cy="80" r="70" 
                fill="none" 
                stroke={world.地下城异常指数 > 70 ? '#ef4444' : world.地下城异常指数 > 30 ? '#eab308' : '#06b6d4'}
                strokeWidth="12"
                strokeDasharray="440"
                strokeDashoffset={440 - (440 * world.地下城异常指数) / 100}
                className="transition-all duration-1000 ease-out"
                strokeLinecap="butt"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
               <span className="text-4xl font-black italic text-white">{world.地下城异常指数}<span className="text-sm not-italic text-zinc-500">%</span></span>
            </div>
         </div>

         <div className="flex-1 space-y-4">
            <div>
              <h4 className="text-xl font-black text-red-500 uppercase tracking-widest italic flex items-center gap-2">
                 <AlertTriangle size={24} />
                 地下城异常指数
              </h4>
              <div className="h-1 w-full bg-zinc-800 mt-2 relative overflow-hidden">
                 <div className="absolute inset-0 bg-red-500/20 animate-pulse" />
              </div>
            </div>
            
            <div className="bg-zinc-900/50 p-4 border-l-4 border-red-500">
               <div className="text-xs font-bold text-zinc-500 uppercase mb-1">Current Status / 当前状态</div>
               <p className={`text-lg font-bold ${world.地下城异常指数 > 50 ? 'text-red-400' : 'text-zinc-300'}`}>
                 {world.地下城异常指数 < 30 ? "STABLE / 稳定期 - 适合探索" : 
                  world.地下城异常指数 < 70 ? "CAUTION / 警戒期 - 不规则怪物刷新" : 
                  "DANGER / 危险期 - 强化种反应，极其危险"}
               </p>
            </div>
         </div>
      </div>
    </div>

    {/* News Feed */}
    <div className="space-y-4">
      {world.公会官方通告.length > 0 ? (
        world.公会官方通告.map((news, i) => (
          <div key={i} className="group relative bg-zinc-900 border-l-4 border-cyan-600 p-6 hover:bg-zinc-800 transition-all duration-300">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity">
               <Zap size={48} className="text-cyan-600" />
            </div>
            <div className="relative z-10 flex gap-4">
                <div className="mt-1 shrink-0 w-8 h-8 bg-cyan-900/30 flex items-center justify-center rounded-full text-cyan-400 font-bold border border-cyan-800">
                   {i + 1}
                </div>
                <div>
                   <div className="text-[10px] font-bold text-cyan-600 uppercase tracking-wider mb-1">Official Notice</div>
                   <p className="text-zinc-300 text-sm md:text-base leading-relaxed">{news}</p>
                </div>
            </div>
          </div>
        ))
      ) : (
        <EmptyState message="暂无官方通告" />
      )}
    </div>
  </div>
);

const RumorsPanel = ({ world, gameTime }: { world: WorldState; gameTime?: string }) => {
  const currentDay = parseDay(gameTime);
  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <PanelHeader title="街头传闻" subtitle="STREET RUMORS & GOSSIP" colorClass="text-emerald-500" gradientClass="from-emerald-900" subtitleColor="text-emerald-800" />

      <div className="grid grid-cols-1 gap-6">
        {world.街头传闻.length > 0 ? (
          world.街头传闻.map((rumor, i) => {
            const knownDay = parseDay(rumor.广为人知日);
            const calmDay = parseDay(rumor.风波平息日);
            const knownCountdown = currentDay !== null && knownDay !== null ? knownDay - currentDay : null;
            const calmCountdown = currentDay !== null && calmDay !== null ? calmDay - currentDay : null;
            
            const isActive = knownCountdown !== null && knownCountdown <= 0;

            return (
              <div key={i} className="relative bg-zinc-900 border border-zinc-700 p-6 overflow-hidden group hover:border-emerald-500 transition-colors duration-300">
                {/* Glitch Effect Background */}
                <div className="absolute inset-0 bg-[url('/assets/noise.png')] opacity-5 pointer-events-none" />
                <div className="absolute -right-10 -top-10 text-zinc-800 group-hover:text-emerald-900/20 transition-colors transform rotate-12">
                   <Radio size={150} />
                </div>

                <div className="relative z-10">
                   <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                         <div className={`p-2 ${isActive ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-400'} transform -skew-x-12`}>
                            <Mic2 size={20} className="transform skew-x-12" />
                         </div>
                         <h4 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">“{rumor.主题}”</h4>
                      </div>
                      <div className="px-3 py-1 bg-black/50 border border-zinc-700 text-[10px] uppercase font-mono text-zinc-400">
                         ID: RUMOR-{i+100}
                      </div>
                   </div>

                   <div className="flex flex-wrap gap-4 text-xs font-mono">
                       <div className="flex flex-col border-l-2 border-zinc-700 pl-3">
                           <span className="text-zinc-500 uppercase text-[9px]">传播日期 / Spread</span>
                           <span className={knownCountdown !== null && knownCountdown <= 0 ? 'text-emerald-400 font-bold' : 'text-zinc-300'}>
                              {knownCountdown !== null ? (knownCountdown <= 0 ? "已广为人知" : `${knownCountdown} 日后`) : "未知"}
                           </span>
                       </div>
                       <div className="flex flex-col border-l-2 border-zinc-700 pl-3">
                           <span className="text-zinc-500 uppercase text-[9px]">消退日期 / Fade</span>
                           <span className={calmCountdown !== null && calmCountdown <= 0 ? 'text-zinc-500 line-through' : 'text-zinc-300'}>
                              {calmCountdown !== null ? (calmCountdown <= 0 ? "已平息" : `${calmCountdown} 日后`) : "未知"}
                           </span>
                       </div>
                   </div>

                   <div className="mt-4 pt-4 border-t border-zinc-800/50 text-sm text-zinc-400 italic">
                       <span className="text-emerald-600 font-bold mr-2">[情报]</span>
                       有关该话题的讨论正在市井间流传...
                   </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState message="市井平静，暂无特别流言" />
        )}
      </div>
    </div>
  );
};

const WarGamePanel = ({ world }: { world: WorldState }) => {
  const war = world.战争游戏 || { 状态: "未开始", 参战眷族: [], 形式: "", 赌注: "", 举办时间: "", 结束时间: "", 结果: "", 备注: "" };
  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
       <PanelHeader title="战争游戏" subtitle="WAR GAME STATUS" colorClass="text-rose-500" gradientClass="from-rose-900" subtitleColor="text-rose-800" />

       <div className="bg-zinc-950 border-2 border-rose-900 relative overflow-hidden min-h-[400px] flex flex-col">
          {/* Stylized Background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-rose-900/20 via-black to-black" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-rose-900/10 pointer-events-none">
             <Swords size={400} />
          </div>

          <div className="relative z-10 p-8 flex-1 flex flex-col">
              {/* Header Info */}
              <div className="flex justify-between items-start border-b-2 border-rose-900/50 pb-6 mb-6">
                 <div>
                    <div className="text-rose-500 font-black uppercase tracking-[0.2em] text-xs mb-2">Current Status / 状态</div>
                    <div className="text-5xl md:text-6xl font-black text-white italic uppercase tracking-tighter text-shadow-red">
                        {war.状态 || "未开始"}
                    </div>
                 </div>
                 <div className="text-right">
                    <div className="text-zinc-500 font-bold uppercase tracking-[0.2em] text-xs mb-2">Battle Format / 形式</div>
                    <div className="text-3xl font-display text-zinc-300 uppercase">
                        {war.形式 || "待定"}
                    </div>
                 </div>
              </div>

              {/* VS Section */}
              <div className="flex-1 flex items-center justify-center my-8">
                  {(war.参战眷族 || []).length > 0 ? (
                      <div className="flex items-center gap-8 md:gap-16">
                          <div className="text-2xl md:text-4xl font-black text-white">{war.参战眷族[0] || "?"}</div>
                          <div className="text-6xl md:text-8xl font-black italic text-rose-600 transform -skew-x-12">VS</div>
                          <div className="text-2xl md:text-4xl font-black text-white">{war.参战眷族[1] || "?"}</div>
                      </div>
                  ) : (
                      <div className="text-zinc-600 font-black text-4xl uppercase tracking-widest opacity-50">
                          NO ACTIVE MATCH
                      </div>
                  )}
              </div>

              {/* Footer Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-rose-900/30">
                  <InfoBlock label="举办时间" value={war.举办时间 || "未知"} icon={<Calendar size={14} />} />
                  <InfoBlock label="结束时间" value={war.结束时间 || "未知"} icon={<Clock size={14} />} />
                  <InfoBlock label="赌注" value={war.赌注 || "未公开"} highlight />
              </div>
              
              {war.备注 && (
                 <div className="mt-6 bg-rose-950/30 border border-rose-800 p-3 text-xs text-rose-200 font-mono flex gap-2">
                    <span className="font-bold">NOTE:</span> {war.备注}
                 </div>
              )}
          </div>
       </div>
    </div>
  );
};

const TrackingPanel = ({ world, onForceNpcBacklineUpdate }: { world: WorldState; onForceNpcBacklineUpdate?: () => void }) => (
  <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
    <div className="flex justify-between items-center">
        <PanelHeader title="NPC 后台跟踪" subtitle="BACKGROUND SIMULATION MONITOR" colorClass="text-violet-500" gradientClass="from-violet-900" subtitleColor="text-violet-800" />
        {onForceNpcBacklineUpdate && (
           <button
             onClick={onForceNpcBacklineUpdate}
             className="px-4 py-2 bg-violet-900/30 border border-violet-500 text-violet-300 hover:bg-violet-500 hover:text-black transition-all font-bold uppercase text-xs transform -skew-x-12"
           >
             <div className="transform skew-x-12 flex gap-2 items-center">
                <Activity size={14} /> 强制刷新
             </div>
           </button>
         )}
    </div>

    <div className="grid grid-cols-1 gap-4">
      {world.NPC后台跟踪 && world.NPC后台跟踪.length > 0 ? (
        world.NPC后台跟踪.map((track, i) => (
          <div key={i} className="bg-black border border-violet-900/50 p-1 hover:border-violet-500 transition-colors group">
             <div className="bg-zinc-900 p-4 flex gap-5 relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 p-2">
                    <Target size={60} className="text-violet-900/20 group-hover:text-violet-900/40 transition-colors" />
                </div>
                
                {/* Avatar Placeholder */}
                <div className="w-16 h-16 bg-violet-900/20 border border-violet-700/50 flex items-center justify-center shrink-0">
                    <span className="text-2xl font-black text-violet-500">{track.NPC[0]}</span>
                </div>

                <div className="flex-1 relative z-10">
                   <div className="flex justify-between items-start mb-2">
                      <h4 className="text-lg font-bold text-white tracking-wide">{track.NPC}</h4>
                      <span className="text-[10px] font-mono bg-violet-900/30 text-violet-300 px-2 py-0.5 border border-violet-800">
                          PHASE {track.当前阶段 ?? '?'}
                      </span>
                   </div>
                   
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                       <div>
                          <div className="text-zinc-600 uppercase text-[9px] font-bold">Action / 行动</div>
                          <div className="text-zinc-300 truncate">{track.当前行动}</div>
                       </div>
                       <div>
                          <div className="text-zinc-600 uppercase text-[9px] font-bold">Loc / 地点</div>
                          <div className="text-zinc-300 truncate">{track.地点 || track.位置 || 'Unknown'}</div>
                       </div>
                       <div>
                          <div className="text-zinc-600 uppercase text-[9px] font-bold">Progress / 进度</div>
                          <div className="text-green-400 font-mono">{track.进度 || "-"}</div>
                       </div>
                       <div>
                          <div className="text-zinc-600 uppercase text-[9px] font-bold">ETA / 预计</div>
                          <div className="text-zinc-400 font-mono">{track.预计完成 || "-"}</div>
                       </div>
                   </div>
                </div>
             </div>
          </div>
        ))
      ) : (
        <EmptyState message="系统空闲，暂无后台活动追踪" />
      )}
    </div>
  </div>
);

// --- Utility Components ---

const PanelHeader = ({ title, subtitle, colorClass, gradientClass, subtitleColor }: 
  { title: string, subtitle: string, colorClass: string, gradientClass: string, subtitleColor: string }) => (
  <div className="flex items-center gap-4 mb-2">
      <div>
          <h3 className={`text-3xl md:text-4xl font-black italic ${colorClass} uppercase tracking-tighter`}>{title}</h3>
          <div className={`text-[10px] font-bold ${subtitleColor} tracking-[0.3em] uppercase`}>{subtitle}</div>
      </div>
      <div className={`h-2 flex-1 bg-gradient-to-r ${gradientClass} to-transparent transform skew-x-[-20deg]`} />
  </div>
);

const InfoBlock = ({ label, value, icon, highlight }: any) => (
    <div>
        <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold uppercase mb-1">
            {icon} {label}
        </div>
        <div className={`font-mono text-sm ${highlight ? 'text-yellow-500 font-bold' : 'text-zinc-300'}`}>
            {value}
        </div>
    </div>
);

const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-800 text-zinc-600">
        <Radar size={48} className="mb-4 opacity-20" />
        <p className="italic">{message}</p>
    </div>
);

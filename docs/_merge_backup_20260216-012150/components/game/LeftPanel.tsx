
import React from 'react';
import { CharacterStats, Difficulty } from '../../types';
import { Crown, Trophy, Activity, User, Shield, Zap } from 'lucide-react';
import { CharacterStatsContent } from './modals/AttributePanel';
import clsx from 'clsx';
import Icons from '../../utils/iconMapper';

interface LeftPanelProps {
  stats: CharacterStats;
  className?: string;
  isHellMode?: boolean;
  difficulty?: Difficulty;
  onOpenPanel: (tab: 'STATUS' | 'EQUIP' | 'SKILLS') => void;
}

type Tab = 'STATUS' | 'EQUIP' | 'SKILLS';

export const LeftPanel: React.FC<LeftPanelProps> = ({ 
    stats, 
    className = '', 
    isHellMode,
    onOpenPanel
}) => {
  // Active tab is visually STATUS always, as others open modals
  const activeTab: Tab = 'STATUS';

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
      { id: 'STATUS', label: '属性', icon: <User size={14} /> },
      { id: 'EQUIP', label: '装备', icon: <Icons.Shield size={14} /> },
      { id: 'SKILLS', label: '能力', icon: <Zap size={14} /> },
  ];

  const handleTabClick = (tabId: Tab) => {
      if (tabId === 'STATUS') {
          // Already viewing status, maybe scroll to top?
          return;
      }
      onOpenPanel(tabId);
  };

  return (
    <div className={`w-full lg:w-[22%] lg:min-w-[260px] lg:max-w-[320px] h-full relative flex flex-col p-0 overflow-hidden bg-[#0a0c10]/90 backdrop-blur-sm border-r border-white/5 ${className}`}>
      {/* Background Decor - Tech Grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
           style={{ backgroundImage: 'linear-gradient(rgba(37, 99, 235, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(37, 99, 235, 0.05) 1px, transparent 1px)', backgroundSize: '100px 100px' }} />

      {/* --- Top Card: Avatar & Familia --- */}
      <div className="relative p-4 pb-5 bg-[#0e1217] border-b border-white/5 shrink-0">
         <div className="flex gap-4">
             {/* Portrait Frame - Tech Diamond */}
              <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 relative group z-10">
                  {/* Guild Rank Badge - Minimal */}
                  <div className="absolute -top-2 -left-2 w-6 h-6 text-[10px] font-display font-bold text-slate-100 flex items-center justify-center z-30 bg-blue-600 tech-clip-l shadow-lg shadow-blue-900/50">
                      {stats.公会评级 || 'I'}
                  </div>

                  <div className="w-full h-full relative overflow-hidden tech-clip-r border-2 border-slate-700 group-hover:border-cyan-500 transition-colors">
                      <img
                        src={stats.头像 || "https://picsum.photos/200/200"}
                        alt="Avatar"
                        className="w-full h-full object-cover grayscale-[30%] group-hover:grayscale-0 transition-all duration-500"
                      />
                  </div>

                  {/* Race Badge - Minimal */}
                  <div className="absolute -bottom-2 -right-2 text-slate-300 text-[9px] font-bold px-2 py-0.5 z-30 bg-slate-800 border border-slate-600">
                      {stats.种族}
                  </div>
              </div>

             {/* Name & Title */}
             <div className="flex-1 min-w-0 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] text-slate-500 uppercase tracking-widest">眷族</span>
                    <span className="text-xs text-blue-400 font-bold truncate">{stats.所属眷族}</span>
                </div>
                <h2 className="text-lg md:text-xl font-display text-slate-100 tracking-wide truncate mt-0">
                    {stats.姓名}
                </h2>
                <div className="text-[10px] md:text-xs font-mono text-slate-500 truncate">
                    称号: {stats.称号 || 'UNKNOWN'}
                </div>
             </div>
         </div>

         {/* Level Badge - Vertical on Right */}
         <div className="absolute top-0 right-0 h-full w-8 flex flex-col items-center justify-center bg-slate-900/50 border-l border-white/5 hover:bg-slate-900/80 transition-colors">
             <div className="text-[9px] font-mono text-slate-500 mb-2 flex flex-col items-center gap-0 leading-tight">
                 <span>等</span>
                 <span>级</span>
             </div>
             <div className="text-xl md:text-2xl font-display text-slate-300 group-hover:text-white transition-colors">{stats.等级}</div>
         </div>
      </div>

      {/* --- Tab Navigation (Triggers) --- */}
      <div className="flex items-center justify-around border-b border-white/5 bg-black/20 p-1 shrink-0">
          {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                  <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={clsx(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex-1 justify-center",
                          isActive 
                              ? "bg-white/10 text-cyan-400 shadow-inner"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                      )}
                  >
                      {tab.icon}
                      <span>{tab.label}</span>
                  </button>
              );
          })}
      </div>

      {/* --- Scrollable Content --- */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-black/10">
          <div className="p-3 space-y-4">
              <CharacterStatsContent stats={stats} isHellMode={isHellMode} />
              
              {/* Extra: Basic Info */}
              <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                  <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>种族</span>
                      <span className="text-zinc-300">{stats.种族}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>公会评级</span>
                      <span className="text-yellow-500 font-bold">{stats.公会评级}</span>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

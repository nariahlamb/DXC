
import React from 'react';
import { User, Library, ChevronRight, LayoutGrid } from 'lucide-react';
import { Icons } from '../../utils/iconMapper';
import { NavigationKey } from '../../utils/ui/navigationPriority';

interface RightPanelProps {
    viewMode?: 'ADVENTURE' | 'INVENTORY' | 'CHARACTER' | 'WORLD';
    activeModal?: string | null;
    onOpenSettings: () => void;
    onOpenInventory: () => void;
    onOpenTasks: () => void;
    onOpenMap: () => void;
    onOpenCharacter?: () => void;
    onOpenPhone?: (tab?: 'COMM' | 'CHAT' | 'CONTACTS' | 'MOMENTS' | 'FORUM') => void;
    onOpenArchive?: () => void;

    onOpenSaveManager: () => void;
    onOpenNotes: () => void;
    isHellMode?: boolean;
    hasPhone?: boolean;
    phoneProcessing?: boolean;
    summary?: {
        activeTasks: number;
        unreadMessages: number;
        unreadNews?: number;
        partySize: number;
        presentCount: number;
        inventoryWeight?: number;
        maxCarry?: number;
        lootCount?: number;
    };
    navigationPriority?: readonly NavigationKey[];
}

export const RightPanel: React.FC<RightPanelProps> = ({
    viewMode = 'ADVENTURE',
    activeModal,
    onOpenSettings,
    onOpenInventory,
    onOpenTasks,
    onOpenMap,
    onOpenCharacter,
    onOpenPhone,
    onOpenArchive,
    onOpenSaveManager,
    onOpenNotes,
    isHellMode,
    hasPhone,
    phoneProcessing,
    summary,
    navigationPriority = ['PHONE', 'TASKS', 'MAP', 'INVENTORY', 'SETTINGS']
}) => {
  const accentColor = isHellMode ? 'text-red-400' : 'text-amber-400';
  const activeBorder = isHellMode ? 'border-red-500' : 'border-amber-400';
  const [isExpanded, setIsExpanded] = React.useState(true); // Default to Expanded (Text visible)

  interface NavItemProps {
      label: string;
      icon: React.ReactNode;
      active: boolean;
      onClick: () => void;
      badge?: number;
      disabled?: boolean;
      processing?: boolean;
      dataTab?: string;
  }

  const NavItem = ({ label, icon, active, onClick, badge, disabled, processing, dataTab }: NavItemProps) => (
      <button
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          data-initial-tab={dataTab}
          title={!isExpanded ? label : undefined}
          className={`w-full flex items-center ${isExpanded ? 'gap-3 px-5' : 'justify-center px-2'} py-3 transition-all group relative overflow-hidden mx-0 mb-1 rounded-sm
              ${active
                  ? `${activeBorder} text-slate-100 bg-slate-800 border-l-2 custom-clip-r`
                  : 'border-transparent text-slate-600 hover:text-cyan-300 hover:bg-slate-900/50'
              }
              ${disabled ? 'opacity-30 cursor-not-allowed grayscale' : ''}
          `}
          style={active && isExpanded ? { clipPath: 'polygon(0 0, 100% 0, 100% 85%, 95% 100%, 0 100%)' } : {}}
      >
          {active && (
               <div className={`absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.6)]`} />
          )}
          
          <div className="relative flex items-center justify-center shrink-0 w-8 h-8">
               <span className="opacity-80 group-hover:opacity-100 transition-opacity z-10 relative">{icon}</span>
               {processing && (
                   <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
               )}
               {badge > 0 && (
                   <span className="absolute -top-1 -right-1 z-20 flex h-3 w-3 items-center justify-center rounded-full bg-red-600 ring-2 ring-[#0a0c10]">
                       <span className="text-[8px] font-bold text-white">{badge > 9 ? '!' : badge}</span>
                       <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                   </span>
               )}
          </div>
          {isExpanded && <span className={`ml-3 text-xs tracking-widest font-display font-semibold transition-colors uppercase ${active ? 'text-slate-100' : 'text-slate-600 group-hover:text-cyan-200'}`}>{label}</span>}
          
          {active && <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/20 to-transparent z-0" />}
      </button>
  );

  const coreItemMap: Record<NavigationKey, React.ReactNode | null> = {
      PHONE: (
          <NavItem
              label="智能终端"
              icon={<Icons.SysPhone size={18}/>}
              active={activeModal === 'PHONE'}
              onClick={() => onOpenPhone && onOpenPhone('COMM')}
              badge={summary?.unreadMessages}
              disabled={!hasPhone}
              processing={phoneProcessing}
              dataTab="COMM"
          />
      ),
      TASKS: (
          <NavItem
              label="委托任务"
              icon={<Icons.Quest size={18}/>}
              active={activeModal === 'TASKS'}
              onClick={onOpenTasks}
              badge={summary?.activeTasks}
          />
      ),
      MAP: (
          <NavItem
              label="地图中心"
              icon={<Icons.LocUnknown size={18}/>}
              active={activeModal === 'MAP' || activeModal === 'WORLD' || viewMode === 'WORLD'}
              onClick={onOpenMap}
              badge={summary?.unreadNews}
          />
      ),
      INVENTORY: (
          <NavItem
              label="背包"
              icon={<Icons.Backpack size={18}/>}
              active={viewMode === 'INVENTORY'}
              onClick={onOpenInventory}
          />
      ),
      SETTINGS: null
  };
  const coreNavOrder = navigationPriority.filter((key): key is NavigationKey =>
      ['PHONE', 'TASKS', 'MAP', 'INVENTORY', 'SETTINGS'].includes(key)
  );

  return (
    <div className={`h-full relative z-20 m-0 border-l border-white/5 flex flex-col overflow-hidden transition-all duration-300 ease-in-out bg-[#0a0c10]/90 backdrop-blur-sm ${isExpanded ? 'w-full lg:w-64' : 'w-16 lg:w-20'}`}
         style={{
         }}
    >

        {/* Header Summary Widget */}
        <div className={`bg-[#0e1217] relative overflow-hidden transition-all ${isExpanded ? 'p-5' : 'p-2 py-4'}`}>
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
            }} />
            <div className={`flex items-center mb-4 relative z-10 px-1 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
                {isExpanded && <span className="text-[11px] text-slate-400 font-mono font-bold tracking-widest">SYSTEM.MENU</span>}
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`text-slate-500 hover:text-cyan-400 transition-colors p-1 rounded-sm hover:bg-white/5 ${isExpanded ? 'ml-auto' : ''}`}
                >
                    {isExpanded ? <ChevronRight size={14}/> : <LayoutGrid size={16}/>}
                </button>
            </div>

            {isExpanded ? (
                <div className="grid grid-cols-2 gap-3 relative z-10">
                    <div className="bg-slate-800/20 p-3 relative group overflow-hidden border-l-2 border-slate-600 hover:border-emerald-500 transition-colors">
                        <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-[9px] text-slate-500 mb-1 font-mono uppercase tracking-wider flex justify-between">
                            SOCIAL <span>社交</span>
                        </div>
                        <div className="text-slate-200 font-mono text-xl font-bold">{summary?.partySize || 1}<span className="text-slate-500 text-sm ml-1">/4</span></div>
                    </div>
                    <div className="bg-slate-800/20 p-3 relative group overflow-hidden border-l-2 border-slate-600 hover:border-amber-500 transition-colors">
                        <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                         <div className="text-[9px] text-slate-500 mb-1 font-mono uppercase tracking-wider flex justify-between">
                            TASK <span>任务</span>
                        </div>
                        <div className={`${accentColor} font-mono text-xl font-bold`}>{summary?.activeTasks || 0}</div>
                    </div>
                </div>
            ) : (
                // Compact Status
                <div className="flex flex-col gap-2 items-center">
                    <div className="text-[9px] font-mono text-zinc-400 flex items-center gap-1" title="社交">
                         <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> {summary?.partySize || 1}
                    </div>
                    <div className="text-[9px] font-mono text-zinc-400 flex items-center gap-1" title="任务">
                         <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> {summary?.activeTasks || 0}
                    </div>
                </div>
            )}

            {isExpanded && (
                <div className="mt-3 bg-slate-800/20 p-3 border-l-2 border-slate-600 relative z-10 group hover:border-blue-500 transition-colors">
                     <div className="flex justify-between items-end mb-2">
                        <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">LOAD <span className="ml-1">负重</span></span>
                        <span className="text-[10px] text-slate-300 font-mono"><span className="text-slate-100 font-bold">{summary?.inventoryWeight}</span> / {summary?.maxCarry} <span className="text-slate-600">kg</span></span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900 relative overflow-hidden">
                        {/* Background Grid Pattern for Bar */}
                        <div className="absolute inset-0 w-full h-full opacity-20" style={{backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #000 2px, #000 4px)'}} />
                        
                        <div
                            className={`h-full transition-all duration-500 relative ${summary && (summary.inventoryWeight || 0) > (summary.maxCarry || 1) ? 'bg-red-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, ((summary?.inventoryWeight||0)/(summary?.maxCarry||1))*100)}%` }}
                        >
                             <div className="absolute inset-0 w-full h-full bg-white/20 animate-pulse" />
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-2 pb-28 overflow-hidden" data-priority-order={coreNavOrder.join('>')}>
            <div className="space-y-0.5">
                {coreNavOrder.map((key) => {
                    const item = coreItemMap[key];
                    if (!item) return null;
                    return <React.Fragment key={key}>{item}</React.Fragment>;
                })}
                {/* Character Panel Entry Hidden - Redundant with Left Panel
                <NavItem
                    label="角色面板"
                    icon={<User size={18}/>}
                    active={activeModal === 'CHARACTER_PANEL' || viewMode === 'CHARACTER'}
                    onClick={() => onOpenCharacter && onOpenCharacter()}
                />
                */}
                <NavItem
                    label="百科档案"
                    icon={<Icons.Book size={18}/>}
                    active={activeModal === 'ARCHIVE_PANEL'}
                    onClick={() => onOpenArchive && onOpenArchive()}
                />
                <NavItem
                    label="笔记"
                    icon={<Icons.SysNote size={18}/>}
                    active={activeModal === 'NOTES'}
                    onClick={onOpenNotes}
                />
            </div>
        </div>

        {/* Fixed Bottom-Right System Buttons */}
        <div className={`absolute bottom-0 right-0 left-0 border-t border-white/5 bg-[#0e1217]/95 backdrop-blur-sm ${isExpanded ? 'p-3' : 'p-2'}`}>
            <div className={`grid ${isExpanded ? 'grid-cols-2 gap-2' : 'grid-cols-1 gap-1'}`}>
                <button
                    onClick={onOpenSaveManager}
                    className={`flex items-center justify-center gap-2 rounded-md border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/15 transition-colors ${isExpanded ? 'py-2 px-2 text-xs font-bold' : 'py-2'}`}
                    title="存档"
                >
                    <Icons.SysSave size={16} />
                    {isExpanded && <span>存档</span>}
                </button>
                <button
                    onClick={onOpenSettings}
                    className={`flex items-center justify-center gap-2 rounded-md border border-slate-500/30 bg-slate-700/30 text-slate-200 hover:bg-slate-700/50 transition-colors ${isExpanded ? 'py-2 px-2 text-xs font-bold' : 'py-2'}`}
                    title="系统设置"
                >
                    <Library size={16} />
                    {isExpanded && <span>设置</span>}
                </button>
            </div>
        </div>
    </div>
  );
};

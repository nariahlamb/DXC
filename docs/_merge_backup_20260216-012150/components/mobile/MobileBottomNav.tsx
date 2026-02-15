
import React from 'react';
import { Icons } from '../../utils/iconMapper';
import { NavigationKey } from '../../utils/ui/navigationPriority';

export type MobileTab = 'CHAT' | 'MAP' | 'BACKPACK' | 'CHAR' | 'MORE';

interface MobileBottomNavProps {
    onTabSelect: (tab: MobileTab) => void;
    activeTab: MobileTab;
    isHellMode?: boolean;
    unreadMessages?: number;
    activeTasks?: number;
    navigationPriority?: readonly NavigationKey[];
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
    onTabSelect,
    activeTab,
    isHellMode,
    unreadMessages = 0,
    activeTasks = 0,
    navigationPriority = ['PHONE', 'TASKS', 'MAP', 'INVENTORY', 'SETTINGS'],
}) => {
    const accentColor = isHellMode ? 'text-red-300' : 'text-guild-gold';
    const accentBg = isHellMode ? 'bg-red-500/15' : 'bg-guild-gold/15';

    const NavItem = ({
        id,
        icon: Icon,
        label,
        badge,
    }: {
        id: MobileTab;
        icon: React.FC<{ size?: number; strokeWidth?: number }>;
        label: string;
        badge?: number;
    }) => {
        const isActive = activeTab === id;
        return (
            <button
                onClick={() => onTabSelect(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-all duration-200 relative
                    active:scale-95 touch-manipulation [-webkit-tap-highlight-color:transparent] select-none cursor-pointer`}
                title={label}
            >
                {/* Pill Indicator */}
                <div className={`absolute top-1.5 w-14 h-8 rounded-full transition-all duration-300 ease-out
                    ${isActive ? `${accentBg} scale-100 opacity-100` : 'bg-transparent scale-50 opacity-0'}`}
                />

                {/* Icon Container */}
                <div className="relative z-10 flex items-center justify-center w-8 h-8">
                    <div className={`transition-all duration-200 ${isActive ? `${accentColor} -translate-y-0.5` : 'text-slate-500'}`}>
                        <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    {!!badge && badge > 0 && (
                        <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-[#0a0c10]">
                            {badge > 9 ? '9+' : badge}
                        </span>
                    )}
                </div>

                {/* Label */}
                <span className={`text-[10px] font-bold tracking-wide transition-all duration-200 relative z-10
                    ${isActive ? `${accentColor} opacity-100` : 'text-slate-600 opacity-80'}`}
                >
                    {label}
                </span>
            </button>
        );
    };

    const coreOrder = navigationPriority.filter((key): key is NavigationKey =>
        ['PHONE', 'TASKS', 'MAP', 'INVENTORY', 'SETTINGS'].includes(key)
    );
    const coreMap: Record<NavigationKey, React.ReactNode> = {
        PHONE: <NavItem id="CHAT" icon={Icons.Chat} label="对话" badge={unreadMessages} />,
        MAP: <NavItem id="MAP" icon={Icons.LocUnknown} label="地图" />,
        INVENTORY: null,
        TASKS: <NavItem id="MORE" icon={Icons.Grid} label="更多" badge={activeTasks} />,
        SETTINGS: <NavItem id="MORE" icon={Icons.Grid} label="更多" badge={activeTasks} />,
    };

    return (
        <div className="h-[calc(3.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-[#0a0c10]/95 backdrop-blur-xl border-t border-white/5 flex items-stretch shrink-0 z-50 px-safe-0 shadow-[0_-4px_16px_rgba(0,0,0,0.5)]">
            {/* Use unified priority schema to decide which two core entries appear left/right. */}
            {(coreMap[coreOrder[0] || 'PHONE'] as any) || <NavItem id="CHAT" icon={Icons.Chat} label="对话" badge={unreadMessages} />}
            {(coreMap[coreOrder[2] || 'MAP'] as any) || <NavItem id="MAP" icon={Icons.LocUnknown} label="地图" />}
            <NavItem id="BACKPACK" icon={Icons.Backpack} label="背包" />

            <NavItem id="CHAR" icon={Icons.User} label="角色" />
            <NavItem id="MORE" icon={Icons.Grid} label="更多" badge={activeTasks} />
        </div>
    );
};

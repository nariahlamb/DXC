
import React, { useRef, useCallback, useState } from 'react';
import { Icons } from '../../utils/iconMapper';
import { ChevronRight } from 'lucide-react';
import { NavigationKey } from '../../utils/ui/navigationPriority';

interface MobileMenuOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    hasPhone?: boolean;
    summary?: {
        activeTasks?: number;
        unreadMessages?: number;
        unreadNews?: number;
        partySize?: number;
        lootCount?: number;
    };
    navigationPriority?: readonly NavigationKey[];
    actions: {
        onOpenSettings: () => void;
        onOpenCharacterPanel: (tab?: 'STATUS' | 'EQUIP' | 'SKILLS') => void;
        onOpenTasks: () => void;
        onOpenPhone: (tab?: 'COMM' | 'CHAT' | 'CONTACTS' | 'MOMENTS' | 'FORUM') => void;
        onOpenArchivePanel: (tab?: 'WORLD' | 'STORY' | 'MEMORY') => void;
        onOpenMap: () => void;
        onOpenSaveManager: () => void;

    };
}

// Swipe configuration
const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

export const MobileMenuOverlay: React.FC<MobileMenuOverlayProps> = ({
    isOpen,
    onClose,
    actions,
    hasPhone = true,
    summary,
    navigationPriority = ['PHONE', 'TASKS', 'MAP', 'INVENTORY', 'SETTINGS']
}) => {
    if (!isOpen) return null;

    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartY = useRef(0);
    const touchStartTime = useRef(0);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        touchStartTime.current = Date.now();
        setIsDragging(true);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging) return;
        const deltaY = e.touches[0].clientY - touchStartY.current;
        if (deltaY > 0) {
            setSwipeOffset(Math.min(deltaY, window.innerHeight * 0.5));
        }
    }, [isDragging]);

    const handleTouchEnd = useCallback(() => {
        if (!isDragging) return;
        setIsDragging(false);
        const velocity = swipeOffset / (Date.now() - touchStartTime.current);
        if (swipeOffset > SWIPE_THRESHOLD || velocity > SWIPE_VELOCITY_THRESHOLD) {
            setSwipeOffset(window.innerHeight);
            setTimeout(onClose, 200);
        } else {
            setSwipeOffset(0);
        }
    }, [isDragging, swipeOffset, onClose]);

    /* ---------- Helpers ---------- */
    const fireAndClose = (fn: (() => void) | undefined) => {
        fn?.();
        onClose();
    };

    /* ---------- Grid Item ---------- */
    const GridItem = ({ icon: Icon, label, color, onClick, disabled, badge }: {
        icon: React.FC<{ size?: number; className?: string }>;
        label: string;
        color: string;
        onClick: () => void;
        disabled?: boolean;
        badge?: number;
    }) => (
        <button
            onClick={() => !disabled && fireAndClose(onClick)}
            disabled={disabled}
            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07]
                active:scale-95 transition-all border border-white/5 touch-manipulation [-webkit-tap-highlight-color:transparent]
                ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
            <div className={`relative p-2.5 rounded-xl bg-black/40 ${color} shadow-inner`}>
                <Icon size={22} />
                {!!badge && badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-[#0a0c10]">
                        {badge > 9 ? '9+' : badge}
                    </span>
                )}
            </div>
            <span className="text-[11px] font-medium text-slate-300 leading-tight">{label}</span>
        </button>
    );

    /* ---------- List Item ---------- */
    const ListItem = ({ icon: Icon, label, subLabel, onClick, badge }: {
        icon: React.FC<{ size?: number; className?: string }>;
        label: string;
        subLabel?: string;
        onClick: () => void;
        badge?: number;
    }) => (
        <button
            onClick={() => fireAndClose(onClick)}
            className="flex items-center w-full px-4 py-3.5 gap-4 hover:bg-white/5 active:bg-black/20 transition-colors
                border-b border-white/[0.04] last:border-0 touch-manipulation [-webkit-tap-highlight-color:transparent]"
        >
            <div className="p-2 rounded-lg bg-white/5 text-slate-400 shrink-0">
                <Icon size={18} />
            </div>
            <div className="flex-1 text-left min-w-0">
                <div className="text-sm font-medium text-slate-200 truncate">{label}</div>
                {subLabel && <div className="text-[10px] text-slate-500 truncate">{subLabel}</div>}
            </div>
            {!!badge && badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-[#0e1217]">
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
            <ChevronRight size={14} className="text-slate-700 shrink-0" />
        </button>
    );

    return (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Control Center Sheet */}
            <div
                ref={menuRef}
                onClick={e => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    transform: `translateY(${swipeOffset}px)`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    touchAction: 'pan-y',
                }}
                className="relative bg-[#0a0c10] w-full max-h-[78vh] rounded-t-[28px] border-t border-white/10 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-24 duration-300 ease-out"
            >
                {/* Drag Handle */}
                <div className="w-full flex justify-center pt-3 pb-1 pointer-events-none shrink-0">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-2 pb-20">

                    {/* ===== Status Chips ===== */}
                    <div className="mb-4 bg-[#0e1217] rounded-2xl border border-white/5 px-3 py-2.5">
                        <div className="mb-2 text-[10px] text-slate-500 uppercase tracking-widest" data-priority-order={navigationPriority.join('>')}>
                            优先级：{navigationPriority.join(' > ')}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-slate-300 flex items-center justify-between">
                                <span className="text-slate-500">任务</span>
                                <span className="font-bold text-emerald-300">{summary?.activeTasks || 0}</span>
                            </div>
                            <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-slate-300 flex items-center justify-between">
                                <span className="text-slate-500">消息</span>
                                <span className="font-bold text-cyan-300">{summary?.unreadMessages || 0}</span>
                            </div>
                            <div className="rounded-lg bg-white/[0.03] px-2 py-1.5 text-slate-300 flex items-center justify-between">
                                <span className="text-slate-500">战利品</span>
                                <span className="font-bold text-amber-300">{summary?.lootCount || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* ===== Quick Actions Grid ===== */}
                    <div className="mb-5">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">常用功能</h3>
                        <div className="grid grid-cols-3 gap-2.5">
                            {/* <GridItem icon={Icons.User}      label="角色面板" color="text-blue-400"    onClick={() => actions.onOpenCharacterPanel('STATUS')} /> */}
                            <GridItem icon={Icons.Quest}     label="任务"   color="text-emerald-400" onClick={actions.onOpenTasks} badge={summary?.activeTasks} />
                            <GridItem icon={Icons.SysPhone}  label="终端"   color="text-pink-400"    onClick={() => actions.onOpenPhone('COMM')} disabled={!hasPhone} badge={summary?.unreadMessages} />
                            <GridItem icon={Icons.Map}       label="地图"   color="text-indigo-400"  onClick={actions.onOpenMap} badge={summary?.unreadNews} />
                            <GridItem icon={Icons.Book}      label="档案"   color="text-yellow-400"  onClick={() => actions.onOpenArchivePanel('WORLD')} />
                            <GridItem icon={Icons.SysSave}   label="存档"   color="text-cyan-400"    onClick={actions.onOpenSaveManager} />
                            <GridItem icon={Icons.Settings}  label="设置"   color="text-slate-400"   onClick={actions.onOpenSettings} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

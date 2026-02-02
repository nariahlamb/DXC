
import React from 'react';
import { Briefcase, Users, ClipboardList, Zap, Settings, Smartphone, Globe, Shield, BookOpen, Scroll, Flag, Gem, Brain, Radar, Swords, Archive, HardDrive, Loader2, StickyNote, Scale, Bell, Database } from 'lucide-react';
import { MenuButton } from './right/MenuButton';

interface RightPanelProps {
    onOpenSettings: () => void;
    onOpenInventory: () => void;
    onOpenEquipment: () => void;
    onOpenSocial: () => void;
    onOpenTasks: () => void;
    onOpenSkills: () => void;
    onOpenPhone: () => void;
    onOpenWorld: () => void;
    onOpenFamilia: () => void;
    onOpenStory: () => void;
    onOpenContract: () => void;
    onOpenLoot: () => void;
    onOpenLootVault: () => void;
    onOpenSaveManager: () => void;
    onOpenMemory: () => void;
    onOpenNotes: () => void;
    onOpenLibrary: () => void;
    onOpenParty?: () => void;
    isHellMode?: boolean;
    hasPhone?: boolean;
    phoneProcessing?: boolean;
    phoneProcessingScope?: 'chat' | 'moment' | 'forum' | 'sync' | 'auto' | 'manual' | null;
    summary?: {
        activeTasks: number;
        unreadMessages: number;
        partySize: number;
        presentCount: number;
        inventoryWeight?: number;
        maxCarry?: number;
        lootCount?: number;
    };
}

export const RightPanel: React.FC<RightPanelProps> = ({ 
    onOpenSettings, 
    onOpenInventory,
    onOpenEquipment,
    onOpenSocial,
    onOpenTasks,
    onOpenSkills,
    onOpenPhone,
    onOpenWorld,
    onOpenFamilia,
    onOpenStory,
    onOpenContract,
    onOpenLoot,
    onOpenLootVault,
    onOpenSaveManager,
    onOpenMemory,
    onOpenNotes,
    onOpenLibrary,
    onOpenParty,
    isHellMode,
    hasPhone = true,
    phoneProcessing = false,
    phoneProcessingScope = null,
    summary
}) => {
  // Theme Overrides
  const bgTexture = isHellMode ? 'bg-red-900/10' : 'bg-halftone-blue opacity-10';
  const primaryHover = isHellMode ? 'group-hover:bg-red-600' : 'group-hover:bg-blue-600';
  const secondaryHover = isHellMode ? 'group-hover:bg-orange-600' : 'group-hover:bg-orange-600'; // Keep orange or change
  const settingsBorder = isHellMode ? 'group-hover:border-red-600' : 'group-hover:border-blue-600';
  const phoneIndicator = phoneProcessing ? (
        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${(phoneProcessingScope === 'sync' || phoneProcessingScope === 'auto' || phoneProcessingScope === 'manual') ? 'bg-blue-500' : 'bg-orange-500'} shadow-lg animate-pulse`}>
            <Loader2 size={12} className="text-white animate-spin" />
        </div>
    ) : null;

  return (
    <div className="w-full lg:w-[20%] h-full bg-zinc-900/90 backdrop-blur-sm flex flex-col p-3 gap-2 overflow-hidden relative border-l-4 border-black">
        {/* Background Decor */}
        <div className={`absolute top-0 right-0 w-full h-full ${bgTexture} pointer-events-none`} />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent pointer-events-none" />

        {summary && (
            <div className="relative z-10 bg-black/80 border border-zinc-700 p-3 mt-2 shadow-lg">
                <div className="text-[10px] uppercase tracking-widest text-zinc-400 mb-2">战术摘要</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-zinc-300">
                        <ClipboardList size={12} className="text-amber-400" />
                        <span>任务</span>
                        <span className="ml-auto text-white">{summary.activeTasks}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                        <Bell size={12} className="text-cyan-400" />
                        <span>未读</span>
                        <span className="ml-auto text-white">{summary.unreadMessages}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                        <Users size={12} className="text-indigo-400" />
                        <span>队伍</span>
                        <span className="ml-auto text-white">{summary.partySize}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                        <Radar size={12} className="text-emerald-400" />
                        <span>在场</span>
                        <span className="ml-auto text-white">{summary.presentCount}</span>
                    </div>
                    {typeof summary.inventoryWeight === 'number' && (
                        <div className="flex items-center gap-2 text-zinc-300 col-span-2">
                            <Scale size={12} className="text-orange-400" />
                            <span>负重</span>
                            <span className={`ml-auto ${summary.maxCarry !== undefined && summary.inventoryWeight > summary.maxCarry ? 'text-red-400' : 'text-white'}`}>
                                {summary.inventoryWeight} / {summary.maxCarry ?? '--'} kg
                            </span>
                        </div>
                    )}
                    {typeof summary.lootCount === 'number' && (
                        <div className="flex items-center gap-2 text-zinc-300 col-span-2">
                            <Gem size={12} className="text-yellow-400" />
                            <span>战利品</span>
                            <span className="ml-auto text-white">{summary.lootCount}</span>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Scrollable Area for Buttons */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-4 pb-4 space-y-2">
            <MenuButton 
                label="背包" 
                icon={<Briefcase className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={50} 
                colorClass="bg-zinc-800"
                hoverColorClass={`${primaryHover} group-hover:border-white`}
                onClick={onOpenInventory}
            />
            <MenuButton 
                label="战利品仓库"
                icon={<Archive className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={70} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-amber-500 group-hover:border-white"
                onClick={onOpenLootVault}
            />
            <MenuButton 
                label="公共战利品"
                icon={<Gem className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={75} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-yellow-500 group-hover:border-white"
                onClick={onOpenLoot}
            />
            <MenuButton 
                label="装备" 
                icon={<Shield className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={100} 
                colorClass="bg-zinc-800"
                hoverColorClass={`${secondaryHover} group-hover:border-white`}
                onClick={onOpenEquipment}
            />
            <MenuButton 
                label="技能/魔法"
                icon={<Zap className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={150} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-yellow-500 group-hover:border-white"
                onClick={onOpenSkills}
            />
            <MenuButton 
                label="队伍" 
                icon={<Swords className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={160} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-indigo-600 group-hover:border-white"
                onClick={onOpenParty || (() => {})}
            />
            <div className="border-t border-zinc-700 my-2" />
            <MenuButton 
                label="资料库"
                icon={<Database className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={210} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-emerald-600 group-hover:border-white"
                onClick={onOpenLibrary}
            />
            <MenuButton 
                label="记忆" 
                icon={<Brain className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={225} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-emerald-600 group-hover:border-white"
                onClick={onOpenMemory}
            />
            <MenuButton
                label="笔记"
                icon={<StickyNote className="w-5 h-5 lg:w-5 lg:h-5" />}
                delay={235}
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-cyan-600 group-hover:border-white"
                onClick={onOpenNotes}
            />
            <MenuButton 
                label="手机" 
                icon={<Smartphone className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={250} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-orange-500 group-hover:border-white"
                onClick={onOpenPhone}
                disabled={!hasPhone}
                indicator={phoneIndicator}
            />
            <MenuButton 
                label="世界" 
                icon={<Globe className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={300} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-cyan-600 group-hover:border-white"
                onClick={onOpenWorld}
            />
            <div className="border-t border-zinc-700 my-2" />
            <MenuButton 
                label="社交" 
                icon={<Users className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={350} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-pink-500 group-hover:border-white"
                onClick={onOpenSocial}
            />
             <MenuButton 
                label="眷族" 
                icon={<Flag className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={400} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-blue-800 group-hover:border-white"
                onClick={onOpenFamilia}
            />
            <MenuButton 
                label="任务" 
                icon={<ClipboardList className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={450} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-amber-500 group-hover:border-white"
                onClick={onOpenTasks}
            />
            <MenuButton 
                label="存档" 
                icon={<HardDrive className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={470} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-slate-600 group-hover:border-white"
                onClick={onOpenSaveManager}
            />
             <div className="border-t border-zinc-700 my-2" />
             <MenuButton 
                label="剧情" 
                icon={<BookOpen className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={500} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-green-600 group-hover:border-white"
                onClick={onOpenStory}
            />
             <MenuButton 
                label="契约" 
                icon={<Scroll className="w-5 h-5 lg:w-5 lg:h-5" />} 
                delay={550} 
                colorClass="bg-zinc-800"
                hoverColorClass="group-hover:bg-amber-700 group-hover:border-white"
                onClick={onOpenContract}
            />
        </div>
        
        <div className="mt-auto shrink-0 pt-2 border-t border-zinc-700">
            <MenuButton 
                label="系统" 
                icon={<Settings className="w-5 h-5 lg:w-5 lg:h-5 animate-spin-slow" />} 
                delay={600} 
                colorClass="bg-black"
                hoverColorClass={`group-hover:bg-white ${settingsBorder}`}
                onClick={onOpenSettings}
            />
        </div>
    </div>
  );
};

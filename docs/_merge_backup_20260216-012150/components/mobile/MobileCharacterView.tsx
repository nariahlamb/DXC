
import React, { useState } from 'react';
import { User, Shield, Zap } from 'lucide-react';
import { CharacterStats, InventoryItem, Skill, MagicSpell, Difficulty } from '../../types';
import { AttributePanel } from '../game/modals/AttributePanel';
import { EquipmentContent } from '../game/character/EquipmentContent';
import { SkillsContent } from '../game/character/SkillsContent';
import clsx from 'clsx';
import Icons from '../../utils/iconMapper';

interface MobileCharacterViewProps {
    stats: CharacterStats;
    equipment: any;
    inventory: InventoryItem[];
    skills: Skill[];
    magic: MagicSpell[];
    onUnequipItem: (slotKey: string, itemName?: string, itemId?: string) => void;
    isHellMode?: boolean;
    difficulty?: Difficulty;
}

type Tab = 'STATUS' | 'EQUIP' | 'SKILLS';

export const MobileCharacterView: React.FC<MobileCharacterViewProps> = ({
    stats,
    equipment,
    inventory,
    skills,
    magic,
    onUnequipItem,
    isHellMode,
    difficulty
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('STATUS');

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'STATUS', label: '属性', icon: <User size={16} /> },
        { id: 'EQUIP', label: '装备', icon: <Icons.Shield size={16} /> },
        { id: 'SKILLS', label: '能力', icon: <Zap size={16} /> },
    ];

    return (
        <div className="flex flex-col h-full w-full bg-zinc-950 text-zinc-200">
            {/* Top Sub-navigation */}
            <div className="flex items-center justify-around border-b border-white/10 bg-zinc-900/80 backdrop-blur-md px-2 py-2">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                                isActive 
                                    ? "bg-cyan-900/40 text-cyan-400 ring-1 ring-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
                {activeTab === 'STATUS' && (
                    <div className="h-full overflow-y-auto custom-scrollbar">
                         <AttributePanel stats={stats} isHellMode={isHellMode} difficulty={difficulty} />
                    </div>
                )}
                {activeTab === 'EQUIP' && (
                    <div className="h-full overflow-hidden">
                        <EquipmentContent 
                            equipment={equipment} 
                            inventory={inventory} 
                            onUnequipItem={onUnequipItem} 
                        />
                    </div>
                )}
                {activeTab === 'SKILLS' && (
                    <div className="h-full overflow-hidden">
                        <SkillsContent skills={skills} magic={magic} />
                    </div>
                )}
            </div>
        </div>
    );
};

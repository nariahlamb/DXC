
import React, { useState } from 'react';
import { User } from 'lucide-react';
import { Skill, MagicSpell, InventoryItem, CharacterStats, Difficulty } from '../../../types';
import { ModalWrapper } from '../../ui/ModalWrapper';
import { AttributePanel } from './AttributePanel';
import { EquipmentContent } from '../character/EquipmentContent';
import { SkillsContent } from '../character/SkillsContent';
import Icons from '../../../utils/iconMapper';
import clsx from 'clsx';


type CharacterTab = 'STATUS' | 'EQUIP' | 'SKILLS';

interface CharacterPanelModalProps {
    isOpen: boolean;
    onClose: () => void;
    stats: CharacterStats;
    equipment: any;
    inventory: InventoryItem[];
    skills: Skill[];
    magic: MagicSpell[];
    onUnequipItem: (slotKey: string, itemName?: string, itemId?: string) => void;
    isHellMode?: boolean;
    difficulty?: Difficulty;
    initialTab?: CharacterTab;
}

const TAB_CONFIG: { id: CharacterTab; label: string; icon: React.ReactNode }[] = [
    { id: 'STATUS', label: '属性', icon: <User size={16} /> },
    { id: 'EQUIP',  label: '装备', icon: <Icons.Shield size={16} /> },
    { id: 'SKILLS', label: '技能', icon: <Icons.Skill size={16} /> },
];

export const CharacterPanelModal: React.FC<CharacterPanelModalProps> = ({
    isOpen,
    onClose,
    stats,
    equipment,
    inventory,
    skills,
    magic,
    onUnequipItem,
    isHellMode,
    difficulty,
    initialTab = 'STATUS',
}) => {
    const [activeTab, setActiveTab] = useState<CharacterTab>(initialTab);

    React.useEffect(() => {
        if (isOpen) setActiveTab(initialTab);
    }, [isOpen, initialTab]);

    if (!isOpen) return null;

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title="角色面板"
            icon={<User className="w-5 h-5 text-cyan-400" />}
            theme="default"
            size="l"
            noBodyPadding
            className="!p-0"
        >
            <div className="flex flex-col h-full min-h-0">
                {/* Tab Bar */}
                <div className="flex shrink-0 bg-zinc-900/80 backdrop-blur-md border-b border-white/5">
                    {TAB_CONFIG.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={clsx(
                                'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-all relative',
                                activeTab === tab.id
                                    ? 'text-cyan-300'
                                    : 'text-zinc-600 hover:text-zinc-300'
                            )}
                        >
                            <span className="opacity-80">{tab.icon}</span>
                            <span>{tab.label}</span>
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-[20%] right-[20%] h-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.4)]" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    {activeTab === 'STATUS' && (
                        <div className="h-full overflow-hidden animate-in fade-in duration-200">
                            <AttributePanel
                                stats={stats}
                                isHellMode={isHellMode}
                                difficulty={difficulty}
                            />
                        </div>
                    )}
                    {activeTab === 'EQUIP' && (
                        <div className="h-full min-h-0 animate-in fade-in duration-200">
                            <EquipmentContent
                                equipment={equipment}
                                inventory={inventory}
                                onUnequipItem={onUnequipItem}
                            />
                        </div>
                    )}
                    {activeTab === 'SKILLS' && (
                        <div className="h-full min-h-0 animate-in fade-in duration-200">
                            <SkillsContent
                                skills={skills}
                                magic={magic}
                            />
                        </div>
                    )}
                </div>
            </div>
        </ModalWrapper>
    );
};

// --- Skills Content (extracted to separate file) ---

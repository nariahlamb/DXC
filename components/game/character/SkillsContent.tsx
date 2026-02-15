
import React, { useState } from 'react';
import { Zap, Scroll, Sparkles } from 'lucide-react';
import Icons from '../../../utils/iconMapper';
import { Skill, MagicSpell } from '../../../types';
import { formatSkillCost } from '../../../utils/skillFormat';
import clsx from 'clsx';

const ABILITY_ICONS: Record<string, React.FC<any>> = {
    MAGIC: Icons.Magic,
    SKILL: Icons.Skill,
    '主动': Icons.SkillActive,
    '被动': Icons.SkillPassive,
    '支援': Icons.SkillSupport,
    '治愈': Icons.SkillHeal,
    '攻击': Icons.SkillActive,
    '强化': Icons.SkillBuff
};

const getAbilityIcon = (ability: any, defaultType: string, size = 28) => {
    const type = ability?.类型 || ability?.type || defaultType;
    const IconComp = ABILITY_ICONS[type] || ABILITY_ICONS[defaultType];
    return IconComp ? <IconComp size={size} /> : <Sparkles size={size} />;
};

const normalizeTags = (tags?: string[] | string) => {
    if (!tags) return [];
    return Array.isArray(tags) ? tags : [tags];
};

type AbilityTab = 'skills' | 'magic';

export const SkillsContent: React.FC<{ skills: Skill[]; magic: MagicSpell[] }> = ({ skills, magic }) => {
    const [tab, setTab] = useState<AbilityTab>('skills');
    const [selectedAbility, setSelectedAbility] = useState<{ kind: 'skill' | 'magic'; data: Skill | MagicSpell } | null>(null);
    const safeSkills = Array.isArray(skills) ? skills : [];
    const safeMagic = Array.isArray(magic) ? magic : [];

    const activeKind: 'skill' | 'magic' = tab === 'skills' ? 'skill' : 'magic';
    const activeItems = tab === 'skills' ? safeSkills : safeMagic;

    React.useEffect(() => {
        if (activeItems.length === 0) {
            setSelectedAbility(null);
            return;
        }

        if (!selectedAbility || selectedAbility.kind !== activeKind) {
            setSelectedAbility({ kind: activeKind, data: activeItems[0] as Skill | MagicSpell });
            return;
        }

        const exists = activeItems.some((item) => item.名称 === selectedAbility.data.名称);
        if (!exists) {
            setSelectedAbility({ kind: activeKind, data: activeItems[0] as Skill | MagicSpell });
        }
    }, [activeItems, activeKind, selectedAbility]);

    return (
        <div className="p-2 sm:p-6 h-full min-h-0">
            {/* Sub-tabs */}
            <div className="flex shrink-0 gap-1 mb-2 bg-zinc-900/50 p-1 rounded-lg">
                <button
                    onClick={() => setTab('skills')}
                    className={clsx(
                        'flex-1 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1.5',
                        tab === 'skills' ? 'bg-cyan-900/30 text-cyan-300 shadow-inner' : 'text-zinc-600 hover:text-zinc-300'
                    )}
                >
                    <Zap size={14} /> 技能 <span className="text-zinc-600 font-mono">({safeSkills.length})</span>
                </button>
                <button
                    onClick={() => setTab('magic')}
                    className={clsx(
                        'flex-1 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1.5',
                        tab === 'magic' ? 'bg-purple-900/30 text-purple-300 shadow-inner' : 'text-zinc-600 hover:text-zinc-300'
                    )}
                >
                    <Scroll size={14} /> 魔法 <span className="text-zinc-600 font-mono">({safeMagic.length})</span>
                </button>
            </div>

            <div className="flex flex-row gap-2 sm:gap-4 h-full min-h-0">
                <div className="w-[80px] sm:w-[280px] xl:w-[44%] flex-none shrink-0 space-y-1.5 overflow-y-auto custom-scrollbar pr-0 sm:pr-1 pb-2">
                    {activeItems.length > 0 ? activeItems.map((ability, index) => {
                        const isSkill = activeKind === 'skill';
                        const tags = normalizeTags((ability as any).标签 as any);
                        const selected = selectedAbility?.kind === activeKind && selectedAbility?.data?.名称 === ability.名称;

                        return (
                            <button
                                type="button"
                                key={`${activeKind}-${index}`}
                                onClick={() => setSelectedAbility({ kind: activeKind, data: ability as Skill | MagicSpell })}
                                className={clsx(
                                    'w-full group p-1 sm:p-3 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-1 sm:gap-3',
                                    selected && (isSkill ? 'ring-1 ring-cyan-400/50 bg-zinc-800/80 shadow-[0_0_10px_rgba(34,211,238,0.15)]' : 'ring-1 ring-purple-400/50 bg-zinc-800/80 shadow-[0_0_10px_rgba(192,132,252,0.15)]'),
                                    !selected && 'bg-zinc-900/20 border-zinc-800/30 hover:bg-zinc-800/60'
                                )}
                            >
                                <div className={clsx(
                                    'w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                                    isSkill ? 'bg-cyan-900/20 text-cyan-400' : 'bg-purple-900/20 text-purple-400'
                                )}>
                                    {getAbilityIcon(ability, isSkill ? 'SKILL' : 'MAGIC', 20)}
                                </div>
                                
                                {/* Mobile Name Label */}
                                <div className={clsx(
                                    "sm:hidden text-[9px] font-bold truncate w-full px-1",
                                    selected ? (isSkill ? 'text-cyan-300' : 'text-purple-300') : 'text-zinc-500'
                                )}>
                                    {ability.名称}
                                </div>

                                {/* Desktop Details */}
                                <div className="hidden sm:block flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm text-zinc-100 truncate">{ability.名称}</span>
                                        {isSkill && (ability as Skill).等级 && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-cyan-900/30 text-cyan-400 rounded font-mono">
                                                Lv.{(ability as Skill).等级}
                                            </span>
                                        )}
                                        {!isSkill && (ability as MagicSpell).类别 && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-purple-900/30 text-purple-400 rounded font-mono">
                                                {(ability as MagicSpell).类别}
                                            </span>
                                        )}
                                    </div>
                                    {ability.描述 && <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{ability.描述}</p>}
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {tags.map((tag, i) => (
                                            <span key={i} className="text-[9px] px-1.5 py-0.5 bg-zinc-800/60 text-zinc-500 rounded">{tag}</span>
                                        ))}
                                        {ability.消耗 && (
                                            <span className={clsx(
                                                'text-[9px] px-1.5 py-0.5 rounded',
                                                isSkill ? 'bg-amber-900/20 text-amber-400' : 'bg-violet-900/20 text-violet-400'
                                            )}>
                                                {formatSkillCost(ability.消耗)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    }) : (
                        <EmptySlate text={activeKind === 'skill' ? '暂无习得技能' : '暂无习得魔法'} icon={activeKind === 'skill' ? <Zap size={32} /> : <Sparkles size={32} />} />
                    )}
                </div>

                <div className="flex-1 min-h-0 border border-white/10 rounded-xl bg-zinc-950/80 p-2 sm:p-4 space-y-2 overflow-y-auto custom-scrollbar relative">
                    {selectedAbility ? (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className={clsx('text-sm sm:text-base font-bold truncate', selectedAbility.kind === 'skill' ? 'text-cyan-300' : 'text-purple-300')}>
                                        {selectedAbility.data.名称}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                        {selectedAbility.kind === 'skill' ? '技能' : '魔法'}
                                        {selectedAbility.kind === 'skill' && (selectedAbility.data as Skill).类别 ? ` · ${(selectedAbility.data as Skill).类别}` : ''}
                                        {selectedAbility.kind === 'magic' && (selectedAbility.data as MagicSpell).类别 ? ` · ${(selectedAbility.data as MagicSpell).类别}` : ''}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedAbility(null)}
                                    className="sm:hidden text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 shrink-0"
                                >
                                    关闭
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {(selectedAbility.data as Skill).等级 && <div className="bg-black/40 border border-white/5 p-2 rounded flex justify-between"><span className="text-[10px] text-zinc-500">等级</span><span className="text-cyan-300 font-mono">{(selectedAbility.data as Skill).等级}</span></div>}
                                {(selectedAbility.data as MagicSpell).属性 && <div className="bg-black/40 border border-white/5 p-2 rounded flex justify-between"><span className="text-[10px] text-zinc-500">属性</span><span className="text-purple-300 font-mono">{(selectedAbility.data as MagicSpell).属性}</span></div>}
                                {selectedAbility.data.范围 && <div className="bg-black/40 border border-white/5 p-2 rounded flex justify-between"><span className="text-[10px] text-zinc-500">范围</span><span className="text-zinc-300 font-mono">{selectedAbility.data.范围}</span></div>}
                                {selectedAbility.data.冷却 && <div className="bg-black/40 border border-white/5 p-2 rounded flex justify-between"><span className="text-[10px] text-zinc-500">冷却</span><span className="text-zinc-300 font-mono">{selectedAbility.data.冷却}</span></div>}
                            </div>

                            {selectedAbility.data.消耗 && (
                                <div className="text-xs text-amber-300/90 border-l-2 border-amber-500/60 pl-3 bg-amber-900/10 py-1">
                                    消耗：{formatSkillCost(selectedAbility.data.消耗)}
                                </div>
                            )}
                            {selectedAbility.data.描述 && (
                                <div className="text-xs text-zinc-300 leading-relaxed border-l-2 border-cyan-500/60 pl-3 bg-cyan-900/10 py-1">
                                    {selectedAbility.data.描述}
                                </div>
                            )}
                            {selectedAbility.data.效果 && (
                                <div className="text-xs text-emerald-300/90 leading-relaxed border-l-2 border-emerald-500/60 pl-3 bg-emerald-900/10 py-1">
                                    {selectedAbility.data.效果}
                                </div>
                            )}
                            {(selectedAbility.data as MagicSpell).咏唱 && (
                                <div className="text-xs text-purple-300/90 leading-relaxed border-l-2 border-purple-500/60 pl-3 bg-purple-900/10 py-1">
                                    咏唱：{(selectedAbility.data as MagicSpell).咏唱}
                                </div>
                            )}
                        </>
                    ) : (
                        <EmptySlate text="选择左侧技能查看详情" icon={<Zap size={30} />} />
                    )}
                </div>
            </div>
        </div>
    );
};

const EmptySlate = ({ text, icon }: { text: string; icon: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center py-16 text-zinc-700">
        <span className="opacity-40 mb-3">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-widest">{text}</span>
    </div>
);

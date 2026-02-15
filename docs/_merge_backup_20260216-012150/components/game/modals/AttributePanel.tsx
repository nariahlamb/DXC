import React from 'react';
import { CharacterStats, StatusEffect, Difficulty } from '../../../types';
import { 
    User, Activity, Zap, Sword, Shield, Feather, Sparkles, 
    Heart, Battery, AlertTriangle, Coins, Star, 
    Droplets, Utensils, Skull, Trophy, Crown
} from 'lucide-react';
import { getRankLetter, getRankColor, getProgressToNextRank } from '../left/LeftPanelComponents';
import clsx from 'clsx';

interface AttributePanelProps {
    stats: CharacterStats;
    isHellMode?: boolean;
    difficulty?: Difficulty;
}

const InfoRow = ({ label, value, icon, className }: { label: string, value: React.ReactNode, icon?: React.ReactNode, className?: string }) => (
    <div className={clsx("flex items-center justify-between py-1 lg:py-2 border-b border-white/5 last:border-0", className)}>
        <span className="text-xs text-zinc-500 flex items-center gap-2">
            {icon && <span className="opacity-70">{icon}</span>}
            {label}
        </span>
        <span className="text-sm font-medium text-zinc-200 text-right">{value || '-'}</span>
    </div>
);

const StatBlock = ({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) => {
    const rank = getRankLetter(value);
    const rankColor = getRankColor(rank);
    const progress = getProgressToNextRank(value);
    // Extract 3-letter code (e.g. STR from "力量 (STR)")
    const shortCode = label.match(/\(([A-Z]+)\)/)?.[1] || label.substring(0, 3).toUpperCase(); 

    return (
        <div className="relative group bg-zinc-900/60 border border-white/5 rounded-lg p-2 hover:border-white/20 transition-all overflow-hidden flex flex-col justify-between min-h-[56px]">
            {/* Background Decor - Subtle */}
            <div className="absolute -right-2 -bottom-3 text-zinc-800/30 pointer-events-none group-hover:text-zinc-700/40 transition-colors [&>svg]:w-12 [&>svg]:h-12">
                {icon}
            </div>

            {/* Header: Icon + Label + Rank Badge */}
            <div className="flex justify-between items-center relative z-10 mb-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 opacity-80 [&>svg]:w-3 [&>svg]:h-3">{icon}</span>
                    <span className="text-[10px] font-bold text-zinc-500 tracking-wider font-display">{shortCode}</span>
                </div>
                <div className={clsx("text-[9px] font-black italic px-1.5 py-0.5 rounded-sm bg-black/40 border border-white/5 leading-none", rankColor)}>
                    {rank}
                </div>
            </div>

            {/* Value & Progress */}
            <div className="relative z-10">
                <div className="text-lg font-mono font-bold text-zinc-200 leading-none tracking-tight mb-1.5">
                    {value}
                </div>
                
                {/* Slim Progress Bar */}
                <div className="h-0.5 bg-zinc-800/50 rounded-full w-full overflow-hidden">
                    <div 
                        className={clsx("h-full opacity-80 transition-all duration-500", rank === 'S' ? 'bg-yellow-400' : 'bg-cyan-500')} 
                        style={{ width: `${progress}%` }} 
                    />
                </div>
            </div>
        </div>
    );
};

const StatusEffectBadge = ({ entry, variant }: { entry: StatusEffect | string; variant: 'buff' | 'curse' }) => {
    const isString = typeof entry === 'string';
    const name = isString ? entry : entry.名称;
    const desc = !isString ? entry.效果 : '';

    const styles = variant === 'buff' 
        ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400'
        : 'bg-red-950/30 border-red-900/50 text-red-400';

    return (
        <div className={clsx("px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2", styles)}>
            {variant === 'buff' ? <Sparkles size={12} /> : <Skull size={12} />}
            <span>{name}</span>
            {desc && <span className="text-[10px] opacity-70 border-l border-current pl-2 ml-1">{desc}</span>}
        </div>
    );
};

const VitalCardCompact = ({ label, current, max, color, icon }: { label: string, current: number, max: number, color: 'red' | 'blue' | 'emerald' | 'amber', icon: React.ReactNode }) => {
    const percent = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
    const colorStyles = {
        red: 'bg-red-600', blue: 'bg-blue-600', emerald: 'bg-emerald-600', amber: 'bg-amber-600'
    }[color];
    const textStyles = {
        red: 'text-red-400', blue: 'text-blue-400', emerald: 'text-emerald-400', amber: 'text-amber-400'
    }[color];

    return (
        <div className="bg-zinc-900/60 border border-white/5 rounded-lg p-1.5 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1">
                <span className={clsx("text-[9px] font-bold", textStyles)}>{label}</span>
                <div className="text-[9px] text-zinc-400 font-mono scale-90 origin-right">{Math.round(current)}</div>
            </div>
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className={clsx("h-full rounded-full transition-all duration-500", colorStyles)} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};

const BodyPartCompact = ({ label, data }: { label: string, data: any }) => {
    if (!data) return null;
    const { 当前, 最大 } = data;
    const percent = 最大 > 0 ? (当前 / 最大) * 100 : 0;
    let color = 'bg-emerald-500';
    if (percent < 30) color = 'bg-red-500';
    else if (percent < 60) color = 'bg-amber-500';
    
    return (
        <div className="flex items-center gap-2 text-[10px]">
            <span className="text-zinc-500 w-8 text-right shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
                <div className={clsx("h-full transition-all", color)} style={{ width: `${percent}%` }} />
            </div>
            <span className="text-zinc-400 font-mono w-6 text-right">{Math.round(percent)}%</span>
        </div>
    );
};

// Reusable Content Component for both Modal and Sidebar
export const CharacterStatsContent = ({ stats, isHellMode }: { stats: CharacterStats, isHellMode?: boolean }) => {
    const showPhysiology = stats.身体部位 && Object.keys(stats.身体部位).length > 0;
    const showMagic = stats.魔法栏位 && (stats.魔法栏位.上限 || 0) > 0;

    return (
        <div className="space-y-2">
            {/* 1. Key Resources (Valis & Excelia) */}
            <section className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <div className="bg-zinc-900/60 border border-yellow-900/20 p-1.5 sm:p-2 rounded-lg flex items-center justify-between shadow-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2 relative z-10">
                            <div className="p-1.5 bg-yellow-950/30 rounded-md text-yellow-500">
                                <Coins size={14} />
                            </div>
                            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">法利</span>
                        </div>
                        <span className="text-base font-mono font-bold text-yellow-100 relative z-10">{stats.法利?.toLocaleString() ?? 0}</span>
                </div>

                <div className="bg-zinc-900/60 border border-purple-900/20 p-1.5 sm:p-2 rounded-lg flex flex-col justify-center shadow-sm relative overflow-hidden group">
                        <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center justify-between mb-1.5 relative z-10">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-950/30 rounded-md text-purple-500">
                                    <Star size={14} />
                                </div>
                                <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">经验</span>
                            </div>
                            <span className="text-base font-mono font-bold text-purple-100">{stats.经验值?.toLocaleString() ?? 0}</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800/50 rounded-full overflow-hidden relative z-10">
                        <div className="h-full bg-purple-600/80" style={{ width: `${Math.min(100, (stats.伟业 || 0) / (stats.升级所需伟业 || 1) * 100)}%` }} />
                        </div>
                        <div className="text-[9px] text-zinc-500 text-right mt-0.5 font-mono relative z-10">
                            伟业: {stats.伟业} / {stats.升级所需伟业}
                        </div>
                </div>
            </section>

            {/* 2. Vitals Grid */}
            <section className="grid grid-cols-4 gap-1.5 sm:gap-2">
                <VitalCardCompact label="HP" current={stats.生命值} max={stats.最大生命值} color="red" icon={<Heart size={12} />} />
                <VitalCardCompact label="MP" current={stats.精神力} max={stats.最大精神力} color="blue" icon={<Sparkles size={12} />} />
                <VitalCardCompact label="SP" current={stats.体力} max={stats.最大体力} color="emerald" icon={<Battery size={12} />} />
                <VitalCardCompact label="FATIGUE" current={stats.疲劳度 || 0} max={100} color="amber" icon={<AlertTriangle size={12} />} />
            </section>

            {/* 3. Attributes Grid */}
            <section className="bg-zinc-900/40 border border-white/5 rounded-lg p-1.5 sm:p-2">
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                    <div className="p-1 bg-zinc-800/50 rounded text-zinc-500">
                        <Zap size={12} />
                    </div>
                    <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">基础能力</h2>
                </div>
                <div className="grid grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
                    <StatBlock label="力量 (STR)" value={stats.能力值.力量} icon={<Sword />} />
                    <StatBlock label="耐久 (END)" value={stats.能力值.耐久} icon={<Shield />} />
                    <StatBlock label="灵巧 (DEX)" value={stats.能力值.灵巧} icon={<Feather />} />
                    <StatBlock label="敏捷 (AGI)" value={stats.能力值.敏捷} icon={<Zap />} />
                    <StatBlock label="魔力 (MAG)" value={stats.能力值.魔力} icon={<Sparkles />} />
                </div>
            </section>

            {/* 4. Magic Slots (Conditional) */}
            {showMagic && (
                <section className="bg-zinc-900/40 border border-white/5 rounded-lg p-1.5 sm:p-2">
                    <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-zinc-800/50 rounded text-zinc-500"><Sparkles size={12} /></div>
                            <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">魔法栏位</h2>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                            {stats.魔法栏位?.已使用 ?? 0} / {stats.魔法栏位?.上限 ?? 0}
                        </div>
                    </div>
                    <div className="flex gap-1 h-1.5 sm:h-2">
                        {Array.from({ length: stats.魔法栏位?.上限 ?? 3 }).map((_, i) => (
                            <div 
                                key={i}
                                className={clsx(
                                    "flex-1 rounded-sm transition-all",
                                    i < (stats.魔法栏位?.已使用 ?? 0) 
                                        ? "bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.6)]" 
                                        : "bg-zinc-800/50 border border-white/5"
                                )}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* 5. Physiology (Conditional) */}
            {showPhysiology && (
                <section className="bg-zinc-900/40 border border-white/5 rounded-lg p-1.5 sm:p-2">
                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                        <div className="p-1 bg-zinc-800/50 rounded text-zinc-500"><Activity size={12} /></div>
                        <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">生理监测</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 sm:gap-x-4 gap-y-1">
                        {Object.entries(stats.身体部位!).map(([part, data]) => (
                            <BodyPartCompact key={part} label={part} data={data} />
                        ))}
                    </div>
                </section>
            )}

            {/* 6. Status Effects */}
            <section className="bg-zinc-900/40 border border-white/5 rounded-lg p-1.5 sm:p-2">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1 bg-zinc-800/50 rounded text-zinc-500"><Activity size={12} /></div>
                    <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">状态</h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {(stats.状态 && stats.状态.length > 0) || (stats.诅咒 && stats.诅咒.length > 0) ? (
                        <>
                            {stats.状态?.map((b, i) => <StatusEffectBadge key={`b-${i}`} entry={b} variant="buff" />)}
                            {stats.诅咒?.map((c, i) => <StatusEffectBadge key={`c-${i}`} entry={c} variant="curse" />)}
                        </>
                    ) : (
                        <div className="w-full py-2 text-center text-[10px] text-zinc-600 italic border border-dashed border-zinc-800 rounded">
                            状态良好，无异常
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export const AttributePanel: React.FC<AttributePanelProps> = ({ stats, isHellMode }) => {
    return (
        <div className="flex flex-col lg:flex-row w-full lg:h-full bg-[#09090b] text-zinc-100 lg:overflow-hidden">
            <div className="w-full lg:w-[320px] bg-zinc-950 relative flex flex-col border-r border-white/5 shrink-0 z-20 shadow-xl lg:shadow-none">
                {/* Background Image Layer */}
                <div className="absolute inset-0 overflow-hidden h-full">
                    <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/80 via-zinc-950/90 to-zinc-950 z-10" />
                    <img 
                        src={stats.头像 || "https://picsum.photos/400/600"} 
                        alt="Character Background" 
                        className="w-full h-full object-cover opacity-30 grayscale-[20%] blur-sm contrast-125"
                    />
                </div>

                <div className="relative z-20 flex flex-col h-full p-3 lg:p-8 justify-between gap-3 lg:gap-0">
                     {/* Level Badge */}
                     <div className="absolute top-3 right-3 lg:top-6 lg:right-6 flex flex-col items-center">
                        <div className="flex items-center gap-1 text-[8px] lg:text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5 lg:mb-1">
                            <span>等级</span>
                        </div>
                        <div className="text-xl lg:text-5xl font-display font-black text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                            {stats.等级}
                        </div>
                     </div>

                    <div className="flex flex-row lg:flex-col items-center lg:items-start gap-3 lg:gap-0 mt-1 lg:mt-0">
                        {/* Avatar Circle */}
                        <div className="lg:mt-8 lg:mb-6 lg:mx-0 relative group shrink-0">
                            <div className="w-14 h-14 lg:w-32 lg:h-32 rounded-xl lg:rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl relative z-10 transform transition-transform duration-500 group-hover:scale-105 group-hover:rotate-1">
                                <img 
                                    src={stats.头像 || "https://picsum.photos/200/200"} 
                                    alt={stats.姓名} 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl -z-10 group-hover:bg-cyan-400/30 transition-colors duration-500" />
                        </div>

                        {/* Name & Title */}
                        <div className="text-left lg:text-left lg:mb-8 flex-1 min-w-0 flex flex-col justify-center">
                            <h1 className="text-base lg:text-3xl font-bold text-white tracking-tight mb-0.5 lg:mb-2 drop-shadow-md truncate pr-8 lg:pr-0">{stats.姓名}</h1>
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 lg:px-3 lg:py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-inner max-w-full w-fit">
                                <Crown size={10} className="text-amber-400 shrink-0 w-3 h-3 lg:w-auto lg:h-auto" />
                                <span className="text-[9px] lg:text-xs font-bold text-amber-100 uppercase tracking-wider truncate">{stats.称号 || '暂无称号'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Basic Info List */}
                    <div className="bg-black/20 rounded-lg lg:rounded-xl p-2 lg:p-3 border border-white/5 backdrop-blur-sm grid grid-cols-2 lg:flex lg:flex-col lg:space-y-1 gap-x-2 gap-y-1 lg:gap-0">
                        <InfoRow label="种族" value={stats.种族} icon={<User size={12}/>} className="py-0.5 lg:py-2" />
                        <InfoRow label="所属眷族" value={stats.所属眷族} icon={<Activity size={12}/>} className="text-cyan-300 py-0.5 lg:py-2" />
                        <InfoRow label="公会评级" value={<span className="font-display font-bold text-sm lg:text-base text-yellow-400">{stats.公会评级 || 'I'}</span>} icon={<Trophy size={12}/>} className="col-span-2 lg:col-span-1 py-0.5 lg:py-2 border-t border-white/5 lg:border-t-0 mt-1 lg:mt-0 pt-1 lg:pt-2" />
                    </div>
                </div>
            </div>

            {/* Right Column: Detailed Stats */}
            <div className="flex-1 lg:overflow-y-auto custom-scrollbar bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-950 p-2 lg:p-10">
                <div className="max-w-5xl mx-auto">
                    <CharacterStatsContent stats={stats} isHellMode={isHellMode} />
                </div>
            </div>
        </div>
    );
};
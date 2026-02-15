
import React from 'react';

// Danmachi Rank Logic (S-I)
export const getRankLetter = (val: number): string => {
    if (val >= 900) return 'S';
    if (val >= 800) return 'A';
    if (val >= 700) return 'B';
    if (val >= 600) return 'C';
    if (val >= 500) return 'D';
    if (val >= 400) return 'E';
    if (val >= 300) return 'F';
    if (val >= 200) return 'G';
    if (val >= 100) return 'H';
    return 'I';
};

export const getRankColor = (rank: string): string => {
    if (['S', 'SS', 'SSS'].includes(rank)) return 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]';
    if (['A', 'B'].includes(rank)) return 'text-blue-400';
    if (['C', 'D', 'E'].includes(rank)) return 'text-green-400';
    return 'text-zinc-400';
};

export const getProgressToNextRank = (val: number): number => {
    if (val >= 999) return 100; // Cap at S (999)
    const currentBase = Math.floor(val / 100) * 100;
    const nextBase = currentBase + 100;
    return ((val - currentBase) / (nextBase - currentBase)) * 100;
};

export const VitalBar = ({ label, current, max, color, icon }: any) => {
    const percent = Math.min(100, Math.max(0, (current / max) * 100));
    
    return (
        <div className="relative mb-2 group">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider font-mono group-hover:text-cyan-200 transition-colors">
                <span className="flex items-center gap-1.5">{icon} {label}</span>
                <span className="font-mono text-slate-500 group-hover:text-slate-300 transition-colors">{current}/{max}</span>
            </div>
            
            <div className="h-1.5 w-full bg-zinc-950/80 border border-white/5 relative overflow-hidden rounded-sm">
                <div
                    className={`h-full ${color} transition-all duration-300 relative`}
                    style={{ 
                        width: `${percent}%`,
                        backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0) 0, rgba(255,255,255,0) 6px, rgba(255,255,255,0.1) 6px, rgba(255,255,255,0.1) 12px)'
                    }}
                />
            </div>
        </div>
    );
};

export const HexStat = ({ label, val, icon }: { label: string, val: number, icon?: React.ReactNode }) => {
    
    return (
        <div className="relative w-[80px] h-[90px] flex flex-col items-center justify-center shrink-0 group">
             {/* Hexagon Background */}
             <div className="absolute inset-0 bg-[#0f1420] group-hover:bg-[#141b2e] transition-colors"
                  style={{ 
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  }}>
             </div>
             
             {/* Inner Content */}
             <div className="relative z-10 flex flex-col items-center -mt-1">
                {/* Header: Icon + Label */}
                <div className="flex items-center gap-1.5 mb-2 opacity-70">
                     <span className="text-slate-400 [&>svg]:w-3 [&>svg]:h-3">{icon}</span>
                     <span className="text-[10px] text-slate-400 font-bold tracking-widest font-display">{label}</span>
                </div>

                {/* Value - Large & Central */}
                <div className="text-3xl font-serif text-slate-200 leading-none drop-shadow-lg">
                    {val}
                </div>
             </div>
        </div>
    );
};

export const StatRow = ({ label, val, icon }: { label: string, val: number, icon?: React.ReactNode }) => {
    const rank = getRankLetter(val);
    const colorClass = getRankColor(rank);
    const progress = getProgressToNextRank(val);

    return (
        <div className="flex flex-col px-3 py-2 hover:bg-white/5 transition-colors group rounded-md border border-transparent hover:border-bronze-500/20 mb-1">
            <div className="flex justify-between items-center mb-1.5">
                <span className="text-bronze-400/80 text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 group-hover:text-bronze-200 transition-colors font-display rune-text">
                    {icon} {label}
                </span>
                <div className="flex items-baseline gap-2">
                    <span className={`font-display text-lg font-bold ${colorClass} leading-none w-6 text-center`}>{rank}</span>
                    <span className="font-mono text-zinc-500 text-xs w-8 text-right group-hover:text-parchment-100 transition-colors">{val}</span>
                </div>
            </div>
            {/* Mini Progress Bar */}
            <div className="h-0.5 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                 <div
                    className={`h-full opacity-70 ${rank === 'S' ? 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)]' : 'bg-bronze-400/50'}`}
                    style={{ width: `${progress}%` }}
                 />
            </div>
        </div>
    );
};

// EquipRow Removed in favor of new Slot component in main file

import React from 'react';
import { Shield, Target, Dices, Crown, Skull } from 'lucide-react';

interface JudgmentMessageProps {
  text: string;
}

export const JudgmentMessage: React.FC<JudgmentMessageProps> = ({ text }) => {
  // Parse the judgment string
  // Expected format: Title｜Result｜Score/Difficulty｜Modifiers...
  // Example: 长距离负重行军｜成功｜判定值 2150/难度 1600｜基础 1940 (Lv.6 韧性)｜环境 -100 (复杂地形/高低差)｜状态 -80 (负重/持续消耗)｜幸运 +390

  // Remove prefix if present (though LogEntry usually passes the raw line)
  const cleanText = text.replace(/^【判定】/, '').trim();
  const parts = cleanText.split('｜').map(p => p.trim());

  if (parts.length < 3) {
    return <div className="text-xs text-red-400 font-mono">{text}</div>;
  }

  const actionName = parts[0];
  const result = parts[1];
  const isSuccess = result.includes('成功');
  const isCritical = result.includes('大成功');
  const isFumble = result.includes('大失败');
  
  const scorePart = parts[2];
  // Try to parse "判定值 X/难度 Y"
  const scoreMatch = scorePart.match(/(\d+).*?\/.*?(\d+)/);
  const score = scoreMatch ? scoreMatch[1] : '?';
  const difficulty = scoreMatch ? scoreMatch[2] : '?';

  const modifiers = parts.slice(3);

  // Persona 5 style colors
  const baseColor = isSuccess ? 'text-blue-400' : 'text-red-400';
  const borderColor = isSuccess ? 'border-blue-500' : 'border-red-500';
  const bgColor = isSuccess ? 'bg-blue-950/80' : 'bg-red-950/80';
  const accentColor = isSuccess ? 'bg-blue-500' : 'bg-red-500';

  return (
    <div className={`relative my-2 w-full max-w-md mx-auto overflow-hidden font-display transform skew-x-[-5deg]`}>
        {/* Main Container */}
        <div className={`relative border-2 ${borderColor} ${bgColor} p-1 shadow-[5px_5px_0px_rgba(0,0,0,0.5)]`}>
            
            {/* Header: Action Name & Result */}
            <div className={`flex items-stretch mb-1`}>
                <div className={`flex-1 ${accentColor} text-white px-3 py-1 flex items-center justify-between`}>
                    <span className="font-bold uppercase tracking-wider text-sm md:text-base truncate mr-2">
                        {actionName}
                    </span>
                    <div className="flex items-center gap-2">
                        {isSuccess ? <Crown size={16} className="animate-pulse"/> : <Skull size={16} />}
                        <span className="font-black text-lg italic uppercase tracking-widest">
                            {result}
                        </span>
                    </div>
                </div>
            </div>

            {/* Score vs Difficulty Row */}
            <div className="flex items-center gap-2 px-2 py-2 bg-black/40 mb-1 border-t border-b border-white/10">
                <div className="flex-1 flex flex-col items-center border-r border-white/10">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                        <Shield size={10} /> Check
                    </span>
                    <span className={`text-2xl font-black ${baseColor}`}>{score}</span>
                </div>
                <div className="text-zinc-500 font-black text-xl">VS</div>
                <div className="flex-1 flex flex-col items-center border-l border-white/10">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                        <Target size={10} /> Target
                    </span>
                    <span className="text-2xl font-black text-zinc-200">{difficulty}</span>
                </div>
            </div>

            {/* Modifiers List */}
            {modifiers.length > 0 && (
                <div className="space-y-1 px-2 py-1">
                    {modifiers.map((mod, idx) => {
                        // Example: 基础 1940 (Lv.6 韧性)
                        // Split by space to get Label, Value, Detail
                        const firstSpace = mod.indexOf(' ');
                        if (firstSpace === -1) return <div key={idx} className="text-xs text-zinc-400">{mod}</div>;
                        
                        const label = mod.substring(0, firstSpace);
                        const rest = mod.substring(firstSpace + 1);
                        const valueMatch = rest.match(/([+-]?\d+)\s*(.*)/);
                        const value = valueMatch ? valueMatch[1] : '';
                        const detail = valueMatch ? valueMatch[2] : rest;

                        const isPositive = value.startsWith('+') || (!value.startsWith('-') && parseInt(value) > 0);
                        const valColor = isPositive ? 'text-blue-300' : 'text-red-300';

                        return (
                            <div key={idx} className="flex items-center text-xs font-mono tracking-tight">
                                <div className="w-12 text-zinc-500 text-right mr-2 shrink-0">{label}</div>
                                <div className={`w-12 font-bold text-right mr-2 ${valColor}`}>{value}</div>
                                <div className="text-zinc-400 truncate opacity-80">{detail}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Decorative Elements */}
            <div className="absolute -bottom-4 -right-4 text-white/5 transform rotate-[-15deg]">
                 <Dices size={80} />
            </div>
        </div>
    </div>
  );
};

import React from 'react';
import { Sparkles } from 'lucide-react';

export const GameTitle: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center z-20 relative text-center mb-12 md:mb-16">
        
        {/* Decorative Top Line */}
        <div className="flex items-center gap-4 mb-4 opacity-70 animate-in fade-in slide-in-from-top duration-1000">
            <div className="h-[1px] w-12 md:w-24 bg-gradient-to-l from-guild-gold to-transparent" />
            <div className="text-guild-gold/80 text-xs md:text-sm font-display tracking-[0.3em] uppercase flex items-center gap-2">
                <Sparkles size={10} className="text-hestia-blue-400" />
                Orario Database
                <Sparkles size={10} className="text-hestia-blue-400" />
            </div>
            <div className="h-[1px] w-12 md:w-24 bg-gradient-to-r from-guild-gold to-transparent" />
        </div>

        {/* Main Title */}
        <h1 className="relative font-display font-black leading-none mb-4 group cursor-default">
            <div className="flex flex-col items-center gap-2 md:gap-4">
                <span className="block text-4xl md:text-7xl lg:text-8xl text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-400 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] tracking-tight transition-all duration-700 group-hover:drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]">
                    在地下城寻求邂逅
                </span>
                <span className="block text-3xl md:text-6xl lg:text-7xl text-transparent bg-clip-text bg-gradient-to-b from-guild-gold-300 via-guild-gold-400 to-guild-gold-600 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)] tracking-wider transition-all duration-700 group-hover:drop-shadow-[0_0_20px_rgba(251,191,36,0.5)] pb-2">
                    是否搞错了什么
                </span>
            </div>
        </h1>

        {/* Subtitle */}
        <div className="relative">
            <p className="font-ui text-zinc-400 tracking-[0.2em] text-sm md:text-base font-light uppercase animate-in fade-in slide-in-from-bottom duration-1000 delay-300">
                DanMachi: Familia Myth
            </p>
             {/* Subtle Glow Underline */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-hestia-blue-500/50 to-transparent" />
        </div>
    </div>
  );
};
import React from 'react';

interface P5ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'blue' | 'gold' | 'black' | 'white' | 'red';
  icon?: React.ReactNode;
  label: string;
  animate?: boolean;
}

export const P5Button: React.FC<P5ButtonProps> = ({
  variant = 'blue',
  icon,
  label,
  className = '',
  animate = false,
  ...props
}) => {
  // Crystal/Runic Style Base - Rectangular, Glassy, Refined
  const baseStyles = "group relative w-full px-8 py-4 font-display uppercase tracking-[0.15em] text-lg md:text-xl transition-all duration-300 ease-out overflow-hidden border backdrop-blur-md flex items-center justify-center gap-3 shadow-lg";

  const variants = {
    // Gold - Primary Action (Start Game)
    gold: "bg-guild-gold/10 border-guild-gold/40 text-guild-gold hover:bg-guild-gold/20 hover:border-guild-gold/80 hover:text-white hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]",
    
    // Blue - Secondary (Settings)
    blue: "bg-hestia-blue-900/20 border-hestia-blue-500/30 text-hestia-blue-100 hover:bg-hestia-blue-600/30 hover:border-hestia-blue-400 hover:text-white hover:shadow-[0_0_20px_rgba(56,189,248,0.3)]",
    
    // Black - Continue
    black: "bg-black/40 border-zinc-700/50 text-zinc-300 hover:bg-zinc-800/60 hover:border-zinc-500 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]",
    
    // White - Special
    white: "bg-white/5 border-white/20 text-zinc-200 hover:bg-white/10 hover:border-white/50 hover:text-white",
    
    // Red - Danger/Back
    red: "bg-red-950/30 border-red-800/50 text-red-200 hover:bg-red-900/50 hover:border-red-500 hover:text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {/* 1. Subtle Background Noise/Texture */}
      <div className="absolute inset-0 bg-noise opacity-10 pointer-events-none" />

      {/* 2. Hover Scanline Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />

      {/* 3. Corner Accents (Runic Markers) */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-current opacity-50 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-current opacity-50 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-current opacity-50 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-current opacity-50 group-hover:opacity-100 transition-opacity" />

      {/* 4. Content */}
      <span className="relative z-10 group-hover:scale-110 transition-transform duration-300 ease-out opacity-80 group-hover:opacity-100">
        {icon}
      </span>
      <span className="relative z-10 text-shadow-sm font-bold">{label}</span>
    </button>
  );
};
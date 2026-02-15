import React from 'react';

interface CombatContainerProps {
  children: React.ReactNode;
}

export const CombatContainer: React.FC<CombatContainerProps> = ({ children }) => {
  return (
    <div className="w-full h-full relative flex flex-col bg-zinc-950 overflow-hidden font-body">

      {/* --- Dynamic Background --- */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        {/* Base dark layer */}
        <div className="absolute inset-0 bg-zinc-950" />

        {/* Red tint from top (danger feel) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-red-950/20 via-zinc-950/80 to-zinc-950" />

        {/* Texture overlay */}
        <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

        {/* Subtle grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />
      </div>

      {/* --- Main Content Layer --- */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
};

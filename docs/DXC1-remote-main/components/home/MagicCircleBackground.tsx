import React, { useEffect, useState } from 'react';

export const MagicCircleBackground: React.FC = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={`absolute inset-0 overflow-hidden bg-dungeon-black transition-opacity duration-1000 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
      
      {/* 1. Base Layer: Deep Night Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0f172a] to-[#020617]" />
      
      {/* 2. Moonlight Glow (Top Center) */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[80vw] h-[60vh] bg-hestia-blue-900/20 blur-[120px] rounded-full mix-blend-screen" />

      {/* 3. Magic Circles (SVG) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 mix-blend-plus-lighter">
        {/* Outer Ring - Slow Rotate */}
        <div className="w-[120vmin] h-[120vmin] animate-spin-slow">
            <svg viewBox="0 0 100 100" className="w-full h-full text-hestia-blue-500/20 fill-none stroke-current stroke-[0.2]">
                <circle cx="50" cy="50" r="48" />
                <circle cx="50" cy="50" r="45" strokeDasharray="1,2" />
                <path d="M50 2 L50 98 M2 50 L98 50" strokeOpacity="0.5" />
                {/* Runes Mockup */}
                <path d="M50 5 A 45 45 0 0 1 95 50" strokeDasharray="0.5, 3" strokeWidth="1" />
            </svg>
        </div>
        
        {/* Middle Ring - Reverse Rotate */}
        <div className="absolute w-[80vmin] h-[80vmin] animate-spin-reverse-slow">
             <svg viewBox="0 0 100 100" className="w-full h-full text-runic-gold/10 fill-none stroke-current stroke-[0.3]">
                <rect x="25" y="25" width="50" height="50" transform="rotate(45 50 50)" />
                <circle cx="50" cy="50" r="35" />
                <circle cx="50" cy="50" r="30" strokeDasharray="4,1" />
            </svg>
        </div>

        {/* Inner Core - Pulse */}
        <div className="absolute w-[40vmin] h-[40vmin] animate-pulse-slow">
            <svg viewBox="0 0 100 100" className="w-full h-full text-hestia-blue-400/30 fill-none stroke-current stroke-[0.5]">
                <circle cx="50" cy="50" r="15" />
                <polygon points="50,20 76,35 76,65 50,80 24,65 24,35" strokeOpacity="0.8" />
            </svg>
        </div>
      </div>

      {/* 4. Ambient Particles */}
      <div className="absolute inset-0">
          {[...Array(15)].map((_, i) => (
              <div key={i} className="absolute animate-float" style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${5 + Math.random() * 5}s`,
                  opacity: 0.1 + Math.random() * 0.3
              }}>
                  <div className="w-1 h-1 bg-hestia-blue-100 rounded-full blur-[1px]" />
              </div>
          ))}
      </div>
      
      {/* 5. Vignette */}
      <div className="absolute inset-0 bg-radial-gradient-vignette pointer-events-none" />
      
      <style>{`
        .bg-radial-gradient-vignette {
            background: radial-gradient(circle at center, transparent 0%, rgba(2,6,23,0.8) 100%);
        }
      `}</style>
    </div>
  );
};


import React, { useEffect, useState } from 'react';

interface HeroBackgroundProps {
  backgroundImage?: string;
  mousePos: { x: number; y: number };
}

export const HeroBackground: React.FC<HeroBackgroundProps> = ({ backgroundImage, mousePos }) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Parallax calculations (low motion)
  const bgTransform = `translate(${mousePos.x * -8}px, ${mousePos.y * -8}px) scale(1.04)`;
  const shapeTransform1 = `translateX(${mousePos.x * 6}px) skewX(-18deg)`;
  const shapeTransform2 = `translate(${mousePos.x * -6}px, ${mousePos.y * -6}px) skewY(10deg)`;

  return (
    <div className={`absolute inset-0 transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'} overflow-hidden`}>
      
      {/* 1. Base Layer: Solid Dark with Gradient or Custom Image */}
      <div 
          className="absolute inset-0 bg-zinc-950 bg-gradient-to-br from-black via-zinc-900 to-blue-950 transition-transform duration-100 ease-out will-change-transform"
          style={{ 
              transform: bgTransform,
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
          }} 
      />
      
      {/* 深蓝遮罩层 - 增强地下城氛围 */}
      <div className="absolute inset-0 bg-blue-950/90 mix-blend-multiply pointer-events-none" />

      {/* 2. Abstract Geometry Shapes (DanMachi Blue/White theme) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
           {/* Left Blue Beam - 增加金色边缘 */}
           <div
              className="absolute -left-[10%] -top-[10%] w-[50vw] h-[150vh] bg-blue-900/40 transform -skew-x-[25deg] mix-blend-overlay opacity-80 animate-in slide-in-from-left duration-1000 will-change-transform border-r-2 border-guild-gold/20"
              style={{ transform: shapeTransform1 }}
           />
           {/* Vertical Slices */}
           <div className="absolute left-[30%] top-0 w-[5vw] h-[100vh] bg-black/50 transform -skew-x-[25deg]" />
           <div className="absolute left-[35%] top-0 w-[2vw] h-[100vh] bg-white/10 transform -skew-x-[25deg]" />

           {/* Bottom Right Structure - 金色边框 */}
           <div
              className="absolute -right-[10%] bottom-0 w-[60vw] h-[80vh] bg-zinc-900 transform skew-y-[15deg] border-t-4 border-guild-gold opacity-95 animate-in slide-in-from-bottom duration-1000 delay-300 will-change-transform"
              style={{ transform: shapeTransform2 }}
           />
      </div>

      {/* 3. 纹理叠加层 - 增强 RPG 游戏感 */}
      {/* 六边形网格 - 科技魔法感 */}
      <div className="absolute inset-0 bg-hexagon opacity-15 pointer-events-none mix-blend-overlay" />
      {/* 半色调蓝色网格 */}
      <div className="absolute inset-0 bg-halftone-blue opacity-10 pointer-events-none" />
      {/* 噪点材质 - 增加深度 */}
      <div className="absolute inset-0 bg-noise opacity-25 pointer-events-none mix-blend-soft-light" />
      
      {/* 4. Animated Particles (Mana/Excelia) - 金色粒子增强 */}
      <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
              <div key={i} className="absolute animate-float" style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${3 + Math.random() * 4}s`,
                  opacity: 0.3 + Math.random() * 0.4
              }}>
                  <div className={`w-1 h-1 rounded-full opacity-80 ${
                    i % 5 === 0
                      ? 'bg-guild-gold shadow-[0_0_10px_#fbbf24]'
                      : 'bg-white shadow-[0_0_10px_white]'
                  }`} />
              </div>
          ))}
      </div>

      {/* 5. UI Decor Elements - 中文化 */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-guild-gold to-transparent opacity-50" />
      <div className="absolute bottom-10 left-10 hidden md:block">
          <div className="flex flex-col gap-2 opacity-60 font-ui text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-guild-gold rounded-full animate-pulse" />
                  <span>系统状态：正常</span>
              </div>
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-hestia-blue-glow rounded-full animate-pulse" />
                  <span>神明档案库：已连接</span>
              </div>
          </div>
      </div>
    </div>
  );
};

import React from 'react';
import { motion } from 'framer-motion';

export type QualityLevel = 'common' | 'rare' | 'epic' | 'legendary';

interface QualityCardProps {
  quality?: QualityLevel;
  children: React.ReactNode;
  className?: string;
  enableGlow?: boolean;
  enableParticles?: boolean;
}

export const QualityCard: React.FC<QualityCardProps> = ({
  quality = 'common',
  children,
  className = '',
  enableGlow = true,
  enableParticles = true,
}) => {
  // 品质对应的样式类
  const qualityClasses = {
    common: '',
    rare: enableGlow ? 'quality-glow-rare' : 'border-2 border-hestia-blue-400',
    epic: enableGlow ? 'quality-glow-epic' : 'border-2 border-purple-500',
    legendary: enableGlow ? 'quality-glow-legendary' : 'border-3 border-guild-gold',
  };

  // 粒子颜色
  const particleColors = {
    common: 'bg-zinc-400',
    rare: 'bg-hestia-blue-400',
    epic: 'bg-purple-400',
    legendary: 'bg-guild-gold',
  };

  const showParticles = enableParticles && quality === 'legendary';

  return (
    <motion.div
      className={`
        relative
        bg-dungeon-stone/80
        backdrop-blur-sm
        rounded-xl
        overflow-hidden
        ${qualityClasses[quality]}
        ${className}
      `}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
    >
      {/* 传说品质粒子效果 */}
      {showParticles && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className={`absolute w-1 h-1 rounded-full ${particleColors[quality]}`}
              style={{
                left: `${(i * 8.33) % 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -100],
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.25,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      )}

      {/* 品质装饰角标 */}
      {quality !== 'common' && (
        <div className="absolute top-2 right-2 z-10">
          <div
            className={`
              px-2 py-1 rounded text-[10px] font-display font-bold uppercase tracking-wider
              ${quality === 'rare' ? 'bg-hestia-blue-500/80 text-white' : ''}
              ${quality === 'epic' ? 'bg-purple-500/80 text-white' : ''}
              ${quality === 'legendary' ? 'bg-guild-gold/80 text-dungeon-black' : ''}
            `}
          >
            {quality}
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

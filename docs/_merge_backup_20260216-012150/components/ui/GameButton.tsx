import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export type GameButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type GameButtonSize = 'sm' | 'md' | 'lg';

interface GameButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const GameButton: React.FC<GameButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  icon,
  className = '',
  ...props
}) => {
  const isDisabled = disabled || loading;

  // 尺寸样式
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  // 变体样式
  const variantClasses = {
    primary: `
      stone-button
      text-parchment-100 font-display font-bold
      hover:text-white
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    secondary: `
      bg-gradient-to-b from-parchment-200 to-parchment-300
      border-2 border-bronze-400
      text-dungeon-black font-display font-bold
      hover:border-guild-gold hover:shadow-md
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-all duration-200
    `,
    danger: `
      bg-gradient-to-b from-red-600 to-red-700
      border-2 border-red-500
      text-white font-display font-bold
      shadow-[0_4px_0_rgba(127,29,29,1)]
      hover:shadow-[0_6px_0_rgba(127,29,29,1)]
      hover:translate-y-[-2px]
      hover:border-red-400
      active:shadow-[0_2px_0_rgba(127,29,29,1)]
      active:translate-y-[2px]
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-all duration-150
    `,
    ghost: `
      bg-transparent
      border-2 border-bronze-400/50
      text-bronze-300 font-display font-bold
      hover:border-bronze-400 hover:bg-bronze-400/10
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-all duration-200
    `,
  };

  // 禁用状态样式
  const disabledClass = isDisabled ? 'grayscale opacity-50 cursor-not-allowed' : '';

  return (
    <motion.button
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${disabledClass}
        rounded-md
        flex items-center justify-center gap-2
        relative overflow-hidden
        ${className}
      `}
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      disabled={isDisabled}
      {...props}
    >
      {/* 粒子效果层（仅primary变体） */}
      {variant === 'primary' && !isDisabled && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-guild-gold rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -10, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </motion.div>
      )}

      {/* 加载状态 */}
      {loading && (
        <Loader2 size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} className="animate-spin" />
      )}

      {/* 图标 */}
      {!loading && icon && <span className="shrink-0">{icon}</span>}

      {/* 文字内容 */}
      <span className="relative z-10 tracking-wider">{children}</span>
    </motion.button>
  );
};

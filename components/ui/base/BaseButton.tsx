import React from 'react';
import { Loader2 } from 'lucide-react';

export interface BaseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'outline' | 'ghost' | 'glass' | 'danger' | 'gold';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const BaseButton: React.FC<BaseButtonProps> = ({
  children,
  className = '',
  variant = 'solid',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}) => {
  const baseStyles = `
    relative inline-flex items-center justify-center gap-2
    font-ui font-medium tracking-wide
    transition-all duration-200 ease-out
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    overflow-hidden
    group
  `;

  const variants = {
    solid: `
      bg-surface-floating text-content-primary
      hover:bg-[var(--color-hestia-blue-base)] hover:text-white
      active:scale-95
      shadow-lg
    `,
    outline: `
      bg-transparent border border-white/20 text-content-primary
      hover:bg-white/5 hover:border-white/40
      active:scale-95
    `,
    ghost: `
      bg-transparent text-content-secondary
      hover:text-content-primary hover:bg-white/5
    `,
    glass: `
      bg-white/5 border border-white/10 text-content-primary
      backdrop-blur-md
      hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]
      active:scale-95
    `,
    danger: `
      bg-red-900/20 border border-red-500/30 text-red-400
      hover:bg-red-500 hover:text-white hover:border-red-500
      active:scale-95
    `,
    gold: `
      bg-gradient-to-b from-[var(--color-guild-gold)]/20 to-amber-600/10
      border border-[var(--color-guild-gold)]/50 text-amber-200
      hover:text-white hover:border-[var(--color-guild-gold)]
      hover:shadow-[0_0_15px_rgba(251,191,36,0.3)]
      active:scale-95
    `
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs rounded',
    md: 'h-10 px-4 text-sm rounded-md',
    lg: 'h-12 px-6 text-base rounded-lg',
    icon: 'h-10 w-10 p-0 rounded-md',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Loading Spinner */}
      {isLoading && (
        <Loader2 className="w-4 h-4 animate-spin absolute" />
      )}

      {/* Content (Hidden when loading) */}
      <div className={`flex items-center gap-2 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {leftIcon && <span className="text-current opacity-80 group-hover:opacity-100">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="text-current opacity-80 group-hover:opacity-100">{rightIcon}</span>}
      </div>

      {/* Shimmer Effect for Solid/Gold variants */}
      {(variant === 'solid' || variant === 'gold') && !disabled && (
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
      )}
    </button>
  );
};


import React, { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { gsap } from 'gsap';

// Unified modal sizing system - shared with BaseModal
export type ModalSize = 's' | 'm' | 'l' | 'xl' | 'full';
export type ModalTheme = 'default' | 'guild' | 'social' | 'monitor' | 'contract';

// Unified size map: consistent widths and dvh heights across all modals
export const modalSizeClasses: Record<ModalSize, string> = {
    s: 'w-full max-w-[95vw] sm:w-[420px] h-[85dvh] sm:h-[750px] max-h-[90dvh]',
    m: 'w-[95vw] sm:w-[800px] h-[80dvh] sm:h-[700px] max-h-[85dvh]',
    l: 'w-[95vw] sm:w-[90vw] h-[85dvh] max-h-[90dvh]',
    xl: 'w-[95vw] h-[90dvh] max-w-[1600px]',
    full: 'w-full h-dvh rounded-none max-w-none',
};

interface ModalWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    size?: ModalSize;
    theme?: ModalTheme;
    className?: string; // Optional custom class for the outer container
    icon?: ReactNode;
    footer?: ReactNode;
    noBodyPadding?: boolean; // New prop to control internal padding
    hideHeader?: boolean;
    headerActions?: ReactNode;
    bodyClassName?: string;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'm',
    theme = 'default',
    className,
    icon,
    footer,
    noBodyPadding = false,
    hideHeader = false,
    headerActions,
    bodyClassName
}) => {
    // ...refs and useEffect...
    const modalRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Lock body scroll
            const originalOverflow = document.body.style.overflow;
            const originalPaddingRight = document.body.style.paddingRight;
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

            document.body.style.overflow = 'hidden';
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${scrollbarWidth}px`;
            }

            // Enter animation
            if (backdropRef.current) {
                gsap.fromTo(backdropRef.current,
                    { opacity: 0 },
                    { opacity: 1, duration: 0.3, ease: 'power2.out' }
                );
            }
            if (modalRef.current) {
                gsap.fromTo(modalRef.current,
                    { scale: 0.95, opacity: 0, y: 20 },
                    { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.2)' }
                );
            }

            return () => {
                // Restore body scroll
                document.body.style.overflow = originalOverflow;
                document.body.style.paddingRight = originalPaddingRight;
            };
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Theme Configurations
    const themeStyles = {
        default: {
            border: 'border border-white/10',
            headerBorder: 'border-white/5',
            glow: 'shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]',
            title: 'text-zinc-100',
            accent: 'bg-zinc-700'
        },
        guild: {
            border: 'border border-amber-500/20',
            headerBorder: 'border-amber-500/10',
            glow: 'shadow-[0_0_40px_-10px_rgba(245,158,11,0.15)]',
            title: 'text-amber-400',
            accent: 'bg-amber-600'
        },
        social: {
            border: 'border border-pink-500/20',
            headerBorder: 'border-pink-500/10',
            glow: 'shadow-[0_0_40px_-10px_rgba(236,72,153,0.15)]',
            title: 'text-pink-400',
            accent: 'bg-pink-600'
        },
        monitor: {
            border: 'border border-blue-500/20',
            headerBorder: 'border-blue-500/10',
            glow: 'shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)]',
            title: 'text-blue-400',
            accent: 'bg-blue-600'
        },
        contract: {
            border: 'border border-red-500/20',
            headerBorder: 'border-red-900/20',
            glow: 'shadow-[0_0_40px_-10px_rgba(185,28,28,0.2)]',
            title: 'text-red-400 font-serif tracking-wider',
            accent: 'bg-red-900'
        }
    };

    const currentTheme = themeStyles[theme];

    // Get size classes from the unified size map
    const sizeClass = modalSizeClasses[size as ModalSize] || modalSizeClasses.m;

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
        >
            {/* Backdrop */}
            <div
                ref={backdropRef}
                className="absolute inset-0 bg-[#050508]/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div
                ref={modalRef}
                className={clsx(
                    'relative flex flex-col overflow-hidden',
                    'bg-[#0a0a0f]/90 backdrop-blur-xl', // More translucent
                    'rounded-2xl', // Softer corners
                    currentTheme.border,
                    currentTheme.glow,
                    sizeClass,
                    className
                )}
            >
                {/* Texture Overlay (Hexagon Mesh or Noise) */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='40' viewBox='0 0 24 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40c5.523 0 10-4.477 10-10V10c0-5.523 4.477-10 10-10H0v40z' fill='%23ffffff' fill-rule='evenodd'/%3E%3C/svg%3E")` }}
                />

                {/* Header */}
                {!hideHeader && (
                <div className={clsx(
                    'relative z-10 flex items-center justify-between px-6 py-4 shrink-0',
                    'border-b bg-gradient-to-r from-white/5 to-transparent',
                    currentTheme.headerBorder
                )}>
                    <div className={clsx('flex items-center gap-3 font-display text-lg font-bold tracking-wide', currentTheme.title)}>
                        {icon && <span className="opacity-80">{icon}</span>}
                        {title}
                    </div>
                    <div className="flex items-center gap-2">
                        {headerActions}
                        <button
                            onClick={onClose}
                            className="group relative p-2 rounded-full hover:bg-white/10 transition-colors"
                            aria-label="Close"
                        >
                            <X size={20} className="text-zinc-400 group-hover:text-white transition-colors" />
                        </button>
                    </div>
                </div>
                )}

                {/* Body */}
                <div className={clsx(
                    "relative z-10 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar",
                    !noBodyPadding && "p-6",
                    bodyClassName
                )}>
                    {children}
                </div>

                {/* Footer (Optional) */}
                {footer && (
                    <div className={clsx(
                        'relative z-10 px-6 py-4 border-t bg-black/20 shrink-0',
                        currentTheme.headerBorder
                    )}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

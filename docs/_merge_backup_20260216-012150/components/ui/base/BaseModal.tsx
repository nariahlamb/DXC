import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Unified modal sizing system - shared with ModalWrapper
export type ModalSize = 's' | 'm' | 'l' | 'xl' | 'full';

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  size?: ModalSize;
  showCloseButton?: boolean;
  className?: string;
  preventCloseOnOutsideClick?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

// Unified size map: consistent with ModalWrapper using dvh for heights
const sizeClasses: Record<ModalSize, string> = {
  s: 'w-full h-full md:w-[420px] md:h-[750px] md:max-h-[90dvh] md:max-w-[95vw]',
  m: 'w-full h-full md:w-[800px] md:h-[700px] md:max-h-[85dvh] md:max-w-[95vw]',
  l: 'w-full h-full md:w-[90vw] md:h-[85dvh] md:max-h-[90dvh]',
  xl: 'w-full h-full md:w-[95vw] md:h-[90dvh] md:max-w-[1600px]',
  full: 'w-full h-dvh rounded-none md:rounded-none max-w-none',
};

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'm', // Default changed to 'm' to match ModalSize
  showCloseButton = true,
  className = '',
  preventCloseOnOutsideClick = false,
  initialFocusRef,
  returnFocusRef,
}) => {
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Detect mobile view to adjust behavior
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

  // Get all focusable elements within the modal
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!modalRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable]',
    ].join(', ');

    return Array.from(
      modalRef.current.querySelectorAll(focusableSelectors)
    ).filter((el): el is HTMLElement => el instanceof HTMLElement);
  }, []);

  // Handle Tab key navigation with focus trapping
  const handleTabKey = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift+Tab: Move backward
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: Move forward
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, [isOpen, getFocusableElements]);

  // Handle Escape key to close modal
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus trap, body scroll lock, and focus return
  useEffect(() => {
    if (!isOpen) {
      // Return focus to triggering element when modal closes
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
        previousActiveElement.current = null;
      }
      return;
    }

    // Store the element that triggered the modal
    previousActiveElement.current = returnFocusRef?.current || (document.activeElement as HTMLElement);

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Focus management - set initial focus after animation starts
    const focusTimer = setTimeout(() => {
      const focusableElements = getFocusableElements();
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (focusableElements.length > 0) {
        // Focus first focusable element
        focusableElements[0].focus();
      } else if (modalRef.current) {
        modalRef.current.focus();
      }
    }, 50);

    // Add event listeners for focus trap and escape
    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);

    return () => {
      clearTimeout(focusTimer);

      // Restore body scroll
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;

      // Remove event listeners
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, handleTabKey, handleEscapeKey, getFocusableElements, initialFocusRef, returnFocusRef]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
            onClick={!preventCloseOnOutsideClick ? onClose : undefined}
          />

          {/* Modal Content */}
          <motion.div
            ref={modalRef}
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 10 }}
            transition={isMobile
              ? { type: 'spring', damping: 25, stiffness: 300 }
              : { duration: 0.2, type: 'spring', stiffness: 300, damping: 30 }
            }
            className={`
              relative w-full flex flex-col
              bg-[#10141d]/90 backdrop-blur-xl
              border border-white/10
              shadow-[0_20px_50px_rgba(0,0,0,0.5)]
              rounded-none md:rounded-xl overflow-hidden
              ${isMobile ? 'h-full' : ''}
          ${sizeClasses[size]}
          ${className}
            `}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                <div
                  id="modal-title"
                  className="text-lg font-display font-bold tracking-wider text-content-primary flex items-center gap-3"
                >
                  {title && (
                    <>
                      <div className="w-1 h-4 bg-accent-gold shadow-[0_0_8px_rgba(251,191,36,0.5)] rounded-full" />
                      <span className="drop-shadow-sm">{title}</span>
                    </>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="
                      p-2 rounded-full
                      text-content-muted hover:text-content-primary
                      hover:bg-white/10
                      transition-all duration-200
                      group
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#10141d]
                    "
                    aria-label="Close modal"
                  >
                    <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

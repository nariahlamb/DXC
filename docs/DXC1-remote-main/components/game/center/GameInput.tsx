import React, { useState, useEffect, useMemo } from 'react';
import { Command, X, RotateCcw, Loader2, Square, ArrowUp } from 'lucide-react';
import { CombatState } from '../../../types';
import { getProcessingStageLabel, resolveProcessingStage } from '../../../utils/ui/processingStage';

interface GameInputProps {
  onSendMessage: (msg: string) => void;
  onReroll?: () => void;
  onStopInteraction?: () => void;
  isProcessing: boolean;
  isStreaming?: boolean;
  isPhoneProcessing?: boolean;
  combatState: CombatState;
  commandQueue: { id: string, text: string, undoAction?: () => void }[];
  onRemoveCommand?: (id: string) => void;
  draftInput?: string;
  setDraftInput?: (val: string) => void;
  primaryActionHint?: string;
  enableCombatUI?: boolean;
  isHellMode?: boolean;
}

export const GameInput: React.FC<GameInputProps> = ({
    onSendMessage,
    onReroll,
    onStopInteraction,
    isProcessing,
    isStreaming = false,
    isPhoneProcessing = false,
    combatState,
    commandQueue,
    onRemoveCommand,
    draftInput,
    setDraftInput,
    primaryActionHint,
    enableCombatUI,
    isHellMode
}) => {
    const [input, setInput] = useState('');
    const [keyboardInset, setKeyboardInset] = useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Detect touch capability once on mount
    const isTouchDevice = useMemo(() => {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }, []);

    useEffect(() => {
        if (draftInput !== undefined) {
            setInput(draftInput);
        }
    }, [draftInput]);

    // Auto-focus logic: avoid on touch devices to prevent keyboard popup
    useEffect(() => {
        const tryFocus = () => {
            if (!isTouchDevice && !isProcessing) {
                inputRef.current?.focus();
            }
        };

        tryFocus();

        // Re-evaluate focus on resize/orientation change
        window.addEventListener('resize', tryFocus);
        return () => window.removeEventListener('resize', tryFocus);
    }, [isTouchDevice, isProcessing]);

    // Mobile keyboard avoidance: offset input area when IME overlays viewport
    useEffect(() => {
        if (!isTouchDevice) return;
        const viewport = window.visualViewport;
        if (!viewport) return;

        let rafId: number | null = null;

        const updateInset = () => {
            if (rafId !== null) window.cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(() => {
                const layoutHeight = window.innerHeight;
                const visualBottom = viewport.height + viewport.offsetTop;
                const nextInset = Math.max(0, Math.round(layoutHeight - visualBottom));
                setKeyboardInset(prev => (Math.abs(prev - nextInset) < 2 ? prev : nextInset));
            });
        };

        const handleFocusOut = () => {
            window.setTimeout(updateInset, 120);
        };

        updateInset();
        viewport.addEventListener('resize', updateInset);
        viewport.addEventListener('scroll', updateInset);
        window.addEventListener('orientationchange', updateInset);
        document.addEventListener('focusin', updateInset);
        document.addEventListener('focusout', handleFocusOut);

        return () => {
            if (rafId !== null) window.cancelAnimationFrame(rafId);
            viewport.removeEventListener('resize', updateInset);
            viewport.removeEventListener('scroll', updateInset);
            window.removeEventListener('orientationchange', updateInset);
            document.removeEventListener('focusin', updateInset);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, [isTouchDevice]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
        if (setDraftInput) setDraftInput(e.target.value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isProcessing) return;
        const hasCommands = commandQueue.length > 0;
        if (!input.trim() && !hasCommands) return;
        const safeInput = input.trim() ? input : '执行用户指令';
        onSendMessage(safeInput);
        setInput('');
        if (setDraftInput) setDraftInput('');
        
        // Keep focus on non-touch devices after submit
        if (!isTouchDevice) {
             inputRef.current?.focus();
        }
    };

    const handleStop = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onStopInteraction) onStopInteraction();
    };

    const processingStageLabel = getProcessingStageLabel(resolveProcessingStage({
        isProcessing,
        isStreaming,
        isPhoneProcessing
    }));

    const inputPlaceholder = isProcessing
        ? (processingStageLabel || '处理中...')
        : combatState.是否战斗中
            ? (enableCombatUI ? "战斗中 | 输入文字进行自由行动..." : "战斗模式 | 请输入指令...")
            : "你打算做什么？";

    return (
        <div
            className="p-4 md:p-6 z-20 pt-4 backdrop-blur-md bg-black/30 pb-safe"
            style={{
                paddingBottom: `calc(env(safe-area-inset-bottom) + ${keyboardInset}px)`
            }}
        >
            <div className="pb-4"></div> {/* Spacer for bottom safe area */}

            {primaryActionHint && (
                <div className="mb-2 max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 text-cyan-100 text-[10px] uppercase tracking-widest">
                        <span className="font-semibold">主行动预填</span>
                        <span className="font-mono normal-case tracking-normal">{primaryActionHint}</span>
                    </div>
                </div>
            )}

            {commandQueue.length > 0 && (
                <div className="mb-3 animate-in slide-in-from-bottom-2 max-w-4xl mx-auto">
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 uppercase tracking-widest mb-2">
                        <Command size={10} />
                        用户指令
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {commandQueue.map(cmd => (
                            <div key={cmd.id} className="bg-white/5 border border-white/10 text-amber-200 text-xs px-2 py-1 flex items-center gap-2 rounded-full">
                                <span>{cmd.text}</span>
                                <button
                                    type="button"
                                    onClick={() => onRemoveCommand?.(cmd.id)}
                                    className="hover:text-white"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="relative group max-w-4xl mx-auto flex items-center gap-2 md:gap-4">
                {onReroll && (
                    <button
                        type="button"
                        onClick={!isProcessing ? onReroll : undefined}
                        disabled={isProcessing}
                        title="重掷"
                        className={`w-10 h-10 md:w-12 md:h-12 shrink-0 flex items-center justify-center rounded-full transition-all duration-300
                            ${isProcessing
                                ? 'text-zinc-600 cursor-not-allowed'
                                : 'text-zinc-400 hover:text-white active:scale-95'
                            }
                            ${isTouchDevice
                                ? 'bg-transparent border-none shadow-none'
                                : 'backdrop-blur-md bg-white/5 hover:bg-white/10 border border-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                            }
                        `}
                    >
                        <RotateCcw size={20} className={isProcessing ? 'animate-spin' : ''} />
                    </button>
                )}

                <div className="flex-1 relative min-w-0">
                    <div className="flex justify-end mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 right-0">
                        {isProcessing && (
                            <span className="text-[10px] text-zinc-400 animate-pulse font-mono tracking-widest">
                                {processingStageLabel ? `${processingStageLabel}...` : 'AI GENERATING...'}
                            </span>
                        )}
                    </div>

                    <div className={`
                        relative flex items-center
                        input-hud-glass rounded-full px-4 py-3 md:px-6 md:py-4
                        transition-all duration-300
                        group-focus-within:ring-2 group-focus-within:ring-hestia-blue-500/30
                    `}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={handleInputChange}
                            placeholder={inputPlaceholder}
                            disabled={isProcessing}
                            className="flex-1 bg-transparent text-slate-100 text-sm md:text-base outline-none placeholder:text-slate-500 disabled:cursor-not-allowed font-ui tracking-wide"
                        />

                        {/* Glow Indicator when typing */}
                        {input && !isProcessing && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400/70 shadow-[0_0_8px_rgba(56,189,248,0.4)] animate-pulse" />
                        )}
                    </div>
                </div>

                <button
                    type={isProcessing ? "button" : "submit"}
                    onClick={isProcessing ? handleStop : undefined}
                    disabled={!input.trim() && !isProcessing && commandQueue.length === 0}
                    className={`w-11 h-11 md:w-14 md:h-14 shrink-0 flex items-center justify-center rounded-full transition-all duration-300 shadow-lg backdrop-blur-md
                        ${isProcessing
                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 animate-pulse'
                            : 'bg-gradient-to-br from-[var(--color-hestia-blue-base)] to-blue-600 hover:brightness-110 text-white border border-white/10 hover:shadow-[0_0_15px_rgba(56,189,248,0.2)] disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:border-slate-700'
                        }
                    `}
                >
                    {isProcessing ? (
                        <Square size={20} fill="currentColor" />
                    ) : (
                        <ArrowUp size={20} strokeWidth={2.5} className="md:w-6 md:h-6" />
                    )}
                </button>
            </form>
        </div>
    );
};

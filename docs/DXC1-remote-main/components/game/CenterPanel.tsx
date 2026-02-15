
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { compressImage } from '../../utils/imageCompression';
import { LogEntry, CombatState, CharacterStats, Skill, MagicSpell, InventoryItem, Confidant, ActionOption, Task, ReadabilitySettings } from '../../types';
import { DicePool, EncounterRow, LogSummary, LogOutline, TavernActionOption } from '../../types/extended';
import { MessageSquare, Sword, Eye, Loader2, ChevronRight, MousePointer2, Terminal, Layers, ChevronUp, Info, Search, Grid } from 'lucide-react';
import { CombatPanel } from './CombatPanel';
import { LogEntryItem } from './center/LogEntry';
import { GameInput } from './center/GameInput';
import { EditLogModal } from './center/EditLogModal';
import { collectTaskRelatedLogs } from '../../utils/ui/logTaskLinking';
import { usePerformanceMode } from '../../hooks/usePerformanceMode';
import { getProcessingStageLabel, resolveProcessingStage } from '../../utils/ui/processingStage';

interface CenterPanelProps {
  logs: LogEntry[];
  combatState: CombatState;
  playerStats: CharacterStats;
  skills: Skill[];
  magic: MagicSpell[];
  inventory?: InventoryItem[];
  confidants: Confidant[];
  onSendMessage: (msg: string) => void;
  onReroll?: () => void;
  lastRawResponse?: string;
  lastThinking?: string;
  onPlayerAction: (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => void;
  isProcessing?: boolean;
  isStreaming?: boolean;
  isPhoneProcessing?: boolean;
  commandQueue?: { id: string, text: string, undoAction?: () => void }[];
  onRemoveCommand?: (id: string) => void;
  
  onEditLog?: (logId: string, newRawResponse: string) => void;
  onDeleteLog?: (logId: string) => void;
  onEditUserLog?: (logId: string, newText: string) => void;
  onUpdateLogText?: (logId: string, newText: string) => void;
  onStopInteraction?: () => void;
  handleUserRewrite?: (logId: string, newText: string) => void; 
  draftInput?: string;
  setDraftInput?: (val: string) => void;

  actionOptions?: (ActionOption | TavernActionOption)[];
  onActionOptionSelect?: (text: string) => void;
  dicePool?: DicePool;
  encounters?: EncounterRow[];
  logSummaries?: LogSummary[];
  logOutlines?: LogOutline[];
  tasks?: Task[];
  selectedTaskId?: string | null;
  onTaskFocus?: (taskId: string | null) => void;
  fontSize?: 'small' | 'medium' | 'large';
  readability?: ReadabilitySettings;
  chatLogLimit?: number | null;
  className?: string;
  enableCombatUI?: boolean;
  enableActionLoop?: boolean;
  isHellMode?: boolean;
  onUpdatePlayerAvatar?: (url: string) => void;
  onUpdateNpcAvatar?: (name: string, url: string) => void;
}

export const CenterPanel: React.FC<CenterPanelProps> = ({ 
    logs, 
    combatState,
    playerStats,
    skills,
    magic,
    inventory,
    confidants = [],
    onSendMessage, 
    onReroll, 
    onPlayerAction,
    isProcessing,
    isStreaming,
    isPhoneProcessing,
    lastRawResponse,
    lastThinking,
    commandQueue = [],
    onRemoveCommand,
    
    onEditLog,
    onDeleteLog,
    onEditUserLog,
    onUpdateLogText,
    onStopInteraction,
    handleUserRewrite,
    draftInput,
    setDraftInput,

    actionOptions = [],
    onActionOptionSelect,
    dicePool,
    encounters,
    logSummaries,
    logOutlines,
    tasks = [],
    selectedTaskId = null,
    onTaskFocus,
    fontSize = 'medium',
    readability = { lineHeight: 'normal', contrastMode: 'default', infoDensity: 'balanced' },

    chatLogLimit = 10,
    className = '',
    enableCombatUI = true,
    enableActionLoop = true,
    isHellMode,
    onUpdatePlayerAvatar,
    onUpdateNpcAvatar
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: 'PLAYER' | 'NPC', name?: string } | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  const handleAvatarClick = (target: { type: 'PLAYER' | 'NPC', name?: string }) => {
      setUploadTarget(target);
      if (fileInputRef.current) {
          fileInputRef.current.value = ''; // Reset
          fileInputRef.current.click();
      }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !uploadTarget) return;

      setIsAvatarUploading(true);
      try {
          const compressed = await compressImage(file, 256, 0.8);
          console.log('[AvatarUpload] Compressed size:', compressed.length);
          
          if (uploadTarget.type === 'PLAYER' && onUpdatePlayerAvatar) {
              onUpdatePlayerAvatar(compressed);
          } else if (uploadTarget.type === 'NPC' && uploadTarget.name && onUpdateNpcAvatar) {
              onUpdateNpcAvatar(uploadTarget.name, compressed);
          }
      } catch (err) {
          console.error('Failed to compress avatar:', err);
      } finally {
          setIsAvatarUploading(false);
          setUploadTarget(null);
          // Reset input again just in case
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };
  const [showCombatUI, setShowCombatUI] = useState(false); 
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editMode, setEditMode] = useState<'AI_RAW' | 'USER_TEXT'>('AI_RAW');
  const [jumpTarget, setJumpTarget] = useState('');
  const [jumpHint, setJumpHint] = useState('');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [showCurrentTurnOnly, setShowCurrentTurnOnly] = useState(false);
  const [selectedPrimaryAction, setSelectedPrimaryAction] = useState('');
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(selectedTaskId);
  const jumpHideTimer = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [viewStartIdx, setViewStartIdx] = useState<number | null>(null);
  const { motionLevel } = usePerformanceMode();
  const reduceMotion = motionLevel === 'minimal';
  
  // Refs for scrolling
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const safeScrollIntoView = (el: Element | null | undefined, options?: ScrollIntoViewOptions) => {
      if (!el || typeof (el as any).scrollIntoView !== 'function') return;
      (el as any).scrollIntoView(options);
  };
  
  const prevProcessing = useRef(isProcessing);
  const prevLogsLength = useRef(logs.length);
  const lastStreamScrollAtRef = useRef(0);

  // Theme constants
  const halftoneColor = 'bg-transparent';
  const textColor = 'text-slate-300';
  const processingText = 'text-cyan-400';
  const turnDividerColor = 'border-slate-700 text-slate-500';
  const turnDividerGradient = 'from-transparent to-slate-800';
  const actionBorder = 'border-slate-600/50';
  const actionIcon = 'text-cyan-500';
  const actionChevron = 'text-slate-600';
  const actionBgHighlight = 'bg-cyan-500/10';
  const marqueeTextClass = 'text-slate-200';
  const marqueeDuplicateClass = 'text-slate-200/50';
  const hasResolutionEvents = !!(combatState.判定事件 && combatState.判定事件.length > 0);
  const hasActionEconomy = !!(combatState.行动经济?.资源 && combatState.行动经济.资源.length > 0);
  const hasBattleMapPreview = !!(combatState.视觉 || (combatState.地图 && combatState.地图.length > 0));
  const hasCombatSignals = hasResolutionEvents || hasActionEconomy || hasBattleMapPreview;
  const showCombatShortcut = enableCombatUI && !isProcessing && (combatState.是否战斗中 || hasCombatSignals);
  const structuredOptions = actionOptions.filter(opt => typeof opt !== 'string') as TavernActionOption[];
  const quickActionStrings = actionOptions
      .map(opt => (typeof opt === 'string' ? opt : opt.名称))
      .filter((opt): opt is string => typeof opt === 'string' && opt.trim().length > 0);
  const primaryQuickActions = quickActionStrings.slice(0, 5);
  const secondaryQuickActions = quickActionStrings.slice(5);
  const showQuickActions = !isProcessing && !combatState.是否战斗中 && quickActionStrings.length > 0;
  const hasCommandQueue = commandQueue.length > 0;
  const hasMetaPanels = !!(dicePool?.length || encounters?.length || logSummaries?.length || logOutlines?.length || structuredOptions.length || hasResolutionEvents || hasActionEconomy || hasBattleMapPreview);
  // UX preference: hide the floating "battle intel" block above input.
  const showBattleIntelPanel = false;
  const processingStage = resolveProcessingStage({
      isProcessing: !!isProcessing,
      isStreaming: !!isStreaming,
      isPhoneProcessing: !!isPhoneProcessing
  });
  const processingStageLabel = getProcessingStageLabel(processingStage);
  const hasDndProfile = !!(playerStats.DND档案 || playerStats.dndProfile);
  const latestResolutionEvent = hasResolutionEvents && combatState.判定事件
      ? combatState.判定事件[combatState.判定事件.length - 1]
      : undefined;
  const actionEconomyCurrent = hasActionEconomy && combatState.行动经济
      ? combatState.行动经济.资源.find(row => row.单位ID === (combatState.行动经济?.当前行动者 || combatState.current_actor))
      : undefined;
  const renderCost = (opt: TavernActionOption) => {
      const cost = opt.消耗;
      if (!cost) return opt.类型 || '';
      const parts = [] as string[];
      if (cost.体力) parts.push(`体力${cost.体力}`);
      if (cost.精神) parts.push(`精神${cost.精神}`);
      if (cost.法利) parts.push(`法利${cost.法利}`);
      if (cost.物品) parts.push(`物品:${cost.物品}`);
      return [opt.类型, parts.join(' / ')].filter(Boolean).join(' · ');
  };
  const handleActionOptionSelect = (text: string) => {
      const normalized = String(text || '').trim();
      if (!normalized) return;
      if (combatState.是否战斗中 || showCombatUI) {
          if (onActionOptionSelect) {
              onActionOptionSelect(normalized);
              return;
          }
          if (isProcessing) return;
          if (setDraftInput) {
              setDraftInput(normalized);
          }
          onPlayerAction('talk', normalized);
          setShowCombatUI(false);
          return;
      }
      if (setDraftInput) {
          setDraftInput(normalized);
          return;
      }
      if (onActionOptionSelect) {
          onActionOptionSelect(normalized);
      }
  };
  const handlePrimaryActionSelect = (text: string) => {
      const normalized = String(text || '').trim();
      if (!normalized) return;
      setSelectedPrimaryAction(normalized);
      handleActionOptionSelect(normalized);
  };
  const handleSendPrimaryAction = () => {
      const normalized = String(selectedPrimaryAction || '').trim();
      if (!normalized || isProcessing) return;
      onSendMessage(normalized);
      setSelectedPrimaryAction('');
      if (setDraftInput) setDraftInput('');
  };
  const logPaddingClass = (showQuickActions || showCombatShortcut || showBattleIntelPanel)
      ? (hasCommandQueue ? 'pb-24 md:pb-52' : 'pb-16 md:pb-40')
      : (hasCommandQueue ? 'pb-20 md:pb-32' : 'pb-6 md:pb-16');
  const actionDockOffset = hasCommandQueue ? 'bottom-[8rem] md:bottom-[130px]' : 'bottom-[4.5rem] md:bottom-[80px]';
  const readabilityPaddingClass = readability.infoDensity === 'compact'
      ? 'p-3 md:p-8'
      : readability.infoDensity === 'comfortable'
          ? 'p-5 md:p-14'
          : 'p-4 md:p-12';
  const readabilityContrastClass = readability.contrastMode === 'high'
      ? 'text-slate-100'
      : 'text-slate-200';
  const turnIndices = logs
      .map(l => (typeof l.turnIndex === 'number' ? l.turnIndex : null))
      .filter((t): t is number => t !== null);
  const currentTurn = turnIndices.length > 0 ? Math.max(...turnIndices) : 0;
  const uniqueTurns = Array.from(new Set(turnIndices)).sort((a: number, b: number) => a - b);
  const playableTurns = uniqueTurns.filter((t: number) => t > 0);
  const orderedTurns = playableTurns.length > 0 ? playableTurns : uniqueTurns;
  const totalTurns = orderedTurns.length;
  const limit = chatLogLimit === null ? null : (typeof chatLogLimit === 'number' ? chatLogLimit : 10);
  
  // Calculate window
  const effectiveStartIdx = viewStartIdx !== null 
      ? Math.max(0, Math.min(viewStartIdx, totalTurns - 1)) 
      : (limit ? Math.max(0, totalTurns - limit) : 0);
      
  const effectiveEndIdx = viewStartIdx !== null
      ? Math.min(totalTurns, effectiveStartIdx + (limit || 10))
      : totalTurns;

  const visibleTurns = orderedTurns.slice(effectiveStartIdx, effectiveEndIdx);
  const visibleTurnSet = new Set(visibleTurns);
  
  const visibleLogs = logs.filter(l => {
      const t = typeof l.turnIndex === 'number' ? l.turnIndex : null;
      if (t === null) return limit === null;
      if (t === 0) return true;
      return visibleTurnSet.has(t);
  });
  const normalizedQuery = filterQuery.trim().toLowerCase();
  const filteredLogs = visibleLogs.filter(log => {
      if (!normalizedQuery) return true;
      const senderMatch = (log.sender || '').toLowerCase().includes(normalizedQuery);
      const textMatch = (log.text || '').toLowerCase().includes(normalizedQuery);
      return senderMatch || textMatch;
  });
  const isKeyLog = (log: LogEntry) => {
      const tags = Array.isArray((log as any)?.tags) ? (log as any).tags : [];
      const tagHit = tags.some((t: any) => String(t || '').includes('key') || String(t || '').includes('关键'));
      if (tagHit) return true;
      const text = String(log?.text || '');
      return text.includes('【判定】') || text.includes('好感度') || text.includes('关键');
  };
  const renderedLogs = showCurrentTurnOnly
      ? filteredLogs.filter(l => {
            const t = typeof l.turnIndex === 'number' ? l.turnIndex : null;
            if (t === null) return false;
            if (t === 0) return true;
            return t === currentTurn;
        })
      : filteredLogs;
  const sortedTasks = tasks.slice().sort((a, b) => {
      const score = (task: Task) => task.状态 === 'active' ? 0 : task.状态 === 'completed' ? 1 : 2;
      return score(a) - score(b);
  });
  const focusedTask = sortedTasks.find((task) => task.id === focusedTaskId) || null;
  const relatedTaskLogs = collectTaskRelatedLogs(focusedTask, logs).slice(-6);
  const aiActionSeen = new Set<string>();
  const logIndexMap = new Map<string, number>();
  logs.forEach((log, idx) => logIndexMap.set(log.id, idx));
  const turnThinkingMap = new Map<number, string>();
  logs.forEach((log) => {
      if (typeof log.turnIndex === 'number' && log.thinking && !turnThinkingMap.has(log.turnIndex)) {
          turnThinkingMap.set(log.turnIndex, log.thinking);
      }
  });

  const handleJump = () => {
      const target = parseInt(jumpTarget, 10);
      const maxTurn = totalTurns > 0 ? (orderedTurns[orderedTurns.length - 1] as number) : 0;
      const minTurn = totalTurns > 0 ? (orderedTurns[0] as number) : 0;
      
      if (Number.isNaN(target) || target < minTurn || target > maxTurn) {
          setJumpHint(`范围: ${minTurn}-${maxTurn || minTurn}`);
          return;
      }
      
      const idx = orderedTurns.indexOf(target);
      if (idx !== -1) {
          setViewStartIdx(idx);
          setJumpHint(`已请求跳转: ${target}`);
      } else {
          setJumpHint('未找到目标楼层');
      }
  };

  const scrollToLatest = () => {
      setViewStartIdx(null);
      setTimeout(() => safeScrollIntoView(endRef.current, { behavior: 'smooth' }), 100);
  };
  const jumpToLatestKeyLog = () => {
      const pool = showCurrentTurnOnly
          ? logs.filter(l => (typeof l.turnIndex === 'number' ? l.turnIndex : 0) === currentTurn || l.turnIndex === 0)
          : logs;
      const candidates = pool.filter(isKeyLog);
      const last = candidates.length > 0 ? candidates[candidates.length - 1] : null;
      if (!last) {
          setJumpHint('未找到关键日志');
          return;
      }
      const el = logRefs.current.get(last.id);
      if (el) {
          safeScrollIntoView(el, { behavior: 'smooth', block: 'start' });
          setJumpHint('已定位关键日志');
          return;
      }
      setJumpHint('关键日志尚未渲染');
  };

  // Scroll to suitable position when view changes
  useEffect(() => {
      if (viewStartIdx !== null) {
          // When jumping to a specific history window, scroll to top to see the start of that window
          containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
  }, [viewStartIdx]);

  // Scroll Logic
  useLayoutEffect(() => {
      if (prevLogsLength.current === 0 && logs.length > 0) {
          safeScrollIntoView(endRef.current, { behavior: 'auto' });
      }
  }, []);

  useEffect(() => {
      const isNearBottom = () => {
          const container = containerRef.current;
          if (!container) return true;
          const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
          return distance <= 140;
      };

      if (prevProcessing.current === true && isProcessing === false) {
          if (logs.length > 0) {
              const lastLog = logs[logs.length - 1];
              const lastLogElement = logRefs.current.get(lastLog.id);
              if (lastLogElement) {
                  safeScrollIntoView(lastLogElement, { behavior: 'smooth', block: 'start' });
              } else {
                  safeScrollIntoView(endRef.current, { behavior: 'smooth' });
              }
          }
      }
      else if (isStreaming) {
           const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
               ? performance.now()
               : Date.now();
           if (now - lastStreamScrollAtRef.current >= 180 && isNearBottom()) {
               safeScrollIntoView(endRef.current, { behavior: 'auto', block: 'end' });
               lastStreamScrollAtRef.current = now;
           }
      }

      prevProcessing.current = !!isProcessing;
      prevLogsLength.current = logs.length;
      setJumpHint('');
  }, [isProcessing, isStreaming, logs, lastRawResponse]); 

  useEffect(() => {
      if (isToolsOpen && searchInputRef.current) {
          searchInputRef.current.focus();
      }

      const handleClickOutside = (event: MouseEvent) => {
          if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
              setIsToolsOpen(false);
          }
      };

      if (isToolsOpen) {
          document.addEventListener('mousedown', handleClickOutside);
      }
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [isToolsOpen]);

  useEffect(() => {
      setFocusedTaskId(selectedTaskId ?? null);
  }, [selectedTaskId]);

  // Fix: Scroll to bottom when exiting combat UI
  useEffect(() => {
      if (!showCombatUI && logs.length > 0) {
          setTimeout(() => {
              safeScrollIntoView(endRef.current, { behavior: 'smooth' });
          }, 50);
      }
  }, [showCombatUI]);

  useEffect(() => {
      if (!enableCombatUI && showCombatUI) {
          setShowCombatUI(false);
      }
  }, [enableCombatUI, showCombatUI]);

  // Fix: Scroll to bottom when visual viewport resizes (e.g. mobile keyboard opens)
  useEffect(() => {
      const viewport = window.visualViewport;
      if (!viewport) return;

      const handleResize = () => {
          // Scroll to bottom when viewport changes (keyboard toggle)
          setTimeout(() => {
              safeScrollIntoView(endRef.current, { behavior: 'smooth' });
          }, 100);
      };

      viewport.addEventListener('resize', handleResize);
      return () => viewport.removeEventListener('resize', handleResize);
  }, []);

  const handleEditAIClick = (log: LogEntry) => {
      if (log.rawResponse) {
          setEditingLogId(log.id);
          setEditContent(log.rawResponse);
          setEditMode('AI_RAW');
      }
  };

  const handleEditUserClick = (logId: string) => {
      const log = logs.find(l => l.id === logId);
      if (log) {
          setEditingLogId(logId);
          setEditContent(log.text);
          setEditMode('USER_TEXT');
      }
  };

  const handleApplyEdit = (content: string, type: 'REWRITE' | 'TEXT_ONLY') => {
      if (editingLogId) {
          if (editMode === 'AI_RAW' && onEditLog) {
              onEditLog(editingLogId, content);
          } else if (editMode === 'USER_TEXT') {
              if (type === 'REWRITE' && handleUserRewrite) {
                  handleUserRewrite(editingLogId, content);
              } else if (type === 'TEXT_ONLY' && onUpdateLogText) {
                  onUpdateLogText(editingLogId, content);
              }
          }
          setEditingLogId(null);
      }
  };

  const setLogRef = (id: string, el: HTMLDivElement | null) => {
      if (el) {
          logRefs.current.set(id, el);
      } else {
          logRefs.current.delete(id);
      }
  };

  const TurnDivider = ({ turn }: { turn?: number }) => {
      if (turn === undefined || turn === 0) return null;
      return (
          <div className="w-full flex items-center justify-center py-6 mb-4 opacity-70">
              <div className={`h-px w-12 md:w-32 bg-gradient-to-r ${turnDividerGradient}`}></div>
              <div className={`mx-4 px-2 py-0.5 text-[10px] font-mono tracking-[0.3em] uppercase text-slate-500 border border-slate-800/50 bg-slate-900/50 rounded-full`}>
                   Turn {turn}
              </div>
              <div className={`h-px w-12 md:w-32 bg-gradient-to-l ${turnDividerGradient}`}></div>
          </div>
      );
  };
  const TurnThinking = ({ thinking }: { thinking?: string }) => {
      if (!thinking) return null;
      return (
          <div className="flex justify-center -mt-2 mb-6">
              <details className="max-w-[90%] bg-emerald-950/40 border border-emerald-700/60 px-3 py-2 rounded">
                  <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-emerald-300 flex items-center gap-2">
                      <Info size={12} className="text-emerald-400" /> 思考过程
                  </summary>
                  <div className="mt-2 text-[11px] text-emerald-100 font-mono whitespace-pre-wrap leading-relaxed">
                      {thinking}
                  </div>
              </details>
          </div>
      );
  };

  // Horizontal scroll for action options
  const actionScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
      const el = actionScrollRef.current;
      if (!el) return;
      const handleWheel = (e: WheelEvent) => {
          if (e.deltaY !== 0) {
              e.preventDefault();
              el.scrollLeft += e.deltaY;
          }
      };
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
  }, [showQuickActions]);

  if (showCombatUI && enableCombatUI) {
      return (
          <div className={`w-full lg:w-[60%] h-full relative flex flex-col bg-iron-900/90 md:border-r md:border-bronze-800/40 ${className}`}>
              <div className="absolute top-4 right-4 z-50">
                  <button
                    type="button"
                    onClick={() => setShowCombatUI(false)}
                    className="bg-dungeon-black/80 text-hestia-blue-100 border border-hestia-blue-500/30 px-3 py-1 text-xs uppercase hover:bg-hestia-blue-900/20 hover:text-hestia-blue-100 flex items-center gap-2 backdrop-blur-sm shadow-lg"
                  >
                      <MessageSquare size={14} /> <span className="hidden md:inline">返回剧情</span> <span className="md:hidden">返回</span>
                  </button>
              </div>

              <CombatPanel
                  combatState={combatState}
                  playerStats={playerStats}
                  skills={skills}
                  magic={magic}
                  inventory={inventory || []}
                  confidants={confidants}
                  dicePool={dicePool}
                  actionOptions={actionOptions}
                  encounters={encounters}
                  logSummaries={logSummaries}
                  logOutlines={logOutlines}
                  onActionOptionSelect={handleActionOptionSelect}
                  onPlayerAction={(action, payload) => {
                      onPlayerAction(action, payload);
                      setShowCombatUI(false);
                  }}
              />
          </div>
      );
  }

  return (
    <div className={`w-full lg:flex-1 lg:min-w-[520px] h-full relative flex flex-col overflow-hidden ${className}`}>

      {/* Background Ambience - Hestia Blue Theme */}
      {/* Removed opaque bg-dungeon-black mask to allow custom background to show */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-black/40" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-hestia-blue-950/20 via-transparent to-dungeon-black/80" />

      {/* Magic Circle Overlay - Static (Subtler) */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.02] flex items-center justify-center overflow-hidden mix-blend-screen">
        <div className={`w-[800px] h-[800px] rounded-full border-[1px] border-hestia-blue-500/20 flex items-center justify-center ${reduceMotion ? '' : 'animate-spin-slow'}`} style={{ boxShadow: '0 0 150px rgba(56,189,248,0.05)' }}>
            <div className="w-[600px] h-[600px] border border-hestia-blue-500/10 rotate-45" />
            <div className="absolute w-[500px] h-[500px] border border-hestia-blue-500/10 rounded-full" />
            <div className="absolute w-[300px] h-[300px] border-2 border-hestia-blue-500/5 rotate-12" />
        </div>
      </div>

      {hasDndProfile && (
          <div className="absolute top-4 left-4 z-30 bg-cyan-950/40 border border-cyan-700/40 rounded-sm px-3 py-1.5 text-[10px] tracking-wide text-cyan-100">
              DND6 引擎已加载 · STR/DEX/CON/INT/WIS/CHA
          </div>
      )}

      {isProcessing && !isStreaming && (
          <div className="absolute inset-0 z-50 bg-iron-900/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
              <div className={`flex flex-col items-center gap-4 ${processingText}`}>
                  <div className="relative">
                      <Loader2 size={48} className={reduceMotion ? '' : 'animate-spin'} />
                      <div className="absolute inset-0 flex items-center justify-center">
                          <Eye size={18} className={reduceMotion ? '' : 'animate-pulse'} />
                      </div>
                  </div>
                  <span className={`font-display text-xl uppercase tracking-widest ${reduceMotion ? '' : 'animate-pulse'}`}>
                      {processingStageLabel || '处理中...'}
                  </span>
              </div>
          </div>
      )}

      {isAvatarUploading && (
          <div className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
              <div className="flex flex-col items-center gap-4 text-emerald-400">
                  <Loader2 size={32} className="animate-spin" />
                  <span className="font-display tracking-widest animate-pulse">正在处理头像...</span>
              </div>
          </div>
      )}

      {/* Floating Tools Button */}
      <div
        ref={toolsRef}
        className={`absolute top-4 right-4 z-40 flex flex-col items-end transition-all duration-300 ${isToolsOpen ? 'z-50' : 'z-40'}`}
      >
          <button
            onClick={() => setIsToolsOpen(!isToolsOpen)}
            className={`
                w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.2)] transition-all duration-300
                border border-white/10 backdrop-blur-md hover:brightness-110
                ${isToolsOpen ? 'bg-hestia-blue-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]' : 'bg-black/40 hover:bg-hestia-blue-900/30 text-hestia-blue-100'}
            `}
            title="更多操作"
          >
              {isToolsOpen ? <ChevronRight size={22} /> : <Grid size={20} />}
          </button>

          {/* Expanded Menu */}
          <div className={`
                mt-4 bg-dungeon-black/95 backdrop-blur-xl border border-hestia-blue-500/20 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden
                flex flex-col gap-0 min-w-[260px] origin-top-right transition-all duration-300
                ${isToolsOpen
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-95 -translate-y-4 pointer-events-none h-0'}
          `}>
                {/* Search Row */}
                <div className="p-3 border-b border-white/5 flex items-center gap-3 bg-white/5">
                    <Search size={16} className="text-hestia-blue-400 shrink-0" />
                    <input
                        ref={searchInputRef}
                        value={filterQuery}
                        onChange={(e) => setFilterQuery(e.target.value)}
                        placeholder="搜索记录..."
                        className="bg-transparent text-hestia-blue-50 text-xs outline-none w-full placeholder:text-slate-500 font-ui tracking-wide"
                    />
                </div>

                {/* Jump Row */}
                {totalTurns > 0 && (
                    <div className="p-3 border-b border-white/5 flex items-center justify-between gap-2">
                         <div className="flex items-center gap-2 text-slate-400 text-xs">
                            <Layers size={14} className="text-hestia-blue-500" />
                            <span className="font-mono text-[10px] opacity-70">
                                {visibleTurns[0]}-{visibleTurns[visibleTurns.length - 1]}/{totalTurns}
                            </span>
                         </div>
                         <div className="flex items-center gap-1 bg-black/40 rounded px-1 border border-white/5 focus-within:border-hestia-blue-500/50 transition-colors">
                            <input
                                type="number"
                                value={jumpTarget}
                                onChange={(e) => setJumpTarget(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJump()}
                                className="w-12 bg-transparent text-hestia-blue-100 text-center text-xs outline-none focus:text-hestia-blue-400 font-mono py-1"
                                placeholder="#"
                            />
                            <button
                                onClick={handleJump}
                                className="text-slate-500 hover:text-hestia-blue-400 p-1 transition-colors"
                            >
                                <ChevronRight size={12} />
                            </button>
                         </div>
                    </div>
                )}

                {/* Actions Row */}
                <button
                    onClick={() => {
                        scrollToLatest();
                        setIsToolsOpen(false);
                    }}
                    className="p-3 flex items-center gap-3 text-xs text-slate-300 hover:text-white hover:bg-hestia-blue-900/20 transition-colors text-left w-full"
                >
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-hestia-blue-400">
                        <ChevronUp size={14} className="rotate-180" />
                    </div>
                    <span className="font-display tracking-wide">回到最新消息</span>
                </button>

                {/* Readability Controls */}
                {totalTurns > 0 && (
                    <div className="border-t border-white/5">
                        <button
                            type="button"
                            onClick={() => setShowCurrentTurnOnly((v) => !v)}
                            className="p-3 flex items-center gap-3 text-xs text-slate-300 hover:text-white hover:bg-hestia-blue-900/20 transition-colors text-left w-full"
                        >
                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-hestia-blue-400">
                                <Layers size={14} />
                            </div>
                            <span className="font-display tracking-wide">仅看当前回合</span>
                        </button>
                        {showCurrentTurnOnly && (
                            <button
                                type="button"
                                onClick={jumpToLatestKeyLog}
                                className="p-3 flex items-center gap-3 text-xs text-slate-300 hover:text-white hover:bg-hestia-blue-900/20 transition-colors text-left w-full"
                            >
                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-amber-400">
                                    <Info size={14} />
                                </div>
                                <span className="font-display tracking-wide">跳到最新关键日志</span>
                            </button>
                        )}
                    </div>
                )}
          </div>
      </div>

      {/* Logs Scroll Area */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto z-10 custom-scrollbar scroll-smooth ${readabilityPaddingClass} ${readabilityContrastClass} ${logPaddingClass}`}
        style={{
            maskImage: 'linear-gradient(to bottom, transparent, black 20px, black 95%, transparent)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20px, black 95%, transparent)',
            WebkitOverflowScrolling: 'touch'
        }}
        aria-live="polite"
        aria-atomic="false"
        aria-label="Game log feed"
      >
        {sortedTasks.length > 0 && (
            <div className="mb-6 p-3 border border-cyan-900/40 bg-cyan-950/20 rounded-lg">
                <div className="text-[10px] uppercase tracking-widest text-cyan-300 mb-2">任务时间轴</div>
                <div className="flex flex-wrap gap-2">
                    {sortedTasks.map((task) => (
                        <button
                            key={task.id}
                            type="button"
                            onClick={() => {
                                setFocusedTaskId(task.id);
                                onTaskFocus?.(task.id);
                            }}
                            className={`px-2 py-1 text-[11px] border rounded transition-colors ${
                                focusedTaskId === task.id
                                    ? 'border-cyan-300/60 bg-cyan-800/30 text-cyan-100'
                                    : 'border-slate-700/60 bg-black/30 text-slate-300 hover:border-cyan-500/50'
                            }`}
                        >
                            {`任务: ${task.标题}`}
                        </button>
                    ))}
                </div>
                {focusedTask && (
                    <div className="mt-3 border-t border-cyan-900/40 pt-3">
                        <div className="text-[11px] text-cyan-200 font-semibold mb-2">相关日志</div>
                        {relatedTaskLogs.length > 0 ? (
                            <div className="space-y-1">
                                {relatedTaskLogs.map((log) => (
                                    <div key={`task-link-${log.id}`} className="text-[11px] text-slate-300">
                                        {log.text}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-[11px] text-slate-500">暂无匹配日志</div>
                        )}
                    </div>
                )}
            </div>
        )}

        {filterQuery && (
            <div className="mb-6 text-center text-[10px] text-hestia-blue-400/70 font-display tracking-widest border-b border-hestia-blue-900/30 pb-2 mx-auto max-w-xs">
                — 搜索结果: {renderedLogs.length} 条 —
            </div>
        )}

        {renderedLogs.map((log, idx) => {
            const globalIndex = logIndexMap.get(log.id) ?? 0;
            const prevLog = logs[globalIndex - 1];
            const isNewTurn = log.turnIndex !== undefined && log.turnIndex > 0 && (!prevLog || log.turnIndex !== prevLog.turnIndex);
            
            const showAiToolbar = !!log.rawResponse;
            const aiActionKey = log.responseId || (log.rawResponse ? `${log.rawResponse}::${log.turnIndex ?? 0}` : '');
            const aiActionAnchor = !!log.rawResponse && !!aiActionKey && !aiActionSeen.has(aiActionKey);
            if (aiActionAnchor) aiActionSeen.add(aiActionKey);

            return (
                <div key={`${log.id}-${globalIndex}-${idx}`} ref={(el) => setLogRef(log.id, el)}>
                    {isNewTurn && <TurnDivider turn={log.turnIndex} />}
                    {isNewTurn && <TurnThinking thinking={log.turnIndex !== undefined ? turnThinkingMap.get(log.turnIndex) : undefined} />}
                    <LogEntryItem 
                        log={log} 
                        isLatest={globalIndex === logs.length - 1} 
                        playerStats={playerStats} 
                        playerName={playerStats?.姓名}
                        confidants={confidants}
                        onEditClick={handleEditAIClick}
                        onDelete={onDeleteLog}
                        onEditUserLog={handleEditUserClick}
                        aiActionAnchor={aiActionAnchor}
                        fontSize={fontSize} 
                        readability={readability}
                        showAiToolbar={showAiToolbar}
                        isHellMode={isHellMode}
                        onAvatarClick={handleAvatarClick}
                    />
                </div>
            );
        })}

        {renderedLogs.length === 0 && (
            <div className="py-20 text-center text-slate-500 text-xs font-display italic tracking-wider opacity-60">
                没有匹配的记录
            </div>
        )}

        {/* Streaming Raw Data Display */}
        {isStreaming && lastRawResponse ? (
            <div className={`p-5 my-6 border-l-2 bg-slate-900/30 backdrop-blur-sm shadow-xl text-[10px] md:text-xs whitespace-pre-wrap font-mono leading-relaxed break-all rounded-r-lg border-hestia-blue-500 text-slate-300`}>
                <div className="flex items-center gap-2 mb-3 text-hestia-blue-400 font-display font-bold uppercase tracking-widest border-b border-hestia-blue-500/20 pb-2">
                    <Terminal size={12} className="animate-pulse" /> 数据流接入中...
                </div>
                {lastThinking && (
                    <details className="mb-4 bg-black/20 border border-emerald-900/40 px-4 py-3 rounded-lg open:bg-black/40 transition-all">
                        <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-emerald-400/80 hover:text-emerald-300 transition-colors">
                            AI 思考 (实时)
                        </summary>
                        <div className="mt-3 text-[10px] text-emerald-100/70 whitespace-pre-wrap leading-loose font-mono">
                            {lastThinking}
                        </div>
                    </details>
                )}
                <div className="pl-1 border-l border-white/5 opacity-90">
                    {lastRawResponse}
                    <span className="animate-pulse ml-1 text-hestia-blue-400">_</span>
                </div>
            </div>
        ) : isStreaming && isProcessing ? (
            <div className={`flex gap-3 items-center justify-center p-8 opacity-60 animate-pulse ${textColor}`}>
                <Loader2 size={20} className="animate-spin text-hestia-blue-400" />
                <span className="text-xs font-mono tracking-widest text-hestia-blue-200">
                    {processingStage === 'generating' ? processingStageLabel : '初始化数据流...'}
                </span>
            </div>
        ) : null}

        <div ref={endRef} />
      </div>

      {(showCombatShortcut || showQuickActions || showBattleIntelPanel) && (
          <div className={`absolute ${actionDockOffset} left-0 w-full z-50 pointer-events-none`}>
              <div className="w-full flex flex-col justify-end gap-3 pointer-events-auto">
                  {showCombatShortcut && (
                      <div className="flex justify-center px-4 md:px-10">
                          <button
                            type="button"
                            onClick={() => setShowCombatUI(true)}
                            className={`text-white border-2 px-8 py-3 font-display text-base md:text-xl uppercase tracking-[0.2em] hover:scale-105 transition-transform flex items-center gap-3 rounded-sm ${
                                combatState.是否战斗中
                                    ? 'bg-red-600 border-red-500/60 shadow-[0_0_20px_rgba(220,38,38,0.3)] animate-pulse'
                                    : 'bg-cyan-700 border-cyan-500/60 shadow-[0_0_20px_rgba(8,145,178,0.35)]'
                            }`}
                          >
                              <Sword size={24} /> {combatState.是否战斗中 ? '进入战斗面板' : '查看战斗面板'}
                          </button>
                      </div>
                  )}

                  {showBattleIntelPanel && hasMetaPanels && (
                      <div className="px-4">
                          <div className="bg-black/60 border border-hestia-blue-500/20 rounded-lg p-3 shadow-xl">
                              <div className="text-[11px] uppercase tracking-wide text-hestia-blue-300 mb-2">战斗情报</div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {dicePool && dicePool.length > 0 && (
                                      <div className="bg-black/40 border border-hestia-blue-500/10 rounded px-2 py-2">
                                          <div className="text-[10px] text-hestia-blue-300 mb-1">骰池</div>
                                          {dicePool.map(row => (
                                              <div key={row.id} className="text-[10px] text-zinc-200 flex justify-between">
                                                  <span>{row.类型?.toUpperCase()} {row.数值}</span>
                                                  {row.已使用 && <span className="text-amber-300">已使用</span>}
                                              </div>
                                          ))}
                                      </div>
                                  )}
                                  {encounters && encounters.length > 0 && (
                                      <div className="bg-black/40 border border-hestia-blue-500/10 rounded px-2 py-2">
                                          <div className="text-[10px] text-hestia-blue-300 mb-1">遭遇</div>
                                          {encounters.map(row => (
                                              <div key={row.id} className="text-[10px] text-zinc-200">{row.名称} · {row.类型}</div>
                                          ))}
                                      </div>
                                  )}
                                  {logSummaries && logSummaries.length > 0 && (
                                      <div className="bg-black/40 border border-hestia-blue-500/10 rounded px-2 py-2">
                                          <div className="text-[10px] text-hestia-blue-300 mb-1">日志摘要</div>
                                          {logSummaries.map((row, idx) => (
                                              <div key={idx} className="text-[10px] text-zinc-300">回合 {row.回合}: {row.摘要}</div>
                                          ))}
                                      </div>
                                  )}
                                  {logOutlines && logOutlines.length > 0 && (
                                      <div className="bg-black/40 border border-hestia-blue-500/10 rounded px-2 py-2">
                                          <div className="text-[10px] text-hestia-blue-300 mb-1">日志大纲</div>
                                          {logOutlines.map((row, idx) => (
                                              <div key={idx} className="text-[10px] text-zinc-300">{row.标题}</div>
                                          ))}
                                      </div>
                                  )}
                                  {latestResolutionEvent && (
                                      <div className="bg-black/40 border border-hestia-blue-500/10 rounded px-2 py-2">
                                          <div className="text-[10px] text-hestia-blue-300 mb-1">最新判定</div>
                                          <div className="text-[10px] text-zinc-200">
                                              {latestResolutionEvent.行动者} · {latestResolutionEvent.动作}
                                          </div>
                                          <div className="text-[10px] text-zinc-400">
                                              {latestResolutionEvent.结果 || (latestResolutionEvent.是否成功 === true ? '成功' : latestResolutionEvent.是否成功 === false ? '失败' : '处理中')}
                                          </div>
                                      </div>
                                  )}
                                  {hasActionEconomy && (
                                      <div className="bg-black/40 border border-hestia-blue-500/10 rounded px-2 py-2">
                                          <div className="text-[10px] text-hestia-blue-300 mb-1">行动经济</div>
                                          <div className="text-[10px] text-zinc-300">
                                              回合 {combatState.行动经济?.回合 || 0}
                                          </div>
                                          {actionEconomyCurrent ? (
                                              <div className="text-[10px] text-zinc-200 mt-0.5">
                                                  动作{actionEconomyCurrent.动作} / 附赠{actionEconomyCurrent.附赠} / 反应{actionEconomyCurrent.反应} / 移动{actionEconomyCurrent.移动}
                                              </div>
                                          ) : (
                                              <div className="text-[10px] text-zinc-400 mt-0.5">等待当前行动者资源同步</div>
                                          )}
                                      </div>
                                  )}
                                  {hasBattleMapPreview && (
                                      <div className="bg-black/40 border border-hestia-blue-500/10 rounded px-2 py-2">
                                          <div className="text-[10px] text-hestia-blue-300 mb-1">战术地图</div>
                                          <div className="text-[10px] text-zinc-300">
                                              单位 {(combatState.地图 || []).length} · 尺寸 {combatState.视觉?.地图尺寸?.宽度 || '?'}x{combatState.视觉?.地图尺寸?.高度 || '?'}
                                          </div>
                                          <div className="text-[10px] text-zinc-500 mt-0.5">可通过“查看战斗面板”切到 SVG 战场。</div>
                                      </div>
                                  )}
                                  {structuredOptions.length > 0 && (
                                      <div className="bg-black/40 border border-hestia-blue-500/10 rounded px-2 py-2 md:col-span-2">
                                          <div className="text-[10px] text-hestia-blue-300 mb-1">可选行动</div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              {structuredOptions.map((opt, idx) => (
                                                  <button
                                                      key={opt.id || `${opt.名称}-${idx}`}
                                                      type="button"
                                                      onClick={() => {
                                                          const text = opt.描述 || opt.名称;
                                                          handleActionOptionSelect(text);
                                                      }}
                                                      className="text-left bg-black/50 border border-hestia-blue-500/10 hover:border-hestia-blue-400/60 hover:bg-hestia-blue-950/40 rounded px-2 py-2 transition-colors"
                                                  >
                                                      <div className="text-[11px] text-zinc-100 font-semibold">{opt.名称}</div>
                                                      {renderCost(opt) && <div className="text-[10px] text-hestia-blue-300 mt-0.5">{renderCost(opt)}</div>}
                                                      {opt.描述 && <div className="text-[10px] text-zinc-400 mt-0.5">{opt.描述}</div>}
                                                  </button>
                                              ))}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  )}
                  {showQuickActions && (
                      <>
                          <div className="px-4 pb-1 text-[10px] md:text-xs uppercase tracking-widest text-hestia-blue-300/80 font-semibold">
                              {enableActionLoop ? '行动闭环' : '日常行动'}
                          </div>
                          {enableActionLoop && selectedPrimaryAction && (
                              <div className="px-4 pb-2">
                                  <button
                                      type="button"
                                      onClick={handleSendPrimaryAction}
                                      className="w-full md:w-auto px-4 py-2 text-xs font-semibold tracking-widest uppercase bg-cyan-600/20 border border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/30 transition-colors rounded"
                                  >
                                      一键发送主行动
                                  </button>
                              </div>
                          )}
                          <div
                              ref={actionScrollRef}
                              className="flex gap-3 overflow-x-auto px-4 pb-3 custom-scrollbar snap-x touch-pan-x items-end w-full max-w-full"
                          >
                              {(enableActionLoop
                                  ? [...primaryQuickActions, ...secondaryQuickActions]
                                  : quickActionStrings).map((opt, idx) => {
                                  const shouldMarquee = opt.length > 12;
                                  const isPrimary = enableActionLoop && idx < primaryQuickActions.length;
                                  const labelText = isPrimary ? `主行动: ${opt}` : (enableActionLoop ? `次行动: ${opt}` : opt);
                                  return (
                                  <button
                                      key={idx}
                                      onClick={() => {
                                          if (isPrimary) {
                                              handlePrimaryActionSelect(opt);
                                              return;
                                          }
                                          setSelectedPrimaryAction('');
                                          handleActionOptionSelect(opt);
                                      }}
                                      className={`flex-shrink-0 snap-start text-left min-w-[140px] max-w-[220px] group transition-all transform active:scale-95 bg-black/40 border border-slate-700/50 hover:border-hestia-blue-400 backdrop-blur-md rounded-lg p-3 relative overflow-hidden shadow-lg`}
                                  >
                                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-hestia-blue-600/20`} />
                                      <div className="flex items-center gap-2 mb-1 relative z-10">
                                          <MousePointer2 size={14} className={`shrink-0 text-hestia-blue-400 group-hover:text-white transition-colors`} />
                                          <div className="relative overflow-hidden w-full">
                                              <div className={`flex w-max items-center gap-6 ${shouldMarquee ? 'action-option-marquee' : ''}`}>
                                                  <span className={`font-bold text-xs md:text-sm whitespace-nowrap leading-tight text-slate-200 group-hover:text-white font-ui`}>
                                                      {labelText}
                                                  </span>
                                                  {shouldMarquee && (
                                                      <span className={`font-bold text-xs md:text-sm whitespace-nowrap leading-tight text-slate-200/50 group-hover:text-white/70 font-ui`}>
                                                          {labelText}
                                                      </span>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                      <ChevronRight size={14} className={`absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all text-hestia-blue-400`} />
                                  </button>
                              )})}
                              <div className="w-4 flex-shrink-0" />
                          </div>
                      </>
                  )}
              </div>
          </div>
      )}

      {/* Input Area */}
      <GameInput 
          onSendMessage={onSendMessage} 
          onReroll={onReroll}
          onStopInteraction={onStopInteraction}
          isProcessing={!!isProcessing}
          isStreaming={!!isStreaming}
          isPhoneProcessing={!!isPhoneProcessing}
          combatState={combatState}
          commandQueue={commandQueue}
          onRemoveCommand={onRemoveCommand}
          draftInput={draftInput}
          setDraftInput={setDraftInput}
          primaryActionHint={selectedPrimaryAction}
          enableCombatUI={enableCombatUI}
          isHellMode={isHellMode}
      />

      {/* Editing Modal */}
      {editingLogId && (
          <EditLogModal 
            initialContent={editContent} 
            mode={editMode}
            onClose={() => setEditingLogId(null)} 
            onApply={handleApplyEdit} 
          />
      )}
      
      {/* Hidden File Input for Avatar Upload */}
      <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
      />
    </div>
  );
};

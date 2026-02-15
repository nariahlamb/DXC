import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ListTodo, CheckCircle2, XCircle, AlertCircle, 
    Clock, MapPin, Trophy, History, ArrowLeft, 
    Search, Filter, ChevronRight, Target
} from 'lucide-react';
import { Task } from '../../../types';
import { ModalWrapper } from '../../ui/ModalWrapper';
import clsx from 'clsx';

// --- Types ---

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onDeleteTask?: (id: string) => void;
  onSelectTask?: (id: string) => void;
}

type TaskFilter = 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface TaskSummaryStats {
  active: number;
  completed: number;
  failed: number;
  currentObjective: string;
}

// --- Helpers ---

export const summarizeTaskStats = (tasks: Task[] = []): TaskSummaryStats => {
  const active = tasks.filter(t => t.状态 === 'active').length;
  const completed = tasks.filter(t => t.状态 === 'completed').length;
  const failed = tasks.filter(t => t.状态 === 'failed').length;
  const currentObjective = tasks.find(t => t.状态 === 'active')?.标题 || '暂无目标';

  return { active, completed, failed, currentObjective };
};

const FILTER_LABELS: Record<TaskFilter, string> = {
    ACTIVE: '进行中',
    COMPLETED: '已完成',
    FAILED: '已失效'
};

const GRADE_COLORS: Record<string, string> = {
    SSS: 'text-yellow-300 border-yellow-400/80 bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.3)]',
    SS: 'text-yellow-400 border-yellow-500/80 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.2)]',
    S: 'text-amber-400 border-amber-500/80 bg-amber-500/10',
    A: 'text-red-400 border-red-500/60 bg-red-500/10',
    B: 'text-purple-400 border-purple-500/60 bg-purple-500/10',
    C: 'text-blue-400 border-blue-500/60 bg-blue-500/10',
    D: 'text-zinc-400 border-zinc-500/60 bg-zinc-500/10',
    E: 'text-zinc-500 border-zinc-600/40 bg-zinc-600/5',
};

// --- Components ---

const RankBadge = ({ grade }: { grade: string }) => (
    <div className={clsx(
        "flex items-center justify-center w-8 h-8 md:w-10 md:h-10 border-2 rotate-45 transform transition-all duration-300",
        GRADE_COLORS[grade] || GRADE_COLORS['E']
    )}>
        <span className="-rotate-45 font-display font-black text-sm md:text-base">{grade}</span>
    </div>
);

const StatusBadge = ({ status }: { status: Task['状态'] }) => {
    switch (status) {
        case 'active':
            return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] md:text-xs font-bold uppercase tracking-wider animate-pulse"><Target size={12} /> 进行中</span>;
        case 'completed':
            return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] md:text-xs font-bold uppercase tracking-wider"><CheckCircle2 size={12} /> 已完成</span>;
        case 'failed':
            return <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] md:text-xs font-bold uppercase tracking-wider"><XCircle size={12} /> 任务失败</span>;
        default:
            return null;
    }
};

// --- Main Component ---

export const TasksModal: React.FC<TasksModalProps> = ({ isOpen, onClose, tasks = [], onDeleteTask, onSelectTask }) => {
  const [filter, setFilter] = useState<TaskFilter>('ACTIVE');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  // Handle Mobile Detection
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const filteredTasks = tasks.filter(t => t.状态.toUpperCase() === filter);
  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  // Auto-select logic
  useEffect(() => {
    if (isOpen && !isMobileView && filteredTasks.length > 0 && !selectedTask) {
        setSelectedTaskId(filteredTasks[0].id);
    }
  }, [isOpen, filter, isMobileView]);

  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title="ADVENTURER GUILD"
        icon={<ListTodo size={20} />}
        size="l"
        theme="guild" // Assuming 'guild' theme exists or falls back nicely, will add custom styles in-line anyway
        noBodyPadding
        className="overflow-hidden"
    >
        <div className="flex flex-col md:flex-row h-[85vh] md:h-[70vh] w-full overflow-hidden bg-zinc-950 font-sans text-zinc-100 relative">
            
            {/* Background Grid Ambience */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-hexagon mix-blend-overlay" />
            <div className="absolute inset-0 pointer-events-none opacity-50 bg-noise mix-blend-overlay" />

            {/* --- LEFT PANEL: LIST --- */}
            <motion.div 
                className={clsx(
                    "w-full md:w-1/3 flex flex-col border-r border-white/5 bg-zinc-900/50 backdrop-blur-sm z-10",
                    isMobileView && selectedTask ? "hidden" : "flex"
                )}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
            >
                {/* Headers / Tabs */}
                <div className="flex items-center shrink-0 border-b border-white/5 bg-black/20">
                    {(Object.keys(FILTER_LABELS) as TaskFilter[]).map((f) => {
                        const count = tasks.filter(t => t.状态.toUpperCase() === f).length;
                        return (
                        <button
                            key={f}
                            onClick={() => { setFilter(f); setSelectedTaskId(null); }}
                            className={clsx(
                                "flex-1 py-4 text-xs font-bold uppercase tracking-widest relative overflow-hidden transition-colors duration-200",
                                filter === f 
                                    ? "text-amber-400 bg-amber-900/10" 
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            )}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-1">
                                {FILTER_LABELS[f]} 
                                <span className={clsx("text-[10px]", filter === f ? "text-amber-500/60" : "text-zinc-700")}>
                                    {count > 0 ? `(${count})` : ''}
                                </span>
                            </span>
                            {filter === f && (
                                <motion.div 
                                    layoutId="tab-indicator"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                />
                            )}
                        </button>
                    )})}
                </div>

                {/* List Container */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                    <AnimatePresence mode="popLayout">
                        {filteredTasks.length > 0 ? filteredTasks.map((task, i) => (
                            <motion.div
                                key={task.id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => {
                                    setSelectedTaskId(task.id);
                                    onSelectTask?.(task.id);
                                }}
                                className={clsx(
                                    "relative group cursor-pointer border rounded-sm p-4 transition-all duration-300 overflow-hidden",
                                    selectedTaskId === task.id 
                                        ? "bg-amber-900/10 border-amber-500/50 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]" 
                                        : "bg-black/20 border-white/5 hover:border-amber-500/30 hover:bg-white/5"
                                )}
                            >
                                {/* Selection Indicator */}
                                {selectedTaskId === task.id && (
                                    <motion.div 
                                        layoutId="selection-glow"
                                        className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                                    />
                                )}

                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            {task.状态 === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_5px_rgba(245,158,11,0.8)]" />}
                                            <h4 className={clsx(
                                                "font-bold truncate text-sm tracking-wide transition-colors",
                                                selectedTaskId === task.id ? "text-amber-100" : "text-zinc-400 group-hover:text-zinc-200"
                                            )}>
                                                {task.标题}
                                            </h4>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                                            <span className="flex items-center gap-1"><Clock size={10} /> {task.截止时间 || "无期限"}</span>
                                            <span className="w-px h-3 bg-white/10" />
                                            <span className="truncate max-w-[100px] text-amber-500/70">{task.奖励}</span>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex flex-col items-end gap-1">
                                        <span className={clsx(
                                            "text-[10px] font-black px-1.5 rounded border font-mono", 
                                            (GRADE_COLORS[task.评级] || GRADE_COLORS['E']).split(' ')[0], // Text color
                                            (GRADE_COLORS[task.评级] || GRADE_COLORS['E']).split(' ')[1]  // Border color
                                        )}>
                                            {task.评级}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        )) : (
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                className="flex flex-col items-center justify-center h-40 text-zinc-600"
                            >
                                <Search size={32} strokeWidth={1.5} className="mb-2 opacity-50" />
                                <span className="text-xs uppercase tracking-widest">暂无记录</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* --- RIGHT PANEL: DETAILS --- */}
            <div className={clsx(
                "w-full md:w-2/3 md:relative bg-gradient-to-br from-zinc-900 via-zinc-950 to-black overflow-hidden flex flex-col",
                isMobileView && !selectedTask ? "hidden" : "flex"
            )}>
                {selectedTask ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                        {/* Mobile Back Button */}
                        <div className="md:hidden flex items-center p-4 border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-20">
                            <button 
                                onClick={() => setSelectedTaskId(null)}
                                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft size={18} />
                                <span className="text-xs font-bold uppercase tracking-wider">返回列表</span>
                            </button>
                        </div>
                        
                        {/* Content Scroll Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10">
                            <motion.div
                                key={selectedTask.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="max-w-4xl mx-auto"
                            >
                                {/* Header Section */}
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 border-b border-white/5 pb-8 relative">
                                    <div className="flex items-start gap-4 md:gap-6">
                                        <RankBadge grade={selectedTask.评级} />
                                        <div>
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="font-mono text-[10px] text-zinc-600 tracking-[0.2em] uppercase">NO.{selectedTask.id.substring(0,8)}</span>
                                                <StatusBadge status={selectedTask.状态} />
                                            </div>
                                            <h1 className="text-2xl md:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-500/80 uppercase tracking-wide leading-tight shadow-amber-500/20 drop-shadow-sm">
                                                {selectedTask.标题}
                                            </h1>
                                        </div>
                                    </div>
                                    
                                    {/* Action Buttons (Desktop) */}
                                    <div className="hidden md:flex gap-2">
                                         {onDeleteTask && selectedTask.状态 !== 'active' && (
                                            <button 
                                                onClick={() => {
                                                    if (confirm("确定要删除这条委托记录吗？")) {
                                                        onDeleteTask(selectedTask.id);
                                                        setSelectedTaskId(null);
                                                    }
                                                }}
                                                className="px-4 py-2 text-xs font-bold text-red-400 border border-red-900/40 hover:bg-red-900/20 transition-all rounded-sm uppercase tracking-wider"
                                            >
                                                删除记录
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Main Grid */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                    
                                    {/* Info Cards */}
                                    <div className="lg:col-span-2 space-y-6">
                                        {/* Objective */}
                                        <div className="bg-white/5 border border-white/5 rounded-sm p-5 relative overflow-hidden group hover:border-amber-500/20 transition-colors">
                                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <Target size={80} />
                                            </div>
                                            <h3 className="text-amber-500 text-xs font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                                <Target size={14} /> 任务目标
                                            </h3>
                                            <p className="text-zinc-300 leading-relaxed font-serif text-sm md:text-base">
                                                {selectedTask.描述}
                                            </p>
                                        </div>

                                        {/* Meta Data */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-black/20 border border-white/5 p-3 rounded-sm">
                                                <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">地点</label>
                                                <div className="flex items-center gap-2 text-zinc-300 font-mono text-xs">
                                                    <MapPin size={12} className="text-amber-500" />
                                                    未知区域
                                                </div>
                                            </div>
                                            <div className="bg-black/20 border border-white/5 p-3 rounded-sm">
                                                <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">截止时间</label>
                                                <div className="flex items-center gap-2 text-zinc-300 font-mono text-xs">
                                                    <Clock size={12} className="text-amber-500" />
                                                    {selectedTask.截止时间 || "无限制"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rewards Column */}
                                    <div className="space-y-4">
                                        <div className="bg-amber-950/20 border border-amber-500/20 p-5 rounded-sm relative overflow-hidden">
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.1),transparent_70%)]" />
                                            <h3 className="text-amber-400 text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                                <Trophy size={14} /> 悬赏报酬
                                            </h3>
                                            <div className="font-display text-2xl text-white mb-2 break-words">
                                                {selectedTask.奖励}
                                            </div>
                                            <div className="text-[10px] text-amber-500/60 uppercase tracking-widest">
                                                任务完成后发放
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Operation Log */}
                                {selectedTask.日志 && selectedTask.日志.length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-white/5">
                                        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                            <History size={14} /> 行动记录
                                        </h3>
                                        <div className="relative border-l border-white/10 ml-3 space-y-8">
                                            {selectedTask.日志.map((log, idx) => (
                                                <div key={idx} className="relative pl-6">
                                                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-600 group-hover:border-amber-500 group-hover:bg-amber-900 transition-colors" />
                                                    <span className="block text-[10px] font-mono text-zinc-500 mb-1">{log.时间戳}</span>
                                                    <p className="text-zinc-300 text-sm">{log.内容}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>

                         {/* Mobile Actions Footer */}
                         <div className="md:hidden p-4 border-t border-white/10 bg-black/40 backdrop-blur pb-8">
                             {onDeleteTask && selectedTask.状态 !== 'active' && (
                                <button 
                                    onClick={() => {
                                        if (confirm("确定要删除这条委托记录吗？")) {
                                            onDeleteTask(selectedTask.id);
                                            setSelectedTaskId(null);
                                        }
                                    }}
                                    className="w-full py-3 text-xs font-bold text-red-400 border border-red-900/40 bg-red-900/10 rounded-sm uppercase tracking-wider"
                                >
                                    删除记录
                                </button>
                            )}
                        </div>

                    </div>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 opacity-40">
                        <div className="w-24 h-24 rounded-full border border-dashed border-zinc-700 flex items-center justify-center mb-4">
                            <ListTodo size={40} />
                        </div>
                        <p className="text-sm font-mono uppercase tracking-widest">请选择一个委托任务</p>
                    </div>
                )}
            </div>
        </div>
    </ModalWrapper>
  );
};

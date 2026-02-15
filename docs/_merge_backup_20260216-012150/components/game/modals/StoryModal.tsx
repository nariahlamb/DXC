import React from 'react';
import { BookOpen, Clock, MapPin, GitBranch, Target, AlertTriangle, ChevronRight, Hash } from 'lucide-react';
import { StoryState } from '../../../types';
import { ModalWrapper } from '../../ui/ModalWrapper';
import clsx from 'clsx';

interface StoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryState;
  embedded?: boolean;
}

export const StoryModal: React.FC<StoryModalProps> = ({ isOpen, onClose, story, embedded = false }) => {
  // Safe check for story object
  const safeStory = story || {
      主线: {
          当前卷数: 1,
          当前篇章: "Unknown",
          当前阶段: "Unknown",
          关键节点: "Unknown",
          节点状态: "Unknown"
      },
      引导: {
          当前目标: "暂无目标",
          下一触发: "Unknown",
          行动提示: "暂无剧情数据。"
      },
      时间轴: {
          预定日期: "Unknown",
          下一关键时间: "Unknown"
      },
      路线: {
          是否正史: true,
          偏移度: 0,
          分歧说明: ""
      },
      待触发: [],
      里程碑: []
  };

  const innerContent = (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left Sidebar: Current Status */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-emerald-500/10 bg-black/20 shrink-0 overflow-y-auto custom-scrollbar p-6 space-y-8">
                
                {/* Header Info */}
                <div>
                    <div className="text-[10px] text-emerald-500 uppercase tracking-[0.2em] mb-2 font-bold">Current Chapter</div>
                    <div className="text-3xl font-display text-white uppercase leading-tight mb-1 text-shadow-sm">
                        {safeStory.主线?.当前篇章 || "Unknown"}
                    </div>
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 border border-white/10 bg-white/5 rounded-sm text-[10px] text-zinc-400 font-mono">
                        <span>VOL.{safeStory.主线?.当前卷数 ?? 1}</span>
                        <span className="w-px h-3 bg-white/10" />
                        <span>PHASE: {safeStory.主线?.当前阶段}</span>
                    </div>
                </div>

                {/* Objective */}
                <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-sm">
                    <div className="flex items-center gap-2 text-[10px] text-emerald-400 uppercase tracking-widest mb-2 font-bold">
                        <Target size={12} /> Current Objective
                    </div>
                    <p className="text-sm text-emerald-100/90 font-medium leading-snug">
                        {safeStory.引导?.当前目标}
                    </p>
                    {safeStory.引导?.行动提示 && (
                        <div className="mt-3 pt-3 border-t border-emerald-500/10 text-xs text-emerald-500/70 italic">
                            Help: {safeStory.引导.行动提示}
                        </div>
                    )}
                </div>

                {/* World Line Status */}
                <div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest mb-3 font-bold">
                        <GitBranch size={12} /> World Line Deviation
                    </div>
                    <div className="flex items-center justify-between text-xs mb-1">
                         <span className={safeStory.路线?.是否正史 ? 'text-zinc-300' : 'text-yellow-500'}>
                            {safeStory.路线?.是否正史 ? "Canon Route" : "IF Route"}
                        </span>
                        <span className="font-mono text-zinc-500">{safeStory.路线?.偏移度 || 0}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                         <div 
                            className={clsx("h-full transition-all duration-500", safeStory.路线?.偏移度 && safeStory.路线?.偏移度 > 50 ? 'bg-yellow-500' : 'bg-emerald-500')} 
                            style={{ width: `${safeStory.路线?.偏移度 || 0}%` }} 
                        />
                    </div>
                </div>

                {/* Triggers */}
                <div className="space-y-3">
                     <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                        <Clock size={12} /> Next Events
                    </div>
                    <div className="text-sm text-white">
                        {safeStory.主线?.关键节点}
                    </div>
                    <div className="text-xs text-zinc-500 font-mono flex items-center gap-2">
                         <AlertTriangle size={12} /> Trigger: {safeStory.引导?.下一触发}
                    </div>
                </div>
            </div>

            {/* Right Panel: Timeline */}
            <div className="flex-1 bg-gradient-to-br from-transparent to-emerald-900/5 p-6 md:p-10 overflow-y-auto custom-scrollbar relative">
                <div className="absolute top-0 right-0 p-20 opacity-[0.02] pointer-events-none">
                     <Clock size={300} />
                </div>

                <div className="relative z-10 max-w-3xl mx-auto">
                    <h3 className="text-lg font-display uppercase tracking-widest text-zinc-500 mb-8 flex items-center gap-3">
                        <Hash size={18} /> Timeline Record
                    </h3>

                    <div className="relative border-l-2 border-zinc-800 ml-3 space-y-8 pb-20">
                        {/* Pending Events (Future) */}
                        {safeStory.待触发 && safeStory.待触发.length > 0 && (
                            <div className="relative pl-8 opacity-60 hover:opacity-100 transition-opacity">
                                <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-black animate-pulse" />
                                <div className="text-[10px] text-emerald-500 font-mono uppercase tracking-widest mb-1">Upcoming</div>
                                <div className="space-y-2">
                                    {safeStory.待触发.slice(0, 3).map((evt: any, idx: number) => (
                                        <div key={idx} className="bg-emerald-900/10 border border-emerald-500/20 p-3 rounded-sm">
                                            <div className="text-emerald-300 text-sm font-medium">{evt.内容}</div>
                                            {evt.预计触发 && <div className="text-[10px] text-emerald-500/50 mt-1 font-mono">Est. {evt.预计触发}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Milestones (Past) */}
                        {safeStory.里程碑 && safeStory.里程碑.length > 0 ? (
                            safeStory.里程碑.map((m: any, idx: number) => (
                                <div key={idx} className="relative pl-8 group">
                                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-700 bg-zinc-900 group-hover:border-emerald-500 group-hover:bg-emerald-500 transition-colors" />
                                    <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1 group-hover:text-emerald-400 transition-colors">
                                        {m.时间 || "Unknown Date"}
                                    </div>
                                    <div className="bg-black/40 border border-white/5 p-4 rounded-sm hover:border-emerald-500/30 transition-colors">
                                        <div className="text-zinc-200 text-sm">{m.事件}</div>
                                        {m.影响 && (
                                            <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-zinc-500">
                                                Effect: {m.影响}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="relative pl-8">
                                <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-zinc-800" />
                                <div className="text-sm text-zinc-600 italic">No historical records available.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
  );

  if (embedded) return innerContent;

  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title="Chronicle"
        icon={<BookOpen size={20} />}
        size="l"
        theme="default"
        className="flex flex-col"
    >
        {innerContent}
    </ModalWrapper>
  );
};
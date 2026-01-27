
import React from 'react';
import { X, BookOpen, Clock, MapPin, GitBranch, Target, AlertTriangle } from 'lucide-react';
import { StoryState } from '../../../types';

interface StoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  story: StoryState;
}

export const StoryModal: React.FC<StoryModalProps> = ({ isOpen, onClose, story }) => {
  if (!isOpen) return null;

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

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4 animate-in fade-in duration-200">
      <div className="w-full h-full md:h-auto md:max-h-[85vh] md:max-w-4xl bg-zinc-900 border-y-0 md:border-y-8 border-green-600 relative flex flex-col shadow-2xl overflow-hidden">
        
        <div className="absolute top-4 right-4 z-50">
             <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors border border-zinc-700 p-2 bg-black">
                <X size={24} />
             </button>
        </div>

        {/* Decorative Background */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')]" />

        <div className="p-8 md:p-12 flex flex-col relative z-10 h-full overflow-y-auto custom-scrollbar pb-32 md:pb-12">
            
            {/* Header: Current Arc */}
            <div className="flex flex-col items-center text-center mb-10 mt-8 md:mt-0">
                <BookOpen size={48} className="text-green-600 mb-4" />
                <h2 className="text-zinc-500 uppercase tracking-[0.5em] text-xs mb-2">当前篇章 (Vol.{safeStory.主线?.当前卷数 ?? 1})</h2>
                <h1 className="text-4xl md:text-6xl font-display uppercase text-white text-shadow">{safeStory.主线?.当前篇章 || "Unknown"}</h1>
            </div>

            {/* Main Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                
                {/* Left: Progression & Path */}
                <div className="bg-black/40 border-l-4 border-green-600 p-6 space-y-6">
                    <div>
                        <div className="flex items-center gap-2 text-green-500 mb-2 font-bold uppercase tracking-wider text-sm">
                            <GitBranch size={16} /> 剧情路线
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`text-2xl font-display ${safeStory.路线?.是否正史 ? 'text-white' : 'text-yellow-500'}`}>
                                {safeStory.路线?.是否正史 ? "原著正史" : "IF 分歧线"}
                            </span>
                        </div>
                        {/* Deviation Bar */}
                        <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-zinc-500 uppercase mb-1">
                                <span>原著</span>
                                <span>偏移度 {safeStory.路线?.偏移度 || 0}%</span>
                            </div>
                            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full ${safeStory.路线?.偏移度 && safeStory.路线?.偏移度 > 50 ? 'bg-yellow-500' : 'bg-green-600'}`} 
                                    style={{ width: `${safeStory.路线?.偏移度 || 0}%` }} 
                                />
                            </div>
                        </div>
                        {safeStory.路线?.分歧说明 && (
                            <div className="mt-2 text-[10px] text-zinc-500">
                                分歧说明: {safeStory.路线.分歧说明}
                            </div>
                        )}
                    </div>

                    <div>
                         <div className="flex items-center gap-2 text-green-500 mb-2 font-bold uppercase tracking-wider text-sm">
                            <MapPin size={16} /> 下一关键节点
                        </div>
                        <div className="text-xl text-white font-bold">{safeStory.主线?.关键节点 || "Unknown"}</div>
                        <div className="inline-block mt-1 px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded border border-zinc-700">
                            阶段: {safeStory.主线?.当前阶段 || "Unknown"} · 状态: {safeStory.主线?.节点状态 || "Unknown"}
                        </div>
                    </div>
                </div>

                {/* Right: Triggers & Guide */}
                <div className="bg-black/40 border-r-4 border-green-600 p-6 space-y-6 text-right">
                    <div>
                        <div className="flex items-center justify-end gap-2 text-green-500 mb-2 font-bold uppercase tracking-wider text-sm">
                            <Target size={16} /> 触发条件
                        </div>
                        <div className="text-xl text-white font-bold">{safeStory.引导?.下一触发 || "???"}</div>
                        <div className="text-zinc-500 text-sm mt-1 flex items-center justify-end gap-2">
                             <Clock size={12} /> 预定: {safeStory.时间轴?.预定日期 || "未知"}
                        </div>
                        {safeStory.时间轴?.下一关键时间 && (
                            <div className="text-zinc-500 text-sm mt-1 flex items-center justify-end gap-2">
                                <Clock size={12} /> 下一关键: {safeStory.时间轴.下一关键时间}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-zinc-800">
                        <div className="flex items-center justify-end gap-2 text-yellow-600 mb-2 font-bold uppercase tracking-wider text-sm">
                            <AlertTriangle size={16} /> 引导
                        </div>
                        <p className="text-zinc-300 text-sm italic leading-relaxed">
                            {safeStory.引导?.当前目标 || "暂无具体目标。"}
                        </p>
                        {safeStory.引导?.行动提示 && (
                            <p className="text-zinc-500 text-xs mt-2 leading-relaxed">
                                行动提示: {safeStory.引导.行动提示}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Pending Events */}
            <div className="bg-black/40 border border-green-900/40 p-6 mb-8">
                <div className="flex items-center gap-2 text-green-400 font-bold uppercase tracking-wider text-sm mb-4">
                    <Clock size={14} /> 待触发事件
                </div>
                {(safeStory.待触发 || []).length > 0 ? (
                    <div className="space-y-2 text-sm text-zinc-300">
                        {(safeStory.待触发 || []).slice(0, 3).map((evt: any, idx: number) => (
                            <div key={`${evt.预计触发 || idx}`} className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                                <span className="text-emerald-300 font-mono text-xs">【预计{evt.预计触发}触发】</span>
                                <span className="flex-1 text-zinc-200">{evt.内容 || "未知事件"}</span>
                                {evt.类型 && <span className="text-[10px] text-zinc-500 uppercase">{evt.类型}</span>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-zinc-500 text-sm italic">暂无待触发事件。</div>
                )}
            </div>

            {/* Milestones */}
            {(safeStory.里程碑 && safeStory.里程碑.length > 0) && (
                <div className="bg-black/30 border border-zinc-800 p-6 mb-8">
                    <div className="text-zinc-400 uppercase tracking-widest text-xs mb-3">里程碑</div>
                    <div className="space-y-2 text-sm text-zinc-300">
                        {safeStory.里程碑.map((m: any, idx: number) => (
                            <div key={`${m.时间 || idx}`} className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 border border-zinc-800/60 px-3 py-2">
                                <span className="text-zinc-500 font-mono text-xs">{m.时间 || "未知时间"}</span>
                                <span className="flex-1 text-zinc-200">{m.事件 || "未知事件"}</span>
                                {m.影响 && <span className="text-[10px] text-zinc-500">影响: {m.影响}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer Quote */}
            <div className="mt-auto w-full bg-zinc-800 p-4 text-center border-t border-green-900/50">
                <p className="text-zinc-500 text-xs font-mono">
                    "英雄的愿望是白色的钟声。做出你的选择，冒险者。"
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

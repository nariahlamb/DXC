import React, { useEffect, useState } from 'react';
import { X, Brain, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { MemoryEntry } from '../../../types';

interface MemorySummaryModalProps {
  isOpen: boolean;
  phase: 'preview' | 'processing' | 'result';
  type: 'S2M' | 'M2L';
  entries: MemoryEntry[] | string[];
  summary?: string;
  onConfirm: () => void;
  onApply: (summary: string) => void;
  onCancel: () => void;
}

export const MemorySummaryModal: React.FC<MemorySummaryModalProps> = ({
  isOpen,
  phase,
  type,
  entries,
  summary,
  onConfirm,
  onApply,
  onCancel
}) => {
  const [draftSummary, setDraftSummary] = useState(summary || '');
  const isShortToMedium = type === 'S2M';

  useEffect(() => {
    setDraftSummary(summary || '');
  }, [summary, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-zinc-950 border-2 border-blue-600 shadow-[0_0_60px_rgba(37,99,235,0.3)] flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-900/20 flex items-center justify-between border-b-2 border-blue-700 p-6 shrink-0">
          <div className="flex items-center gap-4 text-blue-400">
            <div className="p-3 bg-blue-900/30 border border-blue-600 rounded-full">
                <Brain size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-blue-600">MEMORY CONSOLIDATION</div>
              <div className="text-2xl font-black italic text-white flex items-center gap-2">
                {isShortToMedium ? '短期记忆' : '中期记忆'} 
                <ArrowRight size={20} className="text-blue-500"/>
                {isShortToMedium ? '中期总结' : '长期核心'}
              </div>
            </div>
          </div>
          <button onClick={onCancel} className="text-blue-500 hover:text-white transition-colors p-2 border border-blue-800 rounded-full">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/circuit.png')] opacity-5 pointer-events-none" />
            
            {phase === 'preview' && (
              <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-8">
                <div className="bg-yellow-900/20 border-l-4 border-yellow-500 p-4 mb-6 flex items-start gap-3">
                  <AlertTriangle size={20} className="text-yellow-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-yellow-200 font-bold">系统检测到记忆缓冲区已满。为了保持思维清晰，需要将以下零散记忆合并为一条精简的总结。</span>
                </div>
                
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">PENDING ENTRIES</h4>
                    <div className="grid gap-3">
                      {(entries as any[]).map((entry, idx) => (
                        <div key={idx} className="bg-zinc-900/80 border border-zinc-800 p-4 hover:border-blue-500/50 transition-colors">
                          {isShortToMedium ? (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-mono bg-black text-blue-400 px-2 py-0.5 border border-blue-900/30">
                                      {(entry as MemoryEntry).timestamp || 'Unknown'}
                                  </span>
                                  {typeof (entry as MemoryEntry).turnIndex === 'number' && (
                                      <span className="text-[10px] font-bold text-zinc-500">TURN {(entry as MemoryEntry).turnIndex}</span>
                                  )}
                              </div>
                              <div className="text-sm text-zinc-300 font-serif leading-relaxed">{(entry as MemoryEntry).content}</div>
                            </>
                          ) : (
                            <div className="text-sm text-zinc-300 font-serif leading-relaxed">{entry as string}</div>
                          )}
                        </div>
                      ))}
                    </div>
                </div>
              </div>
            )}

            {phase === 'processing' && (
              <div className="flex-1 h-full flex flex-col items-center justify-center gap-6 p-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                    <Loader2 size={64} className="text-blue-400 animate-spin relative z-10" />
                </div>
                <div className="text-center space-y-2">
                    <div className="text-xl font-black italic uppercase tracking-widest text-white">正在生成总结</div>
                    <div className="text-xs font-mono text-blue-500">PROCESSING COGNITIVE DATA...</div>
                </div>
              </div>
            )}

            {phase === 'result' && (
              <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-8">
                <div className="bg-green-900/20 border-l-4 border-green-500 p-4 mb-6 flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-green-200 font-bold">总结生成完成。请审阅下方内容，确认无误后应用。</span>
                </div>
                
                <div className="flex flex-col h-[calc(100%-100px)]">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2 mb-4">GENERATED SUMMARY</h4>
                    <textarea
                      className="flex-1 w-full bg-black/50 border-2 border-blue-900/30 p-6 text-sm text-blue-100 font-serif leading-loose resize-none focus:border-blue-500 outline-none shadow-inner custom-scrollbar"
                      value={draftSummary}
                      onChange={(e) => setDraftSummary(e.target.value)}
                      placeholder="等待生成结果..."
                    />
                </div>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="border-t-2 border-blue-900/50 p-6 flex justify-end gap-4 bg-zinc-950 shrink-0">
          <button
            onClick={onCancel}
            className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-zinc-400 border-2 border-zinc-800 hover:border-zinc-600 hover:text-white transition-all"
          >
            取消发送
          </button>
          {phase === 'preview' && (
            <button
              onClick={onConfirm}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 border-2 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-105"
            >
              开始总结
            </button>
          )}
          {phase === 'result' && (
            <button
              onClick={() => onApply(draftSummary)}
              className="px-8 py-3 text-xs font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-500 border-2 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all hover:scale-105"
            >
              应用并继续
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

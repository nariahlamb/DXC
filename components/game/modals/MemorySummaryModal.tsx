import React, { useEffect, useState } from 'react';
import { X, Brain, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
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
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-zinc-950 border-2 border-blue-700 shadow-[0_0_40px_rgba(37,99,235,0.35)] flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 bg-gradient-to-r from-zinc-900 to-black">
          <div className="flex items-center gap-3">
            <Brain size={20} className="text-blue-500" />
            <div>
              <div className="text-xs uppercase tracking-widest text-blue-400">记忆总结提醒</div>
              <div className="text-lg font-display text-white">
                {isShortToMedium ? '短期 → 中期' : '中期 → 长期'}
              </div>
            </div>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {phase === 'preview' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="text-sm text-zinc-300 flex items-start gap-2">
              <AlertTriangle size={16} className="text-yellow-500 mt-0.5" />
              <span>发送前需要进行记忆总结。以下条目将被合并为一条总结。</span>
            </div>
            <div className="bg-black/60 border border-zinc-800 p-3 space-y-3">
              {(entries as any[]).map((entry, idx) => (
                <div key={idx} className="border-b border-zinc-800 pb-2 last:border-b-0 last:pb-0">
                  {isShortToMedium ? (
                    <>
                      <div className="text-[10px] text-zinc-500 uppercase mb-1">
                        {(entry as MemoryEntry).timestamp || 'Unknown'} {typeof (entry as MemoryEntry).turnIndex === 'number' ? `• Turn ${(entry as MemoryEntry).turnIndex}` : ''}
                      </div>
                      <div className="text-xs text-zinc-200 whitespace-pre-wrap">{(entry as MemoryEntry).content}</div>
                    </>
                  ) : (
                    <div className="text-xs text-zinc-200 whitespace-pre-wrap">{entry as string}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-blue-400">
            <Loader2 size={36} className="animate-spin" />
            <div className="text-sm uppercase tracking-widest">正在生成记忆总结...</div>
          </div>
        )}

        {phase === 'result' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="text-sm text-zinc-300 flex items-start gap-2">
              <CheckCircle2 size={16} className="text-green-500 mt-0.5" />
              <span>总结完成，可编辑后应用。</span>
            </div>
            <textarea
              className="w-full min-h-[240px] bg-black border border-zinc-700 p-3 text-xs text-zinc-200 font-mono resize-none focus:border-blue-500 outline-none"
              value={draftSummary}
              onChange={(e) => setDraftSummary(e.target.value)}
            />
          </div>
        )}

        <div className="border-t border-zinc-800 p-4 flex justify-end gap-3 bg-zinc-950">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm uppercase font-bold text-zinc-400 border border-zinc-700 hover:text-white hover:border-white"
          >
            取消发送
          </button>
          {phase === 'preview' && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm uppercase font-bold bg-blue-600 text-white hover:bg-blue-500"
            >
              开始总结
            </button>
          )}
          {phase === 'result' && (
            <button
              onClick={() => onApply(draftSummary)}
              className="px-4 py-2 text-sm uppercase font-bold bg-green-600 text-white hover:bg-green-500"
            >
              应用并继续发送
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

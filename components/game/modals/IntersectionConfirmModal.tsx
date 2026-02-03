import React, { useEffect, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface IntersectionConfirmModalProps {
  isOpen: boolean;
  inputText: string;
  onConfirm: (finalInput: string) => void;
  onCancel: () => void;
}

export const IntersectionConfirmModal: React.FC<IntersectionConfirmModalProps> = ({
  isOpen,
  inputText,
  onConfirm,
  onCancel
}) => {
  const [draft, setDraft] = useState(inputText);

  useEffect(() => {
    if (isOpen) setDraft(inputText);
  }, [inputText, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-zinc-950 border-2 border-amber-600 shadow-[0_0_40px_rgba(245,158,11,0.35)] flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4 bg-gradient-to-r from-zinc-900 to-black">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-500" />
            <div>
              <div className="text-xs uppercase tracking-widest text-amber-400">交会提示确认</div>
              <div className="text-lg font-display text-white">已附加交会提示，可编辑后发送</div>
            </div>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="text-xs text-zinc-400">
            你可以直接发送，或在此编辑本次输入内容。
          </div>
          <textarea
            className="w-full min-h-[260px] bg-black border border-zinc-700 p-3 text-xs text-zinc-200 font-mono resize-none focus:border-amber-500 outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>

        <div className="border-t border-zinc-800 p-4 flex justify-end gap-3 bg-zinc-950">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm uppercase font-bold text-zinc-400 border border-zinc-700 hover:text-white hover:border-white"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(draft)}
            className="px-4 py-2 text-sm uppercase font-bold bg-amber-600 text-black hover:bg-amber-500"
          >
            确认发送
          </button>
        </div>
      </div>
    </div>
  );
};

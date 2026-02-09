import React, { useEffect, useRef, useState } from 'react';
import { X, HardDrive, Clock, FileDown, FileUp, Database } from 'lucide-react';
import { GameState, SaveSlot } from '../../../types';
import { buildSaveExportPayload, downloadSaveAsZip, parseSaveFile } from '../../../utils/saveArchive';
import { getAllSaveSlots } from '../../../utils/saveStore';

interface SaveManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  onSaveGame: (slotId?: number | string) => void;
  onLoadGame: (slotId: number | string) => void;
  onUpdateGameState: (newState: GameState) => void;
}

export const SaveManagerModal: React.FC<SaveManagerModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onSaveGame,
  onLoadGame,
  onUpdateGameState,
}) => {
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [autoSlots, setAutoSlots] = useState<SaveSlot[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadSaveSlots().catch(() => {});
    }
  }, [isOpen]);

  const loadSaveSlots = async () => {
    const all = await getAllSaveSlots();
    const manual = all.filter((s) => s.type === 'MANUAL');
    const auto = all.filter((s) => s.type === 'AUTO').sort((a, b) => b.timestamp - a.timestamp);
    setSaveSlots(manual);
    setAutoSlots(auto);
  };

  const handleExportSave = async () => {
    const exportData = buildSaveExportPayload(gameState);
    const fileBase = `danmachi_save_${gameState.角色?.姓名 || 'player'}_${new Date().toISOString().split('T')[0]}`;
    await downloadSaveAsZip(exportData, fileBase);
  };

  const handleImportSave = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { stateToLoad, summary, timeStr } = await parseSaveFile(file);
      if (window.confirm(`确认导入存档？\n\n信息: ${summary}\n时间: ${timeStr}\n\n警告：这将覆盖当前未保存进度！`)) {
        onUpdateGameState(stateToLoad);
        alert('存档导入成功！');
        onClose();
      }
    } catch (err: any) {
      console.error('导入失败:', err);
      alert(`导入失败: ${err?.message || '未知错误'}`);
    } finally {
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-3 md:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl h-full md:h-[90vh] bg-zinc-100 border-2 border-black shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-zinc-900 text-white p-4 flex justify-between items-center border-b-2 border-black">
          <div className="flex items-center gap-3">
            <HardDrive size={22} />
            <h2 className="text-xl md:text-2xl font-display uppercase tracking-widest">存档管理</h2>
          </div>
          <button onClick={onClose} className="hover:text-red-400 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <h4 className="font-bold text-sm uppercase text-zinc-500 border-b border-zinc-300 pb-1 mb-2">自动存档</h4>
              {autoSlots.length > 0 ? (
                autoSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center gap-2 bg-zinc-50 border border-zinc-300 p-3 text-xs text-zinc-900 opacity-80 hover:opacity-100 hover:border-blue-500 transition-all"
                  >
                    <Clock size={16} className="text-zinc-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate text-black">{slot.summary}</div>
                      <div className="text-zinc-600">{new Date(slot.timestamp).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => {
                        onLoadGame(slot.id);
                        onClose();
                      }}
                      className="text-blue-600 hover:underline font-bold"
                    >
                      读取
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-zinc-400 text-xs italic">暂无自动存档</div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-sm uppercase text-zinc-500 border-b border-zinc-300 pb-1 mb-2">手动存档</h4>
              {[1, 2, 3].map((id) => {
                const slot = saveSlots.find((s) => s.id === id);
                return (
                  <div key={id} className="flex items-center gap-2 bg-white border border-zinc-300 p-4 shadow-sm hover:border-black transition-colors">
                    <div className="font-display text-xl w-8 text-zinc-400">{id}</div>
                    <div className="flex-1 min-w-0">
                      {slot ? (
                        <>
                          <div className="font-bold text-sm truncate">{slot.summary}</div>
                          <div className="text-xs text-zinc-400">{new Date(slot.timestamp).toLocaleString()}</div>
                        </>
                      ) : (
                        <div className="text-zinc-300 italic">空槽位</div>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        await Promise.resolve(onSaveGame(id));
                        await loadSaveSlots();
                      }}
                      className="bg-black text-white px-3 py-1 text-xs font-bold uppercase hover:bg-green-600"
                    >
                      保存
                    </button>
                    {slot && (
                      <button
                        onClick={() => {
                          onLoadGame(id);
                          onClose();
                        }}
                        className="bg-white border border-black text-black px-3 py-1 text-xs font-bold uppercase hover:bg-blue-600 hover:text-white"
                      >
                        读取
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 border-t border-zinc-200 pt-6">
            <h4 className="font-bold text-sm uppercase text-zinc-500 border-b border-zinc-300 pb-1 mb-4 flex items-center gap-2">
              <Database size={16} /> 导入 / 导出
            </h4>
            <div className="flex flex-col md:flex-row gap-4">
              <button
                onClick={handleExportSave}
                className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-400 hover:border-black hover:bg-zinc-50 transition-all group"
              >
                <FileDown size={32} className="mb-2 text-zinc-400 group-hover:text-black" />
                <span className="font-bold uppercase text-sm text-black">导出当前存档</span>
                <span className="text-[10px] text-zinc-600">下载 .zip</span>
              </button>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-400 hover:border-blue-600 hover:bg-blue-50 transition-all group cursor-pointer"
              >
                <FileUp size={32} className="mb-2 text-zinc-400 group-hover:text-blue-600" />
                <span className="font-bold uppercase text-sm text-black group-hover:text-blue-600">导入存档</span>
                <span className="text-[10px] text-zinc-600 group-hover:text-blue-600">读取 .zip / .json</span>
                <input type="file" ref={fileInputRef} className="hidden" accept=".zip,.json" onChange={handleImportSave} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

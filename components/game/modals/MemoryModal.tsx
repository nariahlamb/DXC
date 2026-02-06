import React, { useState, useEffect } from 'react';
import { X, Brain, Save, Plus, Trash2, Layers, Cpu, Database, HardDrive, FileText, Zap, Activity } from 'lucide-react';
import { MemorySystem, MemoryEntry, LogEntry } from '../../../types';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: MemorySystem;
  logs?: LogEntry[]; 
  onUpdateMemory: (newMemory: MemorySystem) => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({ isOpen, onClose, memory, logs = [], onUpdateMemory }) => {
  const [localMemory, setLocalMemory] = useState<MemorySystem>(memory);

  useEffect(() => {
    if (isOpen) {
        setLocalMemory(JSON.parse(JSON.stringify(memory)));
    }
  }, [isOpen, memory]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateMemory(localMemory);
    onClose();
  };

  const handleUpdateList = (key: keyof MemorySystem, newList: any[]) => {
      setLocalMemory(prev => ({ ...prev, [key]: newList }));
  };

  const MemoryListEditor = ({ title, subTitle, list, onChange, placeholder, isObject, icon }: { title: string, subTitle: string, list: any[], onChange: (l: any[]) => void, placeholder: string, isObject?: boolean, icon: React.ReactNode }) => {
      const addItem = () => {
          if (isObject) {
              onChange([...list, { content: "", timestamp: "Manual" }]);
          } else {
              onChange([...list, ""]);
          }
      };

      const updateItem = (index: number, val: string) => {
          const newArr = [...list];
          if (isObject) {
              newArr[index].content = val;
          } else {
              newArr[index] = val;
          }
          onChange(newArr);
      };

      const removeItem = (index: number) => {
          onChange(list.filter((_, i) => i !== index));
      };

      return (
        <div className="flex-1 flex flex-col bg-zinc-900 border-2 border-purple-900/50 relative overflow-hidden shadow-[0_0_20px_rgba(147,51,234,0.1)] group hover:border-purple-600 transition-colors h-[360px]">
            {/* Header */}
            <div className="bg-purple-950/30 p-3 border-b border-purple-900/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 text-purple-400">
                    {icon}
                    <div>
                        <h4 className="font-bold uppercase text-xs tracking-wider text-white">{title}</h4>
                        <div className="text-[9px] font-mono text-purple-500">{subTitle}</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-purple-600">COUNT: {list.length}</span>
                    <button 
                        onClick={addItem} 
                        className="text-xs bg-purple-900 text-purple-200 px-2 py-1 hover:bg-purple-600 hover:text-white flex items-center gap-1 transition-colors border border-purple-700"
                    >
                        <Plus size={10} /> 新增
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                {list.length === 0 && <div className="text-zinc-600 text-xs italic p-4 text-center border border-dashed border-zinc-800">{placeholder}</div>}
                {list.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1 border-l-2 border-zinc-700 pl-3 hover:border-purple-500 transition-colors">
                        {isObject && (
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] text-zinc-500 font-mono bg-black px-1.5 py-0.5">
                                    {item.timestamp || 'NO TIMESTAMP'}
                                </span>
                                {item.turnIndex && (
                                    <span className="text-[9px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 font-bold">
                                        TURN {item.turnIndex}
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <textarea
                                className="flex-1 bg-black/50 text-purple-100 font-mono text-xs p-2 border border-zinc-800 focus:border-purple-500 outline-none resize-none h-16 leading-relaxed selection:bg-purple-500 selection:text-white"
                                value={isObject ? item.content : item}
                                onChange={(e) => updateItem(idx, e.target.value)}
                                spellCheck={false}
                            />
                            <button 
                                onClick={() => removeItem(idx)}
                                className="text-zinc-600 hover:text-red-500 px-1 transition-colors"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      );
  };

  const InstantMemoryView = () => {
      const recentLogs = logs.filter(l => l.sender !== 'system').slice(-30);
      const groupedLogs: { [key: number]: LogEntry[] } = {};
      const turns: number[] = [];

      recentLogs.forEach(log => {
          const turn = log.turnIndex || 0;
          if (!groupedLogs[turn]) {
              groupedLogs[turn] = [];
              turns.push(turn);
          }
          groupedLogs[turn].push(log);
      });

      return (
        <div className="flex-1 flex flex-col bg-zinc-900 border-2 border-blue-900/50 relative overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.1)] group hover:border-blue-600 transition-colors h-[360px]">
            <div className="bg-blue-950/30 p-3 border-b border-blue-900/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 text-blue-400">
                    <Zap size={16} />
                    <div>
                        <h4 className="font-bold uppercase text-xs tracking-wider text-white">1. 即时记忆</h4>
                        <div className="text-[9px] font-mono text-blue-500">INSTANT BUFFER (READ-ONLY)</div>
                    </div>
                </div>
                <Activity size={16} className="text-blue-500 animate-pulse" />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 p-3">
                {turns.length > 0 ? turns.map(turn => (
                    <div key={turn} className="bg-black/40 border border-blue-900/30 p-2">
                        <div className="flex items-center gap-2 mb-2 border-b border-blue-900/20 pb-1">
                            <Layers size={10} className="text-blue-500"/>
                            <span className="text-[10px] font-bold text-blue-400 uppercase">
                                TURN {turn} <span className="text-zinc-600 font-mono ml-2">[{groupedLogs[turn][0]?.gameTime || '??:??'}]</span>
                            </span>
                        </div>
                        {groupedLogs[turn].map((log) => (
                            <div key={log.id} className="mb-2 last:mb-0 flex gap-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase shrink-0 min-w-[40px] text-right">{log.sender}:</span>
                                <span className="text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap">{log.text}</span>
                            </div>
                        ))}
                    </div>
                )) : <div className="text-zinc-600 text-xs italic p-4 text-center">等待交互数据...</div>}
            </div>
        </div>
      );
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in zoom-in-95 duration-200">
      <div className="w-full h-full md:max-w-[1400px] md:h-[90vh] bg-black border-2 border-purple-600 relative flex flex-col shadow-[0_0_80px_rgba(147,51,234,0.2)] overflow-hidden">
        
        {/* Background Decor */}
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.1),transparent_70%)]" />
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/circuit.png')] opacity-10" />
        </div>

        {/* Header */}
        <div className="bg-purple-950/20 p-6 flex justify-between items-center border-b-2 border-purple-800 relative z-10">
             <div className="flex items-center gap-4 text-purple-400">
                <div className="p-3 border border-purple-500 bg-purple-900/20 rounded-full">
                    <Brain size={32} />
                </div>
                <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">记忆核心</h2>
                    <div className="text-[10px] font-mono tracking-[0.5em] text-purple-600 uppercase">Cognitive Process System</div>
                </div>
             </div>
             <div className="flex gap-4">
                 <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-green-700 text-white px-6 py-3 hover:bg-green-600 transition-all uppercase font-black tracking-widest text-xs border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] skew-x-[-12deg]"
                 >
                    <div className="skew-x-[12deg] flex items-center gap-2">
                        <Save size={16} /> 保存记忆
                    </div>
                 </button>
                 <button 
                    onClick={onClose} 
                    className="p-3 hover:bg-purple-600 hover:text-white text-purple-500 transition-colors border border-purple-600 rounded-full"
                 >
                    <X size={24} />
                 </button>
             </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar relative z-10 bg-black/40">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InstantMemoryView />

                <MemoryListEditor 
                    title="2. 短期记忆"
                    subTitle="SHORT TERM MEMORY"
                    icon={<Cpu size={16} />}
                    list={localMemory.shortTerm}
                    onChange={(l) => handleUpdateList('shortTerm', l)}
                    placeholder="暂无短期记忆摘要..."
                    isObject
                />

                <MemoryListEditor 
                    title="3. 中期记忆"
                    subTitle="MEDIUM TERM MEMORY"
                    icon={<Database size={16} />}
                    list={localMemory.mediumTerm}
                    onChange={(l) => handleUpdateList('mediumTerm', l)}
                    placeholder="暂无中期事件总结..."
                />

                <MemoryListEditor 
                    title="4. 长期记忆"
                    subTitle="LONG TERM STORAGE"
                    icon={<HardDrive size={16} />}
                    list={localMemory.longTerm}
                    onChange={(l) => handleUpdateList('longTerm', l)}
                    placeholder="暂无核心事实..."
                />
            </div>
        </div>
        
        <div className="p-3 bg-purple-950/30 text-center text-[10px] text-purple-400/60 font-mono border-t border-purple-900/50 shrink-0">
            WARNING: DIRECT MODIFICATION OF MEMORY CORES MAY CAUSE COGNITIVE DISSONANCE // HANDLE WITH CARE
        </div>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, ListTodo, CheckCircle2, Circle, AlertCircle, Clock, ScrollText, History, Trash2, Pin } from 'lucide-react';
import { Task } from '../../../types';

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onDeleteTask?: (id: string) => void;
  onUpdateTask?: (id: string, status: Task['状态'], note?: string) => void;
}

type TaskFilter = 'ACTIVE' | 'COMPLETED' | 'FAILED';

const statusLabel = (status: Task['状态']) => {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '已失败';
  return '进行中';
};

export const TasksModal: React.FC<TasksModalProps> = ({ isOpen, onClose, tasks = [], onDeleteTask, onUpdateTask }) => {
  const [filter, setFilter] = useState<TaskFilter>('ACTIVE');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [manualNote, setManualNote] = useState('');

  if (!isOpen) return null;

  const filteredTasks = tasks.filter(t => {
    if (filter === 'ACTIVE') return t.状态 === 'active';
    if (filter === 'COMPLETED') return t.状态 === 'completed';
    if (filter === 'FAILED') return t.状态 === 'failed';
    return true;
  });

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'SSS':
      case 'SS':
      case 'S': return 'text-yellow-600 border-yellow-600 bg-yellow-100';
      case 'A': return 'text-red-600 border-red-600 bg-red-100';
      case 'B': return 'text-blue-600 border-blue-600 bg-blue-100';
      default: return 'text-zinc-600 border-zinc-400 bg-zinc-100';
    }
  };

  const handleDelete = () => {
    if (selectedTask && onDeleteTask && (selectedTask.状态 === 'completed' || selectedTask.状态 === 'failed')) {
      if (confirm("确定要删除这个任务记录吗？")) {
        onDeleteTask(selectedTask.id);
        setSelectedTask(null);
      }
    }
  };

  const handleStatusUpdate = (status: Task['状态']) => {
    if (!selectedTask || !onUpdateTask) return;
    onUpdateTask(selectedTask.id, status, manualNote);
    setManualNote('');
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-6xl h-[85vh] bg-zinc-900 border-4 border-yellow-500 relative shadow-[0_0_60px_rgba(234,179,8,0.2)] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-yellow-500 p-6 flex justify-between items-center text-black shrink-0 relative z-10">
          {/* Diagonal Stripes Pattern */}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)] pointer-events-none" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-black text-yellow-500 p-3 transform -rotate-3 shadow-lg">
                <ListTodo className="w-8 h-8" />
            </div>
            <div>
                <h2 className="text-4xl font-black uppercase tracking-tighter italic">公会委托板</h2>
                <div className="text-xs font-mono font-bold tracking-widest">GUILD REQUESTS BOARD</div>
            </div>
          </div>
          <button onClick={onClose} className="bg-black text-yellow-500 hover:bg-zinc-800 hover:text-white transition-colors p-3 rounded-full relative z-10">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content Container */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-[#27272a] relative">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cork-board.png')] opacity-20 pointer-events-none" />
          
          {/* Left: List & Filter */}
          <div className="w-full md:w-80 border-r-4 border-black/20 flex flex-col bg-zinc-900/80 backdrop-blur-sm relative z-10 shadow-xl">
            <div className="flex bg-black">
              {(['ACTIVE', 'COMPLETED', 'FAILED'] as TaskFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setSelectedTask(null); }}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition-all border-b-4
                    ${filter === f 
                      ? 'bg-yellow-500 text-black border-yellow-700' 
                      : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-300'
                    }
                  `}
                >
                  {f === 'ACTIVE' ? '进行中' : f === 'COMPLETED' ? '已完成' : '已失败'}
                </button>
              ))}
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {filteredTasks.length > 0 ? filteredTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`p-4 border-l-8 cursor-pointer transition-all hover:-translate-y-1 shadow-md group relative overflow-hidden
                    ${selectedTask?.id === task.id 
                      ? 'bg-yellow-100 border-yellow-600' 
                      : 'bg-zinc-100 border-zinc-400 hover:bg-white'
                    }
                  `}
                >
                  <div className="flex justify-between items-start mb-2 relative z-10">
                    <h4 className={`font-black uppercase text-sm leading-tight line-clamp-2 ${selectedTask?.id === task.id ? 'text-black' : 'text-zinc-800'}`}>
                      {task.标题}
                    </h4>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 border-2 ml-2 whitespace-nowrap ${getGradeColor(task.评级)}`}>
                      {task.评级}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 relative z-10">
                    {task.状态 === 'completed' && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12}/> 完成</span>}
                    {task.状态 === 'failed' && <span className="text-red-600 flex items-center gap-1"><AlertCircle size={12}/> 失败</span>}
                    {task.状态 === 'active' && <span className="text-yellow-600 flex items-center gap-1"><Circle size={12} className="fill-current"/> 进行中</span>}
                    <span className="truncate max-w-[100px]">| {task.奖励}</span>
                  </div>
                  
                  {/* Selection Indicator */}
                  {selectedTask?.id === task.id && (
                      <div className="absolute top-2 right-2 text-yellow-600 opacity-20 transform rotate-12 pointer-events-none">
                          <Pin size={48} className="fill-current" />
                      </div>
                  )}
                </div>
              )) : (
                <div className="text-center py-12 text-zinc-500 font-mono text-xs border-2 border-dashed border-zinc-700 mx-2">
                  暂无相关委托
                </div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex-1 p-6 md:p-10 overflow-y-auto custom-scrollbar relative z-10">
            {selectedTask ? (
              <div className="max-w-3xl mx-auto bg-[#fdfbf7] text-[#292524] p-8 md:p-12 shadow-[0_10px_40px_rgba(0,0,0,0.5)] min-h-full relative transform rotate-1 transition-transform border border-[#e7e5e4]">
                {/* Paper Texture & Pin */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-red-700 shadow-lg border-2 border-red-900 z-20 flex items-center justify-center">
                    <div className="w-3 h-3 bg-red-900/50 rounded-full" />
                </div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] opacity-50 pointer-events-none" />
                
                {/* Stamp */}
                <div className={`absolute top-10 right-10 border-8 rounded px-6 py-2 transform rotate-[-12deg] opacity-60 font-black text-4xl uppercase tracking-widest mix-blend-multiply pointer-events-none
                  ${selectedTask.状态 === 'active' ? 'border-blue-700 text-blue-700' : 
                    selectedTask.状态 === 'completed' ? 'border-red-700 text-red-700' : 'border-zinc-800 text-zinc-800'}
                `}>
                  {selectedTask.状态 === 'active' ? 'ACCEPTED' : selectedTask.状态 === 'completed' ? 'CLEARED' : 'FAILED'}
                </div>

                <div className="relative z-10 font-serif">
                  <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter border-b-4 border-black pb-4 mb-6 leading-none">
                    {selectedTask.标题}
                  </h2>
                  
                  <div className="flex flex-wrap gap-6 text-sm font-bold text-zinc-600 mb-8 bg-yellow-50 p-4 border-l-4 border-yellow-500">
                    <span className="flex items-center gap-2 uppercase tracking-wider">
                      <AlertCircle size={16} /> 评级: <span className="text-black text-lg">{selectedTask.评级}</span>
                    </span>
                    <span className="flex items-center gap-2 uppercase tracking-wider">
                      <Clock size={16} /> 截止: <span className="text-black">{selectedTask.截止时间 || "无限制"}</span>
                    </span>
                  </div>

                  <div className="mb-10">
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 flex items-center gap-2">
                      <ScrollText size={16}/> 委托详情 / DESCRIPTION
                    </h4>
                    <p className="text-lg leading-relaxed whitespace-pre-wrap text-zinc-800">
                      {selectedTask.描述}
                    </p>
                  </div>

                  <div className="bg-zinc-100 p-6 border-2 border-dashed border-zinc-300 mb-8 relative">
                    <div className="absolute -top-3 left-6 bg-zinc-800 text-white px-3 py-0.5 text-xs font-bold uppercase tracking-widest">REWARD</div>
                    <p className="font-black text-2xl text-zinc-800">{selectedTask.奖励}</p>
                  </div>

                  {onUpdateTask && (
                    <div className="bg-yellow-50 p-6 border border-yellow-200 mb-8">
                      <h4 className="text-xs font-black uppercase tracking-widest text-yellow-700 mb-3">管理员操作 / ADMIN ACTIONS</h4>
                      <textarea
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        placeholder="可选：填写手动备注/结案说明..."
                        className="w-full h-20 bg-white border border-yellow-300 p-3 text-sm resize-none mb-4 outline-none focus:border-yellow-500"
                      />
                      <div className="flex flex-wrap gap-3">
                        {selectedTask.状态 !== 'completed' && (
                          <button
                            onClick={() => handleStatusUpdate('completed')}
                            className="px-4 py-2 text-xs font-bold border-2 border-green-600 text-green-700 hover:bg-green-600 hover:text-white uppercase tracking-wider transition-colors"
                          >
                            标记完成
                          </button>
                        )}
                        {selectedTask.状态 !== 'failed' && (
                          <button
                            onClick={() => handleStatusUpdate('failed')}
                            className="px-4 py-2 text-xs font-bold border-2 border-red-600 text-red-700 hover:bg-red-600 hover:text-white uppercase tracking-wider transition-colors"
                          >
                            标记失败
                          </button>
                        )}
                        {selectedTask.状态 !== 'active' && (
                          <button
                            onClick={() => handleStatusUpdate('active')}
                            className="px-4 py-2 text-xs font-bold border-2 border-blue-600 text-blue-700 hover:bg-blue-600 hover:text-white uppercase tracking-wider transition-colors"
                          >
                            重新激活
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedTask.日志 && selectedTask.日志.length > 0 && (
                    <div className="border-t-4 border-zinc-200 pt-6">
                      <h4 className="text-sm font-black uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
                        <History size={16}/> 更新记录 / LOGS
                      </h4>
                      <div className="space-y-3">
                        {selectedTask.日志.map((log, idx) => (
                          <div key={idx} className="flex gap-4 text-sm border-b border-zinc-100 pb-2 last:border-0">
                            <span className="font-mono text-zinc-400 text-xs shrink-0 pt-0.5">{log.时间戳}</span>
                            <span className="text-zinc-700">{log.内容}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-end mt-12 pt-6 border-t border-black">
                    <div className="text-[10px] uppercase text-zinc-400 font-mono tracking-widest">
                      REF_ID: #{selectedTask.id.substring(0,8).toUpperCase()}
                    </div>
                    {onDeleteTask && selectedTask.状态 !== 'active' && (
                      <button 
                        onClick={handleDelete}
                        className="flex items-center gap-2 text-red-700 border-b-2 border-transparent hover:border-red-700 font-bold transition-colors text-xs uppercase tracking-wider"
                      >
                        <Trash2 size={14} /> 删除记录
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-30">
                <ScrollText size={80} className="mb-6" />
                <span className="font-black text-3xl uppercase tracking-widest italic">请选择任务</span>
                <span className="text-sm font-mono mt-2">SELECT A REQUEST TO VIEW DETAILS</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

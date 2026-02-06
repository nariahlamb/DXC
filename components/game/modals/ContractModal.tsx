import React from 'react';
import { X, Scroll, PenTool, Clock, Flag, AlertTriangle, FileSignature } from 'lucide-react';
import { Contract } from '../../../types';

interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  contracts: Contract[];
}

const statusLabel = (status?: string) => {
  if (!status) return '未知';
  if (status === 'active') return '生效中';
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '已失败';
  if (status === 'expired') return '已到期';
  return status;
};

export const ContractModal: React.FC<ContractModalProps> = ({ isOpen, onClose, contracts = [] }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="w-full h-[85vh] max-w-6xl relative flex flex-col perspective-1000">
        
        {/* Header */}
        <div className="bg-[#450a0a] p-6 flex justify-between items-center border-b-4 border-red-600 shadow-2xl z-20 transform -rotate-1 skew-x-[-2deg]">
          <div className="flex items-center gap-6">
            <div className="bg-red-950 p-3 border border-red-700 transform rotate-3">
                <FileSignature size={40} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[3px_3px_0_rgba(185,28,28,0.5)]">契约管理</h2>
              <div className="text-xs font-mono text-red-400 tracking-[0.5em] uppercase mt-1">Active Contracts</div>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-3 hover:bg-red-600 hover:text-white text-red-500 transition-colors border-2 border-red-600 rounded-full bg-red-950"
          >
            <X size={24} strokeWidth={3} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-12 bg-zinc-900 relative shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] border-x-4 border-b-4 border-[#2a0a0a]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {contracts.length > 0 ? contracts.map((c, idx) => (
              <div 
                key={c.id} 
                className="relative group perspective-500 hover:z-10 transition-all duration-500 hover:scale-105"
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                {/* Paper Sheet */}
                <div className="relative bg-[#e5e5e5] text-black p-8 shadow-[20px_20px_60px_rgba(0,0,0,0.5)] transform transition-all duration-500 group-hover:rotate-0 group-hover:shadow-[30px_30px_80px_rgba(0,0,0,0.7)] origin-center"
                  style={{ transform: `rotate(${idx % 2 === 0 ? '-3deg' : '3deg'})` }}
                >
                  {/* Texture Overlay */}
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] opacity-60 pointer-events-none mix-blend-multiply" />
                  <div className="absolute top-0 left-0 w-full h-full border-[3px] border-double border-[#737373] m-3 pointer-events-none opacity-50" />

                  {/* Stamp */}
                  <div className={`absolute top-8 right-8 w-28 h-28 border-[6px] rounded-full flex items-center justify-center transform rotate-[-20deg] opacity-80 mix-blend-multiply pointer-events-none
                    ${c.状态 === 'active' ? 'border-red-700 text-red-700' : 'border-zinc-500 text-zinc-500'}
                  `}>
                    <div className="text-xl font-black uppercase tracking-widest border-y-2 border-current py-1 text-center leading-none">
                      {statusLabel(c.状态)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10 font-serif">
                    <div className="flex items-center gap-3 border-b-2 border-black pb-4 mb-6">
                      <PenTool size={28} />
                      <h3 className="text-3xl font-black uppercase tracking-tight">{c.名称}</h3>
                    </div>
                    
                    <p className="text-lg leading-relaxed mb-8 italic text-zinc-800 border-l-4 border-red-800 pl-4">
                      “{c.描述}”
                    </p>

                    <div className="grid grid-cols-1 gap-4 text-sm text-zinc-900 mb-8 bg-[#d4d4d4] p-4 border border-zinc-400">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-zinc-600" /> 
                        <span className="font-bold">开始时间：</span> {c.开始时间 || "未知"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-zinc-600" /> 
                        <span className="font-bold">结束时间：</span> {c.结束时间 || "未知"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Flag size={16} className="text-zinc-600" /> 
                        <span className="font-bold">结束条件：</span> {c.结束条件 || "未设定"}
                      </div>
                      {c.违约代价 && (
                        <div className="flex items-center gap-2 text-red-700 font-bold bg-red-100 p-2 border border-red-300">
                          <AlertTriangle size={16} /> 违约代价：{c.违约代价}
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-white p-5 border border-zinc-300 text-xs font-mono text-zinc-700 relative shadow-inner">
                      <div className="absolute -top-3 left-4 bg-zinc-800 text-white px-3 py-0.5 font-bold uppercase text-[10px] tracking-widest">TERMS & CONDITIONS</div>
                      <p className="leading-relaxed whitespace-pre-wrap">{c.条款 || "本契约未包含详细条款文本。"}</p>
                    </div>

                    <div className="mt-8 pt-4 border-t border-dashed border-black/30 flex justify-between items-end">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
                        ID: {c.id.substring(0,8).toUpperCase()}
                      </div>
                      <div className="font-cursive text-3xl text-black transform -rotate-3 opacity-80" style={{ fontFamily: 'cursive' }}>
                        Signed & Sealed
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Pin */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-red-800 shadow-[0_4px_6px_rgba(0,0,0,0.5)] border-2 border-white z-30" />
              </div>
            )) : (
              <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-40">
                <Scroll size={80} className="mb-6 text-[#5c4024]" />
                <h3 className="text-[#8b5a2b] font-display text-4xl uppercase tracking-widest mb-2">暂无契约</h3>
                <p className="text-zinc-500 font-mono uppercase tracking-wider">NO ACTIVE CONTRACTS FOUND</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { X, Flag, Coins, Home, Package, Crown, Landmark } from 'lucide-react';
import { FamiliaState } from '../../../types';

interface FamiliaModalProps {
  isOpen: boolean;
  onClose: () => void;
  familia: FamiliaState;
}

export const FamiliaModal: React.FC<FamiliaModalProps> = ({ isOpen, onClose, familia }) => {
  if (!isOpen) return null;

  // Safety fallback
  const safeFamilia = familia || {
      名称: "无",
      主神: "None",
      等级: "I",
      资金: 0,
      声望: 0,
      仓库: [],
      设施状态: {}
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-5xl bg-blue-950 border-2 border-yellow-500 relative flex flex-col shadow-[0_0_80px_rgba(234,179,8,0.2)] overflow-hidden">
        
        {/* Background Decor */}
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-50%] left-[-20%] w-[150%] h-[200%] bg-blue-900/20 transform rotate-12" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-600/5 rounded-full blur-3xl" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diamond-upholstery.png')] opacity-10" />
        </div>

        {/* Header */}
        <div className="bg-blue-900/80 p-8 flex justify-between items-start border-b-4 border-yellow-500 relative z-10 shrink-0">
             <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 text-yellow-400">
                    <div className="p-3 bg-blue-950 border-2 border-yellow-500 transform rotate-45 shadow-lg">
                        <Flag size={32} className="transform -rotate-45" />
                    </div>
                    <div>
                        <h2 className="text-5xl font-black uppercase tracking-tighter text-white drop-shadow-[0_4px_0_rgba(29,78,216,1)]">
                            {safeFamilia.名称}
                        </h2>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="bg-blue-800 text-blue-200 text-xs px-2 py-0.5 font-bold uppercase tracking-wider border border-blue-600">FAMILIA MYTH</span>
                            <span className="text-yellow-500 font-serif italic text-lg">God: {safeFamilia.主神}</span>
                        </div>
                    </div>
                </div>
             </div>
             <button 
                onClick={onClose} 
                className="p-3 hover:bg-yellow-500 hover:text-black text-yellow-500 transition-colors border-2 border-yellow-500 rounded-full group"
             >
                <X size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform" />
             </button>
        </div>

        <div className="p-8 text-white space-y-8 flex-1 overflow-y-auto custom-scrollbar relative z-10">
            
            {/* Main Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Funds */}
                <div className="bg-black/40 border border-yellow-500/30 p-6 flex flex-col items-center justify-center gap-3 relative group hover:bg-blue-900/20 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-transparent" />
                    <div className="bg-yellow-600/20 p-4 rounded-full text-yellow-400 mb-1 group-hover:scale-110 transition-transform"><Coins size={32} /></div>
                    <div className="text-center">
                        <div className="text-xs text-yellow-600 font-bold uppercase tracking-widest mb-1">眷族资金 / FUNDS</div>
                        <div className="text-3xl font-mono text-white">{safeFamilia.资金?.toLocaleString() || 0} <span className="text-sm text-zinc-500">Valis</span></div>
                    </div>
                </div>

                {/* Rank */}
                <div className="bg-black/40 border border-blue-500/30 p-6 flex flex-col items-center justify-center gap-3 relative group hover:bg-blue-900/20 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-transparent" />
                    <div className="bg-blue-600/20 p-4 rounded-full text-blue-400 mb-1 group-hover:scale-110 transition-transform"><Home size={32} /></div>
                    <div className="text-center">
                        <div className="text-xs text-blue-600 font-bold uppercase tracking-widest mb-1">据点等级 / RANK</div>
                        <div className="text-3xl font-display text-white">{safeFamilia.等级}</div>
                    </div>
                </div>

                {/* Renown */}
                <div className="bg-black/40 border border-purple-500/30 p-6 flex flex-col items-center justify-center gap-3 relative group hover:bg-blue-900/20 transition-colors">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-transparent" />
                    <div className="bg-purple-600/20 p-4 rounded-full text-purple-400 mb-1 group-hover:scale-110 transition-transform"><Crown size={32} /></div>
                    <div className="text-center w-full">
                        <div className="text-xs text-purple-600 font-bold uppercase tracking-widest mb-1">声望 / RENOWN</div>
                        <div className="text-3xl font-mono text-white mb-2">{safeFamilia.声望 ?? 0}</div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, (safeFamilia.声望 ?? 0) / 100)}%` }} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Warehouse Section */}
                <div className="bg-black/20 border border-blue-900/50 flex flex-col">
                    <div className="bg-blue-900/30 p-3 border-b border-blue-900/50 flex items-center justify-between">
                        <h3 className="text-blue-300 uppercase font-bold text-sm tracking-widest flex items-center gap-2">
                            <Package size={16} /> 眷族仓库 / WAREHOUSE
                        </h3>
                        <span className="text-[10px] text-blue-500 font-mono">{safeFamilia.仓库?.length || 0} ITEMS</span>
                    </div>
                    
                    <div className="p-4 min-h-[240px] max-h-[300px] overflow-y-auto custom-scrollbar">
                        {safeFamilia.仓库 && safeFamilia.仓库.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                                {safeFamilia.仓库.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-blue-950/40 p-3 border-l-2 border-blue-600 hover:bg-blue-900/40 transition-colors group">
                                        <span className="text-zinc-200 text-sm font-bold group-hover:text-white">{item.名称}</span>
                                        <span className="text-blue-400 text-xs font-mono bg-black/30 px-2 py-0.5 rounded">x{item.数量}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                                <Package size={48} className="mb-4 opacity-20" />
                                <p className="italic text-xs">仓库空空如也。</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Facilities Section */}
                <div className="bg-black/20 border border-yellow-900/50 flex flex-col">
                    <div className="bg-yellow-900/20 p-3 border-b border-yellow-900/50 flex items-center justify-between">
                        <h3 className="text-yellow-500 uppercase font-bold text-sm tracking-widest flex items-center gap-2">
                            <Landmark size={16} /> 设施概况 / FACILITIES
                        </h3>
                        <span className="text-[10px] text-yellow-600 font-mono">STATUS: ACTIVE</span>
                    </div>
                    
                    <div className="p-4 min-h-[240px] text-sm text-zinc-300 font-mono leading-relaxed">
                        {safeFamilia.设施状态 && Object.keys(safeFamilia.设施状态).length > 0 ? (
                            <div className="space-y-2">
                                {Object.entries(safeFamilia.设施状态).map(([key, status], idx) => (
                                    <div key={idx} className="flex justify-between border-b border-zinc-800 pb-2">
                                        <span className="text-zinc-400">{key}</span>
                                        <span className="text-yellow-400">{String(status)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600">
                                <Landmark size={48} className="mb-4 opacity-20" />
                                <div className="text-sm text-zinc-500 italic">暂无特殊设施建设。</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

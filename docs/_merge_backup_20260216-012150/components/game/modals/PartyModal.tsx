import React, { useState, useEffect } from 'react';
import { X, Swords, Shield, User, Backpack, Crown, Dna, Clock, Activity, Zap, Star, Layout } from 'lucide-react';
import { Confidant } from '../../../types';
import { getTypeLabel, getQualityLabel, normalizeQuality } from '../../../utils/itemUtils';

interface PartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  characters: Confidant[];
}

const isAdventurer = (c: Confidant) =>
  typeof c.身份 === 'string' && c.身份.includes('冒险者');

const getLevelLabel = (c: Confidant) =>
  isAdventurer(c) ? `Lv.${c.等级 || '???'}` : '非冒险者';

const StatBar = ({ label, current, max, color }: { label: string; current: number; max: number; color: string }) => (
    <div className="flex items-center gap-3 text-xs font-bold text-white">
        <span className="w-8 font-mono uppercase text-zinc-500">{label}</span>
        <div className="flex-1 h-3 bg-zinc-900 border border-zinc-700 skew-x-[-12deg] overflow-hidden">
            <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${Math.min(100, (current/max)*100)}%` }} />
        </div>
        <span className="font-mono w-16 text-right text-zinc-300">{current}/{max}</span>
    </div>
);

const StatBlock = ({ label, val }: { label: string; val: any }) => (
    <div className="bg-zinc-900/80 border-l-2 border-red-500 p-2 flex justify-between items-center hover:bg-red-900/20 transition-colors">
        <span className="text-red-400 font-bold text-[10px] uppercase tracking-wider">{label}</span>
        <span className="font-display text-lg text-white">{val || '-'}</span>
    </div>
);

const EquipRow = ({ label, item }: { label: string; item: string | undefined }) => (
    <div className="flex flex-col gap-1 bg-black/40 p-2 border border-zinc-800">
        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
        <div className="font-display text-sm uppercase text-zinc-200 truncate">
            {item || "未装备"}
        </div>
    </div>
);

export const PartyModal: React.FC<PartyModalProps> = ({ isOpen, onClose, characters }) => {
  if (!isOpen) return null;

  const partyMembers = characters.filter(c => c.是否队友);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(partyMembers[0]?.id || "");
  const selectedMember = partyMembers.find(c => c.id === selectedMemberId);

  useEffect(() => {
    if (partyMembers.length === 0) return;
    if (!selectedMemberId || !partyMembers.some(c => c.id === selectedMemberId)) {
      setSelectedMemberId(partyMembers[0].id);
    }
  }, [partyMembers, selectedMemberId]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in zoom-in-95 duration-300">
      <div className="w-full max-w-7xl h-[85vh] relative flex flex-col md:flex-row overflow-hidden shadow-[0_0_60px_rgba(220,38,38,0.3)] border-2 border-red-600 bg-zinc-950">
        
        {/* Background Decor */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-[-20%] w-[60%] h-full bg-red-900/10 transform skew-x-[-12deg]" />
            <div className="absolute bottom-0 left-[-30%] w-[50%] h-full bg-red-950/20 transform skew-x-[-12deg]" />
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
        </div>

        {/* --- Sidebar (Roster List) --- */}
        <div className="w-full md:w-80 z-10 flex flex-col relative border-b md:border-b-0 md:border-r-4 border-red-800 bg-black/60">
            <div className="p-6 bg-red-700 text-white transform skew-x-[-6deg] -ml-4 w-[120%] shadow-lg relative z-20">
                <div className="transform skew-x-[6deg] ml-4">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-2">
                        <Swords size={28} className="text-black" /> 队伍
                    </h2>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-red-200 mt-1">PARTY ROSTER</p>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                {partyMembers.length > 0 ? partyMembers.map(c => (
                    <button 
                        key={c.id}
                        onClick={() => setSelectedMemberId(c.id)}
                        className={`w-full group relative transition-all duration-200 overflow-hidden border-2 p-3 text-left
                            ${selectedMemberId === c.id 
                                ? 'bg-red-900/40 border-red-500 translate-x-2' 
                                : 'bg-zinc-900/60 border-zinc-800 hover:border-red-500/50 hover:bg-zinc-800'
                            }
                        `}
                    >
                        <div className="flex items-center gap-3 relative z-10">
                            {/* Small Avatar */}
                            <div className={`w-10 h-10 flex items-center justify-center font-bold text-lg border-2 shrink-0 bg-black ${selectedMemberId === c.id ? 'border-white text-white' : 'border-zinc-700 text-zinc-500'}`}>
                                {c.姓名[0]}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className={`font-display uppercase italic tracking-wide truncate ${selectedMemberId === c.id ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`}>
                                    {c.姓名}
                                </div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 flex gap-2">
                                    <span className="text-red-400">{getLevelLabel(c)}</span>
                                    <span>{c.身份}</span>
                                </div>
                            </div>
                            
                            {selectedMemberId === c.id && <Crown size={14} className="text-yellow-500 animate-pulse" />}
                        </div>
                        {/* Selection Highlight Bar */}
                        {selectedMemberId === c.id && <div className="absolute inset-y-0 left-0 w-1 bg-red-500" />}
                    </button>
                )) : (
                    <div className="text-zinc-500 text-sm italic p-8 text-center border-2 border-dashed border-zinc-800">
                        暂无队伍成员
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-red-900/30">
                <button 
                    onClick={onClose} 
                    className="w-full py-3 border-2 border-zinc-600 text-zinc-400 hover:text-white hover:border-white hover:bg-zinc-800 uppercase font-bold tracking-widest text-xs flex items-center justify-center gap-2"
                >
                    <X size={16} /> 关闭
                </button>
            </div>
        </div>

        {/* --- Main Content (Detailed Stats) --- */}
        <div className="flex-1 z-10 relative flex flex-col bg-zinc-950/80 overflow-y-auto custom-scrollbar">
             {selectedMember ? (
                 <div className="flex-1 flex flex-col p-6 md:p-10 animate-in fade-in slide-in-from-right-4 duration-300">
                     
                     {/* Top: Header & Bio */}
                     <div className="flex flex-col md:flex-row md:justify-between md:items-end border-b-2 border-red-600 pb-6 mb-8 gap-6">
                         <div>
                             <h1 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter uppercase leading-none drop-shadow-[4px_4px_0_rgba(185,28,28,0.5)]">
                                 {selectedMember.姓名}
                             </h1>
                             <div className="flex flex-wrap gap-4 mt-3 text-xs font-mono text-red-200/70">
                                 <span className="flex items-center gap-1 bg-red-950/30 px-2 py-0.5 border border-red-900/50"><Dna size={12}/> {selectedMember.种族}</span>
                                 <span className="flex items-center gap-1 bg-red-950/30 px-2 py-0.5 border border-red-900/50"><User size={12}/> {selectedMember.性别}</span>
                                 <span className="flex items-center gap-1 bg-red-950/30 px-2 py-0.5 border border-red-900/50"><Clock size={12}/> {selectedMember.年龄}岁</span>
                             </div>
                         </div>
                         <div className="text-right">
                             <div className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em]">LEVEL</div>
                             <div className="text-5xl font-display text-white italic">{isAdventurer(selectedMember) ? (selectedMember.等级 || '?') : '-'}</div>
                         </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                         
                         {/* Stats Column */}
                         <div className="space-y-6">
                             {/* Vitals */}
                             <div className="bg-black/40 p-5 border border-zinc-800">
                                 <h4 className="text-zinc-500 font-bold uppercase text-xs mb-4 flex items-center gap-2">
                                     <Activity size={14} className="text-red-500"/> 生存数值 / VITALS
                                 </h4>
                                 <div className="space-y-3">
                                    <StatBar label="生命 HP" current={selectedMember.生存数值?.当前生命 || 100} max={selectedMember.生存数值?.最大生命 || 100} color="bg-green-600" />
                                    <StatBar label="精神 MP" current={selectedMember.生存数值?.当前精神 || 50} max={selectedMember.生存数值?.最大精神 || 50} color="bg-blue-600" />
                                    <StatBar label="体力 ST" current={selectedMember.生存数值?.当前体力 || 100} max={selectedMember.生存数值?.最大体力 || 100} color="bg-yellow-600" />
                                 </div>
                             </div>

                             {/* Attributes */}
                             <div>
                                <h4 className="text-zinc-500 font-bold uppercase text-xs mb-3 flex items-center gap-2">
                                     <Zap size={14} className="text-yellow-500"/> 基础能力 / STATS
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <StatBlock label="力量 STR" val={selectedMember.能力值?.力量} />
                                    <StatBlock label="耐久 END" val={selectedMember.能力值?.耐久} />
                                    <StatBlock label="灵巧 DEX" val={selectedMember.能力值?.灵巧} />
                                    <StatBlock label="敏捷 AGI" val={selectedMember.能力值?.敏捷} />
                                    <StatBlock label="魔力 MAG" val={selectedMember.能力值?.魔力} />
                                </div>
                             </div>
                         </div>

                         {/* Gear Column */}
                         <div className="space-y-6 flex flex-col">
                             <div className="bg-zinc-900/30 p-5 border-l-4 border-zinc-700">
                                 <h4 className="text-white font-bold uppercase text-sm mb-4 flex items-center gap-2">
                                     <Shield size={16} className="text-blue-400"/> 装备 / EQUIPMENT
                                 </h4>
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <EquipRow label="主手武器" item={selectedMember.装备?.主手} />
                                     <EquipRow label="身体防具" item={selectedMember.装备?.身体} />
                                     <EquipRow label="头部装备" item={selectedMember.装备?.头部} />
                                     <EquipRow label="饰品" item={selectedMember.装备?.饰品} />
                                 </div>
                             </div>

                             <div className="bg-black/40 border border-zinc-800 p-5 flex flex-col flex-1 min-h-[200px]">
                                 <h4 className="text-zinc-500 font-bold uppercase text-xs mb-3 flex items-center gap-2">
                                     <Backpack size={14}/> 独立背包 / INVENTORY
                                 </h4>
                                 <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                         {selectedMember.背包 && selectedMember.背包.length > 0 ? selectedMember.背包.slice(0, 12).map((item, i) => (
                                             <div key={item.id || i} className="bg-zinc-900 p-2 border border-zinc-700 flex items-center gap-3">
                                                 <div className="w-8 h-8 bg-black flex items-center justify-center border border-zinc-800 text-zinc-600">
                                                     <Layout size={14} />
                                                 </div>
                                                 <div className="flex-1 min-w-0">
                                                     <div className="text-[10px] text-zinc-500 uppercase">{getTypeLabel(item.类型)}</div>
                                                     <div className="text-xs text-zinc-200 truncate font-bold">{item.名称}</div>
                                                 </div>
                                                 <div className="text-[10px] font-mono text-zinc-500">x{item.数量}</div>
                                             </div>
                                         )) : <div className="col-span-full text-zinc-600 text-xs italic text-center py-8">背包空空如也</div>}
                                     </div>
                                 </div>
                             </div>
                         </div>

                     </div>
                 </div>
             ) : (
                 <div className="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50">
                     <User size={64} className="mb-4" />
                     <div className="font-display text-2xl uppercase tracking-widest">请选择队友</div>
                 </div>
             )}
        </div>

      </div>
    </div>
  );
};

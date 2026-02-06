import React, { useState, useRef } from 'react';
import { X, Heart, Eye, EyeOff, Upload, MessageSquareDashed, Swords, Dna, Clock, ChevronDown, ChevronUp, Radio, User, Star, Activity, Shield, Sword } from 'lucide-react';
import { Confidant } from '../../../types';

interface SocialModalProps {
  isOpen: boolean;
  onClose: () => void;
  confidants: Confidant[];
  onAddToQueue: (cmd: string, undoAction?: () => void, dedupeKey?: string) => void;
  onUpdateConfidant: (id: string, updates: Partial<Confidant>) => void;
}

type SocialTab = 'SPECIAL' | 'ALL';

interface NormalCardProps {
    c: Confidant;
    onToggleAttention: (c: Confidant) => void;
    onToggleContext: (c: Confidant) => void;
}

const isAdventurer = (c: Confidant) =>
    typeof c.身份 === 'string' && c.身份.includes('冒险者');

const getLevelLabel = (c: Confidant) =>
    isAdventurer(c) ? (c.等级 ?? '???') : '平民';

// --- Components ---

const StatBar = ({ label, value, max = 100, color = 'bg-pink-500' }: { label: string; value: number; max?: number; color?: string }) => (
  <div className="flex items-center gap-2 text-[10px]">
    <span className="w-8 font-bold text-zinc-500 uppercase">{label}</span>
    <div className="flex-1 h-1.5 bg-zinc-800 skew-x-[-12deg] overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
    </div>
    <span className="w-6 text-right font-mono text-zinc-300">{value}</span>
  </div>
);

const NormalCard: React.FC<NormalCardProps> = ({ c, onToggleAttention, onToggleContext }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div className="group relative bg-zinc-900/80 border-l-4 border-pink-500/50 hover:border-pink-500 transition-all duration-300 overflow-hidden flex flex-col">
          {/* Hover Effect Background */}
          <div className="absolute inset-0 bg-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          
          <div className="p-3 flex gap-3 relative z-10">
              {/* Avatar */}
              <div className="w-14 h-14 bg-black border border-zinc-700 shrink-0 overflow-hidden relative">
                  {c.头像 ? (
                      <img src={c.头像} alt={c.姓名} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold text-2xl">{c.姓名[0]}</div>
                  )}
                  {c.是否在场 && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full" title="在场" />}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                      <div>
                          <h3 className="text-white font-bold text-sm truncate flex items-center gap-2 group-hover:text-pink-400 transition-colors">
                              {c.姓名}
                              {c.是否队友 && <Swords size={12} className="text-indigo-400" title="队友" />}
                          </h3>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{c.身份} · Lv.{getLevelLabel(c)}</div>
                      </div>
                      
                      <div className="flex gap-1">
                          <button 
                              onClick={(e) => { e.stopPropagation(); onToggleContext(c); }}
                              className={`p-1.5 transition-all hover:scale-110 ${c.强制包含上下文 ? 'text-green-400' : 'text-zinc-600 hover:text-green-400'}`}
                              title="强制包含至AI上下文"
                          >
                              <Radio size={14} />
                          </button>
                          <button 
                              onClick={(e) => { e.stopPropagation(); onToggleAttention(c); }}
                              className="p-1.5 text-zinc-600 hover:text-yellow-400 hover:scale-110 transition-all"
                              title="设为特别关心"
                          >
                              <Eye size={14} />
                          </button>
                      </div>
                  </div>
                  
                  <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-pink-500 font-bold text-xs">
                          <Heart size={12} fill="currentColor" />
                          <span>{c.好感度 || 0}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400">{c.关系状态}</div>
                  </div>
              </div>
          </div>

          {/* Expand Toggle */}
          <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className={`w-full py-1.5 text-[9px] uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-1 mt-auto
                  ${isExpanded ? 'bg-pink-900/30 text-pink-300' : 'bg-black/40 text-zinc-500 hover:text-pink-300 hover:bg-pink-900/20'}
              `}
              >
              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />} {isExpanded ? '收起记忆' : 'NPC 记忆'}
          </button>

          {/* Memories */}
          {isExpanded && (
              <div className="bg-black/60 p-3 border-t border-zinc-800 animate-in slide-in-from-top-2">
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {c.记忆 && c.记忆.length > 0 ? (
                          c.记忆.map((mem, idx) => (
                              <div key={idx} className="text-[10px] text-zinc-400 border-l-2 border-zinc-700 pl-2 py-0.5">
                                  <span className="text-pink-500 font-mono mr-2">[{mem.时间戳?.split(' ')[1] || 'LOG'}]</span>
                                  {mem.内容}
                              </div>
                          ))
                      ) : (
                          <div className="text-[10px] text-zinc-600 italic text-center">暂无记忆记录</div>
                      )}
                  </div>
              </div>
          )}
      </div>
    );
};

export const SocialModal: React.FC<SocialModalProps> = ({ 
    isOpen, 
    onClose, 
    confidants, 
    onAddToQueue,
    onUpdateConfidant
}) => {
  const [activeTab, setActiveTab] = useState<SocialTab>('SPECIAL');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedConfidantId, setSelectedConfidantId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleAttention = (c: Confidant) => {
      const isNowSpecial = !c.特别关注;
      onUpdateConfidant(c.id, { 特别关注: isNowSpecial });
      const cmd = isNowSpecial 
        ? `设置 [${c.姓名}] 为特别关注对象，AI补全完整信息。`
        : `取消 [${c.姓名}] 的特别关注`;
      onAddToQueue(cmd, () => onUpdateConfidant(c.id, { 特别关注: !isNowSpecial }), `toggle_special_${c.id}`);
  };

  const handleToggleParty = (c: Confidant) => {
      const isNowParty = !c.是否队友;
      onUpdateConfidant(c.id, { 是否队友: isNowParty });
      const cmd = isNowParty ? `邀请 [${c.姓名}] 加入队伍。` : `将 [${c.姓名}] 移出队伍。`;
      onAddToQueue(cmd, () => onUpdateConfidant(c.id, { 是否队友: !isNowParty }), `toggle_party_${c.id}`);
  };

  const handleToggleContext = (c: Confidant) => {
      const isNowForced = !c.强制包含上下文;
      onUpdateConfidant(c.id, { 强制包含上下文: isNowForced });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && selectedConfidantId) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  onUpdateConfidant(selectedConfidantId, { 头像: ev.target.result as string });
              }
          };
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  const triggerUpload = (id: string) => {
      setSelectedConfidantId(id);
      fileInputRef.current?.click();
  };

  const getFilteredConfidants = () => {
      const filtered = activeTab === 'SPECIAL'
          ? confidants.filter(c => c.特别关注)
          : confidants.filter(c => !c.特别关注);
      return [...filtered].sort((a, b) => {
          const presentDiff = Number(!!b.是否在场) - Number(!!a.是否在场);
          if (presentDiff !== 0) return presentDiff;
          const partyDiff = Number(!!b.是否队友) - Number(!!a.是否队友);
          if (partyDiff !== 0) return partyDiff;
          return a.姓名.localeCompare(b.姓名);
      });
  };

  // --- Special Card Render ---
  const renderSpecialCard = (c: Confidant) => {
      const isAdv = isAdventurer(c);
      const stats = c.能力值 || c.隐藏基础能力值;
      const vitals = c.生存数值;

      return (
      <div key={c.id} className="relative w-full bg-zinc-900 border-2 border-pink-600 p-6 shadow-[0_0_30px_rgba(236,72,153,0.2)] flex flex-col md:flex-row gap-8 overflow-hidden group">
          {/* Background Decor */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
             <div className="absolute top-0 right-[-10%] w-[60%] h-full bg-pink-600/10 transform skew-x-[-12deg]" />
             <div className="absolute bottom-0 left-[-10%] w-[40%] h-full bg-pink-900/5 transform skew-x-[-12deg]" />
             <div className="absolute -bottom-10 -right-10 text-[200px] text-pink-500/5 font-black leading-none select-none">★</div>
          </div>

          {/* Left: Avatar & Identity */}
          <div className="w-full md:w-64 shrink-0 flex flex-col items-center relative z-10">
              <div 
                  onClick={() => triggerUpload(c.id)}
                  className="w-56 h-56 bg-black border-4 border-white shadow-[8px_8px_0_rgba(236,72,153,1)] mb-4 relative group/avatar cursor-pointer overflow-hidden transform hover:-translate-y-1 transition-transform duration-300"
              >
                  {c.头像 ? (
                      <img src={c.头像} alt={c.姓名} className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600 font-display text-8xl">{c.姓名[0]}</div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="bg-white text-black px-4 py-1 font-bold uppercase tracking-widest text-xs transform -skew-x-12">
                          上传图片
                      </div>
                  </div>
                  {/* Status Badges Overlay */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                     {c.是否在场 && <span className="bg-emerald-500 text-black text-[10px] font-bold px-2 py-0.5 uppercase shadow-md">在场</span>}
                     {c.是否队友 && <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 uppercase shadow-md">队友</span>}
                  </div>
              </div>
              
              <div className="text-center space-y-2 w-full">
                  <h2 className="text-3xl text-white font-black italic tracking-tighter uppercase drop-shadow-md">{c.姓名}</h2>
                  <div className="flex justify-center items-center gap-3 text-xs text-zinc-400 font-mono">
                      <span className="uppercase">{c.种族}</span>
                      <span>/</span>
                      <span className="uppercase">{c.性别}</span>
                      <span>/</span>
                      <span>{c.年龄 ? `${c.年龄}岁` : '未知'}</span>
                  </div>
                  {c.称号 && (
                      <div className="inline-block bg-pink-900/30 border border-pink-500/30 px-3 py-1 text-pink-300 text-xs font-serif italic">
                          “{c.称号}”
                      </div>
                  )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 w-full mt-4">
                  <button 
                      onClick={() => handleToggleAttention(c)}
                      className={`flex-1 py-3 flex items-center justify-center gap-2 font-bold uppercase text-xs transition-all transform hover:-translate-y-1 active:translate-y-0
                          ${c.特别关注 
                              ? 'bg-yellow-500 text-black shadow-[4px_4px_0_rgba(0,0,0,0.5)]' 
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-600 hover:text-white hover:border-white'
                          }
                      `}
                  >
                      {c.特别关注 ? <Eye size={14} /> : <EyeOff size={14} />}
                      {c.特别关注 ? '已关注' : '忽略'}
                  </button>
                  <button 
                      onClick={() => handleToggleParty(c)}
                      className={`flex-1 py-3 flex items-center justify-center gap-2 font-bold uppercase text-xs transition-all transform hover:-translate-y-1 active:translate-y-0
                          ${c.是否队友 
                              ? 'bg-indigo-600 text-white shadow-[4px_4px_0_rgba(0,0,0,0.5)]' 
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-600 hover:text-white hover:border-white'
                          }
                      `}
                  >
                      <Swords size={14} />
                      {c.是否队友 ? '已组队' : '邀请'}
                  </button>
              </div>
          </div>

          {/* Right: Detailed Info */}
          <div className="flex-1 flex flex-col z-10 min-w-0">
               {/* Top Stats Bar */}
               <div className="flex flex-wrap gap-6 border-b-2 border-pink-500/30 pb-4 mb-4">
                   <div className="flex flex-col">
                       <span className="text-[10px] text-pink-500 uppercase font-bold tracking-widest mb-1">等级</span>
                       <span className="text-3xl font-black text-white italic">{getLevelLabel(c)}</span>
                   </div>
                   <div className="flex flex-col">
                       <span className="text-[10px] text-pink-500 uppercase font-bold tracking-widest mb-1">好感度</span>
                       <div className="flex items-center gap-2 text-pink-500">
                           <Heart size={28} fill="currentColor" className="animate-pulse"/>
                           <span className="text-3xl font-black italic">{c.好感度 || 0}</span>
                       </div>
                   </div>
                   <div className="flex flex-col">
                       <span className="text-[10px] text-pink-500 uppercase font-bold tracking-widest mb-1">关系</span>
                       <span className="text-xl font-bold text-zinc-300">{c.关系状态 || '相识'}</span>
                   </div>
               </div>

               <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
                   <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                       {/* Stats & Vitals - Conditional Render for Adventurers */}
                       {isAdv && (
                           <div className="space-y-4">
                               <div className="bg-black/40 p-4 border border-zinc-800">
                                   <h4 className="text-zinc-500 font-bold uppercase text-xs flex items-center gap-2 mb-3">
                                       <Activity size={12} /> 生存数值
                                   </h4>
                                   <div className="space-y-2">
                                       {vitals ? (
                                           <>
                                              <StatBar label="生命" value={vitals.当前生命} max={vitals.最大生命} color="bg-green-500" />
                                              <StatBar label="精神" value={vitals.当前精神} max={vitals.最大精神} color="bg-blue-500" />
                                              <StatBar label="体力" value={vitals.当前体力} max={vitals.最大体力} color="bg-yellow-500" />
                                           </>
                                       ) : (
                                           <div className="text-xs text-zinc-600 italic">暂无生存数据</div>
                                       )}
                                   </div>
                               </div>

                               <div className="bg-black/40 p-4 border border-zinc-800">
                                   <h4 className="text-zinc-500 font-bold uppercase text-xs flex items-center gap-2 mb-3">
                                       <User size={12} /> 基础能力
                                   </h4>
                                   <div className="space-y-2">
                                       {stats ? (
                                           <>
                                              <StatBar label="力量" value={Number(stats.力量) || 0} max={999} />
                                              <StatBar label="耐久" value={Number(stats.耐久) || 0} max={999} />
                                              <StatBar label="灵巧" value={Number(stats.灵巧) || 0} max={999} />
                                              <StatBar label="敏捷" value={Number(stats.敏捷) || 0} max={999} />
                                              <StatBar label="魔力" value={Number(stats.魔力) || 0} max={999} />
                                           </>
                                       ) : (
                                           <div className="text-xs text-zinc-600 italic">能力值不可见</div>
                                       )}
                                   </div>
                               </div>

                               {/* Equipment Summary (Compact) - Only for Adventurers */}
                               {c.装备 && (
                                   <div className="bg-black/40 p-4 border border-zinc-800">
                                       <h4 className="text-zinc-500 font-bold uppercase text-xs flex items-center gap-2 mb-2">
                                           <Shield size={12} /> 装备信息
                                       </h4>
                                       <div className="grid grid-cols-2 gap-2 text-[10px]">
                                           <div className="text-zinc-500">主手: <span className="text-zinc-300">{c.装备.主手 || '-'}</span></div>
                                           <div className="text-zinc-500">身体: <span className="text-zinc-300">{c.装备.身体 || '-'}</span></div>
                                       </div>
                                   </div>
                               )}
                           </div>
                       )}
                   </div>

                   {/* Profile & Memories */}
                   <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                       <div className="bg-black/40 p-4 border border-zinc-800">
                           <h4 className="text-zinc-500 font-bold uppercase text-xs mb-2">档案</h4>
                           <p className="text-zinc-300 text-xs leading-relaxed font-serif italic">
                               {c.档案 || "暂无档案数据。"}
                           </p>
                           {c.已知能力 && (
                               <div className="mt-4 pt-4 border-t border-zinc-800/50">
                                   <div className="text-[10px] text-pink-500 uppercase font-bold mb-1">已知能力</div>
                                   <div className="text-xs text-zinc-400">{c.已知能力}</div>
                               </div>
                           )}
                       </div>

                       {/* NPC Memories Section */}
                       <div className="bg-black/40 p-4 border border-pink-900/30 flex-1 min-h-[200px]">
                           <h4 className="text-pink-500 font-bold uppercase text-xs flex items-center gap-2 mb-3">
                               <MessageSquareDashed size={12} /> NPC 记忆 / Interaction Log
                           </h4>
                           <div className="space-y-3">
                               {c.记忆 && c.记忆.length > 0 ? (
                                   c.记忆.map((mem, idx) => (
                                       <div key={idx} className="text-[10px] text-zinc-400 border-l-2 border-pink-900/50 pl-2 pb-2 last:border-0">
                                           <div className="font-mono text-zinc-600 text-[9px] mb-0.5">[{mem.时间戳?.split(' ')[1] || 'LOG'}]</div>
                                           <div className="leading-relaxed">{mem.内容}</div>
                                       </div>
                                   ))
                               ) : (
                                   <div className="text-[10px] text-zinc-600 italic text-center py-4">暂无互动记录</div>
                               )}
                           </div>
                       </div>
                   </div>
               </div>
          </div>
      </div>
      );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 lg:p-12 animate-in fade-in duration-300">
      <div className="w-full h-full max-w-[1600px] flex flex-col relative overflow-hidden bg-zinc-950 border-2 border-pink-600 shadow-[0_0_100px_rgba(236,72,153,0.2)]">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
        
        {/* Header */}
        <div className="h-24 bg-black border-b-4 border-pink-600 flex items-center px-8 justify-between relative overflow-hidden shrink-0">
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(236,72,153,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(236,72,153,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div className="absolute -left-10 top-0 w-40 h-full bg-pink-600 transform -skew-x-12" />
            
            <div className="relative z-10 flex items-center gap-6">
                <Star className="w-12 h-12 text-white fill-pink-500" />
                <div>
                    <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-[4px_4px_0_rgba(236,72,153,0.8)]">
                        社交
                    </h1>
                    <div className="text-xs font-mono text-pink-500 tracking-[0.6em] uppercase">
                        羁绊系统 / Social Links
                    </div>
                </div>
            </div>

            <div className="relative z-10 flex items-center gap-4">
                <div className="flex bg-black border border-zinc-700">
                    <button 
                        onClick={() => setActiveTab('SPECIAL')} 
                        className={`px-8 py-3 font-display uppercase text-lg tracking-widest transition-all hover:bg-zinc-800 
                            ${activeTab === 'SPECIAL' ? 'bg-pink-600 text-white' : 'text-zinc-500'}
                        `}
                    >
                        特别关心
                    </button>
                    <button 
                        onClick={() => setActiveTab('ALL')} 
                        className={`px-8 py-3 font-display uppercase text-lg tracking-widest transition-all hover:bg-zinc-800 
                            ${activeTab === 'ALL' ? 'bg-pink-600 text-white' : 'text-zinc-500'}
                        `}
                    >
                        普通联系人
                    </button>
                </div>
                
                <button 
                    onClick={onClose} 
                    className="p-3 bg-black border-2 border-white hover:bg-white hover:text-black transition-colors rounded-full"
                >
                    <X size={24} strokeWidth={3} />
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-zinc-950/50">
            <div className={`grid gap-6 ${activeTab === 'ALL' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                {getFilteredConfidants().length > 0 ? (
                    getFilteredConfidants().map(c => activeTab === 'SPECIAL' ? renderSpecialCard(c) : <NormalCard key={c.id} c={c} onToggleAttention={handleToggleAttention} onToggleContext={handleToggleContext} />)
                ) : (
                    <div className="col-span-full flex flex-col items-center justify-center py-32 opacity-30">
                        <Heart size={80} className="mb-4 text-pink-500" />
                        <div className="text-3xl font-black uppercase text-pink-900">暂无羁绊对象</div>
                    </div>
                )}
            </div>
        </div>

        {/* Footer Bar */}
        <div className="h-8 bg-pink-900/20 border-t border-pink-900/50 flex items-center px-4 justify-between shrink-0">
            <div className="text-[10px] text-pink-700 font-mono uppercase tracking-widest">
                Phantom System // Social Manager
            </div>
            <div className="text-[10px] text-pink-700 font-mono uppercase">
                总数: {confidants.length}
            </div>
        </div>
      </div>
    </div>
  );
};
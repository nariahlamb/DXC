import React, { useMemo, useState, useEffect } from 'react';
import { CombatState, CharacterStats, Skill, MagicSpell, InventoryItem, Enemy } from '../../types';
import { getItemCategory } from '../../utils/itemUtils';
import { Sword, Shield, Zap, Skull, MessageSquare, Crosshair, Package, Activity, AlertTriangle, X, Target, Swords, Play, Sparkles, Flame, Droplets, Wind, Mountain, Brain, Heart, FastForward } from 'lucide-react';

interface CombatPanelProps {
  combatState: CombatState;
  playerStats: CharacterStats;
  skills: Skill[];
  magic: MagicSpell[];
  inventory?: InventoryItem[];
  onPlayerAction: (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => void;
}

// --- Utility Components ---

const StatBar = ({ label, current, max, color, subColor }: { label: string; current: number; max: number; color: string; subColor: string }) => (
    <div className="relative w-full">
        <div className="flex justify-between text-[10px] font-black italic text-zinc-400 mb-0.5 tracking-wider">
            <span>{label}</span>
            <span className="font-mono text-white">{current} <span className="text-zinc-600">/</span> {max}</span>
        </div>
        <div className="h-3 w-full bg-zinc-900 border border-zinc-700 transform skew-x-[-15deg] overflow-hidden">
            <div className={`h-full ${subColor} absolute inset-0 opacity-30`} style={{ width: `${Math.min(100, (current/max)*100)}%` }} />
            <div className={`h-full ${color} transition-all duration-300 relative`} style={{ width: `${Math.min(100, (current/max)*100)}%` }} />
        </div>
    </div>
);

const CommandButton = ({ 
    label, 
    icon, 
    onClick, 
    variant = 'red', 
    active = false 
}: { 
    label: string; 
    icon: React.ReactNode; 
    onClick: () => void; 
    variant?: 'red' | 'blue' | 'green' | 'yellow' | 'pink' | 'zinc';
    active?: boolean;
}) => {
    const styles = {
        red: 'from-red-600 to-red-800 border-red-500 text-white',
        blue: 'from-blue-600 to-blue-800 border-blue-500 text-white',
        green: 'from-emerald-600 to-emerald-800 border-emerald-500 text-white',
        yellow: 'from-amber-500 to-amber-700 border-amber-400 text-white',
        pink: 'from-pink-600 to-pink-800 border-pink-500 text-white',
        zinc: 'from-zinc-600 to-zinc-800 border-zinc-500 text-zinc-200',
    };

    return (
        <button 
            onClick={onClick}
            className={`group relative h-16 w-full transform skew-x-[-12deg] transition-all duration-200 
                ${active ? 'scale-105 z-10' : 'hover:scale-105 hover:z-10'}
            `}
        >
            <div className={`absolute inset-0 bg-gradient-to-r ${styles[variant]} border-2 opacity-90 group-hover:opacity-100 shadow-lg`} />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
            
            <div className="relative h-full flex items-center justify-between px-6 transform skew-x-[12deg]">
                <span className="text-2xl drop-shadow-md group-hover:scale-110 transition-transform">{icon}</span>
                <span className="font-black text-xl italic uppercase tracking-wider">{label}</span>
            </div>
            
            {/* Glitch/Shine Effect */}
            <div className="absolute inset-0 bg-white/10 translate-x-full group-hover:translate-x-0 transition-transform duration-300 pointer-events-none" />
        </button>
    );
};

const SkillItem = ({ item, onClick, cost }: { item: Skill | MagicSpell | InventoryItem; onClick: () => void; cost?: string }) => (
    <button 
        onClick={onClick}
        className="w-full flex justify-between items-center p-3 bg-zinc-900/80 border-l-4 border-zinc-600 hover:border-red-500 hover:bg-zinc-800 transition-all group"
    >
        <div className="flex flex-col items-start">
            <div className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">{item.名称}</div>
            {item.描述 && <div className="text-[10px] text-zinc-500 line-clamp-1 text-left">{item.描述}</div>}
        </div>
        {cost && (
            <div className="text-xs font-mono text-red-400 group-hover:text-red-300 whitespace-nowrap ml-2">
                {cost}
            </div>
        )}
    </button>
);

export const CombatPanel: React.FC<CombatPanelProps> = ({ 
  combatState, 
  playerStats, 
  skills,
  magic,
  inventory = [],
  onPlayerAction 
}) => {
  const [menuLevel, setMenuLevel] = useState<'MAIN' | 'SKILLS' | 'ITEMS' | 'TALK'>('MAIN');
  const [freeActionInput, setFreeActionInput] = useState('');
  
  const enemies = useMemo(() => {
      const raw = (combatState as any)?.敌方;
      if (!raw) return [] as Enemy[];
      const list = Array.isArray(raw) ? raw.filter(Boolean) : [raw];
      return list.map((enemy, idx) => ({
          ...enemy,
          id: enemy.id || `${enemy.名称 || 'enemy'}_${idx}`
      }));
  }, [combatState]);

  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(enemies[0]?.id ?? null);

  useEffect(() => {
      if (enemies.length === 0) {
          setSelectedEnemyId(null);
          return;
      }
      if (!selectedEnemyId || !enemies.some(e => e.id === selectedEnemyId)) {
          setSelectedEnemyId(enemies[0].id);
      }
  }, [enemies, selectedEnemyId]);

  const selectedEnemy = enemies.find(e => e.id === selectedEnemyId) || enemies[0];
  const battleLogs = Array.isArray(combatState.战斗记录) ? combatState.战斗记录 : [];
  const validConsumables = inventory.filter(i => getItemCategory(i) === 'CONSUMABLE');

  const formatCost = (cost: any) => {
      if (!cost) return "";
      if (typeof cost === 'object') {
          const parts: string[] = [];
          if (cost.精神) parts.push(`MP${cost.精神}`);
          if (cost.体力) parts.push(`ST${cost.体力}`);
          return parts.join(' ');
      }
      return String(cost);
  };

  const handleTargetedAction = (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => {
      const targetPayload = selectedEnemy
          ? { ...(payload || {}), targetId: selectedEnemy.id, targetName: selectedEnemy.名称 }
          : payload;
      onPlayerAction(action, targetPayload);
  };

  const getEnemyHpPercent = (enemy: Enemy) => {
      const curr = enemy.当前生命值 ?? enemy.生命值 ?? 0;
      const max = enemy.最大生命值 ?? curr ?? 1;
      return Math.max(0, Math.min(100, (curr / max) * 100));
  };

  if (enemies.length === 0) return (
      <div className="flex flex-col items-center justify-center h-full text-red-500 animate-pulse bg-black">
          <Activity size={48} className="mb-4" />
          <div className="font-display text-2xl uppercase tracking-widest">正在扫描战场...</div>
      </div>
  );

  return (
    <div className="w-full h-full relative flex flex-col overflow-hidden bg-zinc-950 font-sans">
      
      {/* --- Dynamic Background --- */}
      <div className="absolute inset-0 z-0 bg-black pointer-events-none">
         {/* Stylish Slash */}
         <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[150%] bg-red-900/10 transform -rotate-12" />
         <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[150%] bg-zinc-900/50 transform -rotate-12" />
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-30" />
      </div>

      {/* --- Battlefield Area (Top 60%) --- */}
      <div className="relative flex-1 p-6 md:p-8 flex flex-col lg:flex-row gap-8 z-10 overflow-hidden">
          
          {/* Enemy List */}
          <div className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                  <span className="bg-red-600 text-white px-3 py-1 text-xs font-black italic transform skew-x-[-12deg]">
                      ENEMIES
                  </span>
                  <span className="text-red-500 font-mono text-xs tracking-widest">// THREAT DETECTED</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enemies.map(enemy => {
                      const isSelected = enemy.id === selectedEnemy?.id;
                      const hpPercent = getEnemyHpPercent(enemy);
                      
                      return (
                          <button
                              key={enemy.id}
                              onClick={() => setSelectedEnemyId(enemy.id)}
                              className={`group relative transition-all duration-300 outline-none ${isSelected ? 'scale-105 z-20' : 'hover:scale-105 z-10'}`}
                          >
                              {/* Card Body */}
                              <div className={`relative p-4 border-l-4 transition-colors overflow-hidden clip-trapezoid-sm
                                  ${isSelected 
                                      ? 'bg-red-950/90 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.4)]' 
                                      : 'bg-zinc-900/80 border-zinc-700 hover:bg-zinc-800 hover:border-red-500/50'
                                  }
                              `}>
                                  <div className="flex justify-between items-start mb-2">
                                      <h3 className={`font-display font-black text-xl uppercase italic truncate pr-2 ${isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`}>
                                          {enemy.名称}
                                      </h3>
                                      {isSelected && <Target size={20} className="text-red-500 animate-pulse" />}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 mb-3 text-[10px] font-mono text-zinc-500">
                                      <span className="border border-zinc-700 px-1">Lv.{enemy.等级 || '?'}</span>
                                      <span>{enemy.种族 || 'UNKNOWN'}</span>
                                  </div>

                                  {/* HP Bar */}
                                  <div className="space-y-1">
                                      <div className="flex justify-between text-[9px] font-bold uppercase text-red-400">
                                          <span>HP</span>
                                          <span>{Math.round(hpPercent)}%</span>
                                      </div>
                                      <div className="h-2 bg-black w-full skew-x-[-12deg] border border-zinc-700 overflow-hidden">
                                          <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${hpPercent}%` }} />
                                      </div>
                                  </div>
                              </div>

                              {/* Selection Indicator */}
                              {isSelected && (
                                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-r-[12px] border-r-red-500 border-b-[8px] border-b-transparent" />
                              )}
                          </button>
                      );
                  })}
              </div>
          </div>

          {/* Target Info Panel (Right Side) */}
          <div className="w-full lg:w-80 shrink-0 hidden md:block">
              <div className="bg-black/80 border-2 border-red-900 p-1 relative">
                  <div className="absolute -top-3 -right-3 bg-red-600 text-white px-2 py-1 text-[10px] font-black uppercase transform skew-x-[-12deg]">
                      ANALYSIS
                  </div>
                  <div className="border border-red-900/50 p-4 min-h-[200px]">
                      {selectedEnemy ? (
                          <div className="space-y-4">
                              <div className="text-center border-b border-red-900/50 pb-4">
                                  <Skull size={48} className="mx-auto text-red-600 mb-2" />
                                  <h2 className="text-2xl font-display font-black text-white uppercase italic">{selectedEnemy.名称}</h2>
                                  <div className="text-xs text-red-400 font-mono mt-1">THREAT LEVEL: {selectedEnemy.等级 || '?'}</div>
                              </div>
                              <div className="text-xs text-zinc-400 leading-relaxed font-serif italic text-center">
                                  “{selectedEnemy.描述 || '敌意正在凝聚，请小心应对。'}”
                              </div>
                              <div className="space-y-2 pt-2">
                                  <div className="text-[10px] font-bold text-zinc-500 uppercase">已知技能 / ABILITIES</div>
                                  <div className="flex flex-wrap gap-1">
                                      {selectedEnemy.技能 && selectedEnemy.技能.length > 0 ? selectedEnemy.技能.map((s, i) => (
                                          <span key={i} className="text-[10px] bg-red-950/50 text-red-300 px-2 py-0.5 border border-red-900/30">{s}</span>
                                      )) : <span className="text-[10px] text-zinc-600 italic">暂无情报</span>}
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-xs">
                              NO TARGET SELECTED
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* --- Action & Status Area (Bottom 40%) --- */}
      <div className="relative h-[40%] min-h-[300px] z-20 flex">
          {/* Slanted Separator */}
          <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-b from-zinc-950 to-transparent pointer-events-none z-30" />

          {/* Left: Player Status (Stylized) */}
          <div className="w-1/3 md:w-1/4 bg-zinc-950 border-r-4 border-white/10 relative flex flex-col justify-end pb-8 px-6 overflow-hidden">
              <div className="absolute top-0 right-0 p-4 text-zinc-600 opacity-20">
                  <Target size={120} />
              </div>
              
              <div className="relative z-10 space-y-6">
                  <div>
                      <h2 className="text-4xl md:text-5xl font-black italic text-white uppercase tracking-tighter leading-none">
                          {playerStats.姓名}
                      </h2>
                      <div className="text-blue-500 font-bold text-sm tracking-[0.2em] mt-1">LV.{playerStats.等级}</div>
                  </div>

                  <div className="space-y-3">
                      <StatBar 
                          label="HP / 生命"
                          current={playerStats.生命值}
                          max={playerStats.最大生命值}
                          color="bg-green-500"
                          subColor="bg-green-900"
                      />
                      <StatBar 
                          label="MP / 精神"
                          current={playerStats.精神力}
                          max={playerStats.最大精神力}
                          color="bg-purple-500"
                          subColor="bg-purple-900"
                      />
                      <StatBar 
                          label="ST / 体力"
                          current={playerStats.体力}
                          max={playerStats.最大体力}
                          color="bg-yellow-500"
                          subColor="bg-yellow-900"
                      />
                  </div>
              </div>
          </div>

          {/* Right: Command Center */}
          <div className="flex-1 bg-zinc-900 relative flex flex-col">
              {/* Battle Log Ticker */}
              <div className="h-8 bg-black border-b border-zinc-800 flex items-center px-4 overflow-hidden">
                  <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono whitespace-nowrap animate-pulse">
                      <Activity size={12} />
                      BATTLE LOG:
                  </div>
                  <div className="ml-4 text-zinc-300 text-xs font-mono truncate">
                      {battleLogs[battleLogs.length - 1] || "战斗开始，等待指令..."}
                  </div>
              </div>

              {/* Main Menu Area */}
              <div className="flex-1 p-6 md:p-8 flex items-center justify-center overflow-hidden">
                  {menuLevel === 'MAIN' ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 w-full max-w-4xl">
                          <CommandButton label="攻击" icon={<Sword/>} onClick={() => handleTargetedAction('attack')} variant="red" />
                          <CommandButton label="技能" icon={<Zap/>} onClick={() => setMenuLevel('SKILLS')} variant="blue" />
                          <CommandButton label="防御" icon={<Shield/>} onClick={() => handleTargetedAction('guard')} variant="yellow" />
                          <CommandButton label="物品" icon={<Package/>} onClick={() => setMenuLevel('ITEMS')} variant="green" />
                          <CommandButton label="交涉" icon={<MessageSquare/>} onClick={() => setMenuLevel('TALK')} variant="pink" />
                          <CommandButton label="逃跑" icon={<FastForward/>} onClick={() => onPlayerAction('escape')} variant="zinc" />
                      </div>
                  ) : (
                      <div className="w-full h-full flex flex-col bg-black/40 border-2 border-zinc-700 p-4 relative animate-in fade-in zoom-in-95">
                          {/* Submenu Header */}
                          <div className="flex justify-between items-center mb-4 border-b border-zinc-700 pb-2">
                              <h3 className="text-xl font-black italic text-white uppercase">
                                  {menuLevel === 'SKILLS' ? 'SKILLS & MAGIC' : menuLevel === 'ITEMS' ? 'ITEMS' : 'FREE ACTION'}
                              </h3>
                              <button onClick={() => setMenuLevel('MAIN')} className="flex items-center gap-1 text-zinc-400 hover:text-white uppercase font-bold text-xs">
                                  <X size={16} /> 返回
                              </button>
                          </div>

                          {/* Submenu Content */}
                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                              {menuLevel === 'SKILLS' && (
                                  <div className="space-y-4">
                                      {skills.length > 0 && (
                                          <div className="space-y-2">
                                              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">物理技能</div>
                                              {skills.map(s => <SkillItem key={s.id} item={s} onClick={() => handleTargetedAction('skill', {...s, __kind: 'SKILL'})} cost={formatCost(s.消耗)} />)}
                                          </div>
                                      )}
                                      {magic.length > 0 && (
                                          <div className="space-y-2">
                                              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">魔法</div>
                                              {magic.map(s => <SkillItem key={s.id} item={s} onClick={() => handleTargetedAction('skill', {...s, __kind: 'MAGIC'})} cost={formatCost(s.消耗)} />)}
                                          </div>
                                      )}
                                      {skills.length === 0 && magic.length === 0 && <div className="text-zinc-500 text-center italic py-8">暂无可用技能</div>}
                                  </div>
                              )}

                              {menuLevel === 'ITEMS' && (
                                  <div className="space-y-2">
                                      {validConsumables.length > 0 ? validConsumables.map(item => (
                                          <button 
                                              key={item.id}
                                              onClick={() => onPlayerAction('item', item)}
                                              className="w-full flex justify-between items-center p-3 bg-zinc-900 border border-zinc-700 hover:border-green-500 hover:bg-green-900/20 transition-all"
                                          >
                                              <div className="flex items-center gap-3">
                                                  <Package size={16} className="text-green-500" />
                                                  <span className="text-zinc-200 font-bold">{item.名称}</span>
                                              </div>
                                              <span className="text-xs font-mono text-zinc-500">x{item.数量}</span>
                                          </button>
                                      )) : <div className="text-zinc-500 text-center italic py-8">背包中没有可用物品</div>}
                                  </div>
                              )}

                              {menuLevel === 'TALK' && (
                                  <div className="h-full flex flex-col gap-4">
                                      <textarea 
                                          value={freeActionInput}
                                          onChange={(e) => setFreeActionInput(e.target.value)}
                                          placeholder="描述你的行动 (例如: 试图说服敌人，利用环境...)"
                                          className="flex-1 bg-black border border-zinc-700 p-4 text-zinc-200 resize-none focus:border-pink-500 outline-none font-mono text-sm"
                                      />
                                      <button 
                                          onClick={() => { if(freeActionInput.trim()) { onPlayerAction('talk', freeActionInput); setFreeActionInput(''); } }}
                                          className="w-full py-4 bg-pink-700 hover:bg-pink-600 text-white font-black uppercase tracking-widest text-lg transform skew-x-[-6deg]"
                                      >
                                          执行行动
                                      </button>
                                  </div>
                              )}
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};
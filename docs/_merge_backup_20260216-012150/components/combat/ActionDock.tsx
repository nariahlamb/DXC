import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CharacterStats, Skill, MagicSpell, InventoryItem, DndAbility, DndActionBinding } from '../../types';
import { Sword, Zap, Shield, MessageSquare, AlertTriangle, Package, X, ChevronRight } from 'lucide-react';
import { getItemCategory } from '../../utils/itemUtils';

interface ActionDockProps {
  playerStats: CharacterStats;
  skills: Skill[];
  magic: MagicSpell[];
  inventory: InventoryItem[];
  onAction: (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => void;
  disabled?: boolean;
}

type MenuState = 'MAIN' | 'SKILLS' | 'ITEMS' | 'TALK';

const DND_ABILITY_LABEL: Record<DndAbility, string> = {
  STR: '力',
  DEX: '敏',
  CON: '体',
  INT: '智',
  WIS: '感',
  CHA: '魅'
};

const DND_ABILITY_ORDER: DndAbility[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

const calcDndModifier = (score?: number): number => {
  if (!Number.isFinite(score)) return 0;
  return Math.floor((Number(score) - 10) / 2);
};

const formatSigned = (value?: number): string => {
  const safe = Number(value || 0);
  return safe >= 0 ? `+${safe}` : `${safe}`;
};

const resolveDndBinding = (entry: Skill | MagicSpell): DndActionBinding | undefined => {
  if (entry.DND机制) return entry.DND机制;
  if ((entry as MagicSpell).dndBinding) return (entry as MagicSpell).dndBinding;
  return undefined;
};

export const ActionDock: React.FC<ActionDockProps> = ({
  playerStats,
  skills,
  magic,
  inventory,
  onAction,
  disabled
}) => {
  const [menu, setMenu] = React.useState<MenuState>('MAIN');
  const [freeInput, setFreeInput] = React.useState('');

  const handleFreeAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (freeInput.trim()) {
      onAction('talk', freeInput);
      setFreeInput('');
      setMenu('MAIN');
    }
  };

  const validConsumables = inventory.filter(i => getItemCategory(i) === 'CONSUMABLE');
  const combinedActions = [...skills, ...magic];
  const dndProfile = playerStats.DND档案 || playerStats.dndProfile;
  const dndAbilityScores = dndProfile?.属性值;
  const proficiencyBonus = dndProfile?.熟练加值 || 0;

  const describeDndBinding = React.useCallback((binding?: DndActionBinding) => {
    if (!binding) return '';
    const parts: string[] = [];
    if (binding.主属性) {
      const score = dndAbilityScores?.[binding.主属性];
      const modifier = calcDndModifier(score);
      const withProf = binding.熟练
        ? modifier + proficiencyBonus * (binding.专精 ? 2 : 1)
        : modifier;
      parts.push(`${binding.主属性}${formatSigned(withProf)}`);
    }
    if (binding.豁免属性) parts.push(`豁免:${binding.豁免属性}`);
    if (binding.固定DC !== undefined) parts.push(`DC ${binding.固定DC}`);
    if (binding.伤害骰) {
      const suffix = binding.附加伤害 ? `${binding.伤害骰}${binding.附加伤害 > 0 ? `+${binding.附加伤害}` : binding.附加伤害}` : binding.伤害骰;
      parts.push(`伤害:${suffix}`);
    }
    if (binding.判定类型) parts.push(binding.判定类型);
    return parts.join(' · ');
  }, [dndAbilityScores, proficiencyBonus]);

  const buildDndPayload = React.useCallback((binding?: DndActionBinding) => {
    if (!binding) return undefined;
    const payload: any = { ...binding };
    if (binding.主属性) {
      const score = dndAbilityScores?.[binding.主属性];
      const baseMod = calcDndModifier(score);
      const prof = binding.熟练 ? proficiencyBonus * (binding.专精 ? 2 : 1) : 0;
      payload.属性修正 = baseMod;
      payload.熟练加值 = prof;
      payload.命中加值 = baseMod + prof;
    }
    if (!payload.推荐命令) {
      if (binding.判定类型 === '命中') payload.推荐命令 = 'resolve_attack_check';
      if (binding.判定类型 === '豁免') payload.推荐命令 = 'resolve_saving_throw';
      if (binding.判定类型 === '伤害') payload.推荐命令 = 'resolve_damage_roll';
      if (binding.判定类型 === '属性检定') payload.推荐命令 = 'roll_dice_check';
    }
    return payload;
  }, [dndAbilityScores, proficiencyBonus]);

  // Player Stats Display
  const hpPercent = (playerStats.生命值 / playerStats.最大生命值) * 100;
  const mpPercent = (playerStats.精神力 / playerStats.最大精神力) * 100;

  return (
    <div className="w-full bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-md flex flex-col md:flex-row shadow-2xl z-50">

      {/* Left: Quick Stats (Always visible) */}
      <div className="w-full md:w-64 p-4 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-row md:flex-col gap-3 justify-center">
        <div className="flex-1">
          <div className="text-hestia-blue-100 font-display font-bold text-lg uppercase tracking-wider truncate">
            {playerStats.姓名}
          </div>
          <div className="flex gap-3 text-[10px] font-mono text-zinc-500">
            <span className="text-blue-400">LV.{playerStats.等级}</span>
            <span>STR {playerStats.能力值?.力量 ?? playerStats.力量}</span>
            <span>END {playerStats.能力值?.耐久 ?? playerStats.耐久}</span>
          </div>
          {dndAbilityScores && (
            <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-mono text-cyan-200/80">
              {DND_ABILITY_ORDER.map((ability) => {
                const score = dndAbilityScores[ability];
                const mod = calcDndModifier(score);
                return (
                  <span
                    key={ability}
                    className="px-1.5 py-0.5 rounded border border-cyan-900/40 bg-cyan-950/20"
                  >
                    {DND_ABILITY_LABEL[ability]} {score}({formatSigned(mod)})
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center gap-2 min-w-[120px]">
          {/* HP Bar */}
          <div className="w-full">
            <div className="flex justify-between text-[9px] text-green-500 font-bold mb-0.5">
              <span>HP</span><span>{playerStats.生命值}</span>
            </div>
            <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500"
                animate={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>
          {/* MP Bar */}
          <div className="w-full">
            <div className="flex justify-between text-[9px] text-purple-500 font-bold mb-0.5">
              <span>MP</span><span>{playerStats.精神力}</span>
            </div>
            <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-500"
                animate={{ width: `${mpPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right: Action Area */}
      <div className="flex-1 relative h-48 md:h-40 overflow-hidden">
        <AnimatePresence mode='wait'>
          {menu === 'MAIN' && (
            <motion.div
              key="main"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="w-full h-full p-2 md:p-4 grid grid-cols-3 md:grid-cols-6 gap-2"
            >
              <ActionButton label="攻击" icon={<Sword/>} color="red" onClick={() => onAction('attack')} disabled={disabled} />
              <ActionButton label="技能" icon={<Zap/>} color="blue" onClick={() => setMenu('SKILLS')} disabled={disabled} />
              <ActionButton label="物品" icon={<Package/>} color="green" onClick={() => setMenu('ITEMS')} disabled={disabled} />
              <ActionButton label="防御" icon={<Shield/>} color="amber" onClick={() => onAction('guard')} disabled={disabled} />
              <ActionButton label="交涉" icon={<MessageSquare/>} color="pink" onClick={() => setMenu('TALK')} disabled={disabled} />
              <ActionButton label="逃跑" icon={<AlertTriangle/>} color="zinc" onClick={() => onAction('escape')} disabled={disabled} />
            </motion.div>
          )}

          {menu === 'SKILLS' && (
            <SubMenu title="技能与魔法" onBack={() => setMenu('MAIN')}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {combinedActions.map((s, i) => {
                  const isMagic = '属性' in s;
                  const dndBinding = resolveDndBinding(s);
                  const dndMetaText = describeDndBinding(dndBinding);
                  const dndPayload = buildDndPayload(dndBinding);
                  const costText = typeof s.消耗 === 'string'
                    ? s.消耗
                    : typeof s.消耗 === 'number'
                      ? `消耗 ${s.消耗}`
                      : s.消耗
                        ? '复合消耗'
                        : '特殊';
                  return (
                    <button
                      key={i}
                      onClick={() => onAction('skill', {
                        ...s,
                        __kind: isMagic ? 'MAGIC' : 'SKILL',
                        ...(dndPayload ? { __dnd: dndPayload } : {})
                      })}
                      className="flex items-center gap-3 p-2 bg-zinc-900 border border-zinc-800 hover:border-blue-500 hover:bg-zinc-800 text-left transition-all group"
                    >
                      <div className="p-2 bg-zinc-950 text-blue-500 group-hover:text-blue-400">
                        {isMagic ? <Zap size={16}/> : <Sword size={16}/>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-zinc-200 group-hover:text-white truncate">{s.名称}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{costText}</div>
                        {dndMetaText && (
                          <div className="text-[10px] text-cyan-300 mt-0.5 truncate">{dndMetaText}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {combinedActions.length === 0 && (
                   <div className="col-span-full text-center text-zinc-500 py-4">无可用技能</div>
                )}
              </div>
            </SubMenu>
          )}

          {menu === 'ITEMS' && (
             <SubMenu title="背包物品" onBack={() => setMenu('MAIN')}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {validConsumables.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => onAction('item', item)}
                      className="flex items-center gap-3 p-2 bg-zinc-900 border border-zinc-800 hover:border-green-500 hover:bg-zinc-800 text-left transition-all group"
                    >
                      <div className="p-2 bg-zinc-950 text-green-500 group-hover:text-green-400">
                        <Package size={16}/>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-zinc-200 group-hover:text-white">{item.名称}</div>
                        <div className="text-[10px] text-zinc-500">x{item.数量}</div>
                      </div>
                    </button>
                  ))}
                   {validConsumables.length === 0 && (
                   <div className="col-span-full text-center text-zinc-500 py-4">无可用物品</div>
                )}
                </div>
             </SubMenu>
          )}

          {menu === 'TALK' && (
            <SubMenu title="自由行动 / 战术交涉" onBack={() => setMenu('MAIN')}>
              <form onSubmit={handleFreeAction} className="h-full flex gap-3">
                <textarea
                  value={freeInput}
                  onChange={e => setFreeInput(e.target.value)}
                  placeholder="描述你的行动（例如：利用地形优势跳起攻击，或者尝试威吓对手...）"
                  className="flex-1 bg-zinc-900 border border-zinc-800 p-3 text-sm text-zinc-200 focus:border-pink-500 focus:ring-1 focus:ring-pink-500/20 outline-none resize-none rounded-sm"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!freeInput.trim()}
                  className="w-24 bg-pink-700 hover:bg-pink-600 disabled:opacity-50 disabled:hover:bg-pink-700 text-white font-bold uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-colors"
                >
                  <span>执行</span>
                  <ChevronRight size={16} />
                </button>
              </form>
            </SubMenu>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Subcomponents ---

const ActionButton = ({ label, icon, color, onClick, disabled }: any) => {
  const colorMap: any = {
    red: 'hover:bg-red-900/40 hover:border-red-500 text-red-400',
    blue: 'hover:bg-blue-900/40 hover:border-blue-500 text-blue-400',
    green: 'hover:bg-green-900/40 hover:border-green-500 text-green-400',
    amber: 'hover:bg-amber-900/40 hover:border-amber-500 text-amber-400',
    pink: 'hover:bg-pink-900/40 hover:border-pink-500 text-pink-400',
    zinc: 'hover:bg-zinc-800 hover:border-zinc-500 text-zinc-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center gap-2
        bg-zinc-900/50 border border-zinc-800
        transition-all duration-200 rounded-sm
        active:scale-95 disabled:opacity-50 disabled:pointer-events-none
        ${colorMap[color]}
      `}
    >
      <span className="text-xl md:text-2xl drop-shadow-lg">{icon}</span>
      <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
};

const SubMenu = ({ title, onBack, children }: any) => (
  <motion.div
    initial={{ x: 50, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: 50, opacity: 0 }}
    className="w-full h-full flex flex-col p-4"
  >
    <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
      <h3 className="text-zinc-300 font-bold uppercase tracking-wider text-sm">{title}</h3>
      <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1 text-xs uppercase font-bold">
        <X size={14} /> 返回
      </button>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
      {children}
    </div>
  </motion.div>
);

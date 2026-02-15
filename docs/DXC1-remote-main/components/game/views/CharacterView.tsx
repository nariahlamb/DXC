import React, { useState, useMemo } from 'react';
import { Shield, Sword, User, Gem, Zap, Sparkles, AlertCircle, Star, LogOut, Cross, Box, LayoutGrid } from 'lucide-react';
import { InventoryItem, Skill, MagicSpell, CharacterStats } from '../../../types';
import { getQualityLabel, getTypeLabel, isWeaponItem, isArmorItem, normalizeQuality } from '../../../utils/itemUtils';
import { formatSkillCost } from '../../../utils/skillFormat';
import clsx from 'clsx';
import { BaseButton } from '../../ui/base/BaseButton';

interface CharacterViewProps {
  player: CharacterStats;
  inventory: InventoryItem[];
  onUnequipItem: (slotKey: string, itemName?: string, itemId?: string) => void;
  onClose?: () => void;
}

type CharTab = 'STATUS' | 'EQUIPMENT' | 'SKILLS' | 'MAGIC';

// --- Helper Components & Functions ---

const StatBar = ({ label, value, max, color = 'bg-blue-500' }: { label: string, value: number, max: number, color?: string }) => {
    const percent = Math.min(100, Math.max(0, (value / max) * 100));
    return (
        <div className="w-full">
            <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-content-secondary">{label}</span>
                <span className="text-xs font-mono font-bold text-content-primary">
                    {value} <span className="text-content-muted">/ {max}</span>
                </span>
            </div>
            <div className="h-1.5 w-full bg-surface-base border border-white/5 rounded-full overflow-hidden">
                <div className={clsx("h-full transition-all duration-500", color)} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};

const AttributeHex = ({ stats }: { stats: CharacterStats }) => {
    // Placeholder for a Radar Chart - using a simple grid for now to save complexity
    // In a real impl, this would be an SVG polygon
    const attrs = [
        { l: 'STR', v: stats.力量 ?? 0 },
        { l: 'END', v: stats.耐久 ?? 0 },
        { l: 'DEX', v: stats.灵巧 ?? 0 },
        { l: 'AGI', v: stats.敏捷 ?? 0 },
        { l: 'MAG', v: stats.魔力 ?? 0 },
    ];
    
    return (
        <div className="grid grid-cols-5 gap-2 p-4 bg-surface-base/50 rounded-xl border border-white/5">
            {attrs.map(a => (
                <div key={a.l} className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-content-muted mb-1">{a.l}</span>
                    <span className="text-lg font-display font-bold text-content-primary">{a.v}</span>
                    <span className="text-[9px] text-content-muted/50 font-mono">I</span>
                </div>
            ))}
        </div>
    );
};

// --- Main Component ---

export const CharacterView: React.FC<CharacterViewProps> = ({ 
    player, inventory, onUnequipItem, onClose 
}) => {
  const [activeTab, setActiveTab] = useState<CharTab>('STATUS');
  
  // Equipment Slots Configuration
  const equipSlots = [
    { key: '主手', label: 'Main Hand', icon: <Sword size={18}/> },
    { key: '副手', label: 'Off Hand', icon: <Shield size={18}/> },
    { key: '头部', label: 'Head', icon: <User size={18}/> },
    { key: '身体', label: 'Body', icon: <Shield size={18}/> },
    { key: '饰品1', label: 'Accessory 1', icon: <Gem size={18}/> },
    { key: '饰品2', label: 'Accessory 2', icon: <Gem size={18}/> },
  ];
  const [activeEquipSlot, setActiveEquipSlot] = useState<string>(equipSlots[0].key);

  // Resolved Item Logic
  const slotItem = useMemo(() => {
      const itemName = player.装备?.[activeEquipSlot];
      if (itemName) {
          const byName = inventory.find(i => i.名称 === itemName);
          if (byName) return { item: byName, label: itemName, exists: true };
      }
      return { item: null, label: itemName || 'Empty Slot', exists: !!itemName };
  }, [activeEquipSlot, player.装备, inventory]);

  const renderStatusTab = () => (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-8">
              
              {/* Left Column: Avatar & Identity */}
              <div className="md:w-1/3 flex flex-col items-center md:items-start gap-6">
                  <div className="relative group">
                      <div className="w-64 h-80 md:w-full md:h-96 rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl bg-surface-base relative">
                          {player.头像 ? (
                              <img src={player.头像} alt="Character" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center bg-surface-overlay text-content-muted">
                                  <User size={64} strokeWidth={1} />
                              </div>
                          )}
                          {/* Overlay Gradient */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                          
                          {/* Name Overlay */}
                          <div className="absolute bottom-0 left-0 w-full p-6">
                              <h1 className="text-3xl font-display font-bold text-white drop-shadow-lg tracking-wide">{player.姓名}</h1>
                              <div className="flex items-center gap-2 text-sm font-mono text-content-secondary mt-1">
                                  <span className="text-accent-gold">Lv.{player.等级}</span>
                                  <span className="opacity-50">|</span>
                                  <span>{player.种族 || 'Human'}</span>
                                  <span className="opacity-50">|</span>
                                  <span>{player.称号 || 'Rookie'}</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Vitals */}
                  <div className="w-full space-y-4 bg-surface-overlay border border-white/5 p-5 rounded-xl">
                      <StatBar label="Health Point" value={player.生命值} max={player.最大生命值} color="bg-accent-green" />
                      <StatBar label="Mind Point" value={player.精神力} max={player.最大精神力} color="bg-accent-blue" />
                  </div>
              </div>

              {/* Right Column: Stats & Details */}
              <div className="flex-1 space-y-6">
                  {/* Attributes Grid */}
                  <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-content-muted mb-3 flex items-center gap-2">
                          <LayoutGrid size={14} /> Basic Abilities
                      </h3>
                      <AttributeHex stats={player} />
                  </div>

                  {/* Status Effects */}
                  <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-content-muted mb-3 flex items-center gap-2">
                          <AlertCircle size={14} /> Condition
                      </h3>
                      <div className="bg-surface-base border border-white/5 rounded-xl p-4 min-h-[100px]">
                          {player.状态 && player.状态.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                  {player.状态.map((s: any, i: number) => (
                                      <div key={i} className="px-3 py-1.5 bg-red-900/20 border border-red-500/30 rounded text-red-200 text-xs font-medium flex items-center gap-2">
                                          <AlertCircle size={12} />
                                          {typeof s === 'string' ? s : s.名称}
                                      </div>
                                  ))}
                              </div>
                          ) : (
                              <div className="h-full flex items-center justify-center text-content-muted text-sm italic opacity-50">
                                  Healthy Condition
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Familia Info */}
                  <div className="bg-surface-glass border border-white/10 rounded-xl p-5 flex justify-between items-center">
                      <div>
                          <div className="text-[10px] font-bold uppercase text-content-muted mb-1">Familia</div>
                          <div className="text-lg font-display font-bold text-content-primary">{player.眷族 || 'None'}</div>
                      </div>
                      <div className="text-right">
                          <div className="text-[10px] font-bold uppercase text-content-muted mb-1">Valis</div>
                          <div className="text-lg font-mono font-bold text-accent-gold">0</div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderEquipmentTab = () => (
      <div className="flex flex-col md:flex-row h-full animate-in fade-in duration-300">
          {/* Slot Selection Sidebar */}
          <div className="w-full md:w-64 bg-surface-base border-r border-white/5 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2">
              <div className="text-[10px] font-bold uppercase text-content-muted mb-2 px-2">Equipment Slots</div>
              {equipSlots.map(slot => {
                  const equippedName = player.装备?.[slot.key];
                  const active = activeEquipSlot === slot.key;
                  return (
                      <button
                          key={slot.key}
                          onClick={() => setActiveEquipSlot(slot.key)}
                          className={clsx(
                              "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left group relative overflow-hidden",
                              active 
                                  ? "bg-accent-blue/10 border-accent-blue/50 text-content-primary shadow-sm" 
                                  : "bg-surface-overlay border-white/5 text-content-secondary hover:border-white/20"
                          )}
                      >
                          {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-blue" />}
                          <div className={clsx("transition-colors", active ? "text-accent-blue" : "text-content-muted group-hover:text-content-primary")}>
                              {slot.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className="text-[10px] uppercase font-bold opacity-70 mb-0.5">{slot.label}</div>
                              <div className={clsx("text-xs font-medium truncate", equippedName ? "text-content-primary" : "text-content-muted italic")}>
                                  {equippedName || 'Empty'}
                              </div>
                          </div>
                      </button>
                  );
              })}
          </div>

          {/* Item Detail View */}
          <div className="flex-1 bg-surface-overlay/50 relative flex items-center justify-center p-8">
              {slotItem.exists ? (
                  <div className="max-w-md w-full text-center space-y-6">
                      {/* Icon */}
                      <div className="w-32 h-32 mx-auto bg-surface-base border-2 border-white/10 rounded-full flex items-center justify-center shadow-2xl relative">
                          <div className="absolute inset-0 bg-accent-blue/5 rounded-full animate-pulse" />
                          <div className="relative z-10 scale-150 text-content-primary drop-shadow-lg">
                              {slotItem.item ? (
                                  isWeaponItem(slotItem.item) ? <Sword size={40} /> : <Shield size={40} />
                              ) : (
                                  <Box size={40} className="text-content-muted" />
                              )}
                          </div>
                      </div>

                      {/* Info */}
                      <div>
                          <h2 className="text-3xl font-display font-bold text-content-primary mb-2">{slotItem.label}</h2>
                          {slotItem.item && (
                              <div className="flex items-center justify-center gap-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-content-primary border border-white/10">
                                      {getQualityLabel(slotItem.item.品质)}
                                  </span>
                                  <span className="text-xs text-content-muted uppercase tracking-wider">{getTypeLabel(slotItem.item.类型)}</span>
                              </div>
                          )}
                      </div>

                      {/* Stats */}
                      {slotItem.item && (
                          <div className="grid grid-cols-2 gap-4">
                              {slotItem.item.攻击力 && (
                                  <div className="p-3 bg-black/20 rounded border border-white/5">
                                      <div className="text-[10px] text-content-muted uppercase">Attack</div>
                                      <div className="text-xl font-mono font-bold text-accent-red">{slotItem.item.攻击力}</div>
                                  </div>
                              )}
                              {slotItem.item.防御力 && (
                                  <div className="p-3 bg-black/20 rounded border border-white/5">
                                      <div className="text-[10px] text-content-muted uppercase">Defense</div>
                                      <div className="text-xl font-mono font-bold text-accent-blue">{slotItem.item.防御力}</div>
                                  </div>
                              )}
                          </div>
                      )}

                      {/* Action */}
                      <BaseButton 
                          variant="danger" 
                          className="w-full mt-8"
                          leftIcon={<LogOut size={16} />}
                          onClick={() => onUnequipItem(activeEquipSlot, slotItem.label, slotItem.item?.id)}
                      >
                          Unequip Item
                      </BaseButton>
                  </div>
              ) : (
                  <div className="text-content-muted flex flex-col items-center gap-4 opacity-50">
                      <div className="w-24 h-24 border-2 border-dashed border-white/20 rounded-full flex items-center justify-center">
                          <Box size={32} />
                      </div>
                      <span className="text-sm font-bold uppercase tracking-widest">No Item Equipped</span>
                  </div>
              )}
          </div>
      </div>
  );

  const renderSkillsTab = () => (
      <div className="p-6 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {player.技能 && player.技能.length > 0 ? player.技能.map((skill, i) => (
                  <div key={i} className="bg-surface-overlay border border-white/5 p-5 rounded-xl hover:border-accent-blue/30 hover:bg-surface-glass transition-all group">
                      <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                              <Zap size={16} className="text-accent-gold" />
                              <h4 className="font-bold text-content-primary">{skill.名称}</h4>
                          </div>
                          {skill.等级 && <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded text-content-muted">Lv.{skill.等级}</span>}
                      </div>
                      <div className="text-xs text-content-secondary leading-relaxed mb-3 line-clamp-3">
                          {skill.描述 || skill.效果 || 'No description available.'}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-content-muted uppercase font-bold tracking-wider pt-3 border-t border-white/5">
                          <span>{skill.类别 || 'Passive'}</span>
                          {skill.消耗 && <span className="text-accent-blue">{formatSkillCost(skill.消耗)}</span>}
                      </div>
                  </div>
              )) : (
                  <div className="col-span-full py-20 text-center text-content-muted">No Skills Learned</div>
              )}
          </div>
      </div>
  );

  const renderMagicTab = () => (
      <div className="p-6 h-full overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {player.魔法 && player.魔法.length > 0 ? player.魔法.map((spell, i) => (
                  <div key={i} className="bg-surface-overlay border border-white/5 p-5 rounded-xl hover:border-purple-500/30 hover:bg-surface-glass transition-all group relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Sparkles size={48} />
                      </div>
                      <div className="flex justify-between items-start mb-2 relative z-10">
                          <div className="flex items-center gap-2">
                              <Sparkles size={16} className="text-purple-400" />
                              <h4 className="font-bold text-content-primary">{spell.名称}</h4>
                          </div>
                      </div>
                      {spell.咏唱 && (
                          <div className="text-xs text-purple-200/80 italic font-serif mb-3 pl-2 border-l-2 border-purple-500/30">
                              "{spell.咏唱}"
                          </div>
                      )}
                      <div className="text-xs text-content-secondary leading-relaxed mb-3 line-clamp-3 relative z-10">
                          {spell.描述 || spell.效果}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-content-muted uppercase font-bold tracking-wider pt-3 border-t border-white/5 relative z-10">
                          <span>{spell.属性 || 'Magic'}</span>
                          {spell.消耗 && <span className="text-accent-blue">{formatSkillCost(spell.消耗)}</span>}
                      </div>
                  </div>
              )) : (
                  <div className="col-span-full py-20 text-center text-content-muted">No Magic Spells Learned</div>
              )}
          </div>
      </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#050508] overflow-hidden">
        {/* Top Navigation */}
        <div className="h-14 bg-surface-glass border-b border-white/5 flex items-center px-4 justify-between shrink-0 backdrop-blur-md z-20">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-fade-right">
                {[
                    { id: 'STATUS', label: 'Status', icon: <User size={14}/> },
                    { id: 'EQUIPMENT', label: 'Equip', icon: <Shield size={14}/> },
                    { id: 'SKILLS', label: 'Skills', icon: <Zap size={14}/> },
                    { id: 'MAGIC', label: 'Magic', icon: <Sparkles size={14}/> },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as CharTab)}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                            activeTab === tab.id 
                                ? "bg-white/10 text-white shadow-sm" 
                                : "text-content-muted hover:text-content-primary hover:bg-white/5"
                        )}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>
            
            {onClose && (
                <button onClick={onClose} className="p-2 text-content-muted hover:text-white transition-colors">
                    <Cross className="rotate-45" size={20} />
                </button>
            )}
        </div>

        {/* Content Body */}
        <div className="flex-1 relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
            {activeTab === 'STATUS' && renderStatusTab()}
            {activeTab === 'EQUIPMENT' && renderEquipmentTab()}
            {activeTab === 'SKILLS' && renderSkillsTab()}
            {activeTab === 'MAGIC' && renderMagicTab()}
        </div>
    </div>
  );
};

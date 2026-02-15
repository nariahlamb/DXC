import React, { useEffect, useMemo, useState } from 'react';
import { CombatContainer } from '../combat/CombatContainer';
import { ActionDock } from '../combat/ActionDock';
import { CombatResolutionPanel } from '../combat/CombatResolutionPanel';
import { TacticalGrid } from '../combat/map/TacticalGrid';
import { normalizeCombatState } from '../../adapters/combatAdapter';
import { CombatState, CharacterStats, Skill, MagicSpell, InventoryItem, ActionOption, Confidant } from '../../types';
import { CombatResolutionEvent, DicePool, EncounterRow, LogOutline, LogSummary, TavernActionOption } from '../../types/extended';
import { getItemCategory } from '../../utils/itemUtils';
import { CloudFog, Footprints, Package, Search, Sparkles, Swords, Users, X } from 'lucide-react';

interface CombatPanelProps {
  combatState: CombatState;
  playerStats: CharacterStats;
  skills: Skill[];
  magic: MagicSpell[];
  inventory?: InventoryItem[];
  confidants?: Confidant[];
  dicePool?: DicePool;
  actionOptions?: (ActionOption | TavernActionOption)[];
  encounters?: EncounterRow[];
  logSummaries?: LogSummary[];
  logOutlines?: LogOutline[];
  onPlayerAction: (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => void;
  onActionOptionSelect?: (text: string) => void;
}

interface CombatEntityVM {
  id: string;
  name: string;
  type: string;
  status?: string;
  hp: number;
  maxHp: number;
  ac?: number;
  description?: string;
  effects: string[];
  position?: { x: number; y: number };
}

const panelShell = 'rounded-xl border border-amber-600/35 bg-[linear-gradient(140deg,rgba(52,24,18,.92),rgba(14,12,16,.88))] shadow-[0_10px_30px_rgba(0,0,0,.35)]';

const formatSigned = (value: number): string => (value >= 0 ? `+${value}` : `${value}`);

const toNumberOrUndefined = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : (typeof value === 'string' ? Number(value) : NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseEffects = (row: any): string[] => {
  const source = row?.状态效果 ?? row?.effects ?? row?.BUFFS ?? row?.DEBUFFS;
  if (Array.isArray(source)) {
    return source.map((item) => String(item)).filter(Boolean).slice(0, 3);
  }
  if (typeof source === 'string' && source.trim()) {
    return source.split(/[;,，；|]/g).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  }
  return [];
};

const isBattleActorRow = (row: any): boolean => {
  if (!row) return false;
  if (row.类型 === '障碍物' || row.类型 === '地形') return false;
  if (row.类型 === '玩家' || row.类型 === '敌人' || row.类型 === '友方') return true;
  const hasCombatStats = !!row.生命值 || toNumberOrUndefined(row?.AC ?? row?.护甲等级 ?? row?.防御) !== undefined;
  return hasCombatStats;
};

const DicePoolPanel: React.FC<{ dice?: DicePool }> = ({ dice }) => {
  if (!dice || dice.length === 0) return null;
  return (
    <div className={`${panelShell} p-3`}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">骰池</div>
      <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
        {dice.map(row => (
          <div
            key={row.id}
            className="flex items-center justify-between text-[11px] bg-black/30 border border-amber-900/50 rounded px-2 py-1"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-emerald-300 font-mono uppercase">{row.类型?.toUpperCase() || 'D?'}</span>
              <span className="text-amber-100 font-semibold">{row.数值}</span>
              {row.用途 && <span className="text-zinc-400 truncate">{row.用途}</span>}
            </div>
            {row.已使用 && <span className="text-[10px] text-amber-300">已使用</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

const ActionOptionsPanel: React.FC<{ options?: (ActionOption | TavernActionOption)[]; onSelect?: (text: string) => void }> = ({ options, onSelect }) => {
  if (!options || options.length === 0) return null;
  const renderLabel = (opt: ActionOption | TavernActionOption) => (typeof opt === 'string' ? opt : opt.名称 || opt.id || '行动');
  const renderDesc = (opt: ActionOption | TavernActionOption) => (typeof opt === 'string' ? '' : opt.描述 || '');
  const renderMeta = (opt: ActionOption | TavernActionOption) => {
    if (typeof opt === 'string') return '';
    const cost = opt.消耗;
    if (!cost) return opt.类型 || '';
    const parts = [] as string[];
    if (cost.体力) parts.push(`体力${cost.体力}`);
    if (cost.精神) parts.push(`精神${cost.精神}`);
    if (cost.法利) parts.push(`法利${cost.法利}`);
    if (cost.物品) parts.push(`物品:${cost.物品}`);
    return [opt.类型, parts.join(' / ')].filter(Boolean).join(' · ');
  };

  return (
    <div className={`${panelShell} p-3`}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">战术建议</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
        {options.map((opt, idx) => {
          const label = renderLabel(opt);
          const desc = renderDesc(opt);
          const meta = renderMeta(opt);
          return (
            <button
              type="button"
              key={idx}
              onClick={onSelect ? () => onSelect(desc || label) : undefined}
              className={`w-full text-left bg-black/30 border border-amber-900/40 hover:border-amber-500/60 hover:bg-amber-950/30 transition-colors rounded px-3 py-2 ${onSelect ? '' : 'cursor-default'}`}
            >
              <div className="text-sm font-semibold text-amber-50 truncate">{label}</div>
              {meta && <div className="text-[11px] text-emerald-300 mt-0.5 truncate">{meta}</div>}
              {desc && <div className="text-[11px] text-zinc-300 mt-1 leading-snug line-clamp-2">{desc}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ActionEconomyPanel: React.FC<{
  economy?: CombatState['行动经济'];
  currentActor?: string;
  unitNames?: Record<string, string>;
}> = ({ economy, currentActor, unitNames }) => {
  if (!economy || !economy.资源 || economy.资源.length === 0) return null;
  return (
    <div className={`${panelShell} p-3`}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">行动经济 · R{economy.回合}</div>
      <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
        {economy.资源.map(row => {
          const isCurrent = (economy.当前行动者 || currentActor) === row.单位ID;
          const displayName = unitNames?.[row.单位ID] || row.单位ID;
          return (
            <div
              key={row.单位ID}
              className={`text-[11px] border rounded px-2 py-1 ${isCurrent
                ? 'border-cyan-400/60 bg-cyan-950/30 text-cyan-50'
                : 'border-amber-900/40 bg-black/25 text-zinc-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{displayName}</span>
                <span className="text-[10px] text-zinc-400">{row.单位ID}</span>
              </div>
              <div className="mt-0.5 text-[10px] flex flex-wrap gap-x-3 gap-y-1 text-zinc-300">
                <span>动作 {row.动作}</span>
                <span>附赠 {row.附赠}</span>
                <span>反应 {row.反应}</span>
                <span>移动 {row.移动}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EncounterPanel: React.FC<{ encounters?: EncounterRow[] }> = ({ encounters }) => {
  if (!encounters || encounters.length === 0) return null;
  return (
    <div className={`${panelShell} p-3`}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">遭遇</div>
      <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
        {encounters.map(row => (
          <div key={row.id} className="text-[11px] bg-black/30 border border-amber-900/40 rounded px-2 py-1">
            <div className="flex justify-between items-center gap-2">
              <span className="text-amber-100 font-semibold truncate">{row.名称}</span>
              <span className="text-emerald-300 shrink-0">{row.类型}</span>
            </div>
            {row.状态 && <div className="text-amber-200 mt-0.5">{row.状态}</div>}
            {row.描述 && <div className="text-zinc-300 mt-0.5 leading-snug line-clamp-2">{row.描述}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

const LogsPanel: React.FC<{ summaries?: LogSummary[]; outlines?: LogOutline[] }> = ({ summaries, outlines }) => {
  if ((!summaries || summaries.length === 0) && (!outlines || outlines.length === 0)) return null;
  return (
    <div className={`${panelShell} p-3 space-y-2`}>
      {summaries && summaries.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-1">日志摘要</div>
          <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1">
            {summaries.map((s, idx) => (
              <div key={idx} className="text-[11px] bg-black/30 border border-amber-900/40 rounded px-2 py-1">
                <div className="flex items-center justify-between">
                  <span className="text-amber-100">回合 {s.回合}</span>
                  <span className="text-zinc-400">{s.时间}</span>
                </div>
                <div className="text-zinc-200 leading-snug">{s.摘要}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {outlines && outlines.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-1">剧情大纲</div>
          <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1">
            {outlines.map((o, idx) => (
              <div key={idx} className="text-[11px] bg-black/30 border border-amber-900/40 rounded px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-amber-100 truncate">{o.标题}</span>
                  <span className="text-zinc-400 shrink-0">{o.章节}</span>
                </div>
                <div className="text-zinc-300 leading-snug truncate">{o.事件列表?.join(' / ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const QuickActionButton: React.FC<{
  label: string;
  sub?: string;
  icon: React.ReactNode;
  tone: 'blue' | 'purple' | 'amber' | 'red';
  onClick: () => void;
}> = ({ label, sub, icon, tone, onClick }) => {
  const toneMap: Record<string, string> = {
    blue: 'from-sky-700/70 to-blue-800/70 border-sky-400/40 text-sky-100',
    purple: 'from-purple-700/70 to-fuchsia-800/70 border-purple-400/40 text-purple-100',
    amber: 'from-amber-700/70 to-orange-800/70 border-amber-400/40 text-amber-100',
    red: 'from-red-700/70 to-rose-800/70 border-red-400/40 text-red-100'
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-gradient-to-b px-3 py-2 text-left transition-all hover:brightness-110 active:scale-[0.98] ${toneMap[tone]}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        <span>{label}</span>
      </div>
      {sub && <div className="text-[11px] text-white/70 mt-0.5">{sub}</div>}
    </button>
  );
};

export const CombatPanel: React.FC<CombatPanelProps> = ({
  combatState,
  playerStats,
  skills,
  magic,
  inventory = [],
  confidants = [],
  dicePool,
  actionOptions,
  encounters,
  logSummaries,
  logOutlines,
  onPlayerAction,
  onActionOptionSelect
}) => {
  const enemies = useMemo(() => normalizeCombatState(combatState, playerStats.等级), [combatState, playerStats.等级]);
  const logs = useMemo(() => combatState.战斗记录 || [], [combatState.战斗记录]);

  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [showNpcDrawer, setShowNpcDrawer] = useState(false);
  const [npcQuery, setNpcQuery] = useState('');
  const [npcStatusFilter, setNpcStatusFilter] = useState<'ALL' | '在场' | '离场' | '死亡' | '失踪'>('ALL');

  const combatEntities = useMemo<CombatEntityVM[]>(() => {
    const allBattleRows = Array.isArray(combatState.地图) ? combatState.地图 : [];
    const battleRows = allBattleRows.filter(isBattleActorRow);
    const enemyByName = new Map(enemies.map(enemy => [enemy.name, enemy]));
    const enemyById = new Map(enemies.map(enemy => [enemy.id, enemy]));

    if (battleRows.length > 0) {
      return battleRows.map((row, index) => {
        const linkedEnemy = enemyById.get(row.UNIT_ID) || enemyByName.get(row.名称);
        const hp = row.生命值?.当前 ?? linkedEnemy?.hp ?? 0;
        const maxHp = row.生命值?.最大 ?? linkedEnemy?.maxHp ?? Math.max(hp, 1);
        const ac = toNumberOrUndefined((row as any).AC) ?? toNumberOrUndefined((row as any).护甲等级) ?? toNumberOrUndefined((row as any).防御);
        return {
          id: row.UNIT_ID || `row_${index}`,
          name: row.名称 || linkedEnemy?.name || `单位${index + 1}`,
          type: row.类型 || '其他',
          status: row.状态,
          hp,
          maxHp,
          ac,
          description: row.描述 || linkedEnemy?.description,
          effects: parseEffects(row),
          position: row.位置
        };
      });
    }

    return enemies.map((enemy, index) => ({
      id: enemy.id || `enemy_${index}`,
      name: enemy.name,
      type: '敌人',
      status: enemy.hp <= 0 ? '死亡' : '正常',
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      ac: undefined,
      description: enemy.description,
      effects: [],
      position: { x: index + 1, y: 1 }
    }));
  }, [combatState.地图, enemies]);

  useEffect(() => {
    if (combatEntities.length === 0) {
      setSelectedEnemyId(null);
      return;
    }
    if (!selectedEnemyId || !combatEntities.some(entity => entity.id === selectedEnemyId)) {
      setSelectedEnemyId(combatEntities[0].id);
    }
  }, [combatEntities, selectedEnemyId]);

  const selectedEntity = useMemo(
    () => combatEntities.find(entity => entity.id === selectedEnemyId) || null,
    [combatEntities, selectedEnemyId]
  );

  const handleAction = (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => {
    const finalPayload = selectedEntity && ['attack', 'skill'].includes(action)
      ? {
          ...(payload || {}),
          targetId: selectedEntity.id,
          targetName: selectedEntity.name,
          targetUnitId: selectedEntity.id
        }
      : payload;
    onPlayerAction(action, finalPayload);
  };

  const initiativeUnitNames = useMemo(() => {
    const names: Record<string, string> = {};
    combatEntities.forEach(entity => {
      names[entity.id] = entity.name;
    });
    return names;
  }, [combatEntities]);

  const npcRows = useMemo(() => {
    const battleMapRows = (Array.isArray(combatState.地图) ? combatState.地图 : []).filter(isBattleActorRow);
    const mapRowsById = new Map(battleMapRows.map(row => [row.UNIT_ID, row] as const));
    const mapRowsByName = new Map(battleMapRows.map(row => [row.名称, row] as const));
    const normalizeStatus = (npc: Confidant): '在场' | '离场' | '死亡' | '失踪' => {
      const explicit = (npc as any).当前状态;
      if (explicit === '在场' || explicit === '离场' || explicit === '死亡' || explicit === '失踪') return explicit;
      if (npc.是否在场 === true) return '在场';
      if (npc.是否在场 === false) return '离场';
      return '离场';
    };
    const toLevelText = (value: unknown) => {
      if (value === null || value === undefined || value === '') return '';
      return `Lv.${String(value)}`;
    };
    const rows = confidants.map((npc) => {
      const status = normalizeStatus(npc);
      const linkedMapRow = mapRowsById.get(npc.id) || mapRowsByName.get(npc.姓名);
      const combatLinked = !!linkedMapRow;
      const hpText = npc.生存数值
        ? `${npc.生存数值.当前生命}/${npc.生存数值.最大生命}`
        : '';
      const acValue = (npc as any).护甲等级 ?? (npc as any).AC;
      const acText = acValue !== undefined && acValue !== null && acValue !== '' ? `AC${acValue}` : '';
      const relation = (npc as any).与主角关系 || npc.关系状态 || '';
      const location = (npc as any).所在位置 || npc.位置详情 || '未知地点';
      const identity = (npc as any).职业身份 || npc.身份 || '';
      return {
        id: npc.id,
        name: npc.姓名,
        status,
        relation,
        location,
        identity,
        levelText: toLevelText(npc.等级),
        hpText,
        acText,
        combatLinked,
        linkedUnitId: linkedMapRow?.UNIT_ID
      };
    });

    const statusPriority: Record<string, number> = { 在场: 0, 离场: 1, 失踪: 2, 死亡: 3 };
    rows.sort((a, b) => {
      if (a.combatLinked !== b.combatLinked) return a.combatLinked ? -1 : 1;
      const byStatus = (statusPriority[a.status] ?? 9) - (statusPriority[b.status] ?? 9);
      if (byStatus !== 0) return byStatus;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return rows;
  }, [combatState.地图, confidants]);

  const filteredNpcRows = useMemo(() => {
    const normalizedQuery = npcQuery.trim().toLowerCase();
    return npcRows.filter((row) => {
      if (npcStatusFilter !== 'ALL' && row.status !== npcStatusFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${row.name} ${row.identity} ${row.location} ${row.relation}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [npcQuery, npcRows, npcStatusFilter]);

  const effectiveBattleMap = useMemo(() => {
    const existingRows = Array.isArray(combatState.地图) ? combatState.地图 : [];
    const buildFallbackActorRows = () => {
      if (combatEntities.length === 0) return [] as any[];
      const normalizedRows = combatEntities.map((entity, index) => {
        const typeText = String(entity.type || '').toLowerCase();
        const mappedType: '玩家' | '敌人' | '友方' | '其他' =
          entity.type === '玩家' || /player|主角|玩家/.test(typeText)
            ? '玩家'
            : (entity.type === '敌人' || /enemy|怪|敌/.test(typeText)
              ? '敌人'
              : (entity.type === '友方' || /ally|友方|队友/.test(typeText) ? '友方' : '其他'));
        return {
          UNIT_ID: entity.id || `AUTO_UNIT_${index + 1}`,
          名称: entity.name || `单位${index + 1}`,
          类型: mappedType,
          位置: entity.position || { x: Math.max(1, (index % 6) + 2), y: Math.max(1, Math.floor(index / 6) + 2) },
          生命值: {
            当前: Math.max(0, Number(entity.hp || 0)),
            最大: Math.max(1, Number(entity.maxHp || entity.hp || 1))
          },
          状态: entity.status
        };
      });

      const hasPlayerRow = normalizedRows.some(row => row.类型 === '玩家');
      if (hasPlayerRow) return normalizedRows;
      return [
        {
          UNIT_ID: 'PC_AUTO',
          名称: playerStats.姓名 || '主角',
          类型: '玩家',
          位置: { x: 1, y: 1 },
          生命值: {
            当前: Math.max(0, Number(playerStats.生命值 || 0)),
            最大: Math.max(1, Number(playerStats.最大生命值 || playerStats.生命值 || 1))
          },
          状态: '正常'
        },
        ...normalizedRows
      ];
    };

    if (existingRows.length === 0) {
      return buildFallbackActorRows();
    }

    const hasActorRows = existingRows.some(isBattleActorRow);
    if (hasActorRows) return existingRows;

    const fallbackActors = buildFallbackActorRows();
    if (fallbackActors.length === 0) return existingRows;

    const existingIds = new Set(existingRows.map(row => String(row?.UNIT_ID || '')).filter(Boolean));
    const mergedActors = fallbackActors.filter(row => !existingIds.has(String(row.UNIT_ID || '')));
    return [...existingRows, ...mergedActors];
  }, [combatState.地图, combatEntities, playerStats.姓名, playerStats.生命值, playerStats.最大生命值]);

  const hasMapData = effectiveBattleMap.length > 0;

  const resolutionEvents = useMemo<CombatResolutionEvent[]>(() => {
    if (combatState.判定事件 && combatState.判定事件.length > 0) {
      return combatState.判定事件;
    }
    if (!dicePool || dicePool.length === 0) {
      return [];
    }
    return dicePool.slice(-6).map((row, index) => ({
      id: `dice-${row.id || index}`,
      行动者: '系统',
      动作: row.用途 || '骰池记录',
      骰子: row.类型,
      掷骰: row.数值,
      是否成功: row.已使用 ? true : undefined,
      结果: row.已使用 ? '已用于判定' : '待分配用途',
      标签: ['dice_pool_fallback']
    }));
  }, [combatState.判定事件, dicePool]);

  const currentRound = combatState.行动经济?.回合
    || resolutionEvents[resolutionEvents.length - 1]?.回合
    || 1;

  const currentActorId = combatState.current_actor || combatState.行动经济?.当前行动者 || selectedEnemyId || null;
  const currentActor = currentActorId ? initiativeUnitNames[currentActorId] || currentActorId : '等待行动者';
  const currentEconomy = combatState.行动经济?.资源?.find(row => row.单位ID === currentActorId);

  const dndProfile = playerStats.DND档案 || playerStats.dndProfile;
  const spellSlots = dndProfile?.法术位 ? Object.entries(dndProfile.法术位) : [];
  const quickConsumables = inventory.filter(item => getItemCategory(item) === 'CONSUMABLE').slice(0, 4);

  const combinedActions = [...skills, ...magic];

  const triggerQuickSkill = () => {
    const first = combinedActions[0];
    if (!first) {
      onPlayerAction('talk', '我尝试进行技能动作，但当前没有可用技能。');
      return;
    }
    const isMagic = '属性' in first;
    handleAction('skill', {
      ...first,
      __kind: isMagic ? 'MAGIC' : 'SKILL'
    });
  };

  const triggerQuickItem = () => {
    const first = quickConsumables[0];
    if (!first) {
      onPlayerAction('talk', '我尝试使用道具，但背包中没有可用消耗品。');
      return;
    }
    handleAction('item', first);
  };

  const triggerQuickMove = () => {
    onPlayerAction('talk', selectedEntity
      ? `我向 ${selectedEntity.name} 所在方向执行战术移动，寻找掩体与有利站位。`
      : '我执行战术移动，优先占据有利地形。');
  };

  return (
    <CombatContainer>
      <div className="flex-1 min-h-0 p-2 md:p-4">
        <div className="h-full min-h-0 rounded-2xl border border-amber-400/40 bg-[linear-gradient(150deg,rgba(48,18,12,.95),rgba(10,8,14,.92))] shadow-[0_20px_60px_rgba(0,0,0,.45)] flex flex-col overflow-hidden relative">
          <header className="shrink-0 border-b border-amber-400/25 px-3 md:px-5 py-3 bg-[linear-gradient(90deg,rgba(96,30,22,.85),rgba(40,18,26,.78),rgba(16,16,20,.78))]">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-amber-300/70 bg-black/50 flex items-center justify-center text-amber-200 font-bold text-lg">D20</div>
                  <div className="min-w-0">
                    <div className="text-xl md:text-2xl font-display font-bold text-amber-100 truncate">
                      Level {playerStats.等级} · {combatState.视觉?.地形描述 || selectedEntity?.name || '战术交战区域'}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-amber-100/80 mt-1">
                      <span className="inline-flex items-center gap-1"><CloudFog size={14} />{combatState.视觉?.天气 || '战场天气未知'}</span>
                      <span>{combatState.视觉?.光照 || '光照未标注'}</span>
                      <span className="text-rose-300 inline-flex items-center gap-1"><Swords size={14} />{combatState.是否战斗中 ? '战斗中' : '待命'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-3 text-[11px]">
                <div className="px-2.5 py-1 rounded-full border border-amber-500/40 bg-black/35 text-amber-100">Round {currentRound}</div>
                <div className="px-2.5 py-1 rounded-full border border-cyan-500/40 bg-cyan-950/30 text-cyan-100 truncate max-w-full lg:max-w-[220px]">当前行动: {currentActor}</div>
                <button
                  type="button"
                  onClick={() => setShowNpcDrawer(true)}
                  className="px-2.5 py-1 rounded-full border border-amber-500/40 bg-black/35 text-amber-100 inline-flex items-center gap-1.5 hover:border-amber-300/70 transition-colors"
                >
                  <Users size={13} />
                  NPC {npcRows.length}
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 min-h-0 p-3 md:p-4 grid grid-cols-1 2xl:grid-cols-[1.05fr_1.25fr] gap-3 overflow-y-auto custom-scrollbar">
            <section className="min-h-0 flex flex-col gap-3">
              <div className={`${panelShell} p-2 flex-1 min-h-[320px] md:min-h-[400px] overflow-hidden`}>
                {hasMapData ? (
                  <TacticalGrid
                    mapVisuals={combatState.视觉}
                    battleMap={effectiveBattleMap as any}
                    selectedId={selectedEnemyId}
                    onSelect={setSelectedEnemyId}
                    className="rounded-lg"
                  />
                ) : (
                  <div className="w-full h-full rounded-lg border border-amber-900/40 bg-black/35 flex items-center justify-center text-center px-6">
                    <div>
                      <div className="text-amber-200 text-sm mb-1">战术地图数据尚未就绪</div>
                      <div className="text-zinc-400 text-xs">请让 AI 返回 `战斗.视觉` 与 `战斗.地图`，即可显示网格战场。</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ActionEconomyPanel
                  economy={combatState.行动经济}
                  currentActor={combatState.current_actor}
                  unitNames={initiativeUnitNames}
                />

                <div className={`${panelShell} p-3`}>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">快速动作</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <QuickActionButton
                      label="移动"
                      sub={currentEconomy ? `移动剩余 ${currentEconomy.移动}` : '战术位移'}
                      icon={<Footprints size={16} />}
                      tone="blue"
                      onClick={triggerQuickMove}
                    />
                    <QuickActionButton
                      label="技能"
                      sub={combinedActions[0]?.名称 || '暂无技能'}
                      icon={<Sparkles size={16} />}
                      tone="purple"
                      onClick={triggerQuickSkill}
                    />
                    <QuickActionButton
                      label="物品"
                      sub={quickConsumables[0] ? `${quickConsumables[0].名称} x${quickConsumables[0].数量}` : '暂无消耗品'}
                      icon={<Package size={16} />}
                      tone="amber"
                      onClick={triggerQuickItem}
                    />
                    <QuickActionButton
                      label="攻击"
                      sub={selectedEntity ? `目标 ${selectedEntity.name}` : '选择目标后攻击'}
                      icon={<Swords size={16} />}
                      tone="red"
                      onClick={() => handleAction('attack')}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="min-h-0 flex flex-col gap-3">
              <div className={`${panelShell} p-3 flex-1 min-h-[280px] md:min-h-[300px]`}>
                <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">战斗单位</div>
                <div className="space-y-2 max-h-full overflow-y-auto custom-scrollbar pr-1">
                  {combatEntities.map(entity => {
                    const hpPct = entity.maxHp > 0 ? Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100)) : 0;
                    const active = entity.id === selectedEnemyId;
                    const effectText = entity.effects.join(' · ');
                    return (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => setSelectedEnemyId(entity.id)}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${active
                          ? 'border-amber-300/70 bg-amber-900/25 shadow-[0_0_18px_rgba(245,158,11,.2)]'
                          : 'border-amber-900/40 bg-black/25 hover:border-amber-700/60'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full border border-amber-300/60 bg-black/50 flex items-center justify-center text-lg font-bold text-amber-200">
                            {entity.name.slice(0, 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-lg font-display font-semibold text-amber-100 truncate">{entity.name}</div>
                              <div className="text-[11px] text-zinc-300 shrink-0">AC: {entity.ac ?? '--'}</div>
                            </div>
                            <div className="h-2 mt-1 rounded-full bg-black/40 overflow-hidden border border-amber-900/40">
                              <div className="h-full bg-gradient-to-r from-emerald-500/90 to-lime-400/80" style={{ width: `${hpPct}%` }} />
                            </div>
                            <div className="text-[11px] mt-1 text-zinc-300 truncate">
                              {entity.type}
                              {' · '}HP {entity.hp}/{entity.maxHp}
                              {entity.status ? ` · ${entity.status}` : ''}
                              {entity.position ? ` · (${entity.position.x},${entity.position.y})` : ''}
                              {currentActorId === entity.id ? ' · 当前行动' : ''}
                            </div>
                            {effectText && <div className="text-[11px] text-amber-200/90 truncate">{effectText}</div>}
                            {entity.description && <div className="text-[10px] text-zinc-400 truncate">{entity.description}</div>}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {combatEntities.length === 0 && (
                    <div className="text-center py-10 text-zinc-500 text-sm">暂无战斗单位</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
                <DicePoolPanel dice={dicePool} />
                <CombatResolutionPanel events={resolutionEvents} />
              </div>

              <ActionOptionsPanel options={actionOptions} onSelect={onActionOptionSelect} />
            </section>
          </div>

          <div className="shrink-0 border-t border-amber-400/20 px-3 md:px-4 py-3 bg-black/20">
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-zinc-200">
              <span className="px-2.5 py-1 rounded-full border border-amber-700/50 bg-black/30">法利 {playerStats.法利} gp</span>
              <span className="px-2.5 py-1 rounded-full border border-amber-700/50 bg-black/30">HP {playerStats.生命值}/{playerStats.最大生命值}</span>
              <span className="px-2.5 py-1 rounded-full border border-amber-700/50 bg-black/30">MP {playerStats.精神力}/{playerStats.最大精神力}</span>
              {toNumberOrUndefined(dndProfile?.护甲等级) !== undefined && (
                <span className="px-2.5 py-1 rounded-full border border-cyan-700/50 bg-cyan-950/25 text-cyan-100">AC {dndProfile?.护甲等级}</span>
              )}
              {toNumberOrUndefined(dndProfile?.先攻加值) !== undefined && (
                <span className="px-2.5 py-1 rounded-full border border-cyan-700/50 bg-cyan-950/25 text-cyan-100">先攻 {formatSigned(Number(dndProfile?.先攻加值 || 0))}</span>
              )}
              {spellSlots.slice(0, 4).map(([level, slot]) => (
                <span key={level} className="px-2.5 py-1 rounded-full border border-purple-700/50 bg-purple-950/25 text-purple-100">{level}环 {slot}</span>
              ))}
              {quickConsumables.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAction('item', item)}
                  className="px-2.5 py-1 rounded-full border border-amber-700/50 bg-black/30 hover:border-amber-400/70 hover:bg-amber-950/30 transition-colors"
                >
                  {item.名称} x{item.数量}
                </button>
              ))}
            </div>
          </div>

          {showNpcDrawer && (
            <div className="absolute inset-0 z-40 bg-black/45 backdrop-blur-[1px] flex justify-end">
              <div className="w-full md:w-[620px] h-full border-l border-amber-500/35 bg-[linear-gradient(150deg,rgba(56,24,18,.96),rgba(16,10,16,.95))] shadow-[-12px_0_40px_rgba(0,0,0,.45)] flex flex-col">
                <div className="px-4 py-3 border-b border-amber-500/25 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-amber-100 text-2xl font-display font-bold">NPC 列表</div>
                    <div className="text-[12px] text-zinc-300 mt-1">{filteredNpcRows.length} / {npcRows.length} 人</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNpcDrawer(false)}
                    className="w-9 h-9 rounded border border-amber-600/40 text-zinc-200 hover:text-amber-100 hover:border-amber-300/70 bg-black/30 flex items-center justify-center transition-colors"
                    aria-label="关闭NPC列表"
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="px-4 py-3 border-b border-amber-900/40 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={npcQuery}
                      onChange={(e) => setNpcQuery(e.target.value)}
                      placeholder="搜索NPC..."
                      className="w-full bg-zinc-900/70 border border-zinc-700/60 rounded px-9 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/70"
                    />
                  </div>
                  <select
                    value={npcStatusFilter}
                    onChange={(e) => setNpcStatusFilter(e.target.value as 'ALL' | '在场' | '离场' | '死亡' | '失踪')}
                    className="bg-zinc-900/70 border border-zinc-700/60 rounded px-3 py-2 text-[13px] text-zinc-100 focus:outline-none focus:border-amber-400/70"
                  >
                    <option value="ALL">全部状态</option>
                    <option value="在场">在场</option>
                    <option value="离场">离场</option>
                    <option value="失踪">失踪</option>
                    <option value="死亡">死亡</option>
                  </select>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-3">
                  {filteredNpcRows.map((npc) => (
                    <button
                      type="button"
                      key={npc.id}
                      onClick={npc.linkedUnitId ? () => {
                        setSelectedEnemyId(npc.linkedUnitId || null);
                        setShowNpcDrawer(false);
                      } : undefined}
                      className={`rounded-lg border px-3 py-3 ${npc.combatLinked
                        ? 'border-amber-300/60 bg-amber-900/20 hover:border-amber-200/80 transition-colors'
                        : 'border-amber-900/45 bg-black/25'} ${npc.linkedUnitId ? 'cursor-pointer text-left w-full' : 'text-left w-full cursor-default'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xl font-display font-bold text-amber-100 truncate">
                            {npc.name}
                            {npc.levelText && <span className="text-base text-amber-300 ml-2">{npc.levelText}</span>}
                          </div>
                          <div className="text-[12px] text-zinc-300 mt-1 truncate">
                            {[npc.identity, npc.location].filter(Boolean).join(' | ')}
                          </div>
                        </div>
                        <div className={`text-[12px] shrink-0 ${npc.status === '在场' ? 'text-emerald-300' : npc.status === '死亡' ? 'text-rose-300' : 'text-zinc-300'}`}>
                          {npc.status}
                        </div>
                      </div>
                      <div className="mt-2 text-[12px] text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
                        {npc.relation && <span>{npc.relation}</span>}
                        {npc.hpText && <span>{npc.hpText}</span>}
                        {npc.acText && <span>{npc.acText}</span>}
                        {npc.combatLinked && <span className="text-amber-300">{npc.linkedUnitId ? '战斗中 · 点击定位' : '战斗中'}</span>}
                      </div>
                    </button>
                  ))}

                  {filteredNpcRows.length === 0 && (
                    <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-700/50 rounded-lg">
                      未找到符合条件的 NPC
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>





      <details className="shrink-0 border-t border-amber-900/40 bg-black/35">
        <summary className="list-none cursor-pointer px-4 py-2 text-xs uppercase tracking-[0.18em] text-amber-200/80 hover:text-amber-100 select-none">
          展开详细动作面板
        </summary>
        <div className="border-t border-amber-900/30">
          <ActionDock
            playerStats={playerStats}
            skills={skills}
            magic={magic}
            inventory={inventory}
            onAction={handleAction}
          />
        </div>
      </details>

      <details className="shrink-0 border-t border-amber-900/40 bg-black/25">
        <summary className="list-none cursor-pointer px-4 py-2 text-xs uppercase tracking-[0.18em] text-zinc-300 hover:text-zinc-100 select-none">
          展开遭遇与日志
        </summary>
        <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-3 border-t border-amber-900/20">
          <EncounterPanel encounters={encounters} />
          <LogsPanel summaries={logSummaries} outlines={logOutlines} />
          {logs.length > 0 && (
            <div className={`${panelShell} p-3 xl:col-span-2`}>
              <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200/80 mb-2">战斗快讯</div>
              <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                {[...logs].slice(-8).reverse().map((line, idx) => (
                  <div key={`${line}-${idx}`} className={`text-[11px] px-2 py-1 rounded border ${idx === 0 ? 'border-cyan-500/50 bg-cyan-950/30 text-cyan-50' : 'border-amber-900/40 bg-black/30 text-zinc-300'}`}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>
    </CombatContainer>
  );
};

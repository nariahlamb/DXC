import type { Confidant, GameState, InventoryItem } from '../../types';
import type { TavernDBProjectedTable, TavernDBSheetDefinition, TavernDBSheetId, TavernDBTableRow } from '../../types/taverndb';
import { getDomainMappingRegistry, getSheetRegistry } from './sheetRegistry';
import { collectIndexedLogPairingIssues, normalizeAmIndex } from '../memory/amIndex';
import { buildFactBoundary } from '../memory/factBoundary';
import { isPlayerReference } from '../userPlaceholder';
import { normalizeQualityLabel } from '../itemUtils';
import { buildEquippedKeySet, isInventoryItemEquipped } from '../equipmentLinking';
import { DEFAULT_STATE_VARIABLE_REPLAY_GATE_THRESHOLDS } from './stateVariableDiff';

export interface TavernProjectionOptions {
  includeEmptySheets?: boolean;
  summaryLimit?: number;
  outlineLimit?: number;
}

const DEFAULT_OPTIONS: Required<TavernProjectionOptions> = {
  includeEmptySheets: true,
  summaryLimit: 120,
  outlineLimit: 120
};

const STATE_SOURCED_PROJECTION_SHEETS = new Set<TavernDBSheetId>([
  'ITEM_Inventory',
  'SKILL_Library',
  'CHARACTER_Skills'
]);

const PROJECTION_CACHE_LIMIT = 12;
const projectionCache = new Map<string, TavernDBProjectedTable[]>();

const cloneProjectedTables = (tables: TavernDBProjectedTable[]): TavernDBProjectedTable[] => (
  tables.map((table) => ({
    ...table,
    columns: [...table.columns],
    rows: table.rows.map((row) => ({ ...row }))
  }))
);

const buildProjectionCacheKey = (state: GameState, options: Required<TavernProjectionOptions>): string => {
  const runtimeMeta = (state as any)?.__tableMeta || {};
  const sheetVersions = runtimeMeta?.sheetVersions && typeof runtimeMeta.sheetVersions === 'object'
    ? Object.entries(runtimeMeta.sheetVersions as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sheetId, version]) => `${sheetId}:${Number(version || 0)}`)
      .join('|')
    : '';
  const rowLocks = Array.isArray(runtimeMeta?.rowLocks) ? runtimeMeta.rowLocks.length : 0;
  const cellLocks = Array.isArray(runtimeMeta?.cellLocks) ? runtimeMeta.cellLocks.length : 0;
  const shadowRows = (state as any)?.__tableRows;
  const shadowSignature = shadowRows && typeof shadowRows === 'object' && !Array.isArray(shadowRows)
    ? Object.keys(shadowRows)
      .sort((a, b) => a.localeCompare(b))
      .map((sheetId) => `${sheetId}:${Array.isArray(shadowRows[sheetId]) ? shadowRows[sheetId].length : 0}`)
      .join('|')
    : '';
  const stateVarReplayDiagnostics = (
    (state as any)?.__stateVarDiagnostics?.replay
    && typeof (state as any).__stateVarDiagnostics.replay === 'object'
  )
    ? (state as any).__stateVarDiagnostics.replay
    : {};
  const fallbackSignature = [
    `inv:${Array.isArray(state.背包) ? state.背包.length : 0}`,
    `npc:${Array.isArray(state.社交) ? state.社交.length : 0}`,
    `quest:${Array.isArray(state.任务) ? state.任务.length : 0}`,
    `sum:${Array.isArray(state.日志摘要) ? state.日志摘要.length : 0}`,
    `out:${Array.isArray(state.日志大纲) ? state.日志大纲.length : 0}`,
    `econ:${Array.isArray(state.经济流水) ? state.经济流水.length : 0}`,
    `surface:${Array.isArray((state as any).地图?.surfaceLocations) ? (state as any).地图.surfaceLocations.length : 0}`,
    `macro:${Array.isArray((state as any).地图?.macroLocations) ? (state as any).地图.macroLocations.length : 0}`,
    `mid:${Array.isArray((state as any).地图?.midLocations) ? (state as any).地图.midLocations.length : 0}`,
    `phoneThread:${Array.isArray((state as any).手机?.对话?.私聊) ? (state as any).手机.对话.私聊.length : 0}:${Array.isArray((state as any).手机?.对话?.群聊) ? (state as any).手机.对话.群聊.length : 0}:${Array.isArray((state as any).手机?.对话?.公共频道) ? (state as any).手机.对话.公共频道.length : 0}`,
    `svDiagInv:${Math.max(0, Math.floor(Number(stateVarReplayDiagnostics.invalidRows || 0)))}`,
    `svDiagGate:${String(stateVarReplayDiagnostics?.gate?.status || '')}`
  ].join('|');
  return [
    `e:${options.includeEmptySheets ? 1 : 0}`,
    `s:${options.summaryLimit}`,
    `o:${options.outlineLimit}`,
    `turn:${Number(state.回合数 || 0)}`,
    `time:${String(state.游戏时间 || '')}`,
    `loc:${String(state.当前地点 || '')}`,
    `sv:${sheetVersions}`,
    `lk:${rowLocks}/${cellLocks}`,
    `sr:${shadowSignature}`,
    `fb:${fallbackSignature}`
  ].join(';');
};

const setProjectionCache = (key: string, tables: TavernDBProjectedTable[]) => {
  projectionCache.set(key, cloneProjectedTables(tables));
  while (projectionCache.size > PROJECTION_CACHE_LIMIT) {
    const oldestKey = projectionCache.keys().next().value;
    if (!oldestKey) break;
    projectionCache.delete(oldestKey);
  }
};

export const clearTavernProjectionCache = () => {
  projectionCache.clear();
};

const toSheetValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const simpleArray = value.every((item) => ['string', 'number', 'boolean'].includes(typeof item));
    return simpleArray ? value.join(', ') : JSON.stringify(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const padId = (prefix: string, index: number) => `${prefix}_${String(index + 1).padStart(3, '0')}`;

const statusByPresence = (npc: Confidant): string => {
  if ((npc as any).当前状态) return String((npc as any).当前状态);
  return npc.是否在场 ? '在场' : '离场';
};

const summarizeNpcMemory = (npc: Confidant): string => {
  const memories = Array.isArray(npc.记忆) ? npc.记忆 : [];
  if (memories.length === 0) return '';
  const last = memories[memories.length - 1];
  return `${last.时间戳 || ''} ${last.内容 || ''}`.trim();
};

const buildNpcRows = (state: GameState): TavernDBTableRow[] => {
  const npcs = Array.isArray(state.社交) ? state.社交 : [];
  const playerName = state.角色?.姓名;
  return npcs
    .filter((npc) => !isPlayerReference(npc?.id, playerName) && !isPlayerReference(npc?.姓名, playerName))
    .map((npc, index) => ({
    NPC_ID: npc.id || padId('NPC', index),
    姓名: npc.姓名,
    '种族/性别/年龄': [npc.种族, npc.性别, npc.年龄].filter((part) => part !== undefined && part !== '').join('/'),
    '职业/身份': (npc as any).职业身份 || npc.身份 || '',
    外貌描述: npc.外貌 || npc.简介 || '',
    等级: npc.等级 ?? '',
    HP: npc.生存数值 ? `${npc.生存数值.当前生命}/${npc.生存数值.最大生命}` : '',
    AC: (npc as any).AC ?? (npc as any).护甲等级 ?? '',
    主要技能: npc.已知能力 || '',
    随身物品: Array.isArray(npc.背包) ? npc.背包.map((item) => item.名称).filter(Boolean).join(', ') : '',
    当前状态: statusByPresence(npc),
    所在位置: (npc as any).所在位置 || npc.位置详情 || state.当前地点 || '',
    与主角关系: (npc as any).与主角关系 || npc.关系状态 || '',
    关键经历: (npc as any).关键经历 || summarizeNpcMemory(npc)
  }));
};

const buildInventoryRows = (state: GameState): TavernDBTableRow[] => {
  const list = Array.isArray(state.背包) ? state.背包 : [];
  const equippedKeys = buildEquippedKeySet(state?.角色?.装备 as Record<string, unknown> | undefined);
  return list.map((item, index) => ({
    物品ID: item.id || padId('ITEM', index),
    物品名称: item.名称,
    类别: item.类型 || '',
    数量: item.数量 ?? 1,
    已装备: isInventoryItemEquipped(item as InventoryItem, equippedKeys) ? '是' : '否',
    所属人: (item as any).所属人 || state.角色?.姓名 || '',
    伤害: (item as any).伤害 || item.武器?.伤害类型 || '',
    特性: (item as any).特性 || item.效果 || item.武器?.特性 || '',
    稀有度: normalizeQualityLabel(String(item.稀有度 || item.品质 || '')),
    描述: item.描述 || '',
    重量: item.重量 ?? '',
    价值: item.价值 ?? ''
  }));
};

const taskStatusMap: Record<string, string> = {
  active: '进行中',
  completed: '已完成',
  failed: '已失败'
};

const buildQuestRows = (state: GameState): TavernDBTableRow[] => {
  const tasks = Array.isArray(state.任务) ? state.任务 : [];
  return tasks.map((task, index) => ({
    任务ID: task.id || padId('QUEST', index),
    任务名称: task.标题,
    类型: (task as any).类型 || '支线',
    发布者: (task as any).发布者 || '',
    目标描述: task.描述 || '',
    当前进度: task.日志 && task.日志.length > 0 ? task.日志[task.日志.length - 1].内容 : '',
    状态: taskStatusMap[task.状态] || task.状态 || '',
    时限: task.截止时间 || '无限制',
    奖励: task.奖励 || ''
  }));
};

const factionRelationScore = (relation?: string): number | '' => {
  if (!relation) return '';
  if (relation.includes('敌')) return -2;
  if (relation.includes('不友善')) return -1;
  if (relation.includes('友善')) return 1;
  if (relation.includes('盟')) return 2;
  return 0;
};

const buildFactionRows = (state: GameState): TavernDBTableRow[] => {
  const factions = Array.isArray(state.势力) ? state.势力 : [];
  if (factions.length > 0) {
    return factions.map((faction, index) => ({
      势力ID: faction.id || padId('FACTION', index),
      势力名称: faction.名称,
      关系等级: factionRelationScore(faction.关系),
      声望值: faction.声望 ?? '',
      主角头衔: (faction as any).主角头衔 || '',
      关键事件: faction.描述 || '',
      '特权/通缉': (faction as any).特权通缉 || ''
    }));
  }

  if (state.眷族) {
    return [{
      势力ID: 'FACTION_MAIN',
      势力名称: state.眷族.名称 || '眷族',
      关系等级: 2,
      声望值: state.眷族.声望 ?? '',
      主角头衔: '成员',
      关键事件: '',
      '特权/通缉': ''
    }];
  }

  return [];
};

const buildCombatEncounterRows = (state: GameState): TavernDBTableRow[] => {
  const combat = state.战斗;
  if (!combat) return [];

  const fromBattleMap = Array.isArray(combat.地图) ? combat.地图 : [];
  if (fromBattleMap.length > 0) {
    return fromBattleMap.map((unit) => ({
      单位名称: unit.名称,
      阵营: unit.类型 === '敌人' ? '敌方' : unit.类型 === '玩家' || unit.类型 === '友方' ? '友方' : '中立',
      '先攻/位置': `${unit.位置?.x ?? '?'}:${unit.位置?.y ?? '?'}`,
      HP状态: unit.生命值 ? `${unit.生命值.当前}/${unit.生命值.最大}` : '',
      '防御/抗性': '',
      附着状态: Array.isArray(unit.状态效果) ? unit.状态效果.join('; ') : '',
      是否为当前行动者: combat.current_actor && (combat.current_actor === unit.UNIT_ID || combat.current_actor === unit.名称) ? '是' : '否',
      回合资源: ''
    }));
  }

  const rows: TavernDBTableRow[] = [];
  rows.push({
    单位名称: state.角色?.姓名 || '主角',
    阵营: '友方',
    '先攻/位置': '',
    HP状态: `${state.角色?.生命值 ?? 0}/${state.角色?.最大生命值 ?? 0}`,
    '防御/抗性': state.角色?.dndProfile?.护甲等级 ?? '',
    附着状态: Array.isArray(state.角色?.状态) ? state.角色!.状态.map((item: any) => typeof item === 'string' ? item : item.名称).join('; ') : '',
    是否为当前行动者: combat.current_actor === 'PC_MAIN' ? '是' : '否',
    回合资源: ''
  });

  const enemies = Array.isArray(combat.敌方) ? combat.敌方 : [];
  enemies.forEach((enemy) => {
    rows.push({
      单位名称: enemy.名称,
      阵营: '敌方',
      '先攻/位置': '',
      HP状态: `${enemy.当前生命值 ?? enemy.生命值 ?? ''}/${enemy.最大生命值 ?? ''}`,
      '防御/抗性': '',
      附着状态: '',
      是否为当前行动者: combat.current_actor === enemy.id || combat.current_actor === enemy.名称 ? '是' : '否',
      回合资源: ''
    });
  });

  return rows;
};

const buildCombatMapRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray(state.战斗?.地图) ? state.战斗!.地图 : [];
  const mapWidth = Number((state as any).战斗?.视觉?.地图尺寸?.宽度) || 20;
  const mapHeight = Number((state as any).战斗?.视觉?.地图尺寸?.高度) || 20;

  const toLegacyType = (value: unknown): string => {
    const text = String(value || '').trim();
    if (!text) return 'Token';
    const lower = text.toLowerCase();
    if (lower === 'config' || lower === 'map_config' || text === '地图配置' || text === '配置') return 'Config';
    if (lower === 'token') return 'Token';
    if (lower === 'wall' || text === '障碍物') return 'Wall';
    if (lower === 'terrain' || text === '地形') return 'Terrain';
    if (lower === 'zone' || text.includes('区域') || text.includes('光环')) return 'Zone';
    if (text === '玩家' || text === '敌人' || text === '友方' || text === '其他' || text === '中立') return 'Token';
    return text;
  };

  const toCoord = (position: unknown): string => {
    if (!position || typeof position !== 'object') {
      return JSON.stringify({ x: 1, y: 1 });
    }
    const source = position as Record<string, unknown>;
    const x = Number(source.x ?? source.X ?? source.col ?? source.column ?? source.列);
    const y = Number(source.y ?? source.Y ?? source.row ?? source.行);
    const normalizedX = Number.isFinite(x) ? Math.max(1, Math.round(x <= 0 ? x + 1 : x)) : 1;
    const normalizedY = Number.isFinite(y) ? Math.max(1, Math.round(y <= 0 ? y + 1 : y)) : 1;
    return JSON.stringify({
      x: normalizedX,
      y: normalizedY
    });
  };

  const toSize = (size: unknown): string => {
    if (!size || typeof size !== 'object') {
      return JSON.stringify({ w: 1, h: 1 });
    }
    const source = size as Record<string, unknown>;
    const w = Number(source.w ?? source.W ?? source.width ?? source.宽度 ?? source.x);
    const h = Number(source.h ?? source.H ?? source.height ?? source.高度 ?? source.y);
    return JSON.stringify({
      w: Number.isFinite(w) && w > 0 ? Math.round(w) : 1,
      h: Number.isFinite(h) && h > 0 ? Math.round(h) : 1
    });
  };

  const projectedRows = rows.map((row) => ({
    单位名称: row.名称 || row.UNIT_ID || '',
    类型: toLegacyType(row.类型),
    坐标: toCoord((row as any).位置),
    大小: toSize((row as any).尺寸),
    Token: row.图标 || ''
  }));

  if (projectedRows.length === 0 && !(state as any).战斗?.视觉) {
    return projectedRows;
  }

  return [
    {
      单位名称: 'Map_Config',
      类型: 'Config',
      坐标: JSON.stringify({ w: Math.max(1, Math.round(mapWidth)), h: Math.max(1, Math.round(mapHeight)) }),
      大小: '',
      Token: ''
    },
    ...projectedRows
  ];
};

const buildSummaryRows = (state: GameState, limit: number): TavernDBTableRow[] => {
  const summaries = Array.isArray(state.日志摘要) ? state.日志摘要.slice(-limit) : [];
  return summaries.map((row) => {
    const source = row as any;
    return {
      时间跨度: source.时间跨度 || source.timeSpan || source.time_span || source.时间 || source.time || '',
      地点: source.地点 || source.location || source.scene || state.当前地点 || '',
      纪要: source.纪要 || source.摘要 || source.summary || source.content || '',
      重要对话: source.重要对话 || source.dialogue || '',
      编码索引: source.编码索引 || source.am_index || source.amIndex || source.index || ''
    };
  });
};

const buildOutlineRows = (state: GameState, limit: number): TavernDBTableRow[] => {
  const outlines = Array.isArray(state.日志大纲) ? state.日志大纲.slice(-limit) : [];
  return outlines.map((row) => {
    const source = row as any;
    return {
      时间跨度: source.时间跨度
        || source.timeSpan
        || source.time_span
        || (typeof source.结束回合 === 'number'
          ? `${source.开始回合}-${source.结束回合}`
          : String(source.开始回合 ?? source.startTurn ?? '')),
      大纲: source.大纲
        || source.outline
        || [source.标题 || source.title, Array.isArray(source.事件列表) ? source.事件列表.join('；') : ''].filter(Boolean).join('：'),
      编码索引: source.编码索引 || source.am_index || source.amIndex || source.index || ''
    };
  });
};

const buildWorldNpcTrackingRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray(state.世界?.NPC后台跟踪) ? state.世界!.NPC后台跟踪 : [];
  const playerName = state.角色?.姓名;
  return rows.map((row, index) => ({
    tracking_id: `${row?.NPC || 'NPC'}_${index + 1}`,
    npc_name: row?.NPC || '',
    current_action: row?.当前行动 || '',
    location: row?.位置 || '',
    progress: row?.进度 || '',
    eta: row?.预计完成 || '',
    updated_at: ''
  })).filter((row) => !isPlayerReference(row.npc_name, playerName));
};

const buildWorldNewsRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray(state.世界?.头条新闻) ? state.世界!.头条新闻 : [];
  return rows.map((row, index) => ({
    news_id: row?.id || `NEWS_${index + 1}`,
    标题: row?.标题 || '',
    内容: row?.内容 || '',
    时间戳: row?.时间戳 || '',
    来源: row?.来源 || 'street',
    重要度: row?.重要度 || 'normal',
    关联传闻: row?.关联传闻 || ''
  }));
};

const buildWorldRumorRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray(state.世界?.街头传闻) ? state.世界!.街头传闻 : [];
  return rows.map((row, index) => ({
    rumor_id: row?.id || `RUMOR_${index + 1}`,
    主题: row?.主题 || '',
    内容: row?.内容 || '',
    传播度: typeof row?.传播度 === 'number' ? row.传播度 : 0,
    可信度: row?.可信度 || 'rumor',
    来源: row?.来源 || '',
    话题标签: Array.isArray(row?.话题标签) ? row.话题标签.join(', ') : '',
    发现时间: row?.发现时间 || '',
    评论数: typeof row?.评论数 === 'number' ? row.评论数 : '',
    已升级为新闻: row?.已升级为新闻 ? '是' : '否',
    关联新闻: row?.关联新闻 || ''
  }));
};

const buildWorldDenatusRows = (state: GameState): TavernDBTableRow[] => {
  const denatus = state.世界?.诸神神会;
  if (!denatus) return [];
  return [{
    denatus_id: 'DENATUS_MAIN',
    下次神会开启时间: denatus.下次神会开启时间 || '',
    神会主题: denatus.神会主题 || '',
    讨论内容: Array.isArray(denatus.讨论内容)
      ? denatus.讨论内容.map((item) => `${item?.角色 || '未知'}:${item?.对话 || ''}`).join(' | ')
      : '',
    最终结果: denatus.最终结果 || ''
  }];
};

const buildWorldWarGameRows = (state: GameState): TavernDBTableRow[] => {
  const warGame = state.世界?.战争游戏;
  if (!warGame) return [];
  return [{
    war_game_id: 'WARGAME_MAIN',
    状态: warGame.状态 || '',
    参战眷族: Array.isArray(warGame.参战眷族) ? warGame.参战眷族.join(', ') : '',
    形式: warGame.形式 || '',
    赌注: warGame.赌注 || '',
    举办时间: warGame.举办时间 || '',
    结束时间: warGame.结束时间 || '',
    结果: warGame.结果 || '',
    备注: warGame.备注 || ''
  }];
};

const buildStoryMainlineRows = (state: GameState): TavernDBTableRow[] => {
  const story = state.剧情 as any;
  if (!story || typeof story !== 'object') return [];
  return [{
    mainline_id: 'MAINLINE_PRIMARY',
    当前卷数: typeof story?.主线?.当前卷数 === 'number' ? story.主线.当前卷数 : 1,
    当前篇章: story?.主线?.当前篇章 || '',
    当前阶段: story?.主线?.当前阶段 || '',
    关键节点: story?.主线?.关键节点 || '',
    节点状态: story?.主线?.节点状态 || '',
    当前目标: story?.引导?.当前目标 || '',
    下一触发: story?.引导?.下一触发 || '',
    行动提示: story?.引导?.行动提示 || '',
    预定日期: story?.时间轴?.预定日期 || '',
    下一关键时间: story?.时间轴?.下一关键时间 || '',
    是否正史: Boolean(story?.路线?.是否正史),
    偏移度: typeof story?.路线?.偏移度 === 'number' ? story.路线.偏移度 : 0,
    分歧说明: story?.路线?.分歧说明 || '',
    备注: story?.备注 || ''
  }];
};

const buildStoryTriggerRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray((state.剧情 as any)?.待触发) ? (state.剧情 as any).待触发 : [];
  return rows.map((row: any, index: number) => ({
    trigger_id: row?.id || `TRIGGER_${index + 1}`,
    预计触发: row?.预计触发 || '',
    内容: row?.内容 || '',
    类型: row?.类型 || '',
    触发条件: row?.触发条件 || '',
    重要度: row?.重要度 || '',
    状态: row?.状态 || '待触发'
  }));
};

const buildStoryMilestoneRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray((state.剧情 as any)?.里程碑) ? (state.剧情 as any).里程碑 : [];
  return rows.map((row: any, index: number) => ({
    milestone_id: row?.id || `MILESTONE_${index + 1}`,
    时间: row?.时间 || '',
    事件: row?.事件 || '',
    影响: row?.影响 || ''
  }));
};

const buildContractRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray(state.契约) ? state.契约 : [];
  return rows.map((row: any, index: number) => ({
    contract_id: row?.id || `CONTRACT_${index + 1}`,
    名称: row?.名称 || '',
    描述: row?.描述 || '',
    状态: row?.状态 || '',
    条款: row?.条款 || ''
  }));
};

const buildMapSurfaceLocationRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray(state.地图?.surfaceLocations) ? state.地图!.surfaceLocations : [];
  return rows.map((row: any, index) => ({
    location_id: row?.id || `surface_${index + 1}`,
    name: row?.name || '',
    type: row?.type || '',
    x: typeof row?.coordinates?.x === 'number' ? row.coordinates.x : '',
    y: typeof row?.coordinates?.y === 'number' ? row.coordinates.y : '',
    radius: typeof row?.radius === 'number' ? row.radius : '',
    floor: typeof row?.floor === 'number' ? row.floor : '',
    description: row?.description || '',
    icon: row?.icon || '',
    source: row?.source || '',
    visited: row?.visited ? 'yes' : 'no'
  }));
};

const buildMapDungeonLayerRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray(state.地图?.dungeonStructure) ? state.地图!.dungeonStructure : [];
  return rows.map((row: any, index) => ({
    layer_id: `layer_${row?.floorStart ?? index + 1}_${row?.floorEnd ?? row?.floorStart ?? index + 1}`,
    floor_start: typeof row?.floorStart === 'number' ? row.floorStart : '',
    floor_end: typeof row?.floorEnd === 'number' ? row.floorEnd : '',
    name: row?.name || '',
    danger_level: row?.dangerLevel || '',
    description: row?.description || '',
    landmarks: Array.isArray(row?.landmarks) ? row.landmarks : []
  }));
};

const buildMapMacroLocationRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray(state.地图?.macroLocations) ? state.地图!.macroLocations : [];
  return rows.map((row: any, index) => ({
    macro_id: row?.id || `macro_${index + 1}`,
    name: row?.name || '',
    parent_id: row?.parentId || '',
    x: typeof row?.coordinates?.x === 'number' ? row.coordinates.x : '',
    y: typeof row?.coordinates?.y === 'number' ? row.coordinates.y : '',
    floor: typeof row?.floor === 'number' ? row.floor : '',
    description: row?.description || '',
    tags: Array.isArray(row?.tags) ? row.tags.join(', ') : ''
  }));
};

const buildMapMidLocationRows = (state: GameState): TavernDBTableRow[] => {
  const rows = Array.isArray(state.地图?.midLocations) ? state.地图!.midLocations : [];
  return rows.map((row: any, index) => ({
    mid_id: row?.id || `mid_${index + 1}`,
    name: row?.name || '',
    parent_id: row?.parentId || '',
    x: typeof row?.coordinates?.x === 'number' ? row.coordinates.x : '',
    y: typeof row?.coordinates?.y === 'number' ? row.coordinates.y : '',
    floor: typeof row?.floor === 'number' ? row.floor : '',
    description: row?.description || '',
    map_structure: row?.mapStructure || '',
    layout: row?.layout || ''
  }));
};

const buildNpcRelationshipEventRows = (state: GameState): TavernDBTableRow[] => {
  const npcs = Array.isArray(state.社交) ? state.社交 : [];
  const rows: TavernDBTableRow[] = [];
  npcs.forEach((npc: any, npcIndex) => {
    const npcId = npc?.id || padId('NPC', npcIndex);
    const events = Array.isArray(npc?.关系事件) ? npc.关系事件 : [];
    if (events.length > 0) {
      events.forEach((event: any, eventIndex: number) => {
        rows.push({
          event_id: event?.event_id || `${npcId}_rel_${eventIndex + 1}`,
          npc_id: npcId,
          npc_name: npc?.姓名 || '',
          timestamp: event?.timestamp || event?.时间戳 || '',
          event: event?.event || event?.内容 || '',
          affinity_delta: typeof event?.affinity_delta === 'number' ? event.affinity_delta : '',
          relationship_state: event?.relationship_state || event?.关系状态 || npc?.关系状态 || '',
          notes: event?.notes || ''
        });
      });
      return;
    }
    const memories = Array.isArray(npc?.记忆) ? npc.记忆.slice(-6) : [];
    memories.forEach((memory: any, memoryIndex: number) => {
      rows.push({
        event_id: `${npcId}_mem_${memoryIndex + 1}`,
        npc_id: npcId,
        npc_name: npc?.姓名 || '',
        timestamp: memory?.时间戳 || '',
        event: memory?.内容 || '',
        affinity_delta: '',
        relationship_state: npc?.关系状态 || '',
        notes: ''
      });
    });
  });
  return rows;
};

const buildNpcLocationTraceRows = (state: GameState): TavernDBTableRow[] => {
  const npcs = Array.isArray(state.社交) ? state.社交 : [];
  const playerName = state.角色?.姓名;
  return npcs.map((npc: any, index) => ({
    trace_id: `${npc?.id || padId('NPC', index)}_trace`,
    npc_id: npc?.id || padId('NPC', index),
    npc_name: npc?.姓名 || '',
    timestamp: state.游戏时间 || '',
    location: npc?.所在位置 || npc?.位置详情 || '',
    x: typeof npc?.坐标?.x === 'number' ? npc.坐标.x : '',
    y: typeof npc?.坐标?.y === 'number' ? npc.坐标.y : '',
    present: npc?.是否在场 ? 'yes' : 'no',
    detail: npc?.位置详情 || ''
  })).filter((row) => !isPlayerReference(row.npc_id, playerName) && !isPlayerReference(row.npc_name, playerName));
};

const buildNpcInteractionLogRows = (state: GameState): TavernDBTableRow[] => {
  const npcs = Array.isArray(state.社交) ? state.社交 : [];
  const playerName = state.角色?.姓名;
  const rows: TavernDBTableRow[] = [];
  npcs.forEach((npc: any, npcIndex) => {
    if (isPlayerReference(npc?.id, playerName) || isPlayerReference(npc?.姓名, playerName)) return;
    const npcId = npc?.id || padId('NPC', npcIndex);
    const interactions = Array.isArray(npc?.互动记录) ? npc.互动记录 : [];
    if (interactions.length > 0) {
      interactions.forEach((entry: any, entryIndex: number) => {
        rows.push({
          interaction_id: entry?.interaction_id || `${npcId}_int_${entryIndex + 1}`,
          npc_id: npcId,
          npc_name: npc?.姓名 || '',
          timestamp: entry?.timestamp || entry?.时间戳 || '',
          type: entry?.type || entry?.类型 || '',
          summary: entry?.summary || entry?.内容 || '',
          source: entry?.source || ''
        });
      });
      return;
    }
    const memories = Array.isArray(npc?.记忆) ? npc.记忆 : [];
    memories.forEach((memory: any, memoryIndex: number) => {
      rows.push({
        interaction_id: `${npcId}_mem_${memoryIndex + 1}`,
        npc_id: npcId,
        npc_name: npc?.姓名 || '',
        timestamp: memory?.时间戳 || '',
        type: 'memory',
        summary: memory?.内容 || '',
        source: 'npc_memory'
      });
    });
  });
  return rows;
};

const buildQuestObjectiveRows = (state: GameState): TavernDBTableRow[] => {
  const baseTasks = Array.isArray(state.任务) ? state.任务 : [];
  const enhancedTasks = Array.isArray((state as any).增强任务) ? (state as any).增强任务 : [];
  const objectiveRows: TavernDBTableRow[] = [];

  baseTasks.forEach((task: any, taskIndex) => {
    const questId = task?.id || `QUEST_${taskIndex + 1}`;
    const enhanced = enhancedTasks.find((item: any) => String(item?.id || '') === questId);
    const objectives = Array.isArray(enhanced?.目标) ? enhanced.目标 : [];
    if (objectives.length > 0) {
      objectives.forEach((objective: any, objectiveIndex: number) => {
        objectiveRows.push({
          objective_id: `${questId}_obj_${objectiveIndex + 1}`,
          quest_id: questId,
          objective: objective?.描述 || '',
          status: objective?.完成 ? 'completed' : 'active',
          progress: objective?.完成 ? '100%' : '',
          target: '',
          updated_at: task?.结束时间 || task?.接取时间 || ''
        });
      });
      return;
    }
    objectiveRows.push({
      objective_id: `${questId}_obj_1`,
      quest_id: questId,
      objective: task?.描述 || task?.标题 || '',
      status: task?.状态 || 'active',
      progress: '',
      target: '',
      updated_at: task?.结束时间 || task?.接取时间 || ''
    });
  });

  return objectiveRows;
};

const buildQuestProgressLogRows = (state: GameState): TavernDBTableRow[] => {
  const tasks = Array.isArray(state.任务) ? state.任务 : [];
  const rows: TavernDBTableRow[] = [];
  tasks.forEach((task: any, taskIndex) => {
    const questId = task?.id || `QUEST_${taskIndex + 1}`;
    const logs = Array.isArray(task?.日志) ? task.日志 : [];
    logs.forEach((entry: any, logIndex: number) => {
      rows.push({
        progress_id: `${questId}_log_${logIndex + 1}`,
        quest_id: questId,
        timestamp: entry?.时间戳 || '',
        content: entry?.内容 || '',
        status: task?.状态 || 'active',
        delta: '',
        source: 'task_log'
      });
    });
  });
  return rows;
};

const stringifyActionOption = (option: any): string => {
  if (!option) return '';
  if (typeof option === 'string') return option;
  return option.描述 ? `${option.名称}: ${option.描述}` : option.名称 || '';
};

const buildActionOptionRows = (state: GameState): TavernDBTableRow[] => {
  const options = Array.isArray(state.可选行动列表) ? state.可选行动列表 : [];
  if (options.length === 0) return [];
  return [{
    选项A: stringifyActionOption(options[0]),
    选项B: stringifyActionOption(options[1]),
    选项C: stringifyActionOption(options[2]),
    选项D: stringifyActionOption(options[3])
  }];
};

const buildDiceRows = (state: GameState): TavernDBTableRow[] => {
  const dice = Array.isArray(state.骰池) ? state.骰池 : [];
  return dice.map((row, index) => {
    const type = String(row.类型 || '').toUpperCase();
    return {
      ID: index + 1,
      D4: type === 'D4' ? row.数值 : null,
      D6: type === 'D6' ? row.数值 : null,
      D8: type === 'D8' ? row.数值 : null,
      D10: type === 'D10' ? row.数值 : null,
      D12: type === 'D12' ? row.数值 : null,
      D20: type === 'D20' ? row.数值 : null,
      D100: type === 'D100' ? row.数值 : null
    };
  });
};

const buildSkillLibraryRows = (state: GameState): TavernDBTableRow[] => {
  const skills = Array.isArray(state.角色?.技能) ? state.角色!.技能 : [];
  const spells = Array.isArray(state.角色?.魔法) ? state.角色!.魔法 : [];
  const rows: TavernDBTableRow[] = [];

  skills.forEach((skill, index) => {
    rows.push({
      SKILL_ID: skill.id || padId('SKL', index),
      技能名称: skill.名称,
      技能类型: skill.类别 || '主动',
      环阶: skill.等级 || '',
      学派: '',
      施法时间: skill.触发 || '',
      射程: skill.范围 || '',
      成分: '',
      持续时间: skill.持续 || '',
      效果描述: skill.效果 || skill.描述 || '',
      升阶效果: ''
    });
  });

  spells.forEach((spell, index) => {
    rows.push({
      SKILL_ID: spell.id || `MAG_${String(index + 1).padStart(3, '0')}`,
      技能名称: spell.名称,
      技能类型: '法术',
      环阶: (spell as any).环阶 || '',
      学派: spell.属性 || '',
      施法时间: spell.咏唱 || '',
      射程: spell.射程 || spell.范围 || '',
      成分: '',
      持续时间: (spell as any).持续 || '',
      效果描述: spell.效果 || spell.描述 || '',
      升阶效果: ''
    });
  });

  return rows;
};

const buildCharacterSkillRows = (state: GameState): TavernDBTableRow[] => {
  const skills = Array.isArray(state.角色?.技能) ? state.角色!.技能 : [];
  const spells = Array.isArray(state.角色?.魔法) ? state.角色!.魔法 : [];
  const rows: TavernDBTableRow[] = [];

  skills.forEach((skill, index) => {
    rows.push({
      LINK_ID: `SLINK_${String(index + 1).padStart(3, '0')}`,
      CHAR_ID: 'PC_MAIN',
      SKILL_ID: skill.id || padId('SKL', index),
      获取方式: '职业',
      已准备: '是',
      熟练度: '熟练',
      备注: ''
    });
  });

  spells.forEach((spell, index) => {
    rows.push({
      LINK_ID: `SLINK_M_${String(index + 1).padStart(3, '0')}`,
      CHAR_ID: 'PC_MAIN',
      SKILL_ID: spell.id || `MAG_${String(index + 1).padStart(3, '0')}`,
      获取方式: '法术',
      已准备: '是',
      熟练度: '熟练',
      备注: ''
    });
  });

  return rows;
};

const buildFeatLibraryRows = (state: GameState): TavernDBTableRow[] => {
  const feats = Array.isArray(state.角色?.发展能力) ? state.角色!.发展能力 : [];
  return feats.map((feat, index) => ({
    FEAT_ID: `FEAT_${String(index + 1).padStart(3, '0')}`,
    专长名称: feat.名称,
    类别: feat.类型 || '通用',
    前置条件: feat.解锁条件 || '',
    效果描述: feat.效果 || feat.描述 || '',
    属性提升: '',
    附带能力ID: ''
  }));
};

const buildCharacterFeatRows = (state: GameState): TavernDBTableRow[] => {
  const feats = Array.isArray(state.角色?.发展能力) ? state.角色!.发展能力 : [];
  return feats.map((feat, index) => ({
    LINK_ID: `FLINK_${String(index + 1).padStart(3, '0')}`,
    CHAR_ID: 'PC_MAIN',
    FEAT_ID: `FEAT_${String(index + 1).padStart(3, '0')}`,
    获取来源: '等级',
    获取等级: state.角色?.等级 || '',
    已选择项: '',
    备注: feat.备注 || ''
  }));
};

const buildCharacterRegistryRows = (state: GameState): TavernDBTableRow[] => {
  return [{
    CHAR_ID: 'PC_MAIN',
    成员类型: '主角',
    姓名: state.角色?.姓名 || '主角',
    '种族/性别/年龄': [state.角色?.种族, state.角色?.性别, state.角色?.年龄].filter((part) => part !== undefined && part !== '').join('/'),
    职业: state.角色?.称号 || '',
    外貌描述: state.角色?.外貌 || '',
    性格特点: '',
    背景故事: state.角色?.背景 || '',
    加入时间: state.当前日期 || ''
  }];
};

const buildCharacterAttributeRows = (state: GameState): TavernDBTableRow[] => {
  const playerProfile = state.角色?.dndProfile || state.角色?.DND档案;
  return [{
    CHAR_ID: 'PC_MAIN',
    等级: state.角色?.等级 ?? '',
    HP: `${state.角色?.生命值 ?? 0}/${state.角色?.最大生命值 ?? 0}`,
    AC: playerProfile?.护甲等级 ?? '',
    先攻加值: playerProfile?.先攻加值 ?? '',
    速度: playerProfile?.速度尺 ? `${playerProfile.速度尺}尺` : '',
    属性值: playerProfile?.属性值 || state.角色?.能力值 || '',
    豁免熟练: playerProfile?.豁免熟练 || '',
    技能熟练: playerProfile?.技能熟练 || '',
    被动感知: playerProfile?.被动感知 ?? '',
    经验值: `${state.角色?.经验值 ?? 0}/${state.角色?.升级所需伟业 ?? ''}`
  }];
};

const buildCharacterResourceRows = (state: GameState): TavernDBTableRow[] => {
  const playerProfile = state.角色?.dndProfile || state.角色?.DND档案;
  return [{
    CHAR_ID: 'PC_MAIN',
    法术位: playerProfile?.法术位 || state.角色?.魔法栏位 || '',
    职业资源: '',
    生命骰: playerProfile?.生命骰 || '',
    特殊能力: Array.isArray(state.角色?.发展能力) ? state.角色!.发展能力.map((item) => item.名称).join(', ') : '',
    金币: state.角色?.法利 ?? ''
  }];
};

const getPhoneThreads = (state: GameState): Array<{ type: 'private' | 'group' | 'public'; thread: any }> => {
  const phone = state.手机;
  const dialog = phone?.对话;
  if (!dialog) return [];
  const output: Array<{ type: 'private' | 'group' | 'public'; thread: any }> = [];
  (Array.isArray(dialog.私聊) ? dialog.私聊 : []).forEach((thread) => output.push({ type: 'private', thread }));
  (Array.isArray(dialog.群聊) ? dialog.群聊 : []).forEach((thread) => output.push({ type: 'group', thread }));
  (Array.isArray(dialog.公共频道) ? dialog.公共频道 : []).forEach((thread) => output.push({ type: 'public', thread }));
  return output;
};

const buildPhoneDeviceRows = (state: GameState): TavernDBTableRow[] => {
  const device = state.手机?.设备;
  if (!device) return [];
  return [{
    device_id: 'device_main',
    status: device.状态 || 'online',
    battery: device.电量 ?? '',
    signal: device.当前信号 ?? '',
    last_seen: state.游戏时间 || ''
  }];
};

const buildPhoneContactRows = (state: GameState): TavernDBTableRow[] => {
  const contacts = state.手机?.联系人;
  if (!contacts) return [];
  const playerName = state.角色?.姓名;
  const friends = Array.isArray(contacts.好友) ? contacts.好友 : [];
  const blacklist = Array.isArray(contacts.黑名单) ? contacts.黑名单 : [];
  const recent = new Set(Array.isArray(contacts.最近) ? contacts.最近 : []);
  const rows: TavernDBTableRow[] = [];
  const pushRow = (name: string, bucket: 'friend' | 'blacklist') => {
    const text = String(name || '').trim();
    if (!text) return;
    if (isPlayerReference(text, playerName)) return;
    rows.push({
      contact_id: text,
      name: text,
      bucket,
      blacklisted: bucket === 'blacklist' ? 'yes' : 'no',
      recent: recent.has(text) ? 'yes' : 'no'
    });
  };
  friends.forEach((name) => pushRow(String(name), 'friend'));
  blacklist.forEach((name) => {
    if (!friends.includes(name)) pushRow(String(name), 'blacklist');
  });
  return rows;
};

const buildPhoneThreadRows = (state: GameState): TavernDBTableRow[] => {
  return getPhoneThreads(state).map(({ type, thread }, index) => ({
    thread_id: thread?.id || `Thr_${index + 1}`,
    type,
    title: thread?.标题 || '',
    members: Array.isArray(thread?.成员) ? thread.成员.join(', ') : '',
    unread: thread?.未读 ?? 0,
    pinned: thread?.置顶 ? 'yes' : 'no',
    summary: thread?.摘要 || '',
    summary_time: thread?.摘要时间 || ''
  }));
};

const buildPhoneMessageRows = (state: GameState): TavernDBTableRow[] => {
  const rows: TavernDBTableRow[] = [];
  getPhoneThreads(state).forEach(({ thread }) => {
    const threadId = thread?.id || '';
    const messages = Array.isArray(thread?.消息) ? thread.消息 : [];
    messages.forEach((message: any, index: number) => {
      const messageId = message?.id || `${threadId || 'thr'}_msg_${index + 1}`;
      rows.push({
        message_id: messageId,
        thread_id: threadId,
        sender: message?.发送者 || '',
        content: message?.内容 || '',
        timestamp: message?.时间戳 || '',
        msg_type: message?.类型 || 'text',
        status: message?.状态 || '',
        deliver_at: message?.送达时间 || ''
      });
    });
  });
  return rows;
};

const buildPhonePendingRows = (state: GameState): TavernDBTableRow[] => {
  const pending = Array.isArray(state.手机?.待发送) ? state.手机!.待发送 : [];
  return pending.map((item: any, index) => ({
    pending_id: item?.id || `pending_${index + 1}`,
    thread_id: item?.threadId || '',
    thread_type: item?.threadType || '',
    thread_title: item?.threadTitle || '',
    deliver_at: item?.deliverAt || '',
    status: item?.status || 'scheduled',
    payload_preview: item?.payload?.内容 || '',
    trigger: item?.trigger ? JSON.stringify(item.trigger) : ''
  }));
};

const toJoinedTagString = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
  }
  return String(value ?? '').trim();
};

const buildForumBoardRows = (state: GameState): TavernDBTableRow[] => {
  const boards = Array.isArray(state.手机?.公共帖子?.板块) ? state.手机!.公共帖子!.板块 : [];
  return boards.map((board: any, index) => ({
    board_id: board?.id || `board_${index + 1}`,
    名称: board?.名称 || `板块${index + 1}`,
    图标: board?.图标 || '',
    颜色: board?.颜色 || '',
    描述: board?.描述 || ''
  }));
};

const buildForumPostRows = (state: GameState): TavernDBTableRow[] => {
  const boardNameToId = new Map<string, string>([
    ['欧拉丽快报', 'board_news'],
    ['地下城攻略', 'board_dungeon'],
    ['眷族招募', 'board_recruit'],
    ['酒馆闲谈', 'board_tavern']
  ]);
  const boardIdSet = new Set(Array.from(boardNameToId.values()));
  const normalizeBoardName = (value: unknown): string => {
    const text = String(value ?? '').trim();
    return boardNameToId.has(text) ? text : '';
  };
  const resolveBoardId = (post: any): string => {
    const explicitId = String(post?.board_id ?? post?.boardId ?? '').trim();
    if (explicitId && boardIdSet.has(explicitId)) return explicitId;
    const name = normalizeBoardName(post?.板块 ?? post?.board_name);
    return name ? (boardNameToId.get(name) || 'board_news') : 'board_news';
  };
  const resolveBoardName = (post: any): string => {
    const name = normalizeBoardName(post?.板块 ?? post?.board_name);
    return name || '欧拉丽快报';
  };
  const posts = Array.isArray(state.手机?.公共帖子?.帖子) ? state.手机!.公共帖子!.帖子 : [];
  return posts.map((post: any, index) => ({
    post_id: post?.id || `Forum_${index + 1}`,
    board_id: resolveBoardId(post),
    board_name: resolveBoardName(post),
    标题: post?.标题 || '',
    内容: post?.内容 || '',
    发布者: post?.发布者 || '',
    时间戳: post?.时间戳 || '',
    点赞数: typeof post?.点赞数 === 'number' ? post.点赞数 : 0,
    浏览数: typeof post?.浏览数 === 'number' ? post.浏览数 : '',
    置顶: post?.置顶 ? 'yes' : 'no',
    精华: post?.精华 ? 'yes' : 'no',
    话题标签: toJoinedTagString(post?.话题标签 ?? post?.话题),
    图片描述: post?.图片描述 || ''
  }));
};

const buildForumReplyRows = (state: GameState): TavernDBTableRow[] => {
  const posts = Array.isArray(state.手机?.公共帖子?.帖子) ? state.手机!.公共帖子!.帖子 : [];
  const rows: TavernDBTableRow[] = [];
  posts.forEach((post: any, postIndex: number) => {
    const postId = post?.id || `Forum_${postIndex + 1}`;
    const replies = Array.isArray(post?.回复) ? post.回复 : [];
    replies.forEach((reply: any, replyIndex: number) => {
      rows.push({
        reply_id: reply?.id || `${postId}_reply_${replyIndex + 1}`,
        post_id: postId,
        楼层: typeof reply?.楼层 === 'number' ? reply.楼层 : replyIndex + 1,
        发布者: reply?.发布者 || '',
        内容: reply?.内容 || '',
        时间戳: reply?.时间戳 || '',
        引用楼层: typeof reply?.引用楼层 === 'number' ? reply.引用楼层 : '',
        点赞数: typeof reply?.点赞数 === 'number' ? reply.点赞数 : ''
      });
    });
  });
  return rows;
};

const buildPhoneMomentRows = (state: GameState): TavernDBTableRow[] => {
  const posts = Array.isArray(state.手机?.朋友圈?.帖子) ? state.手机!.朋友圈!.帖子 : [];
  return posts.map((post: any, index) => ({
    moment_id: post?.id || `Moment_${index + 1}`,
    发布者: post?.发布者 || '',
    内容: post?.内容 || '',
    时间戳: post?.时间戳 || '',
    可见性: post?.可见性 || 'friends',
    点赞数: typeof post?.点赞数 === 'number' ? post.点赞数 : 0,
    评论数: Array.isArray(post?.评论) ? post.评论.length : 0,
    话题标签: toJoinedTagString(post?.话题),
    图片描述: post?.图片描述 || ''
  }));
};

const buildExplorationRows = (state: GameState): TavernDBTableRow[] => {
  const midLocations = Array.isArray(state.地图?.midLocations) ? state.地图!.midLocations : [];
  const currentLocation = state.当前地点 || '';
  const target = midLocations.find((item) => item.name === currentLocation) || midLocations.find((item) => !!item.mapStructure);
  if (!target) return [];

  return [{
    LocationName: target.name,
    MapStructureJSON: target.mapStructure || target.layout || '',
    LastUpdated: state.游戏时间 || '',
    当前显示地图: currentLocation || target.name
  }];
};

const buildCombatVisualRows = (state: GameState): TavernDBTableRow[] => {
  const visuals = state.战斗?.视觉;
  if (!visuals) return [];
  const width = visuals.地图尺寸?.宽度 || 20;
  const height = visuals.地图尺寸?.高度 || 20;
  return [{
    SceneName: state.当前地点 || '战斗场景',
    VisualJSON: visuals,
    GridSize: `${width}x${height}`,
    LastUpdated: state.游戏时间 || ''
  }];
};

const buildCommandAuditRows = (state: GameState): TavernDBTableRow[] => {
  const logs = Array.isArray(state.日志) ? state.日志 : [];
  return logs
    .filter((log) => String(log?.type || '').toLowerCase() === 'system')
    .slice(-80)
    .map((log, index) => ({
      command_id: log.id || `CMD_${index + 1}`,
      turn: log.turnIndex ?? state.回合数 ?? 0,
      action: 'system_log',
      sheet: '',
      result: 'info',
      reason: String(log.text || '').slice(0, 120),
      source: log.sender || '系统',
      timestamp: log.gameTime || state.游戏时间 || ''
    }));
};

const buildTransactionAuditRows = (state: GameState): TavernDBTableRow[] => {
  const logs = Array.isArray(state.日志) ? state.日志 : [];
  return logs
    .filter((log) => String(log?.text || '').includes('事务'))
    .slice(-40)
    .map((log, index) => ({
      tx_id: log.id || `TX_${index + 1}`,
      turn: log.turnIndex ?? state.回合数 ?? 0,
      status: String(log.text || '').includes('回滚') ? 'rollback' : 'committed',
      patch_count: '',
      command_count: '',
      reason: String(log.text || '').slice(0, 120),
      timestamp: log.gameTime || state.游戏时间 || ''
    }));
};

const normalizeValidationText = (value: unknown): string => {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeSimilarityToken = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[\s，。！？；;,.、:："'“”‘’（）()【】\[\]{}<>《》\-—_`~]/g, '');
};

const calcTextOverlap = (left: string, right: string): number => {
  if (!left || !right) return 0;
  const a = new Set(Array.from(left));
  const b = new Set(Array.from(right));
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  a.forEach((ch) => {
    if (b.has(ch)) hit += 1;
  });
  return hit / Math.max(1, Math.min(a.size, b.size));
};

const normalizeBattleMapCompatType = (value: unknown): 'Config' | 'Token' | 'Wall' | 'Terrain' | 'Zone' | 'Unknown' => {
  const text = String(value || '').trim();
  const lower = text.toLowerCase();
  if (!text) return 'Token';
  if (lower === 'config' || lower === 'map_config' || text === '配置' || text === '地图配置') return 'Config';
  if (lower === 'token' || text === '玩家' || text === '敌人' || text === '友方' || text === '中立' || text === '其他') return 'Token';
  if (lower === 'wall' || text === '障碍物') return 'Wall';
  if (lower === 'terrain' || text === '地形') return 'Terrain';
  if (lower === 'zone' || text.includes('区域')) return 'Zone';
  return 'Unknown';
};

const buildBattleMapCompatMetric = (state: GameState): TavernDBTableRow => {
  const rows = Array.isArray((state as any)?.战斗?.地图) ? (state as any).战斗.地图 : [];
  const width = Number((state as any)?.战斗?.视觉?.地图尺寸?.宽度 || 0);
  const height = Number((state as any)?.战斗?.视觉?.地图尺寸?.高度 || 0);
  const hasConfig = width > 0 && height > 0;
  const inCombat = Boolean((state as any)?.战斗?.是否战斗中 || (state as any)?.战斗模式 === '战斗中');

  let tokenCount = 0;
  let invalidTypeCount = 0;
  let outOfRangeCount = 0;
  rows.forEach((row: any) => {
    const normalizedType = normalizeBattleMapCompatType(row?.类型);
    if (normalizedType === 'Token') tokenCount += 1;
    if (normalizedType === 'Unknown') invalidTypeCount += 1;
    const x = Number(row?.位置?.x);
    const y = Number(row?.位置?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) return;
    const oneBasedX = x <= 0 ? x + 1 : x;
    const oneBasedY = y <= 0 ? y + 1 : y;
    if (oneBasedX < 1 || oneBasedY < 1 || oneBasedX > width || oneBasedY > height) {
      outOfRangeCount += 1;
    }
  });

  const severity = !inCombat
    ? 'info'
    : (!hasConfig
      ? 'error'
      : (invalidTypeCount > 0 || outOfRangeCount > 0 ? 'warning' : 'info'));

  return {
    issue_id: 'METRIC_DND_BATTLEMAP',
    turn: state.回合数 ?? 0,
    severity,
    action: 'quality_metric',
    sheet: 'COMBAT_BattleMap/COMBAT_Map_Visuals',
    path: 'battlemap_compat',
    message: `BattleMap兼容 Config=${hasConfig ? 1 : 0} size=${Math.max(0, width)}x${Math.max(0, height)} token=${tokenCount} invalidType=${invalidTypeCount} outOfRange=${outOfRangeCount}`,
    timestamp: state.游戏时间 || ''
  };
};

const buildCharacterProfileMetric = (state: GameState): TavernDBTableRow => {
  const profile = (state as any)?.角色?.dndProfile || (state as any)?.角色?.DND档案 || null;
  const missing: string[] = [];

  const hp = Number((state as any)?.角色?.生命值);
  const maxHp = Number((state as any)?.角色?.最大生命值);
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp)) missing.push('HP');
  if (!profile || typeof profile !== 'object') {
    missing.push('DND档案');
  } else {
    if (!Number.isFinite(Number(profile?.护甲等级))) missing.push('AC');
    if (!Number.isFinite(Number(profile?.先攻加值))) missing.push('先攻');
    if (!Number.isFinite(Number(profile?.速度尺))) missing.push('速度');
    const abilities = profile?.属性值;
    const abilityKeys = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    abilityKeys.forEach((key) => {
      if (!Number.isFinite(Number(abilities?.[key]))) missing.push(`属性.${key}`);
    });
    if (!profile?.豁免熟练 || typeof profile.豁免熟练 !== 'object') missing.push('豁免熟练');
    if (!profile?.技能熟练 || typeof profile.技能熟练 !== 'object') missing.push('技能熟练');
    if (!Number.isFinite(Number(profile?.被动感知))) missing.push('被动感知');
    if (!profile?.法术位 || typeof profile.法术位 !== 'object') missing.push('法术位');
    if (!String(profile?.生命骰 || '').trim()) missing.push('生命骰');
  }
  if (!Number.isFinite(Number((state as any)?.角色?.法利))) missing.push('金币');

  return {
    issue_id: 'METRIC_DND_CHARACTER',
    turn: state.回合数 ?? 0,
    severity: missing.length === 0 ? 'info' : (missing.length >= 6 ? 'error' : 'warning'),
    action: 'quality_metric',
    sheet: 'CHARACTER_Attributes/CHARACTER_Resources',
    path: 'character_profile_compat',
    message: `角色DND字段 missing=${missing.length}${missing.length > 0 ? ` | ${missing.slice(0, 8).join(',')}` : ' | 完整'}`,
    timestamp: state.游戏时间 || ''
  };
};

const buildValidationIssueRows = (state: GameState): TavernDBTableRow[] => {
  const summaryRows = Array.isArray(state.日志摘要) ? state.日志摘要 : [];
  const outlineRows = Array.isArray(state.日志大纲) ? state.日志大纲 : [];
  const summarySet = new Set<string>();
  const outlineSet = new Set<string>();
  summaryRows.forEach((row: any) => {
    const am = normalizeAmIndex(row?.编码索引);
    if (am) summarySet.add(am);
  });
  outlineRows.forEach((row: any) => {
    const am = normalizeAmIndex(row?.编码索引);
    if (am) outlineSet.add(am);
  });
  let pairedCount = 0;
  summarySet.forEach((am) => {
    if (outlineSet.has(am)) pairedCount += 1;
  });
  const indexedTotal = new Set<string>([...summarySet, ...outlineSet]).size;
  const pairingRate = indexedTotal > 0 ? Math.round((pairedCount / indexedTotal) * 100) : 100;
  const pairingIssues = collectIndexedLogPairingIssues({
    日志摘要: summaryRows as any,
    日志大纲: outlineRows as any
  });
  const outlineByAm = new Map<string, any>();
  outlineRows.forEach((row: any) => {
    const am = normalizeAmIndex(row?.编码索引);
    if (!am) return;
    outlineByAm.set(am, row);
  });
  const pairOverlaps: number[] = [];
  summaryRows.forEach((row: any) => {
    const am = normalizeAmIndex(row?.编码索引);
    if (!am) return;
    const matchedOutline = outlineByAm.get(am);
    if (!matchedOutline) return;
    const summaryText = normalizeValidationText(row?.纪要 ?? row?.摘要 ?? '');
    const outlineText = normalizeValidationText(matchedOutline?.大纲 ?? matchedOutline?.标题 ?? '');
    if (!summaryText || !outlineText) return;
    const overlap = calcTextOverlap(
      normalizeSimilarityToken(summaryText),
      normalizeSimilarityToken(outlineText)
    );
    pairOverlaps.push(overlap);
  });
  const averageOverlap = pairOverlaps.length > 0
    ? Math.round((pairOverlaps.reduce((sum, value) => sum + value, 0) / pairOverlaps.length) * 100)
    : 0;
  const highOverlapCount = pairOverlaps.filter((value) => value >= 0.88).length;

  const factBoundary = buildFactBoundary(summaryRows as any, outlineRows as any, {
    knownFactLimit: 6,
    unknownSlotLimit: 8,
    summaryWindow: 8,
    outlineWindow: 6
  });
  const unknownSlots = factBoundary.unknownSlots.filter((item) => !String(item).includes('当前关键槽位均有来源'));

  const conflictStats = (state as any)?.__tableMeta?.conflictStats || {};
  const totalConflict = Number(conflictStats?.total || 0);
  const turnBase = Math.max(1, Number(state.回合数 || 0));
  const conflictRate = Math.round((totalConflict / turnBase) * 100);
  const reasonText = Object.entries((conflictStats?.byReason || {}) as Record<string, unknown>)
    .map(([reason, count]) => `${reason}:${Number(count || 0)}`)
    .join(', ');
  const writerShadow = ((state as any)?.__stateVarWriterShadow && typeof (state as any).__stateVarWriterShadow === 'object')
    ? (state as any).__stateVarWriterShadow
    : {};
  const writerRuntimeMetrics = ((state as any)?.__stateVarWriter?.metrics && typeof (state as any).__stateVarWriter.metrics === 'object')
    ? (state as any).__stateVarWriter.metrics
    : {};
  const writerBacklog = Math.max(0, Math.floor(Number(writerRuntimeMetrics.backlog || 0)));
  const writerRetries = Math.max(0, Math.floor(Number(writerRuntimeMetrics.retryCount || 0)));
  const writerFailedByDomainRaw = (writerRuntimeMetrics.failedByDomain && typeof writerRuntimeMetrics.failedByDomain === 'object')
    ? writerRuntimeMetrics.failedByDomain as Record<string, unknown>
    : {};
  const writerFailurePairs = Object.entries(writerFailedByDomainRaw)
    .map(([domain, count]) => [domain, Math.max(0, Math.floor(Number(count || 0)))] as const)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const writerFailureText = writerFailurePairs.length > 0
    ? writerFailurePairs.map(([domain, count]) => `${domain}:${count}`).join(', ')
    : 'none';
  const idempotencyConflict = Math.max(0, Math.floor(Number((conflictStats?.byReason || {})?.idempotency_conflict || 0)));
  const staleEventConflict = Math.max(0, Math.floor(Number((conflictStats?.byReason || {})?.stale_event || 0)));
  const writerSkipByReason = (writerRuntimeMetrics.skipByReason && typeof writerRuntimeMetrics.skipByReason === 'object')
    ? writerRuntimeMetrics.skipByReason as Record<string, unknown>
    : {};
  const writerSkipSummary = [
    `dup=${Math.max(0, Math.floor(Number(writerSkipByReason.duplicate_idempotency || 0)))}`,
    `stale=${Math.max(0, Math.floor(Number(writerSkipByReason.stale_event || 0)))}`,
    `invalid=${Math.max(0, Math.floor(Number(writerSkipByReason.invalid_event || 0)))}`,
    `no_command=${Math.max(0, Math.floor(Number(writerSkipByReason.no_command || 0)))}`
  ].join(', ');
  const stateVarRunSummary = (
    (state as any)?.__stateVarDiagnostics?.lastStateRun
    && typeof (state as any).__stateVarDiagnostics.lastStateRun === 'object'
  )
    ? (state as any).__stateVarDiagnostics.lastStateRun
    : {};
  const replayDiagnostics = (
    (state as any)?.__stateVarDiagnostics?.replay
    && typeof (state as any).__stateVarDiagnostics.replay === 'object'
  )
    ? (state as any).__stateVarDiagnostics.replay
    : {};
  const replayTotals = (replayDiagnostics.totals && typeof replayDiagnostics.totals === 'object')
    ? replayDiagnostics.totals as Record<string, unknown>
    : {};
  const replayNoiseTotals = (replayDiagnostics.noiseTotals && typeof replayDiagnostics.noiseTotals === 'object')
    ? replayDiagnostics.noiseTotals as Record<string, unknown>
    : {};
  const replayGate = (replayDiagnostics.gate && typeof replayDiagnostics.gate === 'object')
    ? replayDiagnostics.gate as Record<string, unknown>
    : {};
  const replayThresholds = {
    ...DEFAULT_STATE_VARIABLE_REPLAY_GATE_THRESHOLDS,
    ...((replayGate.thresholds && typeof replayGate.thresholds === 'object')
      ? replayGate.thresholds as Record<string, unknown>
      : {})
  };
  const replayInvalidRows = Math.max(0, Math.floor(Number(replayDiagnostics.invalidRows || 0)));
  const replayMissingRows = Math.max(
    0,
    Math.floor(Number(replayTotals.missingInReplay || 0))
      + Math.floor(Number(replayTotals.missingInBaseline || 0))
  );
  const replayChangedRows = Math.max(0, Math.floor(Number(replayTotals.changedRows || 0)));
  const replayChangedCells = Math.max(0, Math.floor(Number(replayTotals.changedCells || 0)));
  const replayGateStatus = String(replayGate.status || 'pass').trim() || 'pass';
  const replayGateSeverity = replayGateStatus === 'fail' ? 'error' : replayGateStatus === 'warn' ? 'warning' : 'info';

  const metricRows: TavernDBTableRow[] = [
    {
      issue_id: 'METRIC_AM_PAIRING',
      turn: state.回合数 ?? 0,
      severity: pairingRate >= 95 ? 'info' : pairingRate >= 80 ? 'warning' : 'error',
      action: 'quality_metric',
      sheet: 'LOG_Summary/LOG_Outline',
      path: 'am_pairing_rate',
      message: `AM配对率 ${pairingRate}% (${pairedCount}/${indexedTotal || 0}), missingOutline=${pairingIssues.missingOutline.length}, missingSummary=${pairingIssues.missingSummary.length}`,
      timestamp: state.游戏时间 || ''
    },
    {
      issue_id: 'METRIC_SUMMARY_OUTLINE_OVERLAP',
      turn: state.回合数 ?? 0,
      severity: highOverlapCount === 0 ? 'info' : highOverlapCount <= 1 ? 'warning' : 'error',
      action: 'quality_metric',
      sheet: 'LOG_Summary/LOG_Outline',
      path: 'summary_outline_overlap',
      message: `Summary/Outline 同质化均值 ${averageOverlap}% (>=88%: ${highOverlapCount}/${pairOverlaps.length || 0})`,
      timestamp: state.游戏时间 || ''
    },
    {
      issue_id: 'METRIC_UNKNOWN_SLOTS',
      turn: state.回合数 ?? 0,
      severity: unknownSlots.length > 0 ? 'warning' : 'info',
      action: 'quality_metric',
      sheet: 'LOG_Summary/LOG_Outline',
      path: 'unknown_slots',
      message: `UNKNOWN_SLOTS=${unknownSlots.length}${unknownSlots.length > 0 ? ` | ${unknownSlots.slice(0, 3).join(' | ')}` : ''}`,
      timestamp: state.游戏时间 || ''
    },
    {
      issue_id: 'METRIC_CONFLICT_RATE',
      turn: state.回合数 ?? 0,
      severity: totalConflict === 0 ? 'info' : conflictRate >= 20 ? 'error' : 'warning',
      action: 'quality_metric',
      sheet: 'SYS_ValidationIssue',
      path: 'conflict_rate',
      message: `冲突率 ${conflictRate}% (total=${totalConflict}, turnBase=${turnBase})${reasonText ? ` | ${reasonText}` : ''}`,
      timestamp: state.游戏时间 || ''
    },
    {
      issue_id: 'METRIC_STATE_WRITER_SHADOW',
      turn: state.回合数 ?? 0,
      severity: Number(writerShadow?.eventCount || 0) > 0 ? 'info' : 'warning',
      action: 'quality_metric',
      sheet: 'SYS_StateVarEventLog/SYS_StateVarApplyLog',
      path: 'state_writer_shadow',
      message: `writer-shadow events=${Math.max(0, Math.floor(Number(writerShadow?.eventCount || 0)))}, skipped=${Math.max(0, Math.floor(Number(writerShadow?.skippedCount || 0)))}, commands=${Math.max(0, Math.floor(Number(writerShadow?.commandCount || 0)))}, audit=${Math.max(0, Math.floor(Number(writerShadow?.auditCommandCount || 0)))}`,
      timestamp: state.游戏时间 || ''
    },
    {
      issue_id: 'METRIC_STATE_WRITER_QUEUE',
      turn: state.回合数 ?? 0,
      severity: writerBacklog > 0 ? 'warning' : 'info',
      action: 'quality_metric',
      sheet: 'SYS_StateVarApplyLog',
      path: 'state_writer_queue',
      message: `writer-queue backlog=${writerBacklog}, retry=${writerRetries}`,
      timestamp: state.游戏时间 || ''
    },
    {
      issue_id: 'METRIC_STATE_WRITER_FAILURE_DIST',
      turn: state.回合数 ?? 0,
      severity: writerFailurePairs.length > 0 ? 'warning' : 'info',
      action: 'quality_metric',
      sheet: 'SYS_StateVarApplyLog',
      path: 'state_writer_failure_dist',
      message: `writer-failure-by-domain ${writerFailureText} | idempotency_conflict=${idempotencyConflict}, stale_event=${staleEventConflict} | skip(${writerSkipSummary})`,
      timestamp: state.游戏时间 || ''
    },
    {
      issue_id: 'METRIC_STATE_RUN_OUTCOME',
      turn: state.回合数 ?? 0,
      severity: String(stateVarRunSummary?.rollbackReason || '') ? 'warning' : 'info',
      action: 'quality_metric',
      sheet: 'SYS_StateVarEventLog/SYS_StateVarApplyLog',
      path: 'state_run_outcome',
      message: `state-run outcome rollback=${String(stateVarRunSummary?.rollbackReason || '') || 'none'}, skipped=${Math.max(0, Math.floor(Number(stateVarRunSummary?.writerSkipped || 0)))}, fallback=${String(stateVarRunSummary?.fallback || '') || 'none'}`,
      timestamp: state.游戏时间 || ''
    },
    {
      issue_id: 'METRIC_STATE_REPLAY_GATE',
      turn: state.回合数 ?? 0,
      severity: replayGateSeverity,
      action: 'quality_metric',
      sheet: 'SYS_StateVarEventLog',
      path: 'state_replay_gate',
      message: `replay-gate status=${replayGateStatus} invalidRows=${replayInvalidRows} (warn>=${Number((replayThresholds as any).invalidRowsWarn)},err>=${Number((replayThresholds as any).invalidRowsError)}), missingRows=${replayMissingRows} (warn>=${Number((replayThresholds as any).missingRowsWarn)},err>=${Number((replayThresholds as any).missingRowsError)}), changedRows=${replayChangedRows}, changedCells=${replayChangedCells} | noise missingKey=${Math.max(0, Math.floor(Number(replayNoiseTotals.missingKeyFieldRows || 0)))}, dupKey=${Math.max(0, Math.floor(Number(replayNoiseTotals.duplicateKeyRows || 0)))}, orderChanges=${Math.max(0, Math.floor(Number(replayNoiseTotals.rowOrderChanges || 0)))}`,
      timestamp: state.游戏时间 || ''
    },
    buildBattleMapCompatMetric(state),
    buildCharacterProfileMetric(state)
  ];

  const logs = Array.isArray(state.日志) ? state.日志 : [];
  const logRows = logs
    .filter((log) => /校验|验证|阻断|失败/i.test(String(log?.text || '')))
    .slice(-60)
    .map((log, index) => ({
      issue_id: log.id || `ISSUE_${index + 1}`,
      turn: log.turnIndex ?? state.回合数 ?? 0,
      severity: /阻断|失败/i.test(String(log.text || '')) ? 'error' : 'warning',
      action: '',
      sheet: '',
      path: '',
      message: String(log.text || ''),
      timestamp: log.gameTime || state.游戏时间 || ''
    }));
  return [...metricRows, ...logRows].slice(0, 60);
};

const buildMappingRegistryRows = (): TavernDBTableRow[] => {
  return getDomainMappingRegistry().map((mapping) => ({
    domain: mapping.domain,
    module: mapping.module,
    sheet_id: mapping.sheetId,
    primary_key: mapping.primaryKey,
    description: mapping.description
  }));
};

const buildEconomicLedgerRows = (state: GameState): TavernDBTableRow[] => {
  const ledger = Array.isArray(state.经济流水) ? state.经济流水 : [];
  return ledger.map((entry) => ({
    ledger_id: entry.id,
    turn: entry.turn,
    timestamp: entry.timestamp,
    account: entry.account,
    before: entry.before,
    delta: entry.delta,
    after: entry.after,
    reason: entry.reason,
    command_ref: entry.commandRef || ''
  }));
};

const sheetRowBuilders: Record<TavernDBSheetId, (state: GameState, options: Required<TavernProjectionOptions>) => TavernDBTableRow[]> = {
  SYS_GlobalState: (state) => [{
    _global_id: 'GLOBAL_STATE',
    当前场景: state.当前地点 || '',
    场景描述: state.场景描述 || '',
    当前日期: state.当前日期 || '',
    游戏时间: state.游戏时间 || '',
    上轮时间: state.上轮时间 || '',
    流逝时长: state.流逝时长 || '',
    世界坐标X: typeof state.世界坐标?.x === 'number' ? state.世界坐标.x : '',
    世界坐标Y: typeof state.世界坐标?.y === 'number' ? state.世界坐标.y : '',
    天气状况: state.天气 || '',
    战斗模式: state.战斗模式 || (state.战斗?.是否战斗中 ? '战斗中' : '非战斗'),
    当前回合: state.回合数 ?? 0,
    系统通知: state.系统通知 || ''
  }],
  SYS_CommandAudit: (state) => buildCommandAuditRows(state),
  SYS_TransactionAudit: (state) => buildTransactionAuditRows(state),
  SYS_ValidationIssue: (state) => buildValidationIssueRows(state),
  SYS_MappingRegistry: () => buildMappingRegistryRows(),
  SYS_StateVarEventLog: () => [],
  SYS_StateVarApplyLog: () => [],
  NPC_Registry: (state) => buildNpcRows(state),
  ITEM_Inventory: (state) => buildInventoryRows(state),
  QUEST_Active: (state) => buildQuestRows(state),
  FACTION_Standing: (state) => buildFactionRows(state),
  ECON_Ledger: (state) => buildEconomicLedgerRows(state),
  COMBAT_Encounter: (state) => buildCombatEncounterRows(state),
  COMBAT_BattleMap: (state) => buildCombatMapRows(state),
  LOG_Summary: (state, options) => buildSummaryRows(state, options.summaryLimit),
  LOG_Outline: (state, options) => buildOutlineRows(state, options.outlineLimit),
  UI_ActionOptions: (state) => buildActionOptionRows(state),
  DICE_Pool: (state) => buildDiceRows(state),
  SKILL_Library: (state) => buildSkillLibraryRows(state),
  CHARACTER_Skills: (state) => buildCharacterSkillRows(state),
  FEAT_Library: (state) => buildFeatLibraryRows(state),
  CHARACTER_Feats: (state) => buildCharacterFeatRows(state),
  CHARACTER_Registry: (state) => buildCharacterRegistryRows(state),
  CHARACTER_Attributes: (state) => buildCharacterAttributeRows(state),
  CHARACTER_Resources: (state) => buildCharacterResourceRows(state),
  PHONE_Device: (state) => buildPhoneDeviceRows(state),
  PHONE_Contacts: (state) => buildPhoneContactRows(state),
  PHONE_Threads: (state) => buildPhoneThreadRows(state),
  PHONE_Messages: (state) => buildPhoneMessageRows(state),
  PHONE_Pending: (state) => buildPhonePendingRows(state),
  FORUM_Boards: (state) => buildForumBoardRows(state),
  FORUM_Posts: (state) => buildForumPostRows(state),
  FORUM_Replies: (state) => buildForumReplyRows(state),
  PHONE_Moments: (state) => buildPhoneMomentRows(state),
  WORLD_NpcTracking: (state) => buildWorldNpcTrackingRows(state),
  WORLD_News: (state) => buildWorldNewsRows(state),
  WORLD_Rumors: (state) => buildWorldRumorRows(state),
  WORLD_Denatus: (state) => buildWorldDenatusRows(state),
  WORLD_WarGame: (state) => buildWorldWarGameRows(state),
  STORY_Mainline: (state) => buildStoryMainlineRows(state),
  STORY_Triggers: (state) => buildStoryTriggerRows(state),
  STORY_Milestones: (state) => buildStoryMilestoneRows(state),
  CONTRACT_Registry: (state) => buildContractRows(state),
  MAP_SurfaceLocations: (state) => buildMapSurfaceLocationRows(state),
  MAP_DungeonLayers: (state) => buildMapDungeonLayerRows(state),
  MAP_MacroLocations: (state) => buildMapMacroLocationRows(state),
  MAP_MidLocations: (state) => buildMapMidLocationRows(state),
  NPC_RelationshipEvents: (state) => buildNpcRelationshipEventRows(state),
  NPC_LocationTrace: (state) => buildNpcLocationTraceRows(state),
  NPC_InteractionLog: (state) => buildNpcInteractionLogRows(state),
  QUEST_Objectives: (state) => buildQuestObjectiveRows(state),
  QUEST_ProgressLog: (state) => buildQuestProgressLogRows(state),
  EXPLORATION_Map_Data: (state) => buildExplorationRows(state),
  COMBAT_Map_Visuals: (state) => buildCombatVisualRows(state)
};

const normalizeRows = (rows: TavernDBTableRow[], sheet: TavernDBSheetDefinition): TavernDBTableRow[] => {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const output: TavernDBTableRow = {};
    sheet.columns.forEach((column) => {
      output[column.key] = toSheetValue((row as any)[column.key]);
    });
    return output;
  });
};

const readDirectSheetRows = (state: GameState, sheetId: TavernDBSheetId): TavernDBTableRow[] | null => {
  if (STATE_SOURCED_PROJECTION_SHEETS.has(sheetId)) return null;
  const store = (state as any).__tableRows;
  if (!store || typeof store !== 'object' || Array.isArray(store)) return null;
  const rows = store[sheetId];
  if (!Array.isArray(rows)) return null;
  return rows.map((row) => (row && typeof row === 'object' ? { ...(row as Record<string, unknown>) } : {}));
};

export const projectGameStateToTavernTables = (
  state: GameState,
  options: TavernProjectionOptions = {}
): TavernDBProjectedTable[] => {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const cacheKey = buildProjectionCacheKey(state, resolved);
  const cached = projectionCache.get(cacheKey);
  if (cached) {
    return cloneProjectedTables(cached);
  }
  const registry = getSheetRegistry();
  const tables: TavernDBProjectedTable[] = [];

  registry.forEach((sheet) => {
    const builder = sheetRowBuilders[sheet.id];
    const directRows = readDirectSheetRows(state, sheet.id);
    const rawRows = directRows ?? (builder ? builder(state, resolved) : []);
    const rows = normalizeRows(rawRows, sheet);
    if (!resolved.includeEmptySheets && rows.length === 0) return;
    tables.push({
      id: sheet.id,
      label: sheet.label,
      columns: sheet.columns.map((column) => column.key),
      rows
    });
  });

  setProjectionCache(cacheKey, tables);
  return tables;
};

export interface TavernTableSearchRow {
  sheetId: TavernDBSheetId;
  sheetLabel: string;
  rowIndex: number;
  text: string;
  row: TavernDBTableRow;
}

export const buildTavernTableSearchRows = (tables: TavernDBProjectedTable[]): TavernTableSearchRow[] => {
  const rows: TavernTableSearchRow[] = [];
  tables.forEach((table) => {
    table.rows.forEach((row, rowIndex) => {
      const text = table.columns
        .map((column) => `${column}:${String(row[column] ?? '')}`)
        .filter((part) => !part.endsWith(':'))
        .join(' | ')
        .trim();
      if (!text) return;
      rows.push({
        sheetId: table.id,
        sheetLabel: table.label,
        rowIndex,
        text: text.toLowerCase(),
        row
      });
    });
  });
  return rows;
};

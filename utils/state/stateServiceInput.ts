import type { GameState } from '../../types';

const SOCIAL_ALLOWED_KEYS = ['姓名', '关系状态', '好感度', '是否在场', '位置详情', '坐标', '眷族', '身份'];
const CHARACTER_ALLOWED_KEYS = [
  'id',
  '姓名',
  '等级',
  '职业',
  '种族',
  '当前位置',
  '状态',
  '生命值',
  '最大生命值',
  'HP',
  '精神力',
  '最大精神力',
  '体力',
  '最大体力',
  '法术位',
  '职业资源',
  '生命骰',
  '金币',
  '法利',
  '经验值'
];
const TASK_ALLOWED_KEYS = [
  'id',
  '标题',
  '名称',
  '状态',
  '评级',
  '类型',
  '进度',
  '目标',
  '地点',
  '截止时间',
  '奖励'
];
const INVENTORY_ALLOWED_KEYS = [
  'id',
  '名称',
  '类型',
  '类别',
  '数量',
  '品质',
  '稀有度',
  '重量',
  '价值',
  '法利',
  '装备中',
  '描述'
];
const STORY_ALLOWED_KEYS = ['当前阶段', '当前目标', '主线进度', '支线进度', '近期事件', '风险提示', '下步建议'];
const COMBAT_ALLOWED_KEYS = ['是否战斗中', '回合', '阶段', '地点', '先攻顺序', '战斗模式'];
const WORLD_ALLOWED_KEYS = ['头条新闻', '街头传闻', '诸神神会', '战争游戏', 'NPC后台跟踪'];
const PHONE_ALLOWED_KEYS = ['对话', '信件', '动态', '通讯录', '黑名单'];

const MAX_SOCIAL_ROWS = 24;
const MAX_TASK_ROWS = 24;
const MAX_INVENTORY_ROWS = 40;
const MAX_COMBAT_ROWS = 20;
const MAX_STRING_LENGTH = 320;

type RecordLike = Record<string, unknown>;

export interface BuildStateServiceInputParams {
  state: GameState;
  socialBrief: RecordLike[];
  requiredSheets: string[];
  stateSheetGuide: RecordLike[];
  maxConcurrentSheets: number;
  maxConcurrentBatches: number;
  governanceContract: StateInputGovernanceContract;
}

export interface StateInputGovernanceContract {
  version: string;
  turnScope: RecordLike;
  domainScope: RecordLike;
  semanticScope: RecordLike;
}

const isRecord = (value: unknown): value is RecordLike => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const compactString = (value: unknown, limit = MAX_STRING_LENGTH): string => {
  const text = String(value ?? '').trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1))}…`;
};

const sanitizeValue = (value: unknown, depth = 0, maxDepth = 3, maxArrayLength = 16): unknown => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return compactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth >= maxDepth) return undefined;
    return value
      .slice(0, maxArrayLength)
      .map((item) => sanitizeValue(item, depth + 1, maxDepth, maxArrayLength))
      .filter((item) => item !== undefined);
  }
  if (!isRecord(value) || depth >= maxDepth) return undefined;

  const output: RecordLike = {};
  for (const [key, item] of Object.entries(value)) {
    const sanitized = sanitizeValue(item, depth + 1, maxDepth, maxArrayLength);
    if (sanitized !== undefined) {
      output[key] = sanitized;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
};

const pickAllowedFields = (record: unknown, allowedKeys: string[]): RecordLike => {
  if (!isRecord(record)) return {};
  const result: RecordLike = {};
  for (const key of allowedKeys) {
    if (!(key in record)) continue;
    const value = sanitizeValue(record[key]);
    if (value !== undefined) result[key] = value;
  }

  if (Object.keys(result).length === 0) {
    const fallbackEntries = Object.entries(record)
      .filter(([, value]) => {
        return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
      })
      .slice(0, 8);
    for (const [key, value] of fallbackEntries) {
      const sanitized = sanitizeValue(value);
      if (sanitized !== undefined) result[key] = sanitized;
    }
  }

  return result;
};

const compactList = (list: unknown, allowedKeys: string[], limit: number): RecordLike[] => {
  if (!Array.isArray(list)) return [];
  return list
    .slice(-limit)
    .map((item) => pickAllowedFields(item, allowedKeys))
    .filter((item) => Object.keys(item).length > 0);
};

const compactCombatState = (combat: unknown): RecordLike => {
  if (!isRecord(combat)) return {};
  const payload = pickAllowedFields(combat, COMBAT_ALLOWED_KEYS);

  if (Array.isArray((combat as any).敌人)) {
    payload.敌人 = compactList((combat as any).敌人, ['id', '名称', '生命值', '最大生命值', '状态', '位置'], MAX_COMBAT_ROWS);
  }
  if (Array.isArray((combat as any).队友)) {
    payload.队友 = compactList((combat as any).队友, ['id', '名称', '生命值', '最大生命值', '状态', '位置'], MAX_COMBAT_ROWS);
  }
  if (Array.isArray((combat as any).地图)) {
    payload.地图 = (combat as any).地图
      .slice(0, 12)
      .map((row: any) => pickAllowedFields(row, ['id', '名称', '类型', '可通行', '坐标', '标签']))
      .filter((row: RecordLike) => Object.keys(row).length > 0);
  }

  if (isRecord((combat as any).视觉)) {
    payload.视觉 = pickAllowedFields((combat as any).视觉, ['主题', '描述', '天气', '光照']);
  }

  return payload;
};

const normalizeGovernanceContract = (
  governanceContract: StateInputGovernanceContract,
  requiredSheets: string[]
): StateInputGovernanceContract => {
  const versionText = String(governanceContract?.version || '').trim();
  const normalizedVersion = versionText.length > 0 ? versionText : 'state-variable-governance-v1';
  const normalizedTurnScope = sanitizeValue(governanceContract?.turnScope, 0, 3) as RecordLike | undefined;
  const normalizedDomainScope = sanitizeValue(governanceContract?.domainScope, 0, 4, 64) as RecordLike | undefined;
  const normalizedSemanticScope = sanitizeValue(governanceContract?.semanticScope, 0, 4) as RecordLike | undefined;

  const safeRequiredSheets = Array.isArray(requiredSheets)
    ? Array.from(new Set(requiredSheets
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0)))
    : [];

  const domainScopeRecord = isRecord(normalizedDomainScope) ? { ...normalizedDomainScope } : {};
  const allowlistRecord = isRecord(domainScopeRecord.allowlist) ? domainScopeRecord.allowlist as RecordLike : null;
  const allowedSheets = new Set<string>();
  if (allowlistRecord) {
    Object.values(allowlistRecord).forEach((sheetMap) => {
      if (!isRecord(sheetMap)) return;
      Object.keys(sheetMap).forEach((sheetId) => {
        const normalizedSheetId = String(sheetId || '').trim();
        if (normalizedSheetId) {
          allowedSheets.add(normalizedSheetId);
        }
      });
    });
  }
  const outOfScopeSheets = safeRequiredSheets.filter((sheetId) => !allowedSheets.has(sheetId));

  const existingContext = isRecord(domainScopeRecord.context) ? domainScopeRecord.context : {};
  domainScopeRecord.context = {
    ...existingContext,
    requiredSheets: safeRequiredSheets,
    requiredSheetCount: safeRequiredSheets.length,
    outOfScopeRequiredSheets: outOfScopeSheets,
    hasOutOfScopeRequiredSheets: outOfScopeSheets.length > 0
  };

  return {
    version: normalizedVersion,
    turnScope: normalizedTurnScope || {},
    domainScope: domainScopeRecord,
    semanticScope: normalizedSemanticScope || {}
  };
};

export const buildStateServiceInputPayload = ({
  state,
  socialBrief,
  requiredSheets,
  stateSheetGuide,
  maxConcurrentSheets,
  maxConcurrentBatches,
  governanceContract
}: BuildStateServiceInputParams): RecordLike => {
  const normalizedGovernanceContract = normalizeGovernanceContract(governanceContract, requiredSheets);
  return {
    社交: compactList(socialBrief, SOCIAL_ALLOWED_KEYS, MAX_SOCIAL_ROWS),
    角色: pickAllowedFields(state.角色 || {}, CHARACTER_ALLOWED_KEYS),
    任务: compactList(state.任务 || [], TASK_ALLOWED_KEYS, MAX_TASK_ROWS),
    剧情: pickAllowedFields(state.剧情 || {}, STORY_ALLOWED_KEYS),
    背包: compactList(state.背包 || [], INVENTORY_ALLOWED_KEYS, MAX_INVENTORY_ROWS),
    战斗: compactCombatState(state.战斗 || {}),
    世界: pickAllowedFields(state.世界 || {}, WORLD_ALLOWED_KEYS),
    手机: pickAllowedFields(state.手机 || {}, PHONE_ALLOWED_KEYS),
    治理契约: normalizedGovernanceContract,
    表结构约束: {
      source: 'sheetRegistry',
      sheets: Array.isArray(stateSheetGuide) ? stateSheetGuide : []
    },
    填表任务: {
      mode: 'async-batch',
      requiredSheets,
      maxConcurrentSheets,
      maxConcurrentBatches,
      allowParallelGeneration: true,
      commitPolicy: 'serial',
      parallelBySheet: true
    }
  };
};

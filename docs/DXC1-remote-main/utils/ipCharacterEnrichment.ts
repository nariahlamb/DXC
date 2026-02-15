import { AppSettings, GameState, InventoryItem } from '../types';
import { dispatchAIRequest, resolveRequestTimeoutMs, resolveServiceConfig } from './aiDispatch';
import { reconcileEquipmentNameByInventory } from './equipmentLinking';

export type FamousIpSeedItem =
  Pick<InventoryItem, '名称' | '描述' | '类型'>
  & Partial<Omit<InventoryItem, '名称' | '描述' | '类型'>>;

export type FamousIpProfile = {
  id: string;
  aliases: string[];
  appearance: string;
  appearanceKeywords: string[];
  background: string;
  backgroundKeywords: string[];
  equipment: Record<string, string>;
  items: FamousIpSeedItem[];
};

type IpAiExtraction = {
  matched?: boolean;
  confidence?: number;
  canonicalName?: string;
  appearance?: string;
  appearanceKeywords?: string[];
  background?: string;
  backgroundKeywords?: string[];
  equipment?: Record<string, string>;
  items?: Array<Partial<InventoryItem> & {
    名称?: string;
    描述?: string;
    类型?: string;
  }>;
};

const DEFAULT_APPEARANCE_HINTS = ['相貌平平', '冒险者'];
const DEFAULT_BACKGROUND_HINTS = ['寻求邂逅', '来到欧拉丽'];

const KNOWN_ITEM_TYPES: InventoryItem['类型'][] = [
  'consumable', 'material', 'key_item', 'weapon', 'armor', 'loot',
  '消耗品', '材料', '关键物品', '钥匙物品', '武器', '防具', '护甲', '饰品', '战利品', '掉落', '杂项'
];

const EQUIPMENT_SLOT_MAP: Record<string, string> = {
  '主手': '主手',
  'main': '主手',
  'mainhand': '主手',
  'weapon': '主手',
  '副手': '副手',
  'offhand': '副手',
  'secondary': '副手',
  '头部': '头部',
  'head': '头部',
  'helmet': '头部',
  '身体': '身体',
  'body': '身体',
  'armor': '身体',
  'chest': '身体',
  '手部': '手部',
  'hands': '手部',
  'gloves': '手部',
  '腿部': '腿部',
  'legs': '腿部',
  '足部': '足部',
  'feet': '足部',
  'boots': '足部',
  '饰品': '饰品1',
  '饰品1': '饰品1',
  '饰品2': '饰品2',
  '饰品3': '饰品3',
  'accessory': '饰品1',
  'ring': '饰品1',
  'amulet': '饰品1'
};

const STATIC_FAMOUS_IP_PROFILES: FamousIpProfile[] = [
  {
    id: 'hakurei_reimu',
    aliases: ['博丽灵梦', '灵梦', 'hakureireimu', 'reimu'],
    appearance: '典型红白巫女服，袖口宽大，发间系红色蝴蝶结。',
    appearanceKeywords: ['巫女', '红白', '蝴蝶结', '博丽'],
    background: '博丽神社的巫女，长期处理异变并以符咒与结界术退治妖怪。',
    backgroundKeywords: ['博丽神社', '异变', '退治', '结界'],
    equipment: {
      身体: '红白巫女服',
      主手: '御币',
      副手: '退魔针',
      饰品1: '阴阳玉'
    },
    items: [
      {
        名称: '博丽御札束',
        描述: '成套符札，可用于结界强化与退魔驱散。',
        类型: '关键物品',
        数量: 1,
        品质: '稀有',
        标签: ['IP补全', '博丽']
      },
      {
        名称: '退魔符',
        描述: '一次性符纸，对邪祟与异常状态有额外压制。',
        类型: '消耗品',
        数量: 12,
        品质: '精良',
        效果: '对灵体/诅咒目标造成额外压制',
        标签: ['IP补全', '符札']
      },
      {
        名称: '阴阳玉',
        描述: '博丽流派常用法具，可攻可守。',
        类型: '武器',
        数量: 1,
        品质: '稀有',
        攻击力: 8,
        标签: ['IP补全', '法具']
      }
    ]
  },
  {
    id: 'jashin_chan',
    aliases: ['邪神酱', '邪神醬', '蛇喰邪神', 'jashinchan', 'jashin-chan'],
    appearance: '金发蛇尾的恶魔少女，常穿哥特风连衣裙。',
    appearanceKeywords: ['蛇尾', '恶魔', '哥特', '邪神'],
    background: '来自魔界的自称高阶恶魔，行动风格混沌且生存欲极强。',
    backgroundKeywords: ['魔界', '恶魔', '混沌'],
    equipment: {
      身体: '哥特风连衣裙',
      主手: '魔界短刃',
      饰品1: '蛇纹护符'
    },
    items: [
      {
        名称: '魔界短刃',
        描述: '锋利的短刃，近身突袭时更具威胁。',
        类型: '武器',
        数量: 1,
        品质: '精良',
        攻击力: 10,
        标签: ['IP补全', '恶魔']
      },
      {
        名称: '蛇纹护符',
        描述: '用于恶魔气息遮蔽与紧急自保。',
        类型: '关键物品',
        数量: 1,
        品质: '稀有',
        标签: ['IP补全', '护符']
      },
      {
        名称: '速食拉面',
        描述: '高频补给品，能够快速恢复少量体力。',
        类型: '消耗品',
        数量: 6,
        品质: '普通',
        效果: '恢复少量体力',
        标签: ['IP补全', '补给']
      }
    ]
  }
];

const aiProfileCache = new Map<string, FamousIpProfile | null>();

const normalizeToken = (value: string) => value.toLowerCase().replace(/[\s·・_.\-]/g, '');

const findStaticProfileByName = (name: string): FamousIpProfile | undefined => {
  const normalizedName = normalizeToken(name || '');
  if (!normalizedName) return undefined;
  return STATIC_FAMOUS_IP_PROFILES.find(profile =>
    profile.aliases.some(alias => {
      const normalizedAlias = normalizeToken(alias);
      return normalizedName === normalizedAlias
        || normalizedName.includes(normalizedAlias)
        || normalizedAlias.includes(normalizedName);
    })
  );
};

const sanitizeJsonText = (raw: string) => raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

const normalizeItemType = (value: string | undefined): InventoryItem['类型'] => {
  if (!value) return '关键物品';
  const raw = value.trim();
  const lower = raw.toLowerCase();
  const hit = KNOWN_ITEM_TYPES.find(type => type.toLowerCase() === lower || type === raw);
  if (hit) return hit;
  if (lower.includes('weapon') || lower.includes('武器')) return '武器';
  if (lower.includes('armor') || lower.includes('防具') || lower.includes('护甲')) return '防具';
  if (lower.includes('consumable') || lower.includes('消耗')) return '消耗品';
  if (lower.includes('material') || lower.includes('材料')) return '材料';
  return '关键物品';
};

const isEmptyValue = (value: unknown) => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const toPositiveInt = (value: unknown, fallback?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  const normalized = Math.floor(value);
  if (normalized <= 0) return fallback;
  return normalized;
};

const toFiniteNumber = (value: unknown) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Number.isFinite(value) ? value : undefined;
};

const sanitizeAffixes = (value: unknown): { 名称: string; 数值: string }[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry: any) => ({
      名称: String(entry.名称 ?? entry.name ?? '').trim(),
      数值: String(entry.数值 ?? entry.value ?? '').trim()
    }))
    .filter((entry) => entry.名称 && entry.数值);
  return rows.length > 0 ? rows : undefined;
};

const normalizeSeedItem = (
  item: Partial<InventoryItem> & { 名称?: string; 描述?: string; 类型?: string }
): FamousIpSeedItem | null => {
  const name = typeof item.名称 === 'string' ? item.名称.trim() : '';
  const desc = typeof item.描述 === 'string' ? item.描述.trim() : '';
  if (!name || !desc) return null;

  const normalized: FamousIpSeedItem = {
    ...item,
    名称: name,
    描述: desc,
    类型: normalizeItemType(typeof item.类型 === 'string' ? item.类型 : undefined),
    数量: toPositiveInt(item.数量, 1),
    攻击力: toFiniteNumber(item.攻击力),
    防御力: toFiniteNumber(item.防御力),
    恢复量: toFiniteNumber(item.恢复量),
    价值: toFiniteNumber(item.价值),
    重量: toFiniteNumber(item.重量),
    等级需求: toPositiveInt(item.等级需求),
    耐久: toFiniteNumber(item.耐久),
    最大耐久: toFiniteNumber(item.最大耐久),
    堆叠上限: toPositiveInt(item.堆叠上限),
    装备槽位: typeof item.装备槽位 === 'string' ? item.装备槽位 : undefined,
    图标: typeof item.图标 === 'string' ? item.图标 : undefined,
    来源: typeof item.来源 === 'string' ? item.来源 : undefined,
    制作者: typeof item.制作者 === 'string' ? item.制作者 : undefined,
    材质: typeof item.材质 === 'string' ? item.材质 : undefined,
    效果: typeof item.效果 === 'string' ? item.效果 : undefined,
    攻击特效: typeof item.攻击特效 === 'string' ? item.攻击特效 : undefined,
    防御特效: typeof item.防御特效 === 'string' ? item.防御特效 : undefined,
    是否绑定: typeof item.是否绑定 === 'boolean' ? item.是否绑定 : undefined,
    附加属性: sanitizeAffixes(item.附加属性),
    标签: Array.isArray(item.标签)
      ? item.标签.filter(Boolean).map((entry) => String(entry))
      : (typeof item.标签 === 'string' ? [item.标签] : undefined),
    品质: item.品质 as InventoryItem['品质']
  };

  return normalized;
};

const normalizeEquipment = (equipment: Record<string, string> | undefined) => {
  const normalized: Record<string, string> = {};
  if (!equipment || typeof equipment !== 'object') return normalized;
  Object.entries(equipment).forEach(([rawKey, value]) => {
    if (!value || typeof value !== 'string') return;
    const key = rawKey.trim().toLowerCase();
    const mapped = EQUIPMENT_SLOT_MAP[rawKey] || EQUIPMENT_SLOT_MAP[key];
    if (!mapped) return;
    normalized[mapped] = value;
  });
  return normalized;
};

const toProfileFromAi = (roleName: string, extraction: IpAiExtraction): FamousIpProfile | null => {
  const confidence = typeof extraction.confidence === 'number' ? extraction.confidence : 0;
  const matched = extraction.matched === true;
  if (!matched || confidence < 0.6) return null;

  const appearance = extraction.appearance?.trim() || '';
  const background = extraction.background?.trim() || '';
  const equipment = normalizeEquipment(extraction.equipment);
  const items = Array.isArray(extraction.items)
    ? extraction.items
        .map(normalizeSeedItem)
        .filter((item): item is FamousIpSeedItem => Boolean(item))
        .map((item) => ({
          ...item,
          标签: Array.isArray(item.标签) && item.标签.length > 0 ? item.标签 : ['AI补全']
        }))
    : [];

  if (!appearance && !background && Object.keys(equipment).length === 0 && items.length === 0) return null;

  const canonical = extraction.canonicalName?.trim() || roleName;
  const normalizedId = normalizeToken(canonical) || normalizeToken(roleName) || 'ip_profile';

  return {
    id: `ai_${normalizedId}`,
    aliases: [roleName, canonical].filter(Boolean),
    appearance: appearance || `${canonical}的标志性服装风格。`,
    appearanceKeywords: Array.isArray(extraction.appearanceKeywords) && extraction.appearanceKeywords.length > 0
      ? extraction.appearanceKeywords
      : [canonical],
    background: background || `${canonical}的经典IP设定背景。`,
    backgroundKeywords: Array.isArray(extraction.backgroundKeywords) && extraction.backgroundKeywords.length > 0
      ? extraction.backgroundKeywords
      : [canonical],
    equipment,
    items
  };
};

const buildAiSystemPrompt = (roleName: string) => [
  '你是角色设定补全助手。请基于你已知的公开作品知识，判断该角色是否为著名IP角色，并输出JSON。',
  '必须仅输出一个JSON对象，不要输出任何解释、markdown或代码块。',
  '若无法确认该角色是著名IP，返回 {"matched": false, "confidence": 0}.',
  '若确认是著名IP，返回字段：',
  '- matched: boolean',
  '- confidence: number(0~1)',
  '- canonicalName: string',
  '- appearance: string（标志性服装/外观）',
  '- appearanceKeywords: string[]',
  '- background: string（角色背景简述）',
  '- backgroundKeywords: string[]',
  '- equipment: object（可用槽位：主手/副手/头部/身体/手部/腿部/足部/饰品1/饰品2/饰品3）',
  '- items: array（每项尽量补全 InventoryItem 字段）',
  '- items[].必填: 名称, 描述, 类型',
  '- items[].基础字段: 数量, 品质, 稀有度, 装备槽位, 标签, 来源, 制作者, 材质, 图标, 堆叠上限, 是否绑定',
  '- items[].数值字段: 攻击力, 防御力, 恢复量, 耐久, 最大耐久, 价值, 重量, 等级需求',
  '- items[].效果字段: 效果, 攻击特效, 防御特效, 附加属性[{名称, 数值}]',
  '- items[].扩展字段: 武器{类型,伤害类型,射程,攻速,双手,特性}, 防具{类型,部位,护甲等级,抗性}, 消耗{类别,持续,冷却,副作用}, 材料{来源,用途,处理}, 魔剑{魔法名称,属性,威力,触发方式,冷却,剩余次数,最大次数,破损率,过载惩罚,备注}',
  '- 约束: equipment 中出现的物品名必须与 items[].名称一致，禁止同一物品使用不同别名',
  '- 约束: 不确定字段可省略，不要编造',
  `目标角色：${roleName}`
].join('\n');

export const fetchFamousIpProfileWithAI = async (
  roleName: string,
  settings: AppSettings,
  signal?: AbortSignal | null
): Promise<FamousIpProfile | null> => {
  const normalizedName = normalizeToken(roleName || '');
  if (!normalizedName) return null;

  if (aiProfileCache.has(normalizedName)) {
    return aiProfileCache.get(normalizedName) || null;
  }

  const staticProfile = findStaticProfileByName(roleName);
  try {
    const config = resolveServiceConfig(settings, 'story');
    const timeoutMs = resolveRequestTimeoutMs(settings, 'story');
    if (!config?.apiKey) {
      aiProfileCache.set(normalizedName, staticProfile || null);
      return staticProfile || null;
    }

    const raw = await dispatchAIRequest(
      config,
      buildAiSystemPrompt(roleName),
      `角色名：${roleName}`,
      undefined,
      { responseFormat: 'json', signal: signal ?? undefined, timeoutMs }
    );

    if (!raw || !raw.trim()) {
      aiProfileCache.set(normalizedName, staticProfile || null);
      return staticProfile || null;
    }

    const parsed = JSON.parse(sanitizeJsonText(raw)) as IpAiExtraction;
    const aiProfile = toProfileFromAi(roleName, parsed);
    const finalProfile = aiProfile || staticProfile || null;
    aiProfileCache.set(normalizedName, finalProfile);
    return finalProfile;
  } catch {
    aiProfileCache.set(normalizedName, staticProfile || null);
    return staticProfile || null;
  }
};

const isEmptyOrDefaultText = (value: string | undefined, hints: string[]) => {
  if (!value || !value.trim()) return true;
  const trimmed = value.trim();
  return hints.some(hint => trimmed.includes(hint));
};

const containsAnyKeyword = (value: string | undefined, keywords: string[]) => {
  if (!value) return false;
  return keywords.some(keyword => value.includes(keyword));
};

const mergeTextField = (currentValue: string | undefined, expectedValue: string, keywords: string[], defaultHints: string[]) => {
  if (isEmptyOrDefaultText(currentValue, defaultHints)) {
    return { value: expectedValue, changed: true };
  }
  if (containsAnyKeyword(currentValue, keywords)) {
    return { value: currentValue, changed: false };
  }
  return { value: `${currentValue}；${expectedValue}`, changed: true };
};

const mergeEquipment = (currentEquipment: Record<string, string>, incomingEquipment: Record<string, string>) => {
  const merged: Record<string, string> = { ...currentEquipment };
  let changed = false;
  Object.entries(incomingEquipment).forEach(([slot, itemName]) => {
    const existing = merged[slot];
    const normalizedExisting = typeof existing === 'string' ? existing.trim().toLowerCase() : '';
    if (!existing || existing === '无' || existing === '未装备' || normalizedExisting === 'none') {
      merged[slot] = itemName;
      changed = true;
    }
  });
  return { value: merged, changed };
};

const toInventoryItem = (profileId: string, seed: FamousIpSeedItem, index: number): InventoryItem => ({
  ...seed,
  id: seed.id || `IP_${profileId}_${index + 1}`,
  名称: seed.名称,
  描述: seed.描述,
  数量: seed.数量 ?? 1,
  类型: seed.类型
});

const mergeInventoryItemByMissingFields = (existing: InventoryItem, incoming: InventoryItem): { item: InventoryItem; changed: boolean } => {
  const merged: InventoryItem = { ...existing };
  let changed = false;

  (Object.keys(incoming) as Array<keyof InventoryItem>).forEach((key) => {
    const nextValue = incoming[key];
    if (isEmptyValue(nextValue)) return;
    if (!isEmptyValue(merged[key])) return;
    (merged as any)[key] = nextValue;
    changed = true;
  });

  if (!merged.id && incoming.id) {
    merged.id = incoming.id;
    changed = true;
  }

  return { item: merged, changed };
};

const mergeInventoryItems = (currentInventory: InventoryItem[], profileId: string, seeds: FamousIpSeedItem[]) => {
  const nextInventory = [...currentInventory];
  let changed = false;

  seeds.forEach((seed, index) => {
    const incoming = toInventoryItem(profileId, seed, index);
    const existingIndex = nextInventory.findIndex((item) => item.名称 === incoming.名称);
    if (existingIndex < 0) {
      nextInventory.push(incoming);
      changed = true;
      return;
    }

    const merged = mergeInventoryItemByMissingFields(nextInventory[existingIndex], incoming);
    if (merged.changed) {
      nextInventory[existingIndex] = merged.item;
      changed = true;
    }
  });

  return { value: nextInventory, changed };
};

export const applyFamousIpFirstTurnEnrichment = (
  state: GameState,
  profileInput?: FamousIpProfile | null
): { state: GameState; applied: boolean; profileId?: string } => {
  const roleName = state?.角色?.姓名;
  if (!roleName) return { state, applied: false };

  const profile = profileInput || findStaticProfileByName(roleName);
  if (!profile) return { state, applied: false };

  const nextCharacter = { ...state.角色 };
  let changed = false;

  const appearanceResult = mergeTextField(nextCharacter.外貌, profile.appearance, profile.appearanceKeywords, DEFAULT_APPEARANCE_HINTS);
  if (appearanceResult.changed) {
    nextCharacter.外貌 = appearanceResult.value;
    changed = true;
  }

  const backgroundResult = mergeTextField(nextCharacter.背景, profile.background, profile.backgroundKeywords, DEFAULT_BACKGROUND_HINTS);
  if (backgroundResult.changed) {
    nextCharacter.背景 = backgroundResult.value;
    changed = true;
  }

  const equipmentResult = mergeEquipment(nextCharacter.装备 || {}, profile.equipment);
  if (equipmentResult.changed) {
    nextCharacter.装备 = equipmentResult.value;
    changed = true;
  }

  const inventoryResult = mergeInventoryItems(state.背包 || [], profile.id, profile.items);
  if (inventoryResult.changed) {
    changed = true;
  }

  const reconciledEquipment = reconcileEquipmentNameByInventory(nextCharacter.装备 || {}, inventoryResult.value);
  if (reconciledEquipment.changed) {
    nextCharacter.装备 = reconciledEquipment.equipment;
    changed = true;
  }

  const profileLabel = profile.aliases[0] || profile.id;

  if (!changed) {
    return { state, applied: false, profileId: profileLabel };
  }

  return {
    state: {
      ...state,
      角色: nextCharacter,
      背包: inventoryResult.value
    },
    applied: true,
    profileId: profileLabel
  };
};

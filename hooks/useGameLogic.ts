
import { useState, useEffect, useRef } from 'react';
import { GameState, AppSettings, LogEntry, InventoryItem, TavernCommand, ActionOption, Confidant, MemorySystem, MemoryEntry, SaveSlot, Task, ContextModuleConfig, StoryState } from '../types';
import { createNewGameState } from '../utils/dataMapper';
import { computeMaxCarry, computeMaxHp, computeMaxMind, computeMaxStamina } from '../utils/characterMath';
import { generateDungeonMasterResponse, generateWorldInfoResponse, DEFAULT_PROMPT_MODULES, DEFAULT_MEMORY_CONFIG, dispatchAIRequest, generateMemorySummary, extractThinkingBlocks, parseAIResponseText, mergeThinkingSegments, resolveServiceConfig, buildNpcSimulationSnapshots, buildIntersectionHintBlock, generateIntersectionPrecheck, generateNpcBacklineSimulation } from '../utils/ai';
import { P_MEM_S2M, P_MEM_M2L } from '../prompts';
import { Difficulty } from '../types/enums';

type CommandKind = 'EQUIP' | 'UNEQUIP' | 'USE' | 'TOGGLE';

interface CommandItem {
    id: string;
    text: string;
    undoAction?: () => void;
    dedupeKey?: string;
    kind?: CommandKind;
    slotKey?: string;
    itemId?: string;
    itemName?: string;
    quantity?: number;
}

type MemorySummaryPhase = 'preview' | 'processing' | 'result';
type MemorySummaryType = 'S2M' | 'M2L';
interface MemorySummaryState {
    phase: MemorySummaryPhase;
    type: MemorySummaryType;
    entries: MemoryEntry[] | string[];
    summary?: string;
}

interface PendingInteraction {
    input: string;
    contextType: 'ACTION';
    commandsOverride?: string[];
    stateOverride?: GameState;
    logInputOverride?: string;
}

interface IntersectionConfirmState {
    originalInput: string;
    augmentedInput: string;
    commandItems: CommandItem[];
}

const DEFAULT_AI_CONFIG = {
    provider: 'gemini' as const,
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    modelId: 'gemini-3-flash-preview'
};

const DEFAULT_CONTEXT_MODULES: ContextModuleConfig[] = [
    { id: 'm_sys', type: 'SYSTEM_PROMPTS', name: '系统核心设定', enabled: true, order: 0, params: {} },
    { id: 'm_world', type: 'WORLD_CONTEXT', name: '世界动态', enabled: true, order: 1, params: {} },
    { id: 'm_map', type: 'MAP_CONTEXT', name: '地图环境', enabled: true, order: 2, params: { detailLevel: 'medium', alwaysIncludeDungeon: true } },
    { id: 'm_player', type: 'PLAYER_DATA', name: '玩家数据', enabled: true, order: 3, params: {} },
    { id: 'm_social', type: 'SOCIAL_CONTEXT', name: '周边NPC', enabled: true, order: 4, params: { includeAttributes: ['appearance', 'status'], presentMemoryLimit: 30, absentMemoryLimit: 6, specialPresentMemoryLimit: 30, specialAbsentMemoryLimit: 12 } },
    { id: 'm_familia', type: 'FAMILIA_CONTEXT', name: '眷族信息', enabled: true, order: 5, params: {} },
    { id: 'm_inv', type: 'INVENTORY_CONTEXT', name: '背包/战利品', enabled: true, order: 6, params: { detailLevel: 'medium' } },
    { id: 'm_combat', type: 'COMBAT_CONTEXT', name: '战斗数据', enabled: true, order: 8, params: {} }, 
    { id: 'm_task', type: 'TASK_CONTEXT', name: '任务列表', enabled: true, order: 9, params: {} },
    { id: 'm_story', type: 'STORY_CONTEXT', name: '剧情进度', enabled: true, order: 10, params: {} },
    { id: 'm_mem', type: 'MEMORY_CONTEXT', name: '记忆流', enabled: true, order: 11, params: {} },
    { id: 'm_hist', type: 'COMMAND_HISTORY', name: '指令历史', enabled: true, order: 12, params: {} },
    { id: 'm_input', type: 'USER_INPUT', name: '玩家输入', enabled: true, order: 13, params: {} },
];

const DEFAULT_SETTINGS: AppSettings = {
    backgroundImage: '',
    fontSize: 'medium',
    enableActionOptions: true,
    enableStreaming: true,
    enableIntersectionPrecheck: false,
    chatLogLimit: 30,
    promptModules: DEFAULT_PROMPT_MODULES,
    memoryConfig: DEFAULT_MEMORY_CONFIG,
    contextConfig: { modules: DEFAULT_CONTEXT_MODULES },
    aiConfig: {
        mode: 'unified',
        nativeThinkingChain: true,
        unified: { ...DEFAULT_AI_CONFIG },
        services: {
            social: { ...DEFAULT_AI_CONFIG },
            world: { ...DEFAULT_AI_CONFIG },
            npcSync: { ...DEFAULT_AI_CONFIG },
            npcBrain: { ...DEFAULT_AI_CONFIG },
        },
        useServiceOverrides: false,
        serviceOverridesEnabled: {
            social: false,
            world: false,
            npcSync: false,
            npcBrain: false
        },
        multiStageThinking: false
    },
    writingConfig: {
        enableWordCountRequirement: false,
        requiredWordCount: 800,
        enableNarrativePerspective: true,
        narrativePerspective: 'third',
    }
};

const generateNextId = (prefix: string, list: any[]): string => {
    let shortPrefix = prefix;
    if (prefix === 'Inventory' || prefix === 'Item') shortPrefix = 'Itm';
    if (prefix === 'Equipment' || prefix === 'Equip') shortPrefix = 'Eq';
    if (prefix === 'Character' || prefix === 'NPC') shortPrefix = 'Char';
    if (prefix === 'Task') shortPrefix = 'Tsk';
    
    let maxId = 0;
    const regex = new RegExp(`^${shortPrefix}(\\d+)$`);
    list.forEach(item => {
        if (item.id && typeof item.id === 'string') {
            const match = item.id.match(regex);
            if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > maxId) maxId = num;
            }
        }
    });
    return `${shortPrefix}${(maxId + 1).toString().padStart(3, '0')}`;
};

const generateLegacyId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const createStorageSnapshot = (state: GameState): GameState => {
    // Deep clone to ensure all nested objects like Map, Memory, Loot are preserved
    const copy = JSON.parse(JSON.stringify(state));
    
    // Clean logs to save space
    if (copy.日志) {
        copy.日志 = copy.日志.map((l: any) => {
            const { snapshot, rawResponse, ...cleanLog } = l;
            return cleanLog as LogEntry;
        });
    }
    
    // Ensure all critical subsections exist
    if (!copy.地图) copy.地图 = state.地图; // Fallback if deep clone missed something weird (unlikely with JSON.parse)
    if (!copy.战利品) copy.战利品 = [];
    if (!copy.记忆) copy.记忆 = { lastLogIndex: 0, instant: [], shortTerm: [], mediumTerm: [], longTerm: [] };

    return copy;
};

const migrateNpcActionsToTracking = (state: GameState): GameState => {
    if (!state || !Array.isArray(state.社交) || state.社交.length === 0) return state;
    const world = state.世界 || ({} as any);
    const existing = Array.isArray(world.NPC后台跟踪) ? [...world.NPC后台跟踪] : [];
    const existingNames = new Set(existing.map((t: any) => t.NPC));
    let changed = false;
    const nextConfidants = state.社交.map((c: any) => {
        if (c?.当前行动) {
            if (!existingNames.has(c.姓名)) {
                existing.push({
                    NPC: c.姓名,
                    当前行动: c.当前行动,
                    预计完成: undefined,
                    进度: undefined
                });
                existingNames.add(c.姓名);
            }
            const { 当前行动, ...rest } = c;
            changed = true;
            return rest;
        }
        return c;
    });
    if (!changed) return state;
    return {
        ...state,
        社交: nextConfidants,
        世界: {
            ...world,
            NPC后台跟踪: existing
        }
    };
};

const migrateStoryState = (state: GameState): GameState => {
    if (!state?.剧情) return state;
    const story: any = state.剧情;
    if (story.对应原著对应章节 || story.剧情规划 || story.本世界分歧剧情) return state;
    if (!story.主线 && !story.引导 && !story.时间轴 && !story.待触发) return state;

    const volumeLabel = typeof story.主线?.当前卷数 === 'number' ? `第${story.主线.当前卷数}卷` : '未知卷';
    const chapterName = typeof story.主线?.当前篇章 === 'string' && story.主线.当前篇章.trim()
        ? story.主线.当前篇章.trim()
        : '未知章节名';
    const node = typeof story.主线?.关键节点 === 'string' ? story.主线.关键节点.trim() : '';
    const guide = typeof story.引导?.当前目标 === 'string' ? story.引导.当前目标.trim() : '';
    const summary = [node, guide].filter(Boolean).join('；');

    const divergenceNote = typeof story.路线?.分歧说明 === 'string' ? story.路线.分歧说明.trim() : '';
    const divergencePoint = divergenceNote ? (divergenceNote.length > 20 ? divergenceNote.slice(0, 20) : divergenceNote) : '';
    const pending = Array.isArray(story.待触发)
        ? story.待触发.map((evt: any) => ({
            事件: evt?.内容 || '未知事件',
            激活时间: evt?.预计触发 || '未知时间',
            激活条件: evt?.触发条件 || '满足剧情条件'
        }))
        : [];

    const nextStory: StoryState = {
        对应原著对应章节: chapterName ? `${volumeLabel} ${chapterName}` : volumeLabel,
        对应章节名: chapterName,
        原著大概剧情走向: summary || '暂无原著剧情走向记录。',
        本世界分歧剧情: {
            说明: divergenceNote || (story.路线?.是否正史 === false ? '出现显著分歧。' : '暂无分歧说明。'),
            分点: divergencePoint ? [divergencePoint] : [],
            归纳总结: ''
        },
        剧情规划: {
            规划长期剧情走向: typeof story.主线?.当前阶段 === 'string' ? story.主线.当前阶段 : '暂无长期规划。',
            规划中期剧情走向: typeof story.引导?.下一触发 === 'string' ? story.引导.下一触发 : '暂无中期规划。',
            规划短期剧情走向: guide || (typeof story.引导?.行动提示 === 'string' ? story.引导.行动提示 : '暂无短期规划。')
        },
        待激活事件: pending
    };

    return { ...state, 剧情: nextStory };
};

const ensureDerivedStats = (state: GameState): GameState => {
    if (!state?.角色) return state;
    const toNumber = (value: any, fallback = 0) => {
        if (typeof value === 'number' && !Number.isNaN(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        }
        return fallback;
    };
    const normalizeLevel = (value: any) => {
        const parsed = toNumber(value, 1);
        return Math.max(1, Math.floor(parsed));
    };
    const normalizeAbilities = (value?: any) => ({
        力量: toNumber(value?.力量),
        耐久: toNumber(value?.耐久),
        灵巧: toNumber(value?.灵巧),
        敏捷: toNumber(value?.敏捷),
        魔力: toNumber(value?.魔力)
    });
    const baseAbilities = state.角色.隐藏基础能力 || { 力量: 0, 耐久: 0, 灵巧: 0, 敏捷: 0, 魔力: 0 };
    const maxCarry = computeMaxCarry(state.角色);
    const maxHp = computeMaxHp(state.角色);
    const maxMind = computeMaxMind(state.角色);
    const maxStamina = computeMaxStamina(state.角色);
    const nextMap = state.地图;
    const hasBodyParts = !!state.角色.身体部位;
    let nextBodyParts = state.角色.身体部位;
    if (hasBodyParts) {
        const cap = (value: number) => Math.max(1, Math.round(value));
        const mkPart = (ratio: number, current?: number) => {
            const max = cap(maxHp * ratio);
            return { 当前: Math.min(current ?? max, max), 最大: max };
        };
        const b = state.角色.身体部位!;
        nextBodyParts = {
            头部: mkPart(0.15, b.头部?.当前),
            胸部: mkPart(0.30, b.胸部?.当前),
            腹部: mkPart(0.15, b.腹部?.当前),
            左臂: mkPart(0.10, b.左臂?.当前),
            右臂: mkPart(0.10, b.右臂?.当前),
            左腿: mkPart(0.10, b.左腿?.当前),
            右腿: mkPart(0.10, b.右腿?.当前)
        };
    }
    const nextCurrentHp = hasBodyParts
        ? Object.values(nextBodyParts || {}).reduce((sum: number, p: any) => sum + (p?.当前 || 0), 0)
        : Math.min(state.角色.生命值 || maxHp, maxHp);
    const nextSocial = Array.isArray(state.社交)
        ? state.社交.map((confidant: Confidant) => {
            if (!confidant?.是否队友) return confidant;
            const nextLevel = normalizeLevel(confidant.等级);
            const nextAbilities = normalizeAbilities(confidant.能力值);
            const nextHidden = normalizeAbilities(confidant.隐藏基础能力值);
            const derived = {
                等级: nextLevel,
                能力值: nextAbilities,
                隐藏基础能力值: nextHidden
            } as any;
            const nextMaxHp = computeMaxHp(derived);
            const nextMaxMind = computeMaxMind(derived);
            const nextMaxStamina = computeMaxStamina(derived);
            const existingVitals = confidant.生存数值 || ({} as any);
            const nextVitals = {
                当前生命: Math.min(toNumber(existingVitals.当前生命, nextMaxHp), nextMaxHp),
                最大生命: nextMaxHp,
                当前精神: Math.min(toNumber(existingVitals.当前精神, nextMaxMind), nextMaxMind),
                最大精神: nextMaxMind,
                当前体力: Math.min(toNumber(existingVitals.当前体力, nextMaxStamina), nextMaxStamina),
                最大体力: nextMaxStamina
            };
            return {
                ...confidant,
                等级: nextLevel,
                能力值: nextAbilities,
                隐藏基础能力: nextHidden,
                生存数值: nextVitals
            };
        })
        : state.社交;
    return {
        ...state,
        角色: {
            ...state.角色,
            最大负重: maxCarry,
            隐藏基础能力: baseAbilities,
            最大生命值: maxHp,
            生命值: nextCurrentHp,
            最大精神力: maxMind,
            精神力: Math.min(state.角色.精神力 ?? maxMind, maxMind),
            最大体力: maxStamina,
            体力: Math.min(state.角色.体力 ?? maxStamina, maxStamina),
            身体部位: nextBodyParts
        },
        地图: nextMap,
        社交: nextSocial
    };
};

type DurabilityAction = 'attack' | 'skill' | 'magic' | 'guard';

const classifyDurabilityAction = (input: string): DurabilityAction | null => {
    const text = input || '';
    if (text.includes('发动魔法') || text.includes('施放') || text.includes('吟唱')) return 'magic';
    if (text.includes('发动技能') || text.includes('使用技能')) return 'skill';
    if (text.includes('防御姿态') || text.includes('防御') || text.includes('格挡')) return 'guard';
    if (text.includes('攻击') || text.includes('发起攻击') || text.includes('挥砍')) return 'attack';
    return null;
};

const applyDurabilityWear = (state: GameState, action: DurabilityAction): GameState => {
    const inventory = Array.isArray(state.背包) ? state.背包 : [];
    if (inventory.length === 0) return state;

    const equip = state.角色?.装备 || {};
    const weaponTargets = [equip.主手, equip.副手].filter((v: string) => v && v.trim());
    const armorTargets = [equip.头部, equip.身体, equip.手部, equip.腿部, equip.足部].filter((v: string) => v && v.trim());

    const amount = action === 'skill' ? 2 : 1;
    const targets = action === 'guard' ? armorTargets : weaponTargets;
    if (targets.length === 0) return state;

    const nextInventory = inventory.map(item => {
        if (!item || typeof item.名称 !== 'string') return item;
        if (!targets.includes(item.名称)) return item;
        if (typeof item.耐久 !== 'number' || item.耐久 <= 0) return item;
        const nextDurability = Math.max(0, item.耐久 - amount);
        const nextQuality = nextDurability === 0 ? 'Broken' : item.品质;
        return { ...item, 耐久: nextDurability, 品质: nextQuality };
    });

    return { ...state, 背包: nextInventory };
};

export const useGameLogic = (initialState?: GameState, onExitCb?: () => void) => {
    const [gameState, setGameState] = useState<GameState>(() => {
        if (initialState) {
            // Migration
            if (typeof initialState.记忆.lastLogIndex !== 'number') {
                initialState.记忆.lastLogIndex = Math.max(0, initialState.日志.length - 10);
            }
            const migrated = migrateStoryState(migrateNpcActionsToTracking(initialState));
            return ensureDerivedStats(migrated);
        }
        return ensureDerivedStats(migrateNpcActionsToTracking(createNewGameState("Adventurer", "Male", "Human")));
    });

    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [commandQueue, setCommandQueue] = useState<CommandItem[]>([]);
    const [pendingCommands, setPendingCommands] = useState<CommandItem[]>([]);
    const [currentOptions, setCurrentOptions] = useState<ActionOption[]>([]);
    const [lastAIResponse, setLastAIResponse] = useState<string>('');
    const [lastAIThinking, setLastAIThinking] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [draftInput, setDraftInput] = useState<string>('');
    const [snapshotState, setSnapshotState] = useState<GameState | null>(null);
    const [memorySummaryState, setMemorySummaryState] = useState<MemorySummaryState | null>(null);
    const [pendingInteraction, setPendingInteraction] = useState<PendingInteraction | null>(null);
    const [intersectionConfirmState, setIntersectionConfirmState] = useState<IntersectionConfirmState | null>(null);
    const silentUpdateInFlight = useRef(false);
    const lastWorldUpdateRef = useRef<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const savedSettings = localStorage.getItem('danmachi_settings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                const renameMap: Record<string, string> = {
                    'Easy Mode': '难度-轻松',
                    'Normal Mode': '难度-普通',
                    'Hard Mode': '难度-困难',
                    'Hell Mode': '难度-地狱',
                    'Physiology Easy': '生理-轻松',
                    'Physiology Normal': '生理-普通',
                    'Physiology Hard': '生理-困难',
                    'Physiology Hell': '生理-地狱'
                };
                const savedModules = Array.isArray(parsed.promptModules) ? parsed.promptModules : [];
                const savedMap = new Map(savedModules.map((m: any) => [m.id, m]));
                const mergedDefaults = DEFAULT_PROMPT_MODULES.map(def => {
                    const saved = savedMap.get(def.id);
                    if (!saved) return def;
                    const renamed = renameMap[saved.name] ? def.name : saved.name;
                    return { ...def, ...saved, name: renamed };
                });
                const defaultIds = new Set(DEFAULT_PROMPT_MODULES.map(m => m.id));
                const extraModules = savedModules.filter((m: any) => !defaultIds.has(m.id) && m.id !== 'world_if');
                const mergedPromptModules = [...mergedDefaults, ...extraModules];
                let mergedAiConfig = {
                    ...DEFAULT_SETTINGS.aiConfig,
                    ...(parsed.aiConfig || {}),
                    services: {
                        ...DEFAULT_SETTINGS.aiConfig.services,
                        ...(parsed.aiConfig?.services || {})
                    },
                    serviceOverridesEnabled: {
                        ...DEFAULT_SETTINGS.aiConfig.serviceOverridesEnabled,
                        ...(parsed.aiConfig?.serviceOverridesEnabled || {})
                    }
                };
                if (mergedAiConfig.useServiceOverrides === undefined && parsed.aiConfig?.mode === 'separate') {
                    mergedAiConfig = {
                        ...mergedAiConfig,
                        useServiceOverrides: true,
                        serviceOverridesEnabled: {
                            social: true,
                            world: true,
                            npcSync: true,
                            npcBrain: true
                        }
                    };
                }
                setSettings({ ...DEFAULT_SETTINGS, ...parsed, promptModules: mergedPromptModules, aiConfig: mergedAiConfig });
            } catch(e) { console.warn("Settings corrupted"); }
        }
    }, []);

    useEffect(() => {
        if (!gameState.游戏难度) return;
        setSettings(prev => {
            const currentDiff = gameState.游戏难度 || Difficulty.NORMAL;
            let hasChanged = false;
            const newPromptModules = prev.promptModules.map(mod => {
                let shouldBeActive = mod.isActive;
                if (mod.group === '难度系统') {
                    if (currentDiff === Difficulty.EASY && mod.id === 'diff_easy') shouldBeActive = true;
                    else if (currentDiff === Difficulty.NORMAL && mod.id === 'diff_normal') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HARD && mod.id === 'diff_hard') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HELL && mod.id === 'diff_hell') shouldBeActive = true;
                    else shouldBeActive = false;
                }
                if (mod.group === '生理系统') {
                    if (currentDiff === Difficulty.EASY && mod.id === 'phys_easy') shouldBeActive = true;
                    else if (currentDiff === Difficulty.NORMAL && mod.id === 'phys_normal') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HARD && mod.id === 'phys_hard') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HELL && mod.id === 'phys_hell') shouldBeActive = true;
                    else shouldBeActive = false;
                }
                if (mod.group === '判定系统') {
                    if (currentDiff === Difficulty.EASY && mod.id === 'judge_easy') shouldBeActive = true;
                    else if (currentDiff === Difficulty.NORMAL && mod.id === 'judge_normal') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HARD && mod.id === 'judge_hard') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HELL && mod.id === 'judge_hell') shouldBeActive = true;
                    else shouldBeActive = false;
                }
                if (shouldBeActive !== mod.isActive) {
                    hasChanged = true;
                    return { ...mod, isActive: shouldBeActive };
                }
                return mod;
            });
            if (hasChanged) return { ...prev, promptModules: newPromptModules };
            return prev;
        });
    }, [gameState.游戏难度]);

    useEffect(() => {
        if (gameState.回合数 > 1) {
            const slotNum = ((gameState.回合数 - 1) % 3) + 1;
            const saveKey = `danmachi_save_auto_${slotNum}`;
            const optimizedState = createStorageSnapshot(gameState);
            const saveData: SaveSlot = {
                id: `auto_${slotNum}`,
                type: 'AUTO',
                timestamp: Date.now(),
                summary: `AUTO: Lv.${optimizedState.角色.等级} ${optimizedState.当前地点}`,
                data: optimizedState,
                version: '3.0'
            };
            try {
                localStorage.setItem(saveKey, JSON.stringify(saveData));
            } catch (e) { console.error("Auto-save quota exceeded", e); }
        }
    }, [gameState.回合数, gameState.当前地点]);

    const manualSave = (slotId: number | string) => {
        const saveKey = `danmachi_save_manual_${slotId}`;
        const optimizedState = createStorageSnapshot(gameState);
        const saveData: SaveSlot = {
            id: slotId,
            type: 'MANUAL',
            timestamp: Date.now(),
            summary: `MANUAL: Lv.${optimizedState.角色.等级} ${optimizedState.当前地点} ${optimizedState.游戏时间}`,
            data: optimizedState,
            version: '3.0'
        };
        try {
            localStorage.setItem(saveKey, JSON.stringify(saveData));
            console.log(`Saved to ${saveKey}`);
        } catch (e) { alert("保存失败：本地存储空间不足"); }
    };

    const loadGame = (slotId: number | string) => {
        let targetKey = `danmachi_save_manual_${slotId}`;
        if (String(slotId).startsWith('auto')) targetKey = `danmachi_save_${slotId}`;
        const raw = localStorage.getItem(targetKey);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                const state = parsed.data || parsed;
                const migrated = migrateStoryState(migrateNpcActionsToTracking(state));
                setGameState(ensureDerivedStats(migrated));
            } catch(e) { console.error("Load failed", e); }
        }
    };

    const updateStateByPath = (state: any, path: string, value: any, action: string): { success: boolean, error?: string } => {
        let cleanPath = path.startsWith('gameState.') ? path.replace('gameState.', '') : path;
        cleanPath = cleanPath.replace(/^character\./, '角色.');
        cleanPath = cleanPath.replace(/^inventory\./, '背包.');
        cleanPath = cleanPath.replace(/^confidants\./, '社交.');
        cleanPath = cleanPath.replace(/^time/, '游戏时间');
        cleanPath = cleanPath.replace(/^location/, '当前地点');
        const normalizedPath = cleanPath.replace(/\[(\d+)\]/g, '.$1');
        const parts = normalizedPath.split('.');
        let current = state;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (current[part] === undefined || current[part] === null) return { success: false, error: `Invalid path: '${part}' in '${cleanPath}'` };
            current = current[part];
        }
        const lastKey = parts[parts.length - 1];
        try {
            if (action === 'set') current[lastKey] = value;
            else if (action === 'add') {
                const oldVal = current[lastKey] || 0;
                if (typeof oldVal === 'number') current[lastKey] = oldVal + (typeof value === 'number' ? value : parseFloat(value) || 0);
            } else if (action === 'push') {
                if (!Array.isArray(current[lastKey])) {
                    if (current[lastKey] === undefined) current[lastKey] = [];
                    else return { success: false, error: `Target '${lastKey}' is not array` };
                }
                if (lastKey === '背包' || path.includes('inventory') || lastKey === '公共战利品' || lastKey === '战利品') {
                    const newItem = value as InventoryItem;
                    const compItem: InventoryItem = { ...newItem, id: newItem.id, 名称: newItem.名称, 描述: newItem.描述, 数量: newItem.数量 || 1, 类型: newItem.类型 || 'loot' };
                    const existingIdx = current[lastKey].findIndex((i: InventoryItem) => i.名称 === compItem.名称);
                    if (existingIdx >= 0) current[lastKey][existingIdx].数量 += (compItem.数量 || 1);
                    else {
                        if(!compItem.id) compItem.id = generateNextId("Item", current[lastKey]);
                        current[lastKey].push(compItem);
                    }
                } else current[lastKey].push(value);
            } else if (action === 'delete') {
               if (Array.isArray(current) && !isNaN(parseInt(lastKey))) current.splice(parseInt(lastKey), 1);
               else delete current[lastKey];
            }
            return { success: true };
        } catch (e: any) { return { success: false, error: e.message }; }
    };

    const processTavernCommands = (state: GameState, commands: TavernCommand[]): { newState: GameState, logs: LogEntry[] } => {
        let nextState = JSON.parse(JSON.stringify(state)); 
        const systemLogs: LogEntry[] = [];
        if (Array.isArray(commands)) {
            commands.forEach(cmd => {
                try { updateStateByPath(nextState, cmd.key, cmd.value, cmd.action); } catch (e) { console.warn(`Command failed: ${cmd?.action} ${cmd?.key}`, e); }
            });
        }
        if (state.战斗.是否战斗中 && !nextState.战斗.是否战斗中) {
            nextState.战斗.敌方 = null;
            nextState.战斗.战斗记录 = [];
        }
        nextState = ensureDerivedStats(nextState);
        return { newState: nextState, logs: systemLogs };
    };

    const getMemorySummaryRequest = (currentState: GameState): MemorySummaryState | null => {
        const config = settings.memoryConfig || DEFAULT_MEMORY_CONFIG;
        const shortTermLimit = config.shortTermLimit || 0;
        const mediumTermLimit = config.mediumTermLimit || 0;

        if (shortTermLimit > 0 && currentState.记忆.shortTerm.length >= shortTermLimit) {
            return { phase: 'preview', type: 'S2M', entries: [...currentState.记忆.shortTerm] };
        }
        if (mediumTermLimit > 0 && currentState.记忆.mediumTerm.length >= mediumTermLimit) {
            return { phase: 'preview', type: 'M2L', entries: [...currentState.记忆.mediumTerm] };
        }
        return null;
    };

    const isAbortError = (error: any) => {
        if (!error) return false;
        if (error.name === 'AbortError') return true;
        return /abort/i.test(error.message || '');
    };
    const parseGameTimeParts = (input?: string) => {
        if (!input) return null;
        const dayMatch = input.match(/第?(\d+)日/);
        const timeMatch = input.match(/(\d{1,2}):(\d{2})/);
        if (!dayMatch || !timeMatch) return null;
        const day = parseInt(dayMatch[1], 10);
        const hour = parseInt(timeMatch[1], 10);
        const minute = parseInt(timeMatch[2], 10);
        if ([day, hour, minute].some(n => Number.isNaN(n))) return null;
        return { day, hour, minute };
    };

    const parseGameTime = (input?: string) => {
        return gameTimeToMinutes(input);
    };

    const gameTimeToMinutes = (input?: string) => {
        const parts = parseGameTimeParts(input);
        if (!parts) return null;
        return parts.day * 24 * 60 + parts.hour * 60 + parts.minute;
    };

    const formatGameTime = (day: number, hour: number, minute: number) => {
        const h = Math.max(0, Math.min(23, hour));
        const m = Math.max(0, Math.min(59, minute));
        return `第${day}日 ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const advanceDateString = (dateStr: string, dayDelta: number) => {
        if (!dateStr || !dayDelta) return dateStr;
        const parts = dateStr.split('-').map(n => parseInt(n, 10));
        if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return dateStr;
        const [y, m, d] = parts;
        const base = new Date(Date.UTC(y, m - 1, d));
        if (Number.isNaN(base.getTime())) return dateStr;
        base.setUTCDate(base.getUTCDate() + dayDelta);
        const yy = base.getUTCFullYear().toString().padStart(4, '0');
        const mm = (base.getUTCMonth() + 1).toString().padStart(2, '0');
        const dd = base.getUTCDate().toString().padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    };

    const advanceGameTimeByMinutes = (currentTime: string, minutes: number) => {
        const parts = parseGameTimeParts(currentTime);
        if (!parts || !Number.isFinite(minutes)) return { time: currentTime, dayDelta: 0 };
        const total = parts.day * 24 * 60 + parts.hour * 60 + parts.minute + minutes;
        const nextDay = Math.max(1, Math.floor(total / (24 * 60)));
        const remainder = total - nextDay * 24 * 60;
        const hour = Math.floor(remainder / 60);
        const minute = remainder % 60;
        const dayDelta = nextDay - parts.day;
        return { time: formatGameTime(nextDay, hour, minute), dayDelta };
    };
    const handleAIInteraction = async (
        input: string,
        contextType: 'ACTION' = 'ACTION',
        commandsOverride?: string[],
        stateOverride?: GameState,
        skipMemoryCheck: boolean = false,
        logInputOverride?: string
    ) => {
        const baseState = stateOverride || gameState;

        if (!skipMemoryCheck) {
            if (memorySummaryState) {
                setTimeout(() => setDraftInput(input), 0);
                return;
            }
            const summaryRequest = getMemorySummaryRequest(baseState);
            if (summaryRequest) {
                setPendingInteraction({ input, contextType, commandsOverride, stateOverride, logInputOverride });
                setMemorySummaryState(summaryRequest);
                setTimeout(() => setDraftInput(input), 0);
                return;
            }
        }

        if (!stateOverride) setSnapshotState(JSON.parse(JSON.stringify(gameState)));
        const turnIndex = (baseState.回合数 || 1);
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        setIsProcessing(true);
        setLastAIResponse('');
        setLastAIThinking('');
        if (settings.enableStreaming) setIsStreaming(true);
        
        const logText = logInputOverride ?? input;
        const newUserLog: LogEntry = { 
            id: generateLegacyId(), 
            text: logText, 
            sender: 'player', 
            timestamp: Date.now(), 
            turnIndex: turnIndex, 
            snapshot: JSON.stringify(createStorageSnapshot(baseState)), 
            gameTime: baseState.游戏时间 
        };

        const stateWithUserLog = { 
            ...baseState, 
            日志: [...baseState.日志, newUserLog],
            处理中: true 
        };

        setGameState(stateWithUserLog);
        
        try {

            const onStreamChunk = (chunk: string) => {
                const { thinking } = extractThinkingBlocks(chunk);
                setLastAIResponse(chunk);
                if (thinking) setLastAIThinking(thinking);
            };

            const aiResponse = await generateDungeonMasterResponse(
                input, 
                stateWithUserLog, 
                settings, 
                "", 
                commandsOverride || [],
                abortController.signal,
                onStreamChunk
            );
            setLastAIThinking(aiResponse.thinking || '');
            let postState: GameState | null = null;
            setGameState(prev => {
                if (aiResponse.rawResponse) setLastAIResponse(aiResponse.rawResponse);
                if (aiResponse.action_options) setCurrentOptions(aiResponse.action_options || []);

                const responseId = generateLegacyId();
                const responseSnapshot = JSON.stringify(createStorageSnapshot(stateWithUserLog));
                const rawCommands = Array.isArray(aiResponse.tavern_commands) ? aiResponse.tavern_commands : [];
                const commands = rawCommands;
                let logs = Array.isArray(aiResponse.logs) ? aiResponse.logs : [];
                const narrative = aiResponse.narrative || "";
                
                if (logs.length === 0 && !narrative && aiResponse.rawResponse) {
                    logs = [{ sender: "system", text: `(数据解析异常，原始响应):\n${aiResponse.rawResponse}` }];
                }

                let { newState } = processTavernCommands(prev, commands);
                const wearAction = contextType === 'ACTION' ? classifyDurabilityAction(input) : null;
                if (wearAction) {
                    newState = applyDurabilityWear(newState, wearAction);
                }
                const newLogs: LogEntry[] = [];
                const aiLogGameTime = newState.游戏时间;

                // 1-to-1 Mapping: AI generates shortTerm summary for THIS turn
                if (aiResponse.shortTerm) {
                    if (!newState.记忆.shortTerm) newState.记忆.shortTerm = [];
                    newState.记忆.shortTerm.push({
                        content: aiResponse.shortTerm,
                        timestamp: aiLogGameTime,
                        turnIndex: turnIndex
                    });
                } else {
                    // Fallback: Use logs summary if AI forgot to generate shortTerm
                    const fallbackSummary = logs.map(l => l.text).join(' ').substring(0, 100) + "...";
                    newState.记忆.shortTerm.push({
                        content: `[Auto-Gen] ${fallbackSummary}`,
                        timestamp: aiLogGameTime,
                        turnIndex: turnIndex
                    });
                }

                if (logs.length > 0) {
                    logs.forEach((l, idx) => {
                        let sender = l.sender;
                        if (sender === 'narrative' || sender === '旁白' || sender === 'narrator') sender = '旁白';
                        
                        const rawData = aiResponse.rawResponse;
                        const thinking = idx === 0 ? aiResponse.thinking : undefined;
                        const repairNote = idx === 0 ? aiResponse.repairNote : undefined;

                        newLogs.push({ 
                            id: generateLegacyId(), 
                            text: l.text, 
                            sender: sender, 
                            timestamp: Date.now() + idx, 
                            turnIndex, 
                            gameTime: aiLogGameTime,
                            rawResponse: rawData,
                            thinking,
                            repairNote,
                            responseId,
                            snapshot: responseSnapshot
                        });
                    });
                } else if (narrative) {
                     newLogs.push({ 
                         id: generateLegacyId(), 
                         text: narrative, 
                         sender: '旁白', 
                         timestamp: Date.now(), 
                         turnIndex, 
                         gameTime: aiLogGameTime,
                         rawResponse: aiResponse.rawResponse,
                         thinking: aiResponse.thinking,
                         repairNote: aiResponse.repairNote,
                         responseId,
                         snapshot: responseSnapshot
                     });
                }
                
                newState.日志 = [...newState.日志, ...newLogs];
                newState.处理中 = false;
                newState.回合数 = (prev.回合数 || 1) + 1;
                postState = newState;
                return newState;
            });
            if (postState) runNpcBacklineSimulation(postState);
        } catch (error: any) {
            if (isAbortError(error)) {
                setGameState(prev => ({ ...prev, 处理中: false }));
            } else {
                console.error("Interaction failed:", error);
                setGameState(prev => ({ 
                    ...prev, 
                    处理中: false, 
                    日志: [...prev.日志, { id: generateLegacyId(), text: `Error: ${error.message}`, sender: 'system', timestamp: Date.now() }] 
                }));
            }
        } finally {
            setIsProcessing(false);
            setIsStreaming(false);
            clearPendingCommands();
            abortControllerRef.current = null;
        }
    };

    const normalizeSummaryText = (summaryText: string): string => {
        if (!summaryText) return summaryText;
        let cleaned = summaryText.trim();
        if (!cleaned) return summaryText;
        if (cleaned.includes('```')) {
            cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim();
        }
        const tryParse = (value: string) => {
            try { return JSON.parse(value); } catch { return null; }
        };
        const parsed = /^[\[{]/.test(cleaned) ? tryParse(cleaned) : null;
        if (parsed) {
            if (typeof parsed === 'string') return parsed.trim();
            if (Array.isArray(parsed)) {
                const joined = parsed.filter(v => typeof v === 'string').join('\n').trim();
                if (joined) return joined;
            }
            if (typeof parsed === 'object') {
                const candidates = ['summary', 'content', 'text', 'result', 'value'];
                for (const key of candidates) {
                    const val = (parsed as any)[key];
                    if (typeof val === 'string' && val.trim()) return val.trim();
                }
                const values = Object.values(parsed).filter(v => typeof v === 'string') as string[];
                const joined = values.join('\n').trim();
                if (joined) return joined;
            }
        }
        return cleaned;
    };

    const confirmMemorySummary = async () => {
        if (!memorySummaryState || memorySummaryState.phase !== 'preview') return;
        setMemorySummaryState({ ...memorySummaryState, phase: 'processing' });

        try {
            let fakeLogs: LogEntry[] = [];
            if (memorySummaryState.type === 'S2M') {
                fakeLogs = (memorySummaryState.entries as MemoryEntry[]).map(m => ({
                    text: m.content,
                    sender: 'Memory',
                    id: '',
                    timestamp: 0
                } as LogEntry));
            } else {
                fakeLogs = (memorySummaryState.entries as string[]).map(text => ({
                    text,
                    sender: 'Memory',
                    id: '',
                    timestamp: 0
                } as LogEntry));
            }

            const summaryText = await generateMemorySummary(fakeLogs, memorySummaryState.type, settings);
            const normalizedSummary = normalizeSummaryText(summaryText);
            setMemorySummaryState({ ...memorySummaryState, phase: 'result', summary: normalizedSummary });
        } catch (e) {
            setMemorySummaryState({ ...memorySummaryState, phase: 'result', summary: '总结失败，请重试或手动编辑。' });
        }
    };

    const applyMemorySummary = (summaryText: string) => {
        if (!memorySummaryState) return;
        const finalSummary = normalizeSummaryText(summaryText);

        let nextState: GameState | null = null;
        setGameState(prev => {
            const nextMemory = { ...prev.记忆 };
            if (memorySummaryState.type === 'S2M') {
                nextMemory.shortTerm = [];
                nextMemory.mediumTerm = [...nextMemory.mediumTerm, finalSummary];
            } else {
                nextMemory.mediumTerm = [];
                nextMemory.longTerm = [...nextMemory.longTerm, finalSummary];
            }
            nextState = { ...prev, 记忆: nextMemory };
            return nextState;
        });

        if (!nextState) return;

        const followup = getMemorySummaryRequest(nextState);
        if (followup) {
            setMemorySummaryState(followup);
            return;
        }

        setMemorySummaryState(null);
        const pending = pendingInteraction;
        setPendingInteraction(null);
        if (pending) {
            setDraftInput('');
            handleAIInteraction(
                pending.input,
                pending.contextType,
                pending.commandsOverride,
                nextState,
                true,
                pending.logInputOverride
            );
        }
    };

    const cancelMemorySummary = () => {
        setMemorySummaryState(null);
        setPendingInteraction(null);
    };

    const updateConfidant = (id: string, updates: Partial<Confidant>) => {
        setGameState(prev => ({ ...prev, 社交: prev.社交.map(c => c.id === id ? { ...c, ...updates } : c) }));
    };
    const updateMemory = (newMem: MemorySystem) => setGameState(prev => ({ ...prev, 记忆: newMem }));

    const addToQueue = (
        cmd: string,
        undoAction?: () => void,
        dedupeKey?: string,
        meta?: Partial<CommandItem>
    ) => {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const nextItem: CommandItem = { id, text: cmd, undoAction, dedupeKey, ...meta };
        setCommandQueue(prev => {
            if (dedupeKey) {
                const existingIdx = prev.findIndex(c => c.dedupeKey === dedupeKey);
                if (existingIdx >= 0) {
                    return prev.filter((_, i) => i !== existingIdx);
                }
            }

            if ((nextItem.kind === 'EQUIP' || nextItem.kind === 'UNEQUIP') && nextItem.slotKey) {
                const conflictIdx = prev.findIndex(c =>
                    (c.kind === 'EQUIP' || c.kind === 'UNEQUIP') &&
                    c.slotKey === nextItem.slotKey &&
                    c.kind !== nextItem.kind
                );
                if (conflictIdx >= 0) {
                    return prev.filter((_, i) => i !== conflictIdx);
                }
            }

            return [...prev, nextItem];
        });
    };

    const removeFromQueue = (id: string) => setCommandQueue(prev => prev.filter(c => c.id !== id));
    const clearPendingCommands = () => setPendingCommands([]);
    const consumeCommandQueue = (): CommandItem[] => {
        if (commandQueue.length === 0) return [];
        const current = [...commandQueue];
        setPendingCommands(current);
        setCommandQueue([]);
        return current;
    };
    const consumeSpecificCommands = (commands: CommandItem[]): CommandItem[] => {
        if (!commands || commands.length === 0) return [];
        const ids = new Set(commands.map(c => c.id));
        setPendingCommands(commands);
        setCommandQueue(prev => prev.filter(c => !ids.has(c.id)));
        return commands;
    };
    const buildCommandBlock = (payload: string[]) => (
        payload.length > 0 ? `[用户指令]\n${payload.join('\n')}\n[/用户指令]\n` : ''
    );
    const stopInteraction = () => { 
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsProcessing(false); 
        setIsStreaming(false); 
        setGameState(prev => ({ ...prev, 处理中: false }));
        clearPendingCommands(); 
    };
    const handlePlayerInput = async (text: string) => {
        if (isProcessing) return;
        const commandItems = [...commandQueue];
        if (settings.enableIntersectionPrecheck === true) {
            try {
                const augmented = await buildIntersectionAugmentedInput(text);
                if (augmented) {
                    setIntersectionConfirmState({
                        originalInput: text,
                        augmentedInput: augmented,
                        commandItems
                    });
                    setDraftInput(text);
                    return;
                }
            } catch (e) {
                setDraftInput(text);
            }
        }
        sendPlayerInputWithCommands(text, commandItems, text);
    };
    const confirmIntersectionSend = (finalInput: string) => {
        if (!intersectionConfirmState) return;
        const { commandItems } = intersectionConfirmState;
        setIntersectionConfirmState(null);
        setDraftInput('');
        sendPlayerInputWithCommands(finalInput, commandItems, finalInput);
    };
    const cancelIntersectionConfirm = () => {
        if (intersectionConfirmState?.originalInput) {
            setDraftInput(intersectionConfirmState.originalInput);
        }
        setIntersectionConfirmState(null);
    };
    const handleSilentWorldUpdate = async () => {
        await handleWorldInfoUpdate('世界情报静默更新', gameState);
    };

    const sendPlayerInputWithCommands = (
        inputText: string,
        commandItems: CommandItem[],
        logInputOverride?: string
    ) => {
        const commandPayload = commandItems.map(c => c.text);
        const commandBlock = buildCommandBlock(commandPayload);
        const aiInput = commandBlock ? `${commandBlock}${inputText}` : inputText;
        if (commandItems.length > 0) consumeSpecificCommands(commandItems);
        handleAIInteraction(aiInput, 'ACTION', commandPayload, undefined, false, logInputOverride ?? inputText);
    };

    const buildIntersectionAugmentedInput = async (inputText: string): Promise<string | null> => {
        const snapshots = buildNpcSimulationSnapshots(gameState);
        if (snapshots.length === 0) return null;
        const localBlock = buildIntersectionHintBlock(inputText, snapshots);
        const localAugmented = localBlock ? `${inputText}\n\n${localBlock}` : inputText;
        const precheck = await generateIntersectionPrecheck(inputText, snapshots, settings);
        let augmented = precheck?.augmentedInput || localAugmented;
        if (precheck?.augmentedInput && precheck.augmentedInput.trim() === inputText.trim() && localBlock) {
            augmented = localAugmented;
        }
        if (precheck?.augmentedInput && !precheck.augmentedInput.includes(inputText)) {
            augmented = `${inputText}\n\n${precheck.augmentedInput}`;
        }
        const normalized = augmented.trim();
        if (!normalized || normalized === inputText.trim()) return null;
        return augmented;
    };

    const runNpcBacklineSimulation = async (baseState: GameState) => {
        if (!baseState || !Array.isArray(baseState.社交) || baseState.社交.length === 0) return;
        const updates = await generateNpcBacklineSimulation(baseState, settings);
        if (!updates) return;
        setGameState(prev => {
            if (prev.回合数 !== baseState.回合数) return prev;
            return {
                ...prev,
                世界: {
                    ...prev.世界,
                    NPC后台跟踪: updates
                }
            };
        });
    };

    useEffect(() => {
        const nowValue = parseGameTime(gameState.游戏时间);
        const nextValue = parseGameTime(gameState.世界?.下次更新);
        if (nowValue === null || nextValue === null) return;
        const key = gameState.世界?.下次更新 || '';
        if (nowValue >= nextValue && lastWorldUpdateRef.current !== key) {
            lastWorldUpdateRef.current = key;
            handleSilentWorldUpdate();
        }
    }, [gameState.游戏时间, gameState.世界?.下次更新]);
    const handlePlayerAction = async (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => {
        if (isProcessing) return;
        let input = "";
        const targetName = payload?.targetName ? `【${payload.targetName}】` : "";
        switch (action) {
            case 'attack': input = targetName ? `我攻击${targetName}。` : "我发起攻击。"; break;
            case 'guard': input = targetName ? `我对${targetName}保持防御姿态。` : "我采取防御姿态。"; break;
            case 'escape': input = "我尝试逃跑！"; break;
            case 'talk': input = `(自由行动) ${payload}`; break;
            case 'skill': {
                const isMagic = payload?.__kind === 'MAGIC';
                const actionLabel = isMagic ? '魔法' : '技能';
                input = `我发动${actionLabel}【${payload?.名称 || 'Unknown'}】${targetName ? `，目标${targetName}` : ""}。`;
                break;
            }
            case 'item': input = `我使用道具【${payload?.名称 || 'Unknown'}】。`; break;
        }
        if (input) {
            handleAIInteraction(input, 'ACTION', undefined, undefined, false, input);
        }
    };
    const saveSettings = (newSettings: AppSettings) => { setSettings(newSettings); localStorage.setItem('danmachi_settings', JSON.stringify(newSettings)); };
    const handleReroll = () => {
        if (isProcessing) return;
        const logs = gameState.日志;
        if (logs.length === 0) return;
        let lastPlayerIndex = -1;
        for (let i = logs.length - 1; i >= 0; i--) { if (logs[i].sender === 'player') { lastPlayerIndex = i; break; } }
        if (lastPlayerIndex === -1) return;
        const lastLog = logs[lastPlayerIndex];
        let stateToUse = gameState;
        if (lastLog.snapshot) { try { stateToUse = JSON.parse(lastLog.snapshot); } catch (e) { stateToUse = { ...gameState, 日志: logs.slice(0, lastPlayerIndex) }; } }
        else { stateToUse = { ...gameState, 日志: logs.slice(0, lastPlayerIndex) }; }
        handleAIInteraction(lastLog.text, 'ACTION', [], stateToUse);
    };
    const applyAiResponseToState = (
        state: GameState,
        response: any,
        turnIndex: number,
        logsForResponse: LogEntry[]
    ) => {
        const rawCommands = Array.isArray(response?.tavern_commands) ? response.tavern_commands : [];
        const commands = rawCommands;
        const { newState } = processTavernCommands(state, commands);
        const aiLogGameTime = newState.游戏时间;

        if (!newState.记忆.shortTerm) newState.记忆.shortTerm = [];
        if (response?.shortTerm) {
            newState.记忆.shortTerm.push({
                content: response.shortTerm,
                timestamp: aiLogGameTime,
                turnIndex
            });
        } else {
            const fallbackSummary = logsForResponse.map(l => l.text).join(' ').substring(0, 100) + "...";
            newState.记忆.shortTerm.push({
                content: `[Auto-Gen] ${fallbackSummary}`,
                timestamp: aiLogGameTime,
                turnIndex
            });
        }

        newState.处理中 = false;
        newState.回合数 = (state.回合数 || 1) + 1;
        return newState;
    };

    const handleEditLog = (logId: string, newRawResponse: string) => {
        setGameState(prev => {
            const targetIndex = prev.日志.findIndex(l => l.id === logId);
            if (targetIndex === -1) return prev;
            const targetLog = prev.日志[targetIndex];
            const responseId = targetLog.responseId;
            const snapshot = targetLog.snapshot;

            if (!responseId || !snapshot) {
                return { 
                    ...prev, 
                    日志: prev.日志.map(l => l.id === logId ? { ...l, rawResponse: newRawResponse } : l) 
                };
            }

            const parsedResult = parseAIResponseText(newRawResponse);
            if (!parsedResult.response) {
                console.error("AI JSON Parse Error (Edit)", parsedResult.error);
                return { 
                    ...prev, 
                    日志: prev.日志.map(l => l.id === logId ? { ...l, rawResponse: newRawResponse } : l) 
                };
            }

            let baseState: GameState;
            try {
                baseState = JSON.parse(snapshot);
            } catch (e) {
                console.warn("Invalid snapshot for log edit.");
                return { 
                    ...prev, 
                    日志: prev.日志.map(l => l.id === logId ? { ...l, rawResponse: newRawResponse } : l) 
                };
            }

            const groupIndices = prev.日志
                .map((l, idx) => (l.responseId === responseId ? idx : -1))
                .filter(idx => idx >= 0);
            if (groupIndices.length === 0) {
                return { 
                    ...prev, 
                    日志: prev.日志.map(l => l.id === logId ? { ...l, rawResponse: newRawResponse } : l) 
                };
            }

            const start = groupIndices[0];
            const end = groupIndices[groupIndices.length - 1];
            const beforeLogs = prev.日志.slice(0, start);
            const afterLogs = prev.日志.slice(end + 1);

            const normalizedLogs = Array.isArray(parsedResult.response.logs) ? parsedResult.response.logs : [];
            const narrative = parsedResult.response.narrative || "";
            const fallbackLogs = prev.日志.slice(start, end + 1);
            const sourceLogs = normalizedLogs.length > 0
                ? normalizedLogs
                : (narrative ? [{ sender: '旁白', text: narrative }] : fallbackLogs.map(l => ({ sender: l.sender, text: l.text })));

            const turnIndex = typeof targetLog.turnIndex === 'number' ? targetLog.turnIndex : (baseState.回合数 || 0);
            const aiLogGameTime = baseState.游戏时间;
            const parsedThinking = mergeThinkingSegments(parsedResult.response);
            const parsedRepairNote = parsedResult.repairNote;
            const newLogsForResponse: LogEntry[] = sourceLogs.map((l, idx) => {
                let sender = l.sender;
                if (sender === 'narrative' || sender === '旁白' || sender === 'narrator') sender = '旁白';
                return {
                    id: generateLegacyId(),
                    text: l.text,
                    sender,
                    timestamp: Date.now() + idx,
                    turnIndex,
                    gameTime: aiLogGameTime,
                    rawResponse: newRawResponse,
                    thinking: idx === 0 ? parsedThinking : undefined,
                    repairNote: idx === 0 ? parsedRepairNote : undefined,
                    responseId,
                    snapshot,
                };
            });

            const updatedLogs = [...beforeLogs, ...newLogsForResponse, ...afterLogs];

            const responseOrder: string[] = [];
            for (let i = beforeLogs.length; i < updatedLogs.length; i++) {
                const rid = updatedLogs[i].responseId;
                if (rid && !responseOrder.includes(rid)) responseOrder.push(rid);
            }

            let recalculatedState = { ...baseState };
            responseOrder.forEach((rid) => {
                const groupLogs = updatedLogs.filter(l => l.responseId === rid);
                const raw = groupLogs[0]?.rawResponse || "";
                if (!raw) return;
                const parsed = parseAIResponseText(raw);
                if (!parsed.response) return;
                const responseTurn = typeof groupLogs[0]?.turnIndex === 'number'
                    ? groupLogs[0].turnIndex as number
                    : (recalculatedState.回合数 || 0);
                recalculatedState = applyAiResponseToState(recalculatedState, parsed.response, responseTurn, groupLogs);
            });

            recalculatedState.日志 = updatedLogs;
            recalculatedState.处理中 = false;

            return recalculatedState;
        });
    };
    const handleDeleteLog = (logId: string) => setGameState(prev => ({ ...prev, 日志: prev.日志.filter(l => l.id !== logId) }));
    const handleUpdateLogText = (logId: string, newText: string) => setGameState(prev => ({ ...prev, 日志: prev.日志.map(l => l.id === logId ? { ...l, text: newText } : l) }));
    const handleEditUserLog = handleUpdateLogText;
    const handleUserRewrite = (logId: string, newText: string) => {
        const log = gameState.日志.find(l => l.id === logId);
        if (!log || !log.snapshot) { alert("无法回溯此节点 (缺少快照)"); return; }
        try {
            const restoredState = JSON.parse(log.snapshot);
            handleAIInteraction(newText, 'ACTION', [], restoredState);
        } catch (e) { console.error("Rewrite failed", e); }
    };
    const handleDeleteTask = (taskId: string) => {
        setGameState(prev => ({ ...prev, 任务: prev.任务.filter(t => t.id !== taskId) }));
    };
    const handleUpdateTaskStatus = (taskId: string, status: Task['状态'], note?: string) => {
        if (!taskId) return;
        setGameState(prev => {
            const nowTime = prev.游戏时间 || '未知';
            const nextTasks = (prev.任务 || []).map(task => {
                if (task.id !== taskId) return task;
                const nextLogs = Array.isArray(task.日志) ? [...task.日志] : [];
                if (note && note.trim()) {
                    nextLogs.push({ 时间戳: nowTime, 内容: note.trim() });
                }
                return {
                    ...task,
                    状态: status,
                    结束时间: status === 'active' ? undefined : nowTime,
                    日志: nextLogs
                };
            });
            return { ...prev, 任务: nextTasks };
        });
    };
    const handleUpdateStory = (patch: Partial<StoryState>, milestoneNote?: string) => {
        if (!patch && !milestoneNote) return;
        setGameState(prev => {
            const current = prev.剧情 || ({} as StoryState);
            const nextDivergence = {
                说明: current.本世界分歧剧情?.说明 || '',
                分点: Array.isArray(current.本世界分歧剧情?.分点) ? [...current.本世界分歧剧情!.分点] : [],
                归纳总结: current.本世界分歧剧情?.归纳总结 || ''
            };
            const nextPlan = {
                规划长期剧情走向: current.剧情规划?.规划长期剧情走向 || '',
                规划中期剧情走向: current.剧情规划?.规划中期剧情走向 || '',
                规划短期剧情走向: current.剧情规划?.规划短期剧情走向 || ''
            };
            const nextStory: StoryState = {
                ...current,
                ...patch,
                本世界分歧剧情: { ...nextDivergence, ...(patch?.本世界分歧剧情 || {}) },
                剧情规划: { ...nextPlan, ...(patch?.剧情规划 || {}) },
                待激活事件: patch?.待激活事件 ?? current.待激活事件
            };
            if (milestoneNote && milestoneNote.trim()) {
                const note = milestoneNote.trim();
                if (note.length <= 20) {
                    const points = Array.isArray(nextStory.本世界分歧剧情.分点)
                        ? [...nextStory.本世界分歧剧情.分点, note]
                        : [note];
                    nextStory.本世界分歧剧情 = { ...nextStory.本世界分歧剧情, 分点: points };
                } else {
                    const prefix = nextStory.本世界分歧剧情.说明 ? '\n' : '';
                    nextStory.本世界分歧剧情 = {
                        ...nextStory.本世界分歧剧情,
                        说明: `${nextStory.本世界分歧剧情.说明}${prefix}补充: ${note}`
                    };
                }
            }
            return { ...prev, 剧情: nextStory };
        });
    };
    const handleCompleteStoryStage = (milestoneNote?: string) => {
        setGameState(prev => {
            const current = prev.剧情 || ({} as StoryState);
            const plan = current.剧情规划 || {
                规划长期剧情走向: '',
                规划中期剧情走向: '',
                规划短期剧情走向: ''
            };
            const noteMarker = '【手动推进】当前阶段已完成，请规划下一阶段';
            const existing = (plan.规划短期剧情走向 || '').trim();
            let nextShort = existing.includes('手动推进')
                ? existing
                : (existing ? `${existing}\n${noteMarker}` : noteMarker);
            if (milestoneNote && milestoneNote.trim()) {
                nextShort = `${nextShort}\n完成记录：${milestoneNote.trim()}`;
            }
            const nextStory: StoryState = {
                ...current,
                剧情规划: { ...plan, 规划短期剧情走向: nextShort }
            };
            return { ...prev, 剧情: nextStory };
        });
    };

    return {
        gameState, setGameState, settings, setSettings,
        commandQueue, pendingCommands, addToQueue, removeFromQueue, currentOptions, lastAIResponse, lastAIThinking, isProcessing, isStreaming, draftInput, setDraftInput,
        memorySummaryState, confirmMemorySummary, applyMemorySummary, cancelMemorySummary,
        handleAIInteraction, stopInteraction, handlePlayerAction, handlePlayerInput, handleSilentWorldUpdate, saveSettings, manualSave, loadGame, updateConfidant, updateMemory,
        handleReroll, handleEditLog, handleDeleteLog, handleEditUserLog, handleUpdateLogText, handleUserRewrite, handleDeleteTask, handleUpdateTaskStatus, handleUpdateStory, handleCompleteStoryStage,
        intersectionConfirmState, confirmIntersectionSend, cancelIntersectionConfirm,
    };
};







import { useState, useEffect, useRef } from 'react';
import { GameState, AppSettings, LogEntry, InventoryItem, TavernCommand, ActionOption, PhoneMessage, PhoneThread, PhonePendingMessage, Confidant, MemorySystem, MemoryEntry, SaveSlot, Task, ContextModuleConfig, PhonePost, PhoneAIResponse, StoryState, StoryMilestone } from '../types';
import { createNewGameState } from '../utils/dataMapper';
import { computeMaxCarry, computeMaxHp, computeMaxMind, computeMaxStamina } from '../utils/characterMath';
import { generateDungeonMasterResponse, generatePhoneResponse, generateWorldInfoResponse, DEFAULT_PROMPT_MODULES, DEFAULT_MEMORY_CONFIG, dispatchAIRequest, generateMemorySummary, extractThinkingBlocks, parseAIResponseText, mergeThinkingSegments, resolveServiceConfig } from '../utils/ai';
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
type PendingPhoneOpType = 'send' | 'wait' | 'moment' | 'forum';

interface PendingPhoneOp {
    id: string;
    type: PendingPhoneOpType;
    threadId?: string;
    threadTitle?: string;
    threadType?: 'private' | 'group' | 'public';
    members?: string[];
    content?: string;
    imageDesc?: string;
    topic?: string;
    messageId?: string;
    otherParty?: string;
    postId?: string;
}

interface MemorySummaryState {
    phase: MemorySummaryPhase;
    type: MemorySummaryType;
    entries: MemoryEntry[] | string[];
    summary?: string;
}

interface PendingInteraction {
    input: string;
    contextType: 'ACTION' | 'PHONE';
    commandsOverride?: string[];
    stateOverride?: GameState;
    logInputOverride?: string;
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
    { id: 'm_phone', type: 'PHONE_CONTEXT', name: '手机/消息', enabled: true, order: 7, params: { perThreadLimit: 10, includeMoments: true, momentLimit: 6, includePublicPosts: true, forumLimit: 6 } },
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
            phone: { ...DEFAULT_AI_CONFIG },
        },
        useServiceOverrides: false,
        serviceOverridesEnabled: {
            social: false,
            world: false,
            npcSync: false,
            npcBrain: false,
            phone: false
        },
        enablePhoneSyncPlan: true,
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
                    位置: c.位置详情,
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
            const nextHidden = normalizeAbilities(confidant.隐藏基础能力);
            const derived = {
                等级: nextLevel,
                能力值: nextAbilities,
                隐藏基础能力: nextHidden
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
            return ensureDerivedStats(migrateNpcActionsToTracking(initialState));
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
    const [isPhoneProcessing, setIsPhoneProcessing] = useState(false);
    const [phoneProcessingThreadId, setPhoneProcessingThreadId] = useState<string | null>(null);
    const [phoneProcessingScope, setPhoneProcessingScope] = useState<'chat' | 'moment' | 'forum' | 'sync' | 'auto' | 'manual' | null>(null);
    const [draftInput, setDraftInput] = useState<string>('');
    const [snapshotState, setSnapshotState] = useState<GameState | null>(null);
    const [memorySummaryState, setMemorySummaryState] = useState<MemorySummaryState | null>(null);
    const [pendingInteraction, setPendingInteraction] = useState<PendingInteraction | null>(null);
    const [phoneNotifications, setPhoneNotifications] = useState<{ id: string; title: string; message: string }[]>([]);
    const silentUpdateInFlight = useRef(false);
    const lastWorldUpdateRef = useRef<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const phoneAbortControllerRef = useRef<AbortController | null>(null);
    const phoneSummaryInFlight = useRef<Set<string>>(new Set());
    const phoneAutoPlanInFlight = useRef(false);
    const phoneSyncPlanInFlight = useRef(false);
    const pendingPhoneNarrativeRef = useRef<string[]>([]);
    const pendingPhoneOpsRef = useRef<PendingPhoneOp[]>([]);
    const phoneFlushInFlight = useRef(false);

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
                            npcBrain: true,
                            phone: true
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
                setGameState(ensureDerivedStats(state));
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
    const normalizePhoneSyncPlanValue = (value: any) => {
        if (!value) return null;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (!trimmed) return null;
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try { return JSON.parse(trimmed); } catch { return value; }
            }
            return value;
        }
        return value;
    };
    const extractPhoneSyncPlanFromRaw = (raw: string) => {
        if (!raw) return null;
        const keyIndex = raw.indexOf('"phone_sync_plan"');
        if (keyIndex === -1) return null;
        let i = raw.indexOf(':', keyIndex);
        if (i === -1) return null;
        i += 1;
        while (i < raw.length && /\s/.test(raw[i])) i += 1;
        if (i >= raw.length) return null;
        const startCh = raw[i];
        if (startCh === '"') {
            let j = i + 1;
            let escaped = false;
            for (; j < raw.length; j++) {
                const ch = raw[j];
                if (escaped) { escaped = false; continue; }
                if (ch === '\\') { escaped = true; continue; }
                if (ch === '"') break;
            }
            const slice = raw.slice(i, j + 1);
            try { return JSON.parse(slice); } catch { return null; }
        }
        if (startCh === '{' || startCh === '[') {
            let depth = 0;
            let inString = false;
            let escaped = false;
            for (let j = i; j < raw.length; j++) {
                const ch = raw[j];
                if (escaped) { escaped = false; continue; }
                if (ch === '\\') { if (inString) escaped = true; continue; }
                if (ch === '"') { inString = !inString; continue; }
                if (inString) continue;
                if (ch === '{' || ch === '[') depth += 1;
                if (ch === '}' || ch === ']') {
                    depth -= 1;
                    if (depth === 0) {
                        const slice = raw.slice(i, j + 1);
                        try { return JSON.parse(slice); } catch { return null; }
                    }
                }
            }
            return null;
        }
        const endIdx = raw.slice(i).search(/,\s*\"|}\s*$/);
        const slice = endIdx === -1 ? raw.slice(i) : raw.slice(i, i + endIdx);
        try { return JSON.parse(slice.trim()); } catch { return slice.trim(); }
    };
    const resolvePhoneSyncPlan = (response?: any) => {
        if (!response) return null;
        const direct = normalizePhoneSyncPlanValue(response?.phone_sync_plan);
        if (direct) return direct;
        const raw = typeof response?.rawResponse === 'string' ? response.rawResponse : '';
        if (!raw || !raw.includes('phone_sync_plan')) return null;
        const parsed = parseAIResponseText(raw);
        const parsedPlan = normalizePhoneSyncPlanValue(parsed.response?.phone_sync_plan);
        if (parsedPlan) return parsedPlan;
        return normalizePhoneSyncPlanValue(extractPhoneSyncPlanFromRaw(raw)) || null;
    };
    const shouldUsePhoneSyncPlan = (response?: any) => {
        return canQueuePhoneSyncPlan(settings) && !!resolvePhoneSyncPlan(response);
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

    const ensurePhoneStateBase = (state: GameState) => {
        if (!state.手机) return state;
        const phone = state.手机;
        if (!phone.待发送) phone.待发送 = [];
        if (!phone.同步规划) phone.同步规划 = [];
        if (!phone.自动规划) {
            phone.自动规划 = { 上次规划: state.游戏时间 || '未知', 记录: [] };
        }
        if (!phone.自动规划.记录) phone.自动规划.记录 = [];
        if (!phone.自动规划.上次规划 && state.游戏时间) {
            phone.自动规划.上次规划 = state.游戏时间;
        }
        return state;
    };

    const recordPhoneNarrativeHint = (text: string) => {
        if (!text) return;
        const trimmed = text.trim();
        if (!trimmed) return;
        const current = pendingPhoneNarrativeRef.current || [];
        const next = [...current, trimmed];
        pendingPhoneNarrativeRef.current = next.slice(-5);
    };

    const consumePhoneNarrativePrefix = () => {
        const current = pendingPhoneNarrativeRef.current || [];
        if (current.length === 0) return '';
        const seen = new Set<string>();
        const unique = current.filter(item => {
            if (seen.has(item)) return false;
            seen.add(item);
            return true;
        });
        pendingPhoneNarrativeRef.current = [];
        return `【手机操作摘要】${unique.join('；')}\n`;
    };

    const enqueuePhoneOp = (op: PendingPhoneOp) => {
        pendingPhoneOpsRef.current = [...(pendingPhoneOpsRef.current || []), op];
    };

    const updatePhoneMessageStatus = (state: GameState, threadId: string | undefined, messageId: string | undefined, status: PhoneMessage['状态']) => {
        if (!state.手机 || !threadId || !messageId) return state;
        const updateThread = (t: PhoneThread) => {
            if (t.id !== threadId) return t;
            return {
                ...t,
                消息: (t.消息 || []).map(m => m.id === messageId ? { ...m, 状态: status } : m)
            };
        };
        return {
            ...state,
            手机: {
                ...state.手机,
                对话: {
                    私聊: (state.手机.对话?.私聊 || []).map(updateThread),
                    群聊: (state.手机.对话?.群聊 || []).map(updateThread),
                    公共频道: (state.手机.对话?.公共频道 || []).map(updateThread),
                }
            }
        };
    };

    const removePhonePost = (state: GameState, postId?: string, bucket: '朋友圈' | '公共帖子' = '朋友圈') => {
        if (!state.手机 || !postId) return state;
        if (bucket === '朋友圈') {
            const nextPosts = (state.手机.朋友圈?.帖子 || []).filter(p => p.id !== postId);
            return {
                ...state,
                手机: {
                    ...state.手机,
                    朋友圈: {
                        ...(state.手机.朋友圈 || {}),
                        帖子: nextPosts
                    }
                }
            };
        }
        const nextForum = (state.手机.公共帖子?.帖子 || []).filter(p => p.id !== postId);
        return {
            ...state,
            手机: {
                ...state.手机,
                公共帖子: {
                    ...(state.手机.公共帖子 || {}),
                    帖子: nextForum
                }
            }
        };
    };

    const phoneBaseNeeded = !!gameState.手机 && (
        !gameState.手机.待发送
        || !gameState.手机.自动规划
        || !Array.isArray(gameState.手机.自动规划?.记录)
        || !gameState.手机.自动规划?.上次规划
        || !gameState.手机.同步规划
    );

    useEffect(() => {
        if (!phoneBaseNeeded) return;
        setGameState(prev => ensurePhoneStateBase({ ...prev, 手机: { ...prev.手机 } }));
    }, [phoneBaseNeeded]);

    const isPhoneLocallyAvailable = (state: GameState) => {
        const hasMagicPhone = (state.背包 || []).some(item => item.名称 === '魔石通讯终端');
        if (!hasMagicPhone) return { ok: false, reason: '未携带魔石通讯终端' };
        const phone = state.手机;
        if (!phone) return { ok: false, reason: '终端未接入' };
        const battery = typeof phone.设备?.电量 === 'number' ? phone.设备.电量 : 0;
        const signal = typeof phone.设备?.当前信号 === 'number' ? phone.设备.当前信号 : 0;
        if (battery <= 0) return { ok: false, reason: '终端电量不足' };
        if (signal <= 0) return { ok: false, reason: '当前无信号' };
        return { ok: true, reason: '' };
    };

    const isPhoneApiConfigured = (cfg: AppSettings) => {
        const aiCfg = cfg?.aiConfig;
        if (!aiCfg) return false;
        const resolved = resolveServiceConfig(cfg, 'phone');
        return !!resolved?.apiKey;
    };
    const isPhoneIndependentEnabled = (cfg: AppSettings) => {
        const aiCfg = cfg?.aiConfig;
        if (!aiCfg) return false;
        const overridesEnabled = aiCfg.useServiceOverrides ?? aiCfg.mode === 'separate';
        if (!overridesEnabled) return false;
        const overrideFlags = aiCfg.serviceOverridesEnabled || {};
        return (overrideFlags as any)?.phone ?? (aiCfg.mode === 'separate');
    };
    const canQueuePhoneSyncPlan = (cfg: AppSettings) => {
        return isPhoneIndependentEnabled(cfg);
    };
    const canProcessPhoneSyncPlan = (cfg: AppSettings) => {
        return isPhoneIndependentEnabled(cfg) && isPhoneApiConfigured(cfg);
    };

    const upsertPhoneThread = (phone: any, threadType: 'private' | 'group' | 'public', title: string, members?: string[]) => {
        const dialog = phone.对话 || { 私聊: [], 群聊: [], 公共频道: [] };
        const list = threadType === 'private' ? dialog.私聊 : threadType === 'group' ? dialog.群聊 : dialog.公共频道;
        let thread = list.find((t: PhoneThread) => t.标题 === title && t.类型 === threadType);
        if (!thread) {
            thread = {
                id: generateNextId('Thr', list),
                类型: threadType,
                标题: title,
                成员: members && members.length > 0 ? members : [title],
                消息: [],
                未读: 0
            };
            if (threadType === 'private') dialog.私聊 = [...dialog.私聊, thread];
            else if (threadType === 'group') dialog.群聊 = [...dialog.群聊, thread];
            else dialog.公共频道 = [...dialog.公共频道, thread];
            phone.对话 = dialog;
        }
        return thread;
    };

    const normalizePhoneMessage = (msg: any, fallbackTime: string, sender?: string): PhoneMessage => {
        const timestampValue = typeof msg?.timestampValue === 'number' ? msg.timestampValue : Date.now();
        const timeLabel = msg?.时间戳 || fallbackTime || '未知';
        return {
            id: msg?.id || generateLegacyId(),
            发送者: msg?.发送者 || sender || '未知',
            内容: msg?.内容 || msg?.content || '',
            时间戳: timeLabel,
            timestampValue,
            类型: msg?.类型 || msg?.type || (msg?.图片描述 ? 'image' : 'text'),
            状态: msg?.状态 || msg?.status || 'received',
            图片描述: msg?.图片描述 || msg?.image_desc,
            表情包: msg?.表情包 || msg?.sticker,
            媒体类型: msg?.媒体类型 || msg?.media_type,
            送达时间: msg?.送达时间 || msg?.deliver_at_game_time,
            延迟分钟: msg?.延迟分钟 || msg?.delay_minutes,
            引用: msg?.引用
        };
    };

    const addPhoneSyncPlanToState = (state: GameState, plan: any, source: 'story' | 'world') => {
        if (!state.手机) return { nextState: state, shouldTrigger: false };
        const nextState = ensurePhoneStateBase({ ...state, 手机: { ...state.手机 } });
        const phone = nextState.手机;
        if (!phone) return { nextState: state, shouldTrigger: false };
        const queue = Array.isArray(phone.同步规划) ? [...phone.同步规划] : [];
        const last = queue[queue.length - 1];
        const lastContent = typeof last?.内容 === 'string' ? last.内容.trim() : last?.内容;
        const nextContent = typeof plan === 'string' ? plan.trim() : plan;
        if (lastContent && nextContent && lastContent === nextContent) {
            return { nextState, shouldTrigger: false };
        }
        const shouldTrigger = queue.length === 0;
        queue.push({ 时间: nextState.游戏时间 || '未知', 内容: plan, 类型: source });
        phone.同步规划 = queue.slice(-12);
        nextState.手机 = phone;
        return { nextState, shouldTrigger };
    };

    const consumePhoneSyncPlan = (state: GameState) => {
        if (!state.手机) return state;
        const nextState = ensurePhoneStateBase({ ...state, 手机: { ...state.手机 } });
        const phone = nextState.手机;
        if (!phone) return state;
        const queue = Array.isArray(phone.同步规划) ? [...phone.同步规划] : [];
        if (queue.length > 0) queue.shift();
        phone.同步规划 = queue;
        nextState.手机 = phone;
        return nextState;
    };

    const normalizePhoneText = (value?: string) => {
        if (!value) return '';
        return value.replace(/\s+/g, ' ').trim().toLowerCase();
    };

    const buildPhoneMessageSignature = (payload: {
        threadKey?: string;
        sender?: string;
        content?: string;
        type?: string;
        imageDesc?: string;
        sticker?: string;
        mediaType?: string;
        deliverAt?: string;
    }) => {
        const threadKey = normalizePhoneText(payload.threadKey);
        const sender = normalizePhoneText(payload.sender);
        const content = normalizePhoneText(payload.content);
        const type = normalizePhoneText(payload.type);
        const image = normalizePhoneText(payload.imageDesc);
        const sticker = normalizePhoneText(payload.sticker);
        const mediaType = normalizePhoneText(payload.mediaType);
        const deliverAt = normalizePhoneText(payload.deliverAt);
        return [threadKey, sender, type, content, image, sticker, mediaType, deliverAt].join('|');
    };

    const buildPendingSignature = (item: PhonePendingMessage) => buildPhoneMessageSignature({
        threadKey: item.threadId || item.threadTitle,
        sender: item.payload?.发送者,
        content: item.payload?.内容,
        type: item.payload?.类型,
        imageDesc: item.payload?.图片描述,
        sticker: item.payload?.表情包,
        mediaType: item.payload?.媒体类型,
        deliverAt: item.deliverAt || item.payload?.时间戳
    });

    const enqueuePhoneMessages = (state: GameState, aiMessages: any[], playerName: string) => {
        if (!aiMessages || aiMessages.length === 0) return state;
        const nextState = ensurePhoneStateBase({ ...state, 手机: { ...state.手机 } });
        const phone = nextState.手机;
        if (!phone) return state;
        const pending = Array.isArray(phone.待发送) ? [...phone.待发送] : [];
        const existingSignatures = new Set(pending.map(buildPendingSignature));
        const batchSignatures = new Set<string>();
        const nowTime = nextState.游戏时间;
        aiMessages.forEach(raw => {
            const threadType = raw.thread_type || raw.threadType || raw.type || 'private';
            const rawTitle = raw.thread_title || raw.threadTitle || raw.title || raw.标题;
            const sender = raw.sender || raw.发送者 || rawTitle || '未知';
            const dialog = phone.对话 || { 私聊: [], 群聊: [], 公共频道: [] };
            const list = threadType === 'private' ? dialog.私聊 : threadType === 'group' ? dialog.群聊 : dialog.公共频道;
            const existingThread = rawTitle ? list.find((t: PhoneThread) => t.标题 === rawTitle && t.类型 === threadType) : null;
            const threadTitle = rawTitle || existingThread?.标题 || sender || '未知';
            const resolvedThreadId = raw.thread_id || raw.threadId || existingThread?.id || '';
            const delayMinutes = typeof raw.delay_minutes === 'number' ? raw.delay_minutes : 0;
            const deliverAt = raw.deliver_at_game_time || raw.deliverAt || (delayMinutes > 0 ? advanceGameTimeByMinutes(nowTime, delayMinutes).time : nowTime);
            const msg = normalizePhoneMessage({
                ...raw,
                发送者: sender,
                时间戳: deliverAt,
                延迟分钟: delayMinutes
            }, deliverAt, sender);
            const signature = buildPhoneMessageSignature({
                threadKey: resolvedThreadId || threadTitle,
                sender,
                content: msg.内容,
                type: msg.类型,
                imageDesc: msg.图片描述,
                sticker: msg.表情包,
                mediaType: msg.媒体类型,
                deliverAt
            });
            if (existingSignatures.has(signature) || batchSignatures.has(signature)) {
                return;
            }
            const pendingItem: PhonePendingMessage = {
                id: generateLegacyId(),
                threadId: resolvedThreadId,
                threadTitle,
                threadType,
                deliverAt,
                payload: msg,
                status: 'scheduled',
                trigger: raw.trigger
            };
            pending.push(pendingItem);
            existingSignatures.add(signature);
            batchSignatures.add(signature);
        });
        phone.待发送 = pending;
        nextState.手机 = phone;
        return nextState;
    };

    const applyPhoneDeliveries = (state: GameState, nowTime: string) => {
        const nextState = ensurePhoneStateBase({ ...state, 手机: { ...state.手机 } });
        const phone = nextState.手机;
        if (!phone || !Array.isArray(phone.待发送) || phone.待发送.length === 0) {
            return { nextState, delivered: [] as PhoneMessage[] };
        }
        const presentSet = new Set(
            (nextState.社交 || [])
                .filter(c => c?.是否在场)
                .map(c => c.姓名)
                .filter(Boolean)
        );
        const findThreadById = (id?: string) => {
            if (!id) return null;
            const dialog = phone.对话 || { 私聊: [], 群聊: [], 公共频道: [] };
            return dialog.私聊.find((t: PhoneThread) => t.id === id)
                || dialog.群聊.find((t: PhoneThread) => t.id === id)
                || dialog.公共频道.find((t: PhoneThread) => t.id === id)
                || null;
        };
        const nowValue = gameTimeToMinutes(nowTime) ?? 0;
        const pendingNext: PhonePendingMessage[] = [];
        const delivered: PhoneMessage[] = [];
        phone.待发送.forEach(item => {
            const deliverAtValue = gameTimeToMinutes(item.deliverAt);
            const isDue = deliverAtValue === null ? true : deliverAtValue <= nowValue;
            if (!isDue) {
                pendingNext.push(item);
                return;
            }
            const senderName = item.payload?.发送者;
            if (item.threadType === 'private' && senderName && presentSet.has(senderName)) {
                pendingNext.push(item);
                return;
            }
            const payload = { ...item.payload, 时间戳: item.payload.时间戳 || item.deliverAt, 状态: 'received' };
            const threadTitle = item.threadTitle || payload.发送者 || item.threadId || '未知';
            const existingThread = findThreadById(item.threadId);
            const thread = existingThread || upsertPhoneThread(phone, item.threadType, threadTitle, []);
            thread.消息 = [...(thread.消息 || []), payload];
            thread.未读 = (thread.未读 || 0) + 1;
            delivered.push(payload);
        });
        phone.待发送 = pendingNext;
        nextState.手机 = phone;
        return { nextState, delivered };
    };

    const applyImmediatePhoneDeliveries = (state: GameState) => {
        const delivery = applyPhoneDeliveries(state, state.游戏时间);
        let finalState = delivery.nextState;
        if (delivery.delivered.length > 0) {
            const memoryEntries = delivery.delivered
                .filter(m => m.发送者)
                .map(m => `【手机】收到来自${m.发送者 || '未知'}的新消息`);
            finalState = appendPhoneMemoryEntries(finalState, memoryEntries);
            const senders = Array.from(new Set(delivery.delivered.map(m => m.发送者).filter(Boolean) as string[]));
            if (senders.length > 0) {
                recordPhoneNarrativeHint(`收到来自${senders.join('、')}的新消息`);
            } else {
                recordPhoneNarrativeHint(`收到新消息${delivery.delivered.length > 1 ? `（${delivery.delivered.length}条）` : ''}`);
            }
        }
        return { nextState: finalState, delivered: delivery.delivered };
    };

    const pushPhoneNotification = (title: string, message: string) => {
        const id = generateLegacyId();
        setPhoneNotifications(prev => [...prev, { id, title, message }]);
        setTimeout(() => {
            setPhoneNotifications(prev => prev.filter(n => n.id !== id));
        }, 4500);
    };

    const mergeThreadList = (base: PhoneThread[] = [], incoming: PhoneThread[] = []) => {
        const map = new Map(base.map(t => [t.id, t]));
        incoming.forEach(t => {
            const existing = map.get(t.id);
            if (!existing) {
                map.set(t.id, t);
                return;
            }
            map.set(t.id, { ...existing, ...t, 消息: t.消息 || existing.消息 });
        });
        return Array.from(map.values());
    };

    const mergePhoneState = (state: GameState, updates: any) => {
        if (!updates) return state;
        const nextState = ensurePhoneStateBase({ ...state, 手机: { ...state.手机 } });
        const phone = nextState.手机;
        if (!phone) return state;
        if (updates.设备) phone.设备 = { ...phone.设备, ...updates.设备 };
        if (updates.联系人) phone.联系人 = { ...phone.联系人, ...updates.联系人 };
        if (updates.朋友圈) {
            const nextMoments = Array.isArray(updates.朋友圈.帖子)
                ? [...(phone.朋友圈?.帖子 || []), ...updates.朋友圈.帖子]
                : (phone.朋友圈?.帖子 || []);
            const deduped = nextMoments.filter((post, idx, arr) => post?.id ? arr.findIndex(p => p?.id === post.id) === idx : true);
            phone.朋友圈 = { ...phone.朋友圈, ...updates.朋友圈, 帖子: deduped };
        }
        if (updates.公共帖子) {
            const nextForum = Array.isArray(updates.公共帖子.帖子)
                ? [...(phone.公共帖子?.帖子 || []), ...updates.公共帖子.帖子]
                : (phone.公共帖子?.帖子 || []);
            const deduped = nextForum.filter((post, idx, arr) => post?.id ? arr.findIndex(p => p?.id === post.id) === idx : true);
            phone.公共帖子 = { ...phone.公共帖子, ...updates.公共帖子, 帖子: deduped };
        }
        if (updates.对话) {
            const dialog = { ...phone.对话 };
            if (updates.对话.私聊) dialog.私聊 = mergeThreadList(dialog.私聊 || [], updates.对话.私聊);
            if (updates.对话.群聊) dialog.群聊 = mergeThreadList(dialog.群聊 || [], updates.对话.群聊);
            if (updates.对话.公共频道) dialog.公共频道 = mergeThreadList(dialog.公共频道 || [], updates.对话.公共频道);
            phone.对话 = dialog;
        }
        if (updates.待发送) phone.待发送 = updates.待发送;
        nextState.手机 = phone;
        return nextState;
    };

    const sanitizePhoneMemoryEntry = (text: string) => {
        if (!text || typeof text !== 'string') return '';
        if (!text.includes('【手机】')) return text.trim();
        const colonIndex = text.indexOf('：');
        if (colonIndex > -1) return text.slice(0, colonIndex).trim();
        const asciiColon = text.indexOf(':');
        if (asciiColon > -1) return text.slice(0, asciiColon).trim();
        return text.trim();
    };

    const appendPhoneMemoryEntries = (state: GameState, entries: string[]) => {
        if (!entries || entries.length === 0) return state;
        const nextState = { ...state, 记忆: { ...state.记忆 } };
        const list = nextState.记忆.shortTerm || [];
        const nowTime = nextState.游戏时间 || '未知';
        entries.map(sanitizePhoneMemoryEntry).filter(Boolean).forEach(text => {
            list.push({ content: text, timestamp: nowTime, turnIndex: nextState.回合数 || 0 });
        });
        nextState.记忆.shortTerm = list;
        return nextState;
    };

    const summarizePhonePlan = (response: PhoneAIResponse, reason?: string) => {
        const messages = Array.isArray(response?.messages) ? response.messages : [];
        const targets = Array.from(new Set(
            messages
                .map(m => m.thread_title || m.threadTitle || m.title || m.threadTitle || m.sender)
                .filter(Boolean)
        ));
        const delayed = messages.filter(m =>
            (typeof m.delay_minutes === 'number' && m.delay_minutes > 0)
            || m.deliver_at_game_time
            || m.trigger
        ).length;
        const base = messages.length > 0 ? `生成${messages.length}条消息` : '无新消息';
        const targetText = targets.length > 0 ? `，目标：${targets.join('、')}` : '';
        const delayText = delayed > 0 ? `，延迟：${delayed}条` : '';
        const reasonText = reason ? `（${reason}）` : '';
        return `计划${reasonText}: ${base}${targetText}${delayText}`;
    };

    const recordPhonePlan = (state: GameState, summary: string, type: 'auto' | 'sync' | 'manual') => {
        const nextState = ensurePhoneStateBase({ ...state, 手机: { ...state.手机 } });
        const phone = nextState.手机;
        if (!phone) return state;
        const plan = phone.自动规划 || { 上次规划: nextState.游戏时间 || '未知', 记录: [] as any[] };
        const records = Array.isArray(plan.记录) ? [...plan.记录] : [];
        records.push({ 时间: nextState.游戏时间 || '未知', 内容: summary, 类型: type });
        plan.记录 = records.slice(-24);
        if (type === 'auto') {
            plan.上次规划 = nextState.游戏时间 || plan.上次规划;
        }
        phone.自动规划 = plan;
        nextState.手机 = phone;
        return nextState;
    };

    const applyThreadSummaries = (state: GameState, summaries: any[]) => {
        if (!summaries || summaries.length === 0 || !state.手机) return state;
        const summaryMap = new Map(summaries.map(s => [s.threadId, s.summary]));
        const updateThread = (t: PhoneThread) => {
            if (!summaryMap.has(t.id)) return t;
            const lastStamp = t.消息?.[t.消息.length - 1]?.timestampValue || Date.now();
            return {
                ...t,
                摘要: summaryMap.get(t.id),
                摘要时间: state.游戏时间 || '',
                摘要更新时间: lastStamp
            };
        };
        return {
            ...state,
            手机: {
                ...state.手机,
                对话: {
                    私聊: (state.手机.对话?.私聊 || []).map(updateThread),
                    群聊: (state.手机.对话?.群聊 || []).map(updateThread),
                    公共频道: (state.手机.对话?.公共频道 || []).map(updateThread),
                }
            }
        };
    };

    const applyPhoneResponseToState = (state: GameState, response: PhoneAIResponse, playerName: string) => {
        let nextState = state;
        if (response.phone_updates) nextState = mergePhoneState(nextState, response.phone_updates);
        if (response.messages) nextState = enqueuePhoneMessages(nextState, response.messages, playerName);
        if (response.tavern_commands && response.tavern_commands.length > 0) {
            const hasPhonePayload = !!response.phone_updates || (Array.isArray(response.messages) && response.messages.length > 0);
            const commands = hasPhonePayload
                ? response.tavern_commands.filter(cmd => !(typeof cmd?.key === 'string' && cmd.key.startsWith('gameState.手机')))
                : response.tavern_commands;
            if (commands.length > 0) {
                nextState = processTavernCommands(nextState, commands).newState;
            }
        }
        if (response.short_memory && response.short_memory.length > 0) {
            nextState = appendPhoneMemoryEntries(nextState, response.short_memory);
        }
        if (response.thread_summaries && response.thread_summaries.length > 0) {
            nextState = applyThreadSummaries(nextState, response.thread_summaries);
        }
        if (typeof response.time_advance_minutes === 'number' && response.time_advance_minutes > 0) {
            const adv = advanceGameTimeByMinutes(nextState.游戏时间, response.time_advance_minutes);
            nextState = {
                ...nextState,
                游戏时间: adv.time,
                当前日期: advanceDateString(nextState.当前日期, adv.dayDelta)
            };
        }
        return nextState;
    };

    const adjustPhoneResponseForChat = (response: PhoneAIResponse) => {
        if (!response || !Array.isArray(response.messages)) return response;
        const adjusted = response.messages.map(msg => {
            if (typeof msg?.delay_minutes === 'number'
                && msg.delay_minutes > 10
                && !msg.deliver_at_game_time
                && !msg.trigger) {
                return { ...msg, delay_minutes: 8 };
            }
            return msg;
        });
        if (typeof response.time_advance_minutes === 'number') {
            return { ...response, messages: adjusted };
        }
        const shortDelays = adjusted
            .map(m => (typeof m.delay_minutes === 'number' ? m.delay_minutes : 0))
            .filter(v => v > 0 && v <= 10);
        if (shortDelays.length === 0) {
            return { ...response, messages: adjusted };
        }
        const autoAdvance = Math.min(10, Math.max(...shortDelays));
        return { ...response, messages: adjusted, time_advance_minutes: autoAdvance };
    };

    const adjustPhoneResponseForSync = (response: PhoneAIResponse, baseTime?: string) => {
        if (!response || !Array.isArray(response.messages)) return response;
        const adjusted = response.messages.map(msg => {
            const hasDelay = typeof msg?.delay_minutes === 'number' && msg.delay_minutes > 0;
            const hasTrigger = !!msg?.trigger || !!msg?.deliver_at_game_time;
            if (hasDelay && !hasTrigger) {
                return { ...msg, delay_minutes: 0, deliver_at_game_time: baseTime || msg?.deliver_at_game_time };
            }
            return msg;
        });
        return { ...response, messages: adjusted, time_advance_minutes: 0 };
    };

    const stripPhoneTimeAdvance = (response: PhoneAIResponse) => {
        if (!response) return response;
        return { ...response, time_advance_minutes: 0 };
    };

    const flushPendingPhoneOps = async (reason: string, baseState?: GameState): Promise<GameState | null> => {
        if (phoneFlushInFlight.current || isPhoneProcessing) return;
        const ops = pendingPhoneOpsRef.current || [];
        if (ops.length === 0) return;
        phoneFlushInFlight.current = true;
        setIsPhoneProcessing(true);
        setPhoneProcessingThreadId(null);
        setPhoneProcessingScope('manual');
        let workingState = baseState || gameState;
        const playerName = workingState.角色?.姓名 || 'Player';
        try {
            if (!isPhoneApiConfigured(settings)) {
                ops.forEach(op => {
                    if (op.type === 'send') {
                        workingState = updatePhoneMessageStatus(workingState, op.threadId, op.messageId, 'sent');
                        workingState = appendPhoneMemoryEntries(workingState, [`【手机】已发送消息给${op.otherParty || op.threadTitle || '对方'}`]);
                    } else if (op.type === 'wait' && op.threadTitle) {
                        workingState = appendPhoneMemoryEntries(workingState, [`【手机】等待${op.threadTitle}回复`]);
                    } else if (op.type === 'moment') {
                        workingState = appendPhoneMemoryEntries(workingState, [`【手机】发布朋友圈动态`]);
                    } else if (op.type === 'forum') {
                        workingState = appendPhoneMemoryEntries(workingState, [`【手机】发布论坛帖子`]);
                    }
                });
                pendingPhoneOpsRef.current = [];
                setGameState(workingState);
                return workingState;
            }

            for (const op of ops) {
                if (op.type === 'send' && op.threadId && op.threadTitle && op.content) {
                    const channelLabel = op.threadType === 'public' ? '公共频道' : (op.threadType === 'group' ? '群聊' : '私信');
                    const otherParty = op.otherParty || op.threadTitle;
                    const phoneInput = [
                        `[PHONE_CHAT]`,
                        `thread_id: ${op.threadId}`,
                        `thread_title: ${op.threadTitle}`,
                        `成员: ${(op.members || []).join(',') || '未知'}`,
                        `[手机/${channelLabel}] ${otherParty}: ${op.content}`
                    ].join('\n');
                    const phoneResp = await generatePhoneResponse(phoneInput, workingState, settings);
                    if (!phoneResp.allowed) {
                        workingState = updatePhoneMessageStatus(workingState, op.threadId, op.messageId, 'failed');
                        continue;
                    }
                    const adjustedResp = stripPhoneTimeAdvance(adjustPhoneResponseForChat(phoneResp));
                    workingState = applyPhoneResponseToState(workingState, adjustedResp, playerName);
                    workingState = applyImmediatePhoneDeliveries(workingState).nextState;
                    workingState = updatePhoneMessageStatus(workingState, op.threadId, op.messageId, 'sent');
                    workingState = appendPhoneMemoryEntries(workingState, [`【手机】已发送消息给${otherParty}`]);
                    continue;
                }

                if (op.type === 'wait' && op.threadId) {
                    const thread = [
                        ...(workingState.手机?.对话?.私聊 || []),
                        ...(workingState.手机?.对话?.群聊 || []),
                        ...(workingState.手机?.对话?.公共频道 || [])
                    ].find(t => t.id === op.threadId);
                    if (!thread) continue;
                    const channelLabel = thread.类型 === 'public' ? '公共频道' : (thread.类型 === 'group' ? '群聊' : '私信');
                    const recent = (thread.消息 || []).slice(-4).map(m => `${m.发送者}:${m.内容}`).join(' / ');
                    const phoneInput = [
                        `[PHONE_CHAT]`,
                        `[等待回复/${channelLabel}]`,
                        `thread_id: ${thread.id}`,
                        `thread_title: ${thread.标题}`,
                        `成员: ${(thread.成员 || []).join(',') || '未知'}`,
                        `最近对话: ${recent || '无'}`
                    ].join('\n');
                    const phoneResp = await generatePhoneResponse(phoneInput, workingState, settings);
                    if (!phoneResp.allowed) continue;
                    const adjustedResp = stripPhoneTimeAdvance(adjustPhoneResponseForChat(phoneResp));
                    workingState = applyPhoneResponseToState(workingState, adjustedResp, playerName);
                    workingState = applyImmediatePhoneDeliveries(workingState).nextState;
                    workingState = appendPhoneMemoryEntries(workingState, [`【手机】等待${thread.标题}回复`]);
                    continue;
                }

                if (op.type === 'moment' && op.content) {
                    const descText = op.imageDesc ? `（图片描述：${op.imageDesc}）` : '';
                    const phoneResp = await generatePhoneResponse(`[PHONE_POST] 我在朋友圈发布动态：${op.content}${descText}`, workingState, settings);
                    if (!phoneResp.allowed) {
                        workingState = removePhonePost(workingState, op.postId, '朋友圈');
                        continue;
                    }
                    const adjustedResp = stripPhoneTimeAdvance(phoneResp);
                    workingState = applyPhoneResponseToState(workingState, adjustedResp, playerName);
                    workingState = applyImmediatePhoneDeliveries(workingState).nextState;
                    workingState = appendPhoneMemoryEntries(workingState, [`【手机】发布朋友圈动态`]);
                    continue;
                }

                if (op.type === 'forum' && op.content) {
                    const descText = op.imageDesc ? `（图片描述：${op.imageDesc}）` : '';
                    const topicText = op.topic ? `（板块：${op.topic}）` : '';
                    const phoneResp = await generatePhoneResponse(`[PHONE_POST] 我在公共论坛发布帖子：${op.content}${descText}${topicText}`, workingState, settings);
                    if (!phoneResp.allowed) {
                        workingState = removePhonePost(workingState, op.postId, '公共帖子');
                        continue;
                    }
                    const adjustedResp = stripPhoneTimeAdvance(phoneResp);
                    workingState = applyPhoneResponseToState(workingState, adjustedResp, playerName);
                    workingState = applyImmediatePhoneDeliveries(workingState).nextState;
                    workingState = appendPhoneMemoryEntries(workingState, [`【手机】发布论坛帖子`]);
                    continue;
                }
            }
            pendingPhoneOpsRef.current = [];
            setGameState(workingState);
            return workingState;
        } catch (e) {
            console.error(`Flush phone ops failed (${reason})`, e);
            return null;
        } finally {
            setIsPhoneProcessing(false);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope(null);
            phoneFlushInFlight.current = false;
        }
    };

    const shouldSummarizeThread = (thread: PhoneThread) => {
        const threshold = 18;
        if (!thread.消息 || thread.消息.length < threshold) return false;
        const lastStamp = thread.消息[thread.消息.length - 1]?.timestampValue || 0;
        const summaryStamp = thread.摘要更新时间 || 0;
        const newCount = thread.消息.filter(m => (m.timestampValue || 0) > summaryStamp).length;
        return newCount >= 6;
    };

    const requestThreadSummary = async (thread: PhoneThread, baseState: GameState) => {
        if (!thread || phoneSummaryInFlight.current.has(thread.id)) return;
        if (!shouldSummarizeThread(thread)) return;
        if (!isPhoneApiConfigured(settings)) return;
        phoneSummaryInFlight.current.add(thread.id);
        try {
            const snippet = (thread.消息 || []).slice(-20).map(m => `[${m.发送者}] ${m.内容}`).join('\\n');
            const input = `[THREAD_SUMMARY]\\n线程: ${thread.标题}\\n请忽略手机可用性限制，仅生成 thread_summaries。\\n消息:\\n${snippet}`;
            const resp = await generatePhoneResponse(input, baseState, settings);
            const summary = Array.isArray(resp.thread_summaries) && resp.thread_summaries.length > 0 ? resp.thread_summaries[0].summary : '';
            if (!summary) return;
            setGameState(prev => {
                const phone = prev.手机;
                if (!phone) return prev;
                const updateThread = (t: PhoneThread) => {
                    if (t.id !== thread.id) return t;
                    const lastStamp = t.消息?.[t.消息.length - 1]?.timestampValue || Date.now();
                    return { ...t, 摘要: summary, 摘要时间: prev.游戏时间 || '', 摘要更新时间: lastStamp };
                };
                return {
                    ...prev,
                    手机: {
                        ...phone,
                        对话: {
                            私聊: (phone.对话?.私聊 || []).map(updateThread),
                            群聊: (phone.对话?.群聊 || []).map(updateThread),
                            公共频道: (phone.对话?.公共频道 || []).map(updateThread),
                        }
                    }
                };
            });
        } finally {
            phoneSummaryInFlight.current.delete(thread.id);
        }
    };

    const shouldTriggerAdvance = (trigger: any, state: GameState) => {
        if (!trigger) return false;
        const location = state.当前地点 || '';
        if (Array.isArray(trigger.locations) && trigger.locations.some((l: string) => location.includes(l))) return true;
        if (Array.isArray(trigger.confidants)) {
            const present = new Set((state.社交 || []).filter(c => c.是否在场).map(c => c.姓名));
            if (trigger.confidants.some((n: string) => present.has(n))) return true;
        }
        if (Array.isArray(trigger.taskIds)) {
            const active = new Set((state.任务 || []).filter(t => t.状态 === 'active').map(t => t.id));
            if (trigger.taskIds.some((id: string) => active.has(id))) return true;
        }
        if (Array.isArray(trigger.storyKeywords)) {
            const storyText = JSON.stringify(state.剧情 || {});
            if (trigger.storyKeywords.some((k: string) => storyText.includes(k))) return true;
        }
        if (Array.isArray(trigger.worldKeywords)) {
            const worldText = JSON.stringify(state.世界 || {});
            if (trigger.worldKeywords.some((k: string) => worldText.includes(k))) return true;
        }
        return false;
    };

    const updatePendingForTriggers = (state: GameState) => {
        const phone = state.手机;
        if (!phone || !Array.isArray(phone.待发送) || phone.待发送.length === 0) return { changed: false, pending: phone?.待发送 || [] };
        const nowTime = state.游戏时间;
        let changed = false;
        const updated = phone.待发送.map(item => {
            if (item.status === 'scheduled' && shouldTriggerAdvance(item.trigger, state)) {
                changed = true;
                return { ...item, deliverAt: nowTime };
            }
            return item;
        });
        return { changed, pending: updated };
    };

    const handleAIInteraction = async (
        input: string,
        contextType: 'ACTION' | 'PHONE' = 'ACTION',
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
            const resolvedPhonePlan = resolvePhoneSyncPlan(aiResponse);
            
            let nextStateForPhoneSync: GameState | null = null;
            let queuedSyncState: GameState | null = null;
            let shouldTriggerSync = false;
            setLastAIThinking(aiResponse.thinking || '');
            setGameState(prev => {
                if (aiResponse.rawResponse) setLastAIResponse(aiResponse.rawResponse);
                if (aiResponse.action_options) setCurrentOptions(aiResponse.action_options || []);

                const responseId = generateLegacyId();
                const responseSnapshot = JSON.stringify(createStorageSnapshot(stateWithUserLog));
                const rawCommands = Array.isArray(aiResponse.tavern_commands) ? aiResponse.tavern_commands : [];
                const usePhoneSyncPlan = canQueuePhoneSyncPlan(settings) && !!resolvedPhonePlan;
                const commands = usePhoneSyncPlan
                    ? rawCommands.filter(cmd => !(typeof cmd?.key === 'string' && cmd.key.startsWith('gameState.手机')))
                    : rawCommands;
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
                nextStateForPhoneSync = newState;

                if (resolvedPhonePlan && canQueuePhoneSyncPlan(settings)) {
                    const queued = addPhoneSyncPlanToState(newState, resolvedPhonePlan, 'story');
                    queuedSyncState = queued.nextState;
                    shouldTriggerSync = queued.shouldTrigger;
                    return queued.nextState;
                }
                return newState;
            });

            if (shouldTriggerSync && queuedSyncState && canProcessPhoneSyncPlan(settings)) {
                processPhoneSyncQueue(queuedSyncState);
            }
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
    const stopInteraction = () => { 
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        if (phoneAbortControllerRef.current) {
            phoneAbortControllerRef.current.abort();
            phoneAbortControllerRef.current = null;
        }
        setIsProcessing(false); 
        setIsStreaming(false); 
        setIsPhoneProcessing(false);
        setPhoneProcessingThreadId(null);
        setPhoneProcessingScope(null);
        setGameState(prev => ({ ...prev, 处理中: false }));
        clearPendingCommands(); 
    };
    const handlePhoneSyncPlan = async (plan: any, baseState: GameState, consumeQueue: boolean = false) => {
        if (!canProcessPhoneSyncPlan(settings)) return;
        let refreshState: GameState | null = null;
        let success = false;
        try {
            setIsPhoneProcessing(true);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope('sync');
            const planPayload = typeof plan === 'string' ? plan : JSON.stringify(plan);
            const input = `[PHONE_SYNC_PLAN]\n${planPayload}`;
            const phoneResp = await generatePhoneResponse(input, baseState, settings);
            if (!phoneResp.allowed) return;
            const adjustedResp = adjustPhoneResponseForSync(phoneResp, baseState.游戏时间);
            const playerName = baseState.角色?.姓名 || 'Player';
            let nextState = applyPhoneResponseToState(baseState, adjustedResp, playerName);
            const summary = summarizePhonePlan(adjustedResp, '剧情联动');
            nextState = recordPhonePlan(nextState, summary, 'sync');
            if (consumeQueue) {
                nextState = consumePhoneSyncPlan(nextState);
            }
            setGameState(nextState);
            refreshState = nextState;
            success = true;
        } catch (e) {
            console.error('Phone sync plan failed', e);
        } finally {
            setIsPhoneProcessing(false);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope(null);
            if (refreshState && !consumeQueue) {
                setTimeout(() => {
                    triggerPhoneAutoPlan('剧情联动后刷新', refreshState as GameState, true);
                }, 0);
            }
        }
        return { success, nextState: refreshState || undefined };
    };

    const processPhoneSyncQueue = async (baseState: GameState) => {
        if (phoneSyncPlanInFlight.current || isPhoneProcessing) return;
        if (!canProcessPhoneSyncPlan(settings)) return;
        const queue = baseState.手机?.同步规划;
        if (!Array.isArray(queue) || queue.length === 0) return;
        const entry = queue[0];
        if (!entry?.内容) return;
        phoneSyncPlanInFlight.current = true;
        try {
            const result = await handlePhoneSyncPlan(entry.内容, baseState, true);
            const nextState = result?.nextState;
            if (result?.success && nextState?.手机?.同步规划 && nextState.手机.同步规划.length > 0) {
                setTimeout(() => processPhoneSyncQueue(nextState), 0);
            }
        } finally {
            phoneSyncPlanInFlight.current = false;
        }
    };

    const triggerPhoneAutoPlan = async (reason: string, baseState: GameState, force: boolean = false) => {
        if (phoneAutoPlanInFlight.current || isPhoneProcessing || (!force && isProcessing)) return;
        if (!isPhoneApiConfigured(settings)) return;
        const nowValue = parseGameTime(baseState.游戏时间);
        const lastValue = parseGameTime(baseState.手机?.自动规划?.上次规划);
        if (!force) {
            if (nowValue === null || lastValue === null) return;
            if (nowValue - lastValue < 60) return;
        }
        phoneAutoPlanInFlight.current = true;
        try {
            setIsPhoneProcessing(true);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope('auto');
            const input = `[PHONE_AUTO_PLAN]\n${reason || ''}`;
            const phoneResp = await generatePhoneResponse(input, baseState, settings);
            if (!phoneResp.allowed) {
                const rejected = recordPhonePlan(baseState, `计划（${reason || '自动'}）：被拒绝`, 'auto');
                setGameState(rejected);
                return;
            }
            const adjustedResp: PhoneAIResponse = { ...phoneResp, time_advance_minutes: 0 };
            const summary = summarizePhonePlan(adjustedResp, reason || '自动规划');
            setGameState(prev => {
                let nextState = applyPhoneResponseToState(prev, adjustedResp, prev.角色?.姓名 || 'Player');
                nextState = recordPhonePlan(nextState, summary, 'auto');
                return nextState;
            });
        } catch (e) {
            console.error('Phone auto plan failed', e);
        } finally {
            setIsPhoneProcessing(false);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope(null);
            phoneAutoPlanInFlight.current = false;
        }
    };
    const handleSendMessage = async (text: string, thread: PhoneThread) => {
        const trimmed = text.trim();
        if (!trimmed || !thread) return;
        const localCheck = isPhoneLocallyAvailable(gameState);
        if (!localCheck.ok) {
            alert(localCheck.reason || '当前无法使用手机');
            return;
        }
        const timestampValue = Date.now();
        const playerName = gameState.角色?.姓名 || 'Player';
        const willDefer = isPhoneApiConfigured(settings);
        const newMsg: PhoneMessage = {
            id: generateNextId('Msg', thread.消息 || []),
            发送者: playerName,
            内容: trimmed,
            时间戳: gameState.游戏时间 || '未知',
            timestampValue,
            类型: 'text',
            状态: willDefer ? 'pending' : 'sent'
        };
        let nextState: GameState | null = null;
        setGameState(prev => {
            const phone = prev.手机;
            if (!phone) return prev;
            const updateThread = (t: PhoneThread) => {
                if (t.id !== thread.id) return t;
                return { ...t, 消息: [...(t.消息 || []), newMsg] };
            };
            const nextPhone = {
                ...phone,
                对话: {
                    私聊: (phone.对话?.私聊 || []).map(updateThread),
                    群聊: (phone.对话?.群聊 || []).map(updateThread),
                    公共频道: (phone.对话?.公共频道 || []).map(updateThread),
                }
            };
            const otherParty = thread.类型 === 'private'
                ? (thread.成员 || []).find(m => m && m !== playerName)
                : null;
            if (otherParty) {
                const recent = Array.isArray(nextPhone.联系人?.最近) ? nextPhone.联系人?.最近 : [];
                const nextRecent = [otherParty, ...recent.filter(n => n !== otherParty)].slice(0, 8);
                nextPhone.联系人 = { ...nextPhone.联系人, 最近: nextRecent };
            }
            nextState = { ...prev, 手机: nextPhone };
            return nextState;
        });
        if (!nextState) return;
        const otherParty = thread.类型 === 'private'
            ? (thread.成员 || []).find(m => m && m !== playerName) || thread.标题
            : thread.标题;
        if (!willDefer) {
            const finalState = appendPhoneMemoryEntries(nextState, [`【手机】已发送消息给${otherParty}`]);
            recordPhoneNarrativeHint(`给${otherParty}发送消息：“${trimmed}”`);
            setGameState(finalState);
            return;
        }
        enqueuePhoneOp({
            id: generateLegacyId(),
            type: 'send',
            threadId: thread.id,
            threadTitle: thread.标题,
            threadType: thread.类型,
            members: thread.成员,
            content: trimmed,
            messageId: newMsg.id,
            otherParty
        });
        recordPhoneNarrativeHint(`给${otherParty}发送消息：“${trimmed}”`);
    };
    const handleEditPhoneMessage = (id: string, content: string) => {
        if (!id) return;
        setGameState(prev => {
            const phone = prev.手机;
            if (!phone) return prev;
            const updateThread = (t: PhoneThread) => ({
                ...t,
                消息: (t.消息 || []).map(m => m.id === id ? { ...m, 内容: content } : m)
            });
            return {
                ...prev,
                手机: {
                    ...phone,
                    对话: {
                        私聊: (phone.对话?.私聊 || []).map(updateThread),
                        群聊: (phone.对话?.群聊 || []).map(updateThread),
                        公共频道: (phone.对话?.公共频道 || []).map(updateThread),
                    }
                }
            };
        });
    };
    const handleDeletePhoneMessage = (id: string) => {
        if (!id) return;
        setGameState(prev => {
            const phone = prev.手机;
            if (!phone) return prev;
            const updateThread = (t: PhoneThread) => ({
                ...t,
                消息: (t.消息 || []).filter(m => m.id !== id)
            });
            return {
                ...prev,
                手机: {
                    ...phone,
                    对话: {
                        私聊: (phone.对话?.私聊 || []).map(updateThread),
                        群聊: (phone.对话?.群聊 || []).map(updateThread),
                        公共频道: (phone.对话?.公共频道 || []).map(updateThread),
                    }
                }
            };
        });
    };

    const handlePlayerInput = async (text: string) => {
        if (isProcessing) return;
        const flushedState = await flushPendingPhoneOps('主剧情输入');
        const phonePrefix = consumePhoneNarrativePrefix();
        const queued = consumeCommandQueue();
        const commandPayload = queued.map(c => c.text);
        const commandBlock = commandPayload.length > 0
            ? `[用户指令]\n${commandPayload.join('\n')}\n[/用户指令]\n`
            : '';
        const aiInputBase = commandBlock ? `${commandBlock}${phonePrefix}${text}` : `${phonePrefix}${text}`;
        const aiInput = aiInputBase;
        handleAIInteraction(aiInput, 'ACTION', commandPayload, flushedState || undefined, false, text);
    };
    const handleCreateMoment = async (content: string, imageDesc?: string) => {
        if (!content.trim()) return;
        const localCheck = isPhoneLocallyAvailable(gameState);
        if (!localCheck.ok) {
            alert(localCheck.reason || '当前无法使用手机');
            return;
        }
        const timestampValue = Date.now();
        const postId = `Mom_${timestampValue}`;
        const newPost: PhonePost = {
            id: postId,
            发布者: gameState.角色.姓名 || 'Player',
            头像: gameState.角色.头像 || '',
            内容: content.trim(),
            时间戳: gameState.游戏时间 || '未知',
            timestampValue: timestampValue,
            点赞数: 0,
            评论: [],
            图片描述: imageDesc || undefined,
            可见性: 'friends'
        };
        const nextState: GameState = {
            ...gameState,
            手机: {
                ...gameState.手机,
                朋友圈: {
                    ...gameState.手机?.朋友圈,
                    帖子: [...(gameState.手机?.朋友圈?.帖子 || []), newPost]
                }
            }
        };
        setGameState(nextState);
        if (!isPhoneApiConfigured(settings)) {
            const finalState = appendPhoneMemoryEntries(nextState, [`【手机】发布朋友圈动态`]);
            recordPhoneNarrativeHint('发布朋友圈动态');
            setGameState(finalState);
            return;
        }
        enqueuePhoneOp({
            id: generateLegacyId(),
            type: 'moment',
            content: content.trim(),
            imageDesc: imageDesc || undefined,
            postId
        });
        recordPhoneNarrativeHint('发布朋友圈动态');
    };
    const handleCreatePublicPost = async (content: string, imageDesc?: string, topic?: string) => {
        if (!content.trim()) return;
        const localCheck = isPhoneLocallyAvailable(gameState);
        if (!localCheck.ok) {
            alert(localCheck.reason || '当前无法使用手机');
            return;
        }
        const timestampValue = Date.now();
        const postId = `Forum_${timestampValue}`;
        const newPost: PhonePost = {
            id: postId,
            发布者: gameState.角色.姓名 || 'Player',
            头像: gameState.角色.头像 || '',
            内容: content.trim(),
            时间戳: gameState.游戏时间 || '未知',
            timestampValue,
            点赞数: 0,
            评论: [],
            图片描述: imageDesc || undefined,
            可见性: 'public',
            话题: topic ? [topic] : undefined
        };
        const nextState: GameState = {
            ...gameState,
            手机: {
                ...gameState.手机,
                公共帖子: {
                    ...gameState.手机?.公共帖子,
                    帖子: [...(gameState.手机?.公共帖子?.帖子 || []), newPost]
                }
            }
        };
        setGameState(nextState);
        if (!isPhoneApiConfigured(settings)) {
            let finalState = appendPhoneMemoryEntries(nextState, [`【手机】发布论坛帖子`]);
            recordPhoneNarrativeHint('发布论坛帖子');
            setGameState(finalState);
            handleWorldInfoUpdate(`论坛动态：${content.trim()}`, finalState);
            return;
        }
        enqueuePhoneOp({
            id: generateLegacyId(),
            type: 'forum',
            content: content.trim(),
            imageDesc: imageDesc || undefined,
            topic: topic || undefined,
            postId
        });
        recordPhoneNarrativeHint('发布论坛帖子');
    };
    const handleWaitForPhoneReply = async (thread?: PhoneThread | null) => {
        if (!thread || isProcessing || isPhoneProcessing) return;
        const localCheck = isPhoneLocallyAvailable(gameState);
        if (!localCheck.ok) {
            alert(localCheck.reason || '当前无法使用手机');
            return;
        }
        if (!isPhoneApiConfigured(settings)) {
            alert('手机AI未配置，无法等待回复。');
            return;
        }
        enqueuePhoneOp({
            id: generateLegacyId(),
            type: 'wait',
            threadId: thread.id,
            threadTitle: thread.标题,
            threadType: thread.类型,
            members: thread.成员
        });
        recordPhoneNarrativeHint(`等待${thread.标题}回复`);
    };
    const handleSubmitPhoneOps = async () => {
        await flushPendingPhoneOps('手动提交手机操作');
    };
    const handleCreateThread = (payload: { type: 'private' | 'group' | 'public'; title: string; members: string[] }) => {
        const title = payload.title?.trim();
        if (!title) return;
        setGameState(prev => {
            const phone = prev.手机;
            if (!phone) return prev;
            const dialog = phone.对话 || { 私聊: [], 群聊: [], 公共频道: [] };
            const bucket = payload.type === 'private'
                ? dialog.私聊
                : payload.type === 'group'
                    ? dialog.群聊
                    : dialog.公共频道;
            const exists = bucket.some((t: PhoneThread) => t.标题 === title && t.类型 === payload.type);
            if (exists) return prev;
            const newThread: PhoneThread = {
                id: generateNextId('Thr', bucket),
                类型: payload.type,
                标题: title,
                成员: Array.isArray(payload.members) && payload.members.length > 0 ? payload.members : [title],
                消息: [],
                未读: 0
            };
            const nextDialog = {
                ...dialog,
                私聊: payload.type === 'private' ? [...dialog.私聊, newThread] : dialog.私聊,
                群聊: payload.type === 'group' ? [...dialog.群聊, newThread] : dialog.群聊,
                公共频道: payload.type === 'public' ? [...dialog.公共频道, newThread] : dialog.公共频道
            };
            return {
                ...prev,
                手机: {
                    ...phone,
                    对话: nextDialog
                }
            };
        });
    };
    const handleWorldInfoUpdate = async (reason: string, stateOverride?: GameState) => {
        if (silentUpdateInFlight.current || isProcessing) return;
        silentUpdateInFlight.current = true;
        try {
            const baseState = stateOverride || gameState;
            const input = reason ? `【系统】世界情报更新：${reason}` : '【系统】世界情报静默更新';
            const aiResponse = await generateWorldInfoResponse(
                input,
                baseState,
                settings,
                undefined,
                undefined
            );
            const resolvedPhonePlan = resolvePhoneSyncPlan(aiResponse);
            let nextStateForPhoneSync: GameState | null = null;
            let queuedSyncState: GameState | null = null;
            let shouldTriggerSync = false;
            setGameState(prev => {
                const rawCommands = Array.isArray(aiResponse.tavern_commands) ? aiResponse.tavern_commands : [];
                const usePhoneSyncPlan = canQueuePhoneSyncPlan(settings) && !!resolvedPhonePlan;
                const commands = usePhoneSyncPlan
                    ? rawCommands.filter(cmd => !(typeof cmd?.key === 'string' && cmd.key.startsWith('gameState.手机')))
                    : rawCommands;
                const { newState } = processTavernCommands(prev, commands);
                newState.处理中 = false;
                nextStateForPhoneSync = newState;
                if (resolvedPhonePlan && canQueuePhoneSyncPlan(settings)) {
                    const queued = addPhoneSyncPlanToState(newState, resolvedPhonePlan, 'world');
                    queuedSyncState = queued.nextState;
                    shouldTriggerSync = queued.shouldTrigger;
                    return queued.nextState;
                }
                return newState;
            });
            if (shouldTriggerSync && queuedSyncState && canProcessPhoneSyncPlan(settings)) {
                processPhoneSyncQueue(queuedSyncState);
            }
        } catch (e) {
            console.error('World info update failed', e);
        } finally {
            silentUpdateInFlight.current = false;
        }
    };
    const handleMarkThreadRead = (threadId: string) => {
        if (!threadId) return;
        setGameState(prev => {
            const phone = prev.手机;
            if (!phone) return prev;
            const updateThread = (t: PhoneThread) => {
                if (t.id !== threadId) return t;
                const nextMessages = (t.消息 || []).map(m => (
                    m.状态 === 'received' ? { ...m, 状态: 'read' } : m
                ));
                return { ...t, 未读: 0, 消息: nextMessages };
            };
            return {
                ...prev,
                手机: {
                    ...phone,
                    对话: {
                        私聊: (phone.对话?.私聊 || []).map(updateThread),
                        群聊: (phone.对话?.群聊 || []).map(updateThread),
                        公共频道: (phone.对话?.公共频道 || []).map(updateThread),
                    }
                }
            };
        });
    };

    const handleSilentWorldUpdate = async () => {
        await handleWorldInfoUpdate('世界情报静默更新', gameState);
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

    useEffect(() => {
        if (!gameState.手机) return;
        triggerPhoneAutoPlan('每小时自动规划', gameState, false);
    }, [gameState.游戏时间, gameState.手机?.自动规划?.上次规划]);

    useEffect(() => {
        if (!gameState.手机?.同步规划 || gameState.手机.同步规划.length === 0) return;
        if (isPhoneProcessing || phoneSyncPlanInFlight.current) return;
        processPhoneSyncQueue(gameState);
    }, [gameState.手机?.同步规划?.length, isPhoneProcessing, settings.aiConfig?.enablePhoneSyncPlan, settings.aiConfig?.useServiceOverrides, settings.aiConfig?.services?.phone?.apiKey, settings.aiConfig?.unified?.apiKey]);

    useEffect(() => {
        if (!gameState.手机?.待发送 || gameState.手机.待发送.length === 0) return;
        const triggerResult = updatePendingForTriggers(gameState);
        let nextState = gameState;
        if (triggerResult.changed) {
            nextState = { ...nextState, 手机: { ...nextState.手机, 待发送: triggerResult.pending } };
        }
        const delivery = applyPhoneDeliveries(nextState, nextState.游戏时间);
        if (!triggerResult.changed && delivery.delivered.length === 0) return;
        let finalState = delivery.nextState;
        if (delivery.delivered.length > 0) {
            const memoryEntries = delivery.delivered
                .filter(m => m.发送者)
                .map(m => `【手机】收到来自${m.发送者 || '未知'}的新消息`);
            finalState = appendPhoneMemoryEntries(finalState, memoryEntries);
            const senders = Array.from(new Set(delivery.delivered.map(m => m.发送者).filter(Boolean) as string[]));
            if (senders.length > 0) {
                recordPhoneNarrativeHint(`收到来自${senders.join('、')}的新消息`);
            } else {
                recordPhoneNarrativeHint(`收到新消息${delivery.delivered.length > 1 ? `（${delivery.delivered.length}条）` : ''}`);
            }
            pushPhoneNotification('手机新消息', `收到 ${delivery.delivered.length} 条新消息`);
            const affected = new Set(delivery.delivered.map(m => m.id));
            const allThreads = [
                ...(finalState.手机?.对话?.私聊 || []),
                ...(finalState.手机?.对话?.群聊 || []),
                ...(finalState.手机?.对话?.公共频道 || [])
            ];
            allThreads.forEach(t => {
                if ((t.消息 || []).some(m => affected.has(m.id))) {
                    requestThreadSummary(t, finalState);
                }
            });
        }
        setGameState(finalState);
    }, [gameState.游戏时间, gameState.手机?.待发送, gameState.当前地点, gameState.社交, gameState.剧情, gameState.世界]);
    const handlePlayerAction = async (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => {
        if (isProcessing) return;
        const flushedState = await flushPendingPhoneOps('主剧情行动');
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
            const phonePrefix = consumePhoneNarrativePrefix();
            const aiInput = phonePrefix ? `${phonePrefix}${input}` : input;
            handleAIInteraction(aiInput, 'ACTION', undefined, flushedState || undefined, false, input);
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
        const usePhoneSyncPlan = shouldUsePhoneSyncPlan(response);
        const commands = usePhoneSyncPlan
            ? rawCommands.filter(cmd => !(typeof cmd?.key === 'string' && cmd.key.startsWith('gameState.手机')))
            : rawCommands;
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
            const nextStory: StoryState = {
                ...current,
                主线: { ...(current.主线 || {}), ...(patch?.主线 || {}) },
                引导: { ...(current.引导 || {}), ...(patch?.引导 || {}) },
                时间轴: { ...(current.时间轴 || {}), ...(patch?.时间轴 || {}) },
                路线: { ...(current.路线 || {}), ...(patch?.路线 || {}) },
                待触发: patch?.待触发 ?? current.待触发,
                里程碑: patch?.里程碑 ?? current.里程碑,
                备注: patch?.备注 ?? current.备注
            };
            if (milestoneNote && milestoneNote.trim()) {
                const entry: StoryMilestone = {
                    时间: prev.游戏时间 || '未知',
                    事件: milestoneNote.trim()
                };
                const list = Array.isArray(nextStory.里程碑) ? [...nextStory.里程碑, entry] : [entry];
                nextStory.里程碑 = list;
            }
            return { ...prev, 剧情: nextStory };
        });
    };
    const handleCompleteStoryStage = (milestoneNote?: string) => {
        setGameState(prev => {
            const current = prev.剧情 || ({} as StoryState);
            const main = current.主线 || ({} as StoryState['主线']);
            const guide = current.引导 || ({} as StoryState['引导']);
            const timeline = current.时间轴 || ({} as StoryState['时间轴']);
            const route = current.路线 || ({} as StoryState['路线']);
            const noteMarker = '【手动推进】当前阶段已完成，请规划下一阶段';
            const existingNote = (current.备注 || '').trim();
            const nextNote = existingNote.includes('手动推进')
                ? existingNote
                : (existingNote ? `${existingNote}\n${noteMarker}` : noteMarker);
            const nextStory: StoryState = {
                ...current,
                主线: { ...main, 节点状态: '完成' },
                引导: { ...guide },
                时间轴: { ...timeline },
                路线: { ...route },
                待触发: current.待触发,
                里程碑: current.里程碑,
                备注: nextNote
            };
            if (milestoneNote && milestoneNote.trim()) {
                const entry: StoryMilestone = {
                    时间: prev.游戏时间 || '未知',
                    事件: milestoneNote.trim()
                };
                const list = Array.isArray(nextStory.里程碑) ? [...nextStory.里程碑, entry] : [entry];
                nextStory.里程碑 = list;
            }
            return { ...prev, 剧情: nextStory };
        });
    };

    return {
        gameState, setGameState, settings, setSettings,
        commandQueue, pendingCommands, addToQueue, removeFromQueue, currentOptions, lastAIResponse, lastAIThinking, isProcessing, isStreaming, isPhoneProcessing, phoneProcessingThreadId, phoneProcessingScope, draftInput, setDraftInput,
        memorySummaryState, confirmMemorySummary, applyMemorySummary, cancelMemorySummary,
        handleAIInteraction, stopInteraction, handlePlayerAction, handlePlayerInput, handleSendMessage, handleCreateMoment, handleCreatePublicPost, handleCreateThread, handleMarkThreadRead, handleSilentWorldUpdate, handleWaitForPhoneReply, handleSubmitPhoneOps, saveSettings, manualSave, loadGame, updateConfidant, updateMemory,
        handleReroll, handleEditLog, handleDeleteLog, handleEditUserLog, handleUpdateLogText, handleUserRewrite, handleDeleteTask, handleUpdateTaskStatus, handleUpdateStory, handleCompleteStoryStage,
        handleEditPhoneMessage, handleDeletePhoneMessage,
        phoneNotifications
    };
};

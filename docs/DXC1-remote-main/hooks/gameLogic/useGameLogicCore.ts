
import { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, AppSettings, LogEntry, InventoryItem, TavernCommand, ActionOption, PhoneMessage, PhoneThread, PhonePendingMessage, Confidant, SaveSlot, Task, ContextModuleConfig, PhonePost, PhoneAIResponse, ForumPost, ForumReply, SystemSettings } from '../../types';
import { TAVERNDB_TEMPLATE_SHEET_IDS } from '../../types/taverndb';
import type { TavernDBSheetId, TavernDBSheetPatch } from '../../types/taverndb';
import { createNewGameState } from '../../utils/dataMapper';
import { advanceGameTimeByMinutes, formatGameTime, gameTimeToMinutes, advanceDateString } from './time';
import { ensurePhoneStateBase } from './phoneUtils';
import { buildPhoneStateFromTables } from '../../utils/taverndb/phoneTableAdapter';
import { applyDynamicLandmarks } from '../../utils/mapDynamic';
import { ensureDerivedStats, migrateNpcActionsToTracking } from './state';
import { applyFamousIpFirstTurnEnrichment, fetchFamousIpProfileWithAI } from '../../utils/ipCharacterEnrichment';
import { generateDungeonMasterResponse, generatePhoneResponse, generateWorldInfoResponse, DEFAULT_PROMPT_MODULES, DEFAULT_MEMORY_CONFIG, dispatchAIRequest, extractThinkingBlocks, parseAIResponseText, mergeThinkingSegments, resolveRequestTimeoutMs, resolveServiceConfig, generateServiceCommands } from '../../utils/ai';
import { Difficulty } from '../../types/enums';
import { createMicroserviceQueue } from '../../utils/microserviceQueue';
import { createApplyCommandsWithTurnTransaction } from './microservice/applyTransaction';
import { filterCommandsForService } from './microservice/commandGuard';
import { createServiceInputBuilder } from './microservice/inputBuilder';
import { executeServiceRequest } from './microservice/serviceRunner';
import { filterStoryCommands, getAiRoutingProfile, shouldUseNarrativeOnlyPipeline } from '../../utils/aiRouting';
import { useCommandQueue, CommandItem, CommandKind } from './commandQueue';
import { useSettingsManager } from './settings';
import { getManagedJson, getSaveStorageKey, saveSlotToStorage, loadGlobalSystemSettings } from '../../utils/storage/storageAdapter';
import { parseMapStructure } from '../../utils/mapStructure';
import { reconcileEquipmentNameByInventory } from '../../utils/equipmentLinking';
import { getDomainMappingRegistry, getSheetRegistry } from '../../utils/taverndb/sheetRegistry';
import { assignAmIndexesForLogCommands, collectIndexedLogPairingIssues, normalizeAmIndex } from '../../utils/memory/amIndex';
import { buildMemoryIndexProjection } from '../../utils/memory/memoryIndexProjection';
import { retrieveMemoryByQuery } from '../../utils/memory/memoryRetriever';
import {
    isMemoryOutlineTextValid,
    isMemorySummaryTextValid,
    isNumericPlaceholderText as isNumericPlaceholderTextByPolicy,
    normalizeMemoryText as normalizeMemoryTextByPolicy
} from '../../utils/memory/memoryTextPolicy';
import { validateStateInvariants } from '../../utils/state/invariants';
import { isPlayerReference, replaceUserPlaceholders, replaceUserPlaceholdersDeep, resolvePlayerName } from '../../utils/userPlaceholder';
import { normalizeStoryResponseLogs } from '../../utils/logSegmentation';
import {
    handleSetEncounterRows,
    handleUpsertBattleMapRows,
    handleSetMapVisuals,
    handleSetInitiative,
    handleConsumeDiceRows,
    handleRefillDicePool,
    handleRollDiceCheck,
    handleSetActionEconomy,
    handleSpendActionResource,
    handleResolveAttackCheck,
    handleResolveSavingThrow,
    handleResolveDamageRoll,
    handleAppendCombatResolution,
    handleAppendLogSummary,
    handleAppendLogOutline,
    handleSetActionOptions,
    handleUpsertNPC,
    handleUpsertInventory,
    handleAppendEconomicLedger,
    handleApplyEconomicDelta,
    handleUpsertSheetRows,
    handleDeleteSheetRows
} from './extendedCommands';
const DEFAULT_AI_CONFIG = {
    provider: 'gemini' as const,
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    modelId: 'gemini-3-flash-preview'
};

const DEFAULT_SERVICE_CONFIG = {
    story: { provider: 'gemini' as const, baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
    memory: { provider: 'gemini' as const, baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
    map: { provider: 'gemini' as const, baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
    social: { provider: 'gemini' as const, baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
    world: { provider: 'gemini' as const, baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
    npcSync: { provider: 'gemini' as const, baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
    npcBrain: { provider: 'gemini' as const, baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
    phone: { provider: 'gemini' as const, baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
    state: { provider: 'gemini' as const, baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false }
};

const GLOBAL_STATE_ROW_ID = 'GLOBAL_STATE';

const DEFAULT_CONTEXT_MODULES: ContextModuleConfig[] = [
    { id: 'm_sys', type: 'SYSTEM_PROMPTS', name: '系统核心设定', enabled: true, order: 0, params: {} },
    { id: 'm_world', type: 'WORLD_CONTEXT', name: '世界动态', enabled: true, order: 1, params: {} },
    { id: 'm_map', type: 'MAP_CONTEXT', name: '地图环境', enabled: true, order: 2, params: { detailLevel: 'medium', alwaysIncludeDungeon: true } },
    { id: 'm_player', type: 'PLAYER_DATA', name: '玩家数据', enabled: true, order: 3, params: {} },
    { id: 'm_social', type: 'SOCIAL_CONTEXT', name: '周边NPC', enabled: true, order: 4, params: { includeAttributes: ['appearance', 'status'], presentMemoryLimit: 30, absentMemoryLimit: 6, specialPresentMemoryLimit: 30, specialAbsentMemoryLimit: 12 } },
    { id: 'm_familia', type: 'FAMILIA_CONTEXT', name: '眷族信息', enabled: true, order: 5, params: {} },
    { id: 'm_inv', type: 'INVENTORY_CONTEXT', name: '背包/战利品', enabled: true, order: 6, params: { detailLevel: 'medium' } },
    {
        id: 'm_phone',
        type: 'PHONE_CONTEXT',
        name: '手机/消息',
        enabled: true,
        order: 7,
        params: {
            perThreadLimit: 10,
            includeMoments: true,
            momentLimit: 6,
            includePublicPosts: true,
            forumLimit: 6,
            excludeThreadTitles: ['公会导航服务', '健康统计助手', '健康服务助手']
        }
    },
    { id: 'm_combat', type: 'COMBAT_CONTEXT', name: '战斗数据', enabled: true, order: 8, params: {} }, 
    { id: 'm_task', type: 'TASK_CONTEXT', name: '任务列表', enabled: true, order: 9, params: {} },
    { id: 'm_story', type: 'STORY_CONTEXT', name: '剧情进度', enabled: true, order: 10, params: {} },
    { id: 'm_contract', type: 'CONTRACT_CONTEXT', name: '契约书', enabled: true, order: 11, params: {} },
    {
        id: 'm_mem',
        type: 'MEMORY_CONTEXT',
        name: '记忆流',
        enabled: true,
        order: 12,
        params: {
            aiOnlyContext: true,
            includePrecedingUser: true,
            contextLayerLimit: 12,
            retrievalMode: 'narrative',
            retrievalTopK: 8,
            enableMemoryRetrieval: true,
            enableTableRetrieval: true,
            enableIndexRetrieval: true,
            enableFactBoundary: true,
            indexRetrievalTopK: 6,
            indexSummaryWindow: 16,
            indexOutlineWindow: 12,
            indexSourceFilter: ['paired', 'summary', 'outline']
        }
    },
    { id: 'm_hist', type: 'COMMAND_HISTORY', name: '指令历史', enabled: true, order: 13, params: {} },
    { id: 'm_input', type: 'USER_INPUT', name: '玩家输入', enabled: true, order: 14, params: {} },
];

export const DEFAULT_SETTINGS: AppSettings = {
    backgroundImage: '',
    fontSize: 'medium',
    enableActionOptions: true,
    enableStreaming: true,
    enableCombatUI: true,
    chatLogLimit: 30,
    promptModules: DEFAULT_PROMPT_MODULES,
    memoryConfig: DEFAULT_MEMORY_CONFIG,
    contextConfig: { modules: DEFAULT_CONTEXT_MODULES },
    aiConfig: {
        nativeThinkingChain: true,
        services: {
            story: { ...DEFAULT_SERVICE_CONFIG.story },
            memory: { ...DEFAULT_SERVICE_CONFIG.memory },
            map: { ...DEFAULT_SERVICE_CONFIG.map },
            state: { ...DEFAULT_SERVICE_CONFIG.state },
        },
        requestTimeoutMs: 45000,
        serviceRequestTimeoutMs: {
            story: 45000,
            memory: 20000,
            map: 45000,
            state: 30000
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

const MICROSERVICE_PRIORITIES: Record<string, number> = {
    state: 0,
    memory: 1,
    npcSync: 2,
    social: 3,
    npcBrain: 4,
    map: 5,
    world: 6,
    phone: 7
};

const MICROSERVICE_QUEUE_OPTIONS = {
    maxConcurrent: 2,
    laneConcurrency: {
        default: 1,
        memory: 1,
        state: 1,
        npcSync: 1,
        social: 1,
        npcBrain: 1,
        map: 1,
        world: 1,
        phone: 1
    }
};

const MEMORY_FILL_BATCH_SIZE_DEFAULT = 5;
const MEMORY_REQUEST_TIMEOUT_DEFAULT_MS = 20000;
const STATE_FILL_BATCH_SIZE = 10;
const STATE_FILL_MAX_CONCURRENT_BATCHES = 5;
const MEMORY_FILL_FLUSH_DELAY_DEFAULT_MS = 40;

type MemoryFillJob = {
    turnIndex: number;
    playerInput: string;
    logs: { sender: string; text: string }[];
    appliedCommands: TavernCommand[];
    stateSnapshot: GameState;
    enqueuedAt: number;
};

const SHEET_PRIMARY_KEY_LOOKUP = new Map<string, string>(
    getDomainMappingRegistry().map((mapping) => [String(mapping.sheetId || ''), String(mapping.primaryKey || '')])
);

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

const normalizeLocationName = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value
        .trim()
        .toLowerCase()
        .replace(/[\s·•_\-()（）[\]【】,，.。:：]/g, '');
};

const TASK_RANKS: Task['评级'][] = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];

const normalizeTaskStatus = (value: unknown): Task['状态'] => {
    const text = String(value || '').trim().toLowerCase();
    if (text === 'completed' || text === '已完成') return 'completed';
    if (text === 'failed' || text === '失败' || text === '已失败') return 'failed';
    return 'active';
};

const normalizeTaskRank = (value: unknown, fallback: Task['评级'] = 'E'): Task['评级'] => {
    const text = String(value || '').trim().toUpperCase();
    return (TASK_RANKS as string[]).includes(text) ? (text as Task['评级']) : fallback;
};

const normalizeTaskText = (value: unknown): string => {
    let text = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\s·•_\-()（）\[\]【】{}<>《》,，.。:：;；!?！？'"“”‘’、/\\]/g, '');
    if (!text) return '';

    const prefixes = ['已完成', '完成', '去完成', '前往', '进行', '开始', '继续', '执行', '请', '去'];
    let changed = true;
    while (changed && text.length > 1) {
        changed = false;
        for (const prefix of prefixes) {
            if (text.startsWith(prefix) && text.length > prefix.length + 1) {
                text = text.slice(prefix.length);
                changed = true;
            }
        }
    }

    if (text.endsWith('任务') && text.length > 2) {
        text = text.slice(0, -2);
    }
    return text;
};

const isTaskLikelyDuplicate = (left: Partial<Task> | null | undefined, right: Partial<Task> | null | undefined): boolean => {
    if (!left || !right) return false;
    const leftId = String(left.id || '').trim();
    const rightId = String(right.id || '').trim();
    if (leftId && rightId && leftId === rightId) return true;

    const leftTitle = normalizeTaskText(left.标题);
    const rightTitle = normalizeTaskText(right.标题);
    if (leftTitle && rightTitle) {
        if (leftTitle === rightTitle) return true;
        if (Math.min(leftTitle.length, rightTitle.length) >= 4 && (leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle))) {
            return true;
        }
    }

    const leftDesc = normalizeTaskText(left.描述);
    const rightDesc = normalizeTaskText(right.描述);
    if (leftDesc && rightDesc) {
        if (leftDesc === rightDesc) return true;
        if (Math.min(leftDesc.length, rightDesc.length) >= 8 && (leftDesc.includes(rightDesc) || rightDesc.includes(leftDesc))) {
            return true;
        }
    }

    if (leftTitle && rightDesc && Math.min(leftTitle.length, rightDesc.length) >= 4 && (leftTitle.includes(rightDesc) || rightDesc.includes(leftTitle))) {
        return true;
    }
    if (rightTitle && leftDesc && Math.min(rightTitle.length, leftDesc.length) >= 4 && (rightTitle.includes(leftDesc) || leftDesc.includes(rightTitle))) {
        return true;
    }

    return false;
};

const mergeTaskLogs = (baseLogs?: any[], incomingLogs?: any[]) => {
    const merged: any[] = [];
    const seen = new Set<string>();
    const source = [
        ...(Array.isArray(baseLogs) ? baseLogs : []),
        ...(Array.isArray(incomingLogs) ? incomingLogs : [])
    ];

    source.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const content = String((entry as any).内容 ?? '').trim();
        const timestamp = String((entry as any).时间戳 ?? '').trim() || '未知';
        if (!content) return;
        const key = `${timestamp}::${content}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push({ ...(entry as any), 内容: content, 时间戳: timestamp });
    });

    return merged;
};

const getTaskStatusPriority = (status: Task['状态']) => {
    if (status === 'completed') return 3;
    if (status === 'failed') return 2;
    return 1;
};

const normalizeTaskRecord = (task: Partial<Task>, nowTime: string): Task => {
    const title = String(task.标题 || '').trim();
    const desc = String(task.描述 || '').trim();
    const safeTitle = title || (desc.length > 28 ? `${desc.slice(0, 28)}...` : desc) || '未命名任务';
    const safeDesc = desc || safeTitle;
    const safeStatus = normalizeTaskStatus(task.状态);
    return {
        id: String(task.id || '').trim() || generateLegacyId(),
        标题: safeTitle,
        描述: safeDesc,
        状态: safeStatus,
        奖励: String(task.奖励 || '').trim() || '待定',
        评级: normalizeTaskRank(task.评级, 'E'),
        接取时间: String(task.接取时间 || '').trim() || nowTime || '未知',
        结束时间: task.结束时间 ? String(task.结束时间) : undefined,
        截止时间: task.截止时间 ? String(task.截止时间) : undefined,
        日志: mergeTaskLogs(undefined, task.日志)
    };
};

const mergeTaskRecord = (baseTask: Task, incomingTask: Partial<Task>, nowTime: string): Task => {
    const normalizedIncoming = normalizeTaskRecord(incomingTask, nowTime);
    const baseStatus = normalizeTaskStatus(baseTask.状态);
    const nextStatus = normalizeTaskStatus(normalizedIncoming.状态);
    const status = getTaskStatusPriority(nextStatus) > getTaskStatusPriority(baseStatus) ? nextStatus : baseStatus;

    return {
        ...baseTask,
        ...normalizedIncoming,
        id: String(baseTask.id || normalizedIncoming.id || '').trim() || generateLegacyId(),
        标题: String(baseTask.标题 || normalizedIncoming.标题 || '').trim() || '未命名任务',
        描述: String(normalizedIncoming.描述 || baseTask.描述 || '').trim() || String(baseTask.标题 || normalizedIncoming.标题 || '任务').trim(),
        状态: status,
        奖励: String(normalizedIncoming.奖励 || baseTask.奖励 || '').trim() || '待定',
        评级: normalizeTaskRank(normalizedIncoming.评级, normalizeTaskRank(baseTask.评级, 'E')),
        接取时间: String(baseTask.接取时间 || normalizedIncoming.接取时间 || nowTime || '未知').trim() || '未知',
        结束时间: normalizedIncoming.结束时间 || baseTask.结束时间,
        截止时间: normalizedIncoming.截止时间 || baseTask.截止时间,
        日志: mergeTaskLogs(baseTask.日志, normalizedIncoming.日志)
    };
};

const dedupeTasks = (tasks: Task[] | undefined, nowTime: string): Task[] => {
    if (!Array.isArray(tasks) || tasks.length === 0) return [];

    const merged: Task[] = [];
    tasks.forEach((rawTask) => {
        if (!rawTask || typeof rawTask !== 'object') return;
        const normalizedTask = normalizeTaskRecord(rawTask, nowTime);
        const duplicateIndex = merged.findIndex((existingTask) => isTaskLikelyDuplicate(existingTask, normalizedTask));
        if (duplicateIndex >= 0) {
            merged[duplicateIndex] = mergeTaskRecord(merged[duplicateIndex], normalizedTask, nowTime);
            return;
        }
        merged.push(normalizedTask);
    });

    return merged;
};

const isSameLocation = (a?: unknown, b?: unknown): boolean => {
    const na = normalizeLocationName(a);
    const nb = normalizeLocationName(b);
    if (!na || !nb) return false;
    return na.includes(nb) || nb.includes(na);
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const SNAPSHOT_OMIT_KEYS = new Set(['snapshot', 'rawResponse']);
const perfNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

const createStorageSnapshotString = (state: GameState): string => {
    try {
        return JSON.stringify(state, (key, value) => {
            if (SNAPSHOT_OMIT_KEYS.has(key)) return undefined;
            return value;
        });
    } catch (error) {
        console.warn('createStorageSnapshotString fallback', error);
        return JSON.stringify(state);
    }
};

const createStorageSnapshot = (state: GameState): GameState => {
    let copy: GameState;
    try {
        copy = JSON.parse(createStorageSnapshotString(state)) as GameState;
    } catch (error) {
        console.warn('createStorageSnapshot parse fallback', error);
        copy = structuredClone(state);
        if (copy.日志) {
            copy.日志 = copy.日志.map((l: any) => {
                const { snapshot, rawResponse, ...cleanLog } = l;
                return cleanLog as LogEntry;
            });
        }
    }

    if (!copy.地图) copy.地图 = state.地图;
    if (!copy.战利品) copy.战利品 = [];
    if (!copy.记忆) copy.记忆 = { lastLogIndex: 0 };

    return copy;
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

const reconcileEquipmentWithInventory = (state: GameState): GameState => {
    const equipment = state?.角色?.装备;
    const inventory = Array.isArray(state?.背包) ? state.背包 : [];
    if (!equipment || inventory.length === 0) return state;

    const normalizedSlots: Record<string, string> = {};
    Object.entries(equipment).forEach(([slot, raw]) => {
        if (typeof raw !== 'string') return;
        const name = raw.trim();
        if (!name) return;
        normalizedSlots[slot] = name;
    });

    const reconciled = reconcileEquipmentNameByInventory(normalizedSlots, inventory);
    if (!reconciled.changed) return state;

    return {
        ...state,
        角色: {
            ...state.角色,
            装备: {
                ...equipment,
                ...reconciled.equipment
            }
        }
    };
};

const buildInventorySyncRows = (state: GameState): Array<Record<string, unknown>> => {
    const ownerFallback = String(state?.角色?.姓名 ?? '').trim();
    const inventory = Array.isArray(state?.背包) ? state.背包 : [];
    return inventory
        .map((item, index) => {
            if (!item || typeof item !== 'object') return null;
            const name = String((item as any).名称 ?? (item as any).物品名称 ?? '').trim();
            if (!name) return null;
            const quantityNum = Number((item as any).数量);
            const itemId = String((item as any).id ?? (item as any).物品ID ?? name).trim() || `ITEM_${index + 1}`;
            return {
                物品ID: itemId,
                物品名称: name,
                类别: String((item as any).类型 ?? (item as any).类别 ?? '').trim() || undefined,
                数量: Number.isFinite(quantityNum) ? Math.max(0, Math.floor(quantityNum)) : 1,
                已装备: (item as any).已装备 ? '是' : '否',
                所属人: String((item as any).所属人 ?? ownerFallback).trim() || undefined,
                伤害: String((item as any).伤害 ?? (item as any).武器?.伤害类型 ?? '').trim() || undefined,
                特性: String((item as any).特性 ?? (item as any).效果 ?? (item as any).武器?.特性 ?? '').trim() || undefined,
                稀有度: String((item as any).稀有度 ?? (item as any).品质 ?? '').trim() || undefined,
                描述: String((item as any).描述 ?? '').trim(),
                重量: Number.isFinite(Number((item as any).重量)) ? Number((item as any).重量) : undefined,
                价值: Number.isFinite(Number((item as any).价值)) ? Number((item as any).价值) : undefined
            } as Record<string, unknown>;
        })
        .filter((row): row is Record<string, unknown> => !!row);
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
            const safeState = { ...initialState } as any;
            if (!safeState.记忆) {
                safeState.记忆 = { lastLogIndex: 0 };
            }
            if (!Array.isArray(safeState.日志)) {
                safeState.日志 = [];
            }
            // Migration
            if (typeof safeState.记忆.lastLogIndex !== 'number') {
                safeState.记忆.lastLogIndex = Math.max(0, safeState.日志.length - 10);
            }
            return ensureDerivedStats(migrateNpcActionsToTracking(safeState));
        }
        return ensureDerivedStats(migrateNpcActionsToTracking(createNewGameState("Adventurer", "男", "Human")));
    });

    const { settings, setSettings, saveSettings } = useSettingsManager({ defaultSettings: DEFAULT_SETTINGS, gameState });
    const {
        commandQueue,
        pendingCommands,
        addToQueue,
        removeFromQueue,
        clearPendingCommands,
        consumeCommandQueue,
        setPendingCommands,
    } = useCommandQueue();
    const [currentOptions, setCurrentOptions] = useState<ActionOption[]>([]);
    const [lastAIResponse, setLastAIResponse] = useState<string>('');

    useEffect(() => {
        if (currentOptions.length > 0) return;
        const stateOptions = gameState?.可选行动列表;
        if (Array.isArray(stateOptions) && stateOptions.length > 0) {
            setCurrentOptions(stateOptions as ActionOption[]);
        }
    }, [gameState?.可选行动列表, currentOptions.length]);
    const [lastAIThinking, setLastAIThinking] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isPhoneProcessing, setIsPhoneProcessing] = useState(false);
    const [phoneProcessingThreadId, setPhoneProcessingThreadId] = useState<string | null>(null);
    const [phoneProcessingScope, setPhoneProcessingScope] = useState<'chat' | 'moment' | 'forum' | 'sync' | null>(null);
    const [draftInput, setDraftInput] = useState<string>('');
    const [phoneNotifications, setPhoneNotifications] = useState<{ id: string; title: string; message: string }[]>([]);
    const [isMapUpdating, setIsMapUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const microserviceQueueRef = useRef(createMicroserviceQueue(MICROSERVICE_QUEUE_OPTIONS));
    const memoryFillJobsRef = useRef<MemoryFillJob[]>([]);
    const memoryFillFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const silentUpdateInFlight = useRef(false);
    const lastWorldUpdateRef = useRef<number | null>(null);
    const lastWorldIntervalRef = useRef<number | null>(null);
    const activeMemoryRequestControllersRef = useRef<Set<AbortController>>(new Set());
    const abortControllerRef = useRef<AbortController | null>(null);
    const activePhoneRequestControllersRef = useRef<Set<AbortController>>(new Set());
    const phoneSummaryInFlight = useRef<Set<string>>(new Set());
    const npcMemorySummaryInFlight = useRef<Set<string>>(new Set());
    const npcTrackingSummaryInFlight = useRef(false);
    const forumAutoInFlightRef = useRef(false);
    const stateEpochRef = useRef(0);
    const lastForumAutoTurnRef = useRef<number | null>(null);
    const forumPendingUserReplyQueueRef = useRef<Array<{
        replyId: string;
        postId: string;
        postTitle: string;
        boardName: string;
        replyContent: string;
        replyTime: string;
    }>>([]);

    const isMemoryParallelBySheetEnabled = (): boolean => {
        return settings.memoryConfig?.memoryParallelBySheet === true;
    };

    const resolveMemoryFillBatchSize = (): number => {
        const raw = Number(settings.memoryConfig?.memoryFillBatchSize);
        if (!Number.isFinite(raw)) return MEMORY_FILL_BATCH_SIZE_DEFAULT;
        const normalized = Math.floor(raw);
        if (normalized < 1) return 1;
        if (normalized > 12) return 12;
        return normalized;
    };

    const resolveMemoryFillFlushDelayMs = (): number => {
        const raw = Number(settings.memoryConfig?.memoryFillFlushDelayMs);
        if (!Number.isFinite(raw)) return MEMORY_FILL_FLUSH_DELAY_DEFAULT_MS;
        const normalized = Math.floor(raw);
        if (normalized < 0) return 0;
        if (normalized > 2000) return 2000;
        return normalized;
    };

    const resolveMemoryRequestTimeoutMs = (): number => {
        const raw = Number(settings.memoryConfig?.memoryRequestTimeoutMs);
        if (!Number.isFinite(raw)) return MEMORY_REQUEST_TIMEOUT_DEFAULT_MS;
        const normalized = Math.floor(raw);
        if (normalized < 1000) return 1000;
        if (normalized > 120000) return 120000;
        return normalized;
    };

    const abortActiveMemoryServiceRequests = () => {
        if (activeMemoryRequestControllersRef.current.size === 0) return;
        for (const controller of activeMemoryRequestControllersRef.current) {
            try {
                controller.abort();
            } catch {}
        }
        activeMemoryRequestControllersRef.current.clear();
    };

    const abortActivePhoneServiceRequests = () => {
        if (activePhoneRequestControllersRef.current.size === 0) return;
        for (const controller of activePhoneRequestControllersRef.current) {
            try {
                controller.abort();
            } catch {}
        }
        activePhoneRequestControllersRef.current.clear();
    };

    const createMemoryRequestGuard = () => {
        const controller = new AbortController();
        activeMemoryRequestControllersRef.current.add(controller);
        const timeoutMs = resolveMemoryRequestTimeoutMs();
        const timer = setTimeout(() => {
            controller.abort();
        }, timeoutMs);
        const cleanup = () => {
            clearTimeout(timer);
            activeMemoryRequestControllersRef.current.delete(controller);
        };
        return { signal: controller.signal, timeoutMs, cleanup };
    };

    const createPhoneRequestGuard = (timeoutService: 'phone' | 'story' = 'phone') => {
        const controller = new AbortController();
        activePhoneRequestControllersRef.current.add(controller);
        const timeoutMs = resolveRequestTimeoutMs(settings, timeoutService);
        const timer = setTimeout(() => {
            controller.abort();
        }, timeoutMs);
        const cleanup = () => {
            clearTimeout(timer);
            activePhoneRequestControllersRef.current.delete(controller);
        };
        return { signal: controller.signal, timeoutMs, cleanup };
    };

    const runPhoneGenerationRequest = async (
        input: string,
        stateSnapshot: GameState,
        options: { cancelPrevious?: boolean; timeoutService?: 'phone' | 'story' } = {}
    ) => {
        const cancelPrevious = options.cancelPrevious !== false;
        if (cancelPrevious) {
            abortActivePhoneServiceRequests();
        }
        const requestGuard = createPhoneRequestGuard(options.timeoutService || 'phone');
        try {
            return await generatePhoneResponse(input, stateSnapshot, settings, requestGuard.signal);
        } finally {
            requestGuard.cleanup();
        }
    };

    useEffect(() => {
        setGameState(prev => {
            if (!prev.手机) return prev;
            const before = JSON.stringify({
                dialog: prev.手机.对话,
                pending: prev.手机.待发送
            });
            const next = structuredClone(prev);
            ensurePhoneStateBase(next);
            const after = JSON.stringify({
                dialog: next.手机?.对话,
                pending: next.手机?.待发送
            });
            return before === after ? prev : next;
        });
    }, []);

    useEffect(() => {
        return () => {
            if (memoryFillFlushTimerRef.current) {
                clearTimeout(memoryFillFlushTimerRef.current);
                memoryFillFlushTimerRef.current = null;
            }
            abortActiveMemoryServiceRequests();
            abortActivePhoneServiceRequests();
        };
    }, []);

    const bumpStateEpoch = () => {
        stateEpochRef.current += 1;
        abortActiveMemoryServiceRequests();
        abortActivePhoneServiceRequests();
        memoryFillJobsRef.current = [];
        if (memoryFillFlushTimerRef.current) {
            clearTimeout(memoryFillFlushTimerRef.current);
            memoryFillFlushTimerRef.current = null;
        }
    };

    // Load persisted global system settings on mount
    useEffect(() => {
        loadGlobalSystemSettings<Record<string, any>>()
            .then(globalSettings => {
                if (!globalSettings) return;
                setGameState(prev => ({
                    ...prev,
                    系统设置: {
                        世界更新间隔回合: 3,
                        通知设置: { 新闻推送: true, 传闻更新: true, 私信通知: true, 论坛动态: true },
                        订阅源: [],
                        ...(prev.系统设置 || {}),
                        ...globalSettings
                    } as SystemSettings
                }));
            })
            .catch(err => {
                console.warn('Failed to load global system settings', err);
            });
    }, []);

    useEffect(() => {
        if (gameState.回合数 < 1) {
            return;
        }

        const slotNum = Math.max(1, ((gameState.回合数 - 1) % 3) + 1);
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

        saveSlotToStorage(saveKey, saveData)
            .catch((error) => {
                console.error('Auto-save failed', error);
            });
    }, [gameState.回合数, gameState.当前地点, gameState.角色.头像, gameState.角色.等级, gameState.社交]);

    useEffect(() => {
        const social = Array.isArray(gameState.社交) ? gameState.社交 : [];
        social.forEach((npc, index) => {
            if ((npc?.记忆?.length || 0) > 20) {
                void compressNpcMemoryIfNeeded(gameState, index);
            }
        });
        if ((gameState.世界?.NPC后台跟踪?.length || 0) > 20) {
            void compressNpcTrackingIfNeeded(gameState);
        }
    }, [
        gameState.社交,
        gameState.世界?.NPC后台跟踪,
        gameState.回合数,
        settings.aiConfig?.services?.state?.apiKey
    ]);

    useEffect(() => {
        if (!gameState.地图) return;
        const locationName = gameState.当前地点 || '';
        const floor = typeof gameState.当前楼层 === 'number' ? gameState.当前楼层 : 0;
        const currentPos = gameState.世界坐标 || { x: 0, y: 0 };
        const story = gameState.剧情 as any;
        const storyText = [
            story?.备注,
            story?.主线?.当前篇章,
            story?.主线?.关键节点,
            story?.引导?.当前目标
        ].filter(Boolean).join(' ');
        const text = [locationName, storyText].filter(Boolean).join(' ');
        if (!text.trim()) return;
        const nextMap = applyDynamicLandmarks({
            mapData: gameState.地图,
            text,
            locationName,
            currentPos,
            floor,
            maxPerFloor: 60
        });
        const updatedLocations = (nextMap.surfaceLocations || []).map(loc => {
            if (!locationName || !loc?.name) return loc;
            const matched = locationName.includes(loc.name) || loc.name.includes(locationName);
            if (!matched || loc.visited) return loc;
            return { ...loc, visited: true };
        });
        const changed = updatedLocations.some((loc, idx) => loc !== nextMap.surfaceLocations?.[idx]);
        if (nextMap.surfaceLocations !== gameState.地图.surfaceLocations || changed) {
            setGameState(prev => ({
                ...prev,
                地图: {
                    ...prev.地图,
                    surfaceLocations: changed ? updatedLocations : nextMap.surfaceLocations
                }
            }));
        }
    }, [gameState.当前地点, gameState.剧情, gameState.世界坐标, gameState.当前楼层]);

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
        saveSlotToStorage(saveKey, saveData)
            .then(() => {
                console.log(`Saved to ${saveKey}`);
            })
            .catch(() => {
                alert('保存失败：本地存储空间不足');
            });
    };

    const loadGame = (slotId: number | string) => {
        const targetKey = getSaveStorageKey(slotId);
        getManagedJson<any>(targetKey).then((parsed) => {
            if (!parsed) {
                return;
            }

            let state = parsed.data || parsed;
            Promise.all([
                getManagedJson<any>('danmachi_system_settings_global')
            ])
                .then(([globalSettings]) => {
                    if (globalSettings) {
                        state = {
                            ...state,
                            系统设置: { ...(state.系统设置 || {}), ...globalSettings }
                        };
                    }
                    setGameState(ensureDerivedStats(state));
                })
                .catch(() => {
                    setGameState(ensureDerivedStats(state));
                });
        }).catch((error) => {
            console.error('Load failed', error);
        });
    };

    const LEGACY_PATH_ACTIONS = new Set(['set', 'add', 'push', 'delete']);
    const LEGACY_COMMAND_REWRITE_ENABLED = false;
    const STORY_TABLE_OWNED_ACTIONS = new Set([
        'append_log_summary',
        'append_log_outline',
        'upsert_npc',
        'upsert_inventory',
        'append_econ_ledger',
        'apply_econ_delta'
    ]);
    const STORY_TABLE_OWNED_SHEETS = new Set([
        'SYS_GlobalState',
        'LOG_Summary',
        'LOG_Outline',
        'NPC_Registry',
        'ITEM_Inventory',
        'QUEST_Active',
        'PHONE_Device',
        'PHONE_Contacts',
        'PHONE_Threads',
        'PHONE_Messages',
        'PHONE_Pending',
        'FORUM_Boards',
        'FORUM_Posts',
        'FORUM_Replies',
        'PHONE_Moments',
        'WORLD_NpcTracking',
        'WORLD_News',
        'WORLD_Rumors',
        'WORLD_Denatus',
        'WORLD_WarGame',
        'ECON_Ledger'
    ]);
    const TABLE_MANAGED_LEGACY_PATH_PREFIXES = [
        'gameState.日志摘要',
        'gameState.日志大纲',
        'gameState.社交',
        'gameState.背包',
        'gameState.任务',
        'gameState.剧情',
        'gameState.契约',
        'gameState.手机',
        'gameState.世界.NPC后台跟踪',
        'gameState.世界.头条新闻',
        'gameState.世界.街头传闻',
        'gameState.世界.诸神神会',
        'gameState.世界.战争游戏',
        'gameState.当前地点',
        'gameState.当前日期',
        'gameState.游戏时间',
        'gameState.上轮时间',
        'gameState.流逝时长',
        'gameState.场景描述',
        'gameState.天气',
        'gameState.战斗模式',
        'gameState.系统通知',
        'gameState.世界坐标',
        'gameState.角色.法利',
        'gameState.眷族.资金'
    ];
    const UI_TRANSIENT_PATH_PREFIXES = [
        'gameState.处理中',
        'gameState.当前界面',
        'gameState.日常仪表盘',
        '处理中',
        '当前界面',
        '日常仪表盘'
    ];

    const isUiTransientPath = (rawPath: string): boolean => {
        const normalized = String(rawPath || '').trim();
        if (!normalized) return false;
        return UI_TRANSIENT_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}.`));
    };

    const isTableManagedLegacyPath = (rawPath: unknown): boolean => {
        const normalized = String(rawPath || '').trim();
        if (!normalized) return false;
        return TABLE_MANAGED_LEGACY_PATH_PREFIXES.some(
            (prefix) => normalized === prefix || normalized.startsWith(`${prefix}.`) || normalized.startsWith(`${prefix}[`)
        );
    };

    const updateStateByPath = (state: any, path: string, value: any, action: string): { success: boolean, error?: string } => {
        const currentPlayerName = resolvePlayerName(state?.角色?.姓名);
        const normalizedValue = replaceUserPlaceholdersDeep(value, currentPlayerName);
        const normalizedAction = String(action || '').trim().toLowerCase();
        const rawPath = String(path || '').trim();
        if (!rawPath) return { success: false, error: 'Empty path' };
        const canonicalPath = rawPath.startsWith('gameState.') ? rawPath : `gameState.${rawPath}`;
        if (LEGACY_PATH_ACTIONS.has(normalizedAction) && !isUiTransientPath(rawPath) && isTableManagedLegacyPath(canonicalPath)) {
            return { success: false, error: `Legacy path action is blocked for business fields: ${normalizedAction} ${rawPath}` };
        }
        let cleanPath = rawPath.startsWith('gameState.') ? rawPath.replace('gameState.', '') : rawPath;
        cleanPath = cleanPath.replace(/^character\./, '角色.');
        cleanPath = cleanPath.replace(/^inventory\./, '背包.');
        cleanPath = cleanPath.replace(/^confidants(?=\.|\[|$)/, '社交');
        cleanPath = cleanPath.replace(/^social(?=\.|\[|$)/i, '社交');
        cleanPath = cleanPath.replace(/^time/, '游戏时间');
        cleanPath = cleanPath.replace(/^location/, '当前地点');
        const isSocialPath = /^社交(?=\.|\[|$)/.test(cleanPath);
        if (isSocialPath) {
            cleanPath = cleanPath.replace(/\.affinity$/i, '.好感度');
            cleanPath = cleanPath.replace(/\.favorability$/i, '.好感度');
            cleanPath = cleanPath.replace(/\.relationshipStatus$/i, '.关系状态');
            cleanPath = cleanPath.replace(/\.isPresent$/i, '.是否在场');
            cleanPath = cleanPath.replace(/\.hasContactInfo$/i, '.已交换联系方式');
            cleanPath = cleanPath.replace(/\.specialAttention$/i, '.特别关注');
            cleanPath = cleanPath.replace(/\.locationDetail$/i, '.位置详情');
            cleanPath = cleanPath.replace(/\.recentMemory$/i, '.记忆');
            cleanPath = cleanPath.replace(/\.memory$/i, '.记忆');
            cleanPath = cleanPath.replace(/\.memories$/i, '.记忆');
            const namedSocialRef = cleanPath.match(/^社交\[(?:"([^"]+)"|'([^']+)'|([^\]]+))\](.*)$/);
            if (namedSocialRef) {
                const rawRef = String(namedSocialRef[1] ?? namedSocialRef[2] ?? namedSocialRef[3] ?? '').trim();
                const suffix = String(namedSocialRef[4] || '');
                if (rawRef && /^\d+$/.test(rawRef)) {
                    cleanPath = `社交[${rawRef}]${suffix}`;
                } else if (rawRef) {
                    const socialList = Array.isArray(state?.社交) ? state.社交 : [];
                    const socialIndex = socialList.findIndex((npc: any) => {
                        const npcId = String(npc?.id ?? '').trim();
                        const npcName = String(npc?.姓名 ?? '').trim();
                        return rawRef === npcId || rawRef === npcName;
                    });
                    if (socialIndex < 0) {
                        return { success: false, error: `Social target not found: '${rawRef}' in '${cleanPath}'` };
                    }
                    cleanPath = `社交[${socialIndex}]${suffix}`;
                }
            }
        }
        cleanPath = cleanPath.replace(/\.strength$/, '.力量');
        cleanPath = cleanPath.replace(/\.vitality$/, '.耐久');
        cleanPath = cleanPath.replace(/\.dexterity$/, '.灵巧');
        cleanPath = cleanPath.replace(/\.agility$/, '.敏捷');
        cleanPath = cleanPath.replace(/\.magic$/, '.魔力');

        const normalizedPath = cleanPath.replace(/\[(\d+)\]/g, '.$1');
        const parts = normalizedPath.split('.');
        let current = state;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (current[part] === undefined || current[part] === null) return { success: false, error: `Invalid path: '${part}' in '${cleanPath}'` };
            // A-010 FIX: Add array bounds validation
            if (Array.isArray(current) && !isNaN(parseInt(part))) {
                const index = parseInt(part);
                if (index < 0 || index >= current.length) {
                    return { success: false, error: `Array index out of bounds: ${index} (length: ${current.length}) in '${cleanPath}'` };
                }
            }
            current = current[part];
        }
        const lastKey = parts[parts.length - 1];
        try {
            if (normalizedAction === 'set') {
                if (lastKey === '记忆' && !Array.isArray(normalizedValue)) {
                    const memoryList = Array.isArray(current[lastKey]) ? current[lastKey] : [];
                    const normalizedEntry = typeof normalizedValue === 'string'
                        ? { 内容: replaceUserPlaceholders(normalizedValue, currentPlayerName), 时间戳: state?.游戏时间 || '未知' }
                        : (normalizedValue && typeof normalizedValue === 'object'
                            ? {
                                内容: replaceUserPlaceholders(String((normalizedValue as any).内容 ?? (normalizedValue as any).content ?? ''), currentPlayerName),
                                时间戳: String((normalizedValue as any).时间戳 ?? (normalizedValue as any).timestamp ?? state?.游戏时间 ?? '未知')
                            }
                            : null);
                    if (normalizedEntry && normalizedEntry.内容) {
                        current[lastKey] = [...memoryList, normalizedEntry];
                    } else {
                        current[lastKey] = memoryList;
                    }
                } else {
                    current[lastKey] = normalizedValue;
                }
            }
            else if (normalizedAction === 'add') {
                const oldVal = current[lastKey] || 0;
                if (typeof oldVal === 'number') current[lastKey] = oldVal + (typeof normalizedValue === 'number' ? normalizedValue : parseFloat(normalizedValue as any) || 0);
            } else if (normalizedAction === 'push') {
                if (!Array.isArray(current[lastKey])) {
                    if (current[lastKey] === undefined) current[lastKey] = [];
                    else return { success: false, error: `Target '${lastKey}' is not array` };
                }
                if (lastKey === '背包' || rawPath.includes('inventory') || lastKey === '公共战利品' || lastKey === '战利品') {
                    const newItem = normalizedValue as InventoryItem;
                    const compItem: InventoryItem = { ...newItem, id: newItem.id, 名称: newItem.名称, 描述: newItem.描述, 数量: newItem.数量 || 1, 类型: newItem.类型 || 'loot' };

                    // Prefer id-based merge when available
                    let existingIdx = compItem.id
                        ? current[lastKey].findIndex((i: InventoryItem) => i.id && compItem.id && i.id === compItem.id)
                        : -1;

                    // Fallback to name + quality merge when no id match
                    if (existingIdx < 0) {
                        existingIdx = current[lastKey].findIndex((i: InventoryItem) =>
                            i.名称 === compItem.名称 &&
                            (i.品质 === compItem.品质 || (!i.品质 && !compItem.品质))
                        );
                    }

                    if (existingIdx >= 0) current[lastKey][existingIdx].数量 += (compItem.数量 || 1);
                    else {
                        if (!compItem.id) compItem.id = generateNextId("Item", current[lastKey]);
                        current[lastKey].push(compItem);
                    }
                } else if (lastKey === '记忆' && Array.isArray(normalizedValue)) {
                    const normalizedMemories = normalizedValue.map((entry: any) => {
                        if (!entry || typeof entry !== 'object') return entry;
                        return {
                            ...entry,
                            内容: replaceUserPlaceholders(String(entry.内容 ?? entry.content ?? ''), currentPlayerName)
                        };
                    });
                    current[lastKey].push(...normalizedMemories);
                } else if (lastKey === '社交' || rawPath.includes('社交') && !rawPath.includes('.')) {
                    // A-XXX FIX: Default 是否在场 to true for new NPCs via push so they appear in "周围的人"
                    const npcData = normalizedValue && typeof normalizedValue === 'object' ? normalizedValue : {};
                    const newNpc = {
                        记忆: [],
                        好感度: 0,
                        关系状态: '普通',
                        种族: '未知',
                        眷族: '无',
                        身份: '未知',
                        特别关注: false,
                        是否在场: true,
                        当前状态: '在场',
                        ...npcData
                    };
                    current[lastKey].push(newNpc);
                } else {
                    current[lastKey].push(normalizedValue);
                }
            } else if (normalizedAction === 'delete') {
               if (Array.isArray(current) && !isNaN(parseInt(lastKey))) current.splice(parseInt(lastKey), 1);
               else delete current[lastKey];
            }
            return { success: true };
        } catch (e: any) { return { success: false, error: e.message }; }
    };

    const extractExplorationMapPayload = (
        payload: any,
        fallbackLocationName: string
    ): { locationName: string; mapStructure: any } | null => {
        if (!payload || typeof payload !== 'object') return null;
        const nestedValue = payload.value && typeof payload.value === 'object' ? payload.value : null;
        const source = nestedValue || payload;
        const locationName = [
            source.LocationName,
            source.locationName,
            source.location,
            source.name,
            source.mapName,
            fallbackLocationName
        ].find((item) => typeof item === 'string' && item.trim()) || '';

        let mapStructure = source.MapStructureJSON
            ?? source.mapStructure
            ?? source.map_structure
            ?? source.MapStructure
            ?? source.structure
            ?? source.structure_json
            ?? source.mapStructureJSON;

        if (!mapStructure && (source.rooms || source.mapSize || source.doors || source.features)) {
            mapStructure = source;
        }

        if (!mapStructure) return null;
        return {
            locationName: String(locationName || '').trim(),
            mapStructure
        };
    };

    const resolvePreferredMapLocationName = (state: GameState): string => {
        const current = typeof state.当前地点 === 'string' ? state.当前地点.trim() : '';
        if (current) return current;
        const mid = (state.地图?.midLocations || []).find(loc => !!loc?.name)?.name;
        if (mid) return mid;
        return '当前区域';
    };

    const hasRenderableStructureForLocation = (state: GameState, locationName: unknown): boolean => {
        const midLocs = Array.isArray(state.地图?.midLocations) ? state.地图!.midLocations : [];
        const targets = midLocs.filter(loc => isSameLocation(locationName, loc?.name));
        if (targets.length === 0) return false;
        return targets.some(loc => !!parseMapStructure((loc as any)?.mapStructure ?? null));
    };

    const buildFallbackMapStructure = (locationName: string, width: number, height: number) => {
        const mapWidth = clamp(Math.round(width || 800), 600, 1800);
        const mapHeight = clamp(Math.round(height || 600), 420, 1400);
        const unit = Math.max(26, Math.round(mapWidth / 24));
        const room = (
            id: string,
            name: string,
            type: string,
            x: number,
            y: number,
            w: number,
            h: number,
            color: string,
            points?: { x: number; y: number }[]
        ) => ({
            id,
            name,
            type,
            shape: 'rectangular',
            x,
            y,
            width: w,
            height: h,
            color,
            points
        });

        const rooms = [
            room('room_entrance', '入口回廊', 'entrance', unit * 1, unit * 8, unit * 4, unit * 3, '#1f2d46'),
            room('room_guard', '警戒前厅', 'hall', unit * 5, unit * 7, unit * 5, unit * 4, '#243c5a'),
            room(
                'room_west',
                '侧廊',
                'corridor',
                unit * 10,
                unit * 7,
                unit * 2,
                unit * 9,
                '#0f2e5c',
                [
                    { x: unit * 10, y: unit * 7 + 3 },
                    { x: unit * 12 - 2, y: unit * 7 },
                    { x: unit * 12, y: unit * 16 - 3 },
                    { x: unit * 10 + 2, y: unit * 16 }
                ]
            ),
            room(
                'room_center',
                '主厅',
                'hall',
                unit * 12,
                unit * 6,
                unit * 7,
                unit * 6,
                '#274a68',
                [
                    { x: unit * 12 + 2, y: unit * 6 + 2 },
                    { x: unit * 19 - 1, y: unit * 6 },
                    { x: unit * 19, y: unit * 12 - 2 },
                    { x: unit * 12, y: unit * 12 }
                ]
            ),
            room('room_archive', '资料室', 'room', unit * 19, unit * 6, unit * 4, unit * 4, '#3d3b5f'),
            room('room_storage', '储藏区', 'room', unit * 19, unit * 10, unit * 4, unit * 4, '#4f4340'),
            room(
                'room_corridor',
                '下行走廊',
                'corridor',
                unit * 8,
                unit * 13,
                unit * 8,
                unit * 2,
                '#143449',
                [
                    { x: unit * 8 + 1, y: unit * 13 },
                    { x: unit * 16 - 1, y: unit * 13 + 1 },
                    { x: unit * 16, y: unit * 15 - 1 },
                    { x: unit * 8, y: unit * 15 }
                ]
            ),
            room('room_vault', '物资库', 'room', unit * 5, unit * 15, unit * 6, unit * 4, '#52463e'),
            room(
                'room_core',
                '核心区',
                'boss',
                unit * 13,
                unit * 15,
                unit * 8,
                unit * 4,
                '#5d4b3a',
                [
                    { x: unit * 13 + 2, y: unit * 15 + 1 },
                    { x: unit * 21 - 2, y: unit * 15 },
                    { x: unit * 21, y: unit * 19 - 2 },
                    { x: unit * 13, y: unit * 19 }
                ]
            )
        ];

        const door = (x: number, y: number, connects: string[], orientation: 'horizontal' | 'vertical' = 'vertical', type = 'door') => ({
            x,
            y,
            type,
            orientation,
            connects
        });

        const doors = [
            door(unit * 5, unit * 9, ['room_entrance', 'room_guard']),
            door(unit * 10, unit * 9, ['room_guard', 'room_west']),
            door(unit * 12, unit * 9, ['room_west', 'room_center']),
            door(unit * 19, unit * 8, ['room_center', 'room_archive']),
            door(unit * 19, unit * 12, ['room_center', 'room_storage']),
            door(unit * 14, unit * 13, ['room_center', 'room_corridor'], 'horizontal'),
            door(unit * 9, unit * 15, ['room_corridor', 'room_vault'], 'horizontal'),
            door(unit * 16, unit * 15, ['room_corridor', 'room_core'], 'horizontal')
        ];

        const features = [
            { x: unit * 14, y: unit * 8, type: 'cover', description: '翻倒石柱，提供半掩体' },
            { x: unit * 20, y: unit * 8, type: 'statue', description: '破损雕像' },
            { x: unit * 20, y: unit * 12, type: 'chest', description: '封存补给箱' },
            { x: unit * 16, y: unit * 17, type: 'altar', description: '核心祭坛' }
        ];

        return {
            mapName: locationName || '当前区域',
            mapSize: { width: mapWidth, height: mapHeight },
            rooms,
            doors,
            features
        };
    };

    const buildFallbackExplorationMapCommand = (state: GameState, locationNameHint?: string): TavernCommand => {
        const locationName = locationNameHint || resolvePreferredMapLocationName(state);
        const midLocs = Array.isArray(state.地图?.midLocations) ? state.地图!.midLocations : [];
        const target =
            midLocs.find(loc => isSameLocation(locationName, loc?.name))
            || midLocs[0]
            || null;
        const width = target?.area?.width ?? 800;
        const height = target?.area?.height ?? 600;
        return {
            action: 'upsert_exploration_map',
            command: 'upsert_exploration_map',
            value: {
                LocationName: target?.name || locationName || '当前区域',
                MapStructureJSON: buildFallbackMapStructure(target?.name || locationName || '当前区域', width, height)
            }
        } as TavernCommand;
    };

    const normalizeExplorationMapCommand = (cmd: TavernCommand, fallbackLocationName: string): TavernCommand => {
        const action = (cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? (cmd as any)?.name ?? (cmd as any)?.mode;
        if (action !== 'upsert_exploration_map') return cmd;
        const extracted = extractExplorationMapPayload((cmd as any)?.value ?? (cmd as any)?.payload ?? cmd, fallbackLocationName);
        if (!extracted) return cmd;
        return {
            ...(cmd as any),
            action: 'upsert_exploration_map',
            command: 'upsert_exploration_map',
            value: {
                LocationName: extracted.locationName || fallbackLocationName,
                MapStructureJSON: extracted.mapStructure
            }
        } as TavernCommand;
    };

    const handleUpsertExplorationMapStructure = (state: GameState, payload: any): { success: boolean; error?: string } => {
        if (!state.地图) {
            appendDebugLog({
                hid: 'H3',
                loc: 'hooks/useGameLogic.ts:handleUpsertExplorationMapStructure',
                msg: 'upsert_exploration_map: missing map in state',
                data: { hasPayload: !!payload }
            });
            return { success: false, error: 'GameState.地图 not initialized' };
        }
        const extracted = extractExplorationMapPayload(payload, typeof state.当前地点 === 'string' ? state.当前地点 : '');
        if (!extracted) {
            appendDebugLog({
                hid: 'H3',
                loc: 'hooks/useGameLogic.ts:handleUpsertExplorationMapStructure',
                msg: 'upsert_exploration_map: missing MapStructureJSON',
                data: { hasPayload: !!payload, locationName: payload?.LocationName }
            });
            return { success: false, error: 'Missing MapStructureJSON in payload' };
        }

        const payloadLocationName = extracted.locationName;
        const stateLocationName = typeof state.当前地点 === 'string' ? state.当前地点 : '';
        const candidateNames = Array.from(new Set([payloadLocationName, stateLocationName].filter(Boolean)));
        const locationName = candidateNames[0] || '';
        const debugBase = {
            locationName,
            payloadLocationName,
            stateLocationName,
            candidateNames,
            hasMapStructure: !!extracted?.mapStructure,
            mapStructureType: typeof extracted?.mapStructure
        };
        if (!locationName) {
            appendDebugLog({
                hid: 'H3',
                loc: 'hooks/useGameLogic.ts:handleUpsertExplorationMapStructure',
                msg: 'upsert_exploration_map: missing location name',
                data: { ...debugBase }
            });
            return { success: false, error: 'No location name provided or in state' };
        }

        let mapStructure = extracted.mapStructure;
        if (typeof mapStructure === 'string') {
            try {
                mapStructure = JSON.parse(mapStructure);
            } catch (e) {
                appendDebugLog({
                    hid: 'H3',
                    loc: 'hooks/useGameLogic.ts:handleUpsertExplorationMapStructure',
                    msg: 'upsert_exploration_map: invalid MapStructureJSON',
                    data: { ...debugBase }
                });
                return { success: false, error: 'MapStructureJSON is invalid JSON string' };
            }
        }

        const coerceNumber = (value: any, fallback: number) => {
            if (typeof value === 'number' && Number.isFinite(value)) return value;
            if (typeof value === 'string') {
                const parsed = parseFloat(value);
                if (Number.isFinite(parsed)) return parsed;
            }
            return fallback;
        };

        const pickFirst = (...values: any[]) => values.find(v => v !== undefined && v !== null);

        const toArray = (value: any): any[] => {
            if (Array.isArray(value)) return value;
            if (value && typeof value === 'object' && Array.isArray(value.list)) return value.list;
            return [];
        };

        const normalizeMapStructure = (raw: any, fallbackName: string) => {
            if (!raw || typeof raw !== 'object') return raw;
            const nameCandidate = pickFirst(raw.mapName, raw.name, raw.地图名, raw.LocationName);
            const mapName = typeof nameCandidate === 'string' && nameCandidate.trim()
                ? nameCandidate.trim()
                : fallbackName || 'Tactical Map';
            const rawSize = pickFirst(raw.mapSize, raw.size, raw.地图尺寸, {});
            const width = coerceNumber(pickFirst(rawSize.width, rawSize.w, rawSize.宽度), 800);
            const height = coerceNumber(pickFirst(rawSize.height, rawSize.h, rawSize.高度), 600);
            const rooms = toArray(pickFirst(raw.rooms, raw.Rooms, raw.房间))
                .filter((room: any) => room && typeof room === 'object')
                .map((room: any, idx: number) => {
                    const roomWidth = coerceNumber(pickFirst(room.width, room.w, room.宽度), 0);
                    const roomHeight = coerceNumber(pickFirst(room.height, room.h, room.高度), 0);
                    if (roomWidth <= 0 || roomHeight <= 0) return null;
                    return {
                        ...room,
                        id: String(pickFirst(room.id, room.roomId, `room_${idx + 1}`)),
                        name: String(pickFirst(room.name, room.label, room.名称, room.id, `Room ${idx + 1}`)),
                        x: coerceNumber(pickFirst(room.x, room.left, room.posX, room.左), 0),
                        y: coerceNumber(pickFirst(room.y, room.top, room.posY, room.上), 0),
                        width: roomWidth,
                        height: roomHeight
                    };
                })
                .filter(Boolean);
            const doors = toArray(pickFirst(raw.doors, raw.Doors, raw.门))
                .filter((door: any) => door && typeof door === 'object')
                .map((door: any) => ({
                    ...door,
                    x: coerceNumber(pickFirst(door.x, door.posX, door.左), 0),
                    y: coerceNumber(pickFirst(door.y, door.posY, door.上), 0),
                    connects: Array.isArray(door.connects) ? door.connects.map(String) : []
                }));
            const features = toArray(pickFirst(raw.features, raw.Features, raw.地物, raw.objects))
                .filter((feature: any) => feature && typeof feature === 'object')
                .map((feature: any) => ({
                    ...feature,
                    x: coerceNumber(pickFirst(feature.x, feature.posX, feature.左), 0),
                    y: coerceNumber(pickFirst(feature.y, feature.posY, feature.上), 0),
                    type: String(pickFirst(feature.type, feature.kind, feature.类型, 'feature'))
                }));
            return {
                ...raw,
                mapName,
                mapSize: { width, height },
                rooms,
                doors,
                features
            };
        };

        mapStructure = normalizeMapStructure(mapStructure, stateLocationName || payloadLocationName || locationName);
        appendDebugLog({
            hid: 'H3',
            loc: 'hooks/useGameLogic.ts:handleUpsertExplorationMapStructure',
            msg: 'upsert_exploration_map: normalized structure',
            data: {
                ...debugBase,
                mapName: mapStructure?.mapName,
                mapSize: mapStructure?.mapSize,
                roomCount: Array.isArray(mapStructure?.rooms) ? mapStructure.rooms.length : 0
            }
        });

        const midLocs = Array.isArray(state.地图.midLocations) ? state.地图.midLocations : [];
        const currentFloor = typeof state.当前楼层 === 'number' ? state.当前楼层 : 0;
        const matchByName = (
            name: string,
            list: { name?: string; floor?: number }[],
            floorHint?: number
        ) => {
            const isNameMatched = (itemName?: string) =>
                !!itemName && (itemName === name || name.includes(itemName) || itemName.includes(name));
            if (typeof floorHint === 'number') {
                const sameFloorIdx = list.findIndex(l => isNameMatched(l?.name) && (l?.floor ?? 0) === floorHint);
                if (sameFloorIdx !== -1) return sameFloorIdx;
            }
            return list.findIndex(l => isNameMatched(l?.name));
        };

        // 1. Search Mid Locations (single source of truth for tactical SVG map)
        let targetMidIndex = -1;
        let matchedName = '';
        for (const candidate of candidateNames) {
            const idx = matchByName(candidate, midLocs, currentFloor);
            if (idx !== -1) {
                targetMidIndex = idx;
                matchedName = candidate;
                break;
            }
        }

        if (targetMidIndex !== -1) {
            state.地图.midLocations[targetMidIndex].mapStructure = mapStructure;
            appendDebugLog({
                hid: 'H3',
                loc: 'hooks/useGameLogic.ts:handleUpsertExplorationMapStructure',
                msg: 'upsert_exploration_map: applied to mid location',
                data: { ...debugBase, target: 'mid', index: targetMidIndex, matchedName, floor: currentFloor }
            });
            return { success: true };
        }

        // 2. Fallback: Create a NEW Mid Location (no small hierarchy)
        const fallbackName = stateLocationName || payloadLocationName || locationName;
        const macroLocs = Array.isArray(state.地图.macroLocations) ? state.地图.macroLocations : [];
        const parentId = midLocs[0]?.parentId || macroLocs[0]?.id || 'macro_orario';
        const newId = `Loc_${Date.now()}`;

        const baseCoord = state.世界坐标 && Number.isFinite(state.世界坐标.x) && Number.isFinite(state.世界坐标.y)
            ? state.世界坐标
            : { x: 5000, y: 5000 };
        const newMidLoc: any = {
            id: newId,
            name: fallbackName || locationName,
            parentId: parentId,
            description: 'Tactical Map',
            coordinates: { x: baseCoord.x, y: baseCoord.y },
            floor: currentFloor,
            mapStructure: mapStructure,
            area: {
                shape: 'RECT',
                center: { x: baseCoord.x, y: baseCoord.y },
                width: mapStructure.mapSize?.width || 800,
                height: mapStructure.mapSize?.height || 600
            }
        };

        if (!state.地图.midLocations) state.地图.midLocations = [];
        state.地图.midLocations.push(newMidLoc);

        appendDebugLog({
            hid: 'H3',
            loc: 'hooks/useGameLogic.ts:handleUpsertExplorationMapStructure',
            msg: 'upsert_exploration_map: created fallback mid location',
            data: { ...debugBase, target: 'fallback-mid', parentId, newId, fallbackName, floor: currentFloor }
        });

        return { success: true };
    };

    const processTavernCommands = (state: GameState, commands: TavernCommand[]): { newState: GameState, logs: LogEntry[], hasError: boolean, sheetPatches?: TavernDBSheetPatch[] } => {
        let nextState = structuredClone(state);
        const systemLogs: LogEntry[] = [];
        const sheetPatches: TavernDBSheetPatch[] = [];
        let hasError = false;
        const commandBatch = assignAmIndexesForLogCommands(Array.isArray(commands) ? commands : [], nextState);
        let systemLogSeq = 0;
        const nextSystemLogId = () => `sys-${Date.now()}-${(systemLogSeq++).toString(36)}`;
        const buildSheetPatchesForCommand = (action: string, cmd: TavernCommand): TavernDBSheetPatch[] => {
            const value = (cmd as any)?.value;
            const commandExpectedSheetVersions = asObject((cmd as any)?.expectedSheetVersions) || {};
            const resolveExpectedSheetVersion = (sheetId: TavernDBSheetId): number | undefined => {
                const direct = (cmd as any)?.expectedSheetVersion;
                if (typeof direct === 'number' && Number.isFinite(direct)) {
                    return Math.max(0, Math.floor(direct));
                }
                const mapped = commandExpectedSheetVersions?.[sheetId];
                if (typeof mapped === 'number' && Number.isFinite(mapped)) {
                    return Math.max(0, Math.floor(mapped));
                }
                return undefined;
            };
            const expectedVersionOffsets = new Map<string, number>();
            const nextExpectedSheetVersion = (sheetId: TavernDBSheetId): number | undefined => {
                const base = resolveExpectedSheetVersion(sheetId);
                if (base === undefined) return undefined;
                const key = String(sheetId);
                const offset = expectedVersionOffsets.get(key) ?? 0;
                expectedVersionOffsets.set(key, offset + 1);
                return base + offset;
            };
            const commandSource = String((cmd as any)?.source || '');
            const lockOwner = String((cmd as any)?.lockOwner || '').trim() || undefined;
            const makeUpsert = (sheetId: TavernDBSheetPatch['sheetId'], rowId: string | number, row?: Record<string, any>): TavernDBSheetPatch => ({
                sheetId,
                operation: 'upsert',
                rowId,
                row,
                reason: action,
                commandRef: `${action}:${(cmd as any)?.key || (cmd as any)?.path || ''}`,
                expectedSheetVersion: nextExpectedSheetVersion(sheetId),
                changedFields: row && typeof row === 'object' ? Object.keys(row) : undefined,
                lockOwner,
                source: commandSource || undefined
            });
            switch (action) {
                case 'append_log_summary': {
                    const row = value && typeof value === 'object' ? value : {};
                    const rowId = String((row as any).编码索引 || `summary_${Date.now()}`);
                    return [makeUpsert('LOG_Summary', rowId, row)];
                }
                case 'append_log_outline': {
                    const row = value && typeof value === 'object' ? value : {};
                    const rowId = String((row as any).编码索引 || `outline_${Date.now()}`);
                    return [makeUpsert('LOG_Outline', rowId, row)];
                }
                case 'append_econ_ledger': {
                    const rows = Array.isArray(value) ? value : [value];
                    return rows
                        .filter((row) => !!row && typeof row === 'object')
                        .map((row: any, index: number) => makeUpsert('ECON_Ledger', String(row.id || row.ledger_id || `ledger_${Date.now()}_${index}`), row));
                }
                case 'apply_econ_delta': {
                    const rowId = `ledger_delta_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                    return [makeUpsert('ECON_Ledger', rowId, value)];
                }
                case 'upsert_npc': {
                    const rows = Array.isArray(value) ? value : [value];
                    return rows
                        .filter((row) => !!row && typeof row === 'object')
                        .map((row: any, index: number) => makeUpsert('NPC_Registry', String(row.id || row.NPC_ID || row.姓名 || `npc_${index + 1}`), row));
                }
                case 'upsert_inventory': {
                    const rows = Array.isArray(value) ? value : [value];
                    return rows
                        .filter((row) => !!row && typeof row === 'object')
                        .map((row: any, index: number) => makeUpsert('ITEM_Inventory', String(row.id || row.物品ID || row.名称 || `item_${index + 1}`), row));
                }
                case 'set_action_options':
                    return [makeUpsert('UI_ActionOptions', `action_options_${Date.now()}`, { row: value })];
                case 'set_encounter_rows':
                    return [makeUpsert('COMBAT_Encounter', `encounter_batch_${Date.now()}`, { rows: value })];
                case 'upsert_battle_map_rows':
                    return [makeUpsert('COMBAT_BattleMap', `battle_map_batch_${Date.now()}`, { rows: value })];
                case 'set_map_visuals':
                    return [makeUpsert('COMBAT_Map_Visuals', `combat_visual_${Date.now()}`, value)];
                case 'upsert_exploration_map':
                    return [makeUpsert('EXPLORATION_Map_Data', `exploration_map_${Date.now()}`, value)];
                case 'upsert_sheet_rows': {
                    const parsePatchPayload = (raw: unknown): unknown => {
                        const parsed = typeof raw === 'string'
                            ? parseJsonLikePayload(raw)
                            : raw;
                        return normalizeSheetPayloadAliases(parsed);
                    };
                    const asRecord = (raw: unknown): Record<string, unknown> | null => {
                        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
                        return raw as Record<string, unknown>;
                    };
                    const normalizeSheetPayloads = (raw: unknown): Array<{ sheetId: string; keyField: string; rows: any[] }> => {
                        const parsed = parsePatchPayload(raw);
                        if (Array.isArray(parsed)) {
                            return parsed
                                .map((item) => asRecord(parsePatchPayload(item)))
                                .filter((item): item is Record<string, unknown> => !!item)
                                .flatMap((item) => {
                                    const sheetId = String(item.sheetId ?? item.sheet_id ?? '').trim();
                                    const rows = Array.isArray(item.rows)
                                        ? item.rows
                                        : (
                                            Array.isArray(item.value)
                                                ? item.value
                                                : (Array.isArray(item.data) ? item.data : (Array.isArray(item.payload) ? item.payload : []))
                                        );
                                    if (!sheetId || !Array.isArray(rows) || rows.length === 0) return [];
                                    const keyField = String(item.keyField ?? '').trim();
                                    return [{ sheetId, keyField, rows }];
                                });
                        }
                        const payload = asRecord(parsed);
                        if (!payload) return [];
                        const directSheetId = String(payload.sheetId ?? payload.sheet_id ?? '').trim();
                        const directRows = Array.isArray(payload.rows)
                            ? payload.rows
                            : (
                                Array.isArray(payload.value)
                                    ? payload.value
                                    : (Array.isArray(payload.data) ? payload.data : (Array.isArray(payload.payload) ? payload.payload : []))
                            );
                        if (directSheetId && Array.isArray(directRows) && directRows.length > 0) {
                            return [{
                                sheetId: directSheetId,
                                keyField: String(payload.keyField ?? payload.key_field ?? '').trim(),
                                rows: directRows
                            }];
                        }
                        if (Array.isArray(payload.value) || Array.isArray(payload.data) || Array.isArray(payload.payload)) {
                            return normalizeSheetPayloads(payload.value ?? payload.data ?? payload.payload);
                        }
                        return [];
                    };

                    const sheetPayloads = normalizeSheetPayloads(value);
                    if (sheetPayloads.length === 0) return [];
                    return sheetPayloads.flatMap((payload) => {
                        const sheetId = String(payload.sheetId || '').trim();
                        if (!sheetId) return [];
                        const resolvedKeyField = String(payload.keyField || SHEET_PRIMARY_KEY_LOOKUP.get(sheetId) || 'id').trim() || 'id';
                        return payload.rows.map((row, index) => ({
                            sheetId: sheetId as TavernDBSheetPatch['sheetId'],
                            operation: 'upsert',
                            rowId: String(
                                row?.[resolvedKeyField]
                                ?? row?.id
                                ?? `${sheetId}_${index + 1}`
                            ),
                            row,
                            reason: action,
                            commandRef: `${action}:${sheetId}`,
                            expectedSheetVersion: nextExpectedSheetVersion(sheetId as TavernDBSheetId),
                            changedFields: row && typeof row === 'object' ? Object.keys(row) : undefined,
                            lockOwner,
                            source: commandSource || undefined
                        }));
                    });
                }
                case 'delete_sheet_rows': {
                    const normalized = normalizeSheetPayloadAliases(parseJsonLikePayload(value)) as any;
                    const sheetId = String(normalized?.sheetId ?? normalized?.sheet_id ?? '').trim();
                    const rowIdsRaw = normalized?.rowIds ?? normalized?.row_ids;
                    const rowIds = Array.isArray(rowIdsRaw) ? rowIdsRaw : (rowIdsRaw !== undefined ? [rowIdsRaw] : []);
                    if (!sheetId) return [];
                    return rowIds.map((rowId: string | number) => ({
                        sheetId: sheetId as TavernDBSheetPatch['sheetId'],
                        operation: 'delete',
                        rowId,
                        reason: action,
                        commandRef: `${action}:${sheetId}`,
                        expectedSheetVersion: nextExpectedSheetVersion(sheetId as TavernDBSheetId),
                        lockOwner,
                        source: commandSource || undefined
                    }));
                }
                default:
                    return [];
            }
        };
        const normalizeSocialCommandKey = (rawKey: unknown): string => {
            const key = String(rawKey ?? '').trim();
            if (!key) return '';
            let normalized = key.startsWith('gameState.') ? key.slice('gameState.'.length) : key;
            normalized = normalized.replace(/^social(?=\.|\[|$)/i, '社交');
            normalized = normalized.replace(/^confidants(?=\.|\[|$)/i, '社交');
            normalized = normalized.replace(/\.specialAttention$/i, '.特别关注');
            return normalized;
        };
        const isSpecialAttentionCommand = (rawKey: unknown): boolean => {
            const key = normalizeSocialCommandKey(rawKey);
            if (!key) return false;
            return /^社交(?:\[(?:\d+|\"[^\"]+\"|'[^']+'|[^\]]+)\]|\.\d+)?\.特别关注$/.test(key);
        };
        const NON_BLOCKING_VALIDATION_ACTIONS = new Set([
            'append_log_summary',
            'append_log_outline',
            'upsert_sheet_rows',
            'upsert_npc',
            'upsert_inventory',
            'set_action_options',
            'apply_econ_delta',
            'append_econ_ledger'
        ]);
        const parseMaybeJsonValue = (raw: unknown): unknown => {
            if (typeof raw !== 'string') return raw;
            const text = raw.trim();
            if (!text) return raw;
            try {
                return JSON.parse(text);
            } catch {
                return raw;
            }
        };
        const normalizeCommandPayload = (action: string, cmd: any): unknown => {
            const readSources = [
                cmd?.value,
                cmd?.args,
                cmd?.arguments,
                cmd?.rows,
                cmd?.data,
                cmd?.payload,
                cmd?.row
            ];
            const firstDefined = readSources.find((item) => item !== undefined);
            const parsed = normalizeSheetPayloadAliases(parseMaybeJsonValue(firstDefined));
            const asRecord = (value: unknown): Record<string, unknown> | null => {
                if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
                return value as Record<string, unknown>;
            };
            const unwrapRows = (value: unknown): Record<string, unknown>[] => {
                const parsedValue = parseMaybeJsonValue(value);
                if (Array.isArray(parsedValue)) {
                    return parsedValue
                        .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row));
                }
                const record = asRecord(parsedValue);
                if (!record) return [];
                const nestedCandidates = ['rows', 'value', 'data', 'payload', 'npcs', 'records'];
                for (const key of nestedCandidates) {
                    if (record[key] !== undefined && record[key] !== parsedValue) {
                        const rows = unwrapRows(record[key]);
                        if (rows.length > 0) return rows;
                    }
                }
                return [record];
            };

            if (action === 'upsert_npc' || action === 'upsert_inventory') {
                const rows = unwrapRows(parsed);
                if (rows.length > 0) return rows;
                if (parsed === undefined || parsed === null) {
                    const cmdRecord = asRecord(cmd);
                    if (cmdRecord) {
                        const fallback: Record<string, unknown> = {};
                        Object.entries(cmdRecord).forEach(([k, v]) => {
                            if (k === 'action' || k === 'type' || k === 'command' || k === 'mode' || k === 'cmd' || k === 'key' || k === 'path' || k === 'args' || k === 'arguments') return;
                            fallback[k] = v;
                        });
                        if (Object.keys(fallback).length > 0) return [fallback];
                    }
                }
                return parsed;
            }
            if (action === 'apply_econ_delta') {
                const payload = asRecord(parsed) || {};
                const cmdRecord = asRecord(cmd) || {};
                const accountRaw = payload.account ?? payload.账户 ?? cmdRecord.account ?? cmdRecord.账户;
                const accountText = String(accountRaw ?? '').trim();
                const account = accountText === '眷族.资金' ? '眷族.资金' : (accountText === '角色.法利' ? '角色.法利' : '');
                const delta = toNumberOrNull(
                    payload.delta
                    ?? payload.变化
                    ?? payload.增量
                    ?? cmdRecord.delta
                    ?? cmdRecord.变化
                    ?? cmdRecord.增量
                );
                if (account && delta !== null && Number.isFinite(delta) && delta !== 0) {
                    return {
                        account,
                        delta,
                        reason: String(
                            payload.reason
                            ?? payload.原因
                            ?? cmdRecord.reason
                            ?? cmdRecord.原因
                            ?? 'legacy-bridge'
                        ).trim() || 'legacy-bridge',
                        commandRef: String(
                            payload.commandRef
                            ?? payload.command_ref
                            ?? cmdRecord.commandRef
                            ?? cmdRecord.command_ref
                            ?? ''
                        ).trim() || undefined
                    };
                }
                return parsed;
            }
            if (action === 'append_log_summary' || action === 'append_log_outline') {
                const rows = unwrapRows(parsed);
                if (rows.length > 0) return rows[0];
                if (parsed === undefined || parsed === null) {
                    const cmdRecord = asRecord(cmd);
                    if (cmdRecord) {
                        const fallback: Record<string, unknown> = {};
                        Object.entries(cmdRecord).forEach(([k, v]) => {
                            if (k === 'action' || k === 'type' || k === 'command' || k === 'mode' || k === 'cmd' || k === 'key' || k === 'path' || k === 'args' || k === 'arguments') return;
                            fallback[k] = v;
                        });
                        if (Object.keys(fallback).length > 0) return fallback;
                    }
                }
                return parsed;
            }
            if (action === 'upsert_sheet_rows') {
                const payloadArray = Array.isArray(parsed)
                    ? parsed
                        .map((item) => asRecord(item))
                        .filter((item): item is Record<string, unknown> => !!item)
                    : [];
                const payload = asRecord(parsed) || payloadArray[0] || {};
                const sheetId = String(payload.sheetId ?? payload.sheet_id ?? cmd?.sheetId ?? cmd?.sheet_id ?? '').trim();
                const keyField = String(payload.keyField ?? payload.key_field ?? cmd?.keyField ?? cmd?.key_field ?? '').trim();
                const explicitRows = payload.rows ?? payload.value ?? payload.data ?? payload.payload ?? cmd?.rows ?? cmd?.data ?? cmd?.payload ?? cmd?.row ?? cmd?.args ?? cmd?.arguments;
                let rows = unwrapRows(explicitRows ?? parsed);
                if (sheetId && payloadArray.length > 1) {
                    const sameSheetPayloads = payloadArray.filter((item) => String(item.sheetId ?? '').trim() === sheetId);
                    if (sameSheetPayloads.length > 1) {
                        rows = sameSheetPayloads.flatMap((item) => unwrapRows(item.rows ?? item.value ?? item.data ?? item.payload));
                    }
                }
                if (!sheetId) {
                    const canonicalKey = normalizeLegacyBusinessPath(cmd?.key ?? cmd?.path);
                    if (
                        canonicalKey === 'gameState.当前地点'
                        || canonicalKey === 'gameState.当前日期'
                        || canonicalKey === 'gameState.游戏时间'
                        || canonicalKey === 'gameState.上轮时间'
                        || canonicalKey === 'gameState.流逝时长'
                        || canonicalKey === 'gameState.场景描述'
                        || canonicalKey === 'gameState.天气'
                        || canonicalKey === 'gameState.战斗模式'
                        || canonicalKey === 'gameState.系统通知'
                        || canonicalKey === 'gameState.世界坐标'
                        || canonicalKey === 'gameState.世界坐标.x'
                        || canonicalKey === 'gameState.世界坐标.y'
                    ) {
                        const currentTurn = Math.max(0, Math.floor(Number(nextState?.回合数 || 0)));
                        const snapshotX = toNumberOrNull((nextState as any)?.世界坐标?.x);
                        const snapshotY = toNumberOrNull((nextState as any)?.世界坐标?.y);
                        const row: Record<string, unknown> = {
                            _global_id: GLOBAL_STATE_ROW_ID,
                            当前回合: currentTurn,
                            当前场景: String(nextState?.当前地点 ?? '').trim() || undefined,
                            场景描述: String((nextState as any)?.场景描述 ?? '').trim() || undefined,
                            当前日期: String((nextState as any)?.当前日期 ?? '').trim() || undefined,
                            游戏时间: String((nextState as any)?.游戏时间 ?? '').trim() || undefined,
                            上轮时间: String((nextState as any)?.上轮时间 ?? '').trim() || undefined,
                            流逝时长: String((nextState as any)?.流逝时长 ?? '').trim() || undefined,
                            世界坐标X: snapshotX ?? undefined,
                            世界坐标Y: snapshotY ?? undefined,
                            天气状况: String((nextState as any)?.天气 ?? '').trim() || undefined,
                            战斗模式: String((nextState as any)?.战斗模式 ?? '').trim() || undefined,
                            系统通知: String((nextState as any)?.系统通知 ?? '').trim() || undefined
                        };
                        if (canonicalKey === 'gameState.当前地点') row.当前场景 = String(parsed ?? '').trim();
                        if (canonicalKey === 'gameState.当前日期') row.当前日期 = String(parsed ?? '').trim();
                        if (canonicalKey === 'gameState.游戏时间') row.游戏时间 = String(parsed ?? '').trim();
                        if (canonicalKey === 'gameState.上轮时间') row.上轮时间 = String(parsed ?? '').trim();
                        if (canonicalKey === 'gameState.流逝时长') row.流逝时长 = String(parsed ?? '').trim();
                        if (canonicalKey === 'gameState.场景描述') row.场景描述 = String(parsed ?? '').trim();
                        if (canonicalKey === 'gameState.天气') row.天气状况 = String(parsed ?? '').trim();
                        if (canonicalKey === 'gameState.战斗模式') row.战斗模式 = String(parsed ?? '').trim();
                        if (canonicalKey === 'gameState.系统通知') row.系统通知 = String(parsed ?? '').trim();
                        if (canonicalKey === 'gameState.世界坐标') {
                            const coord = (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {};
                            const x = toNumberOrNull(coord.x);
                            const y = toNumberOrNull(coord.y);
                            if (x !== null) row.世界坐标X = Math.round(x);
                            if (y !== null) row.世界坐标Y = Math.round(y);
                        }
                        if (canonicalKey === 'gameState.世界坐标.x') {
                            const x = toNumberOrNull(parsed);
                            if (x !== null) row.世界坐标X = Math.round(x);
                        }
                        if (canonicalKey === 'gameState.世界坐标.y') {
                            const y = toNumberOrNull(parsed);
                            if (y !== null) row.世界坐标Y = Math.round(y);
                        }
                        return {
                            sheetId: 'SYS_GlobalState',
                            keyField: '_global_id',
                            rows: [row]
                        };
                    }
                    if (canonicalKey === 'gameState.社交' && rows.length > 0) {
                        return {
                            sheetId: 'NPC_Registry',
                            keyField: 'id',
                            rows
                        };
                    }
                    return parsed;
                }
                return {
                    sheetId,
                    ...(keyField ? { keyField } : {}),
                    rows
                };
            }
            if (action === 'delete_sheet_rows') {
                const payload = asRecord(parsed) || {};
                const sheetId = String(payload.sheetId ?? payload.sheet_id ?? cmd?.sheetId ?? cmd?.sheet_id ?? '').trim();
                const keyField = String(payload.keyField ?? payload.key_field ?? cmd?.keyField ?? cmd?.key_field ?? '').trim();
                const rowIdsRaw = payload.rowIds ?? payload.row_ids ?? payload.ids ?? cmd?.rowIds ?? cmd?.row_ids ?? cmd?.ids;
                const rowIds = Array.isArray(rowIdsRaw) ? rowIdsRaw : (rowIdsRaw !== undefined ? [rowIdsRaw] : []);
                if (!sheetId) return parsed;
                return {
                    sheetId,
                    ...(keyField ? { keyField } : {}),
                    rowIds
                };
            }
            return parsed;
        };
        const toNumberOrNull = (raw: unknown): number | null => {
            if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
            if (typeof raw === 'string') {
                const parsed = Number(raw);
                if (Number.isFinite(parsed)) return parsed;
            }
            return null;
        };
        const normalizeLegacyBusinessPath = (rawKey: unknown): string => {
            const key = String(rawKey ?? '').trim();
            if (!key) return '';
            let normalized = key.startsWith('gameState.') ? key : `gameState.${key}`;
            normalized = normalized.replace(/^gameState\.social(?=\.|\[|$)/i, 'gameState.社交');
            normalized = normalized.replace(/^gameState\.confidants(?=\.|\[|$)/i, 'gameState.社交');
            return normalized;
        };
        const normalizeNpcMemoryEntry = (raw: unknown, fallbackTime: string): { 内容: string; 时间戳: string } | null => {
            if (raw === null || raw === undefined) return null;
            if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
                const content = String(raw).trim();
                if (!content) return null;
                return { 内容: content, 时间戳: fallbackTime };
            }
            if (typeof raw === 'object') {
                const row = raw as Record<string, unknown>;
                const content = String(row.内容 ?? row.content ?? '').trim();
                if (!content) return null;
                const timestamp = String(row.时间戳 ?? row.timestamp ?? fallbackTime).trim() || fallbackTime;
                return { 内容: content, 时间戳: timestamp };
            }
            return null;
        };
        const normalizeWorldTrackingRow = (raw: unknown, fallbackIndex: number = 0): Record<string, unknown> | null => {
            if (!raw || typeof raw !== 'object') return null;
            const row = raw as Record<string, unknown>;
            const npcName = String(row.npc_name ?? row.NPC ?? row.npc ?? row.姓名 ?? '').trim();
            const currentAction = String(row.current_action ?? row.当前行动 ?? row.action ?? '').trim();
            if (!npcName || !currentAction) return null;
            const trackingId = String(row.tracking_id ?? row.id ?? '').trim() || `${npcName}_${fallbackIndex + 1}`;
            const location = String(row.location ?? row.位置 ?? '').trim();
            const progress = String(row.progress ?? row.进度 ?? '').trim();
            const eta = String(row.eta ?? row.预计完成 ?? '').trim();
            const updatedAt = String(row.updated_at ?? row.更新时间 ?? '').trim();
            return {
                tracking_id: trackingId,
                npc_name: npcName,
                current_action: currentAction,
                ...(location ? { location } : {}),
                ...(progress ? { progress } : {}),
                ...(eta ? { eta } : {}),
                ...(updatedAt ? { updated_at: updatedAt } : {})
            };
        };
        const normalizeWorldNewsRow = (raw: unknown, fallbackIndex: number = 0): Record<string, unknown> | null => {
            if (!raw || typeof raw !== 'object') return null;
            const row = raw as Record<string, unknown>;
            const title = String(row.标题 ?? row.title ?? '').trim();
            const source = String(row.来源 ?? row.source ?? '').trim() || 'street';
            if (!title) return null;
            const newsId = String(row.news_id ?? row.id ?? '').trim() || `NEWS_${fallbackIndex + 1}`;
            return {
                news_id: newsId,
                标题: title,
                ...(String(row.内容 ?? row.content ?? '').trim() ? { 内容: String(row.内容 ?? row.content ?? '').trim() } : {}),
                ...(String(row.时间戳 ?? row.timestamp ?? '').trim() ? { 时间戳: String(row.时间戳 ?? row.timestamp ?? '').trim() } : {}),
                来源: source,
                ...(String(row.重要度 ?? row.priority ?? '').trim() ? { 重要度: String(row.重要度 ?? row.priority ?? '').trim() } : {}),
                ...(String(row.关联传闻 ?? row.linked_rumor ?? '').trim() ? { 关联传闻: String(row.关联传闻 ?? row.linked_rumor ?? '').trim() } : {})
            };
        };
        const normalizeWorldRumorRow = (raw: unknown, fallbackIndex: number = 0): Record<string, unknown> | null => {
            if (!raw || typeof raw !== 'object') return null;
            const row = raw as Record<string, unknown>;
            const topic = String(row.主题 ?? row.topic ?? '').trim();
            if (!topic) return null;
            const rumorId = String(row.rumor_id ?? row.id ?? '').trim() || `RUMOR_${fallbackIndex + 1}`;
            const spread = toNumberOrNull(row.传播度 ?? row.spread ?? 0);
            const tagsRaw = row.话题标签 ?? row.tags;
            const tags = Array.isArray(tagsRaw)
                ? tagsRaw.map((item) => String(item ?? '').trim()).filter(Boolean)
                : String(tagsRaw ?? '').split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
            return {
                rumor_id: rumorId,
                主题: topic,
                ...(String(row.内容 ?? row.content ?? '').trim() ? { 内容: String(row.内容 ?? row.content ?? '').trim() } : {}),
                传播度: spread === null ? 0 : Math.max(0, Math.floor(spread)),
                ...(String(row.可信度 ?? row.credibility ?? '').trim() ? { 可信度: String(row.可信度 ?? row.credibility ?? '').trim() } : {}),
                ...(String(row.来源 ?? row.source ?? '').trim() ? { 来源: String(row.来源 ?? row.source ?? '').trim() } : {}),
                ...(tags.length > 0 ? { 话题标签: tags.join(', ') } : {}),
                ...(String(row.发现时间 ?? row.found_at ?? '').trim() ? { 发现时间: String(row.发现时间 ?? row.found_at ?? '').trim() } : {}),
                ...(toNumberOrNull(row.评论数 ?? row.comment_count) !== null ? { 评论数: Math.max(0, Math.floor(toNumberOrNull(row.评论数 ?? row.comment_count) || 0)) } : {}),
                ...(typeof row.已升级为新闻 === 'boolean' ? { 已升级为新闻: row.已升级为新闻 ? '是' : '否' } : {}),
                ...(String(row.关联新闻 ?? row.linked_news ?? '').trim() ? { 关联新闻: String(row.关联新闻 ?? row.linked_news ?? '').trim() } : {})
            };
        };
        const normalizeWorldDenatusRow = (raw: unknown): Record<string, unknown> | null => {
            if (!raw || typeof raw !== 'object') return null;
            const row = raw as Record<string, unknown>;
            return {
                denatus_id: String(row.denatus_id ?? row.id ?? 'DENATUS_MAIN').trim() || 'DENATUS_MAIN',
                下次神会开启时间: String(row.下次神会开启时间 ?? row.next_time ?? '').trim(),
                神会主题: String(row.神会主题 ?? row.topic ?? '').trim(),
                讨论内容: Array.isArray(row.讨论内容) ? row.讨论内容 : String(row.讨论内容 ?? row.discussion ?? '').trim(),
                最终结果: String(row.最终结果 ?? row.result ?? '').trim()
            };
        };
        const normalizeWorldWarGameRow = (raw: unknown): Record<string, unknown> | null => {
            if (!raw || typeof raw !== 'object') return null;
            const row = raw as Record<string, unknown>;
            const participantsRaw = row.参战眷族 ?? row.participants;
            const participants = Array.isArray(participantsRaw)
                ? participantsRaw.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ')
                : String(participantsRaw ?? '').trim();
            return {
                war_game_id: String(row.war_game_id ?? row.id ?? 'WARGAME_MAIN').trim() || 'WARGAME_MAIN',
                状态: String(row.状态 ?? row.status ?? '').trim() || '未开始',
                参战眷族: participants,
                形式: String(row.形式 ?? row.mode ?? '').trim(),
                赌注: String(row.赌注 ?? row.stake ?? '').trim(),
                举办时间: String(row.举办时间 ?? row.start_at ?? '').trim(),
                结束时间: String(row.结束时间 ?? row.end_at ?? '').trim(),
                结果: String(row.结果 ?? row.result ?? '').trim(),
                备注: String(row.备注 ?? row.note ?? '').trim()
            };
        };
        const normalizeMomentRow = (
            raw: unknown,
            fallbackIndex: number = 0,
            fallbackSender: string = '',
            fallbackTime: string = ''
        ): Record<string, unknown> | null => {
            if (raw === null || raw === undefined) return null;
            const row = (typeof raw === 'object' && !Array.isArray(raw))
                ? raw as Record<string, unknown>
                : { 内容: String(raw) };
            const content = String(row.内容 ?? row.content ?? '').trim();
            const sender = String(row.发布者 ?? row.sender ?? fallbackSender ?? '').trim();
            if (!content || !sender) return null;
            const tagsRaw = row.话题标签 ?? row.话题 ?? row.tags;
            const tags = Array.isArray(tagsRaw)
                ? tagsRaw.map((item) => String(item ?? '').trim()).filter(Boolean)
                : String(tagsRaw ?? '').split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
            const commentCount = toNumberOrNull(row.评论数 ?? row.comment_count)
                ?? (Array.isArray(row.评论) ? row.评论.length : 0);
            return {
                moment_id: String(row.moment_id ?? row.id ?? '').trim() || `Moment_${fallbackIndex + 1}`,
                发布者: sender,
                内容: content,
                时间戳: String(row.时间戳 ?? row.timestamp ?? fallbackTime ?? '').trim(),
                可见性: String(row.可见性 ?? row.visibility ?? 'friends').trim() || 'friends',
                点赞数: Math.max(0, Math.floor(toNumberOrNull(row.点赞数 ?? row.likes ?? 0) ?? 0)),
                评论数: Math.max(0, Math.floor(commentCount)),
                ...(tags.length > 0 ? { 话题标签: tags.join(', ') } : {}),
                ...(String(row.图片描述 ?? row.image_desc ?? '').trim() ? { 图片描述: String(row.图片描述 ?? row.image_desc ?? '').trim() } : {})
            };
        };
        const normalizeForumBoardRow = (raw: unknown, fallbackIndex: number = 0): Record<string, unknown> | null => {
            const FORUM_BOARD_NAME_TO_ID = new Map<string, string>([
                ['欧拉丽快报', 'board_news'],
                ['地下城攻略', 'board_dungeon'],
                ['眷族招募', 'board_recruit'],
                ['酒馆闲谈', 'board_tavern']
            ]);
            const FORUM_BOARD_ID_TO_NAME = new Map<string, string>([
                ['board_news', '欧拉丽快报'],
                ['board_dungeon', '地下城攻略'],
                ['board_recruit', '眷族招募'],
                ['board_tavern', '酒馆闲谈']
            ]);
            const normalizeBoardName = (value: unknown): string => {
                const text = String(value ?? '').trim();
                return FORUM_BOARD_NAME_TO_ID.has(text) ? text : '';
            };
            const normalizeBoardId = (value: unknown): string => {
                const text = String(value ?? '').trim();
                if (!text) return '';
                const resolvedName = FORUM_BOARD_ID_TO_NAME.get(text) || '';
                return FORUM_BOARD_NAME_TO_ID.get(resolvedName) || '';
            };
            if (raw === null || raw === undefined) return null;
            const row = (typeof raw === 'object' && !Array.isArray(raw))
                ? raw as Record<string, unknown>
                : { 名称: String(raw) };
            const name = normalizeBoardName(row.名称 ?? row.name);
            if (!name) return null;
            return {
                board_id: normalizeBoardId(row.board_id ?? row.id) || FORUM_BOARD_NAME_TO_ID.get(name) || `board_${fallbackIndex + 1}`,
                名称: name,
                ...(String(row.图标 ?? row.icon ?? '').trim() ? { 图标: String(row.图标 ?? row.icon ?? '').trim() } : {}),
                ...(String(row.颜色 ?? row.color ?? '').trim() ? { 颜色: String(row.颜色 ?? row.color ?? '').trim() } : {}),
                ...(String(row.描述 ?? row.description ?? '').trim() ? { 描述: String(row.描述 ?? row.description ?? '').trim() } : {})
            };
        };
        const normalizeForumReplyRow = (
            raw: unknown,
            postId: string,
            fallbackIndex: number = 0,
            fallbackTime: string = ''
        ): Record<string, unknown> | null => {
            if (!raw || typeof raw !== 'object') return null;
            const row = raw as Record<string, unknown>;
            const sender = String(row.发布者 ?? row.sender ?? row.用户 ?? row.发帖人 ?? '').trim();
            const content = String(row.内容 ?? row.content ?? row.回复内容 ?? '').trim();
            if (!postId || !sender || !content) return null;
            return {
                reply_id: String(row.reply_id ?? row.id ?? '').trim() || `${postId}_reply_${fallbackIndex + 1}`,
                post_id: postId,
                楼层: Math.max(1, Math.floor(toNumberOrNull(row.楼层 ?? row.floor) ?? (fallbackIndex + 1))),
                发布者: sender,
                内容: content,
                ...(String(row.时间戳 ?? row.timestamp ?? row.发布时间 ?? fallbackTime ?? '').trim() ? { 时间戳: String(row.时间戳 ?? row.timestamp ?? row.发布时间 ?? fallbackTime ?? '').trim() } : {}),
                ...(toNumberOrNull(row.引用楼层 ?? row.quote_floor) !== null ? { 引用楼层: Math.floor(toNumberOrNull(row.引用楼层 ?? row.quote_floor) || 0) } : {}),
                ...(toNumberOrNull(row.点赞数 ?? row.likes) !== null ? { 点赞数: Math.max(0, Math.floor(toNumberOrNull(row.点赞数 ?? row.likes) || 0)) } : {})
            };
        };
        const normalizeForumPostRow = (
            raw: unknown,
            fallbackIndex: number = 0,
            fallbackSender: string = '',
            fallbackTime: string = ''
        ): Record<string, unknown> | null => {
            const FORUM_BOARD_NAME_TO_ID = new Map<string, string>([
                ['欧拉丽快报', 'board_news'],
                ['地下城攻略', 'board_dungeon'],
                ['眷族招募', 'board_recruit'],
                ['酒馆闲谈', 'board_tavern']
            ]);
            const FORUM_BOARD_ID_TO_NAME = new Map<string, string>([
                ['board_news', '欧拉丽快报'],
                ['board_dungeon', '地下城攻略'],
                ['board_recruit', '眷族招募'],
                ['board_tavern', '酒馆闲谈']
            ]);
            const normalizeBoardName = (value: unknown): string => {
                const text = String(value ?? '').trim();
                return FORUM_BOARD_NAME_TO_ID.has(text) ? text : '';
            };
            const normalizeBoardId = (value: unknown): string => {
                const text = String(value ?? '').trim();
                if (!text) return '';
                const boardName = FORUM_BOARD_ID_TO_NAME.get(text);
                if (!boardName) return '';
                return FORUM_BOARD_NAME_TO_ID.get(boardName) || '';
            };
            if (raw === null || raw === undefined) return null;
            const row = (typeof raw === 'object' && !Array.isArray(raw))
                ? raw as Record<string, unknown>
                : { 内容: String(raw) };
            const content = String(row.内容 ?? row.content ?? row.正文 ?? '').trim();
            const title = String(row.标题 ?? row.title ?? row.帖子标题 ?? '').trim() || content.slice(0, 20);
            const sender = String(row.发布者 ?? row.sender ?? row.发帖人 ?? row.作者 ?? fallbackSender ?? '').trim();
            if (!content || !title || !sender) return null;
            const boardId = normalizeBoardId(row.board_id ?? row.boardId);
            const boardName = normalizeBoardName(row.board_name ?? row.板块)
                || normalizeBoardName(FORUM_BOARD_ID_TO_NAME.get(String(row.board_id ?? row.boardId ?? '').trim()))
                || '欧拉丽快报';
            const tagsRaw = row.话题标签 ?? row.tags ?? row.话题;
            const tags = Array.isArray(tagsRaw)
                ? tagsRaw.map((item) => String(item ?? '').trim()).filter(Boolean)
                : String(tagsRaw ?? '').split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
            return {
                post_id: String(row.post_id ?? row.id ?? '').trim() || `Forum_${fallbackIndex + 1}`,
                board_id: boardId || FORUM_BOARD_NAME_TO_ID.get(boardName) || '',
                board_name: boardName,
                标题: title,
                内容: content,
                发布者: sender,
                ...(String(row.时间戳 ?? row.timestamp ?? row.发布时间 ?? fallbackTime ?? '').trim() ? { 时间戳: String(row.时间戳 ?? row.timestamp ?? row.发布时间 ?? fallbackTime ?? '').trim() } : {}),
                ...(toNumberOrNull(row.点赞数 ?? row.likes) !== null ? { 点赞数: Math.max(0, Math.floor(toNumberOrNull(row.点赞数 ?? row.likes) || 0)) } : {}),
                ...(toNumberOrNull(row.浏览数 ?? row.views) !== null ? { 浏览数: Math.max(0, Math.floor(toNumberOrNull(row.浏览数 ?? row.views) || 0)) } : {}),
                ...(typeof row.置顶 === 'boolean' ? { 置顶: row.置顶 ? 'yes' : 'no' } : {}),
                ...(typeof row.精华 === 'boolean' ? { 精华: row.精华 ? 'yes' : 'no' } : {}),
                ...(tags.length > 0 ? { 话题标签: tags.join(', ') } : {}),
                ...(String(row.图片描述 ?? row.image_desc ?? '').trim() ? { 图片描述: String(row.图片描述 ?? row.image_desc ?? '').trim() } : {}),
                ...(Array.isArray(row.回复) ? { 回复: row.回复 } : {})
            };
        };
        const rewriteLegacyBusinessCommand = (
            action: string,
            key: unknown,
            value: unknown,
            stateSnapshot: GameState
        ): TavernCommand | null => {
            const isLegacyBridgeAction = LEGACY_PATH_ACTIONS.has(action) || action === 'upsert_sheet_rows';
            if (!isLegacyBridgeAction) return null;
            const originatedFromUpsertSheetAlias = action === 'upsert_sheet_rows';
            if (originatedFromUpsertSheetAlias) {
                action = 'set';
            }
            const canonicalKey = normalizeLegacyBusinessPath(key);
            const isSurvivalLegacyPath = /^gameState\.角色\.生存状态\.(水分|饱腹度)$/.test(canonicalKey);
            if (!canonicalKey || (!isTableManagedLegacyPath(canonicalKey) && !isSurvivalLegacyPath)) return null;
            const fallbackSender = String(stateSnapshot?.角色?.姓名 ?? '').trim();
            const fallbackTime = String(stateSnapshot?.游戏时间 ?? '').trim();

            const makeGlobalUpsert = (row: Record<string, unknown>): TavernCommand | null => {
                if (!row || Object.keys(row).length === 0) return null;
                const currentTurn = Math.max(0, Math.floor(Number(stateSnapshot?.回合数 || 0)));
                const snapshotX = toNumberOrNull((stateSnapshot as any)?.世界坐标?.x);
                const snapshotY = toNumberOrNull((stateSnapshot as any)?.世界坐标?.y);
                const baseRow: Record<string, unknown> = {
                    _global_id: GLOBAL_STATE_ROW_ID,
                    当前回合: currentTurn,
                    当前场景: String(stateSnapshot?.当前地点 ?? '').trim() || undefined,
                    场景描述: String((stateSnapshot as any)?.场景描述 ?? '').trim() || undefined,
                    当前日期: String((stateSnapshot as any)?.当前日期 ?? '').trim() || undefined,
                    游戏时间: String((stateSnapshot as any)?.游戏时间 ?? '').trim() || undefined,
                    上轮时间: String((stateSnapshot as any)?.上轮时间 ?? '').trim() || undefined,
                    流逝时长: String((stateSnapshot as any)?.流逝时长 ?? '').trim() || undefined,
                    世界坐标X: snapshotX ?? undefined,
                    世界坐标Y: snapshotY ?? undefined,
                    天气状况: String((stateSnapshot as any)?.天气 ?? '').trim() || undefined,
                    战斗模式: String((stateSnapshot as any)?.战斗模式 ?? '').trim() || undefined,
                    系统通知: String((stateSnapshot as any)?.系统通知 ?? '').trim() || undefined
                };
                const mergedRow = {
                    ...baseRow,
                    ...row,
                    当前回合: Math.max(0, Math.floor(toNumberOrNull((row as any)?.当前回合) ?? currentTurn))
                };
                return {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'SYS_GlobalState',
                        keyField: '_global_id',
                        rows: [mergedRow]
                    }
                } as TavernCommand;
            };

            if (
                canonicalKey === 'gameState.当前地点'
                || canonicalKey === 'gameState.当前日期'
                || canonicalKey === 'gameState.游戏时间'
                || canonicalKey === 'gameState.上轮时间'
                || canonicalKey === 'gameState.流逝时长'
                || canonicalKey === 'gameState.场景描述'
                || canonicalKey === 'gameState.天气'
                || canonicalKey === 'gameState.战斗模式'
                || canonicalKey === 'gameState.系统通知'
                || canonicalKey === 'gameState.世界坐标'
                || canonicalKey === 'gameState.世界坐标.x'
                || canonicalKey === 'gameState.世界坐标.y'
            ) {
                const row: Record<string, unknown> = {};
                if (canonicalKey === 'gameState.当前地点') row.当前场景 = String(value ?? '').trim();
                if (canonicalKey === 'gameState.当前日期') row.当前日期 = String(value ?? '').trim();
                if (canonicalKey === 'gameState.游戏时间') row.游戏时间 = String(value ?? '').trim();
                if (canonicalKey === 'gameState.上轮时间') row.上轮时间 = String(value ?? '').trim();
                if (canonicalKey === 'gameState.流逝时长') row.流逝时长 = String(value ?? '').trim();
                if (canonicalKey === 'gameState.场景描述') row.场景描述 = String(value ?? '').trim();
                if (canonicalKey === 'gameState.天气') row.天气状况 = String(value ?? '').trim();
                if (canonicalKey === 'gameState.战斗模式') row.战斗模式 = String(value ?? '').trim();
                if (canonicalKey === 'gameState.系统通知') row.系统通知 = String(value ?? '').trim();
                if (canonicalKey === 'gameState.世界坐标') {
                    const obj = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
                    const x = toNumberOrNull(obj.x);
                    const y = toNumberOrNull(obj.y);
                    if (x !== null) row.世界坐标X = Math.round(x);
                    if (y !== null) row.世界坐标Y = Math.round(y);
                }
                if (canonicalKey === 'gameState.世界坐标.x') {
                    const incoming = toNumberOrNull(value);
                    const base = toNumberOrNull((stateSnapshot as any)?.世界坐标?.x) ?? 0;
                    if (incoming !== null) row.世界坐标X = Math.round(action === 'add' ? base + incoming : incoming);
                }
                if (canonicalKey === 'gameState.世界坐标.y') {
                    const incoming = toNumberOrNull(value);
                    const base = toNumberOrNull((stateSnapshot as any)?.世界坐标?.y) ?? 0;
                    if (incoming !== null) row.世界坐标Y = Math.round(action === 'add' ? base + incoming : incoming);
                }
                return makeGlobalUpsert(row);
            }

            if (canonicalKey === 'gameState.角色.法利' || canonicalKey === 'gameState.眷族.资金') {
                const account = canonicalKey === 'gameState.角色.法利' ? '角色.法利' : '眷族.资金';
                const current = account === '角色.法利'
                    ? (toNumberOrNull((stateSnapshot as any)?.角色?.法利) ?? 0)
                    : (toNumberOrNull((stateSnapshot as any)?.眷族?.资金) ?? 0);
                const incoming = toNumberOrNull(value);
                if (incoming === null) return null;
                const payloadObj = (value && typeof value === 'object' && !Array.isArray(value))
                    ? value as Record<string, unknown>
                    : null;
                const explicitDelta = payloadObj
                    ? toNumberOrNull(payloadObj.delta ?? payloadObj.变化 ?? payloadObj.增量)
                    : null;
                const delta = explicitDelta !== null
                    ? explicitDelta
                    : (
                        action === 'add' || (originatedFromUpsertSheetAlias && incoming < 0)
                            ? incoming
                            : (incoming - current)
                    );
                if (!Number.isFinite(delta)) return null;
                if (delta === 0) return null;
                return {
                    action: 'apply_econ_delta',
                    value: {
                        account,
                        delta,
                        reason: 'legacy-bridge',
                        commandRef: `${action}:${canonicalKey}`
                    }
                } as TavernCommand;
            }

            const survivalMatch = canonicalKey.match(/^gameState\.角色\.生存状态\.(水分|饱腹度)$/);
            if (survivalMatch) {
                const field = String(survivalMatch[1] || '').trim();
                const survival = ((stateSnapshot as any)?.角色?.生存状态 && typeof (stateSnapshot as any).角色.生存状态 === 'object')
                    ? (stateSnapshot as any).角色.生存状态
                    : null;
                if (!survival) return null;
                const incoming = toNumberOrNull(value);
                if (incoming === null) return null;
                const current = toNumberOrNull((survival as any)?.[field]) ?? 0;
                const maxField = field === '水分' ? '最大水分' : '最大饱腹度';
                const max = toNumberOrNull((survival as any)?.[maxField]) ?? 100;
                const useDelta = action === 'add' || originatedFromUpsertSheetAlias;
                const rawNext = useDelta ? (current + incoming) : incoming;
                const bounded = Math.max(0, Math.min(max > 0 ? max : 100, rawNext));
                return {
                    action: 'set',
                    key: canonicalKey,
                    value: Math.round(bounded)
                } as TavernCommand;
            }

            const phoneDeviceMatch = canonicalKey.match(/^gameState\.手机\.设备\.(当前信号|电量|状态)$/);
            if (phoneDeviceMatch && (action === 'set' || action === 'add' || action === 'delete')) {
                const field = String(phoneDeviceMatch[1] || '').trim();
                const baseDevice = ((stateSnapshot as any)?.手机?.设备 && typeof (stateSnapshot as any).手机.设备 === 'object')
                    ? (stateSnapshot as any).手机.设备
                    : {};
                const row: Record<string, unknown> = {
                    device_id: 'main',
                    battery: toNumberOrNull(baseDevice.电量) ?? 0,
                    signal: toNumberOrNull(baseDevice.当前信号) ?? 0,
                    status: String(baseDevice.状态 ?? 'online').trim() || 'online'
                };
                if (field === '当前信号') {
                    const incoming = toNumberOrNull(value);
                    if (incoming === null) return null;
                    const current = toNumberOrNull(row.signal) ?? 0;
                    row.signal = action === 'add' ? (current + incoming) : incoming;
                } else if (field === '电量') {
                    const incoming = toNumberOrNull(value);
                    if (incoming === null) return null;
                    const current = toNumberOrNull(row.battery) ?? 0;
                    row.battery = action === 'add' ? (current + incoming) : incoming;
                } else if (field === '状态') {
                    row.status = action === 'delete' ? 'offline' : (String(value ?? '').trim() || row.status);
                }
                return {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Device',
                        keyField: 'device_id',
                        rows: [row]
                    }
                } as TavernCommand;
            }

            if (canonicalKey === 'gameState.社交') {
                if (action === 'push' || action === 'set') {
                    const rows = Array.isArray(value) ? value : [value];
                    const normalizedRows = rows
                        .filter((row) => !!row && typeof row === 'object')
                        .map((row) => row as Record<string, unknown>);
                    if (normalizedRows.length === 0) return null;
                    return { action: 'upsert_npc', value: normalizedRows } as TavernCommand;
                }
                return null;
            }

            if (canonicalKey === 'gameState.背包') {
                if (action === 'set' || action === 'push') {
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item) => {
                            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
                            const row = item as Record<string, unknown>;
                            const name = String(row.名称 ?? row.物品名称 ?? row.name ?? '').trim();
                            if (!name) return null;
                            const quantity = toNumberOrNull(row.数量 ?? row.count ?? row.qty);
                            return {
                                ...row,
                                id: String(row.id ?? row.物品ID ?? name).trim() || undefined,
                                名称: name,
                                数量: quantity !== null ? Math.max(0, Math.floor(quantity)) : 1,
                                类型: String(row.类型 ?? row.类别 ?? row.type ?? '').trim() || undefined,
                                描述: String(row.描述 ?? row.description ?? '').trim() || undefined
                            } as Record<string, unknown>;
                        })
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'ITEM_Inventory',
                            keyField: 'id',
                            rows
                        }
                    } as TavernCommand;
                }
                return null;
            }

            const inventoryMatch = canonicalKey.match(/^gameState\.背包(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
            if (inventoryMatch) {
                const inventoryIndex = Number(inventoryMatch[1] ?? inventoryMatch[2]);
                const rawField = String(inventoryMatch[3] || '').trim();
                const inventory = Array.isArray((stateSnapshot as any)?.背包) ? (stateSnapshot as any).背包 : [];
                const targetItem = inventory[inventoryIndex];
                if (!targetItem) return null;
                const row: Record<string, unknown> = {
                    id: String((targetItem as any)?.id ?? (targetItem as any)?.物品ID ?? '').trim() || undefined,
                    名称: String((targetItem as any)?.名称 ?? '').trim(),
                    数量: toNumberOrNull((targetItem as any)?.数量) ?? 1,
                    类型: String((targetItem as any)?.类型 ?? '').trim() || undefined,
                    描述: String((targetItem as any)?.描述 ?? '').trim() || undefined
                };
                if (!rawField && action === 'set' && value && typeof value === 'object' && !Array.isArray(value)) {
                    const merged = value as Record<string, unknown>;
                    const name = String(merged.名称 ?? merged.物品名称 ?? merged.name ?? row.名称 ?? '').trim();
                    if (!name) return null;
                    const quantity = toNumberOrNull(merged.数量 ?? merged.count ?? merged.qty);
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'ITEM_Inventory',
                            keyField: 'id',
                            rows: [{
                                ...targetItem,
                                ...merged,
                                id: String(merged.id ?? merged.物品ID ?? row.id ?? name).trim() || undefined,
                                名称: name,
                                数量: quantity !== null ? Math.max(0, Math.floor(quantity)) : (toNumberOrNull((targetItem as any)?.数量) ?? 1),
                                类型: String(merged.类型 ?? merged.类别 ?? merged.type ?? row.类型 ?? '').trim() || undefined,
                                描述: String(merged.描述 ?? merged.description ?? row.描述 ?? '').trim() || undefined
                            }]
                        }
                    } as TavernCommand;
                }
                if (!rawField) return null;
                const field = rawField
                    .replace(/^name$/i, '名称')
                    .replace(/^count$/i, '数量')
                    .replace(/^qty$/i, '数量')
                    .replace(/^description$/i, '描述')
                    .replace(/^type$/i, '类型')
                    .replace(/^quality$/i, '品质')
                    .replace(/^value$/i, '价值')
                    .replace(/^equipped$/i, '已装备');
                if (field === '数量' || field === '价值') {
                    const incoming = toNumberOrNull(value);
                    if (incoming === null) return null;
                    const current = toNumberOrNull(row[field]) ?? 0;
                    row[field] = Math.max(0, Math.floor(action === 'add' ? current + incoming : incoming));
                } else if (field === '已装备') {
                    row.已装备 = action === 'delete' ? false : Boolean(value);
                } else if (['名称', '描述', '类型', '品质'].includes(field)) {
                    row[field] = String(value ?? '').trim();
                } else {
                    return null;
                }
                if (!String(row.名称 || '').trim()) return null;
                return {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'ITEM_Inventory',
                        keyField: 'id',
                        rows: [row]
                    }
                } as TavernCommand;
            }

            if (canonicalKey === 'gameState.任务') {
                if (action === 'set' || action === 'push') {
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item, index) => {
                            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
                            const row = item as Record<string, unknown>;
                            const questId = String(row.任务ID ?? row.id ?? `QUEST_${index + 1}`).trim();
                            const title = String(row.任务名称 ?? row.标题 ?? row.title ?? '').trim();
                            if (!title) return null;
                            return {
                                ...row,
                                任务ID: questId,
                                任务名称: title,
                                目标描述: String(row.目标描述 ?? row.描述 ?? row.description ?? '').trim() || undefined,
                                状态: String(row.状态 ?? row.status ?? row.state ?? 'active').trim() || 'active',
                                奖励: String(row.奖励 ?? row.reward ?? '').trim() || undefined,
                                评级: String(row.评级 ?? row.rank ?? 'E').trim() || 'E',
                                时限: String(row.时限 ?? row.截止时间 ?? row.deadline ?? '').trim() || undefined
                            } as Record<string, unknown>;
                        })
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'QUEST_Active',
                            keyField: '任务ID',
                            rows
                        }
                    } as TavernCommand;
                }
                return null;
            }

            const questMatch = canonicalKey.match(/^gameState\.任务(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
            if (questMatch) {
                const questIndex = Number(questMatch[1] ?? questMatch[2]);
                const rawField = String(questMatch[3] || '').trim();
                const quests = Array.isArray((stateSnapshot as any)?.任务) ? (stateSnapshot as any).任务 : [];
                const targetQuest = quests[questIndex];
                if (!targetQuest) return null;
                const baseRow: Record<string, unknown> = {
                    任务ID: String((targetQuest as any)?.id ?? `QUEST_${questIndex + 1}`).trim(),
                    任务名称: String((targetQuest as any)?.标题 ?? '').trim() || `任务${questIndex + 1}`,
                    目标描述: String((targetQuest as any)?.描述 ?? '').trim() || undefined,
                    状态: String((targetQuest as any)?.状态 ?? 'active').trim() || 'active',
                    奖励: String((targetQuest as any)?.奖励 ?? '').trim() || undefined,
                    评级: String((targetQuest as any)?.评级 ?? 'E').trim() || 'E',
                    时限: String((targetQuest as any)?.截止时间 ?? '').trim() || undefined
                };
                if (!rawField && action === 'set' && value && typeof value === 'object' && !Array.isArray(value)) {
                    const merged = value as Record<string, unknown>;
                    const title = String(merged.任务名称 ?? merged.标题 ?? merged.title ?? baseRow.任务名称 ?? '').trim();
                    if (!title) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'QUEST_Active',
                            keyField: '任务ID',
                            rows: [{
                                ...baseRow,
                                ...merged,
                                任务ID: String(merged.任务ID ?? merged.id ?? baseRow.任务ID).trim(),
                                任务名称: title,
                                目标描述: String(merged.目标描述 ?? merged.描述 ?? merged.description ?? baseRow.目标描述 ?? '').trim() || undefined,
                                状态: String(merged.状态 ?? merged.status ?? merged.state ?? baseRow.状态 ?? 'active').trim() || 'active',
                                奖励: String(merged.奖励 ?? merged.reward ?? baseRow.奖励 ?? '').trim() || undefined,
                                评级: String(merged.评级 ?? merged.rank ?? baseRow.评级 ?? 'E').trim() || 'E',
                                时限: String(merged.时限 ?? merged.截止时间 ?? merged.deadline ?? baseRow.时限 ?? '').trim() || undefined
                            }]
                        }
                    } as TavernCommand;
                }
                if (!rawField) return null;
                const field = rawField
                    .replace(/^id$/i, '任务ID')
                    .replace(/^title$/i, '任务名称')
                    .replace(/^name$/i, '任务名称')
                    .replace(/^description$/i, '目标描述')
                    .replace(/^status$/i, '状态')
                    .replace(/^state$/i, '状态')
                    .replace(/^reward$/i, '奖励')
                    .replace(/^rank$/i, '评级')
                    .replace(/^deadline$/i, '时限')
                    .replace(/^log$/i, '日志');
                if (field === '日志') {
                    if (action !== 'set' && action !== 'push') return null;
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item, index) => {
                            if (item === null || item === undefined) return null;
                            const row = (typeof item === 'object' && !Array.isArray(item))
                                ? item as Record<string, unknown>
                                : { 内容: String(item) };
                            const content = String(row.内容 ?? row.content ?? '').trim();
                            const timestamp = String(row.时间戳 ?? row.timestamp ?? stateSnapshot?.游戏时间 ?? '').trim();
                            if (!content || !timestamp) return null;
                            const normalizedStatus = String(row.状态 ?? row.status ?? baseRow.状态 ?? '').trim();
                            return {
                                progress_id: String(row.progress_id ?? row.id ?? `${baseRow.任务ID}_log_${Date.now()}_${index + 1}`).trim(),
                                quest_id: String(baseRow.任务ID),
                                timestamp,
                                content,
                                status: normalizedStatus || undefined,
                                source: 'legacy-bridge'
                            } as Record<string, unknown>;
                        })
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'QUEST_ProgressLog',
                            keyField: 'progress_id',
                            rows
                        }
                    } as TavernCommand;
                }
                if (['任务ID', '任务名称', '目标描述', '状态', '奖励', '评级', '时限'].includes(field)) {
                    baseRow[field] = String(value ?? '').trim();
                    if (field === '状态') {
                        baseRow[field] = String(value ?? 'active').trim() || 'active';
                    }
                    if (field === '任务ID') {
                        baseRow[field] = String(value ?? baseRow[field]).trim() || String(baseRow[field] || `QUEST_${questIndex + 1}`);
                    }
                    if (!String(baseRow.任务名称 || '').trim()) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'QUEST_Active',
                            keyField: '任务ID',
                            rows: [baseRow]
                        }
                    } as TavernCommand;
                }
                return null;
            }

            const socialMatch = canonicalKey.match(/^gameState\.社交(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
            if (socialMatch) {
                const socialIndex = Number(socialMatch[1] ?? socialMatch[2]);
                const rawField = String(socialMatch[3] || '').trim();
                const social = Array.isArray(stateSnapshot?.社交) ? stateSnapshot.社交 : [];
                const targetNpc = social[socialIndex];
                if (!targetNpc) return null;
                if (!rawField && action === 'set' && value && typeof value === 'object') {
                    return { action: 'upsert_npc', value: [{ ...value, id: (value as any).id || targetNpc.id || targetNpc.姓名 }] } as TavernCommand;
                }
                if (!rawField) return null;
                const field = rawField
                    .replace(/^affinity$/i, '好感度')
                    .replace(/^favorability$/i, '好感度')
                    .replace(/^isPresent$/i, '是否在场')
                    .replace(/^status$/i, '当前状态')
                    .replace(/^relationshipStatus$/i, '关系状态')
                    .replace(/^relation$/i, '与主角关系')
                    .replace(/^locationDetail$/i, '位置详情')
                    .replace(/^location$/i, '所在位置')
                    .replace(/^memory$/i, '记忆')
                    .replace(/^memories$/i, '记忆')
                    .replace(/^recentMemory$/i, '记忆');
                const row: Record<string, unknown> = {
                    id: targetNpc.id || targetNpc.姓名 || `npc_${socialIndex + 1}`
                };
                if (field === '好感度') {
                    const incoming = toNumberOrNull(value);
                    if (incoming === null) return null;
                    const base = toNumberOrNull((targetNpc as any).好感度) ?? 0;
                    row.好感度 = action === 'add' ? base + incoming : incoming;
                } else if (field === '是否在场') {
                    row.是否在场 = action === 'delete' ? false : Boolean(value);
                } else if (field === '当前状态') {
                    row.当前状态 = String(value ?? '').trim() || undefined;
                } else if (field === '关系状态') {
                    row.关系状态 = String(value ?? '').trim() || undefined;
                    row.与主角关系 = String(value ?? '').trim() || undefined;
                } else if (field === '与主角关系') {
                    row.与主角关系 = String(value ?? '').trim() || undefined;
                } else if (field === '位置详情' || field === '所在位置') {
                    const text = String(value ?? '').trim();
                    row.所在位置 = text || undefined;
                    row.位置详情 = text || undefined;
                } else if (field === '记忆') {
                    const fallbackTime = String(stateSnapshot?.游戏时间 || '未知').trim() || '未知';
                    const existingMemories = Array.isArray((targetNpc as any)?.记忆) ? [...(targetNpc as any).记忆] : [];
                    if (action === 'push') {
                        const incomingRaw = Array.isArray(value) ? value : [value];
                        const incoming = incomingRaw
                            .map((item) => normalizeNpcMemoryEntry(item, fallbackTime))
                            .filter((item): item is { 内容: string; 时间戳: string } => !!item);
                        if (incoming.length === 0) return null;
                        row.记忆 = [...existingMemories, ...incoming];
                    } else if (action === 'set') {
                        const incomingRaw = Array.isArray(value) ? value : [value];
                        const incoming = incomingRaw
                            .map((item) => normalizeNpcMemoryEntry(item, fallbackTime))
                            .filter((item): item is { 内容: string; 时间戳: string } => !!item);
                        if (incoming.length === 0) return null;
                        row.记忆 = incoming;
                    }
                } else {
                    return null;
                }
                return { action: 'upsert_npc', value: [row] } as TavernCommand;
            }

            if (canonicalKey === 'gameState.世界.NPC后台跟踪') {
                if (action === 'set' || action === 'push') {
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item, index) => normalizeWorldTrackingRow(item, index))
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'WORLD_NpcTracking',
                            keyField: 'tracking_id',
                            rows
                        }
                    } as TavernCommand;
                }
                return null;
            }

            const trackingMatch = canonicalKey.match(/^gameState\.世界\.NPC后台跟踪(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
            if (trackingMatch) {
                const trackIndex = Number(trackingMatch[1] ?? trackingMatch[2]);
                const rawField = String(trackingMatch[3] || '').trim();
                const trackingList = Array.isArray((stateSnapshot as any)?.世界?.NPC后台跟踪)
                    ? (stateSnapshot as any).世界.NPC后台跟踪
                    : [];
                const existing = trackingList[trackIndex];
                if (!existing) return null;
                const normalizedBase = normalizeWorldTrackingRow(existing, trackIndex);
                if (!normalizedBase) return null;
                if (!rawField) return null;
                const field = rawField
                    .replace(/^NPC$/i, 'npc_name')
                    .replace(/^当前行动$/i, 'current_action')
                    .replace(/^位置$/i, 'location')
                    .replace(/^进度$/i, 'progress')
                    .replace(/^预计完成$/i, 'eta');
                if (field === 'npc_name' || field === 'current_action' || field === 'location' || field === 'progress' || field === 'eta') {
                    (normalizedBase as any)[field] = String(value ?? '').trim();
                    if (!String((normalizedBase as any).npc_name || '').trim() || !String((normalizedBase as any).current_action || '').trim()) {
                        return null;
                    }
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'WORLD_NpcTracking',
                            keyField: 'tracking_id',
                            rows: [normalizedBase]
                        }
                    } as TavernCommand;
                }
            }

            if (canonicalKey === 'gameState.世界.头条新闻') {
                if (action === 'set' || action === 'push') {
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item, index) => normalizeWorldNewsRow(item, index))
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'WORLD_News',
                            keyField: 'news_id',
                            rows
                        }
                    } as TavernCommand;
                }
                return null;
            }
            const newsMatch = canonicalKey.match(/^gameState\.世界\.头条新闻(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
            if (newsMatch && action === 'set') {
                const newsIndex = Number(newsMatch[1] ?? newsMatch[2]);
                const rawField = String(newsMatch[3] || '').trim();
                const newsList = Array.isArray((stateSnapshot as any)?.世界?.头条新闻)
                    ? (stateSnapshot as any).世界.头条新闻
                    : [];
                const existing = newsList[newsIndex];
                if (!existing) return null;
                const base = normalizeWorldNewsRow(existing, newsIndex);
                if (!base || !rawField) return null;
                const field = rawField
                    .replace(/^id$/i, 'news_id')
                    .replace(/^title$/i, '标题')
                    .replace(/^content$/i, '内容')
                    .replace(/^timestamp$/i, '时间戳')
                    .replace(/^source$/i, '来源')
                    .replace(/^priority$/i, '重要度')
                    .replace(/^linkedRumor$/i, '关联传闻');
                if (!['news_id', '标题', '内容', '时间戳', '来源', '重要度', '关联传闻'].includes(field)) return null;
                (base as any)[field] = String(value ?? '').trim();
                if (!String((base as any).标题 || '').trim()) return null;
                return {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'WORLD_News',
                        keyField: 'news_id',
                        rows: [base]
                    }
                } as TavernCommand;
            }

            if (canonicalKey === 'gameState.世界.街头传闻') {
                if (action === 'set' || action === 'push') {
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item, index) => normalizeWorldRumorRow(item, index))
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'WORLD_Rumors',
                            keyField: 'rumor_id',
                            rows
                        }
                    } as TavernCommand;
                }
                return null;
            }
            const rumorMatch = canonicalKey.match(/^gameState\.世界\.街头传闻(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
            if (rumorMatch && action === 'set') {
                const rumorIndex = Number(rumorMatch[1] ?? rumorMatch[2]);
                const rawField = String(rumorMatch[3] || '').trim();
                const rumorList = Array.isArray((stateSnapshot as any)?.世界?.街头传闻)
                    ? (stateSnapshot as any).世界.街头传闻
                    : [];
                const existing = rumorList[rumorIndex];
                if (!existing) return null;
                const base = normalizeWorldRumorRow(existing, rumorIndex);
                if (!base || !rawField) return null;
                const field = rawField
                    .replace(/^id$/i, 'rumor_id')
                    .replace(/^topic$/i, '主题')
                    .replace(/^content$/i, '内容')
                    .replace(/^spread$/i, '传播度')
                    .replace(/^credibility$/i, '可信度')
                    .replace(/^source$/i, '来源')
                    .replace(/^tags$/i, '话题标签')
                    .replace(/^foundAt$/i, '发现时间')
                    .replace(/^commentCount$/i, '评论数')
                    .replace(/^upgraded$/i, '已升级为新闻')
                    .replace(/^linkedNews$/i, '关联新闻');
                if (!['rumor_id', '主题', '内容', '传播度', '可信度', '来源', '话题标签', '发现时间', '评论数', '已升级为新闻', '关联新闻'].includes(field)) return null;
                if (field === '传播度' || field === '评论数') {
                    const n = toNumberOrNull(value);
                    if (n === null) return null;
                    (base as any)[field] = Math.max(0, Math.floor(n));
                } else if (field === '已升级为新闻') {
                    (base as any)[field] = Boolean(value) ? '是' : '否';
                } else if (field === '话题标签' && Array.isArray(value)) {
                    (base as any)[field] = value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
                } else {
                    (base as any)[field] = String(value ?? '').trim();
                }
                if (!String((base as any).主题 || '').trim()) return null;
                return {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'WORLD_Rumors',
                        keyField: 'rumor_id',
                        rows: [base]
                    }
                } as TavernCommand;
            }

            if (canonicalKey === 'gameState.世界.诸神神会') {
                if (action === 'set') {
                    const row = normalizeWorldDenatusRow(value);
                    if (!row) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'WORLD_Denatus',
                            keyField: 'denatus_id',
                            rows: [row]
                        }
                    } as TavernCommand;
                }
                return null;
            }
            const denatusMatch = canonicalKey.match(/^gameState\.世界\.诸神神会\.(.+)$/);
            if (denatusMatch && action === 'set') {
                const rawField = String(denatusMatch[1] || '').trim();
                const current = ((stateSnapshot as any)?.世界?.诸神神会 && typeof (stateSnapshot as any).世界.诸神神会 === 'object')
                    ? (stateSnapshot as any).世界.诸神神会
                    : {};
                const row = normalizeWorldDenatusRow(current) || normalizeWorldDenatusRow({});
                if (!row) return null;
                const field = rawField
                    .replace(/^nextTime$/i, '下次神会开启时间')
                    .replace(/^topic$/i, '神会主题')
                    .replace(/^discussion$/i, '讨论内容')
                    .replace(/^result$/i, '最终结果');
                if (!['下次神会开启时间', '神会主题', '讨论内容', '最终结果'].includes(field)) return null;
                (row as any)[field] = value as any;
                return {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'WORLD_Denatus',
                        keyField: 'denatus_id',
                        rows: [row]
                    }
                } as TavernCommand;
            }

            if (canonicalKey === 'gameState.世界.战争游戏') {
                if (action === 'set') {
                    const row = normalizeWorldWarGameRow(value);
                    if (!row) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'WORLD_WarGame',
                            keyField: 'war_game_id',
                            rows: [row]
                        }
                    } as TavernCommand;
                }
                return null;
            }
            const warGameMatch = canonicalKey.match(/^gameState\.世界\.战争游戏\.(.+)$/);
            if (warGameMatch && action === 'set') {
                const rawField = String(warGameMatch[1] || '').trim();
                const current = ((stateSnapshot as any)?.世界?.战争游戏 && typeof (stateSnapshot as any).世界.战争游戏 === 'object')
                    ? (stateSnapshot as any).世界.战争游戏
                    : {};
                const row = normalizeWorldWarGameRow(current) || normalizeWorldWarGameRow({});
                if (!row) return null;
                const field = rawField
                    .replace(/^status$/i, '状态')
                    .replace(/^participants$/i, '参战眷族')
                    .replace(/^mode$/i, '形式')
                    .replace(/^stake$/i, '赌注')
                    .replace(/^startAt$/i, '举办时间')
                    .replace(/^endAt$/i, '结束时间')
                    .replace(/^result$/i, '结果')
                    .replace(/^note$/i, '备注');
                if (!['状态', '参战眷族', '形式', '赌注', '举办时间', '结束时间', '结果', '备注'].includes(field)) return null;
                if (field === '参战眷族' && Array.isArray(value)) {
                    (row as any)[field] = value.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
                } else {
                    (row as any)[field] = String(value ?? '').trim();
                }
                return {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'WORLD_WarGame',
                        keyField: 'war_game_id',
                        rows: [row]
                    }
                } as TavernCommand;
            }

            if (canonicalKey === 'gameState.手机.朋友圈' && action === 'set' && value && typeof value === 'object') {
                const payload = value as Record<string, unknown>;
                const sourceRows = Array.isArray(payload.帖子) ? payload.帖子 : [];
                const rows = sourceRows
                    .map((item, index) => normalizeMomentRow(item, index, fallbackSender, fallbackTime))
                    .filter((row): row is Record<string, unknown> => !!row);
                if (rows.length === 0) return null;
                return {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Moments',
                        keyField: 'moment_id',
                        rows
                    }
                } as TavernCommand;
            }

            if (canonicalKey === 'gameState.手机.朋友圈.帖子') {
                if (action === 'set' || action === 'push') {
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item, index) => normalizeMomentRow(item, index, fallbackSender, fallbackTime))
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'PHONE_Moments',
                            keyField: 'moment_id',
                            rows
                        }
                    } as TavernCommand;
                }
                return null;
            }

            const momentMatch = canonicalKey.match(/^gameState\.手机\.朋友圈\.帖子(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
            if (momentMatch) {
                const postIndex = Number(momentMatch[1] ?? momentMatch[2]);
                const rawField = String(momentMatch[3] || '').trim();
                const posts = Array.isArray((stateSnapshot as any)?.手机?.朋友圈?.帖子)
                    ? (stateSnapshot as any).手机.朋友圈.帖子
                    : [];
                const existing = posts[postIndex];
                if (!existing) return null;
                if (!rawField && action === 'set' && value && typeof value === 'object') {
                    const row = normalizeMomentRow(value, postIndex, fallbackSender, fallbackTime);
                    if (!row) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: { sheetId: 'PHONE_Moments', keyField: 'moment_id', rows: [row] }
                    } as TavernCommand;
                }
                if (!rawField) return null;
                const base = normalizeMomentRow(existing, postIndex, fallbackSender, fallbackTime);
                if (!base) return null;
                const field = rawField
                    .replace(/^id$/i, 'moment_id')
                    .replace(/^sender$/i, '发布者')
                    .replace(/^content$/i, '内容')
                    .replace(/^timestamp$/i, '时间戳')
                    .replace(/^visibility$/i, '可见性')
                    .replace(/^likes$/i, '点赞数')
                    .replace(/^comment_count$/i, '评论数')
                    .replace(/^tags$/i, '话题标签')
                    .replace(/^image_desc$/i, '图片描述');
                if (!['moment_id', '发布者', '内容', '时间戳', '可见性', '点赞数', '评论数', '话题标签', '图片描述'].includes(field)) return null;
                if (field === '点赞数' || field === '评论数') {
                    const incoming = toNumberOrNull(value);
                    if (incoming === null) return null;
                    const current = toNumberOrNull((base as any)[field]) ?? 0;
                    (base as any)[field] = Math.max(0, Math.floor(action === 'add' ? current + incoming : incoming));
                } else if (field === '话题标签') {
                    const tags = Array.isArray(value)
                        ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
                        : String(value ?? '').split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
                    (base as any)[field] = tags.join(', ');
                } else {
                    (base as any)[field] = String(value ?? '').trim();
                }
                if (!String((base as any).内容 || '').trim() || !String((base as any).发布者 || '').trim()) return null;
                return {
                    action: 'upsert_sheet_rows',
                    value: { sheetId: 'PHONE_Moments', keyField: 'moment_id', rows: [base] }
                } as TavernCommand;
            }

            if (canonicalKey === 'gameState.手机.公共帖子' && action === 'set' && value && typeof value === 'object') {
                const payload = value as Record<string, unknown>;
                const postRows = (Array.isArray(payload.帖子) ? payload.帖子 : [])
                    .map((item, index) => normalizeForumPostRow(item, index, fallbackSender, fallbackTime))
                    .filter((row): row is Record<string, unknown> => !!row);
                if (postRows.length > 0) {
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'FORUM_Posts',
                            keyField: 'post_id',
                            rows: postRows
                        }
                    } as TavernCommand;
                }
                const boardRows = (Array.isArray(payload.板块) ? payload.板块 : [])
                    .map((item, index) => normalizeForumBoardRow(item, index))
                    .filter((row): row is Record<string, unknown> => !!row);
                if (boardRows.length > 0) {
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'FORUM_Boards',
                            keyField: 'board_id',
                            rows: boardRows
                        }
                    } as TavernCommand;
                }
                return null;
            }

            if (canonicalKey === 'gameState.手机.公共帖子.板块') {
                if (action === 'set' || action === 'push') {
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item, index) => normalizeForumBoardRow(item, index))
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'FORUM_Boards',
                            keyField: 'board_id',
                            rows
                        }
                    } as TavernCommand;
                }
                return null;
            }

            const forumBoardMatch = canonicalKey.match(/^gameState\.手机\.公共帖子\.板块(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
            if (forumBoardMatch) {
                const boardIndex = Number(forumBoardMatch[1] ?? forumBoardMatch[2]);
                const rawField = String(forumBoardMatch[3] || '').trim();
                const boards = Array.isArray((stateSnapshot as any)?.手机?.公共帖子?.板块)
                    ? (stateSnapshot as any).手机.公共帖子.板块
                    : [];
                const existing = boards[boardIndex];
                if (!existing) return null;
                if (!rawField && action === 'set' && value && typeof value === 'object') {
                    const row = normalizeForumBoardRow(value, boardIndex);
                    if (!row) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: { sheetId: 'FORUM_Boards', keyField: 'board_id', rows: [row] }
                    } as TavernCommand;
                }
                if (!rawField) return null;
                const base = normalizeForumBoardRow(existing, boardIndex);
                if (!base) return null;
                const field = rawField
                    .replace(/^id$/i, 'board_id')
                    .replace(/^name$/i, '名称')
                    .replace(/^icon$/i, '图标')
                    .replace(/^color$/i, '颜色')
                    .replace(/^desc$/i, '描述')
                    .replace(/^description$/i, '描述');
                if (!['board_id', '名称', '图标', '颜色', '描述'].includes(field)) return null;
                (base as any)[field] = String(value ?? '').trim();
                if (!String((base as any).名称 || '').trim()) return null;
                return {
                    action: 'upsert_sheet_rows',
                    value: { sheetId: 'FORUM_Boards', keyField: 'board_id', rows: [base] }
                } as TavernCommand;
            }

            if (canonicalKey === 'gameState.手机.公共帖子.帖子') {
                if (action === 'set' || action === 'push') {
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item, index) => normalizeForumPostRow(item, index, fallbackSender, fallbackTime))
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'FORUM_Posts',
                            keyField: 'post_id',
                            rows
                        }
                    } as TavernCommand;
                }
                return null;
            }

            const forumPostMatch = canonicalKey.match(/^gameState\.手机\.公共帖子\.帖子(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
            if (forumPostMatch) {
                const postIndex = Number(forumPostMatch[1] ?? forumPostMatch[2]);
                const rawField = String(forumPostMatch[3] || '').trim();
                const posts = Array.isArray((stateSnapshot as any)?.手机?.公共帖子?.帖子)
                    ? (stateSnapshot as any).手机.公共帖子.帖子
                    : [];
                const existing = posts[postIndex];
                if (!existing) return null;

                if (!rawField && action === 'set' && value && typeof value === 'object') {
                    const row = normalizeForumPostRow(value, postIndex, fallbackSender, fallbackTime);
                    if (!row) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: { sheetId: 'FORUM_Posts', keyField: 'post_id', rows: [row] }
                    } as TavernCommand;
                }
                if (!rawField) return null;

                if (rawField === '回复') {
                    if (action !== 'push' && action !== 'set') return null;
                    const postId = String(existing?.id || `Forum_${postIndex + 1}`).trim();
                    const sourceRows = Array.isArray(value) ? value : [value];
                    const rows = sourceRows
                        .map((item, index) => normalizeForumReplyRow(item, postId, index, fallbackTime))
                        .filter((row): row is Record<string, unknown> => !!row);
                    if (rows.length === 0) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'FORUM_Replies',
                            keyField: 'reply_id',
                            rows
                        }
                    } as TavernCommand;
                }

                const replyFieldMatch = rawField.match(/^回复(?:\[(\d+)\]|\.(\d+))(?:\.(.+))?$/);
                if (replyFieldMatch) {
                    const postId = String(existing?.id || `Forum_${postIndex + 1}`).trim();
                    const replyIndex = Number(replyFieldMatch[1] ?? replyFieldMatch[2]);
                    const nestedField = String(replyFieldMatch[3] || '').trim();
                    const existingReplies = Array.isArray((existing as any)?.回复) ? (existing as any).回复 : [];
                    const targetReply = existingReplies[replyIndex];
                    if (!targetReply) return null;
                    if (!nestedField && action === 'set' && value && typeof value === 'object') {
                        const row = normalizeForumReplyRow(value, postId, replyIndex, fallbackTime);
                        if (!row) return null;
                        return {
                            action: 'upsert_sheet_rows',
                            value: { sheetId: 'FORUM_Replies', keyField: 'reply_id', rows: [row] }
                        } as TavernCommand;
                    }
                    if (!nestedField) return null;
                    const baseReply = normalizeForumReplyRow(targetReply, postId, replyIndex, fallbackTime);
                    if (!baseReply) return null;
                    const field = nestedField
                        .replace(/^id$/i, 'reply_id')
                        .replace(/^sender$/i, '发布者')
                        .replace(/^content$/i, '内容')
                        .replace(/^timestamp$/i, '时间戳')
                        .replace(/^floor$/i, '楼层')
                        .replace(/^quote_floor$/i, '引用楼层')
                        .replace(/^likes$/i, '点赞数');
                    if (!['reply_id', '楼层', '发布者', '内容', '时间戳', '引用楼层', '点赞数'].includes(field)) return null;
                    if (field === '楼层' || field === '引用楼层' || field === '点赞数') {
                        const incoming = toNumberOrNull(value);
                        if (incoming === null) return null;
                        const current = toNumberOrNull((baseReply as any)[field]) ?? 0;
                        (baseReply as any)[field] = Math.max(0, Math.floor(action === 'add' ? current + incoming : incoming));
                    } else {
                        (baseReply as any)[field] = String(value ?? '').trim();
                    }
                    if (!String((baseReply as any).发布者 || '').trim() || !String((baseReply as any).内容 || '').trim()) return null;
                    return {
                        action: 'upsert_sheet_rows',
                        value: { sheetId: 'FORUM_Replies', keyField: 'reply_id', rows: [baseReply] }
                    } as TavernCommand;
                }

                const base = normalizeForumPostRow(existing, postIndex, fallbackSender, fallbackTime);
                if (!base) return null;
                const field = rawField
                    .replace(/^id$/i, 'post_id')
                    .replace(/^title$/i, '标题')
                    .replace(/^content$/i, '内容')
                    .replace(/^sender$/i, '发布者')
                    .replace(/^timestamp$/i, '时间戳')
                    .replace(/^board$/i, 'board_name')
                    .replace(/^boardId$/i, 'board_id')
                    .replace(/^likes$/i, '点赞数')
                    .replace(/^views$/i, '浏览数')
                    .replace(/^tags$/i, '话题标签')
                    .replace(/^image_desc$/i, '图片描述');
                if (!['post_id', 'board_id', 'board_name', '标题', '内容', '发布者', '时间戳', '点赞数', '浏览数', '置顶', '精华', '话题标签', '图片描述'].includes(field)) return null;
                if (field === '点赞数' || field === '浏览数') {
                    const incoming = toNumberOrNull(value);
                    if (incoming === null) return null;
                    const current = toNumberOrNull((base as any)[field]) ?? 0;
                    (base as any)[field] = Math.max(0, Math.floor(action === 'add' ? current + incoming : incoming));
                } else if (field === '话题标签') {
                    const tags = Array.isArray(value)
                        ? value.map((item) => String(item ?? '').trim()).filter(Boolean)
                        : String(value ?? '').split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
                    (base as any)[field] = tags.join(', ');
                } else if (field === '置顶' || field === '精华') {
                    (base as any)[field] = Boolean(value) ? 'yes' : 'no';
                } else {
                    (base as any)[field] = String(value ?? '').trim();
                }
                if (!String((base as any).标题 || '').trim() || !String((base as any).内容 || '').trim() || !String((base as any).发布者 || '').trim()) {
                    return null;
                }
                return {
                    action: 'upsert_sheet_rows',
                    value: { sheetId: 'FORUM_Posts', keyField: 'post_id', rows: [base] }
                } as TavernCommand;
            }

            return null;
        };
        if (Array.isArray(commandBatch)) {
            commandBatch.forEach(cmd => {
                try {
                    if ((cmd as any) && typeof (cmd as any) === 'object' && !Array.isArray(cmd)) {
                        const commandAlias = (cmd as any).action ?? (cmd as any).type ?? (cmd as any).command ?? (cmd as any).name ?? (cmd as any).mode;
                        if (!commandAlias && typeof (cmd as any).cmd === 'string') {
                            (cmd as any).action = (cmd as any).cmd;
                        } else if (!(cmd as any).action && typeof commandAlias === 'string' && commandAlias.trim()) {
                            (cmd as any).action = commandAlias;
                        }
                        if ((cmd as any).value === undefined && (cmd as any).args !== undefined) {
                            (cmd as any).value = (cmd as any).args;
                        }
                        if ((cmd as any).value === undefined && (cmd as any).arguments !== undefined) {
                            (cmd as any).value = (cmd as any).arguments;
                        }
                    }
                    const inlineFunctionCommand = parseInlineFunctionStyleCommand(cmd as any);
                    if (inlineFunctionCommand) {
                        cmd = inlineFunctionCommand as any;
                    }
                    let normalizedAction = String(
                        (cmd as any)?.action
                        ?? (cmd as any)?.type
                        ?? (cmd as any)?.command
                        ?? (cmd as any)?.name
                        ?? (cmd as any)?.mode
                        ?? (cmd as any)?.cmd
                        ?? ''
                    ).trim().toLowerCase();
                    let normalizedKeyRaw = (cmd as any)?.key ?? (cmd as any)?.path;
                    let normalizedKey = typeof normalizedKeyRaw === 'string' ? normalizedKeyRaw.trim() : normalizedKeyRaw;
                    const normalizedValue = normalizeCommandPayload(normalizedAction, cmd as any);
                    if (normalizedValue !== undefined) {
                        (cmd as any).value = normalizedValue;
                    }
                    const rewrittenLegacyCommand = LEGACY_COMMAND_REWRITE_ENABLED
                        ? rewriteLegacyBusinessCommand(
                            normalizedAction,
                            normalizedKey,
                            (cmd as any)?.value,
                            nextState
                        )
                        : null;
                    const tryCompatRewriteForMalformedSheetCommand = (
                        !rewrittenLegacyCommand
                        && normalizedAction === 'upsert_sheet_rows'
                        && Boolean(normalizedKey)
                        && (() => {
                            const currentValue = (cmd as any)?.value;
                            if (!currentValue || typeof currentValue !== 'object' || Array.isArray(currentValue)) return true;
                            const sid = String((currentValue as any)?.sheetId || '').trim();
                            return !sid;
                        })()
                    );
                    const compatRewrittenCommand = tryCompatRewriteForMalformedSheetCommand
                        ? rewriteLegacyBusinessCommand(
                            normalizedAction,
                            normalizedKey,
                            (cmd as any)?.value,
                            nextState
                        )
                        : null;
                    const effectiveRewrittenCommand = rewrittenLegacyCommand || compatRewrittenCommand;
                    if (effectiveRewrittenCommand) {
                        (cmd as any).action = (effectiveRewrittenCommand as any).action;
                        if ('key' in effectiveRewrittenCommand) {
                            (cmd as any).key = (effectiveRewrittenCommand as any).key;
                        } else if ('key' in (cmd as any)) {
                            delete (cmd as any).key;
                        }
                        if ('path' in effectiveRewrittenCommand) {
                            (cmd as any).path = (effectiveRewrittenCommand as any).path;
                        } else if ('path' in (cmd as any)) {
                            delete (cmd as any).path;
                        }
                        (cmd as any).value = normalizeCommandPayload(
                            String((effectiveRewrittenCommand as any).action || '').trim().toLowerCase(),
                            effectiveRewrittenCommand
                        );
                        normalizedAction = String(
                            (cmd as any)?.action
                            ?? (cmd as any)?.type
                            ?? (cmd as any)?.command
                            ?? (cmd as any)?.name
                            ?? (cmd as any)?.mode
                            ?? (cmd as any)?.cmd
                            ?? ''
                        ).trim().toLowerCase();
                        normalizedKeyRaw = (cmd as any)?.key ?? (cmd as any)?.path;
                        normalizedKey = typeof normalizedKeyRaw === 'string' ? normalizedKeyRaw.trim() : normalizedKeyRaw;
                    } else if (tryCompatRewriteForMalformedSheetCommand) {
                        const normalizedLegacyKey = normalizeLegacyBusinessPath(normalizedKey);
                        if (normalizedLegacyKey && !isTableManagedLegacyPath(normalizedLegacyKey)) {
                            (cmd as any).action = 'set';
                            normalizedAction = 'set';
                        }
                    }
                    const isSpecialAttentionMutation = isSpecialAttentionCommand(normalizedKey);
                    if (isSpecialAttentionMutation) {
                        return;
                    }
                    const actionWithoutKey = new Set([
                        'upsert_sheet_rows',
                        'delete_sheet_rows',
                        'append_econ_ledger',
                        'apply_econ_delta',
                        'set_encounter_rows',
                        'upsert_battle_map_rows',
                        'set_map_visuals',
                        'set_initiative',
                        'consume_dice_rows',
                        'refill_dice_pool',
                        'roll_dice_check',
                        'set_action_economy',
                        'spend_action_resource',
                        'resolve_attack_check',
                        'resolve_saving_throw',
                        'resolve_damage_roll',
                        'append_combat_resolution',
                        'append_log_summary',
                        'append_log_outline',
                        'set_action_options',
                        'upsert_npc',
                        'upsert_inventory',
                        'upsert_exploration_map'
                    ]);
                    if (!normalizedAction || (!normalizedKey && !actionWithoutKey.has(normalizedAction))) {
                        const errorMsg = `指令错误：缺少 action/key 字段`;
                        console.warn('Command failed: missing action/key', cmd);
                        hasError = true;
                        systemLogs.push({
                            id: nextSystemLogId(),
                            sender: '系统',
                            text: errorMsg,
                            timestamp: Date.now(),
                            type: 'system' as const
                        });
                        return;
                    }

                    // Route extended actions
                    let handled = false;
                    let result: { success: boolean; error?: string } | undefined;
                    switch (normalizedAction) {
                        case 'upsert_sheet_rows':
                            result = handleUpsertSheetRows(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'delete_sheet_rows':
                            result = handleDeleteSheetRows(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'append_econ_ledger':
                            result = handleAppendEconomicLedger(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'apply_econ_delta':
                            result = handleApplyEconomicDelta(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'set_encounter_rows':
                            result = handleSetEncounterRows(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'upsert_battle_map_rows':
                            result = handleUpsertBattleMapRows(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'set_map_visuals':
                            result = handleSetMapVisuals(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'set_initiative':
                            result = handleSetInitiative(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'consume_dice_rows':
                            result = handleConsumeDiceRows(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'refill_dice_pool':
                            result = handleRefillDicePool(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'roll_dice_check':
                            result = handleRollDiceCheck(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'set_action_economy':
                            result = handleSetActionEconomy(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'spend_action_resource':
                            result = handleSpendActionResource(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'resolve_attack_check':
                            result = handleResolveAttackCheck(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'resolve_saving_throw':
                            result = handleResolveSavingThrow(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'resolve_damage_roll':
                            result = handleResolveDamageRoll(nextState, (cmd as any)?.value, (msg) => {
                                systemLogs.push({
                                    id: nextSystemLogId(),
                                    sender: '系统',
                                    text: msg,
                                    timestamp: Date.now(),
                                    type: 'system' as const
                                });
                            });
                            handled = true;
                            break;
                        case 'append_combat_resolution':
                            result = handleAppendCombatResolution(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'append_log_summary':
                            result = handleAppendLogSummary(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'append_log_outline':
                            result = handleAppendLogOutline(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'set_action_options':
                            result = handleSetActionOptions(nextState, (cmd as any)?.value, settings);
                            handled = true;
                            break;
                        case 'upsert_npc':
                            result = handleUpsertNPC(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'upsert_inventory':
                            result = handleUpsertInventory(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                        case 'upsert_exploration_map':
                            result = handleUpsertExplorationMapStructure(nextState, (cmd as any)?.value);
                            handled = true;
                            break;
                    }

                    // B-002 FIX: Check validation results and log errors to system logs
                    if (result && !result.success && result.error) {
                        const sheetId = String((cmd as any)?.value?.sheetId || '').trim();
                        const normalizedLegacyKey = normalizeLegacyBusinessPath(normalizedKey);
                        const isLegacyTableManagedKey = !!normalizedLegacyKey && isTableManagedLegacyPath(normalizedLegacyKey);
                        const isMalformedLegacySheetCommand = normalizedAction === 'upsert_sheet_rows'
                            && !!normalizedLegacyKey
                            && !sheetId;
                        const softSheetFail = normalizedAction === 'upsert_sheet_rows'
                            && (
                                sheetId === 'LOG_Summary'
                                || sheetId === 'LOG_Outline'
                                || sheetId === 'NPC_Registry'
                                || sheetId === 'WORLD_NpcTracking'
                                || sheetId === 'WORLD_News'
                                || sheetId === 'WORLD_Rumors'
                                || sheetId === 'WORLD_Denatus'
                                || sheetId === 'WORLD_WarGame'
                                || isLegacyTableManagedKey
                                || isMalformedLegacySheetCommand
                                || !sheetId
                            );
                        const nonBlockingFail = NON_BLOCKING_VALIDATION_ACTIONS.has(normalizedAction) || softSheetFail;
                        if (!nonBlockingFail) {
                            const errorMsg = `指令验证失败 [${normalizedAction}]: ${result.error}`;
                            console.warn(errorMsg, {
                                action: normalizedAction,
                                key: normalizedKey,
                                error: result.error,
                                value: (cmd as any)?.value
                            });
                            hasError = true;
                            systemLogs.push({
                                id: nextSystemLogId(),
                                sender: '系统',
                                text: errorMsg,
                                timestamp: Date.now(),
                                type: 'system' as const
                            });
                        }
                    }
                    if (handled && result && result.success) {
                        sheetPatches.push(...buildSheetPatchesForCommand(normalizedAction, cmd as TavernCommand));
                    }

                    // Triad-only runtime: reject legacy path actions instead of executing them.
                    if (!handled) {
                        const blockedAction = normalizedAction || 'unknown';
                        const blockedKey = typeof normalizedKey === 'string' ? normalizedKey : '';
                        const errorMsg = `Legacy path 指令已禁用 [${blockedAction}${blockedKey ? ` ${blockedKey}` : ''}]`;
                        console.warn(errorMsg, cmd);
                        hasError = true;
                        systemLogs.push({
                            id: nextSystemLogId(),
                            sender: '系统',
                            text: errorMsg,
                            timestamp: Date.now(),
                            type: 'system' as const
                        });
                    }
                } catch (e) {
                    const action = (cmd as any)?.action ?? (cmd as any)?.type;
                    const key = (cmd as any)?.key ?? (cmd as any)?.path;
                    const errorMsg = `指令执行异常 [${action} ${key}]: ${e instanceof Error ? e.message : String(e)}`;
                    console.warn(errorMsg, e);
                    hasError = true;
                    systemLogs.push({
                        id: nextSystemLogId(),
                        sender: '系统',
                        text: errorMsg,
                        timestamp: Date.now(),
                        type: 'system' as const
                    });
                }
            });
        }
        // C-10.1 & REG-002 FIX: Complete combat cleanup for TavernDB fields
        if (state.战斗.是否战斗中 && !nextState.战斗.是否战斗中) {
            nextState.战斗.敌方 = null;
            nextState.战斗.战斗记录 = [];
            // Preserve last known map/visuals for revisit context; clear only action cache
            nextState.战斗.上一次行动 = undefined;
        }
        nextState = reconcileEquipmentWithInventory(nextState);
        nextState.任务 = dedupeTasks(nextState.任务 as Task[] | undefined, nextState.游戏时间 || state.游戏时间 || '未知');
        nextState = ensureDerivedStats(nextState);

        const previousPairingIssues = collectIndexedLogPairingIssues({
            日志摘要: state.日志摘要 as any,
            日志大纲: state.日志大纲 as any
        });
        const currentPairingIssues = collectIndexedLogPairingIssues({
            日志摘要: nextState.日志摘要 as any,
            日志大纲: nextState.日志大纲 as any
        });
        const previousMissingOutline = new Set(previousPairingIssues.missingOutline);
        const previousMissingSummary = new Set(previousPairingIssues.missingSummary);
        const introducedMissingOutline = currentPairingIssues.missingOutline.filter((index) => !previousMissingOutline.has(index));
        const introducedMissingSummary = currentPairingIssues.missingSummary.filter((index) => !previousMissingSummary.has(index));
        if (introducedMissingOutline.length > 0 || introducedMissingSummary.length > 0) {
            hasError = true;
            const detail = [
                introducedMissingOutline.length > 0
                    ? `缺少日志大纲: ${introducedMissingOutline.join(', ')}`
                    : '',
                introducedMissingSummary.length > 0
                    ? `缺少日志摘要: ${introducedMissingSummary.join(', ')}`
                    : ''
            ].filter(Boolean).join('；');
            systemLogs.push({
                id: nextSystemLogId(),
                sender: '系统',
                text: `日志配对校验失败：${detail}`,
                timestamp: Date.now(),
                type: 'system' as const
            });
        }

        const previousInvariantSet = new Set(
            validateStateInvariants(state).map((issue) => `${issue.code}:${issue.path}:${issue.message}`)
        );
        const introducedInvariantIssues = validateStateInvariants(nextState).filter(
            (issue) => !previousInvariantSet.has(`${issue.code}:${issue.path}:${issue.message}`)
        );
        if (introducedInvariantIssues.length > 0) {
            hasError = true;
            introducedInvariantIssues.slice(0, 4).forEach((issue) => {
                systemLogs.push({
                    id: nextSystemLogId(),
                    sender: '系统',
                    text: `数值守卫阻断：${issue.path} - ${issue.message}`,
                    timestamp: Date.now(),
                    type: 'system' as const
                });
            });
        }

        return { newState: nextState, logs: systemLogs, hasError, sheetPatches };
    };

    const applyCommandsWithTurnTransaction = createApplyCommandsWithTurnTransaction(processTavernCommands);
    const syncInventorySheetWithState = (state: GameState): GameState => {
        const rows = buildInventorySyncRows(state);
        if (rows.length === 0) return state;
        const syncResult = applyCommandsWithTurnTransaction(state, [{
            action: 'upsert_sheet_rows',
            value: {
                sheetId: 'ITEM_Inventory',
                keyField: '物品ID',
                rows
            }
        }]);
        return syncResult.newState;
    };

    const isAbortError = (error: any) => {
        if (!error) return false;
        if (error.name === 'AbortError') return true;
        return /abort/i.test(error.message || '');
    };

    const isPhoneLocallyAvailable = (state: GameState) => {
        const hasMagicPhone = (state.背包 || []).some(item => item.名称 === '魔石通讯终端');
        if (!hasMagicPhone) return { ok: false, reason: '未携带魔石通讯终端' };
        const phone = state.手机;
        if (!phone) return { ok: false, reason: '终端未接入' };
        return { ok: true, reason: '' };
    };
    const isPhoneConnected = (state: GameState) => {
        const hasMagicPhone = (state.背包 || []).some(item => item.名称 === '魔石通讯终端');
        if (!hasMagicPhone) return { ok: false, reason: '未携带魔石通讯终端' };
        const phone = state.手机;
        if (!phone) return { ok: false, reason: '终端未接入' };
        return { ok: true, reason: '' };
    };

    const resolvePhoneConfig = (cfg: AppSettings) => {
        const phoneCfg = resolveServiceConfig(cfg, 'phone');
        if (phoneCfg?.apiKey) return phoneCfg;
        const storyCfg = resolveServiceConfig(cfg, 'story');
        return storyCfg?.apiKey ? storyCfg : phoneCfg;
    };
    const isPhoneApiConfigured = (cfg: AppSettings) => {
        const aiCfg = cfg?.aiConfig;
        if (!aiCfg) return false;
        return !!resolvePhoneConfig(cfg)?.apiKey;
    };

    const isMicroserviceMode = () => true;
    const shouldStateOwnBusinessWrites = () => isMicroserviceMode() && isServiceConfigured('state');
    const shouldStripStoryPhoneWrites = () => isMicroserviceMode() && isPhoneApiConfigured(settings);
    const stripPhoneCommands = (commands: TavernCommand[] = []) => (
        Array.isArray(commands)
            ? commands.filter(cmd => !(typeof cmd?.key === 'string' && cmd.key.startsWith('gameState.手机')))
            : []
    );

    const isServiceConfigured = (serviceKey: string) => {
        try {
            const resolved = resolveServiceConfig(settings, serviceKey, { strictService: true });
            return !!resolved?.apiKey;
        } catch (e) {
            return false;
        }
    };

    const isStateUsingMemoryEndpoint = () => {
        const aiCfg = settings.aiConfig;
        if (!aiCfg) return false;
        const stateConfig = resolveServiceConfig(settings, 'state', { strictService: true });
        const memoryConfig = resolveServiceConfig(settings, 'memory', { strictService: true });
        if (!stateConfig?.apiKey || !memoryConfig?.apiKey) return false;
        return stateConfig.apiKey === memoryConfig.apiKey;
    };

    const clampAffinity = (value: number) => Math.max(0, Math.min(100, value));

    const buildFallbackSummary = (lines: string[], maxLen: number = 180) => {
        const merged = lines
            .map(line => String(line || '').trim())
            .filter(Boolean)
            .join('；')
            .replace(/\s+/g, ' ')
            .trim();
        if (!merged) return '无关键变化。';
        return merged.length > maxLen ? `${merged.slice(0, maxLen)}...` : merged;
    };

    const summarizeLinesWithApi = async (lines: string[]) => {
        if (!Array.isArray(lines) || lines.length === 0) return '无关键变化。';
        return buildFallbackSummary(lines);
    };

    const extractInteractionNpcIndices = (
        state: GameState,
        playerInput: string,
        logs: { sender: string; text: string }[],
        commands: TavernCommand[]
    ): number[] => {
        const indices = new Set<number>();
        const social = Array.isArray(state.社交) ? state.社交 : [];
        const combinedTexts = [playerInput, ...(logs || []).map(l => `${l?.sender || ''}:${l?.text || ''}`)];

        social.forEach((npc, index) => {
            const name = String(npc?.姓名 || '').trim();
            if (!name) return;
            const mentionedInText = combinedTexts.some(text => typeof text === 'string' && text.includes(name));
            const speakerMatched = (logs || []).some(log => String(log?.sender || '').trim() === name);
            if (mentionedInText || speakerMatched) {
                indices.add(index);
            }
        });

        (commands || []).forEach(cmd => {
            const action = String((cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? (cmd as any)?.name ?? '').trim().toLowerCase();
            const key = String((cmd as any)?.key ?? (cmd as any)?.path ?? '').trim();
            const unwrapRows = (raw: unknown): any[] => {
                if (Array.isArray(raw)) return raw;
                if (!raw || typeof raw !== 'object') return [];
                const obj = raw as Record<string, unknown>;
                const nestedKeys = ['rows', 'value', 'data', 'payload', 'npcs', 'records'];
                for (const nestedKey of nestedKeys) {
                    if (obj[nestedKey] !== undefined && obj[nestedKey] !== raw) {
                        const nested = unwrapRows(obj[nestedKey]);
                        if (nested.length > 0) return nested;
                    }
                }
                return [obj];
            };
            const indexMatch = key.match(/^gameState\.社交(?:\[(\d+)\]|\.(\d+))/);
            if (indexMatch) {
                indices.add(Number(indexMatch[1] ?? indexMatch[2]));
            }
            if (action === 'upsert_npc') {
                const payload = unwrapRows((cmd as any)?.value ?? (cmd as any)?.rows ?? (cmd as any)?.data ?? (cmd as any)?.payload);
                payload.forEach((npc: any) => {
                    const name = String(npc?.姓名 ?? npc?.name ?? npc?.NPC ?? '').trim();
                    if (!name) return;
                    const idx = social.findIndex(row => String(row?.姓名 || '').trim() === name);
                    if (idx >= 0) indices.add(idx);
                });
            }
            if (action === 'upsert_sheet_rows') {
                const sheetId = String((cmd as any)?.value?.sheetId || '').trim();
                if (sheetId === 'NPC_Registry') {
                    const payload = unwrapRows((cmd as any)?.value?.rows);
                    payload.forEach((npc: any) => {
                        const name = String(npc?.姓名 ?? npc?.name ?? npc?.NPC ?? '').trim();
                        if (!name) return;
                        const idx = social.findIndex(row => String(row?.姓名 || '').trim() === name);
                        if (idx >= 0) indices.add(idx);
                    });
                }
            }
        });

        return Array.from(indices).filter(idx => Number.isFinite(idx) && idx >= 0 && idx < social.length);
    };

    const NEGATIVE_INTERACTION_KEYWORDS = ['威胁', '辱骂', '攻击', '欺骗', '背叛', '勒索', '恐吓', '仇恨', '杀', '讨厌', '滚开'];
    const POSITIVE_INTERACTION_KEYWORDS = ['谢谢', '感谢', '帮助', '合作', '支持', '关心', '鼓励', '道歉', '守护', '赞同', '送你', '信任'];

    const deriveInteractionAffinityDelta = (
        input: string,
        logs: { sender: string; text: string }[],
        npcName: string
    ): number => {
        const related = [
            input,
            ...(logs || [])
                .filter(log => log?.sender === npcName || String(log?.text || '').includes(npcName))
                .map(log => log?.text || '')
        ].join(' ');
        const text = related.toLowerCase();
        if (!text.trim()) return 1;
        if (NEGATIVE_INTERACTION_KEYWORDS.some(word => text.includes(word))) return -1;
        if (POSITIVE_INTERACTION_KEYWORDS.some(word => text.includes(word))) return 2;
        return 1;
    };

    const trimDialogueForMemory = (text: string, maxLength: number = 26) => {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        if (!normalized) return '';
        return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
    };

    const deriveInteractionTone = (text: string): 'positive' | 'negative' | 'neutral' => {
        const normalized = String(text || '').toLowerCase();
        if (!normalized.trim()) return 'neutral';
        if (NEGATIVE_INTERACTION_KEYWORDS.some(word => normalized.includes(word))) return 'negative';
        if (POSITIVE_INTERACTION_KEYWORDS.some(word => normalized.includes(word))) return 'positive';
        return 'neutral';
    };

    const buildInteractionMemoryContent = (
        npcName: string,
        input: string,
        logs: { sender: string; text: string }[],
        location: string,
        playerName: string,
        roundNumber: number
    ) => {
        const resolvedPlayerName = resolvePlayerName(playerName);
        const npcReply = (logs || [])
            .find(log => log?.sender === npcName && typeof log?.text === 'string')
            ?.text || '';
        const playerLine = (logs || [])
            .find(log => log?.sender === resolvedPlayerName && typeof log?.text === 'string')
            ?.text || input || '';

        const topic = trimDialogueForMemory(playerLine || npcReply || input || '普通交流', 30);
        const reaction = trimDialogueForMemory(npcReply || playerLine || '暂无明确回应', 30);
        const tone = deriveInteractionTone(`${playerLine} ${npcReply}`);
        const toneSummary = tone === 'positive'
            ? '更愿意继续信任与合作'
            : tone === 'negative'
                ? '保持谨慎并重新评估关系'
                : '维持观察，关系平稳推进';

        return `【NPC视角回忆·第${Math.max(1, roundNumber)}轮】我在${location || '当前地点'}与${resolvedPlayerName}互动，主题是“${topic}”。我当时的回应是“${reaction}”，这让我对${resolvedPlayerName}${toneSummary}。`;
    };

    const ensureNpcInteractionContinuity = (
        prevState: GameState,
        nextState: GameState,
        interactionNpcIndices: number[],
        input: string,
        logs: { sender: string; text: string }[]
    ): GameState => {
        if (!Array.isArray(interactionNpcIndices) || interactionNpcIndices.length === 0) return nextState;
        if (!Array.isArray(nextState.社交) || nextState.社交.length === 0) return nextState;
        const nextSocial = [...nextState.社交];
        let changed = false;

        interactionNpcIndices.forEach(index => {
            const npc = nextSocial[index];
            if (!npc) return;
            const prevNpc = prevState.社交?.[index];
            const prevMemoryLen = prevNpc?.记忆?.length ?? 0;
            const nextMemories = Array.isArray(npc.记忆) ? [...npc.记忆] : [];
            let memoryMutated = false;

            const roundNumber = prevMemoryLen + 1;
            const content = buildInteractionMemoryContent(
                npc.姓名,
                input,
                logs,
                nextState.当前地点 || prevState.当前地点 || '当前地点',
                nextState.角色?.姓名 || prevState.角色?.姓名 || '玩家',
                roundNumber
            );
            const timestamp = nextState.游戏时间 || prevState.游戏时间 || '未知';

            if (nextMemories.length <= prevMemoryLen) {
                const latest = nextMemories[nextMemories.length - 1];
                const duplicated = !!latest && latest.内容 === content && latest.时间戳 === timestamp;
                if (!duplicated) {
                    nextMemories.push({ 内容: content, 时间戳: timestamp });
                    memoryMutated = true;
                    changed = true;
                }
            } else {
                const latestIndex = nextMemories.length - 1;
                const latest = nextMemories[latestIndex];
                const hasNpcPerspectiveSummary = String(latest?.内容 || '').startsWith('【NPC视角回忆·第');
                if (!hasNpcPerspectiveSummary) {
                    const nextTimestamp = latest?.时间戳 || timestamp;
                    const duplicated = latest?.内容 === content && nextTimestamp === latest?.时间戳;
                    if (!duplicated) {
                        nextMemories[latestIndex] = { 内容: content, 时间戳: nextTimestamp };
                        memoryMutated = true;
                        changed = true;
                    }
                }
            }

            const prevAffinity = typeof prevNpc?.好感度 === 'number' ? prevNpc!.好感度 : 0;
            const currentAffinity = typeof npc.好感度 === 'number' ? npc.好感度 : prevAffinity;
            let targetAffinity = currentAffinity;
            if (currentAffinity === prevAffinity) {
                const delta = deriveInteractionAffinityDelta(input, logs, npc.姓名);
                targetAffinity = clampAffinity(currentAffinity + delta);
            }

            if (targetAffinity !== currentAffinity || memoryMutated) {
                nextSocial[index] = {
                    ...npc,
                    好感度: targetAffinity,
                    记忆: nextMemories
                };
                changed = true;
            }
        });

        return changed ? { ...nextState, 社交: nextSocial } : nextState;
    };

    const compressNpcMemoryIfNeeded = async (snapshot: GameState, npcIndex: number) => {
        const npc = snapshot.社交?.[npcIndex];
        if (!npc || !Array.isArray(npc.记忆) || npc.记忆.length <= 20) return;
        const npcKey = String(npc.id || npc.姓名 || npcIndex);
        if (npcMemorySummaryInFlight.current.has(npcKey)) return;
        npcMemorySummaryInFlight.current.add(npcKey);
        try {
            const memoryList = npc.记忆;
            const overflow = memoryList.slice(0, memoryList.length - 19);
            const summaryText = await summarizeLinesWithApi(
                overflow.map(item => item?.内容 || '')
            );
            const summaryEntry = {
                内容: `【记忆归档】${summaryText}`,
                时间戳: snapshot.游戏时间 || overflow[overflow.length - 1]?.时间戳 || '未知'
            };
            setGameState(prev => {
                const current = prev.社交?.[npcIndex];
                if (!current || !Array.isArray(current.记忆) || current.记忆.length <= 20) return prev;
                const currentTail = current.记忆.slice(-19);
                const nextMemories = [summaryEntry, ...currentTail];
                const nextSocial = [...(prev.社交 || [])];
                nextSocial[npcIndex] = { ...current, 记忆: nextMemories };
                return { ...prev, 社交: nextSocial };
            });
        } finally {
            npcMemorySummaryInFlight.current.delete(npcKey);
        }
    };

    const compressNpcTrackingIfNeeded = async (snapshot: GameState) => {
        const tracking = snapshot.世界?.NPC后台跟踪;
        if (!Array.isArray(tracking) || tracking.length <= 20) return;
        if (npcTrackingSummaryInFlight.current) return;
        npcTrackingSummaryInFlight.current = true;
        try {
            const overflow = tracking.slice(0, tracking.length - 19);
            const summaryText = await summarizeLinesWithApi(
                overflow.map(item => `${item?.NPC || '未知'}:${item?.当前行动 || ''} ${item?.进度 || ''}`.trim())
            );
            const summaryRow = {
                NPC: '系统归档',
                当前行动: 'NPC后台跟踪摘要',
                位置: '归档',
                进度: summaryText,
                预计完成: snapshot.游戏时间 || '未知'
            };
            setGameState(prev => {
                const current = prev.世界?.NPC后台跟踪;
                if (!Array.isArray(current) || current.length <= 20) return prev;
                return {
                    ...prev,
                    世界: {
                        ...prev.世界,
                        NPC后台跟踪: [summaryRow, ...current.slice(-19)]
                    }
                };
            });
        } finally {
            npcTrackingSummaryInFlight.current = false;
        }
    };
    
    const getCommandActionAndKey = (cmd: any): { action: string; key: string } => ({
        action: String(cmd?.action ?? cmd?.type ?? cmd?.command ?? cmd?.name ?? cmd?.mode ?? cmd?.cmd ?? '').trim().toLowerCase(),
        key: String(cmd?.key ?? cmd?.path ?? '').trim()
    });

    const SHEET_ID_SET = new Set<string>(TAVERNDB_TEMPLATE_SHEET_IDS as readonly string[]);

    const isKnownSheetId = (sheetId: unknown): sheetId is TavernDBSheetId => {
        const normalized = String(sheetId || '').trim();
        return normalized.length > 0 && SHEET_ID_SET.has(normalized);
    };

    const getSheetVersionFromState = (state: GameState, sheetId: TavernDBSheetId): number => {
        const raw = (state as any)?.__tableMeta?.sheetVersions?.[sheetId];
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) return 0;
        return Math.floor(value);
    };

    const inferTargetSheetsFromCommand = (cmd: TavernCommand): TavernDBSheetId[] => {
        const action = String((cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? (cmd as any)?.name ?? (cmd as any)?.cmd ?? '').trim().toLowerCase();
        const value = (cmd as any)?.value ?? (cmd as any)?.args ?? (cmd as any)?.arguments;
        const parseSheetPayload = (raw: unknown): unknown => {
            if (typeof raw !== 'string') return raw;
            const text = raw.trim();
            if (!text) return raw;
            try {
                return JSON.parse(text);
            } catch {
                return raw;
            }
        };
        const collectSheetIdsFromPayload = (raw: unknown, depth: number = 0): TavernDBSheetId[] => {
            if (depth > 4) return [];
            const parsed = parseSheetPayload(raw);
            if (Array.isArray(parsed)) {
                return parsed.flatMap((item) => collectSheetIdsFromPayload(item, depth + 1));
            }
            if (!parsed || typeof parsed !== 'object') return [];
            const record = parsed as Record<string, unknown>;
            const directSheetId = String(record.sheetId ?? '').trim();
            const nested = [record.value, record.data, record.payload]
                .flatMap((item) => collectSheetIdsFromPayload(item, depth + 1));
            return isKnownSheetId(directSheetId)
                ? [directSheetId, ...nested]
                : nested;
        };
        switch (action) {
            case 'append_log_summary':
                return ['LOG_Summary'];
            case 'append_log_outline':
                return ['LOG_Outline'];
            case 'append_econ_ledger':
            case 'apply_econ_delta':
                return ['ECON_Ledger'];
            case 'upsert_npc':
                return ['NPC_Registry'];
            case 'upsert_inventory':
                return ['ITEM_Inventory'];
            case 'set_action_options':
                return ['UI_ActionOptions'];
            case 'set_encounter_rows':
                return ['COMBAT_Encounter'];
            case 'upsert_battle_map_rows':
                return ['COMBAT_BattleMap'];
            case 'set_map_visuals':
                return ['COMBAT_Map_Visuals'];
            case 'upsert_exploration_map':
                return ['EXPLORATION_Map_Data'];
            case 'upsert_sheet_rows':
            case 'delete_sheet_rows':
                return Array.from(new Set(collectSheetIdsFromPayload(value)));
            default:
                return [];
        }
    };

    const attachExpectedSheetVersions = (
        commands: TavernCommand[],
        snapshotState: GameState,
        source: string
    ): TavernCommand[] => {
        if (!Array.isArray(commands) || commands.length === 0) return [];
        return commands.map((cmd) => {
            const targetSheets = inferTargetSheetsFromCommand(cmd);
            if (targetSheets.length === 0) return cmd;
            const expectedSheetVersions: Record<string, number> = {};
            targetSheets.forEach((sheetId) => {
                expectedSheetVersions[sheetId] = getSheetVersionFromState(snapshotState, sheetId);
            });
            const next: any = {
                ...cmd,
                source,
                expectedSheetVersions
            };
            if (targetSheets.length === 1) {
                next.expectedSheetVersion = expectedSheetVersions[targetSheets[0]];
            }
            return next as TavernCommand;
        });
    };

    type CommandSignals = {
        hasSocialMutation: boolean;
        hasPresenceMutation: boolean;
        hasTrackingMutation: boolean;
        hasLocationMutation: boolean;
    };

    const extractCommandSignals = (commands: any[]): CommandSignals => {
        const signals: CommandSignals = {
            hasSocialMutation: false,
            hasPresenceMutation: false,
            hasTrackingMutation: false,
            hasLocationMutation: false
        };
        if (!Array.isArray(commands) || commands.length === 0) return signals;
        for (const cmd of commands) {
            const { action, key } = getCommandActionAndKey(cmd);
            if (action === 'upsert_npc') {
                signals.hasSocialMutation = true;
                signals.hasPresenceMutation = true;
            }
            if (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') {
                const sheetId = String((cmd as any)?.value?.sheetId || '').trim();
                if (sheetId === 'NPC_Registry') {
                    signals.hasSocialMutation = true;
                    signals.hasPresenceMutation = true;
                }
                if (sheetId === 'WORLD_NpcTracking') {
                    signals.hasTrackingMutation = true;
                }
                if (sheetId === 'SYS_GlobalState') {
                    signals.hasLocationMutation = true;
                }
            }
            if (key) {
                if (/^gameState\.社交(?:\[\d+\]|\.\d+)?/.test(key)) {
                    signals.hasSocialMutation = true;
                }
                if (/^gameState\.社交(?:\[\d+\]|\.\d+)\.(是否在场|当前状态|位置详情|坐标)$/.test(key)) {
                    signals.hasPresenceMutation = true;
                }
                if (/^gameState\.(当前地点|世界坐标)(?:\.|$)/.test(key)) {
                    signals.hasLocationMutation = true;
                }
                if (key.includes('NPC后台跟踪')) {
                    signals.hasTrackingMutation = true;
                }
            }
        }
        return signals;
    };

    type StoryTableOwnedStripResult = {
        commands: TavernCommand[];
        blockedMemoryLogWrites: number;
    };

    const stripStoryTableOwnedCommandsWithDiagnostics = (commands: TavernCommand[]): StoryTableOwnedStripResult => {
        if (!Array.isArray(commands) || commands.length === 0) {
            return { commands: [], blockedMemoryLogWrites: 0 };
        }
        const hasMemoryService = isServiceConfigured('memory');
        const hasStateService = isServiceConfigured('state');
        const hasPhoneService = isServiceConfigured('phone');
        const hasWorldService = isServiceConfigured('world');
        const hasMapService = isServiceConfigured('map');
        const hasNpcService = isServiceConfigured('social') || isServiceConfigured('npcSync') || isServiceConfigured('npcBrain');
        const hasNpcBrainService = isServiceConfigured('npcBrain');

        const isLogSheet = (sheetId: string) => sheetId === 'LOG_Summary' || sheetId === 'LOG_Outline';

        const shouldStripByAction = (action: string): boolean => {
            if (action === 'append_log_summary' || action === 'append_log_outline') return hasMemoryService;
            if (action === 'upsert_npc') return hasNpcService || hasStateService;
            if (action === 'upsert_inventory' || action === 'append_econ_ledger' || action === 'apply_econ_delta') {
                return hasStateService;
            }
            return false;
        };

        const shouldStripBySheet = (sheetId: string): boolean => {
            if (!sheetId) return false;
            if (isLogSheet(sheetId)) return hasMemoryService;
            if (sheetId === 'SYS_GlobalState' || sheetId === 'ITEM_Inventory' || sheetId === 'QUEST_Active' || sheetId === 'ECON_Ledger') {
                return hasStateService;
            }
            if (sheetId === 'STORY_Mainline' || sheetId === 'STORY_Triggers' || sheetId === 'STORY_Milestones' || sheetId === 'CONTRACT_Registry') {
                return hasStateService;
            }
            if (sheetId === 'NPC_Registry') return hasNpcService || hasStateService;
            if (sheetId === 'WORLD_NpcTracking') return hasNpcBrainService || hasStateService;
            if (sheetId === 'WORLD_News' || sheetId === 'WORLD_Rumors' || sheetId === 'WORLD_Denatus' || sheetId === 'WORLD_WarGame') {
                return hasWorldService || hasStateService;
            }
            if (
                sheetId === 'PHONE_Device'
                || sheetId === 'PHONE_Contacts'
                || sheetId === 'PHONE_Threads'
                || sheetId === 'PHONE_Messages'
                || sheetId === 'PHONE_Pending'
                || sheetId === 'FORUM_Boards'
                || sheetId === 'FORUM_Posts'
                || sheetId === 'FORUM_Replies'
                || sheetId === 'PHONE_Moments'
            ) {
                return hasPhoneService || hasStateService;
            }
            return false;
        };

        const parse = (raw: unknown): unknown => {
            if (typeof raw !== 'string') return raw;
            const text = raw.trim();
            if (!text) return raw;
            try {
                return JSON.parse(text);
            } catch {
                return raw;
            }
        };

        const collectSheetIds = (raw: unknown, depth: number = 0): string[] => {
            if (depth > 4) return [];
            const parsed = parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.flatMap((item) => collectSheetIds(item, depth + 1));
            }
            if (!parsed || typeof parsed !== 'object') return [];
            const record = parsed as Record<string, unknown>;
            const direct = String(record.sheetId ?? '').trim();
            const nested = [record.value, record.rows, record.data, record.payload];
            const nestedIds = nested.flatMap((item) => collectSheetIds(item, depth + 1));
            return direct ? [direct, ...nestedIds] : nestedIds;
        };

        const resolveStoryCommandSheetId = (cmd: any): string => {
            const sheetIds = collectSheetIds(cmd?.value ?? cmd);
            return sheetIds[0] || '';
        };

        const sanitizeStorySheetCommand = (cmd: any, action: string): { command: TavernCommand | null; blockedMemoryLogWrites: number } => {
            if (!hasMemoryService || (action !== 'upsert_sheet_rows' && action !== 'delete_sheet_rows')) {
                return { command: cmd as TavernCommand, blockedMemoryLogWrites: 0 };
            }
            const originalValue = (cmd as any)?.value;
            const parsedValue = parse(originalValue);
            const writeValue = (nextValue: unknown) => {
                if (typeof originalValue === 'string') {
                    try {
                        return JSON.stringify(nextValue);
                    } catch {
                        return nextValue;
                    }
                }
                return nextValue;
            };

            const filterSheetEntries = (entries: unknown[]) => {
                let removed = 0;
                const filtered = entries.filter((entry) => {
                    const parsedEntry = parse(entry);
                    const sheetId = parsedEntry && typeof parsedEntry === 'object'
                        ? String((parsedEntry as any)?.sheetId || '').trim()
                        : '';
                    if (isLogSheet(sheetId)) {
                        removed += 1;
                        return false;
                    }
                    return true;
                });
                return { filtered, removed };
            };

            if (Array.isArray(parsedValue)) {
                const { filtered, removed } = filterSheetEntries(parsedValue);
                if (removed <= 0) return { command: cmd as TavernCommand, blockedMemoryLogWrites: 0 };
                if (filtered.length === 0) return { command: null, blockedMemoryLogWrites: removed };
                return {
                    command: { ...(cmd as any), value: writeValue(filtered) } as TavernCommand,
                    blockedMemoryLogWrites: removed
                };
            }

            if (parsedValue && typeof parsedValue === 'object') {
                const payload = parsedValue as Record<string, unknown>;
                const directSheetId = String(payload.sheetId ?? '').trim();
                if (isLogSheet(directSheetId)) {
                    return { command: null, blockedMemoryLogWrites: 1 };
                }

                if (Array.isArray(payload.value)) {
                    const { filtered, removed } = filterSheetEntries(payload.value);
                    if (removed > 0) {
                        if (filtered.length === 0) return { command: null, blockedMemoryLogWrites: removed };
                        return {
                            command: {
                                ...(cmd as any),
                                value: writeValue({ ...payload, value: filtered })
                            } as TavernCommand,
                            blockedMemoryLogWrites: removed
                        };
                    }
                }
            }

            const logSheetHits = collectSheetIds(parsedValue).filter((sheetId) => isLogSheet(sheetId)).length;
            if (logSheetHits > 0) {
                return { command: null, blockedMemoryLogWrites: logSheetHits };
            }
            return { command: cmd as TavernCommand, blockedMemoryLogWrites: 0 };
        };

        let blockedMemoryLogWrites = 0;
        const nextCommands: TavernCommand[] = [];

        commands.forEach((rawCmd: any) => {
            const action = String(rawCmd?.action ?? rawCmd?.type ?? rawCmd?.command ?? '').trim().toLowerCase();
            let cmd: TavernCommand = rawCmd as TavernCommand;
            let sheetIds = (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows')
                ? collectSheetIds((rawCmd as any)?.value ?? rawCmd)
                : [];
            let sheetId = sheetIds[0] || '';
            const rawLegacyKey = String(rawCmd?.key ?? rawCmd?.path ?? '').trim();
            const legacyKey = rawLegacyKey
                .replace(/^state\./, 'gameState.')
                .replace(/^gameState\.social(?=\.|\[|$)/i, 'gameState.社交')
                .replace(/^social(?=\.|\[|$)/i, 'gameState.社交');
            const isStoryLogLegacyPath = /^gameState\.(日志摘要|日志大纲)(?:\.|\[|$)/.test(legacyKey);
            const isTableManagedLegacyCandidate = /^gameState\.(当前地点|当前日期|游戏时间|上轮时间|流逝时长|场景描述|天气|战斗模式|系统通知|世界坐标(?:\.|$)|角色\.法利|眷族\.资金|社交(?:\.|\[|$)|背包(?:\.|\[|$)|任务(?:\.|\[|$)|手机(?:\.|\[|$)|世界\.)/.test(legacyKey);

            if (shouldStripByAction(action)) {
                if (hasMemoryService && (action === 'append_log_summary' || action === 'append_log_outline')) {
                    blockedMemoryLogWrites += 1;
                }
                return;
            }
            if (hasMapService && (action === 'upsert_exploration_map' || action === 'set_map_visuals' || action === 'upsert_battle_map_rows')) {
                return;
            }
            // In async table-fill mode, keep malformed legacy sheet aliases for compat rewrite.
            if (
                (hasStateService || hasMemoryService)
                && action === 'upsert_sheet_rows'
                && !sheetId
                && (!!legacyKey || rawCmd?.key !== undefined || rawCmd?.path !== undefined)
            ) {
                if (hasMemoryService && isStoryLogLegacyPath) {
                    blockedMemoryLogWrites += 1;
                    return;
                }
            }
            // Prevent story path-style business writes when state service is configured.
            if (hasStateService && LEGACY_PATH_ACTIONS.has(action) && legacyKey && isTableManagedLegacyCandidate) {
                return;
            }
            // Hard block legacy log path writes in microservice+memory mode.
            if (hasMemoryService && LEGACY_PATH_ACTIONS.has(action) && isStoryLogLegacyPath) {
                blockedMemoryLogWrites += 1;
                return;
            }

            if (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') {
                const sanitized = sanitizeStorySheetCommand(rawCmd, action);
                blockedMemoryLogWrites += sanitized.blockedMemoryLogWrites;
                if (!sanitized.command) return;
                cmd = sanitized.command;
                sheetIds = collectSheetIds((cmd as any)?.value ?? cmd);
                sheetId = sheetIds[0] || resolveStoryCommandSheetId(cmd as any);
                if (sheetIds.some((id) => shouldStripBySheet(id))) return;
                if (sheetIds.length === 0 && shouldStripBySheet(sheetId)) return;
            }

            nextCommands.push(cmd);
        });

        return { commands: nextCommands, blockedMemoryLogWrites };
    };

    const stripStoryTableOwnedCommands = (commands: TavernCommand[]): TavernCommand[] => {
        return stripStoryTableOwnedCommandsWithDiagnostics(commands).commands;
    };

    const extractStructuredActionOptions = (response: any): ActionOption[] => {
        if (!response || typeof response !== 'object') return [];
        const direct = Array.isArray(response.action_options) ? response.action_options : null;
        if (direct && direct.length > 0) return direct as ActionOption[];

        const candidates = [
            response?.可选行动列表,
            response?.战斗?.可选行动列表,
            response?.gameState?.可选行动列表,
            response?.state?.可选行动列表
        ];
        for (const candidate of candidates) {
            if (Array.isArray(candidate) && candidate.length > 0) {
                return candidate as ActionOption[];
            }
        }
        return [];
    };

    const asObject = (value: unknown): Record<string, any> | null => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        return value as Record<string, any>;
    };

    const parseMaybeJson = (value: unknown): unknown => {
        if (typeof value !== 'string') return value;
        const text = value.trim();
        if (!text) return value;
        try {
            return JSON.parse(text);
        } catch {
            return value;
        }
    };

    const parseSheetRows = (sheetLike: unknown): Record<string, any>[] => {
        if (Array.isArray(sheetLike)) {
            return sheetLike
                .map((row) => asObject(row))
                .filter((row): row is Record<string, any> => !!row);
        }
        const sheet = asObject(sheetLike);
        if (!sheet) return [];

        const rowCollectionKeys = ['rows', 'value', 'data', 'records'];
        for (const key of rowCollectionKeys) {
            if (Array.isArray(sheet[key])) {
                return sheet[key]
                    .map((row: unknown) => asObject(row))
                    .filter((row: Record<string, any> | null): row is Record<string, any> => !!row);
            }
        }

        const content = Array.isArray(sheet.content) ? sheet.content : null;
        if (!content || content.length < 2 || !Array.isArray(content[0])) return [];

        const headers = (content[0] as any[]).map((cell) => typeof cell === 'string' ? cell.trim() : '');
        const rowObjects: Record<string, any>[] = [];

        for (const rawRow of content.slice(1)) {
            if (!Array.isArray(rawRow)) continue;
            const rowObject: Record<string, any> = {};
            let hasValue = false;
            rawRow.forEach((cell, colIndex) => {
                const header = headers[colIndex];
                if (!header) return;
                if (cell === null || cell === undefined || cell === '') return;
                rowObject[header] = cell;
                hasValue = true;
            });
            if (hasValue) rowObjects.push(rowObject);
        }

        return rowObjects;
    };

    const pickFirstSheetRow = (rows: Record<string, any>[]): Record<string, any> | null => {
        if (!Array.isArray(rows) || rows.length === 0) return null;
        for (const row of rows) {
            if (row && Object.keys(row).length > 0) return row;
        }
        return null;
    };

    const extractTemplateBattleMapRows = (response: any): Record<string, any>[] => {
        const candidates = [
            response?.sheet_COMBAT_BattleMap,
            response?.COMBAT_BattleMap,
            response?.战斗地图表,
            response?.战斗地图数据
        ];
        for (const candidate of candidates) {
            const rows = parseSheetRows(candidate);
            if (rows.length > 0) return rows;
        }
        return [];
    };

    const extractTemplateVisualPayload = (response: any): Record<string, any> | null => {
        const candidates = [
            response?.sheet_COMBAT_Map_Visuals,
            response?.COMBAT_Map_Visuals,
            response?.战斗地图绘制,
            response?.战斗视觉表
        ];

        for (const candidate of candidates) {
            const rows = parseSheetRows(candidate);
            const firstRow = pickFirstSheetRow(rows);
            if (!firstRow) continue;
            const payload = { ...firstRow };
            const parsedVisualJson = parseMaybeJson(payload.VisualJSON ?? payload.visualJSON ?? payload.visual_json);
            if (parsedVisualJson && typeof parsedVisualJson === 'object') {
                payload.VisualJSON = parsedVisualJson;
            }
            return payload;
        }

        return null;
    };

    const augmentCommandsWithStructuredCombatPayload = (
        response: any,
        rawCommands: TavernCommand[]
    ): TavernCommand[] => {
        const commands = Array.isArray(rawCommands) ? [...rawCommands] : [];
        if (!response || typeof response !== 'object') return commands;

        const existingActions = new Set(
            commands.map((cmd: any) =>
                String(cmd?.action ?? cmd?.type ?? cmd?.command ?? cmd?.name ?? cmd?.mode ?? '')
                    .trim()
                    .toLowerCase()
            )
        );

        const combatCandidates = [
            response?.战斗,
            response?.gameState?.战斗,
            response?.state?.战斗
        ].filter((row: any) => row && typeof row === 'object');

        let visuals: any = parseMaybeJson(response?.战斗视觉);
        let battleMap: any = Array.isArray(response?.战斗地图) ? response.战斗地图 : null;

        for (const combat of combatCandidates) {
            if (!visuals && combat?.视觉) {
                visuals = parseMaybeJson(combat.视觉);
            }
            if (!battleMap && Array.isArray(combat?.地图)) {
                battleMap = combat.地图;
            }
            if (!visuals && combat?.战斗视觉) {
                visuals = parseMaybeJson(combat.战斗视觉);
            }
            if (!battleMap && Array.isArray(combat?.战斗地图)) {
                battleMap = combat.战斗地图;
            }
        }

        if ((!battleMap || battleMap.length === 0)) {
            const templateRows = extractTemplateBattleMapRows(response);
            if (templateRows.length > 0) {
                battleMap = templateRows;
            }
        }

        if (!visuals) {
            visuals = extractTemplateVisualPayload(response);
        }

        if (visuals && !existingActions.has('set_map_visuals')) {
            commands.push({ action: 'set_map_visuals', command: 'set_map_visuals', value: visuals } as TavernCommand);
        }
        if (Array.isArray(battleMap) && battleMap.length > 0 && !existingActions.has('upsert_battle_map_rows')) {
            commands.push({ action: 'upsert_battle_map_rows', command: 'upsert_battle_map_rows', value: battleMap } as TavernCommand);
        }
        return commands;
    };

    type MemoryTargetSheet = 'LOG_Summary' | 'LOG_Outline';
    const STATE_EXCLUDED_SHEET_IDS = new Set<TavernDBSheetId>([
        // log sheets are owned by memory fill
        'LOG_Summary',
        'LOG_Outline',
        // runtime/system-managed audit tables
        'SYS_CommandAudit',
        'SYS_TransactionAudit',
        'SYS_ValidationIssue',
        'SYS_MappingRegistry',
        // map-generation owned sheets
        'MAP_SurfaceLocations',
        'MAP_DungeonLayers',
        'MAP_MacroLocations',
        'MAP_MidLocations',
        'EXPLORATION_Map_Data',
        'COMBAT_Map_Visuals',
        'COMBAT_BattleMap'
    ]);
    const STATE_TARGET_SHEETS = TAVERNDB_TEMPLATE_SHEET_IDS
        .filter((sheetId): sheetId is TavernDBSheetId => !STATE_EXCLUDED_SHEET_IDS.has(sheetId));
    type StateTargetSheet = (typeof STATE_TARGET_SHEETS)[number];
    const STATE_TARGET_SHEET_SET = new Set<StateTargetSheet>(STATE_TARGET_SHEETS);
    const WORLD_INTERVAL_CONTROLLED_STATE_SHEETS = new Set<StateTargetSheet>([
        'WORLD_News',
        'WORLD_Rumors',
        'WORLD_Denatus',
        'WORLD_WarGame'
    ]);
    const FORUM_INTERVAL_CONTROLLED_STATE_SHEETS = new Set<StateTargetSheet>([
        'FORUM_Boards',
        'FORUM_Posts',
        'FORUM_Replies'
    ]);
    const resolveWorldCadenceInterval = (systemSettings?: SystemSettings) => {
        const direct = systemSettings?.世界更新间隔回合;
        if (typeof direct === 'number' && Number.isFinite(direct)) {
            return Math.max(0, Math.floor(direct));
        }
        const legacy = systemSettings?.更新频率;
        if (legacy === 'realtime') return 1;
        if (legacy === 'fast') return 2;
        if (legacy === 'manual') return 0;
        return 3;
    };
    const resolveForumCadenceInterval = (systemSettings?: SystemSettings) => {
        const worldInterval = resolveWorldCadenceInterval(systemSettings);
        if (!worldInterval || worldInterval <= 0) return 0;
        return Math.max(1, worldInterval);
    };
    const isWorldCadenceDueForStateFill = (stateSnapshot?: GameState, systemSettings?: SystemSettings) => {
        const interval = resolveWorldCadenceInterval(systemSettings);
        if (!interval || interval <= 0) return false;
        const currentTurn = Math.max(0, Math.floor(Number(stateSnapshot?.回合数 || 0)));
        if (currentTurn <= 0) return false;
        const nextTurnRaw = Number(stateSnapshot?.世界?.下次更新回合);
        if (!Number.isFinite(nextTurnRaw)) return false;
        const nextTurn = Math.max(0, Math.floor(nextTurnRaw));
        return currentTurn >= nextTurn;
    };
    const isForumCadenceDueForStateFill = (stateSnapshot?: GameState, systemSettings?: SystemSettings) => {
        const interval = resolveForumCadenceInterval(systemSettings);
        if (!interval || interval <= 0) return false;
        const currentTurn = Math.max(0, Math.floor(Number(stateSnapshot?.回合数 || 0)));
        if (currentTurn <= 0) return false;
        return currentTurn % interval === 0;
    };
    const SHEET_DEFINITION_LOOKUP = new Map(
        getSheetRegistry().map((sheet) => [sheet.id, sheet] as const)
    );
    const SHEET_DOMAIN_MAPPING_LOOKUP = (() => {
        const map = new Map<TavernDBSheetId, ReturnType<typeof getDomainMappingRegistry>>();
        const rows = getDomainMappingRegistry();
        rows.forEach((row) => {
            const list = map.get(row.sheetId) || [];
            list.push(row);
            map.set(row.sheetId, list);
        });
        return map;
    })();
    const isStateTargetSheet = (sheetId: string): sheetId is StateTargetSheet => {
        return STATE_TARGET_SHEET_SET.has(sheetId as StateTargetSheet);
    };
    const resolveStateRequiredSheets = (stateSnapshot?: GameState, systemSettings?: SystemSettings): StateTargetSheet[] => {
        // Single fill entry: state task owns all non-log table sheets,
        // but world/forum sheets are cadence-guarded by interval settings.
        const worldDue = isWorldCadenceDueForStateFill(stateSnapshot, systemSettings);
        const forumDue = isForumCadenceDueForStateFill(stateSnapshot, systemSettings);
        return STATE_TARGET_SHEETS.filter((sheetId) => {
            if (WORLD_INTERVAL_CONTROLLED_STATE_SHEETS.has(sheetId)) return worldDue;
            if (FORUM_INTERVAL_CONTROLLED_STATE_SHEETS.has(sheetId)) return forumDue;
            return true;
        });
    };
    const buildStateSheetGuide = (requiredSheets: StateTargetSheet[]) => {
        return requiredSheets.map((sheetId) => {
            const sheet = SHEET_DEFINITION_LOOKUP.get(sheetId);
            const mapping = (SHEET_DOMAIN_MAPPING_LOOKUP.get(sheetId) || [])[0];
            const columns = Array.isArray(sheet?.columns) ? sheet!.columns.map((column) => column.key) : [];
            const requiredColumns = Array.isArray(sheet?.columns)
                ? sheet!.columns.filter((column) => column.required).map((column) => column.key)
                : [];
            return {
                sheetId,
                label: sheet?.label || sheetId,
                description: sheet?.description || '',
                module: mapping?.module || '',
                domain: mapping?.domain || '',
                primaryKey: mapping?.primaryKey || requiredColumns[0] || columns[0] || 'id',
                requiredColumns,
                columnsPreview: columns.slice(0, 12)
            };
        });
    };
    const buildServiceInput = createServiceInputBuilder({
        settings,
        isMemoryParallelBySheetEnabled,
        resolveStateRequiredSheets,
        buildStateSheetGuide: (requiredSheets) => buildStateSheetGuide(requiredSheets as StateTargetSheet[]),
        stateFillBatchSize: STATE_FILL_BATCH_SIZE,
        stateFillMaxConcurrentBatches: STATE_FILL_MAX_CONCURRENT_BATCHES
    });

    const parseMemoryInputPayload = (input: string): Record<string, any> | null => {
        if (typeof input !== 'string') return null;
        const text = input.trim();
        if (!text || !text.startsWith('{')) return null;
        try {
            const parsed = JSON.parse(text);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                ? parsed as Record<string, any>
                : null;
        } catch {
            return null;
        }
    };

    const parseServiceInputPayload = (input: string): Record<string, any> | null => {
        return parseMemoryInputPayload(input);
    };

    const parseJsonLikePayload = (raw: unknown): unknown => {
        if (typeof raw !== 'string') return raw;
        const text = raw.trim();
        if (!text) return raw;
        try {
            return JSON.parse(text);
        } catch {
            return raw;
        }
    };

    const recoverInlineCommandText = (raw: unknown): string => {
        if (typeof raw === 'string') return raw.trim();
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
        const record = raw as Record<string, unknown>;
        const inlineAction = typeof record.action === 'string' ? record.action.trim() : '';
        const inlineCommand = typeof record.command === 'string' ? record.command.trim() : '';
        if (inlineAction && /\w+\s*\(/.test(inlineAction)) return inlineAction;
        if (inlineCommand && /\w+\s*\(/.test(inlineCommand)) return inlineCommand;
        const keys = Object.keys(record)
            .filter((key) => /^\d+$/.test(key))
            .sort((a, b) => Number(a) - Number(b));
        if (keys.length === 0) return '';
        return keys.map((key) => String(record[key] ?? '')).join('').trim();
    };

    const splitInlineCommandArgs = (text: string): string[] => {
        const args: string[] = [];
        let current = '';
        let depthParen = 0;
        let depthBrace = 0;
        let depthBracket = 0;
        let quote: '"' | "'" | '' = '';
        let escaped = false;
        for (let i = 0; i < text.length; i += 1) {
            const ch = text[i];
            current += ch;
            if (quote) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch === '\\') {
                    escaped = true;
                    continue;
                }
                if (ch === quote) {
                    quote = '';
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                quote = ch as '"' | "'";
                continue;
            }
            if (ch === '(') depthParen += 1;
            else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
            else if (ch === '{') depthBrace += 1;
            else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);
            else if (ch === '[') depthBracket += 1;
            else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
            else if (ch === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
                args.push(current.slice(0, -1).trim());
                current = '';
            }
        }
        const tail = current.trim();
        if (tail) args.push(tail);
        return args;
    };

    const parseInlineStringLiteral = (token: string): string | null => {
        const text = token.trim();
        if (text.length < 2) return null;
        const quote = text[0];
        if ((quote !== "'" && quote !== '"') || text[text.length - 1] !== quote) return null;
        const inner = text.slice(1, -1);
        return inner
            .replace(/\\\\/g, '\\')
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"');
    };

    const normalizeSingleQuotedJsonLike = (input: string): string => {
        let output = '';
        let i = 0;
        while (i < input.length) {
            const ch = input[i];
            if (ch === "'") {
                i += 1;
                let value = '';
                let escaped = false;
                while (i < input.length) {
                    const next = input[i];
                    if (escaped) {
                        value += next;
                        escaped = false;
                        i += 1;
                        continue;
                    }
                    if (next === '\\') {
                        escaped = true;
                        i += 1;
                        continue;
                    }
                    if (next === "'") {
                        i += 1;
                        break;
                    }
                    value += next;
                    i += 1;
                }
                output += JSON.stringify(value);
                continue;
            }
            if (ch === '"') {
                output += ch;
                i += 1;
                let escaped = false;
                while (i < input.length) {
                    const next = input[i];
                    output += next;
                    i += 1;
                    if (escaped) {
                        escaped = false;
                        continue;
                    }
                    if (next === '\\') {
                        escaped = true;
                        continue;
                    }
                    if (next === '"') break;
                }
                continue;
            }
            output += ch;
            i += 1;
        }
        return output.replace(/,\s*([}\]])/g, '$1');
    };

    const parseLooseJsonLikePayload = (raw: unknown): unknown => {
        if (typeof raw !== 'string') return raw;
        const text = raw.trim();
        if (!text) return undefined;
        const strict = parseJsonLikePayload(text);
        if (strict !== text) return strict;
        try {
            return JSON.parse(normalizeSingleQuotedJsonLike(text));
        } catch {
            return undefined;
        }
    };

    const parseInlineFunctionStyleCommand = (raw: unknown): TavernCommand | null => {
        const text = recoverInlineCommandText(raw);
        if (!text) return null;
        const matched = text.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*)\)\s*$/);
        if (!matched) return null;
        const action = String(matched[1] || '').trim().toLowerCase();
        if (!action) return null;
        const args = splitInlineCommandArgs(String(matched[2] || ''));
        if (args.length === 0) return null;
        const first = args[0] || '';
        const firstLiteral = parseInlineStringLiteral(first);
        const secondRaw = args.slice(1).join(',').trim();
        const secondPayload = secondRaw ? parseLooseJsonLikePayload(secondRaw) : undefined;
        const firstPayload = parseLooseJsonLikePayload(first);
        const command: Record<string, unknown> = { action };
        if (typeof firstLiteral === 'string') {
            command.key = firstLiteral;
        }
        if (secondPayload !== undefined) {
            command.value = secondPayload;
        } else if (typeof firstLiteral !== 'string' && firstPayload !== undefined) {
            command.value = firstPayload;
        }
        return command as unknown as TavernCommand;
    };

    const normalizeSheetPayloadAliases = (raw: unknown, depth: number = 0): unknown => {
        if (depth > 8) return raw;
        const parsed = parseJsonLikePayload(raw);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => normalizeSheetPayloadAliases(item, depth + 1));
        }
        if (!parsed || typeof parsed !== 'object') return parsed;
        const record = parsed as Record<string, unknown>;
        const normalized: Record<string, unknown> = {};
        Object.entries(record).forEach(([key, value]) => {
            normalized[key] = normalizeSheetPayloadAliases(value, depth + 1);
        });
        if (normalized.sheetId === undefined && normalized.sheet_id !== undefined) {
            normalized.sheetId = normalized.sheet_id;
        }
        if (normalized.keyField === undefined && normalized.key_field !== undefined) {
            normalized.keyField = normalized.key_field;
        }
        if (normalized.rowIds === undefined && normalized.row_ids !== undefined) {
            normalized.rowIds = normalized.row_ids;
        }
        return normalized;
    };

    const resolveSheetPayloadRecordFromCommand = (cmd: TavernCommand): Record<string, unknown> | null => {
        const extract = (raw: unknown, depth: number = 0): Record<string, unknown> | null => {
            if (depth > 4) return null;
            const parsed = normalizeSheetPayloadAliases(raw, depth);
            if (Array.isArray(parsed)) {
                for (const item of parsed) {
                    const record = extract(item, depth + 1);
                    if (record) return record;
                }
                return null;
            }
            if (!parsed || typeof parsed !== 'object') return null;
            const record = parsed as Record<string, unknown>;
            if (record.sheetId !== undefined || record.rows !== undefined || record.keyField !== undefined) {
                return record;
            }
            const nested = [record.value, record.rows, record.data, record.payload];
            for (const candidate of nested) {
                const nestedRecord = extract(candidate, depth + 1);
                if (nestedRecord) return nestedRecord;
            }
            return null;
        };

        return extract((cmd as any)?.value ?? cmd);
    };

    const resolveSheetIdFromCommand = (cmd: TavernCommand): string => {
        const payload = resolveSheetPayloadRecordFromCommand(cmd);
        return String(payload?.sheetId ?? '').trim();
    };

    const resolveSheetRowsFromCommand = (cmd: TavernCommand): Array<Record<string, unknown>> => {
        const payload = resolveSheetPayloadRecordFromCommand(cmd);
        const candidates = [payload?.rows, payload?.value, payload?.data, payload?.payload];
        for (const candidate of candidates) {
            const parsed = parseJsonLikePayload(candidate);
            if (Array.isArray(parsed)) {
                return parsed.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row));
            }
        }
        return [];
    };

    const filterMemoryCommandsBySheet = (commands: TavernCommand[], sheet: MemoryTargetSheet): TavernCommand[] => {
        if (!Array.isArray(commands) || commands.length === 0) return [];
        return commands.filter((cmd: any) => {
            const action = String(cmd?.action ?? cmd?.type ?? cmd?.command ?? cmd?.name ?? '').trim().toLowerCase();
            const sheetId = resolveSheetIdFromCommand(cmd as TavernCommand);
            if (sheet === 'LOG_Summary') {
                if (action === 'append_log_summary') return true;
                if (action === 'upsert_sheet_rows') return sheetId === 'LOG_Summary';
                return false;
            }
            if (sheet === 'LOG_Outline') {
                if (action === 'append_log_outline') return true;
                if (action === 'upsert_sheet_rows') return sheetId === 'LOG_Outline';
                return false;
            }
            return false;
        });
    };

    const filterStateCommandsBySheet = (commands: TavernCommand[], sheet: StateTargetSheet): TavernCommand[] => {
        if (!Array.isArray(commands) || commands.length === 0) return [];
        return commands.filter((cmd: any) => {
            const action = String(cmd?.action ?? cmd?.type ?? cmd?.command ?? cmd?.name ?? '').trim().toLowerCase();
            const sheetId = resolveSheetIdFromCommand(cmd as TavernCommand);
            if (sheet === 'NPC_Registry') {
                if (action === 'upsert_npc') return true;
                return (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') && sheetId === sheet;
            }
            if (sheet === 'ITEM_Inventory') {
                if (action === 'upsert_inventory') return true;
                return (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') && sheetId === sheet;
            }
            if (sheet === 'ECON_Ledger') {
                if (action === 'apply_econ_delta' || action === 'append_econ_ledger') return true;
                return (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') && sheetId === sheet;
            }
            return (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') && sheetId === sheet;
        });
    };

    const filterStateCommandsBySheetSet = (commands: TavernCommand[], allowedSheets: Set<StateTargetSheet>): TavernCommand[] => {
        if (!Array.isArray(commands) || commands.length === 0) return [];
        return commands.filter((cmd: any) => {
            const action = String(cmd?.action ?? cmd?.type ?? cmd?.command ?? cmd?.name ?? '').trim().toLowerCase();
            const sheetId = resolveSheetIdFromCommand(cmd as TavernCommand) as StateTargetSheet;
            if (action === 'upsert_npc') return allowedSheets.has('NPC_Registry');
            if (action === 'upsert_inventory') return allowedSheets.has('ITEM_Inventory');
            if (action === 'apply_econ_delta' || action === 'append_econ_ledger') return allowedSheets.has('ECON_Ledger');
            if (action === 'append_log_summary' || action === 'append_log_outline') return false;
            if (action === 'upsert_sheet_rows' || action === 'delete_sheet_rows') {
                return allowedSheets.has(sheetId);
            }
            return true;
        });
    };

    const toNumberOrNullLocal = (raw: unknown): number | null => {
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
        if (typeof raw === 'string') {
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) return parsed;
        }
        return null;
    };

    const extractMemoryCommandTurn = (cmd: TavernCommand, sheet: MemoryTargetSheet): number => {
        const action = String((cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? (cmd as any)?.name ?? '').trim().toLowerCase();
        const payload = resolveSheetPayloadRecordFromCommand(cmd);
        const value = payload ?? (cmd as any)?.value;
        const asRows = Array.isArray(value?.rows)
            ? value.rows
            : (Array.isArray(value) ? value : resolveSheetRowsFromCommand(cmd));
        if (sheet === 'LOG_Summary') {
            const direct = toNumberOrNullLocal((value as any)?.回合);
            if (direct !== null) return Math.max(0, Math.floor(direct));
            const rowTurn = toNumberOrNullLocal((asRows[0] as any)?.回合);
            if (rowTurn !== null) return Math.max(0, Math.floor(rowTurn));
            if (action === 'append_log_summary') return Number.MAX_SAFE_INTEGER;
        } else {
            const direct = toNumberOrNullLocal((value as any)?.开始回合);
            if (direct !== null) return Math.max(0, Math.floor(direct));
            const rowTurn = toNumberOrNullLocal((asRows[0] as any)?.开始回合);
            if (rowTurn !== null) return Math.max(0, Math.floor(rowTurn));
            if (action === 'append_log_outline') return Number.MAX_SAFE_INTEGER;
        }
        return Number.MAX_SAFE_INTEGER;
    };

    const normalizeMemoryText = (value: unknown): string => {
        return normalizeMemoryTextByPolicy(value);
    };

    const resolveCommandPrimaryRecord = (cmd: TavernCommand): Record<string, unknown> | null => {
        const action = String((cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? (cmd as any)?.name ?? '').trim().toLowerCase();
        if (action === 'append_log_summary' || action === 'append_log_outline') {
            const raw = parseJsonLikePayload((cmd as any)?.value);
            if (Array.isArray(raw)) {
                const row = raw.find((item) => item && typeof item === 'object' && !Array.isArray(item));
                return row && typeof row === 'object' ? row as Record<string, unknown> : null;
            }
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                return raw as Record<string, unknown>;
            }
            return null;
        }
        if (action === 'upsert_sheet_rows') {
            const rows = resolveSheetRowsFromCommand(cmd);
            return rows.length > 0 ? rows[0] : null;
        }
        return null;
    };

    const extractSummaryBodyFromCommand = (cmd: TavernCommand): string => {
        const row = resolveCommandPrimaryRecord(cmd);
        return normalizeMemoryText(
            row?.纪要
            ?? row?.摘要
            ?? row?.summary
            ?? row?.text
            ?? row?.content
        );
    };

    const extractOutlineBodyFromCommand = (cmd: TavernCommand): string => {
        const row = resolveCommandPrimaryRecord(cmd);
        return normalizeMemoryText(
            row?.大纲
            ?? row?.outline
            ?? row?.标题
            ?? row?.摘要
            ?? row?.text
            ?? row?.content
        );
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

    const isSummaryOutlineOverHomogeneous = (summary: string, outline: string): boolean => {
        const s = normalizeSimilarityToken(summary);
        const o = normalizeSimilarityToken(outline);
        if (!s || !o) return false;
        const overlap = calcTextOverlap(s, o);
        if (overlap >= 0.88) return true;
        const includes = s.includes(o) || o.includes(s);
        const rawLengthGap = Math.abs(summary.length - outline.length);
        if (includes && rawLengthGap <= 90) return true;
        return false;
    };

    const isNumericPlaceholderText = (text: string): boolean => {
        return isNumericPlaceholderTextByPolicy(text);
    };

    const scoreMemoryCommand = (cmd: TavernCommand, sheet: MemoryTargetSheet): number => {
        const action = String((cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? (cmd as any)?.name ?? '').trim().toLowerCase();
        const row = resolveCommandPrimaryRecord(cmd);
        const body = sheet === 'LOG_Summary'
            ? extractSummaryBodyFromCommand(cmd)
            : extractOutlineBodyFromCommand(cmd);
        const strictLengthValid = sheet === 'LOG_Summary'
            ? isMemorySummaryTextValid(body)
            : isMemoryOutlineTextValid(body);
        const hasAm = !!normalizeAmIndex((row as any)?.编码索引);
        let score = 0;
        score += body.length;
        if (hasAm) score += 120;
        if (action === 'append_log_summary' || action === 'append_log_outline') score += 20;
        if (strictLengthValid) score += 80;
        else score -= 40;
        if (!body) score -= 240;
        if (isNumericPlaceholderText(body)) score -= 800;
        return score;
    };

    const pickBestMemoryCommandsPerTurn = (commands: TavernCommand[], sheet: MemoryTargetSheet): TavernCommand[] => {
        if (!Array.isArray(commands) || commands.length === 0) return [];
        const buckets = new Map<number, TavernCommand>();
        commands.forEach((cmd) => {
            const turn = extractMemoryCommandTurn(cmd, sheet);
            const previous = buckets.get(turn);
            if (!previous) {
                buckets.set(turn, cmd);
                return;
            }
            const prevScore = scoreMemoryCommand(previous, sheet);
            const nextScore = scoreMemoryCommand(cmd, sheet);
            if (nextScore >= prevScore) {
                buckets.set(turn, cmd);
            }
        });
        return Array.from(buckets.values())
            .filter((cmd) => {
                const body = sheet === 'LOG_Summary'
                    ? extractSummaryBodyFromCommand(cmd)
                    : extractOutlineBodyFromCommand(cmd);
                return !!normalizeMemoryText(body) && !isNumericPlaceholderText(body);
            });
    };

    const runMemoryParallelBySheet = async (
        input: string,
        stateSnapshot: GameState,
        signal?: AbortSignal | null
    ): Promise<{ tavern_commands: TavernCommand[]; rawResponse: string; repairNote?: string }> => {
        const payload = parseMemoryInputPayload(input);
        const rawSheets = Array.isArray(payload?.填表任务?.requiredSheets)
            ? payload!.填表任务.requiredSheets
            : ['LOG_Summary', 'LOG_Outline'];
        const targetSheets = rawSheets
            .map((item: unknown) => String(item || '').trim())
            .filter((item): item is MemoryTargetSheet => item === 'LOG_Summary' || item === 'LOG_Outline');
        const uniqueSheets = Array.from(new Set(targetSheets));
        const parallelBySheet = typeof payload?.填表任务?.parallelBySheet === 'boolean'
            ? payload.填表任务.parallelBySheet
            : isMemoryParallelBySheetEnabled();

        if (!parallelBySheet) {
            const scopedPayload = payload ? structuredClone(payload) : null;
            if (scopedPayload) {
                const existingTask = scopedPayload.填表任务 && typeof scopedPayload.填表任务 === 'object'
                    ? scopedPayload.填表任务
                    : {};
                scopedPayload.填表任务 = {
                    ...existingTask,
                    targetSheet: undefined,
                    requiredSheets: uniqueSheets.length > 0 ? uniqueSheets : ['LOG_Summary', 'LOG_Outline'],
                    allowParallelGeneration: false,
                    parallelBySheet: false,
                    commitPolicy: 'serial'
                };
            }
            const singleInput = scopedPayload ? JSON.stringify(scopedPayload, null, 2) : input;
            const singleResult = await generateServiceCommands('memory', singleInput, stateSnapshot, settings, signal);
            const rawCommands = Array.isArray(singleResult.tavern_commands) ? singleResult.tavern_commands as TavernCommand[] : [];
            const summaryCommandsRaw = rawCommands
                .filter((cmd) => filterMemoryCommandsBySheet([cmd], 'LOG_Summary').length > 0)
                .sort((a, b) => extractMemoryCommandTurn(a, 'LOG_Summary') - extractMemoryCommandTurn(b, 'LOG_Summary'));
            const outlineCommandsRaw = rawCommands
                .filter((cmd) => filterMemoryCommandsBySheet([cmd], 'LOG_Outline').length > 0)
                .sort((a, b) => extractMemoryCommandTurn(a, 'LOG_Outline') - extractMemoryCommandTurn(b, 'LOG_Outline'));
            const summaryCommands = pickBestMemoryCommandsPerTurn(summaryCommandsRaw, 'LOG_Summary')
                .sort((a, b) => extractMemoryCommandTurn(a, 'LOG_Summary') - extractMemoryCommandTurn(b, 'LOG_Summary'));
            const outlineCommands = pickBestMemoryCommandsPerTurn(outlineCommandsRaw, 'LOG_Outline')
                .sort((a, b) => extractMemoryCommandTurn(a, 'LOG_Outline') - extractMemoryCommandTurn(b, 'LOG_Outline'));
            const orderedPairedCommands: TavernCommand[] = [];
            if (summaryCommands.length > 0 && outlineCommands.length > 0 && summaryCommands.length === outlineCommands.length) {
                const homogeneousPairIndexes: number[] = [];
                for (let i = 0; i < summaryCommands.length; i += 1) {
                    const summaryText = extractSummaryBodyFromCommand(summaryCommands[i]);
                    const outlineText = extractOutlineBodyFromCommand(outlineCommands[i]);
                    if (!summaryText || !outlineText) continue;
                    if (isSummaryOutlineOverHomogeneous(summaryText, outlineText)) {
                        homogeneousPairIndexes.push(i + 1);
                    }
                }
                if (homogeneousPairIndexes.length === 0) {
                    for (let i = 0; i < summaryCommands.length; i += 1) {
                        orderedPairedCommands.push(summaryCommands[i], outlineCommands[i]);
                    }
                }
            }
            return {
                tavern_commands: orderedPairedCommands.length > 0
                    ? orderedPairedCommands
                    : rawCommands,
                rawResponse: singleResult.rawResponse || '',
                repairNote: singleResult.repairNote ? `single:${singleResult.repairNote}` : 'single-request'
            };
        }

        if (uniqueSheets.length <= 1) {
            const fallback = await generateServiceCommands('memory', input, stateSnapshot, settings, signal);
            return {
                tavern_commands: Array.isArray(fallback.tavern_commands) ? fallback.tavern_commands as TavernCommand[] : [],
                rawResponse: fallback.rawResponse || '',
                repairNote: fallback.repairNote
            };
        }

        const tasks = uniqueSheets.map(async (sheet) => {
            const scopedPayload = payload ? structuredClone(payload) : null;
            if (scopedPayload) {
                const existingTask = scopedPayload.填表任务 && typeof scopedPayload.填表任务 === 'object'
                    ? scopedPayload.填表任务
                    : {};
                scopedPayload.填表任务 = {
                    ...existingTask,
                    targetSheet: sheet,
                    requiredSheets: [sheet],
                    allowParallelGeneration: false,
                    commitPolicy: 'serial'
                };
            }
            const scopedInput = scopedPayload ? JSON.stringify(scopedPayload, null, 2) : input;
            const result = await generateServiceCommands('memory', scopedInput, stateSnapshot, settings, signal);
            return { sheet, result };
        });

        const settled = await Promise.allSettled(tasks);
        const mergedCommands: TavernCommand[] = [];
        const rawParts: string[] = [];
        const repairNotes: string[] = [];

        for (const item of settled) {
            if (item.status !== 'fulfilled') continue;
            const { sheet, result } = item.value;
            rawParts.push(`[${sheet}] ${result.rawResponse || ''}`.trim());
            if (result.repairNote) {
                repairNotes.push(`${sheet}:${result.repairNote}`);
            }
            const filtered = filterMemoryCommandsBySheet(
                Array.isArray(result.tavern_commands) ? result.tavern_commands as TavernCommand[] : [],
                sheet as MemoryTargetSheet
            );
            mergedCommands.push(...filtered);
        }

        if (mergedCommands.length === 0) {
            const fallback = await generateServiceCommands('memory', input, stateSnapshot, settings, signal);
            return {
                tavern_commands: Array.isArray(fallback.tavern_commands) ? fallback.tavern_commands as TavernCommand[] : [],
                rawResponse: fallback.rawResponse || '',
                repairNote: fallback.repairNote
            };
        }

        const summaryCommandsRaw = mergedCommands
            .filter((cmd) => filterMemoryCommandsBySheet([cmd], 'LOG_Summary').length > 0)
            .sort((a, b) => extractMemoryCommandTurn(a, 'LOG_Summary') - extractMemoryCommandTurn(b, 'LOG_Summary'));
        const outlineCommandsRaw = mergedCommands
            .filter((cmd) => filterMemoryCommandsBySheet([cmd], 'LOG_Outline').length > 0)
            .sort((a, b) => extractMemoryCommandTurn(a, 'LOG_Outline') - extractMemoryCommandTurn(b, 'LOG_Outline'));
        const summaryCommands = pickBestMemoryCommandsPerTurn(summaryCommandsRaw, 'LOG_Summary')
            .sort((a, b) => extractMemoryCommandTurn(a, 'LOG_Summary') - extractMemoryCommandTurn(b, 'LOG_Summary'));
        const outlineCommands = pickBestMemoryCommandsPerTurn(outlineCommandsRaw, 'LOG_Outline')
            .sort((a, b) => extractMemoryCommandTurn(a, 'LOG_Outline') - extractMemoryCommandTurn(b, 'LOG_Outline'));
        const buildCommandsByTurn = (commands: TavernCommand[], sheet: MemoryTargetSheet): Map<number, TavernCommand> => {
            const map = new Map<number, TavernCommand>();
            commands.forEach((command) => {
                const turn = extractMemoryCommandTurn(command, sheet);
                map.set(turn, command);
            });
            return map;
        };
        const buildPairedCommandsByTurn = (
            summaryByTurn: Map<number, TavernCommand>,
            outlineByTurn: Map<number, TavernCommand>
        ): { commands: TavernCommand[]; turns: number[] } => {
            const turns = Array.from(summaryByTurn.keys())
                .filter((turn) => outlineByTurn.has(turn))
                .sort((a, b) => a - b);
            const commands: TavernCommand[] = [];
            turns.forEach((turn) => {
                commands.push(summaryByTurn.get(turn)!, outlineByTurn.get(turn)!);
            });
            return { commands, turns };
        };
        const buildMissingTurns = (
            sourceByTurn: Map<number, TavernCommand>,
            targetByTurn: Map<number, TavernCommand>
        ): number[] => {
            return Array.from(sourceByTurn.keys())
                .filter((turn) => !targetByTurn.has(turn))
                .sort((a, b) => a - b);
        };
        const buildRepairScopedInput = (targetSheet: MemoryTargetSheet, turns: number[]): string => {
            if (!payload) return input;
            const scopedPayload = structuredClone(payload);
            const existingTask = scopedPayload.填表任务 && typeof scopedPayload.填表任务 === 'object'
                ? scopedPayload.填表任务
                : {};
            scopedPayload.填表任务 = {
                ...existingTask,
                targetSheet,
                requiredSheets: [targetSheet],
                allowParallelGeneration: false,
                parallelBySheet: false,
                commitPolicy: 'serial'
            };
            if (Array.isArray(scopedPayload.待填回合) && turns.length > 0) {
                const turnSet = new Set(turns);
                scopedPayload.待填回合 = scopedPayload.待填回合.filter((row: any) => {
                    const turn = Math.max(1, Math.floor(Number(row?.目标回合 ?? row?.turnIndex ?? 0)));
                    return turnSet.has(turn);
                });
            }
            if (turns.length === 1 && Number.isFinite(turns[0])) {
                scopedPayload.目标回合 = turns[0];
            }
            return JSON.stringify(scopedPayload);
        };
        if (summaryCommandsRaw.length !== summaryCommands.length || outlineCommandsRaw.length !== outlineCommands.length) {
            repairNotes.push(
                `parallel-dedupe(summary=${summaryCommandsRaw.length}->${summaryCommands.length},outline=${outlineCommandsRaw.length}->${outlineCommands.length})`
            );
        }
        if (summaryCommands.length === 0 || outlineCommands.length === 0 || summaryCommands.length !== outlineCommands.length) {
            const summaryByTurn = buildCommandsByTurn(summaryCommands, 'LOG_Summary');
            const outlineByTurn = buildCommandsByTurn(outlineCommands, 'LOG_Outline');
            let paired = buildPairedCommandsByTurn(summaryByTurn, outlineByTurn);
            let missingSummaryTurns = buildMissingTurns(outlineByTurn, summaryByTurn);
            let missingOutlineTurns = buildMissingTurns(summaryByTurn, outlineByTurn);

            const repairRequests: Array<{ sheet: MemoryTargetSheet; turns: number[] }> = [];
            if (missingSummaryTurns.length > 0) {
                repairRequests.push({ sheet: 'LOG_Summary', turns: missingSummaryTurns });
            }
            if (missingOutlineTurns.length > 0) {
                repairRequests.push({ sheet: 'LOG_Outline', turns: missingOutlineTurns });
            }

            if (repairRequests.length > 0) {
                for (const repairRequest of repairRequests) {
                    const scopedRepairInput = buildRepairScopedInput(repairRequest.sheet, repairRequest.turns);
                    const repairResult = await generateServiceCommands('memory', scopedRepairInput, stateSnapshot, settings, signal);
                    if (repairResult.repairNote) {
                        repairNotes.push(`repair-${repairRequest.sheet}:${repairResult.repairNote}`);
                    }
                    const repairedCommandsRaw = Array.isArray(repairResult.tavern_commands)
                        ? repairResult.tavern_commands as TavernCommand[]
                        : [];
                    const repairedCommands = pickBestMemoryCommandsPerTurn(
                        filterMemoryCommandsBySheet(repairedCommandsRaw, repairRequest.sheet)
                            .filter((cmd) => repairRequest.turns.includes(extractMemoryCommandTurn(cmd, repairRequest.sheet))),
                        repairRequest.sheet
                    );
                    if (repairRequest.sheet === 'LOG_Summary') {
                        repairedCommands.forEach((cmd) => {
                            summaryByTurn.set(extractMemoryCommandTurn(cmd, 'LOG_Summary'), cmd);
                        });
                    } else {
                        repairedCommands.forEach((cmd) => {
                            outlineByTurn.set(extractMemoryCommandTurn(cmd, 'LOG_Outline'), cmd);
                        });
                    }
                }
                paired = buildPairedCommandsByTurn(summaryByTurn, outlineByTurn);
                missingSummaryTurns = buildMissingTurns(outlineByTurn, summaryByTurn);
                missingOutlineTurns = buildMissingTurns(summaryByTurn, outlineByTurn);
            }

            if (paired.commands.length > 0) {
                repairNotes.push(
                    `parallel-partial-pairs(pairs=${paired.turns.length},missingSummary=${missingSummaryTurns.length},missingOutline=${missingOutlineTurns.length})`
                );
                return {
                    tavern_commands: paired.commands,
                    rawResponse: rawParts.join('\n\n'),
                    repairNote: repairNotes.join(' | ')
                };
            }

            const fallback = await generateServiceCommands('memory', input, stateSnapshot, settings, signal);
            return {
                tavern_commands: Array.isArray(fallback.tavern_commands) ? fallback.tavern_commands as TavernCommand[] : [],
                rawResponse: fallback.rawResponse || '',
                repairNote: `parallel-mismatch(summary=${summaryCommands.length},outline=${outlineCommands.length})`
            };
        }

        const homogeneousPairIndexes: number[] = [];
        for (let i = 0; i < summaryCommands.length; i += 1) {
            const summaryText = extractSummaryBodyFromCommand(summaryCommands[i]);
            const outlineText = extractOutlineBodyFromCommand(outlineCommands[i]);
            if (!summaryText || !outlineText) continue;
            if (isSummaryOutlineOverHomogeneous(summaryText, outlineText)) {
                homogeneousPairIndexes.push(i + 1);
            }
        }
        if (homogeneousPairIndexes.length > 0) {
            const fallback = await generateServiceCommands('memory', input, stateSnapshot, settings, signal);
            return {
                tavern_commands: Array.isArray(fallback.tavern_commands) ? fallback.tavern_commands as TavernCommand[] : [],
                rawResponse: fallback.rawResponse || '',
                repairNote: `parallel-homogeneous(pairs=${homogeneousPairIndexes.join(',')})`
            };
        }

        const orderedPairedCommands: TavernCommand[] = [];
        for (let i = 0; i < summaryCommands.length; i += 1) {
            orderedPairedCommands.push(summaryCommands[i], outlineCommands[i]);
        }

        return {
            tavern_commands: orderedPairedCommands,
            rawResponse: rawParts.join('\n\n'),
            repairNote: repairNotes.length > 0 ? repairNotes.join(' | ') : `parallel-by-sheet(pairs=${summaryCommands.length})`
        };
    };

    const runStateParallelBySheet = async (
        input: string,
        stateSnapshot: GameState
    ): Promise<{ tavern_commands: TavernCommand[]; rawResponse: string; repairNote?: string }> => {
        const payload = parseServiceInputPayload(input);
        const rawSheets = Array.isArray(payload?.填表任务?.requiredSheets)
            ? payload!.填表任务.requiredSheets
            : resolveStateRequiredSheets(stateSnapshot, stateSnapshot.系统设置 || settings.系统设置);
        const targetSheets = rawSheets
            .map((item: unknown) => String(item || '').trim())
            .filter((item): item is StateTargetSheet => isStateTargetSheet(item));
        const uniqueSheets: StateTargetSheet[] = Array.from(new Set(targetSheets));
        const sheetBatchSize = Math.max(
            1,
            Math.floor(Number(payload?.填表任务?.maxConcurrentSheets || STATE_FILL_BATCH_SIZE))
        );
        const maxConcurrentBatches = Math.max(
            1,
            Math.floor(Number(payload?.填表任务?.maxConcurrentBatches || STATE_FILL_MAX_CONCURRENT_BATCHES))
        );

        if (uniqueSheets.length <= 1) {
            const fallback = await generateServiceCommands('state', input, stateSnapshot, settings);
            return {
                tavern_commands: Array.isArray(fallback.tavern_commands) ? fallback.tavern_commands as TavernCommand[] : [],
                rawResponse: fallback.rawResponse || '',
                repairNote: fallback.repairNote
            };
        }

        const mergedCommands: TavernCommand[] = [];
        const rawParts: string[] = [];
        const repairNotes: string[] = [];
        const sheetBatches: StateTargetSheet[][] = [];
        for (let start = 0; start < uniqueSheets.length; start += sheetBatchSize) {
            sheetBatches.push(uniqueSheets.slice(start, start + sheetBatchSize));
        }
        const runStateSheetBatch = async (batchSheets: StateTargetSheet[]) => {
            const scopedPayload = payload ? structuredClone(payload) : null;
            if (scopedPayload) {
                const existingTask = scopedPayload.填表任务 && typeof scopedPayload.填表任务 === 'object'
                    ? scopedPayload.填表任务
                    : {};
                scopedPayload.填表任务 = {
                    ...existingTask,
                    requiredSheets: batchSheets,
                    targetSheet: undefined,
                    allowParallelGeneration: true,
                    commitPolicy: 'serial'
                };
                const sheetGuide = scopedPayload.表结构约束 && typeof scopedPayload.表结构约束 === 'object'
                    ? (scopedPayload.表结构约束 as Record<string, unknown>)
                    : null;
                if (sheetGuide) {
                    sheetGuide.sheets = buildStateSheetGuide(batchSheets);
                }
            }
            const scopedInput = scopedPayload ? JSON.stringify(scopedPayload) : input;
            const result = await generateServiceCommands('state', scopedInput, stateSnapshot, settings);
            return { batchSheets, result };
        };
        for (let start = 0; start < sheetBatches.length; start += maxConcurrentBatches) {
            const batchGroup = sheetBatches.slice(start, start + maxConcurrentBatches);
            const groupResults = await Promise.allSettled(batchGroup.map((batch) => runStateSheetBatch(batch)));
            for (const groupItem of groupResults) {
                if (groupItem.status !== 'fulfilled') continue;
                const { batchSheets, result } = groupItem.value;
                rawParts.push(`[${batchSheets.join(',')}] ${result.rawResponse || ''}`.trim());
                if (result.repairNote) repairNotes.push(`[${batchSheets.join(',')}]:${result.repairNote}`);
                const filtered = filterStateCommandsBySheetSet(
                    Array.isArray(result.tavern_commands) ? result.tavern_commands as TavernCommand[] : [],
                    new Set<StateTargetSheet>(batchSheets)
                );
                mergedCommands.push(...filtered);
            }
        }

        if (mergedCommands.length === 0) {
            const fallback = await generateServiceCommands('state', input, stateSnapshot, settings);
            return {
                tavern_commands: Array.isArray(fallback.tavern_commands) ? fallback.tavern_commands as TavernCommand[] : [],
                rawResponse: fallback.rawResponse || '',
                repairNote: fallback.repairNote
            };
        }

        return {
            tavern_commands: mergedCommands,
            rawResponse: rawParts.join('\n\n'),
            repairNote: repairNotes.length > 0
                ? repairNotes.join(' | ')
                : `parallel-by-sheet(state=${uniqueSheets.length},sheetBatch=${sheetBatchSize},parallelBatches=${maxConcurrentBatches})`
        };
    };

    const enqueueMicroserviceTask = (serviceKey: string, input: string, stateSnapshot: GameState, priority: number) => {
        if (!isMicroserviceMode()) {
            pushDebugToast('MS', `${serviceKey} skip: mode`);
            return;
        }
        if (!isServiceConfigured(serviceKey)) {
            pushDebugToast('MS', `${serviceKey} skip: config`);
            return;
        }
        const taskEpoch = stateEpochRef.current;
        microserviceQueueRef.current.enqueue(async () => {
            if (taskEpoch !== stateEpochRef.current) {
                pushDebugToast('MS', `${serviceKey} stale-skip`);
                return;
            }
            pushDebugToast('MS', `${serviceKey} start`);
            const memoryRequestGuard = serviceKey === 'memory' ? createMemoryRequestGuard() : null;
            try {
                const result = await executeServiceRequest({
                    serviceKey,
                    input,
                    stateSnapshot,
                    settings,
                    signal: memoryRequestGuard?.signal,
                    runMemoryParallelBySheet,
                    runStateParallelBySheet,
                    generateServiceCommands
                });
                if (taskEpoch !== stateEpochRef.current) {
                    pushDebugToast('MS', `${serviceKey} stale-after-response`);
                    return;
                }
                setDebugLast('__DXC_MS_LAST', {
                    ts: Date.now(),
                    serviceKey,
                    tavern_commands: result.tavern_commands,
                    rawResponse: result.rawResponse,
                    repairNote: result.repairNote
                });
                if (shouldDebugMicroservice()) {
                    console.warn('[DXC][MS]', serviceKey, 'commands=', result.tavern_commands?.length || 0);
                }
                if (!result.tavern_commands || result.tavern_commands.length === 0) {
                    pushDebugToast('MS', `${serviceKey} empty`);
                    return;
                }

                // Security: Filter commands based on service role to prevent state clobbering
                const stateCadenceSettings = stateSnapshot?.系统设置 || settings.系统设置;
                const stateWorldCadenceDue = isWorldCadenceDueForStateFill(stateSnapshot, stateCadenceSettings);
                const stateForumCadenceDue = isForumCadenceDueForStateFill(stateSnapshot, stateCadenceSettings);
                const validCommands = filterCommandsForService({
                    serviceKey,
                    commands: result.tavern_commands as TavernCommand[],
                    stateWorldCadenceDue,
                    stateForumCadenceDue,
                    legacyPathActions: LEGACY_PATH_ACTIONS,
                    resolveSheetIdFromCommand,
                    worldIntervalControlledSheets: WORLD_INTERVAL_CONTROLLED_STATE_SHEETS as unknown as Set<string>,
                    forumIntervalControlledSheets: FORUM_INTERVAL_CONTROLLED_STATE_SHEETS as unknown as Set<string>
                });

                if (validCommands.length === 0) {
                     pushDebugToast('MS', `${serviceKey} filtered (0 valid)`);
                     return;
                }
                const guardedCommands = attachExpectedSheetVersions(
                    validCommands as TavernCommand[],
                    stateSnapshot,
                    `ms:${serviceKey}`
                );

                setGameState(prev => {
                    if (taskEpoch !== stateEpochRef.current) return prev;
                    const before = {
                        location: prev.当前地点,
                        gameTime: prev.游戏时间,
                        task0: prev.任务?.[0]?.状态,
                        social0Memory: prev.社交?.[0]?.记忆?.length ?? 0,
                        social1Memory: prev.社交?.[1]?.记忆?.length ?? 0
                    };
                    const processed = applyCommandsWithTurnTransaction(prev, guardedCommands);
                    let next = processed.newState;
                    let appliedFallbacks: string[] = [];
                    let memoryPairRejected = false;
                    if (serviceKey === 'memory' && !processed.rolledBack) {
                        const beforePairingIssues = collectIndexedLogPairingIssues({
                            日志摘要: prev.日志摘要 as any,
                            日志大纲: prev.日志大纲 as any
                        });
                        const afterPairingIssues = collectIndexedLogPairingIssues({
                            日志摘要: next.日志摘要 as any,
                            日志大纲: next.日志大纲 as any
                        });
                        const beforeMissingOutline = new Set(beforePairingIssues.missingOutline);
                        const beforeMissingSummary = new Set(beforePairingIssues.missingSummary);
                        const introducedMissingOutline = afterPairingIssues.missingOutline.filter((index) => !beforeMissingOutline.has(index));
                        const introducedMissingSummary = afterPairingIssues.missingSummary.filter((index) => !beforeMissingSummary.has(index));
                        if (introducedMissingOutline.length > 0 || introducedMissingSummary.length > 0) {
                            memoryPairRejected = true;
                            appliedFallbacks = [...appliedFallbacks, 'memory-pair-rollback'];
                            const guardLog: LogEntry = {
                                id: generateLegacyId(),
                                sender: '系统',
                                text: `记忆填表已回滚：检测到未配对 AM（missingOutline=${introducedMissingOutline.length}, missingSummary=${introducedMissingSummary.length}）。`,
                                timestamp: Date.now(),
                                type: 'system'
                            };
                            next = {
                                ...prev,
                                日志: [...(prev.日志 || []), guardLog]
                            };
                        }
                    }
                    const after = {
                        location: next.当前地点,
                        gameTime: next.游戏时间,
                        task0: next.任务?.[0]?.状态,
                        social0Memory: next.社交?.[0]?.记忆?.length ?? 0,
                        social1Memory: next.社交?.[1]?.记忆?.length ?? 0
                    };
                    if (!memoryPairRejected && processed.logs.length > 0) {
                        next.日志 = [...(next.日志 || []), ...processed.logs];
                    }
                    if (shouldDebugMicroservice()) {
                        console.warn('[DXC][MS APPLY]', serviceKey, {
                            commandKeys: guardedCommands.map((cmd: any) => cmd?.key || cmd?.path || cmd?.command || cmd?.action),
                            socialOps: guardedCommands
                                .filter((cmd: any) => typeof (cmd?.key || cmd?.path) === 'string' && String(cmd?.key || cmd?.path).includes('gameState.社交'))
                                .map((cmd: any) => ({ action: cmd?.action || cmd?.type, key: cmd?.key || cmd?.path, value: cmd?.value })),
                            appliedFallbacks,
                            before,
                            after,
                            systemLogCount: processed.logs.length,
                            systemLogs: processed.logs.slice(0, 6).map(l => l.text)
                        });
                    }
                    if (appliedFallbacks.length > 0) {
                        pushDebugToast('MS', `${serviceKey} fallback=${appliedFallbacks.join(',')}`);
                    }
                    return next;
                });
                pushDebugToast('MS', `${serviceKey} applied=${guardedCommands.length}`);
            } catch (e) {
                if (isAbortError(e)) {
                    pushDebugToast('MS', `${serviceKey} aborted`);
                    return;
                }
                const message = e instanceof Error ? e.message : 'unknown error';
                setDebugLast('__DXC_MS_LAST', {
                    ts: Date.now(),
                    serviceKey,
                    error: message
                });
                pushDebugToast('MS', `${serviceKey} error: ${message}`);
                console.error(`Microservice ${serviceKey} failed`, e);
            } finally {
                memoryRequestGuard?.cleanup();
            }
        }, { priority, lane: serviceKey });
    };

    const flushMemoryFillJobs = () => {
        const pending = memoryFillJobsRef.current;
        memoryFillJobsRef.current = [];
        if (!isMicroserviceMode() || !isServiceConfigured('memory')) return;
        if (!Array.isArray(pending) || pending.length === 0) return;

        const latestByTurn = new Map<number, MemoryFillJob>();
        for (const job of pending) {
            const turn = Math.max(1, Math.floor(Number(job?.turnIndex || 0)));
            if (!Number.isFinite(turn)) continue;
            const previous = latestByTurn.get(turn);
            if (!previous || Number(job.enqueuedAt || 0) >= Number(previous.enqueuedAt || 0)) {
                latestByTurn.set(turn, { ...job, turnIndex: turn });
            }
        }
        const ordered = Array.from(latestByTurn.values()).sort((a, b) => a.turnIndex - b.turnIndex);
        if (ordered.length === 0) return;

        const batchSize = resolveMemoryFillBatchSize();
        for (let start = 0; start < ordered.length; start += batchSize) {
            const batch = ordered.slice(start, start + batchSize);
            const latestState = batch[batch.length - 1]?.stateSnapshot;
            if (!latestState) continue;
            const memoryInput = buildServiceInput('memory', latestState, {
                playerInput: batch[batch.length - 1]?.playerInput || '',
                logs: batch[batch.length - 1]?.logs || [],
                appliedCommands: batch.flatMap((item) => item.appliedCommands || []),
                turnIndex: batch[batch.length - 1]?.turnIndex,
                memoryJobs: batch
            });
            enqueueMicroserviceTask('memory', memoryInput, latestState, MICROSERVICE_PRIORITIES.memory);
            pushDebugToast('MS MEM', `batch=${batch.length} turns=${batch.map((j) => j.turnIndex).join(',')}`);
        }
    };

    const scheduleMemoryFillFlush = () => {
        if (memoryFillFlushTimerRef.current) return;
        const flushDelayMs = resolveMemoryFillFlushDelayMs();
        memoryFillFlushTimerRef.current = setTimeout(() => {
            memoryFillFlushTimerRef.current = null;
            flushMemoryFillJobs();
        }, flushDelayMs);
    };

    const enqueueMemoryFillJob = (
        stateSnapshot: GameState,
        meta: { playerInput: string; logs: { sender: string; text: string }[]; appliedCommands: TavernCommand[]; turnIndex?: number; }
    ) => {
        if (!isMicroserviceMode() || !isServiceConfigured('memory')) return;
        const turn = Math.max(1, Math.floor(meta.turnIndex ?? ((stateSnapshot.回合数 || 1) - 1)));
        memoryFillJobsRef.current.push({
            turnIndex: turn,
            playerInput: meta.playerInput,
            logs: Array.isArray(meta.logs) ? meta.logs : [],
            appliedCommands: Array.isArray(meta.appliedCommands) ? meta.appliedCommands : [],
            stateSnapshot,
            enqueuedAt: Date.now()
        });
        if (memoryFillJobsRef.current.length >= resolveMemoryFillBatchSize()) {
            if (memoryFillFlushTimerRef.current) {
                clearTimeout(memoryFillFlushTimerRef.current);
                memoryFillFlushTimerRef.current = null;
            }
            flushMemoryFillJobs();
            return;
        }
        scheduleMemoryFillFlush();
    };

    const enqueuePhoneSyncPlan = (plan: any, baseState: GameState) => {
        if (!plan) return;
        if (!isMicroserviceMode()) {
            handlePhoneSyncPlan(plan, baseState);
            return;
        }
        microserviceQueueRef.current.enqueue(async () => {
            await handlePhoneSyncPlan(plan, baseState);
        }, { priority: MICROSERVICE_PRIORITIES.phone, lane: 'phone' });
    };

    const getAllPhoneThreads = (dialog: any): PhoneThread[] => {
        if (!dialog) return [];
        return [
            ...(Array.isArray(dialog.私聊) ? dialog.私聊 : []),
            ...(Array.isArray(dialog.群聊) ? dialog.群聊 : []),
            ...(Array.isArray(dialog.公共频道) ? dialog.公共频道 : [])
        ];
    };

    const generatePhoneThreadId = (dialog: any): string => {
        return generateNextId('Thr', getAllPhoneThreads(dialog));
    };

    const normalizePhoneThreadType = (value: unknown): 'private' | 'group' | 'public' => {
        const text = String(value || 'private').trim().toLowerCase();
        if (text === 'group') return 'group';
        if (text === 'public') return 'public';
        return 'private';
    };

    const normalizePhoneThreadTitle = (value: unknown): string => {
        return String(value || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\u3000/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const upsertPhoneThread = (
        phone: any,
        threadType: 'private' | 'group' | 'public' | string,
        title: string,
        members?: string[],
        threadId?: string
    ) => {
        const normalizedType = normalizePhoneThreadType(threadType);
        const normalizedTitle = normalizePhoneThreadTitle(title) || '未知';
        const normalizedThreadId = String(threadId || '').trim();
        const dialog = phone.对话 || { 私聊: [], 群聊: [], 公共频道: [] };
        const list = normalizedType === 'private' ? dialog.私聊 : normalizedType === 'group' ? dialog.群聊 : dialog.公共频道;
        let thread = list.find((t: PhoneThread) => {
            const byId = normalizedThreadId && t.id === normalizedThreadId;
            const byTitle = normalizePhoneThreadTitle(t.标题).toLowerCase() === normalizedTitle.toLowerCase()
                && normalizePhoneThreadType(t.类型) === normalizedType;
            return !!byId || byTitle;
        });
        if (!thread) {
            thread = {
                id: normalizedThreadId || generatePhoneThreadId(dialog),
                类型: normalizedType,
                标题: normalizedTitle,
                成员: members && members.length > 0 ? members : [normalizedTitle],
                消息: [],
                未读: 0
            };
            if (normalizedType === 'private') dialog.私聊 = [...dialog.私聊, thread];
            else if (normalizedType === 'group') dialog.群聊 = [...dialog.群聊, thread];
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

    const PHONE_THREAD_MESSAGE_LIMIT = 120;

    const buildPhoneMessageFingerprint = (msg?: Partial<PhoneMessage>) => {
        if (!msg) return '';
        const sender = String(msg.发送者 || '').trim();
        const content = String(msg.内容 || '').trim();
        const image = String(msg.图片描述 || '').trim();
        const quote = String(msg.引用?.内容 || '').trim();
        const timestamp = String(msg.时间戳 || '').trim();
        return `${sender}|${content}|${image}|${quote}|${timestamp}`;
    };

    const mergeThreadMessages = (base: PhoneMessage[] = [], incoming: PhoneMessage[] = []) => {
        const merged = [
            ...(Array.isArray(base) ? base : []),
            ...(Array.isArray(incoming) ? incoming : [])
        ];
        const result: PhoneMessage[] = [];
        const idIndex = new Map<string, number>();
        const fingerprintIndex = new Map<string, number>();

        merged.forEach((raw) => {
            if (!raw) return;
            const message: PhoneMessage = { ...raw };
            const idKey = typeof message.id === 'string' ? message.id.trim() : '';
            const fingerprint = buildPhoneMessageFingerprint(message);
            const existingIndex = (idKey && idIndex.has(idKey))
                ? idIndex.get(idKey)
                : (fingerprint && fingerprintIndex.has(fingerprint) ? fingerprintIndex.get(fingerprint) : undefined);

            if (typeof existingIndex === 'number') {
                result[existingIndex] = { ...result[existingIndex], ...message };
                if (idKey) idIndex.set(idKey, existingIndex);
                if (fingerprint) fingerprintIndex.set(fingerprint, existingIndex);
                return;
            }

            const insertIndex = result.length;
            result.push(message);
            if (idKey) idIndex.set(idKey, insertIndex);
            if (fingerprint) fingerprintIndex.set(fingerprint, insertIndex);
        });

        return result.slice(-PHONE_THREAD_MESSAGE_LIMIT);
    };

    const getPhoneProjection = (state: GameState) => buildPhoneStateFromTables(state, {
        allowFallbackWhenEmpty: false,
        preserveLegacySocialFeeds: false
    });

    const applyPhoneTableMutations = (state: GameState, commands: TavernCommand[]) => {
        const processed = applyCommandsWithTurnTransaction(state, commands);
        let next = processed.newState;
        if (processed.logs.length > 0) {
            next = {
                ...next,
                日志: [...(next.日志 || []), ...processed.logs]
            };
        }
        return next;
    };

    const toPhoneThreadSheetRow = (thread: PhoneThread): Record<string, unknown> => ({
        thread_id: thread.id,
        type: normalizePhoneThreadType(thread.类型),
        title: normalizePhoneThreadTitle(thread.标题) || thread.id,
        members: Array.isArray(thread.成员) ? thread.成员.join(',') : '',
        unread: typeof thread.未读 === 'number' ? Math.max(0, thread.未读) : 0,
        pinned: !!thread.置顶,
        summary: thread.摘要 || '',
        summary_time: thread.摘要时间 || ''
    });

    const toPhoneMessageSheetRow = (
        message: PhoneMessage,
        thread: PhoneThread
    ): Record<string, unknown> => ({
        message_id: message.id,
        thread_id: thread.id,
        thread_type: normalizePhoneThreadType(thread.类型),
        thread_title: normalizePhoneThreadTitle(thread.标题) || thread.id,
        sender: message.发送者 || '未知',
        content: message.内容 || '',
        timestamp: message.时间戳 || '未知',
        msg_type: message.类型 || 'text',
        status: message.状态 || 'sent',
        deliver_at: message.送达时间 || ''
    });

    const toPhonePendingSheetRow = (item: PhonePendingMessage): Record<string, unknown> => ({
        pending_id: String(item?.id || '').trim() || generateLegacyId(),
        thread_id: String(item?.threadId || '').trim(),
        thread_type: normalizePhoneThreadType(item?.threadType || 'private'),
        thread_title: normalizePhoneThreadTitle(item?.threadTitle || ''),
        deliver_at: String(item?.deliverAt || '').trim() || '未知',
        status: String(item?.status || 'scheduled').trim() || 'scheduled',
        payload_preview: String(item?.payload?.内容 || '').trim(),
        trigger: item?.trigger
    });

    const FIXED_FORUM_BOARD_NAMES = ['欧拉丽快报', '地下城攻略', '眷族招募', '酒馆闲谈'] as const;
    const FIXED_FORUM_BOARD_IDS = ['board_news', 'board_dungeon', 'board_recruit', 'board_tavern'] as const;
    const DEFAULT_FORUM_BOARD_NAME = FIXED_FORUM_BOARD_NAMES[0];
    const FIXED_FORUM_BOARD_SET = new Set<string>(FIXED_FORUM_BOARD_NAMES);
    const FIXED_FORUM_BOARD_NAME_TO_ID = new Map<string, string>(
        FIXED_FORUM_BOARD_NAMES.map((name, index) => [name, FIXED_FORUM_BOARD_IDS[index]])
    );
    const FIXED_FORUM_BOARD_ID_TO_NAME = new Map<string, string>(
        FIXED_FORUM_BOARD_NAMES.map((name, index) => [FIXED_FORUM_BOARD_IDS[index], name])
    );
    const normalizeFixedForumBoardName = (value: unknown): string => {
        const text = String(value ?? '').trim();
        return FIXED_FORUM_BOARD_SET.has(text) ? text : '';
    };
    const normalizeFixedForumBoardId = (value: unknown): string => {
        const text = String(value ?? '').trim();
        if (!text) return '';
        if (FIXED_FORUM_BOARD_ID_TO_NAME.has(text)) return text;
        return '';
    };
    const resolveFixedForumBoardName = (nameCandidate: unknown, boardIdCandidate?: unknown): string => {
        const direct = normalizeFixedForumBoardName(nameCandidate);
        if (direct) return direct;
        const normalizedBoardId = normalizeFixedForumBoardId(boardIdCandidate);
        if (!normalizedBoardId) return DEFAULT_FORUM_BOARD_NAME;
        return normalizeFixedForumBoardName(FIXED_FORUM_BOARD_ID_TO_NAME.get(normalizedBoardId)) || DEFAULT_FORUM_BOARD_NAME;
    };
    const toForumBoardId = (name: string) => {
        const normalizedName = normalizeFixedForumBoardName(name);
        if (!normalizedName) return 'board_news';
        return FIXED_FORUM_BOARD_NAME_TO_ID.get(normalizedName) || 'board_news';
    };

    const toForumBoardSheetRow = (board: any, fallbackName?: string): Record<string, unknown> | null => {
        const name = normalizeFixedForumBoardName(board?.名称 ?? board?.name ?? fallbackName ?? '');
        if (!name) return null;
        return {
            board_id: normalizeFixedForumBoardId(board?.id ?? board?.board_id) || toForumBoardId(name),
            名称: name,
            图标: String(board?.图标 ?? board?.icon ?? '').trim(),
            颜色: String(board?.颜色 ?? board?.color ?? '').trim(),
            描述: String(board?.描述 ?? board?.description ?? '').trim()
        };
    };

    const toForumPostSheetRow = (post: any): Record<string, unknown> | null => {
        const title = String(post?.标题 ?? post?.title ?? post?.帖子标题 ?? '').trim();
        const content = String(post?.内容 ?? post?.content ?? post?.正文 ?? '').trim();
        const sender = String(post?.发布者 ?? post?.sender ?? post?.发帖人 ?? post?.作者 ?? '').trim();
        if (!title || !content || !sender) return null;
        const boardName = resolveFixedForumBoardName(
            post?.板块 ?? post?.board_name ?? post?.boardName ?? '',
            post?.board_id ?? post?.boardId ?? ''
        );
        const tagsRaw = post?.话题标签 ?? post?.tags ?? post?.话题;
        const tags = Array.isArray(tagsRaw)
            ? tagsRaw.map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : String(tagsRaw ?? '').split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
        return {
            post_id: String(post?.id ?? post?.post_id ?? '').trim() || generateLegacyId(),
            board_id: normalizeFixedForumBoardId(post?.board_id ?? post?.boardId) || toForumBoardId(boardName),
            board_name: boardName,
            标题: title,
            内容: content,
            发布者: sender,
            时间戳: String(post?.时间戳 ?? post?.timestamp ?? post?.发布时间 ?? gameState.游戏时间 ?? '').trim(),
            点赞数: Number.isFinite(Number(post?.点赞数 ?? post?.likes)) ? Math.max(0, Math.floor(Number(post?.点赞数 ?? post?.likes))) : 0,
            浏览数: Number.isFinite(Number(post?.浏览数 ?? post?.views)) ? Math.max(0, Math.floor(Number(post?.浏览数 ?? post?.views))) : 0,
            置顶: post?.置顶 ? 'yes' : 'no',
            精华: post?.精华 ? 'yes' : 'no',
            话题标签: tags.join(', '),
            图片描述: String(post?.图片描述 ?? post?.image_desc ?? '').trim()
        };
    };

    const toForumReplySheetRow = (reply: any, postId: string, fallbackFloor: number): Record<string, unknown> | null => {
        const sender = String(reply?.发布者 ?? reply?.sender ?? reply?.用户 ?? reply?.发帖人 ?? '').trim();
        const content = String(reply?.内容 ?? reply?.content ?? reply?.回复内容 ?? '').trim();
        if (!postId || !sender || !content) return null;
        return {
            reply_id: String(reply?.id ?? reply?.reply_id ?? '').trim() || generateLegacyId(),
            post_id: postId,
            楼层: Number.isFinite(Number(reply?.楼层 ?? reply?.floor))
                ? Math.max(1, Math.floor(Number(reply?.楼层 ?? reply?.floor)))
                : fallbackFloor,
            发布者: sender,
            内容: content,
            时间戳: String(reply?.时间戳 ?? reply?.timestamp ?? reply?.发布时间 ?? gameState.游戏时间 ?? '').trim(),
            引用楼层: Number.isFinite(Number(reply?.引用楼层 ?? reply?.quote_floor))
                ? Math.max(1, Math.floor(Number(reply?.引用楼层 ?? reply?.quote_floor)))
                : undefined,
            点赞数: Number.isFinite(Number(reply?.点赞数 ?? reply?.likes))
                ? Math.max(0, Math.floor(Number(reply?.点赞数 ?? reply?.likes)))
                : undefined
        };
    };

    const toPhoneMomentSheetRow = (post: any): Record<string, unknown> | null => {
        const sender = String(post?.发布者 ?? post?.sender ?? '').trim();
        const content = String(post?.内容 ?? post?.content ?? '').trim();
        if (!sender || !content) return null;
        const tagsRaw = post?.话题 ?? post?.话题标签 ?? post?.tags;
        const tags = Array.isArray(tagsRaw)
            ? tagsRaw.map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
            : String(tagsRaw ?? '').split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
        const comments = Array.isArray(post?.评论) ? post.评论 : [];
        return {
            moment_id: String(post?.id ?? post?.moment_id ?? '').trim() || generateLegacyId(),
            发布者: sender,
            内容: content,
            时间戳: String(post?.时间戳 ?? post?.timestamp ?? gameState.游戏时间 ?? '').trim(),
            可见性: String(post?.可见性 ?? post?.visibility ?? 'friends').trim() || 'friends',
            点赞数: Number.isFinite(Number(post?.点赞数 ?? post?.likes)) ? Math.max(0, Math.floor(Number(post?.点赞数 ?? post?.likes))) : 0,
            评论数: Number.isFinite(Number(post?.评论数 ?? post?.comment_count))
                ? Math.max(0, Math.floor(Number(post?.评论数 ?? post?.comment_count)))
                : comments.length,
            话题标签: tags.join(', '),
            图片描述: String(post?.图片描述 ?? post?.image_desc ?? '').trim()
        };
    };

    const findThreadById = (phoneState: ReturnType<typeof getPhoneProjection>, threadId: string): PhoneThread | null => {
        const allThreads = [
            ...(phoneState.对话?.私聊 || []),
            ...(phoneState.对话?.群聊 || []),
            ...(phoneState.对话?.公共频道 || [])
        ];
        return allThreads.find((thread) => thread.id === threadId) || null;
    };

    const findMessageContextById = (phoneState: ReturnType<typeof getPhoneProjection>, messageId: string) => {
        const allThreads = [
            ...(phoneState.对话?.私聊 || []),
            ...(phoneState.对话?.群聊 || []),
            ...(phoneState.对话?.公共频道 || [])
        ];
        for (const thread of allThreads) {
            const message = (thread.消息 || []).find((item) => item.id === messageId);
            if (message) {
                return { thread, message };
            }
        }
        return null;
    };

    const enqueuePhoneMessages = (state: GameState, aiMessages: any[], playerName: string) => {
        if (!aiMessages || aiMessages.length === 0) return state;
        const projection = getPhoneProjection(state);
        const allThreads = [
            ...(projection.对话?.私聊 || []),
            ...(projection.对话?.群聊 || []),
            ...(projection.对话?.公共频道 || [])
        ];
        const threadIdentityMap = new Map<string, string>();
        allThreads.forEach((thread) => {
            const key = `${normalizePhoneThreadType(thread.类型)}::${normalizePhoneThreadTitle(thread.标题).toLowerCase()}`;
            if (!threadIdentityMap.has(key)) {
                threadIdentityMap.set(key, String(thread.id || '').trim());
            }
        });
        const nowTime = state.游戏时间;
        const pendingRows: Record<string, unknown>[] = [];
        aiMessages.forEach((raw, index) => {
            const threadTitle = normalizePhoneThreadTitle(raw.thread_title || raw.threadTitle || raw.title || raw.标题 || '未知') || '未知';
            const threadType = normalizePhoneThreadType(raw.thread_type || raw.threadType || raw.type || 'private');
            const sender = raw.sender || raw.发送者 || threadTitle || playerName || '未知';
            const delayMinutes = typeof raw.delay_minutes === 'number' ? raw.delay_minutes : 0;
            const deliverAt = raw.deliver_at_game_time || raw.deliverAt || (delayMinutes > 0 ? advanceGameTimeByMinutes(nowTime, delayMinutes).time : nowTime);
            const identityKey = `${threadType}::${threadTitle.toLowerCase()}`;
            const existingThreadId = threadIdentityMap.get(identityKey) || '';
            const threadId = String(raw.thread_id || raw.threadId || existingThreadId || `Thr_${Date.now()}_${index + 1}`).trim();
            const msg = normalizePhoneMessage({
                ...raw,
                发送者: sender,
                时间戳: deliverAt,
                延迟分钟: delayMinutes
            }, deliverAt, sender);
            const pendingItem: PhonePendingMessage = {
                id: generateLegacyId(),
                threadId,
                threadTitle,
                threadType,
                deliverAt,
                payload: msg,
                status: 'scheduled',
                trigger: raw.trigger
            };
            pendingRows.push(toPhonePendingSheetRow(pendingItem));
        });
        if (pendingRows.length === 0) return state;
        return applyPhoneTableMutations(state, [{
            action: 'upsert_sheet_rows',
            value: {
                sheetId: 'PHONE_Pending',
                keyField: 'pending_id',
                rows: pendingRows
            }
        }]);
    };

    const applyPhoneDeliveries = (state: GameState, nowTime: string) => {
        const projection = getPhoneProjection(state);
        const pending = Array.isArray(projection.待发送) ? projection.待发送 : [];
        if (pending.length === 0) {
            return { nextState: state, delivered: [] as PhoneMessage[] };
        }
        const nowValue = gameTimeToMinutes(nowTime) ?? 0;
        const allThreads = [
            ...(projection.对话?.私聊 || []),
            ...(projection.对话?.群聊 || []),
            ...(projection.对话?.公共频道 || [])
        ];
        const threadMap = new Map<string, PhoneThread>();
        const threadIdentityMap = new Map<string, string>();
        allThreads.forEach((thread) => {
            const cloned: PhoneThread = {
                ...thread,
                成员: Array.isArray(thread.成员) ? [...thread.成员] : [],
                消息: Array.isArray(thread.消息) ? [...thread.消息] : []
            };
            const threadId = String(cloned.id || '').trim();
            if (threadId) {
                threadMap.set(threadId, cloned);
            }
            const identity = `${normalizePhoneThreadType(cloned.类型)}::${normalizePhoneThreadTitle(cloned.标题).toLowerCase()}`;
            if (!threadIdentityMap.has(identity) && threadId) {
                threadIdentityMap.set(identity, threadId);
            }
        });

        const pendingRowIds: string[] = [];
        const upsertThreads = new Map<string, PhoneThread>();
        const messageRows: Record<string, unknown>[] = [];
        const delivered: PhoneMessage[] = [];
        pending.forEach((item, index) => {
            const deliverAtValue = gameTimeToMinutes(item.deliverAt);
            const isDue = deliverAtValue === null ? true : deliverAtValue <= nowValue;
            if (!isDue) return;
            const pendingId = String(item.id || '').trim();
            if (pendingId) pendingRowIds.push(pendingId);

            const threadType = normalizePhoneThreadType(item.threadType || 'private');
            const threadTitle = normalizePhoneThreadTitle(item.threadTitle || item.payload?.发送者 || item.threadId || '未知') || '未知';
            const identity = `${threadType}::${threadTitle.toLowerCase()}`;
            const matchedThreadId = threadIdentityMap.get(identity) || '';
            const threadId = String(item.threadId || matchedThreadId || `Thr_${Date.now()}_${index + 1}`).trim();
            let thread = threadMap.get(threadId);
            if (!thread && matchedThreadId) {
                thread = threadMap.get(matchedThreadId);
            }
            if (!thread) {
                thread = {
                    id: threadId,
                    类型: threadType,
                    标题: threadTitle,
                    成员: [threadTitle],
                    消息: [],
                    未读: 0
                };
            }

            const deliverAt = item.deliverAt || nowTime;
            const payload = normalizePhoneMessage(
                { ...item.payload, 时间戳: item.payload?.时间戳 || deliverAt, 状态: 'received' },
                deliverAt,
                item.payload?.发送者 || threadTitle || '未知'
            );
            const previousMessages = Array.isArray(thread.消息) ? thread.消息 : [];
            const mergedMessages = mergeThreadMessages(previousMessages, [payload]);
            const isNewMessage = mergedMessages.length > previousMessages.length;
            thread.消息 = mergedMessages;
            if (isNewMessage) {
                thread.未读 = (thread.未读 || 0) + 1;
                delivered.push(payload);
                messageRows.push(toPhoneMessageSheetRow(payload, thread));
            }
            threadMap.set(thread.id, thread);
            threadIdentityMap.set(identity, thread.id);
            upsertThreads.set(thread.id, thread);
        });

        if (pendingRowIds.length === 0) {
            return { nextState: state, delivered };
        }

        const commands: TavernCommand[] = [];
        if (upsertThreads.size > 0) {
            commands.push({
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'PHONE_Threads',
                    keyField: 'thread_id',
                    rows: Array.from(upsertThreads.values()).map((thread) => toPhoneThreadSheetRow(thread))
                }
            });
        }
        if (messageRows.length > 0) {
            commands.push({
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'PHONE_Messages',
                    keyField: 'message_id',
                    rows: messageRows
                }
            });
        }
        commands.push({
            action: 'delete_sheet_rows',
            value: {
                sheetId: 'PHONE_Pending',
                keyField: 'pending_id',
                rowIds: pendingRowIds
            }
        });

        const nextState = applyPhoneTableMutations(state, commands);
        return { nextState, delivered };
    };

    const pushPhoneNotification = (title: string, message: string) => {
        const id = generateLegacyId();
        setPhoneNotifications(prev => [...prev, { id, title, message }]);
        setTimeout(() => {
            setPhoneNotifications(prev => prev.filter(n => n.id !== id));
        }, 4500);
    };

    const DEBUG_BUILD_TAG = '2026-02-02-1945';

    if (typeof window !== 'undefined') {
        (window as any).__DXC_DEBUG_BUILD = DEBUG_BUILD_TAG;
    }

    const DEBUG_LOG_KEY = '__DXC_DEBUG_LOG';

    const shouldDebugProbe = () => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('dxc_debug_ms') === '1';
    };

    const appendDebugLog = (payload: { hid: string; loc: string; msg: string; data?: any }) => {
        if (!shouldDebugProbe()) return;
        try {
            const entry = {
                hid: payload.hid,
                loc: payload.loc,
                msg: payload.msg,
                data: { ...(payload.data || {}) },
                ts: Date.now()
            };
            const line = JSON.stringify(entry);
            if (typeof window !== 'undefined') {
                const existing = (window as any)[DEBUG_LOG_KEY] || '';
                (window as any)[DEBUG_LOG_KEY] = `${existing}${line}\n`;
            }
            if (typeof localStorage !== 'undefined') {
                const prev = localStorage.getItem(DEBUG_LOG_KEY) || '';
                localStorage.setItem(DEBUG_LOG_KEY, `${prev}${line}\n`);
            }
            console.info('[DXC-DBG]', line);
        } catch (_) {
            // ignore debug logging failures
        }
    };

    const shouldDebugMicroservice = () => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('dxc_debug_ms') === '1';
    };

    const pushDebugToast = (title: string, message: string) => {
        if (!shouldDebugMicroservice()) return;
        if (typeof window !== 'undefined') {
            const w = window as any;
            if (!Array.isArray(w.__DXC_DEBUG_EVENTS)) w.__DXC_DEBUG_EVENTS = [];
            w.__DXC_DEBUG_EVENTS.push({ ts: Date.now(), title, message });
        }
        console.warn(`[DXC][DEBUG][${title}] ${message}`);
        pushPhoneNotification(`DEBUG ${title}`, message);
    };

    const setDebugLast = (key: string, payload: any) => {
        if (typeof window === 'undefined') return;
        (window as any)[key] = payload;
    };

    useEffect(() => {
        if (!shouldDebugMicroservice()) return;
        pushPhoneNotification('DEBUG READY', 'microservice debug enabled');
        if (typeof window !== 'undefined') {
            (window as any).__dxcDebugToast = (msg?: string) => {
                pushDebugToast('MANUAL', msg || 'ping');
                return 'ok';
            };
        }
        console.warn('DEBUG READY', DEBUG_BUILD_TAG);
        console.info('[DXC][DEBUG] microservice debug enabled');
    }, []);

    useEffect(() => {
        if (!shouldDebugMicroservice()) return;
        if (typeof window === 'undefined') return;
        const summarizeConfig = (serviceKey: string) => {
            const cfg = resolveServiceConfig(settings, serviceKey, { strictService: true });
            const runtime = resolveServiceConfig(settings, serviceKey);
            return {
                hasKey: !!cfg?.apiKey,
                provider: cfg?.provider,
                baseUrl: cfg?.baseUrl,
                modelId: cfg?.modelId,
                runtimeProvider: runtime?.provider,
                runtimeModelId: runtime?.modelId
            };
        };
        (window as any).__dxcDebugToast = (msg?: string) => {
            pushDebugToast('MANUAL', msg || 'ping');
            return 'ok';
        };
        (window as any).__dxcDebug = {
            build: DEBUG_BUILD_TAG,
            dump: () => ({
                triadOnly: true,
                isMicroserviceMode: isMicroserviceMode(),
                isProcessing,
                gameTime: gameState.游戏时间,
                nextWorldUpdateTurn: gameState.世界?.下次更新回合,
                services: {
                    story: summarizeConfig('story'),
                    map: summarizeConfig('map'),
                    state: summarizeConfig('state'),
                    memory: summarizeConfig('memory')
                }
            }),
            state: () => ({
                location: gameState.当前地点,
                gameTime: gameState.游戏时间,
                turn: gameState.回合数,
                task0: gameState.任务?.[0]?.状态,
                taskTitles: (gameState.任务 || []).map(t => `${t.id}:${t.标题}:${t.状态}`),
                socialNames: (gameState.社交 || []).map(c => c.姓名),
                social0Memory: gameState.社交?.[0]?.记忆?.length ?? 0,
                social1Memory: gameState.社交?.[1]?.记忆?.length ?? 0
            }),
            last: () => ({
                ms: (window as any).__DXC_MS_LAST,
                world: (window as any).__DXC_WORLD_LAST,
                debugEvents: (window as any).__DXC_DEBUG_EVENTS || [],
                msQueue: (window as any).__DXC_MSQ_STATE || {}
            }),
            forceWorldUpdate: () => {
                handleWorldInfoUpdate('debug-force', gameState);
                return 'queued';
            },
            forceService: (serviceKey: string) => {
                const normalizedServiceKey = serviceKey === 'memory' || serviceKey === 'map' || serviceKey === 'story'
                    ? serviceKey
                    : 'state';
                const meta = { playerInput: '[DEBUG]', logs: [], appliedCommands: [] };
                const input = buildServiceInput(normalizedServiceKey, gameState, meta);
                const priority = (MICROSERVICE_PRIORITIES as any)?.[normalizedServiceKey] ?? 5;
                enqueueMicroserviceTask(normalizedServiceKey, input, gameState, priority);
                return 'queued';
            }
        };
    }, [settings, gameState, isProcessing]);

    const mergeThreadList = (base: PhoneThread[] = [], incoming: PhoneThread[] = []) => {
        const map = new Map(base.map(t => [t.id, {
            ...t,
            消息: mergeThreadMessages(t.消息 || [], [])
        }]));
        incoming.forEach(t => {
            const existing = map.get(t.id);
            if (!existing) {
                map.set(t.id, {
                    ...t,
                    消息: mergeThreadMessages(t.消息 || [], [])
                });
                return;
            }
            const mergedMessages = mergeThreadMessages(existing.消息 || [], t.消息 || []);
            map.set(t.id, {
                ...existing,
                ...t,
                消息: mergedMessages,
                未读: Math.max(existing.未读 || 0, t.未读 || 0)
            });
        });
        return Array.from(map.values());
    };

    const mergePhoneState = (state: GameState, updates: any) => {
        if (!updates) return state;
        const commands: TavernCommand[] = [];
        if (updates.设备) {
            commands.push({
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'PHONE_Device',
                    keyField: 'device_id',
                    rows: [{
                        device_id: 'device_main',
                        battery: updates.设备?.电量,
                        signal: updates.设备?.当前信号,
                        status: updates.设备?.状态 || 'online'
                    }]
                }
            });
        }
        if (updates.联系人) {
            const projection = getPhoneProjection(state);
            const playerName = state.角色?.姓名;
            const existing = new Set<string>([
                ...(projection.联系人?.好友 || []),
                ...(projection.联系人?.黑名单 || []),
                ...(projection.联系人?.最近 || [])
            ].map((item) => String(item || '').trim()).filter(Boolean));
            if (existing.size > 0) {
                commands.push({
                    action: 'delete_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Contacts',
                        keyField: 'contact_id',
                        rowIds: Array.from(existing)
                    }
                });
            }
            const friends = Array.isArray(updates.联系人?.好友) ? updates.联系人.好友 : [];
            const blacklisted = Array.isArray(updates.联系人?.黑名单) ? updates.联系人.黑名单 : [];
            const recentSet = new Set<string>(
                (Array.isArray(updates.联系人?.最近) ? updates.联系人.最近 : [])
                    .map((item: unknown) => String(item || '').trim())
                    .filter(Boolean)
            );
            const contactRows: Record<string, unknown>[] = [];
            friends.forEach((name: unknown) => {
                const text = String(name || '').trim();
                if (!text) return;
                if (isPlayerReference(text, playerName)) return;
                contactRows.push({
                    contact_id: text,
                    name: text,
                    bucket: 'friend',
                    blacklisted: false,
                    recent: recentSet.has(text)
                });
            });
            blacklisted.forEach((name: unknown) => {
                const text = String(name || '').trim();
                if (!text) return;
                if (isPlayerReference(text, playerName)) return;
                contactRows.push({
                    contact_id: text,
                    name: text,
                    bucket: 'blacklist',
                    blacklisted: true,
                    recent: recentSet.has(text)
                });
            });
            if (contactRows.length > 0) {
                commands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Contacts',
                        keyField: 'contact_id',
                        rows: contactRows
                    }
                });
            }
        }
        if (updates.对话) {
            const threadRows: Record<string, unknown>[] = [];
            const messageRows: Record<string, unknown>[] = [];
            const upsertDialogThreads = (
                list: any[] | undefined,
                threadType: 'private' | 'group' | 'public'
            ) => {
                if (!Array.isArray(list)) return;
                list.forEach((rawThread, index) => {
                    const threadId = String(rawThread?.id || rawThread?.thread_id || `Thr_${Date.now()}_${threadType}_${index + 1}`).trim();
                    if (!threadId) return;
                    const title = normalizePhoneThreadTitle(rawThread?.标题 || rawThread?.title || threadId) || threadId;
                    const members = Array.isArray(rawThread?.成员)
                        ? rawThread.成员.map((item: unknown) => String(item || '').trim()).filter(Boolean)
                        : [];
                    const thread: PhoneThread = {
                        id: threadId,
                        类型: threadType,
                        标题: title,
                        成员: members,
                        消息: [],
                        未读: Number.isFinite(Number(rawThread?.未读)) ? Number(rawThread.未读) : 0,
                        摘要: rawThread?.摘要,
                        摘要时间: rawThread?.摘要时间
                    };
                    threadRows.push(toPhoneThreadSheetRow(thread));
                    const messages = Array.isArray(rawThread?.消息) ? rawThread.消息 : [];
                    messages.forEach((rawMsg: any) => {
                        const message = normalizePhoneMessage({
                            ...rawMsg,
                            id: rawMsg?.id || generateLegacyId(),
                            发送者: rawMsg?.发送者 || rawMsg?.sender || title
                        }, state.游戏时间 || '未知', rawMsg?.发送者 || rawMsg?.sender || title);
                        messageRows.push(toPhoneMessageSheetRow(message, thread));
                    });
                });
            };
            upsertDialogThreads(updates.对话.私聊, 'private');
            upsertDialogThreads(updates.对话.群聊, 'group');
            upsertDialogThreads(updates.对话.公共频道, 'public');
            if (threadRows.length > 0) {
                commands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Threads',
                        keyField: 'thread_id',
                        rows: threadRows
                    }
                });
            }
            if (messageRows.length > 0) {
                commands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Messages',
                        keyField: 'message_id',
                        rows: messageRows
                    }
                });
            }
        }
        if (Array.isArray(updates.待发送)) {
            const projection = getPhoneProjection(state);
            const existingPendingIds = (projection.待发送 || [])
                .map((item) => String(item?.id || '').trim())
                .filter(Boolean);
            if (existingPendingIds.length > 0) {
                commands.push({
                    action: 'delete_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Pending',
                        keyField: 'pending_id',
                        rowIds: existingPendingIds
                    }
                });
            }
            const pendingRows = updates.待发送
                .map((item: PhonePendingMessage) => toPhonePendingSheetRow(item))
                .filter((row: Record<string, unknown> | null): row is Record<string, unknown> => !!row);
            if (pendingRows.length > 0) {
                commands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Pending',
                        keyField: 'pending_id',
                        rows: pendingRows
                    }
                });
            }
        }
        const socialFeedCommands: TavernCommand[] = [];
        if (updates.朋友圈?.帖子 && Array.isArray(updates.朋友圈.帖子)) {
            const momentRows = updates.朋友圈.帖子
                .map((post: any) => toPhoneMomentSheetRow(post))
                .filter((row: Record<string, unknown> | null): row is Record<string, unknown> => !!row);
            if (momentRows.length > 0) {
                socialFeedCommands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Moments',
                        keyField: 'moment_id',
                        rows: momentRows
                    }
                });
            }
        }
        if (updates.公共帖子) {
            const boardRows = (Array.isArray(updates.公共帖子?.板块) ? updates.公共帖子.板块 : [])
                .map((board: any) => toForumBoardSheetRow(board))
                .filter((row: Record<string, unknown> | null): row is Record<string, unknown> => !!row);
            if (boardRows.length > 0) {
                socialFeedCommands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'FORUM_Boards',
                        keyField: 'board_id',
                        rows: boardRows
                    }
                });
            }
            const postRows: Record<string, unknown>[] = [];
            const replyRows: Record<string, unknown>[] = [];
            (Array.isArray(updates.公共帖子?.帖子) ? updates.公共帖子.帖子 : []).forEach((post: any) => {
                const postRow = toForumPostSheetRow(post);
                if (!postRow) return;
                postRows.push(postRow);
                const postId = String((postRow as any).post_id || '').trim();
                const replies = Array.isArray(post?.回复) ? post.回复 : [];
                replies.forEach((reply: any, replyIndex: number) => {
                    const replyRow = toForumReplySheetRow(reply, postId, replyIndex + 1);
                    if (replyRow) replyRows.push(replyRow);
                });
            });
            if (postRows.length > 0) {
                socialFeedCommands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'FORUM_Posts',
                        keyField: 'post_id',
                        rows: postRows
                    }
                });
            }
            if (replyRows.length > 0) {
                socialFeedCommands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'FORUM_Replies',
                        keyField: 'reply_id',
                        rows: replyRows
                    }
                });
            }
        }
        if (socialFeedCommands.length > 0) {
            commands.push(...socialFeedCommands);
        }
        if (commands.length === 0) return state;
        return applyPhoneTableMutations(state, commands);
    };

    const appendPhoneMemoryEntries = (state: GameState, _entries: string[]) => {
        // 手机相关事件只保留在 PHONE_* / FORUM_* 表，不再混入 AM 日志表。
        return state;
    };

    const applyThreadSummaries = (state: GameState, summaries: any[]) => {
        if (!summaries || summaries.length === 0) return state;
        const summaryMap = new Map(
            summaries
                .map((item) => ({
                    threadId: String(item?.threadId || '').trim(),
                    summary: String(item?.summary || '').trim()
                }))
                .filter((item) => item.threadId && item.summary)
                .map((item) => [item.threadId, item.summary])
        );
        if (summaryMap.size === 0) return state;
        const projection = getPhoneProjection(state);
        const allThreads = [
            ...(projection.对话?.私聊 || []),
            ...(projection.对话?.群聊 || []),
            ...(projection.对话?.公共频道 || [])
        ];
        const rows = allThreads
            .filter((thread) => summaryMap.has(thread.id))
            .map((thread) => {
                const lastStamp = thread.消息?.[thread.消息.length - 1]?.timestampValue || Date.now();
                return toPhoneThreadSheetRow({
                    ...thread,
                    摘要: summaryMap.get(thread.id),
                    摘要时间: state.游戏时间 || '',
                    摘要更新时间: lastStamp
                });
            });
        if (rows.length === 0) return state;
        return applyPhoneTableMutations(state, [{
            action: 'upsert_sheet_rows',
            value: {
                sheetId: 'PHONE_Threads',
                keyField: 'thread_id',
                rows
            }
        }]);
    };

    const applyPhoneResponseToState = (state: GameState, response: PhoneAIResponse, playerName: string) => {
        let nextState = state;
        if (response.phone_updates) nextState = mergePhoneState(nextState, response.phone_updates);
        if (response.messages) nextState = enqueuePhoneMessages(nextState, response.messages, playerName);
        if (response.tavern_commands && response.tavern_commands.length > 0) {
            const hasPhoneUpdates = !!response.phone_updates;
            const hasMessages = Array.isArray(response.messages) && response.messages.length > 0;
            const getCommandKey = (cmd: any) => String(cmd?.key || cmd?.path || '');
            const commands = hasPhoneUpdates
                ? response.tavern_commands.filter(cmd => {
                    const key = getCommandKey(cmd);
                    if (!key.startsWith('gameState.手机')) return true;
                    if (key.startsWith('gameState.手机.公共帖子')) return true;
                    if (key.startsWith('gameState.手机.朋友圈')) return true;
                    return false;
                })
                : hasMessages
                    ? response.tavern_commands.filter(cmd => {
                        const key = getCommandKey(cmd);
                        if (!key.startsWith('gameState.手机')) return true;
                        // Keep social-feed writes so PHONE_POST/FORUM flows can map into FORUM/PHONE_Moments tables.
                        if (key.startsWith('gameState.手机.公共帖子')) return true;
                        if (key.startsWith('gameState.手机.朋友圈')) return true;
                        return false;
                    })
                    : response.tavern_commands;
            if (commands.length > 0) {
                nextState = applyCommandsWithTurnTransaction(nextState, commands).newState;
            }
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

    const adjustPhoneResponseForChat = (
        response: PhoneAIResponse,
        anchor?: { threadId?: string; threadTitle?: string; threadType?: 'private' | 'group' | 'public' }
    ) => {
        if (!response || !Array.isArray(response.messages)) return response;
        const anchoredThreadId = String(anchor?.threadId || '').trim();
        const anchoredThreadTitle = normalizePhoneThreadTitle(anchor?.threadTitle || '');
        const anchoredThreadType = normalizePhoneThreadType(anchor?.threadType || 'private');
        const adjusted = response.messages.map(msg => {
            let nextMsg = msg;
            if (typeof msg?.delay_minutes === 'number'
                && msg.delay_minutes > 10
                && !msg.deliver_at_game_time
                && !msg.trigger) {
                nextMsg = { ...msg, delay_minutes: 8 };
            }
            if (anchoredThreadTitle) {
                nextMsg = {
                    ...nextMsg,
                    ...(anchoredThreadId ? { thread_id: anchoredThreadId, threadId: anchoredThreadId } : {}),
                    thread_title: anchoredThreadTitle,
                    threadTitle: anchoredThreadTitle,
                    thread_type: anchoredThreadType,
                    threadType: anchoredThreadType,
                    type: anchoredThreadType
                };
            }
            return nextMsg;
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
            const resp = await runPhoneGenerationRequest(input, baseState, { cancelPrevious: false });
            const summary = Array.isArray(resp.thread_summaries) && resp.thread_summaries.length > 0 ? resp.thread_summaries[0].summary : '';
            if (!summary) return;
            setGameState(prev => {
                const projection = getPhoneProjection(prev);
                const allThreads = [
                    ...(projection.对话?.私聊 || []),
                    ...(projection.对话?.群聊 || []),
                    ...(projection.对话?.公共频道 || [])
                ];
                const target = allThreads.find((item) => item.id === thread.id);
                if (!target) return prev;
                const lastStamp = target.消息?.[target.消息.length - 1]?.timestampValue || Date.now();
                return applyPhoneTableMutations(prev, [{
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Threads',
                        keyField: 'thread_id',
                        rows: [toPhoneThreadSheetRow({
                            ...target,
                            摘要: summary,
                            摘要时间: prev.游戏时间 || '',
                            摘要更新时间: lastStamp
                        })]
                    }
                }]);
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
        const projection = getPhoneProjection(state);
        const pending = Array.isArray(projection.待发送) ? projection.待发送 : [];
        if (pending.length === 0) return { changed: false, state };
        const nowTime = state.游戏时间;
        const updatedRows = pending
            .filter((item) => item.status === 'scheduled' && shouldTriggerAdvance(item.trigger, state))
            .map((item) => toPhonePendingSheetRow({ ...item, deliverAt: nowTime }));
        if (updatedRows.length === 0) return { changed: false, state };
        return {
            changed: true,
            state: applyPhoneTableMutations(state, [{
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'PHONE_Pending',
                    keyField: 'pending_id',
                    rows: updatedRows
                }
            }])
        };
    };

    const compactRecallText = (value: unknown, max: number = 120): string => {
        const text = String(value ?? '').replace(/\s+/g, ' ').trim();
        if (!text) return '';
        return text.length > max ? `${text.slice(0, max)}...` : text;
    };

    const normalizeAmRecallItem = (raw: unknown): {
        编码索引: string;
        时间跨度?: string;
        地点?: string;
        纪要?: string;
        大纲?: string;
        来源?: string;
    } | null => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const item = raw as Record<string, unknown>;
        const amRaw = String(item.编码索引 ?? item.amIndex ?? item.index ?? '').trim().toUpperCase();
        const amMatch = amRaw.match(/AM\d{1,6}/i);
        if (!amMatch) return null;
        const normalized = {
            编码索引: amMatch[0].toUpperCase().replace(/^AM(\d+)$/i, (_, digits) => `AM${digits.padStart(4, '0')}`),
            时间跨度: compactRecallText(item.时间跨度 ?? item.timeSpan, 48),
            地点: compactRecallText(item.地点 ?? item.location, 24),
            纪要: compactRecallText(item.纪要 ?? item.摘要 ?? item.summary ?? item.fact, 96),
            大纲: compactRecallText(item.大纲 ?? item.outline ?? item.event, 96),
            来源: compactRecallText(item.来源 ?? item.source, 20)
        };
        return normalized;
    };

    const parseAmRecallItemsFromRaw = (rawText: string) => {
        const parsed = parseAIResponseText(rawText).response as any;
        const candidates = [
            parsed?.items,
            parsed?.hits,
            parsed?.records,
            parsed?.results
        ].find((value) => Array.isArray(value));
        if (!Array.isArray(candidates)) return [];
        const normalized = candidates
            .map((item: unknown) => normalizeAmRecallItem(item))
            .filter((item): item is NonNullable<ReturnType<typeof normalizeAmRecallItem>> => !!item);
        const seen = new Set<string>();
        return normalized.filter((item) => {
            if (seen.has(item.编码索引)) return false;
            seen.add(item.编码索引);
            return true;
        });
    };

    const buildNarrativePreludeBlock = (
        state: GameState,
        playerInput: string,
        recallItems: Array<{
            编码索引: string;
            时间跨度?: string;
            地点?: string;
            纪要?: string;
            大纲?: string;
            来源?: string;
        }>,
        sourceTag: string
    ): string => {
        const coords = state.世界坐标 && Number.isFinite(state.世界坐标.x) && Number.isFinite(state.世界坐标.y)
            ? `${Math.round(state.世界坐标.x)},${Math.round(state.世界坐标.y)}`
            : '-';
        const lines = [
            '[叙事前固定注入]',
            '以下是系统清洗后的固定事实与召回结果，仅用于事实锚点，禁止扩写为未出现事实。',
            `[固定事实] 日期=${state.当前日期 || '-'} | 时间=${state.游戏时间 || '-'} | 地点=${state.当前地点 || '-'} | 楼层=${state.当前楼层 ?? '-'} | 坐标=${coords} | 回合=${state.回合数 || '-'}`,
            `[检索查询] ${playerInput}`,
            `[AM召回来源] ${sourceTag}`,
            '[AM召回条目]'
        ];
        if (!Array.isArray(recallItems) || recallItems.length === 0) {
            lines.push('- 无命中（保持未知，不得凭空补全）');
        } else {
            recallItems.slice(0, 4).forEach((item, index) => {
                const meta = [
                    `AM=${item.编码索引}`,
                    `时间=${item.时间跨度 || '-'}`,
                    `地点=${item.地点 || '-'}`,
                    `来源=${item.来源 || '-'}`
                ].join(' | ');
                const fact = compactRecallText(item.纪要 || item.大纲 || '-', 120);
                lines.push(`${index + 1}. ${meta}`);
                lines.push(`   事实: ${fact}`);
            });
        }
        return lines.join('\n');
    };

    const resolvePreDialogueAmRecallBlock = async (state: GameState, playerInput: string, signal?: AbortSignal): Promise<string> => {
        const inputText = String(playerInput || '').trim();
        const amTokens = inputText.match(/AM\d{1,6}/gi) || [];
        if (amTokens.length === 0) return '';

        const indexEntries = buildMemoryIndexProjection(
            Array.isArray(state.日志摘要) ? state.日志摘要 as any : [],
            Array.isArray(state.日志大纲) ? state.日志大纲 as any : [],
            { summaryWindow: 48, outlineWindow: 32 }
        );
        const localHits = retrieveMemoryByQuery(indexEntries, inputText, { topK: 8 });
        const localItems = (Array.isArray(localHits) ? localHits : [])
            .map((hit: any) => normalizeAmRecallItem({
                编码索引: hit?.entry?.amIndex,
                时间跨度: hit?.entry?.timeSpan,
                地点: hit?.entry?.location,
                纪要: hit?.entry?.summaryText,
                大纲: hit?.entry?.outlineText,
                来源: hit?.entry?.source
            }))
            .filter((item): item is NonNullable<ReturnType<typeof normalizeAmRecallItem>> => !!item);

        let recallItems = localItems;
        let sourceTag = localItems.length > 0 ? 'local-index' : 'local-empty';

        try {
            const memoryConfig = resolveServiceConfig(settings, 'memory', { strictService: true });
            if (memoryConfig?.apiKey) {
                const recallSystemPrompt = [
                    '你是AM记忆检索器。只做召回，不做叙事，不做变量写入。',
                    '输入会提供 query 与候选条目。你只能从候选中挑选，禁止编造新事实。',
                    '输出严格 JSON：{"items":[{"编码索引":"AM0001","时间跨度":"","地点":"","纪要":"","大纲":"","来源":"local-index"}]}。',
                    '若无命中，输出 {"items":[]}。'
                ].join('\n');
                const recallUserContent = JSON.stringify({
                    query: inputText,
                    topK: 4,
                    candidates: localItems
                }, null, 2);
                const rawRecall = await dispatchAIRequest(
                    memoryConfig,
                    recallSystemPrompt,
                    recallUserContent,
                    undefined,
                    {
                        responseFormat: 'json',
                        signal,
                        timeoutMs: resolveRequestTimeoutMs(settings, 'memory')
                    }
                );
                const apiItems = parseAmRecallItemsFromRaw(rawRecall);
                if (apiItems.length > 0) {
                    recallItems = apiItems;
                    sourceTag = 'memory-api';
                } else if (localItems.length > 0) {
                    sourceTag = 'memory-api-empty->local-index';
                } else {
                    sourceTag = 'memory-api-empty';
                }
            }
        } catch (error) {
            sourceTag = localItems.length > 0 ? 'memory-api-error->local-index' : 'memory-api-error';
            console.warn('[AM Recall] memory api failed, fallback to local index', error);
        }

        return buildNarrativePreludeBlock(state, inputText, recallItems, sourceTag);
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
        void skipMemoryCheck;

        const preflightStart = perfNow();
        const turnIndex = (baseState.回合数 || 1);
        
        abortActiveMemoryServiceRequests();
        abortActivePhoneServiceRequests();
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
        const userLogSnapshot = createStorageSnapshotString(baseState);
        const snapshotCost = perfNow() - preflightStart;
        const newUserLog: LogEntry = { 
            id: generateLegacyId(), 
            text: logText, 
            sender: 'player', 
            timestamp: Date.now(), 
            turnIndex: turnIndex, 
            snapshot: userLogSnapshot,
            gameTime: baseState.游戏时间 
        };

        const stateWithUserLog = { 
            ...baseState, 
            日志: [...baseState.日志, newUserLog],
            处理中: true 
        };

        setGameState(stateWithUserLog);
        const preflightCost = perfNow() - preflightStart;
        if (preflightCost > 180) {
            console.warn('[Perf][AI] 发送前预处理耗时偏高', {
                preflightMs: Number(preflightCost.toFixed(1)),
                snapshotMs: Number(snapshotCost.toFixed(1)),
                logsCount: Array.isArray(baseState.日志) ? baseState.日志.length : 0
            });
        }
        
        try {

            const onStreamChunk = (() => {
                if (!settings.enableStreaming) return undefined;
                let streamedText = '';
                let pendingDelta = '';
                let rafId: number | null = null;
                let hasThinkingTag = false;
                let lastThinkingParseAt = 0;
                let lastThinkingText = '';
                const maybeUpdateThinking = (force: boolean = false) => {
                    if (!hasThinkingTag) return;
                    const now = Date.now();
                    if (!force && now - lastThinkingParseAt < 600) return;
                    lastThinkingParseAt = now;
                    const { thinking } = extractThinkingBlocks(streamedText);
                    if (!thinking || thinking === lastThinkingText) return;
                    lastThinkingText = thinking;
                    setLastAIThinking(thinking);
                };
                const flush = () => {
                    rafId = null;
                    if (!pendingDelta) return;
                    const delta = pendingDelta;
                    pendingDelta = '';
                    streamedText += delta;
                    if (!hasThinkingTag && /<\/?think(?:ing)?>/i.test(delta)) {
                        hasThinkingTag = true;
                    }
                    setLastAIResponse(prev => prev + delta);
                    maybeUpdateThinking(false);
                };
                return (chunk: string) => {
                    if (!chunk) return;
                    pendingDelta += chunk;
                    if (rafId !== null) return;
                    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                        rafId = window.requestAnimationFrame(flush);
                        return;
                    }
                    flush();
                };
            })();

            const shouldRunIpEnrichment = contextType === 'ACTION' && (baseState.回合数 || 1) <= 1;
            const amRecallBlock = contextType === 'ACTION'
                ? await resolvePreDialogueAmRecallBlock(stateWithUserLog, input, abortController.signal)
                : '';
            const modelInput = amRecallBlock
                ? `${amRecallBlock}\n\n[玩家本轮指令]\n${input}`
                : input;

            const aiResponse = await generateDungeonMasterResponse(
                modelInput,
                stateWithUserLog,
                settings,
                "",
                commandsOverride || [],
                abortController.signal,
                onStreamChunk
            );

            const firstTurnIpProfile = shouldRunIpEnrichment
                ? await fetchFamousIpProfileWithAI(baseState.角色?.姓名 || '', settings, abortController.signal)
                : null;
            
            let nextStateForPhoneSync: GameState | null = null;
            setLastAIThinking(aiResponse.thinking || '');
            const routingProfile = getAiRoutingProfile(settings);
            const useNarrativeOnlyPipeline = shouldUseNarrativeOnlyPipeline(settings, isServiceConfigured('state'));
            pushDebugToast(
                'MS ROUTE',
                `triad=Y only=${useNarrativeOnlyPipeline ? 'Y' : 'N'} stateCfg=${isServiceConfigured('state') ? 'Y' : 'N'}`
            );
            const rawCommandsForService = augmentCommandsWithStructuredCombatPayload(
                aiResponse,
                Array.isArray(aiResponse.tavern_commands) ? aiResponse.tavern_commands : []
            );
            const rawCommandSignals = extractCommandSignals(rawCommandsForService);
            const storyCommandsForService = filterStoryCommands(rawCommandsForService, useNarrativeOnlyPipeline);

            const phoneSyncEnabled = !!aiResponse.phone_sync_plan && isPhoneApiConfigured(settings);
            const shouldStripPhoneWrites = phoneSyncEnabled || shouldStripStoryPhoneWrites();
            let filteredCommandsForService = shouldStripPhoneWrites
                ? stripPhoneCommands(storyCommandsForService)
                : storyCommandsForService;
            let blockedStoryLogWrites = 0;
            const stateOwnsBusinessWrites = shouldStateOwnBusinessWrites();

            if (isMicroserviceMode()) {
                const stripResult = stripStoryTableOwnedCommandsWithDiagnostics(filteredCommandsForService);
                filteredCommandsForService = stripResult.commands;
                blockedStoryLogWrites = stripResult.blockedMemoryLogWrites;
            }
            if (stateOwnsBusinessWrites && filteredCommandsForService.length > 0) {
                filteredCommandsForService = [];
                pushDebugToast('MS STORY', 'state-owned: story tavern_commands dropped');
            }
            const filteredCommandSignals = extractCommandSignals(filteredCommandsForService);

            const responseLogsForService = Array.isArray(aiResponse.logs) ? aiResponse.logs : [];
            const narrativeForService = aiResponse.narrative || '';
            const knownSpeakersForService = [
                resolvePlayerName(stateWithUserLog.角色?.姓名 || '玩家'),
                ...(stateWithUserLog.社交 || []).map((npc: any) => String(npc?.姓名 || '').trim()).filter(Boolean)
            ];
            const logsForService = normalizeStoryResponseLogs({
                rawLogs: responseLogsForService,
                narrative: narrativeForService,
                knownSpeakers: knownSpeakersForService
            });
            if (aiResponse.rawResponse) setLastAIResponse(aiResponse.rawResponse);
            const resolvedActionOptions = extractStructuredActionOptions(aiResponse);
            if (resolvedActionOptions.length > 0) setCurrentOptions(resolvedActionOptions);

            const responseId = generateLegacyId();
            const responseSnapshot = createStorageSnapshotString(stateWithUserLog);
            const commands = filteredCommandsForService;
            let logs = logsForService;
            const interactionNpcIndices = contextType === 'ACTION'
                ? extractInteractionNpcIndices(stateWithUserLog, input, logsForService, commands)
                : [];

            if (logs.length === 0 && aiResponse.rawResponse) {
                logs = [{ sender: "system", text: `(数据解析异常，原始响应):\n${aiResponse.rawResponse}` }];
            }

            const appliedCommandResult = applyCommandsWithTurnTransaction(stateWithUserLog, commands);
            let { newState } = appliedCommandResult;
            const commandSystemLogs = Array.isArray(appliedCommandResult.logs) ? appliedCommandResult.logs : [];
            if (!appliedCommandResult.rolledBack && Array.isArray(commands) && commands.length > 0) {
                const beforePairingIssues = collectIndexedLogPairingIssues({
                    日志摘要: stateWithUserLog.日志摘要 as any,
                    日志大纲: stateWithUserLog.日志大纲 as any
                });
                const afterPairingIssues = collectIndexedLogPairingIssues({
                    日志摘要: newState.日志摘要 as any,
                    日志大纲: newState.日志大纲 as any
                });
                const beforeMissingOutline = new Set(beforePairingIssues.missingOutline);
                const beforeMissingSummary = new Set(beforePairingIssues.missingSummary);
                const introducedMissingOutline = afterPairingIssues.missingOutline.filter((index) => !beforeMissingOutline.has(index));
                const introducedMissingSummary = afterPairingIssues.missingSummary.filter((index) => !beforeMissingSummary.has(index));

                const beforeInvariantSet = new Set(
                    validateStateInvariants(stateWithUserLog).map((issue) => `${issue.code}:${issue.path}:${issue.message}`)
                );
                const introducedInvariantIssues = validateStateInvariants(newState).filter(
                    (issue) => !beforeInvariantSet.has(`${issue.code}:${issue.path}:${issue.message}`)
                );

                if (
                    introducedMissingOutline.length > 0
                    || introducedMissingSummary.length > 0
                    || introducedInvariantIssues.length > 0
                ) {
                    const rollbackDetail = [
                        introducedMissingOutline.length > 0
                            ? `missingOutline=${introducedMissingOutline.length}`
                            : '',
                        introducedMissingSummary.length > 0
                            ? `missingSummary=${introducedMissingSummary.length}`
                            : '',
                        introducedInvariantIssues.length > 0
                            ? `invariants=${introducedInvariantIssues.length}`
                            : ''
                    ].filter(Boolean).join('；');
                    const rollbackLog: LogEntry = {
                        id: generateLegacyId(),
                        sender: '系统',
                        text: `回合事务回滚：检测到不一致写入（${rollbackDetail || 'unknown'}）。`,
                        timestamp: Date.now(),
                        type: 'system'
                    };
                    newState = {
                        ...stateWithUserLog,
                        日志: [...(stateWithUserLog.日志 || []), rollbackLog]
                    };
                }
            }
            if (commandSystemLogs.length > 0) {
                newState = {
                    ...newState,
                    日志: [...(newState.日志 || []), ...commandSystemLogs]
                };
            }
            const wearAction = contextType === 'ACTION' ? classifyDurabilityAction(input) : null;
            if (wearAction) {
                newState = applyDurabilityWear(newState, wearAction);
            }
            if (contextType === 'ACTION' && interactionNpcIndices.length > 0) {
                newState = ensureNpcInteractionContinuity(
                    stateWithUserLog,
                    newState,
                    interactionNpcIndices,
                    input,
                    logsForService
                );
            }

            let ipEnrichmentApplied = false;
            let ipEnrichmentProfileId = '';
            if (shouldRunIpEnrichment) {
                const enrichmentResult = applyFamousIpFirstTurnEnrichment(newState, firstTurnIpProfile);
                if (enrichmentResult.applied) {
                    newState = enrichmentResult.state;
                    ipEnrichmentApplied = true;
                    ipEnrichmentProfileId = enrichmentResult.profileId || '';
                }
            }
            if ((stateWithUserLog.回合数 || 1) <= 1) {
                newState = syncInventorySheetWithState(newState);
            }

            newState = reconcileEquipmentWithInventory(newState);

            const newLogs: LogEntry[] = [];
            const aiLogGameTime = newState.游戏时间;
            const npcNameSet = new Set(
                (newState.社交 || [])
                    .map((npc: any) => String(npc?.姓名 || '').trim().toLowerCase())
                    .filter(Boolean)
            );
            const canonicalizeLogSender = (rawSender: unknown): string => {
                const sender = String(rawSender ?? '').trim();
                if (!sender) return '';
                const key = sender.toLowerCase();
                // 仅对白名单别名做映射；若与 NPC 实名冲突，则保留原 sender，避免误判为 narrator/system。
                if (!npcNameSet.has(key) && (key === 'narrative' || key === 'narrator' || key === '旁白')) return '旁白';
                return sender;
            };

            if (logs.length > 0) {
                logs.forEach((l, idx) => {
                    const sender = canonicalizeLogSender((l as any)?.sender);
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
            }
            if (blockedStoryLogWrites > 0) {
                newLogs.push({
                    id: generateLegacyId(),
                    text: `[MEM_BOUNDARY_001] 已拦截主叙事写入 LOG_Summary/LOG_Outline 的指令 ${blockedStoryLogWrites} 条，仅允许 memory 服务写入日志表。`,
                    sender: '系统',
                    timestamp: Date.now() + 700,
                    turnIndex,
                    gameTime: aiLogGameTime,
                    responseId,
                    snapshot: responseSnapshot
                });
            }
            if (ipEnrichmentApplied) {
                newLogs.push({
                    id: generateLegacyId(),
                    text: `系统已完成角色IP资料补全：${ipEnrichmentProfileId}（服装/常用物品/武器）`,
                    sender: '系统',
                    timestamp: Date.now() + 999,
                    turnIndex,
                    gameTime: aiLogGameTime,
                    responseId,
                    snapshot: responseSnapshot
                });
            }

            newState.日志 = [...newState.日志, ...newLogs];
            newState.处理中 = false;
            newState.回合数 = (stateWithUserLog.回合数 || 1) + 1;
            nextStateForPhoneSync = newState;
            setGameState(newState);

            if (aiResponse.phone_sync_plan && nextStateForPhoneSync) {
                enqueuePhoneSyncPlan(aiResponse.phone_sync_plan, nextStateForPhoneSync);
            }

            if (nextStateForPhoneSync && isMicroserviceMode()) {
                const meta = {
                    playerInput: input,
                    logs: logsForService,
                    appliedCommands: filteredCommandsForService,
                    turnIndex
                };
                const npcNames = (nextStateForPhoneSync.社交 || []).map(c => c.姓名).filter(Boolean);
                const logText = logsForService.map(l => l.text).join('\n');
                const mentionedNpc = npcNames.some(name => logText.includes(name));
                const inputMentionsNpc = npcNames.some(name => input.includes(name));
                const locationChanged = baseState.当前地点 !== nextStateForPhoneSync.当前地点;
                const hasTracking = Array.isArray(nextStateForPhoneSync.世界?.NPC后台跟踪) && nextStateForPhoneSync.世界?.NPC后台跟踪.length > 0;
                const presenceChanged = (nextStateForPhoneSync.社交 || []).some((npc, idx) => {
                    const prevNpc = baseState.社交?.[idx];
                    return prevNpc?.是否在场 !== npc?.是否在场;
                });
                const socialChanged = (nextStateForPhoneSync.社交 || []).some((npc, idx) => {
                    const prevNpc = baseState.社交?.[idx];
                    const prevMem = prevNpc?.记忆?.length ?? 0;
                    const nextMem = npc?.记忆?.length ?? 0;
                    if (nextMem !== prevMem) return true;
                    return prevNpc?.好感度 !== npc?.好感度 || prevNpc?.关系状态 !== npc?.关系状态;
                });
                const hasNpcSignal = mentionedNpc
                    || inputMentionsNpc
                    || rawCommandSignals.hasSocialMutation
                    || filteredCommandSignals.hasSocialMutation
                    || rawCommandSignals.hasPresenceMutation
                    || filteredCommandSignals.hasPresenceMutation
                    || presenceChanged
                    || socialChanged
                    || interactionNpcIndices.length > 0;
                const shouldRunStateService = routingProfile.isMicroserviceMode
                    && contextType === 'ACTION'
                    && isServiceConfigured('state');
                const shouldRunMemoryService = routingProfile.isMicroserviceMode
                    && contextType === 'ACTION'
                    && isServiceConfigured('memory');
                // Single fill entry mode: disable dedicated fill services and let state+memory cover all tables.
                pushDebugToast(
                    'MS GATE',
                    `state=${shouldRunStateService ? 'Y' : 'N'} memory=${shouldRunMemoryService ? 'Y' : 'N'} npc=${mentionedNpc || inputMentionsNpc ? 'Y' : 'N'} track=${hasTracking ? 'Y' : 'N'} move=${locationChanged ? 'Y' : 'N'}`
                );
                if (shouldRunStateService) {
                    if (isStateUsingMemoryEndpoint()) {
                        pushPhoneNotification('状态填表已触发', '状态填表统一走 memory 接口。');
                    }
                    const stateInput = buildServiceInput('state', nextStateForPhoneSync, meta);
                    enqueueMicroserviceTask('state', stateInput, nextStateForPhoneSync, MICROSERVICE_PRIORITIES.state);
                }
                if (shouldRunMemoryService) {
                    enqueueMemoryFillJob(nextStateForPhoneSync, meta);
                }
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


    const updateConfidant = (
        id: string,
        updates: Partial<Confidant> & { 当前状态?: '在场' | '离场' | '死亡' | '失踪' }
    ) => {
        const normalizedUpdates: Partial<Confidant> & { 当前状态?: '在场' | '离场' | '死亡' | '失踪' } = { ...updates };
        if (typeof updates.是否在场 === 'boolean' && !updates.当前状态) {
            normalizedUpdates.当前状态 = updates.是否在场 ? '在场' : '离场';
        }
        if (typeof updates.当前状态 === 'string' && typeof updates.是否在场 !== 'boolean') {
            normalizedUpdates.是否在场 = updates.当前状态 === '在场';
        }
        setGameState(prev => ({ ...prev, 社交: prev.社交.map(c => c.id === id ? { ...c, ...normalizedUpdates } : c) }));
    };

    const stopInteraction = () => {
        abortActiveMemoryServiceRequests();
        abortActivePhoneServiceRequests();
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsProcessing(false);
        setIsStreaming(false);
        setGameState(prev => ({ ...prev, 处理中: false }));
        clearPendingCommands();
    };
    const handlePhoneSyncPlan = async (plan: any, baseState: GameState) => {
        const connectCheck = isPhoneConnected(baseState);
        if (!connectCheck.ok) return;
        if (!isPhoneApiConfigured(settings)) return;
        try {
            setIsPhoneProcessing(true);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope('sync');
            const input = `[PHONE_SYNC_PLAN]\n${JSON.stringify(plan)}`;
            const phoneResp = await runPhoneGenerationRequest(input, baseState, { cancelPrevious: false });
            if (!phoneResp.allowed) {
                if (phoneResp.blocked_reason) {
                    pushPhoneNotification('终端同步失败', phoneResp.blocked_reason);
                }
                return;
            }
            const fallbackPlayerName = baseState.角色?.姓名 || 'Player';
            setGameState(prev => {
                const playerName = prev.角色?.姓名 || fallbackPlayerName;
                return applyPhoneResponseToState(prev, phoneResp, playerName);
            });
        } catch (e) {
            if (isAbortError(e)) {
                return;
            }
            console.error('Phone sync plan failed', e);
        } finally {
            setIsPhoneProcessing(false);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope(null);
        }
    };
    const handleSendMessage = async (content: string, thread: PhoneThread) => {
        const trimmed = content.trim();
        if (!trimmed || !thread) return;
        const localCheck = isPhoneLocallyAvailable(gameState);
        if (!localCheck.ok) {
            alert(localCheck.reason || '当前无法使用手机');
            return;
        }
        const timestampValue = Date.now();
        const playerName = gameState.角色?.姓名 || 'Player';
        const newMsg: PhoneMessage = {
            id: '',
            发送者: playerName,
            内容: trimmed,
            时间戳: gameState.游戏时间 || '未知',
            timestampValue,
            类型: 'text',
            状态: 'sent'
        };
        let nextState: GameState | null = null;
        setGameState(prev => {
            const phoneState = getPhoneProjection(prev);
            const targetThread = findThreadById(phoneState, thread.id) || thread;
            const nextMessageId = generateNextId('Msg', targetThread.消息 || []);
            newMsg.id = nextMessageId;
            const commands: TavernCommand[] = [
                {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Threads',
                        keyField: 'thread_id',
                        rows: [toPhoneThreadSheetRow(targetThread)]
                    }
                },
                {
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Messages',
                        keyField: 'message_id',
                        rows: [toPhoneMessageSheetRow(newMsg, targetThread)]
                    }
                }
            ];
            const otherParty = targetThread.类型 === 'private'
                ? (targetThread.成员 || []).find(m => m && m !== playerName)
                : null;
            if (otherParty && !isPlayerReference(otherParty, playerName)) {
                commands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Contacts',
                        keyField: 'contact_id',
                        rows: [{
                            contact_id: otherParty,
                            name: otherParty,
                            bucket: 'friend',
                            blacklisted: false,
                            recent: true
                        }]
                    }
                });
            }
            nextState = applyPhoneTableMutations(prev, commands);
            return nextState;
        });
        if (!nextState) return;
        const otherParty = thread.类型 === 'private'
            ? (thread.成员 || []).find(m => m && m !== playerName) || thread.标题
            : thread.标题;
        const channelLabel = thread.类型 === 'private' ? '私信' : (thread.类型 === 'group' ? '群聊' : '公共频道');
        if (!isPhoneApiConfigured(settings)) {
            const finalState = appendPhoneMemoryEntries(nextState, [`【手机】与${otherParty}聊天：${trimmed}`]);
            setGameState(finalState);
            return;
        }
        try {
            setIsPhoneProcessing(true);
            setPhoneProcessingThreadId(thread.id);
            setPhoneProcessingScope('chat');
            const phoneInput = `[PHONE_CHAT]\n[手机/${channelLabel}] ${otherParty}: ${trimmed}`;
            const phoneResp = await runPhoneGenerationRequest(phoneInput, nextState);
            if (!phoneResp.allowed) {
                alert(phoneResp.blocked_reason || '当前剧情环境无法使用手机');
                setGameState(prev => {
                    const phoneState = getPhoneProjection(prev);
                    const context = findMessageContextById(phoneState, newMsg.id);
                    if (!context) return prev;
                    const failedMessage: PhoneMessage = { ...context.message, 状态: 'failed' };
                    const commands: TavernCommand[] = [{
                        action: 'upsert_sheet_rows',
                        value: {
                            sheetId: 'PHONE_Messages',
                            keyField: 'message_id',
                            rows: [toPhoneMessageSheetRow(failedMessage, context.thread)]
                        }
                    }];
                    return applyPhoneTableMutations(prev, commands);
                });
                return;
            }
            const adjustedResp = adjustPhoneResponseForChat(phoneResp, {
                threadId: thread.id,
                threadTitle: thread.标题,
                threadType: thread.类型
            });
            let finalState = applyPhoneResponseToState(nextState, adjustedResp, playerName);
            finalState = appendPhoneMemoryEntries(finalState, [`【手机】与${otherParty}聊天：${trimmed}`]);
            setGameState(finalState);
            requestThreadSummary(thread, finalState);
        } catch (e: any) {
            alert(`手机API调用失败: ${e.message || '未知错误'}`);
            setGameState(prev => appendPhoneMemoryEntries(prev, [`【手机】与${otherParty}聊天：${trimmed}`]));
        } finally {
            setIsPhoneProcessing(false);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope(null);
        }
    };
    const handleEditPhoneMessage = (id: string, content: string) => {
        if (!id) return;
        setGameState(prev => {
            const phoneState = getPhoneProjection(prev);
            const context = findMessageContextById(phoneState, id);
            if (!context) return prev;
            const editedMessage: PhoneMessage = { ...context.message, 内容: content };
            const commands: TavernCommand[] = [{
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'PHONE_Messages',
                    keyField: 'message_id',
                    rows: [toPhoneMessageSheetRow(editedMessage, context.thread)]
                }
            }];
            return applyPhoneTableMutations(prev, commands);
        });
    };
    const handleDeletePhoneMessage = (id: string) => {
        if (!id) return;
        setGameState(prev => {
            const commands: TavernCommand[] = [{
                action: 'delete_sheet_rows',
                value: {
                    sheetId: 'PHONE_Messages',
                    keyField: 'message_id',
                    rowIds: [id]
                }
            }];
            return applyPhoneTableMutations(prev, commands);
        });
    };

    const handlePlayerInput = (content: string) => {
        if (isProcessing) return;
        const queued = consumeCommandQueue();
        const commandPayload = queued.map(c => c.text);
        const commandBlock = commandPayload.length > 0
            ? `[用户指令]\n${commandPayload.join('\n')}\n[/用户指令]\n`
            : '';
        const aiInput = commandBlock ? `${commandBlock}${content}` : content;
        handleAIInteraction(aiInput, 'ACTION', commandPayload, undefined, false, content);
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
        const momentRow = toPhoneMomentSheetRow(newPost);
        if (!momentRow) return;
        const nextState = applyPhoneTableMutations(gameState, [{
            action: 'upsert_sheet_rows',
            value: {
                sheetId: 'PHONE_Moments',
                keyField: 'moment_id',
                rows: [momentRow]
            }
        }]);
        setGameState(nextState);
        const descText = imageDesc ? `（图片描述：${imageDesc}）` : '';
        if (!isPhoneApiConfigured(settings)) {
            const finalState = appendPhoneMemoryEntries(nextState, [`【手机】朋友圈发布：${content.trim()}`]);
            setGameState(finalState);
            return;
        }
        try {
            setIsPhoneProcessing(true);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope('moment');
            const phoneResp = await runPhoneGenerationRequest(`[PHONE_POST] 我在朋友圈发布动态：${content.trim()}${descText}`, nextState);
            if (!phoneResp.allowed) {
                alert(phoneResp.blocked_reason || '当前剧情环境无法使用手机');
                setGameState(prev => {
                    return applyPhoneTableMutations(prev, [{
                        action: 'delete_sheet_rows',
                        value: {
                            sheetId: 'PHONE_Moments',
                            keyField: 'moment_id',
                            rowIds: [postId]
                        }
                    }]);
                });
                return;
            }
            setGameState(prev => {
                let finalState = applyPhoneResponseToState(prev, phoneResp, gameState.角色?.姓名 || 'Player');
                finalState = appendPhoneMemoryEntries(finalState, [`【手机】朋友圈发布：${content.trim()}`]);
                return finalState;
            });
        } catch (e: any) {
            alert(`手机API调用失败: ${e.message || '未知错误'}`);
            setGameState(prev => appendPhoneMemoryEntries(prev, [`【手机】朋友圈发布：${content.trim()}`]));
        } finally {
            setIsPhoneProcessing(false);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope(null);
        }
    };
    const handleCreatePublicPost = async (payload: { title: string; content: string; imageDesc?: string; boardName?: string }) => {
        const title = payload?.title?.trim() || '';
        const content = payload?.content?.trim() || '';
        const imageDesc = payload?.imageDesc;
        const boardName = payload?.boardName?.trim() || '';
        if (!content) return;
        const localCheck = isPhoneLocallyAvailable(gameState);
        if (!localCheck.ok) {
            alert(localCheck.reason || '当前无法使用手机');
            return;
        }
        const timestampValue = Date.now();
        const postId = `Forum_${timestampValue}`;
        const newPost: ForumPost = {
            id: postId,
            标题: title || content.slice(0, 20),
            内容: content,
            发布者: gameState.角色.姓名 || 'Player',
            头像: gameState.角色.头像 || '',
            时间戳: gameState.游戏时间 || '未知',
            timestampValue,
            板块: boardName || '欧拉丽快报',
            点赞数: 0,
            回复: [],
            图片描述: imageDesc || undefined,
            话题标签: boardName ? [boardName] : undefined
        };
        const boardLabel = newPost.板块 || '欧拉丽快报';
        const boardRow = toForumBoardSheetRow({ 名称: boardLabel });
        const postRow = toForumPostSheetRow(newPost);
        if (!postRow) return;
        const commands: TavernCommand[] = [];
        if (boardRow) {
            commands.push({
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'FORUM_Boards',
                    keyField: 'board_id',
                    rows: [boardRow]
                }
            });
        }
        commands.push({
            action: 'upsert_sheet_rows',
            value: {
                sheetId: 'FORUM_Posts',
                keyField: 'post_id',
                rows: [postRow]
            }
        });
        const nextState = applyPhoneTableMutations(gameState, commands);
        setGameState(nextState);
        const descText = imageDesc ? `（图片描述：${imageDesc}）` : '';
        const topicText = boardName ? `（板块：${boardName}）` : '';
        if (!isPhoneApiConfigured(settings)) {
            let finalState = appendPhoneMemoryEntries(nextState, [`【手机】论坛发布：${title || content}`]);
            setGameState(finalState);
            handleWorldInfoUpdate(`论坛动态：${title || content}`, finalState);
            return;
        }
        try {
            setIsPhoneProcessing(true);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope('forum');
            const phoneResp = await runPhoneGenerationRequest(`[PHONE_POST] 我在公共论坛发布帖子：【${title || content}】${content}${descText}${topicText}`, nextState);
            if (!phoneResp.allowed) {
                alert(phoneResp.blocked_reason || '当前剧情环境无法使用手机');
                setGameState(prev => {
                    return applyPhoneTableMutations(prev, [{
                        action: 'delete_sheet_rows',
                        value: {
                            sheetId: 'FORUM_Posts',
                            keyField: 'post_id',
                            rowIds: [postId]
                        }
                    }]);
                });
                return;
            }
            let updatedState: GameState | null = null;
            setGameState(prev => {
                let finalState = applyPhoneResponseToState(prev, phoneResp, gameState.角色?.姓名 || 'Player');
                finalState = appendPhoneMemoryEntries(finalState, [`【手机】论坛发布：${title || content}`]);
                updatedState = finalState;
                return finalState;
            });
            if (updatedState) {
                handleWorldInfoUpdate(`论坛动态：${title || content}`, updatedState);
            }
        } catch (e: any) {
            alert(`手机API调用失败: ${e.message || '未知错误'}`);
            setGameState(prev => appendPhoneMemoryEntries(prev, [`【手机】论坛发布：${title || content}`]));
            handleWorldInfoUpdate(`论坛动态：${title || content}`, nextState);
        } finally {
            setIsPhoneProcessing(false);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope(null);
        }
    };
    const handleLikeForumPost = (postId: string) => {
        if (!postId) return;
        setGameState(prev => {
            const projection = getPhoneProjection(prev);
            const target = (projection.公共帖子?.帖子 || []).find(post => post.id === postId);
            if (!target) return prev;
            const updated = { ...target, 点赞数: (target.点赞数 || 0) + 1 };
            const row = toForumPostSheetRow(updated);
            if (!row) return prev;
            return applyPhoneTableMutations(prev, [{
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'FORUM_Posts',
                    keyField: 'post_id',
                    rows: [row]
                }
            }]);
        });
    };
    const prepareForumStateForGeneration = (state: GameState): { state: GameState; cleared: boolean } => {
        const projection = getPhoneProjection(state);
        const posts = projection?.公共帖子?.帖子 || [];
        if (posts.length < 20) {
            return { state, cleared: false };
        }
        const postRowIds = posts.map(post => String(post.id || '').trim()).filter(Boolean);
        const replyRowIds = posts.flatMap(post => {
            const replies = Array.isArray(post?.回复) ? post.回复 : [];
            return replies.map(reply => String(reply?.id || '').trim()).filter(Boolean);
        });
        const commands: TavernCommand[] = [];
        if (replyRowIds.length > 0) {
            commands.push({
                action: 'delete_sheet_rows',
                value: {
                    sheetId: 'FORUM_Replies',
                    keyField: 'reply_id',
                    rowIds: replyRowIds
                }
            });
        }
        if (postRowIds.length > 0) {
            commands.push({
                action: 'delete_sheet_rows',
                value: {
                    sheetId: 'FORUM_Posts',
                    keyField: 'post_id',
                    rowIds: postRowIds
                }
            });
        }
        const nextState = commands.length > 0 ? applyPhoneTableMutations(state, commands) : state;
        return { state: nextState, cleared: true };
    };
    const convertPublicMessagesToForumPosts = (messages: any[] | undefined, state: GameState): ForumPost[] => {
        if (!Array.isArray(messages) || messages.length === 0) return [];
        const now = Date.now();
        const timeLabel = state.游戏时间 || '未知';
        return messages.map((raw, index) => {
            const threadType = String(raw?.thread_type || raw?.threadType || raw?.type || '').toLowerCase();
            if (threadType !== 'public') return null;
            const content = String(raw?.content || raw?.内容 || '').trim();
            if (!content) return null;
            const sender = String(raw?.sender || raw?.发送者 || '匿名冒险者').trim() || '匿名冒险者';
            const title = String(raw?.title || raw?.标题 || raw?.thread_title || raw?.threadTitle || '')
                .trim() || content.slice(0, 20) || `论坛讨论${index + 1}`;
            const board = resolveFixedForumBoardName(
                raw?.board_name || raw?.boardName || raw?.板块,
                raw?.board_id || raw?.boardId
            );
            const tags = Array.isArray(raw?.tags)
                ? raw.tags
                : Array.isArray(raw?.话题标签)
                    ? raw.话题标签
                    : undefined;
            return {
                id: String(raw?.post_id || raw?.postId || `Forum_Auto_${now}_${index + 1}`),
                标题: title,
                内容: content,
                发布者: sender,
                头像: String(raw?.avatar || raw?.头像 || ''),
                时间戳: timeLabel,
                timestampValue: now + index,
                板块: board,
                点赞数: Number.isFinite(raw?.likes) ? Number(raw.likes) : (Number.isFinite(raw?.点赞数) ? Number(raw.点赞数) : 0),
                回复: [],
                话题标签: tags,
                图片描述: String(raw?.image_desc || raw?.图片描述 || '') || undefined
            } as ForumPost;
        }).filter((post): post is ForumPost => !!post);
    };
    const buildForumPendingReplyBlock = () => {
        const pending = forumPendingUserReplyQueueRef.current;
        if (!pending || pending.length === 0) return '';
        const lines = pending.slice(0, 8).map((item, idx) => (
            `${idx + 1}. 帖子《${item.postTitle}》[${item.boardName}] 用户回复：${item.replyContent}（时间：${item.replyTime}）`
        ));
        return ['[FORUM_PENDING_REPLIES]', ...lines].join('\n');
    };

    const handleReplyForumPost = async (payload: { postId: string; content: string }) => {
        const postId = payload?.postId;
        const content = payload?.content?.trim();
        if (!postId || !content) return;
        const localCheck = isPhoneLocallyAvailable(gameState);
        if (!localCheck.ok) {
            alert(localCheck.reason || '当前无法使用手机');
            return;
        }
        const replyId = `Reply_${Date.now()}`;
        const reply: ForumReply = {
            id: replyId,
            楼层: 1,
            发布者: gameState.角色?.姓名 || 'Player',
            内容: content,
            时间戳: gameState.游戏时间 || '未知'
        };
        let repliedState: GameState | null = null;
        setGameState(prev => {
            const projection = getPhoneProjection(prev);
            const targetPost = (projection.公共帖子?.帖子 || []).find(post => post.id === postId);
            if (!targetPost) return prev;
            const floor = (Array.isArray(targetPost.回复) ? targetPost.回复.length : 0) + 1;
            const replyRow = toForumReplySheetRow({ ...reply, 楼层: floor }, postId, floor);
            if (!replyRow) return prev;
            let nextState = applyPhoneTableMutations(prev, [{
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'FORUM_Replies',
                    keyField: 'reply_id',
                    rows: [replyRow]
                }
            }]);
            nextState = appendPhoneMemoryEntries(nextState, [`【手机】论坛回复：${content}`]);
            repliedState = nextState;
            return nextState;
        });
        if (!repliedState) return;
        const repliedProjection = getPhoneProjection(repliedState);
        const targetPost = repliedProjection.公共帖子?.帖子?.find(post => post.id === postId);
        const targetTitle = targetPost?.标题 || '未知帖子';
        const targetBoard = targetPost?.板块 || '欧拉丽快报';
        forumPendingUserReplyQueueRef.current = [
            ...forumPendingUserReplyQueueRef.current.filter(item => item.replyId !== replyId),
            {
                replyId,
                postId,
                postTitle: targetTitle,
                boardName: targetBoard,
                replyContent: content,
                replyTime: repliedState.游戏时间 || '未知'
            }
        ].slice(-20);
        if (!isPhoneApiConfigured(settings)) return;
        try {
            setIsPhoneProcessing(true);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope('forum');
            const prompt = `[PHONE_POST] 我在公共论坛回复帖子：【${targetTitle}】（板块：${targetBoard}）回复内容：${content}`;
            const phoneResp = await runPhoneGenerationRequest(prompt, repliedState, { cancelPrevious: false });
            if (!phoneResp.allowed) {
                return;
            }
            setGameState(prev => applyPhoneResponseToState(prev, phoneResp, prev.角色?.姓名 || 'Player'));
        } catch (error) {
            if (isAbortError(error)) {
                return;
            }
            console.error('Forum reply follow-up generation failed', error);
        } finally {
            setIsPhoneProcessing(false);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope(null);
        }
    };
    const handleAutoForumGeneration = async (
        stateOverride?: GameState,
        trigger: 'manual' | 'auto' = 'auto'
    ) => {
        const baseState = stateOverride || gameState;
        const isManualTrigger = trigger === 'manual';
        if (forumAutoInFlightRef.current) {
            if (isManualTrigger) {
                pushPhoneNotification('论坛刷新繁忙', '上一次论坛刷新尚未完成，请稍后重试。');
            }
            return;
        }
        if (isPhoneProcessing) {
            if (isManualTrigger) {
                pushPhoneNotification('论坛刷新繁忙', '手机任务处理中，请等待当前任务结束后再刷新。');
            }
            return;
        }
        if (isProcessing) {
            if (isManualTrigger) {
                pushPhoneNotification('论坛刷新繁忙', '主线处理中，请稍后再刷新论坛。');
            }
            return;
        }
        if (!baseState.手机) {
            pushPhoneNotification('论坛刷新失败', '手机状态不可用，无法刷新论坛。');
            return;
        }
        if (!isPhoneApiConfigured(settings)) {
            pushPhoneNotification('论坛刷新失败', '未配置手机 AI 服务，无法生成论坛帖子。');
            return;
        }
        forumAutoInFlightRef.current = true;
        try {
            setIsPhoneProcessing(true);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope('forum');
            const prepared = prepareForumStateForGeneration(baseState);
            const seedState = prepared.state;
            if (prepared.cleared) {
                setGameState(seedState);
            }
            const pendingReplyBlock = buildForumPendingReplyBlock();
            const prompt = [
                '[PHONE_POST]',
                '[FORUM_AUTO]',
                `当前回合：${seedState.回合数 || 0}`,
                prepared.cleared ? '论坛帖子达到20条，已清空旧帖，请生成新的公共论坛内容。' : '请生成新的公共论坛内容。',
                '论坛分组固定为：欧拉丽快报、地下城攻略、眷族招募、酒馆闲谈。',
                '每次更新时：只更新任意3个分组；每个分组生成2-3个帖子；每个帖子必须包含3-4条模拟回复。',
                pendingReplyBlock
                    ? '若存在 [FORUM_PENDING_REPLIES]，必须在本轮输出中优先对这些用户回帖生成2-3条跟帖回应，再生成其他新帖。'
                    : '若不存在待优先回帖，则按分组规则正常生成。',
                pendingReplyBlock || '',
                '输出优先使用 phone_updates.公共帖子.帖子 或 tavern_commands 写入 gameState.手机.公共帖子.帖子；不要把论坛内容写到公共频道消息。'
            ].join('\n');
            const phoneResp = await runPhoneGenerationRequest(prompt, seedState, { cancelPrevious: false });
            if (!phoneResp.allowed) {
                const reason = String(phoneResp.blocked_reason || '').trim() || '手机服务返回不允许生成论坛内容。';
                if (isManualTrigger) {
                    pushPhoneNotification('论坛刷新被拒绝', reason);
                }
                return;
            }
            const fallbackForumPosts = convertPublicMessagesToForumPosts(phoneResp.messages, seedState);
            const forumScopedResponse: PhoneAIResponse = {
                ...phoneResp,
                messages: Array.isArray(phoneResp.messages)
                    ? phoneResp.messages.filter(raw => String(raw?.thread_type || raw?.threadType || raw?.type || '').toLowerCase() !== 'public')
                    : phoneResp.messages
            };
            let fallbackApplied = false;
            let noForumOutput = false;
            setGameState(prev => {
                const normalizedBase = prepareForumStateForGeneration(prev).state;
                const beforeCount = getPhoneProjection(normalizedBase).公共帖子?.帖子?.length || 0;
                let nextState = applyPhoneResponseToState(normalizedBase, forumScopedResponse, normalizedBase.角色?.姓名 || 'Player');
                const afterCount = getPhoneProjection(nextState).公共帖子?.帖子?.length || 0;
                if (afterCount <= beforeCount) {
                    if (fallbackForumPosts.length > 0) {
                        const boardRows = Array.from(new Set(fallbackForumPosts.map((post) => String(post?.板块 || '').trim()).filter(Boolean)))
                            .map((name) => toForumBoardSheetRow({ 名称: name }))
                            .filter((row: Record<string, unknown> | null): row is Record<string, unknown> => !!row);
                        const postRows = fallbackForumPosts
                            .map((post) => toForumPostSheetRow(post))
                            .filter((row: Record<string, unknown> | null): row is Record<string, unknown> => !!row);
                        const commands: TavernCommand[] = [];
                        if (boardRows.length > 0) {
                            commands.push({
                                action: 'upsert_sheet_rows',
                                value: {
                                    sheetId: 'FORUM_Boards',
                                    keyField: 'board_id',
                                    rows: boardRows
                                }
                            });
                        }
                        if (postRows.length > 0) {
                            commands.push({
                                action: 'upsert_sheet_rows',
                                value: {
                                    sheetId: 'FORUM_Posts',
                                    keyField: 'post_id',
                                    rows: postRows
                                }
                            });
                        }
                        if (commands.length > 0) {
                            nextState = applyPhoneTableMutations(nextState, commands);
                            fallbackApplied = true;
                        } else {
                            noForumOutput = true;
                        }
                    } else {
                        noForumOutput = true;
                    }
                }
                return nextState;
            });
            if (fallbackApplied) {
                pushPhoneNotification('论坛刷新兼容转换', 'AI返回公共频道消息，已转为论坛帖子。');
            }
            if (noForumOutput) {
                console.warn('Auto forum generation produced no forum posts', {
                    rawResponse: phoneResp.rawResponse,
                    repairNote: phoneResp.repairNote
                });
                pushPhoneNotification('论坛刷新未生成新帖', 'AI返回内容未包含论坛帖子，请检查 phone 服务输出格式。');
            } else if (forumPendingUserReplyQueueRef.current.length > 0) {
                forumPendingUserReplyQueueRef.current = [];
            }
        } catch (error) {
            if (isAbortError(error)) {
                if (isManualTrigger) {
                    pushPhoneNotification('论坛刷新已取消', '本次论坛刷新被新请求中断，可重试一次。');
                }
                return;
            }
            console.error('Auto forum generation failed', error);
            if (isManualTrigger) {
                const reason = error instanceof Error ? error.message : '未知错误';
                pushPhoneNotification('论坛刷新失败', reason);
            }
        } finally {
            setIsPhoneProcessing(false);
            setPhoneProcessingThreadId(null);
            setPhoneProcessingScope(null);
            forumAutoInFlightRef.current = false;
        }
    };
    const handleManualForumRefresh = () => {
        void handleAutoForumGeneration(gameState, 'manual');
    };
    const handleWaitForPhoneReply = (thread?: PhoneThread | null) => {
        if (!thread || isProcessing) return;
        const target = thread.标题 || '对方';
        const waitText = thread.类型 === 'public'
            ? `我等待公共频道【${target}】的回复。`
            : thread.类型 === 'group'
                ? `我等待群聊【${target}】的回复。`
                : `我等待${target}的回复。`;
        handleAIInteraction(`（等待手机回复）${waitText}`, 'ACTION');
    };
    const handleCreateThread = (payload: { type: 'private' | 'group' | 'public'; title: string; members: string[] }) => {
        const title = normalizePhoneThreadTitle(payload.title);
        if (!title) return;
        setGameState(prev => {
            const phoneState = getPhoneProjection(prev);
            const allThreads = [
                ...(phoneState.对话?.私聊 || []),
                ...(phoneState.对话?.群聊 || []),
                ...(phoneState.对话?.公共频道 || [])
            ];
            const exists = allThreads.some((t: PhoneThread) => {
                return normalizePhoneThreadType(t.类型) === normalizePhoneThreadType(payload.type)
                    && normalizePhoneThreadTitle(t.标题).toLowerCase() === title.toLowerCase();
            });
            if (exists) return prev;
            const nextThreadId = generatePhoneThreadId(phoneState.对话 || { 私聊: [], 群聊: [], 公共频道: [] });
            const newThread: PhoneThread = {
                id: nextThreadId,
                类型: payload.type,
                标题: title,
                成员: Array.isArray(payload.members) && payload.members.length > 0 ? payload.members : [title],
                消息: [],
                未读: 0
            };
            return applyPhoneTableMutations(prev, [{
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'PHONE_Threads',
                    keyField: 'thread_id',
                    rows: [toPhoneThreadSheetRow(newThread)]
                }
            }]);
        });
    };
    const handleWorldInfoUpdate = async (
        reason: string,
        stateOverride?: GameState,
        options?: { mapTargetLocationName?: string }
    ) => {
        // NOTE: World/Map updates run independently of main narrative (isProcessing).
        // Only skip if another world update is already in-flight.
        if (silentUpdateInFlight.current) {
            pushDebugToast('WORLD', 'skip: in-flight');
            return;
        }
        silentUpdateInFlight.current = true;
        setIsMapUpdating(true);
        const baseState = stateOverride || gameState;
        const input = reason ? `【系统】世界情报更新：${reason}` : '【系统】世界情报静默更新';
        const isMapRequest = /Tactical Map|Visual Layout|地图数据|战术地图/i.test(input);
        const requestedMapLocationName = options?.mapTargetLocationName || resolvePreferredMapLocationName(baseState);
        const runUpdate = async () => {
            pushDebugToast('WORLD', `update start: ${reason || 'silent'}`);
            try {
                const useWorldService = isMicroserviceMode()
                    && isServiceConfigured('state')
                    && !isMapRequest;
                const mapServiceConfigured = isServiceConfigured('map');
                appendDebugLog({
                    hid: 'H1',
                    loc: 'hooks/useGameLogic.ts:handleWorldInfoUpdate',
                    msg: 'world info update start',
                    data: {
                        reason,
                        input,
                        isMapRequest,
                        requestedMapLocationName,
                        useWorldService,
                        mapServiceConfigured,
                        triadOnly: true,
                        isMicroservice: isMicroserviceMode()
                    }
                });
                let aiResponse: any;
                if (useWorldService && isServiceConfigured('world')) {
                    const result = await generateServiceCommands('world', input, baseState, settings);
                    aiResponse = {
                        tavern_commands: result.tavern_commands,
                        logs: [],
                        rawResponse: result.rawResponse,
                        repairNote: result.repairNote
                    };
                } else {
                    aiResponse = await generateWorldInfoResponse(
                        input,
                        baseState,
                        settings,
                        undefined,
                        undefined
                    );
                }
                const debugCommands = Array.isArray(aiResponse.tavern_commands) ? aiResponse.tavern_commands : [];
                const commandSummary = debugCommands.map(cmd => ({
                    action: (cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? (cmd as any)?.name,
                    key: (cmd as any)?.key ?? (cmd as any)?.path
                }));
                const hasMapCommand = debugCommands.some(cmd => {
                    const action = (cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? (cmd as any)?.name;
                    return action === 'upsert_exploration_map' || action === 'set_map_visuals';
                });
                appendDebugLog({
                    hid: 'H2',
                    loc: 'hooks/useGameLogic.ts:handleWorldInfoUpdate',
                    msg: 'world info update command summary',
                    data: {
                        count: debugCommands.length,
                        hasMapCommand,
                        rawResponseChars: typeof aiResponse.rawResponse === 'string' ? aiResponse.rawResponse.length : 0,
                        actions: commandSummary.slice(0, 12)
                    }
                });
                let nextStateForPhoneSync: GameState | null = null;
                setGameState(prev => {
                    const rawCommands = Array.isArray(aiResponse.tavern_commands) ? aiResponse.tavern_commands : [];
                    const phoneSyncEnabled = !!aiResponse.phone_sync_plan && isPhoneApiConfigured(settings);
                    const shouldStripPhoneWrites = phoneSyncEnabled || shouldStripStoryPhoneWrites();
                    let commands = shouldStripPhoneWrites
                        ? stripPhoneCommands(rawCommands)
                        : rawCommands;

                    if (isMapRequest) {
                        const locationHint = requestedMapLocationName || resolvePreferredMapLocationName(prev);
                        commands = commands.map((cmd) => normalizeExplorationMapCommand(cmd as TavernCommand, locationHint));
                        const hasUpsertMap = commands.some((cmd: any) => {
                            const action = cmd?.action ?? cmd?.type ?? cmd?.command ?? cmd?.name ?? cmd?.mode;
                            return action === 'upsert_exploration_map';
                        });
                        if (!hasUpsertMap) {
                            const fallbackMapCmd = buildFallbackExplorationMapCommand(prev, locationHint);
                            commands = [...commands, fallbackMapCmd];
                            appendDebugLog({
                                hid: 'H2',
                                loc: 'hooks/useGameLogic.ts:handleWorldInfoUpdate',
                                msg: 'map request auto-injected fallback upsert_exploration_map',
                                data: {
                                    reason,
                                    locationHint
                                }
                            });
                        }
                    }

                    const { newState } = applyCommandsWithTurnTransaction(prev, commands);
                    let finalState = newState;

                    if (isMapRequest) {
                        const locationHint = requestedMapLocationName || resolvePreferredMapLocationName(finalState);
                        if (!hasRenderableStructureForLocation(finalState, locationHint)) {
                            const fallbackMapCmd = buildFallbackExplorationMapCommand(finalState, locationHint);
                            const fallbackResult = applyCommandsWithTurnTransaction(finalState, [fallbackMapCmd]);
                            finalState = fallbackResult.newState;
                            appendDebugLog({
                                hid: 'H2',
                                loc: 'hooks/useGameLogic.ts:handleWorldInfoUpdate',
                                msg: 'map structure missing after AI commands, fallback applied',
                                data: {
                                    reason,
                                    locationHint
                                }
                            });
                        }
                    }

                    finalState.处理中 = false;
                    nextStateForPhoneSync = finalState;
                    return finalState;
                });
                setDebugLast('__DXC_WORLD_LAST', {
                    ts: Date.now(),
                    tavern_commands: aiResponse.tavern_commands,
                    rawResponse: aiResponse.rawResponse,
                    repairNote: aiResponse.repairNote
                });
                pushDebugToast('WORLD', `update cmds=${Array.isArray(aiResponse.tavern_commands) ? aiResponse.tavern_commands.length : 0}`);
                if (aiResponse.phone_sync_plan && nextStateForPhoneSync) {
                    enqueuePhoneSyncPlan(aiResponse.phone_sync_plan, nextStateForPhoneSync);
                }
            } catch (e) {
                const message = e instanceof Error ? e.message : 'unknown error';
                setDebugLast('__DXC_WORLD_LAST', {
                    ts: Date.now(),
                    error: message
                });
                pushDebugToast('WORLD', `update error: ${message}`);
                console.error('World info update failed', e);
            } finally {
                silentUpdateInFlight.current = false;
                setIsMapUpdating(false);
            }
        };
        if (isMicroserviceMode()) {
            microserviceQueueRef.current.enqueue(runUpdate, {
                priority: isMapRequest ? MICROSERVICE_PRIORITIES.map : MICROSERVICE_PRIORITIES.world,
                lane: isMapRequest ? 'map' : 'world'
            });
        } else {
            await runUpdate();
        }
    };
    const handleMarkThreadRead = useCallback((threadId: string) => {
        if (!threadId) return;
        setGameState(prev => {
            const phoneState = getPhoneProjection(prev);
            const targetThread = findThreadById(phoneState, threadId);
            if (!targetThread) return prev;
            const messages = Array.isArray(targetThread.消息) ? targetThread.消息 : [];
            const hasUnread = (targetThread.未读 || 0) > 0;
            const receivedMessages = messages.filter((message) => message.状态 === 'received');
            if (!hasUnread && receivedMessages.length === 0) return prev;

            const commands: TavernCommand[] = [{
                action: 'upsert_sheet_rows',
                value: {
                    sheetId: 'PHONE_Threads',
                    keyField: 'thread_id',
                    rows: [toPhoneThreadSheetRow({ ...targetThread, 未读: 0 })]
                }
            }];
            if (receivedMessages.length > 0) {
                commands.push({
                    action: 'upsert_sheet_rows',
                    value: {
                        sheetId: 'PHONE_Messages',
                        keyField: 'message_id',
                        rows: receivedMessages.map((message) => toPhoneMessageSheetRow({ ...message, 状态: 'read' }, targetThread))
                    }
                });
            }
            return applyPhoneTableMutations(prev, commands);
        });
    }, [setGameState]);

    const resolveWorldUpdateInterval = (systemSettings?: SystemSettings) => {
        return resolveWorldCadenceInterval(systemSettings);
    };

    const resolveForumAutoInterval = (systemSettings?: SystemSettings) => {
        return resolveForumCadenceInterval(systemSettings);
    };

    const handleSilentWorldUpdate = async (targetLocationName?: unknown) => {
        const explicitLocationName = typeof targetLocationName === 'string' ? targetLocationName : '';
        const locationName = explicitLocationName || resolvePreferredMapLocationName(gameState);
        const updateReason = `请求生成详细的战术地图数据(Tactical Map SVG Layout)，并返回 upsert_exploration_map 写入 ${locationName} 的 MapStructureJSON`;
        appendDebugLog({
            hid: 'H1',
            loc: 'hooks/useGameLogic.ts:handleSilentWorldUpdate',
            msg: 'silent world update trigger',
            data: {
                reason: updateReason,
                currentTurn: gameState.回合数,
                nextTurn: gameState.世界?.下次更新回合
            }
        });
        await handleWorldInfoUpdate(updateReason, gameState, { mapTargetLocationName: locationName });
    };

    useEffect(() => {
        const systemSettings = gameState.系统设置 || settings.系统设置;
        const interval = resolveWorldUpdateInterval(systemSettings);
        const currentTurn = typeof gameState.回合数 === 'number' ? gameState.回合数 : 0;
        const nextTurn = gameState.世界?.下次更新回合;

        if (lastWorldIntervalRef.current !== interval) {
            lastWorldIntervalRef.current = interval;
            lastWorldUpdateRef.current = null;
            if (!interval || interval <= 0) {
                if (nextTurn !== null && nextTurn !== undefined) {
                    setGameState(prev => ({
                        ...prev,
                        世界: {
                            ...prev.世界,
                            下次更新回合: undefined
                        }
                    }));
                }
                return;
            }
            const desired = currentTurn + interval;
            if (nextTurn !== desired) {
                setGameState(prev => ({
                    ...prev,
                    世界: {
                        ...prev.世界,
                        下次更新回合: desired
                    }
                }));
            }
            return;
        }

        if (!interval || interval <= 0) {
            if (nextTurn !== null && nextTurn !== undefined) {
                setGameState(prev => ({
                    ...prev,
                    世界: {
                        ...prev.世界,
                        下次更新回合: undefined
                    }
                }));
            }
            return;
        }

        if (typeof nextTurn !== 'number' || !Number.isFinite(nextTurn)) {
            const desired = currentTurn + interval;
            setGameState(prev => ({
                ...prev,
                世界: {
                    ...prev.世界,
                    下次更新回合: desired
                }
            }));
            return;
        }

        if (currentTurn >= nextTurn && lastWorldUpdateRef.current !== nextTurn) {
            lastWorldUpdateRef.current = nextTurn;
            pushDebugToast('WORLD', `due: turn=${currentTurn} next=${nextTurn}`);
            void handleSilentWorldUpdate().catch((error) => {
                console.error('Silent world update failed', error);
                pushDebugToast('WORLD', 'update failed');
                setError('世界静默更新失败');
            });
            const desired = currentTurn + interval;
            if (desired !== nextTurn) {
                setGameState(prev => ({
                    ...prev,
                    世界: {
                        ...prev.世界,
                        下次更新回合: desired
                    }
                }));
            }
        }
    }, [
        gameState.回合数,
        gameState.世界?.下次更新回合,
        gameState.系统设置?.世界更新间隔回合,
        gameState.系统设置?.更新频率,
        settings.系统设置?.世界更新间隔回合,
        settings.系统设置?.更新频率
    ]);

    useEffect(() => {
        const systemSettings = gameState.系统设置 || settings.系统设置;
        const interval = resolveForumAutoInterval(systemSettings);
        const currentTurn = typeof gameState.回合数 === 'number' ? gameState.回合数 : 0;
        if (!interval || interval <= 0 || currentTurn <= 0) return;
        if (currentTurn % interval !== 0) return;
        if (lastForumAutoTurnRef.current === currentTurn) return;
        lastForumAutoTurnRef.current = currentTurn;
        void handleAutoForumGeneration(gameState, 'auto');
    }, [
        gameState.回合数,
        gameState.系统设置?.世界更新间隔回合,
        gameState.系统设置?.更新频率,
        settings.系统设置?.世界更新间隔回合,
        settings.系统设置?.更新频率,
        settings.aiConfig?.services?.state?.apiKey
    ]);

    useEffect(() => {
        if (!gameState.手机?.待发送 || gameState.手机.待发送.length === 0) return;
        const triggerResult = updatePendingForTriggers(gameState);
        const nextState = triggerResult.state;
        const delivery = applyPhoneDeliveries(nextState, nextState.游戏时间);
        if (!triggerResult.changed && delivery.delivered.length === 0) return;
        let finalState = delivery.nextState;
        if (delivery.delivered.length > 0) {
            const memoryEntries = delivery.delivered
                .filter(m => m.内容)
                .map(m => `【手机】与${m.发送者 || '未知'}聊天：${m.内容}`);
            finalState = appendPhoneMemoryEntries(finalState, memoryEntries);
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
    const handlePlayerAction = (action: 'attack' | 'skill' | 'guard' | 'escape' | 'talk' | 'item', payload?: any) => {
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
                const dnd = payload?.__dnd;
                const dndHints: string[] = [];
                const formatSigned = (value: number) => (value >= 0 ? `+${value}` : `${value}`);
                if (dnd?.判定类型) dndHints.push(`检定:${dnd.判定类型}`);
                if (dnd?.主属性) {
                    const mod = Number(dnd.命中加值 ?? dnd.属性修正 ?? 0);
                    dndHints.push(`主属性:${dnd.主属性}${formatSigned(mod)}`);
                }
                if (Number.isFinite(dnd?.固定DC)) dndHints.push(`DC:${dnd.固定DC}`);
                if (dnd?.伤害骰) {
                    const bonus = Number(dnd.附加伤害 || 0);
                    dndHints.push(`伤害:${dnd.伤害骰}${bonus !== 0 ? formatSigned(bonus) : ''}`);
                }
                if (dnd?.推荐命令) dndHints.push(`推荐命令:${dnd.推荐命令}`);
                const hintText = dndHints.length > 0 ? `【DND参数 ${dndHints.join(' | ')}】` : '';
                const commandHint = dnd?.推荐命令
                    ? `请优先返回结构化命令 ${dnd.推荐命令} 并写入 gameState.战斗.判定事件。`
                    : '';
                input = `我发动${actionLabel}【${payload?.名称 || 'Unknown'}】${targetName ? `，目标${targetName}` : ""}。${hintText}${commandHint}`;
                break;
            }
            case 'item': input = `我使用道具【${payload?.名称 || 'Unknown'}】。`; break;
        }
        if (input) handleAIInteraction(input, 'ACTION');
    };
    const handleReroll = () => {
        if (isProcessing) return;
        const logs = gameState.日志;
        if (logs.length === 0) return;
        let lastPlayerIndex = -1;
        const isUserInputLog = (log: LogEntry) =>
            log.sender === 'player'
            && !log.rawResponse
            && !log.responseId;
        for (let i = logs.length - 1; i >= 0; i--) {
            if (isUserInputLog(logs[i])) {
                lastPlayerIndex = i;
                break;
            }
        }
        if (lastPlayerIndex === -1) {
            for (let i = logs.length - 1; i >= 0; i--) {
                if (logs[i].sender === 'player') {
                    lastPlayerIndex = i;
                    break;
                }
            }
        }
        if (lastPlayerIndex === -1) return;
        const lastLog = logs[lastPlayerIndex];
        let stateToUse = gameState;
        if (lastLog.snapshot) { try { stateToUse = JSON.parse(lastLog.snapshot); } catch (e) { stateToUse = { ...gameState, 日志: logs.slice(0, lastPlayerIndex) }; } }
        else { stateToUse = { ...gameState, 日志: logs.slice(0, lastPlayerIndex) }; }
        bumpStateEpoch();
        handleAIInteraction(lastLog.text, 'ACTION', [], stateToUse);
    };
    const applyAiResponseToState = (
        state: GameState,
        response: any,
        turnIndex: number,
        logsForResponse: LogEntry[]
    ) => {
        const rawCommands = augmentCommandsWithStructuredCombatPayload(
            response,
            Array.isArray(response?.tavern_commands) ? response.tavern_commands : []
        );
        const phoneSyncEnabled = !!(response as any)?.phone_sync_plan && isPhoneApiConfigured(settings);
        const shouldStripPhoneWrites = phoneSyncEnabled || shouldStripStoryPhoneWrites();
        let commands = shouldStripPhoneWrites
            ? stripPhoneCommands(rawCommands)
            : rawCommands;
        if (isMicroserviceMode()) {
            commands = stripStoryTableOwnedCommands(commands);
        }
        let { newState } = applyCommandsWithTurnTransaction(state, commands);
        if ((state.回合数 || 1) <= 1) {
            const enriched = applyFamousIpFirstTurnEnrichment(newState);
            newState = enriched.state;
            newState = syncInventorySheetWithState(newState);
        }
        newState = reconcileEquipmentWithInventory(newState);
        const aiLogGameTime = newState.游戏时间;

        newState.处理中 = false;
        newState.回合数 = (state.回合数 || 1) + 1;
        return newState;
    };

    const handleEditLog = (logId: string, newRawResponse: string) => {
        bumpStateEpoch();
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
            const knownSpeakers = [
                resolvePlayerName(baseState.角色?.姓名 || '玩家'),
                ...(baseState.社交 || []).map((npc: any) => String(npc?.姓名 || '').trim()).filter(Boolean)
            ];
            const sourceLogs = normalizeStoryResponseLogs({
                rawLogs: normalizedLogs,
                narrative,
                fallbackLogs: fallbackLogs.map((l) => ({ sender: l.sender, text: l.text })),
                knownSpeakers
            });

            const turnIndex = typeof targetLog.turnIndex === 'number' ? targetLog.turnIndex : (baseState.回合数 || 0);
            const aiLogGameTime = baseState.游戏时间;
            const parsedThinking = mergeThinkingSegments(parsedResult.response);
            const parsedRepairNote = parsedResult.repairNote;
            const baseTimestamp = Date.now();
            let createdCount = 0;
            const newLogsForResponse: LogEntry[] = [];
            const npcNameSet = new Set(
                (baseState.社交 || [])
                    .map((npc: any) => String(npc?.姓名 || '').trim().toLowerCase())
                    .filter(Boolean)
            );
            const canonicalizeLogSender = (rawSender: unknown): string => {
                const sender = String(rawSender ?? '').trim();
                if (!sender) return '';
                const key = sender.toLowerCase();
                if (!npcNameSet.has(key) && (key === 'narrative' || key === 'narrator' || key === '旁白')) return '旁白';
                return sender;
            };
            sourceLogs.forEach((l) => {
                const sender = canonicalizeLogSender((l as any)?.sender);
                const rawTextValue = (l as any).text ?? (l as any).content ?? '';
                const normalizedText = String(rawTextValue || '').trim();
                if (!normalizedText.trim()) return;
                const isFirstLog = createdCount === 0;
                newLogsForResponse.push({
                    id: generateLegacyId(),
                    text: normalizedText,
                    sender,
                    timestamp: baseTimestamp + createdCount,
                    turnIndex,
                    gameTime: aiLogGameTime,
                    rawResponse: newRawResponse,
                    thinking: isFirstLog ? parsedThinking : undefined,
                    repairNote: isFirstLog ? parsedRepairNote : undefined,
                    responseId,
                    snapshot,
                });
                createdCount += 1;
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
    const handleUpdateLogText = (logId: string, newText: string) => setGameState(prev => ({ ...prev, 日志: prev.日志.map(l => l.id === logId ? { ...l, content: newText } : l) }));
    const handleEditUserLog = handleUpdateLogText;
    const handleUserRewrite = (logId: string, newText: string) => {
        const log = gameState.日志.find(l => l.id === logId);
        if (!log || !log.snapshot) { alert("无法回溯此节点 (缺少快照)"); return; }
        try {
            const restoredState = JSON.parse(log.snapshot);
            bumpStateEpoch();
            handleAIInteraction(newText, 'ACTION', [], restoredState);
        } catch (e) { console.error("Rewrite failed", e); }
    };
    const handleDeleteTask = (taskId: string) => {
        setGameState(prev => ({ ...prev, 任务: prev.任务.filter(t => t.id !== taskId) }));
    };

    return {
        gameState, setGameState, settings, setSettings,
        commandQueue, pendingCommands, addToQueue, removeFromQueue, currentOptions, lastAIResponse, lastAIThinking, isProcessing, isStreaming, isPhoneProcessing, phoneProcessingThreadId, phoneProcessingScope, draftInput, setDraftInput,
        handleAIInteraction, stopInteraction, handlePlayerAction, handlePlayerInput, handleSendMessage, handleCreateMoment, handleCreatePublicPost, handleReplyForumPost, handleLikeForumPost, handleCreateThread, handleMarkThreadRead, handleSilentWorldUpdate, handleManualForumRefresh, handleWaitForPhoneReply, saveSettings, manualSave, loadGame, updateConfidant,
        handleReroll, handleEditLog, handleDeleteLog, handleEditUserLog, handleUpdateLogText, handleUserRewrite, handleDeleteTask,
        handleEditPhoneMessage, handleDeletePhoneMessage,
        phoneNotifications,
        isMapUpdating,
        error, setError
    };
};


import { AppSettings, GameState, PromptModule, AIEndpointConfig, Confidant, MemoryEntry, LogEntry, AIResponse, ContextModuleConfig, ContextModuleType, InventoryItem, Task, MemoryConfig, MemorySystem, WorldMapData } from "../types";
import { GoogleGenAI } from "@google/genai";
import { 
    P_SYS_FORMAT, P_SYS_CORE, P_SYS_STATS, P_SYS_LEVELING, P_SYS_COMBAT,
    P_WORLD_FOUNDATION, P_WORLD_DUNGEON, P_WORLD_DUNGEON_SPAWN, P_WORLD_ECO, P_WORLD_GUILD_REG, P_WORLD_EQUIPMENT, P_WORLD_IF_BELL_NO_H, P_WORLD_IF_NO_BELL, P_WORLD_IF_DAY3, P_DYN_NPC, P_NPC_MEMORY, P_WORLD_NEWS, P_WORLD_RUMORS, P_WORLD_EVENTS,
    P_COT_LOGIC, P_START_REQ, P_MEM_S2M, P_MEM_M2L, P_DATA_STRUCT,
    P_WRITING_REQ, P_WORLD_VALUES, P_LOOT_SYSTEM,
    P_PHYSIOLOGY_EASY, P_PHYSIOLOGY_NORMAL, P_PHYSIOLOGY_HARD, P_PHYSIOLOGY_HELL,
    P_DIFFICULTY_EASY, P_DIFFICULTY_NORMAL, P_DIFFICULTY_HARD, P_DIFFICULTY_HELL,
    P_JUDGMENT_EASY, P_JUDGMENT_NORMAL, P_JUDGMENT_HARD, P_JUDGMENT_HELL,
    P_ACTION_OPTIONS, P_FAMILIA_JOIN, P_STORY_GUIDE,
    P_SYS_FORMAT_MULTI, P_COT_LOGIC_MULTI,
    P_SYS_COMMANDS, P_SYS_GLOSSARY, P_INTERSECTION_PRECHECK, P_NPC_BACKLINE, P_WORLD_SERVICE,
} from "../prompts";
import { Difficulty } from "../types/enums";

// --- Default Configuration ---

export const DEFAULT_PROMPT_MODULES: PromptModule[] = [
    // 【系统设定】
    { id: 'sys_format', name: '1. 输出格式', group: '系统设定', usage: 'CORE', isActive: true, content: P_SYS_FORMAT, order: 1 },
    { id: 'sys_format_multi', name: '1. 输出格式(多重思考)', group: '系统设定', usage: 'CORE', isActive: true, content: P_SYS_FORMAT_MULTI, order: 1 },
    { id: 'sys_glossary', name: '2. 术语边界', group: '系统设定', usage: 'CORE', isActive: true, content: P_SYS_GLOSSARY, order: 2 },
    { id: 'sys_commands', name: '3. 指令场景与示例', group: '系统设定', usage: 'CORE', isActive: true, content: P_SYS_COMMANDS, order: 3 },
    { id: 'sys_core', name: '4. 核心规则', group: '系统设定', usage: 'CORE', isActive: true, content: P_SYS_CORE, order: 4 },
    { id: 'sys_data_struct', name: '5. 数据格式', group: '系统设定', usage: 'CORE', isActive: true, content: P_DATA_STRUCT, order: 5 },
    { id: 'sys_writing', name: '6. 写作要求', group: '系统设定', usage: 'CORE', isActive: true, content: P_WRITING_REQ, order: 6 },
    
    // 【世界观设定】
    { id: 'world_foundation', name: '0. 神时代与眷族契约', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_FOUNDATION, order: 18 },
    { id: 'world_dungeon_law', name: '1. 地下城绝对法则', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_DUNGEON, order: 20 },
    { id: 'world_dungeon_spawn', name: '1.1 地下城刷怪逻辑', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_DUNGEON_SPAWN, order: 20.5 },
    { id: 'world_guild_reg', name: '2. 公会与登记流程', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_GUILD_REG, order: 21 },
    { id: 'world_eco_social', name: '4. 经济与社会', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_ECO, order: 23 },
    
    { id: 'world_equipment', name: '6. 装备与道具', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_EQUIPMENT, order: 23.8 },
    { id: 'world_values', name: '7. 世界数值定义', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_VALUES, order: 24 },
    { id: 'world_if_no_h', name: '8. IF线-贝尔未加入赫斯缇雅', group: '世界观设定', usage: 'CORE', isActive: false, content: P_WORLD_IF_BELL_NO_H, order: 24.2 },
    { id: 'world_if_no_bell', name: '9. IF线-本世界没有贝尔', group: '世界观设定', usage: 'CORE', isActive: false, content: P_WORLD_IF_NO_BELL, order: 24.3 },
    { id: 'world_if_day3', name: '10. IF线-贝尔第三日登场', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_IF_DAY3, order: 24.4 },
    { id: 'sys_stats', name: '11. 能力值与精神力', group: '世界观设定', usage: 'CORE', isActive: true, content: P_SYS_STATS, order: 25 },
    { id: 'sys_leveling', name: '12. 升级仪式', group: '世界观设定', usage: 'CORE', isActive: true, content: P_SYS_LEVELING, order: 26 },
    { id: 'sys_combat_law', name: '13. 战斗法则与死亡', group: '世界观设定', usage: 'CORE', isActive: true, content: P_SYS_COMBAT, order: 27 },
    { id: 'sys_loot', name: '14. 战利品管理', group: '世界观设定', usage: 'CORE', isActive: true, content: P_LOOT_SYSTEM, order: 28 },
    { id: 'sys_familia_join', name: '15. 眷族加入引导', group: '世界观设定', usage: 'CORE', isActive: true, content: P_FAMILIA_JOIN, order: 29 }, 
    
    // 【世界动态】
    { id: 'world_news', name: '1. 公会新闻生成', group: '世界动态', usage: 'CORE', isActive: true, content: P_WORLD_NEWS, order: 30 },
    { id: 'world_rumors', name: '3. 街头传闻', group: '世界动态', usage: 'CORE', isActive: true, content: P_WORLD_RUMORS, order: 32 },
    { id: 'world_events', name: '4. 世界事件管理', group: '世界动态', usage: 'CORE', isActive: true, content: P_WORLD_EVENTS, order: 33 },
    { id: 'sys_story_guide', name: '5. 剧情导演', group: '世界动态', usage: 'CORE', isActive: true, content: P_STORY_GUIDE, order: 34 },

    // 【COT思维链】
    { id: 'cot_logic', name: '1. 核心思维链', group: 'COT思维链', usage: 'CORE', isActive: true, content: P_COT_LOGIC, order: 0 },
    { id: 'cot_logic_multi', name: '1. 核心思维链(多重思考)', group: 'COT思维链', usage: 'CORE', isActive: true, content: P_COT_LOGIC_MULTI, order: 0 },

    // 【判定系统】(随难度切换)
    { id: 'judge_easy', name: '判定系统-轻松', group: '判定系统', usage: 'CORE', isActive: false, content: P_JUDGMENT_EASY, order: 15 },
    { id: 'judge_normal', name: '判定系统-普通', group: '判定系统', usage: 'CORE', isActive: false, content: P_JUDGMENT_NORMAL, order: 15 },
    { id: 'judge_hard', name: '判定系统-困难', group: '判定系统', usage: 'CORE', isActive: false, content: P_JUDGMENT_HARD, order: 15 },
    { id: 'judge_hell', name: '判定系统-地狱', group: '判定系统', usage: 'CORE', isActive: false, content: P_JUDGMENT_HELL, order: 15 },
    
    // 【动态世界提示词】
    { id: 'dyn_npc_event', name: '1. 动态事件生成', group: '动态世界提示词', usage: 'CORE', isActive: true, content: P_DYN_NPC, order: 40 },
    { id: 'dyn_npc_mem', name: '3. NPC记忆更新', group: '动态世界提示词', usage: 'CORE', isActive: true, content: P_NPC_MEMORY, order: 42 }, 
    
    // 【开局提示词】
    { id: 'start_req', name: '1. 开局要求', group: '开局提示词', usage: 'START', isActive: true, content: P_START_REQ, order: 0 },
    
    // 【记忆配置】
    { id: 'mem_s2m', name: '1. 短转中 (S->M)', group: '记忆配置', usage: 'MEMORY_S2M', isActive: true, content: P_MEM_S2M, order: 90 },
    { id: 'mem_m2l', name: '2. 中转长 (M->L)', group: '记忆配置', usage: 'MEMORY_M2L', isActive: true, content: P_MEM_M2L, order: 91 },

    // 难度与生理系统 (默认禁用，动态开启)
    { id: 'diff_easy', name: '难度-轻松', group: '难度系统', usage: 'CORE', isActive: false, content: P_DIFFICULTY_EASY, order: 100 },
    { id: 'diff_normal', name: '难度-普通', group: '难度系统', usage: 'CORE', isActive: false, content: P_DIFFICULTY_NORMAL, order: 100 },
    { id: 'diff_hard', name: '难度-困难', group: '难度系统', usage: 'CORE', isActive: false, content: P_DIFFICULTY_HARD, order: 100 },
    { id: 'diff_hell', name: '难度-地狱', group: '难度系统', usage: 'CORE', isActive: false, content: P_DIFFICULTY_HELL, order: 100 },

    { id: 'phys_easy', name: '生理-轻松', group: '生理系统', usage: 'CORE', isActive: false, content: P_PHYSIOLOGY_EASY, order: 21 },
    { id: 'phys_normal', name: '生理-普通', group: '生理系统', usage: 'CORE', isActive: false, content: P_PHYSIOLOGY_NORMAL, order: 21 },
    { id: 'phys_hard', name: '生理-困难', group: '生理系统', usage: 'CORE', isActive: false, content: P_PHYSIOLOGY_HARD, order: 21 },
    { id: 'phys_hell', name: '生理-地狱', group: '生理系统', usage: 'CORE', isActive: false, content: P_PHYSIOLOGY_HELL, order: 21 },
];

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
    instantLimit: 10, 
    shortTermLimit: 30,
    mediumTermLimit: 100,
    longTermLimit: 0 
};

const isCotModule = (mod: PromptModule) => mod.id === 'cot_logic' || mod.group === 'COT思维链';

const isServiceOverrideEnabled = (settings: AppSettings, serviceKey: 'social' | 'world' | 'npcSync' | 'npcBrain') => {
    const aiConfig = settings.aiConfig;
    if (!aiConfig) return false;
    const flags = aiConfig.serviceOverridesEnabled || {};
    return (flags as any)[serviceKey] === true;
};

const stripPromptLines = (content: string, markers: string[]) => {
    if (!content) return content;
    return content
        .split('\n')
        .filter(line => !markers.some(marker => marker && line.includes(marker)))
        .join('\n');
};

const JUDGMENT_TARGET_ADDON = `<判定对象规则>
- 判定不仅作用于玩家，也作用于 NPC。
- 输出判定日志时，text 必须包含“触发对象”字段并明确阵营与名称。
- 推荐格式：
  行动名称｜结果｜触发对象 玩家:玩家名称｜判定值 X/难度 Y｜基础 B (说明)｜环境 E (说明)｜状态 S (说明)｜幸运 L
  行动名称｜结果｜触发对象 NPC:赫斯缇雅｜判定值 X/难度 Y｜基础 B (说明)｜环境 E (说明)｜状态 S (说明)｜幸运 L
- 若为 NSFW 场景且命中高风险结果，允许使用 sender=【NSFW判定】；否则使用 sender=【判定】。
</判定对象规则>`;

const withJudgmentTargetAddon = (content: string) => {
    if (!content) return content;
    if (content.includes('触发对象') || content.includes('<判定对象规则>')) return content;
    return `${content}\n\n${JUDGMENT_TARGET_ADDON}`;
};

const adjustCotPrompt = (content: string, settings: AppSettings) => {
    let next = content;
    if (isServiceOverrideEnabled(settings, 'social')) {
        next = stripPromptLines(next, ['NPC 记忆更新', 'NPC记忆更新', 'gameState.社交[i].记忆']);
    }
    if (isServiceOverrideEnabled(settings, 'npcBrain')) {
        next = stripPromptLines(next, ['NPC后台跟踪', 'gameState.世界.NPC后台跟踪']);
    }
    if (isServiceOverrideEnabled(settings, 'world')) {
        next = stripPromptLines(next, ['世界更新', '下次更新']);
    }
    return next;
};

const buildCotPrompt = (settings: AppSettings): string => {
    const multiStage = settings.aiConfig?.multiStageThinking === true;
    const modules = settings.promptModules
        .filter(m => isCotModule(m));
    if (modules.length === 0) return "";
    if (multiStage) {
        const multi = modules.find(m => m.id === 'cot_logic_multi');
        if (multi && multi.isActive !== false) return adjustCotPrompt(multi.content, settings);
        return adjustCotPrompt(P_COT_LOGIC_MULTI, settings);
    }
    const base = modules.find(m => m.id === 'cot_logic');
    if (base && base.isActive !== false) return adjustCotPrompt(base.content, settings);
    const fallback = modules.find(m => m.isActive);
    return fallback ? adjustCotPrompt(fallback.content, settings) : "";
};

export interface NpcSimulationSnapshot {
    npcName: string;
    location?: string;
    actionOneLine?: string;
    expectedEnd?: string;
    keywords: string[];
}

const normalizeMatchText = (value: string) => value.replace(/[\s·・、,，。.!?！？:：;；"'“”‘’()（）\[\]{}<>《》]/g, '').toLowerCase();

const buildFuzzyTokens = (token: string, limit: number = 12) => {
    const output: string[] = [];
    const normalized = token.trim();
    if (!normalized) return output;
    if (normalized.length <= 2) return output;
    const seen = new Set<string>();
    const addToken = (value: string) => {
        if (!value || value.length < 2 || seen.has(value)) return;
        if (seen.size >= limit) return;
        seen.add(value);
        output.push(value);
    };
    if (normalized.length <= 4) {
        addToken(normalized.slice(0, 2));
        addToken(normalized.slice(-2));
        if (normalized.length === 4) {
            addToken(normalized.slice(1, 3));
        }
        return output;
    }
    addToken(normalized.slice(0, 2));
    addToken(normalized.slice(-2));
    addToken(normalized.slice(0, 3));
    addToken(normalized.slice(-3));
    for (let i = 1; i < normalized.length - 2 && seen.size < limit; i += 2) {
        addToken(normalized.slice(i, i + 2));
    }
    return output;
};

const extractLocationKeywords = (location?: string): string[] => {
    if (!location || typeof location !== 'string') return [];
    const trimmed = location.trim();
    if (!trimmed) return [];
    const keywords = new Set<string>([trimmed]);
    trimmed.split(/[·・、\s/|]|的/).forEach(part => {
        const token = part.trim();
        if (token && token !== trimmed) keywords.add(token);
    });
    Array.from(keywords).forEach(token => {
        buildFuzzyTokens(token).forEach(fuzzy => keywords.add(fuzzy));
    });
    return Array.from(keywords);
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

const gameTimeToMinutes = (input?: string) => {
    const parts = parseGameTimeParts(input);
    if (!parts) return null;
    return parts.day * 24 * 60 + parts.hour * 60 + parts.minute;
};

export const filterActiveNpcSimulations = (
    npcSimulations: NpcSimulationSnapshot[],
    currentGameTime?: string
) => {
    if (!Array.isArray(npcSimulations) || npcSimulations.length === 0) return [];
    const nowMinutes = gameTimeToMinutes(currentGameTime);
    if (nowMinutes === null) return npcSimulations;
    const filtered = npcSimulations.filter(sim => {
        if (!sim?.expectedEnd) return true;
        const endMinutes = gameTimeToMinutes(sim.expectedEnd);
        if (endMinutes === null) return true;
        return endMinutes > nowMinutes;
    });
    return filtered.length > 0 ? filtered : npcSimulations;
};

export const buildNpcSimulationSnapshots = (gameState: GameState): NpcSimulationSnapshot[] => {
    const tracking = Array.isArray(gameState.世界?.NPC后台跟踪) ? gameState.世界.NPC后台跟踪 : [];
    if (tracking.length === 0) return [];
    const confidantMap = new Map(
        (gameState.社交 || []).map(c => [c.姓名, c])
    );
    return tracking
        .map(track => {
            const name = track?.NPC;
            if (!name) return null;
            const confidant = confidantMap.get(name);
            const location = (track as any).地点 || track.位置 || '';
            const action = track?.当前行动 || '';
            const expectedEnd = (track as any).阶段结束时间 || track?.预计完成 || '';
            const keywords = new Set<string>();
            if (name) keywords.add(name);
            if (confidant?.称号) keywords.add(confidant.称号);
            if (location) extractLocationKeywords(location).forEach(k => keywords.add(k));
            return {
                npcName: name,
                location,
                actionOneLine: action,
                expectedEnd: expectedEnd || undefined,
                keywords: Array.from(keywords).filter(Boolean)
            } as NpcSimulationSnapshot;
        })
        .filter(Boolean) as NpcSimulationSnapshot[];
};

export const buildIntersectionHintBlock = (
    playerInput: string,
    npcSimulations: NpcSimulationSnapshot[],
    currentGameTime?: string
): string => {
    if (!playerInput || npcSimulations.length === 0) return "";
    if (playerInput.includes('[产生交集]') || playerInput.includes('[可能产生交集]')) return "";
    const content = playerInput.includes('[/用户指令]')
        ? (playerInput.split('[/用户指令]').pop() || '').trim()
        : playerInput;
    const contentSources = [playerInput, content].filter(Boolean);
    if (contentSources.length === 0) return "";
    const normalizedSources = contentSources.map(source => normalizeMatchText(source));
    const activeSimulations = filterActiveNpcSimulations(npcSimulations, currentGameTime);
    if (activeSimulations.length === 0) return "";
    const matches: NpcSimulationSnapshot[] = [];
    const seen = new Set<string>();
    activeSimulations.forEach(sim => {
        if (!sim?.npcName || seen.has(sim.npcName)) return;
        const hit = sim.keywords.some(k => {
            if (!k) return false;
            const normalizedKey = normalizeMatchText(k);
            return contentSources.some(source => source.includes(k))
                || (normalizedKey && normalizedSources.some(source => source.includes(normalizedKey)));
        });
        if (hit) {
            matches.push(sim);
            seen.add(sim.npcName);
        }
    });
    if (matches.length === 0) return "";
    const lines = matches.map(sim => {
        const location = sim.location || "未知地点";
        const action = sim.actionOneLine || "当前行动未知";
        const endLabel = sim.expectedEnd ? `｜预计结束：${sim.expectedEnd}` : "";
        return `- ${sim.npcName}｜地点：${location}｜行为：${action}${endLabel}`;
    });
    return `[可能产生交集]\n${lines.join('\n')}`;
};

export const extractIntersectionBlock = (text: string): string => {
    if (!text) return "";
    const start = text.indexOf('[产生交集]');
    if (start >= 0) return text.slice(start).trim();
    const altStart = text.indexOf('[可能产生交集]');
    if (altStart >= 0) return text.slice(altStart).trim();
    return "";
};


export const extractThinkingBlocks = (rawText: string): { cleaned: string; thinking?: string } => {
    if (!rawText) return { cleaned: rawText };
    const matches = Array.from(rawText.matchAll(/<thinking>([\s\S]*?)<\/thinking>|<think>([\s\S]*?)<\/think>/gi));
    if (matches.length === 0) return { cleaned: rawText };
    const thinking = matches
        .map(m => (m[1] || m[2] || "").trim())
        .filter(Boolean)
        .join('\n\n');
    const cleaned = rawText.replace(/<thinking>[\s\S]*?<\/thinking>|<think>[\s\S]*?<\/think>/gi, '').trim();
    return { cleaned, thinking };
};

export const normalizeThinkingField = (value?: unknown): string => {
    if (typeof value !== 'string') return "";
    const extracted = extractThinkingBlocks(value).thinking;
    return (extracted || value).trim();
};

export const mergeThinkingSegments = (response?: Partial<AIResponse>): string => {
    if (!response) return "";
    const thinkingPre = normalizeThinkingField((response as any).thinking_pre);
    const thinkingPlan = normalizeThinkingField((response as any).thinking_plan);
    const thinkingStyle = normalizeThinkingField((response as any).thinking_style);
    const thinkingDraft = normalizeThinkingField((response as any).thinking_draft);
    const thinkingCheck = normalizeThinkingField((response as any).thinking_check);
    const thinkingCanon = normalizeThinkingField((response as any).thinking_canon);
    const thinkingVarsPre = normalizeThinkingField((response as any).thinking_vars_pre);
    const thinkingVarsOther = normalizeThinkingField((response as any).thinking_vars_other);
    const thinkingVarsMerge = normalizeThinkingField((response as any).thinking_vars_merge);
    const thinkingGap = normalizeThinkingField((response as any).thinking_gap);
    const thinkingVarsPost = normalizeThinkingField((response as any).thinking_vars_post);
    const thinkingStory = normalizeThinkingField((response as any).thinking_story);
    const thinkingPost = normalizeThinkingField((response as any).thinking_post);
    const thinkingLegacy = normalizeThinkingField((response as any).thinking);
    const segments: string[] = [];
    if (thinkingPre) segments.push(`[思考-前]\n${thinkingPre}`);
    if (thinkingPlan) segments.push(`[剧情预先思考]\n${thinkingPlan}`);
    if (thinkingStyle) segments.push(`[文风思考]\n${thinkingStyle}`);
    if (thinkingDraft) segments.push(`[思考-草稿]\n${thinkingDraft}`);
    if (thinkingCheck) segments.push(`[剧情合理性校验]\n${thinkingCheck}`);
    if (thinkingCanon) segments.push(`[原著思考]\n${thinkingCanon}`);
    if (thinkingVarsPre) segments.push(`[变量预思考]\n${thinkingVarsPre}`);
    if (thinkingVarsOther) segments.push(`[其他功能变量]\n${thinkingVarsOther}`);
    if (thinkingVarsMerge) segments.push(`[变量融入剧情矫正]\n${thinkingVarsMerge}`);
    if (thinkingGap) segments.push(`[查缺补漏思考]\n${thinkingGap}`);
    if (thinkingStory) segments.push(`[思考-完整]\n${thinkingStory}`);
    if (thinkingPost) segments.push(`[思考-后]\n${thinkingPost}`);
    if (thinkingVarsPost) segments.push(`[变量矫正思考]\n${thinkingVarsPost}`);
    if (!thinkingPre && !thinkingPlan && !thinkingStyle && !thinkingDraft && !thinkingCheck && !thinkingCanon && !thinkingVarsPre && !thinkingVarsOther && !thinkingVarsMerge && !thinkingGap && !thinkingVarsPost && !thinkingStory && !thinkingPost && thinkingLegacy) segments.push(thinkingLegacy);
    return segments.join('\n\n').trim();
};

const extractJsonFromFence = (rawText: string): string | null => {
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : null;
};

const extractFirstJsonObject = (rawText: string): string | null => {
    const start = rawText.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < rawText.length; i++) {
        const ch = rawText[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            if (inString) escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (ch === '{') depth += 1;
            if (ch === '}') {
                depth -= 1;
                if (depth === 0) return rawText.slice(start, i + 1);
            }
        }
    }
    return null;
};

const balanceJsonBraces = (rawText: string): { text: string; changed: boolean } => {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = 0; i < rawText.length; i++) {
        const ch = rawText[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            if (inString) escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            continue;
        }
        if (!inString) {
            if (ch === '{') depth += 1;
            if (ch === '}') depth = Math.max(0, depth - 1);
        }
    }
    if (depth <= 0) return { text: rawText, changed: false };
    return { text: rawText + '}'.repeat(depth), changed: true };
};

const removeTrailingCommas = (rawText: string): { text: string; changed: boolean } => {
    const repaired = rawText.replace(/,\s*([}\]])/g, '$1');
    return { text: repaired, changed: repaired !== rawText };
};

export const parseAIResponseText = (
    rawText: string
): { response?: AIResponse; repaired: boolean; repairNote?: string; error?: string } => {
    const cleaned = rawText.trim();
    const candidates: { text: string; note?: string }[] = [];

    const fenced = extractJsonFromFence(cleaned);
    if (fenced) candidates.push({ text: fenced, note: "已移除代码块包裹" });

    const firstObject = extractFirstJsonObject(cleaned);
    if (firstObject && firstObject !== cleaned) {
        candidates.push({ text: firstObject, note: "已截断JSON之外内容" });
    }

    if (candidates.length === 0) candidates.push({ text: cleaned });

    let lastError: any = null;
    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate.text);
            return {
                response: parsed as AIResponse,
                repaired: !!candidate.note,
                repairNote: candidate.note
            };
        } catch (err: any) {
            lastError = err;
        }
    }

    const baseCandidate = candidates[0]?.text ?? cleaned;
    const repairLog: string[] = [];

    const trimmed = baseCandidate.trim();
    let repairedText = trimmed;

    const commaRepair = removeTrailingCommas(repairedText);
    repairedText = commaRepair.text;
    if (commaRepair.changed) repairLog.push("已移除尾随逗号");

    const braceRepair = balanceJsonBraces(repairedText);
    repairedText = braceRepair.text;
    if (braceRepair.changed) repairLog.push("已补齐缺失括号");

    try {
        const parsed = JSON.parse(repairedText);
        const note = repairLog.length > 0 ? repairLog.join("，") : "已自动修复JSON结构";
        return { response: parsed as AIResponse, repaired: true, repairNote: note };
    } catch (err: any) {
        return { repaired: false, error: lastError?.message || err?.message || "JSON解析失败" };
    }
};

/**
 * 社交与NPC上下文构建
 */
export const constructSocialContext = (confidants: Confidant[], params: any): string => {
    const presentMemoryDepth = typeof params.presentMemoryLimit === 'number'
        ? params.presentMemoryLimit
        : (typeof params.normalMemoryLimit === 'number' ? params.normalMemoryLimit : 30);
    const absentMemoryDepth = typeof params.absentMemoryLimit === 'number' ? params.absentMemoryLimit : 6;
    const specialPresentMemoryDepth = typeof params.specialPresentMemoryLimit === 'number'
        ? params.specialPresentMemoryLimit
        : (typeof params.specialMemoryLimit === 'number' ? params.specialMemoryLimit : presentMemoryDepth);
    const specialAbsentMemoryDepth = typeof params.specialAbsentMemoryLimit === 'number'
        ? params.specialAbsentMemoryLimit
        : 12;

    let contextOutput = "[社交与NPC状态 (Social & NPCs)]\n";
    contextOutput += "⚠️ 指令提示：修改NPC属性请用 `gameState.社交[Index].属性`。\n";
    contextOutput += "⚠️ 记忆说明：以下“私人记忆”仅代表该 NPC 的主观与已知，不等同于玩家共享情报。\n";

    const teammates: string[] = [];
    const focusChars: string[] = [];
    const presentChars: string[] = [];
    const absentChars: string[] = [];

    confidants.forEach((c, index) => {
        // 数据准备
        const formatMemories = (mems: any[]) => mems.map(m => `[${m.时间戳}] ${m.内容}`);
        
        const lastMemoriesRaw = c.记忆 ? c.记忆.slice(-presentMemoryDepth) : []; 
        const focusMemoriesRaw = c.记忆 ? c.记忆.slice(-specialPresentMemoryDepth) : []; 
        const absentMemoriesRaw = c.记忆 ? c.记忆.slice(-absentMemoryDepth) : [];
        const specialAbsentMemoriesRaw = c.记忆 ? c.记忆.slice(-specialAbsentMemoryDepth) : [];
        
        const lastMemories = formatMemories(lastMemoriesRaw);
        const focusMemories = formatMemories(focusMemoriesRaw);
        
        const lastMem = c.记忆 && c.记忆.length > 0 ? c.记忆[c.记忆.length - 1] : { 内容: "无互动", 时间戳: "-" };

        const baseInfo = {
            索引: index, 姓名: c.姓名, 称号: c.称号, 
            性别: c.性别, 种族: c.种族, 眷族: c.眷族, 身份: c.身份,
            等级: c.等级, 好感度: c.好感度, 关系: c.关系状态,
            是否在场: c.是否在场
        };

        if (c.是否队友) {
            const fullData = {
                ...baseInfo,
                档案: c.档案,
                生存数值: c.生存数值 || "需生成",
                能力值: c.能力值 || "需生成",
                隐藏基础能力: c.隐藏基础能力值 || "需生成",
                装备: c.装备 || "需生成",
                背包: c.背包 || [],
                私人记忆: focusMemories
            };
            teammates.push(JSON.stringify(fullData, null, 2));
        } else if (c.特别关注 || c.强制包含上下文) {
            const isPresent = !!c.是否在场;
            const focusData = {
                ...baseInfo,
                档案: c.档案,
                私人记忆: isPresent ? focusMemories : formatMemories(specialAbsentMemoriesRaw)
            };
            focusChars.push(JSON.stringify(focusData));
        } else if (c.是否在场) {
            const presentData = {
                ...baseInfo,
                档案: c.档案,
                私人记忆: lastMemories
            };
            presentChars.push(JSON.stringify(presentData));
        } else {
            const absentData = {
                ...baseInfo,
                私人记忆: formatMemories(absentMemoriesRaw),
                最后记录: `[${lastMem.时间戳}] ${lastMem.内容}`
            };
            absentChars.push(JSON.stringify(absentData));
        }
    });

    if (teammates.length > 0) contextOutput += `\n>>> 【队友】 (最优先):\n${teammates.join('\n')}\n`;
    if (focusChars.length > 0) contextOutput += `\n>>> 【特别关注/强制】:\n${focusChars.join('\n')}\n`;
    if (presentChars.length > 0) contextOutput += `\n>>> 【当前在场】:\n${presentChars.join('\n')}\n`;
    if (absentChars.length > 0) contextOutput += `\n>>> 【已知但是不在场】:\n${absentChars.join('\n')}\n`;

    return contextOutput;
};

export const constructNpcBacklineContext = (gameState: GameState): string => {
    const tracking = Array.isArray(gameState.世界?.NPC后台跟踪) ? gameState.世界.NPC后台跟踪 : [];
    const confidants = Array.isArray(gameState.社交) ? gameState.社交 : [];
    const trackingMap = new Map(tracking.map(t => [t.NPC, t]));
    const formatMemories = (mems: any[]) => mems.map(m => `[${m.时间戳}] ${m.内容}`);
    const buildLocation = (name: string, inPlace: boolean) => {
        const track = trackingMap.get(name);
        const location = (track as any)?.地点 || track?.位置;
        if (location) return location;
        if (inPlace) return gameState.当前地点 || '';
        return '';
    };

    const special: string[] = [];
    const others: string[] = [];
    const specialLimit = 8;
    const normalLimit = 3;

    confidants.forEach(c => {
        const base = {
            姓名: c.姓名,
            身份: c.身份,
            关系: c.关系状态,
            是否在场: c.是否在场,
            档案: c.档案,
            当前地点: buildLocation(c.姓名, !!c.是否在场)
        };
        if (c.特别关注) {
            const memories = formatMemories((c.记忆 || []).slice(-specialLimit));
            special.push(JSON.stringify({ ...base, 私人记忆: memories }, null, 2));
        } else {
            const memories = formatMemories((c.记忆 || []).slice(-normalLimit));
            others.push(JSON.stringify({ ...base, 私人记忆: memories }));
        }
    });

    let output = "[NPC后台模拟对象]\n";
    output += `NPC后台跟踪(现状): ${JSON.stringify(tracking)}\n`;
    if (special.length > 0) output += `\n>>> 特别关注NPC:\n${special.join('\n')}\n`;
    if (others.length > 0) output += `\n>>> 其他NPC:\n${others.join('\n')}\n`;
    return output;
};

/**
 * 地点上下文 (Location Context)
 */
export const constructMapContext = (gameState: GameState, params: any): string => {
    let output = `[地点情报 (Location Context)]\n`;
    const mapData = gameState.地图;
    if (!mapData) return output + '(地点数据丢失)';

    const macroList = mapData.macroLocations || [];
    const midList = mapData.midLocations || [];
    const smallList = mapData.smallLocations || [];
    const currentName = gameState.当前地点 || '未知';

    const findMacro = (name?: string) => name ? macroList.find(m => m.名称 === name || m.地点 === name) : undefined;
    const findMid = (name?: string) => name ? midList.find(m => m.名称 === name) : undefined;
    const findSmall = (name?: string) => name ? smallList.find(m => m.名称 === name) : undefined;

    let macro = mapData.current?.macroId ? macroList.find(m => m.id === mapData.current?.macroId) : undefined;
    let mid = mapData.current?.midId ? midList.find(m => m.id === mapData.current?.midId) : undefined;
    let small = mapData.current?.smallId ? smallList.find(m => m.id === mapData.current?.smallId) : undefined;

    const smallHit = findSmall(currentName);
    if (smallHit) {
        small = smallHit;
        if (smallHit.归属) {
            const midHit = findMid(smallHit.归属);
            if (midHit) {
                mid = midHit;
                macro = findMacro(midHit.归属) || macro;
            } else {
                macro = findMacro(smallHit.归属) || macro;
            }
        }
    } else {
        const midHit = findMid(currentName);
        if (midHit) {
            mid = midHit;
            macro = findMacro(midHit.归属) || macro;
        } else {
            macro = findMacro(currentName) || macro;
        }
    }

    const formatMacro = (m?: { 名称?: string; 地点?: string; 描述?: string; 内容?: string[] }) => {
        if (!m) return '名称: \n地点: \n描述: ';
        const name = m.名称 || '';
        const place = m.地点 || m.名称 || '';
        const desc = m.描述 || '';
        const content = Array.isArray(m.内容) && m.内容.length > 0 ? `\n内容: ${m.内容.join(' | ')}` : '';
        return `名称: ${name}\n地点: ${place}\n描述: ${desc}${content}`;
    };

    const formatMid = (m?: { 名称?: string; 描述?: string; 归属?: string; 内部建筑?: string[] }) => {
        if (!m) return '地点: \n描述: \n归属: \n内部建筑: ';
        const buildings = Array.isArray(m.内部建筑) && m.内部建筑.length > 0 ? m.内部建筑.join(' | ') : '';
        return `地点: ${m.名称 || ''}\n描述: ${m.描述 || ''}\n归属: ${m.归属 || ''}\n内部建筑: ${buildings}`;
    };

    const formatSmall = (s?: { 名称?: string; 描述?: string; 归属?: string }) => {
        if (!s) return '名称: \n归属: \n描述: ';
        return `名称: ${s.名称 || ''}\n归属: ${s.归属 || ''}\n描述: ${s.描述 || ''}`;
    };

    output += `当前地点: ${currentName}\n\n`;
    output += `大型区域:\n${formatMacro(macro)}\n\n`;
    output += `中型地点:\n${formatMid(mid)}\n\n`;
    output += `小型地点:\n${formatSmall(small)}`;
    return output.trimEnd();
};

const constructMapBaseContext = (mapData?: WorldMapData): string => {
    if (!mapData) return "";
    return "";
};

/**
 * 任务上下文
 */
export const constructTaskContext = (tasks: Task[], params: any): string => {
    if (!tasks || tasks.length === 0) return "";
    
    const activeTasks = tasks.filter(t => t.状态 === 'active');
    const historyTasks = tasks.filter(t => t.状态 !== 'active');

    let output = "[任务列表 (Quest Log)]\n";
    
    if (activeTasks.length > 0) {
        output += `>>> 进行中:\n${JSON.stringify(activeTasks, null, 2)}\n`;
    }
    
    if (historyTasks.length > 0) {
        const compressed = historyTasks.map((t, idx) => {
            const lastLog = t.日志 && t.日志.length > 0 ? t.日志[t.日志.length - 1].内容 : "无记录";
            const taskIndex = tasks.indexOf(t);
            const seq = taskIndex >= 0 ? taskIndex + 1 : (idx + 1);
            return { 序号: seq, 标题: t.标题, 状态: t.状态, 评级: t.评级, 结案摘要: lastLog };
        });
        output += `>>> 历史记录:\n${JSON.stringify(compressed, null, 2)}`;
    }

    return output;
};

export const constructWorldContext = (world: any, params: any): string => {
    return `[世界动态 (World State)]\n` + 
           `地下城异常指数: ${world.地下城异常指数}\n` +
           `公会官方通告: ${JSON.stringify(world.公会官方通告 || [])}\n` + 
           `街头传闻: ${JSON.stringify(world.街头传闻 || [])}\n` +
           `NPC后台跟踪: ${JSON.stringify(world.NPC后台跟踪 || [])}\n` +
           `战争游戏: ${JSON.stringify(world.战争游戏 || {}, null, 0)}\n` +
           `下次更新: ${world.下次更新 || "待定"}`;
};

const parseGameTimeLabel = (timestamp?: string) => {
    if (!timestamp) return { dayLabel: "未知日", timeLabel: "??:??", sortValue: null as number | null };
    const dayMatch = timestamp.match(/第(\d+)日/);
    const timeMatch = timestamp.match(/(\d{1,2}):(\d{2})/);
    const day = dayMatch ? parseInt(dayMatch[1], 10) : null;
    const hour = timeMatch ? parseInt(timeMatch[1], 10) : null;
    const minute = timeMatch ? parseInt(timeMatch[2], 10) : null;
    const dayLabel = day !== null ? `第${day}日` : "未知日";
    const timeLabel = hour !== null && minute !== null
        ? `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        : "??:??";
    const sortValue = day !== null && hour !== null && minute !== null
        ? (day * 24 * 60) + (hour * 60) + minute
        : null;
    return { dayLabel, timeLabel, sortValue };
};

export const constructCombatContext = (combat: any, params: any): string => {
    if (!combat || !combat.是否战斗中) return "";
    const rawEnemies = combat.敌方;
    const enemies = Array.isArray(rawEnemies) ? rawEnemies : (rawEnemies ? [rawEnemies] : []);
    const formatEnemy = (enemy: any, index: number) => {
        const currentHp = typeof enemy.当前生命值 === 'number' ? enemy.当前生命值 : (enemy.生命值 ?? 0);
        const maxHp = typeof enemy.最大生命值 === 'number' ? enemy.最大生命值 : Math.max(currentHp || 0, 1);
        const currentMp = typeof enemy.当前精神MP === 'number' ? enemy.当前精神MP : (enemy.精神力 ?? null);
        const maxMp = typeof enemy.最大精神MP === 'number' ? enemy.最大精神MP : (enemy.最大精神力 ?? null);
        return [
            `#${index + 1} ${enemy.名称 || '未知敌人'}`,
            `- 生命: ${currentHp}/${maxHp}`,
            `- 精神MP: ${currentMp !== null && maxMp !== null ? `${currentMp}/${maxMp}` : '未知'}`,
            `- 攻击力: ${enemy.攻击力 ?? '未知'}`,
            `- 技能: ${(enemy.技能 && enemy.技能.length > 0) ? enemy.技能.join(' / ') : '无'}`,
            `- 描述: ${enemy.描述 || '无'}`,
        ].join('\n');
    };
    const enemyBlock = enemies.length > 0
        ? enemies.map(formatEnemy).join('\n\n')
        : "无敌对目标";
    const battleLog = combat.战斗记录 ? combat.战斗记录.slice(-5).join(' | ') : "";
    return `[战斗状态 (Combat State)]\n${enemyBlock}\n\n战况记录: ${battleLog}`;
};

export const constructMemoryContext = (memory: MemorySystem, logs: LogEntry[], config: MemoryConfig, params: any): string => {
    let output = "[记忆流 (Memory Stream)]\n";
    const instantTurnLimit = config.instantLimit || 10; // Number of turns
    const shortTermEntryLimit = config.shortTermLimit || 30; // Number of summaries
    const excludeTurnIndex = typeof params?.excludeTurnIndex === 'number' ? params.excludeTurnIndex : null;
    const excludePlayerInput = params?.excludePlayerInput === true;
    const fallbackGameTime = typeof params?.fallbackGameTime === 'string' ? params.fallbackGameTime : "";
    const filteredLogsBase = (excludePlayerInput && excludeTurnIndex !== null)
        ? logs.filter(l => !(l.sender === 'player' && (l.turnIndex || 0) === excludeTurnIndex))
        : logs;
    const filteredLogs = filteredLogsBase.filter(l => {
        if (l.sender === 'hint') return false;
        if (Array.isArray(l.tags) && l.tags.includes('non_memory')) return false;
        return true;
    });

    const formatShortTermLabel = (entry: MemoryEntry) => {
        const stamp = entry.timestamp || "";
        const match = stamp.match(/第(\d+)日\s*(\d{1,2}:\d{2})/);
        if (match) return `第${match[1]}日${match[2]}`;
        if (stamp) return stamp.replace(/\s+/g, "");
        if (!stamp && fallbackGameTime) return fallbackGameTime.replace(/\s+/g, "");
        if (typeof entry.turnIndex === 'number') return `第${entry.turnIndex}日??:??`;
        return "第?日??:??";
    };
    
    // 1. Long Term (All)
    if (memory.longTerm?.length) {
        output += `【长期记忆 (Long Term)】:\n${memory.longTerm.join('\n')}\n\n`;
    }
    
    // 2. Medium Term (All)
    if (memory.mediumTerm?.length) {
        output += `【中期记忆 (Medium Term)】:\n${memory.mediumTerm.join('\n')}\n\n`;
    }

    // Determine Turn Cutoff for Instant vs Short Term
    // We want the last N turns to be Instant.
    // Get all unique turn indices from logs (assuming logs are sorted by time, or sort them)
    // Actually, simply scanning logs is safer.
    const allTurns = Array.from(new Set(filteredLogs.map(l => l.turnIndex || 0))).sort((a, b) => b - a);
    const activeInstantTurns = allTurns.slice(0, instantTurnLimit);
    // The cutoff is the smallest turn number in the active set. 
    // Anything smaller than this goes to Short Term Context.
    const minInstantTurn = activeInstantTurns.length > 0 ? activeInstantTurns[activeInstantTurns.length - 1] : 0;

    // 3. Short Term (Recent Summaries EXCLUDING Instant Turns)
    // Filter out summaries that correspond to the active instant turns (to avoid overlap)
    // We want the M summaries *before* minInstantTurn.
    const validShortTerms = memory.shortTerm
        .filter(m => (m.turnIndex || 0) < minInstantTurn)
        .slice(-shortTermEntryLimit); // Take the last M of the older turns
        
    if (validShortTerms.length > 0) {
        output += `【短期记忆 (Short Term Summary)】:\n${validShortTerms.map(m => `[${formatShortTermLabel(m)}]${m.content}`).join('\n')}\n\n`;
    }

    // 4. Instant Logs (Grouped by Turn)
    // Filter logs that belong to the active instant turns
    const instantLogs = filteredLogs.filter(l => (l.turnIndex || 0) >= minInstantTurn);
    
    if (instantLogs.length > 0) {
        output += `【即时剧情 (Instant Log - Recent ${activeInstantTurns.length} Turns)】:\n`;
        
        let currentTurn = -1;
        instantLogs.forEach(l => {
            const turn = l.turnIndex || 0;
            // Group header
            if (turn !== currentTurn) {
                currentTurn = turn;
                const logTime = l.gameTime || fallbackGameTime || '??:??';
                output += `\n[Turn ${currentTurn} | ${logTime}]\n`;
            }
            output += `[${l.sender}]: ${l.text}\n`;
        });
    } else {
        output += "【即时剧情】: (暂无新消息)";
    }

    return output.trim();
};

export const constructInventoryContext = (
    inventory: InventoryItem[],
    publicLoot: InventoryItem[],
    params?: any
): string => {
    let invContent = `[背包物品 (Inventory)]\n${JSON.stringify(inventory, null, 2)}\n\n` +
        `[公共战利品 (Public Loot)]\n${JSON.stringify(publicLoot || [], null, 2)}`;
    return invContent;
};

const buildPlayerDataContext = (playerData: GameState["角色"], difficultySetting: Difficulty): string => {
    const { 头像, 生命值, 最大生命值, ...cleanPlayerData } = playerData;
    const filteredPlayerData = difficultySetting === Difficulty.EASY
        ? { ...cleanPlayerData, 生命值, 最大生命值 }
        : cleanPlayerData;
    return `[玩家数据 (Player Data)]\n${JSON.stringify(filteredPlayerData, null, 2)}`;
};

// --- Main Prompt Assembler ---

export const generateSingleModuleContext = (
    mod: ContextModuleConfig,
    gameState: GameState,
    settings: AppSettings,
    commandHistory: string[] = [],
    playerInput: string = "",
    options: { includeIntersectionHint?: boolean } = {}
): string => {
    switch(mod.type) {
        case 'SYSTEM_PROMPTS':
            // Recalculate system prompts based on settings & state
            const isStart = (gameState.回合数 || 1) <= 1; 
            const difficulty = gameState.游戏难度 || Difficulty.NORMAL;
            const hasFamilia = gameState.角色.所属眷族 && gameState.角色.所属眷族 !== '无' && gameState.角色.所属眷族 !== 'None';
            
            let activePromptModules = settings.promptModules.filter(m => {
                if (!m.isActive) {
                    // Difficulty / Physiology Logic
                    if (m.group === '难度系统' || m.group === '生理系统' || m.group === '判定系统') {
                        if (m.id.includes(difficulty.toLowerCase().replace('normal', 'normal'))) return true;
                        return false;
                    }
                    return false;
                }
                
                if (m.id === 'sys_familia_join' && hasFamilia) return false;
                if (m.usage === 'CORE') return true;
                if (m.usage === 'START' && isStart) return true;
                return false;
            });
            if (isServiceOverrideEnabled(settings, 'world')) {
                const worldDynamicIds = new Set(['world_news', 'world_rumors', 'world_events']);
                activePromptModules = activePromptModules.filter(m => !worldDynamicIds.has(m.id));
            }
            if (isServiceOverrideEnabled(settings, 'social')) {
                activePromptModules = activePromptModules.filter(m => m.id !== 'dyn_npc_mem');
            }

            const multiStage = settings.aiConfig?.multiStageThinking === true;
            if (multiStage) {
                activePromptModules = activePromptModules.filter(m => m.id !== 'sys_format');
                const multiFormat = settings.promptModules.find(m => m.id === 'sys_format_multi');
                if (multiFormat && multiFormat.isActive !== false && !activePromptModules.includes(multiFormat)) {
                    activePromptModules = [...activePromptModules, multiFormat];
                }
            } else {
                activePromptModules = activePromptModules.filter(m => m.id !== 'sys_format_multi');
            }
            
            const filteredModules = activePromptModules.filter(m => !isCotModule(m));
            const groupPriority = [
                '世界观设定',
                '世界动态',
                '动态世界提示词',
                '难度系统',
                '判定系统',
                '生理系统',
                '系统设定',
                '开局提示词'
            ];
            const getGroupPriority = (group: string) => {
                const index = groupPriority.indexOf(group);
                return index === -1 ? groupPriority.length : index;
            };
            const sorted = [...filteredModules].sort((a, b) => {
                const groupDiff = getGroupPriority(a.group) - getGroupPriority(b.group);
                if (groupDiff !== 0) return groupDiff;
                return a.order - b.order;
            });
            // 如果启用人称管理，在写作要求模块之前插入提示
            if (settings.writingConfig?.enableNarrativePerspective) {
                const perspective = settings.writingConfig.narrativePerspective;
                const playerName = gameState.角色?.姓名 || '玩家';
                let narrativePrompt = '';
                if (perspective === 'third') {
                    narrativePrompt = `<写作人称>
【玩家姓名】${playerName}
  1. **第三人称叙述原则**:
     - **严格视角限制**: 所有叙述必须采用第三人称有限视角，仅描写外部可观察的事实、环境变化、角色（非玩家）的言行举止以及感官可感知的物理现象。绝不允许使用第二人称“你……”或第一人称“我……”的表述。
     - **玩家指代规则**: 统一使用“${playerName}”指代玩家，禁止使用“你/我/他/她/他们/她们”等人称代词或占位符。
     - **严禁心理越权**: 绝对禁止描写${playerName}的内部心理活动、想法、感受、意图或主观判断（如“${playerName}感到恐惧”“${playerName}决定反击”）。
     - **客观感官描写**: 可以描写环境对${playerName}产生的物理影响，但必须保持纯粹客观，避免任何主观情感或生理解读。
     - *正确示范*: 巨龙张开巨口咆哮，震得洞顶碎石簌簌落下。炽热的龙息喷涌而出，空气瞬间变得灼热，热浪扑向${playerName}，让周围的地面都泛起焦痕。
     - *错误示范1（人称代词）*: 你感到热浪扑面，呼吸变得困难。
     - *错误示范2（心理越权）*: 他心中一惊，腿软得几乎站不住。
     - *错误示范3（主观解读）*: 她被龙威震慑，决定转身逃跑。
     - *错误示范4（混合人称）*: 你看到巨龙喷出火焰，${playerName}吓得后退一步。

  2. **输出纯净性要求**:
     - 所有输出仅包含场景描述、你扮演的角色（及NPC）的言行动作、对话以及客观环境变化。${playerName}的任何行动、对话或反应必须完全留白，由玩家自行输入。
     - 如果剧情因${playerName}输入不足而无法推进，你扮演的角色可以自然地发问、观察或等待，但绝不能代为描述${playerName}的反应或推动事件。
     - 每条回复都必须保持纯粹的第三人称叙述风格，违反任何一条均视为破坏沉浸感，必须无条件避免。
</写作人称>`;
                } else if (perspective === 'second') {
                    narrativePrompt = `<写作人称>
【玩家姓名】${playerName}
  1. **第二人称叙述原则**:
     - **视角限制**: 所有叙述必须采用第二人称直呼视角，描写玩家角色所见、所闻、所感，但玩家指代必须使用你。禁止使用“我/他/她/他们/她们”等人称代词或占位符。
     - **玩家指代规则**: 使用你作为直接呼称，保持第二人称的对话感。
     - **允许心理描写**: 可以描写${playerName}的内部心理活动、想法、感受、意图，但需保持角色一致性。
     - **客观感官描写**: 可以描写环境对${playerName}产生的物理影响与主观感受。
     - *正确示范*: 巨龙张开巨口咆哮，震得洞顶碎石簌簌落下。炽热的龙息喷涌而出，空气瞬间变得灼热，热浪扑向${playerName}，呼吸被灼热空气压迫。
     - *错误示范1（第一人称）*: 我感到热浪扑面，呼吸变得困难。
     - *错误示范2（第三人称）*: 他心中一惊，腿软得几乎站不住。
     - *错误示范3（混合人称）*: 你看到巨龙喷出火焰，${playerName}吓得后退一步。
  2. **输出纯净性要求**:
     - 所有输出仅包含场景描述、你扮演的角色（及NPC）的言行动作、对话以及客观环境变化。${playerName}的行动、对话或反应必须由玩家自行输入，但可以包含${playerName}的心理感受。
     - 如果剧情因${playerName}输入不足而无法推进，你扮演的角色可以自然地发问、观察或等待，但绝不能代为描述${playerName}的反应或推动事件。
     - 每条回复都必须保持纯粹的第二人称叙述风格。
</写作人称>`;
                } else {
                    narrativePrompt = `<写作人称>
【玩家姓名】${playerName}
  1. **第一人称叙述原则**:
     - **视角限制**: 所有叙述必须采用第一人称主观视角，但自称必须使用“${playerName}”。禁止使用“你/他/她/他们/她们/玩家名称”等人称代词或占位符来指代玩家。
     - **玩家指代规则**: 使用“我”作为玩家称号，保持第一人称的主观感受与语气。
     - **允许心理描写**: 可以描写${playerName}的内部心理活动、想法、感受、意图，但需保持与角色一致性。
     - **客观感官描写**: 可以描写环境对${playerName}产生的物理影响，以及${playerName}的主观感受。
     - *正确示范*: 巨龙张开巨口咆哮，震得洞顶碎石簌簌落下。炽热的龙息喷涌而出，空气瞬间变得灼热，热浪扑向${playerName}，${playerName}感到呼吸被灼热空气压迫。
     - *错误示范1（第二人称）*: 你感到热浪扑面，呼吸变得困难。
     - *错误示范2（第三人称）*: 他心中一惊，腿软得几乎站不住。
     - *错误示范3（混合人称）*: 你看到巨龙喷出火焰，${playerName}吓得后退一步。
  2. **输出纯净性要求**:
     - 所有输出仅包含场景描述、你扮演的角色（及NPC）的言行动作、对话以及客观环境变化。${playerName}的行动、对话或反应必须由玩家自行输入，但可以包含${playerName}的心理感受。
     - 如果剧情因${playerName}输入不足而无法推进，你扮演的角色可以自然地发问、观察或等待，但绝不能代为描述${playerName}的反应或推动事件。
     - 每条回复都必须保持纯粹的第一人称叙述风格。
</写作人称>`;
                }
                // 找到写作要求模块的索引
                const writingIndex = sorted.findIndex(m => m.id === 'sys_writing');
                if (writingIndex >= 0) {
                    // 在写作要求之前插入虚拟模块
                    const narrativeModule: PromptModule = {
                        id: 'narrative_perspective',
                        name: '写作人称',
                        group: '系统设定',
                        usage: 'CORE',
                        isActive: true,
                        content: narrativePrompt,
                        order: sorted[writingIndex].order - 0.5
                    };
                    sorted.splice(writingIndex, 0, narrativeModule);
                }
            }
            const stripNpcBackline = isServiceOverrideEnabled(settings, 'npcBrain');
            let content = sorted.map(m => {
                let moduleContent = m.content;
                if (stripNpcBackline) {
                    moduleContent = stripPromptLines(moduleContent, ['NPC后台跟踪', 'gameState.世界.NPC后台跟踪']);
                }
                if (m.group === '判定系统') {
                    moduleContent = withJudgmentTargetAddon(moduleContent);
                }
                return moduleContent;
            }).join('\n\n');
            if (settings.enableActionOptions) content += "\n\n" + P_ACTION_OPTIONS;
            return content;

        case 'WORLD_CONTEXT':
            let worldContent = `[当前世界时间 (World Clock)]\n${gameState.当前日期} ${gameState.游戏时间}\n\n`;
            worldContent += constructWorldContext(gameState.世界, mod.params);
            const mapBase = constructMapBaseContext(gameState.地图);
            if (mapBase) worldContent += `\n\n${mapBase}`;
            return worldContent;

        case 'PLAYER_DATA':
            // Optimization: Remove heavy avatar base64 data from context
            return buildPlayerDataContext(gameState.角色, gameState.游戏难度 || Difficulty.NORMAL);
        case 'MAP_CONTEXT': {
            return constructMapContext(gameState, mod.params);
        }
        case 'SOCIAL_CONTEXT':
            return constructSocialContext(gameState.社交, mod.params);
        case 'INVENTORY_CONTEXT':
            return constructInventoryContext(
                gameState.背包,
                gameState.公共战利品,
                mod.params
            );
        case 'TASK_CONTEXT':
            return constructTaskContext(gameState.任务, mod.params);
        case 'FAMILIA_CONTEXT':
            return `[眷族 (Familia)]\n${JSON.stringify(gameState.眷族, null, 2)}`;
        case 'STORY_CONTEXT':
            return `[剧情进度 (Story Progress)]\n${JSON.stringify(gameState.剧情, null, 2)}`;
        case 'CONTRACT_CONTEXT':
            return `[契约 (Contracts)]\n${JSON.stringify(gameState.契约, null, 2)}`;
        case 'COMBAT_CONTEXT': 
            return constructCombatContext(gameState.战斗, mod.params);
        case 'MEMORY_CONTEXT':
            return constructMemoryContext(
                gameState.记忆,
                gameState.日志,
                settings.memoryConfig || DEFAULT_MEMORY_CONFIG,
                {
                    ...mod.params,
                    excludeTurnIndex: gameState.回合数 || 0,
                    excludePlayerInput: true,
                    fallbackGameTime: gameState.游戏时间
                }
            );
        case 'COMMAND_HISTORY':
            return commandHistory.length > 0 ? `[指令历史]\n${commandHistory.join('\n')}` : "[指令历史] (Empty)";
        case 'USER_INPUT':
            let inputText = `\n[玩家输入]\n"${playerInput}"\n\n[额外要求提示词]\n${settings.writingConfig?.extraRequirementPrompt || ''}`;
            if (options.includeIntersectionHint !== false && settings.enableIntersectionPrecheck !== true) {
                const snapshots = buildNpcSimulationSnapshots(gameState);
                const hintBlock = buildIntersectionHintBlock(playerInput, snapshots, gameState.游戏时间);
                if (hintBlock) {
                    inputText = `${hintBlock}\n\n${inputText}`;
                }
            }
            // 字数要求提示
            if (settings.writingConfig?.enableWordCountRequirement) {
                const required = settings.writingConfig.requiredWordCount || 800;
                inputText += `\n\n- 本次"logs"内的正文**必须${required}字**以上`;
            }
            if (settings.aiConfig?.nativeThinkingChain !== false) {
                const nextField = settings.aiConfig?.multiStageThinking ? 'thinking_plan' : 'thinking_pre';
                inputText += `\n<think>好，思考结束</think>\n\n接下来以"${nextField}"作为开头进行思考`;
            }
            return inputText;
        default:
            return "";
    }
};

export const assembleFullPrompt = (
    playerInput: string,
    gameState: GameState,
    settings: AppSettings,
    commandHistory: string[] = [],
    options: { includeIntersectionHint?: boolean } = {}
): string => {
    const contextModules = settings.contextConfig?.modules || [];
    let fullContent = "";

    const enabledModules = contextModules.filter(m => m.enabled);
    const moduleMap = new Map<ContextModuleType, ContextModuleConfig[]>();
    enabledModules.forEach(mod => {
        if (!moduleMap.has(mod.type)) moduleMap.set(mod.type, []);
        moduleMap.get(mod.type)!.push(mod);
    });

    const appendModules = (type: ContextModuleType) => {
        const modules = moduleMap.get(type) || [];
        modules.forEach(mod => {
                const modContent = generateSingleModuleContext(mod, gameState, settings, commandHistory, playerInput, options);
                if (modContent) {
                    fullContent += modContent + "\n\n";
                }
            });
        };

    const orderedTypes: ContextModuleType[] = [
        'SYSTEM_PROMPTS',
        'MEMORY_CONTEXT',
        'PLAYER_DATA',
        'MAP_CONTEXT',
        'INVENTORY_CONTEXT',
        'COMBAT_CONTEXT',
        'TASK_CONTEXT',
        'STORY_CONTEXT',
        'WORLD_CONTEXT',
        'FAMILIA_CONTEXT',
        'CONTRACT_CONTEXT',
        'SOCIAL_CONTEXT'
    ];
    const handledTypes = new Set<ContextModuleType>([...orderedTypes, 'COMMAND_HISTORY', 'USER_INPUT']);

    orderedTypes.forEach(appendModules);

    const remainingModules = enabledModules
        .filter(mod => !handledTypes.has(mod.type))
        .sort((a, b) => a.order - b.order);
    remainingModules.forEach(mod => {
        const modContent = generateSingleModuleContext(mod, gameState, settings, commandHistory, playerInput, options);
        if (modContent) {
            fullContent += modContent + "\n\n";
        }
    });

    const cotContent = buildCotPrompt(settings);
    if (cotContent) {
        fullContent += cotContent + "\n\n";
    }
    appendModules('COMMAND_HISTORY');
    appendModules('USER_INPUT');

    return fullContent.trim();
};

export const resolveServiceConfig = (settings: AppSettings, serviceKey: string): AIEndpointConfig => {
    const aiConfig = settings.aiConfig;
    if (!aiConfig) return { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: '', modelId: 'gemini-3-flash-preview' };
    const overrideFlags = aiConfig.serviceOverridesEnabled || {};
    const serviceEnabled = (overrideFlags as any)?.[serviceKey] === true;
    if (serviceEnabled) {
        const service = (aiConfig.services as any)?.[serviceKey];
        if (service && service.apiKey) return service as AIEndpointConfig;
    }
    return aiConfig.unified;
};

export interface AIRequestOptions {
    responseFormat?: 'json' | 'text';
    signal?: AbortSignal | null;
}

export const dispatchAIRequest = async (
    config: AIEndpointConfig, 
    systemPrompt: string, 
    userContent: string, 
    onStream?: (chunk: string) => void,
    options: AIRequestOptions = {}
): Promise<string> => {
    if (!config.apiKey) throw new Error(`Missing API Key for ${config.provider}`);
    const responseFormat = options.responseFormat ?? (config.forceJsonOutput ? 'json' : 'text');
    const forceJson = responseFormat === 'json' || (config.forceJsonOutput && responseFormat !== 'text');
    const signal = options.signal ?? undefined;

    if (config.provider === 'gemini') {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const modelId = config.modelId || 'gemini-3-flash-preview';
        
        try {
            const requestPayload: any = {
                model: modelId,
                contents: [
                    { role: 'user', parts: [{ text: systemPrompt + "\n\n" + userContent }] }
                ]
            };
            const requestConfig: any = {};
            if (forceJson) requestConfig.responseMimeType = "application/json";
            if (signal) requestConfig.abortSignal = signal;
            if (Object.keys(requestConfig).length > 0) requestPayload.config = requestConfig;
            const responseStream = await ai.models.generateContentStream(requestPayload);

            let fullText = "";
            for await (const chunk of responseStream) {
                const text = chunk.text;
                if (text) {
                    fullText += text;
                    if (onStream) onStream(fullText);
                }
            }
            if (!fullText) return "{}";
            return fullText;
        } catch (e: any) { 
            throw new Error(`Gemini Error: ${e.message}`); 
        }
    } else if (config.provider === 'openai' || config.provider === 'deepseek' || config.provider === 'custom') {
        let baseUrl = config.baseUrl;
        if (config.provider === 'deepseek') baseUrl = 'https://api.deepseek.com/v1';
        else if (config.provider === 'openai') baseUrl = 'https://api.openai.com/v1';
        baseUrl = baseUrl.replace(/\/$/, "");
        const model = config.modelId || (config.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
                ...(signal ? { signal } : {}),
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
                    stream: true,
                    ...(forceJson ? { response_format: { type: "json_object" } } : {})
                })
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`API Error ${response.status}: ${err}`);
            }
            if (!response.body) throw new Error("No response body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop() || ""; 
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const content = data.choices[0]?.delta?.content || "";
                            fullText += content;
                            if (onStream) onStream(fullText);
                        } catch (e) {}
                    }
                }
            }
            if (!fullText) return "{}";
            return fullText;
        } catch (e: any) {
            throw new Error(`${config.provider} Error: ${e.message}`);
        }
    }
    throw new Error(`Unknown provider`);
};

export const generateMemorySummary = async (
    logsToSummarize: LogEntry[], 
    type: 'S2M' | 'M2L', 
    settings: AppSettings
): Promise<string> => {
    const promptTemplate = type === 'S2M' ? P_MEM_S2M : P_MEM_M2L;
    const content = logsToSummarize.map(l => {
        // @ts-ignore
        if (l.text) return `[${l.sender}]: ${l.text}`;
        // @ts-ignore
        if (l.content) return l.content;
        return "";
    }).join('\n');

    try {
        const raw = await dispatchAIRequest(
            settings.aiConfig.unified, 
            "你是一个专业的记录员。请根据以下要求进行总结。",
            `${promptTemplate}\n\n【待总结内容】:\n${content}`,
            undefined,
            { responseFormat: 'text' }
        );
        try {
            const parsed = JSON.parse(raw);
            return parsed.summary || parsed.content || raw; 
        } catch {
            return raw;
        }
    } catch (e) {
        console.error("Summary Failed", e);
        return "总结失败。";
    }
};

export const generateDungeonMasterResponse = async (
    input: string,
    gameState: GameState,
    settings: AppSettings,
    exitsStr: string,
    commandsOverride: string[],
    signal?: AbortSignal,
    onStream?: (chunk: string) => void
): Promise<AIResponse> => {
    const systemPrompt = assembleFullPrompt(
        input,
        gameState,
        settings,
        commandsOverride,
        { includeIntersectionHint: settings.enableIntersectionPrecheck !== true }
    );
    const userContent = `Player Input: "${input}"\nPlease respond in JSON format as defined in system prompt.`;

    let rawText = "";
    try {
        const streamCallback = settings.enableStreaming ? onStream : undefined;
        rawText = await dispatchAIRequest(
            settings.aiConfig.unified,
            systemPrompt,
            userContent,
            streamCallback,
            { responseFormat: 'json', signal }
        );

        if (!rawText || !rawText.trim()) throw new Error("AI returned empty response.");

        const extractedThinking = extractThinkingBlocks(rawText).thinking;
        const parsedResult = parseAIResponseText(rawText);
        if (parsedResult.response) {
            const parsed = parsedResult.response as AIResponse;
            const parsedThinking = mergeThinkingSegments(parsed);
            return {
                ...parsed,
                rawResponse: rawText,
                thinking: parsedThinking || extractedThinking,
                ...(parsedResult.repairNote ? { repairNote: parsedResult.repairNote } : {})
            };
        }

        console.error("AI JSON Parse Error", parsedResult.error);
        return {
            tavern_commands: [],
            logs: [{
                sender: "system",
                text: `JSON解析失败: ${parsedResult.error || "未知错误"}\n请在“原文”中修正后重试。\n\n【原始AI消息】\n${rawText}`
            }],
            shortTerm: "Error occurred.",
            rawResponse: rawText,
            thinking: extractedThinking
        };
    } catch (error: any) {
        if (error?.name === 'AbortError' || /abort/i.test(error?.message || '')) {
            throw error;
        }
        console.error("AI Generation Error", error);
        const rawBlock = rawText ? `\n\n【原始AI消息】\n${rawText}` : "";
        return {
            tavern_commands: [],
            logs: [{ sender: "system", text: `系统错误: ${error.message}${rawBlock}` }],
            shortTerm: "Error occurred.",
            rawResponse: rawText || error.message
        };
    }
};

export const generateWorldInfoResponse = async (
    input: string,
    gameState: GameState,
    settings: AppSettings,
    signal?: AbortSignal,
    onStream?: (chunk: string) => void
): Promise<AIResponse> => {
    const worldEventsPrompt = isServiceOverrideEnabled(settings, 'npcBrain')
        ? stripPromptLines(P_WORLD_EVENTS, ['NPC后台跟踪'])
        : P_WORLD_EVENTS;
    const systemPrompt = [
        P_SYS_FORMAT,
        P_SYS_GLOSSARY,
        P_WORLD_FOUNDATION,
        P_WORLD_NEWS,
        P_WORLD_RUMORS,
        worldEventsPrompt,
        P_WORLD_SERVICE
    ].join('\n\n');
    const playerInfo = (() => {
        const raw = gameState.角色 || ({} as any);
        if (!raw || typeof raw !== 'object') return raw;
        const { 头像, ...rest } = raw as any;
        return rest;
    })();
    const worldTime = `[当前世界时间]\n${gameState.当前日期} ${gameState.游戏时间}\n当前地点: ${gameState.当前地点 || '未知'}\n当前楼层: ${gameState.当前楼层 ?? 0}`;
    const memoryContext = constructMemoryContext(
        gameState.记忆,
        gameState.日志,
        settings.memoryConfig || DEFAULT_MEMORY_CONFIG,
        {
            excludeTurnIndex: gameState.回合数 || 0,
            excludePlayerInput: true,
            fallbackGameTime: gameState.游戏时间
        }
    );
    const userContent = [
        worldTime,
        `[玩家信息]\n${JSON.stringify(playerInfo, null, 2)}`,
        `[世界状态]\n${JSON.stringify(gameState.世界 || {}, null, 2)}`,
        memoryContext,
        `[更新输入]\n${input}`,
        '请仅输出JSON。'
    ].join('\n\n');
    const config = resolveServiceConfig(settings, 'world');

    let rawText = "";
    try {
        rawText = await dispatchAIRequest(
            config,
            systemPrompt,
            userContent,
            onStream,
            { responseFormat: 'json', signal }
        );
        if (!rawText || !rawText.trim()) throw new Error("AI returned empty response.");
        const extractedThinking = extractThinkingBlocks(rawText).thinking;
        const parsedResult = parseAIResponseText(rawText);
        if (parsedResult.response) {
            const parsed = parsedResult.response as AIResponse;
            const parsedThinking = mergeThinkingSegments(parsed);
            return {
                ...parsed,
                rawResponse: rawText,
                thinking: parsedThinking || extractedThinking,
                ...(parsedResult.repairNote ? { repairNote: parsedResult.repairNote } : {})
            };
        }
        return {
            tavern_commands: [],
            logs: [{ sender: "system", text: `JSON解析失败: ${parsedResult.error || "未知错误"}` }],
            shortTerm: "Error occurred.",
            rawResponse: rawText,
            thinking: extractedThinking
        };
    } catch (error: any) {
        if (error?.name === 'AbortError' || /abort/i.test(error?.message || '')) throw error;
        const rawBlock = rawText ? `\n\n【原始AI消息】\n${rawText}` : "";
        return {
            tavern_commands: [],
            logs: [{ sender: "system", text: `系统错误: ${error.message}${rawBlock}` }],
            shortTerm: "Error occurred.",
            rawResponse: rawText || error.message
        };
    }
};

const resolveNpcSyncConfig = (settings: AppSettings) => {
    const direct = settings.aiConfig?.services?.npcSync;
    if (direct?.apiKey) return direct;
    return resolveServiceConfig(settings, 'npcSync');
};

export const hasNpcSyncApiKey = (settings: AppSettings): boolean => {
    const aiConfig = settings.aiConfig;
    if (!aiConfig?.serviceOverridesEnabled?.npcSync) return false;
    const config = resolveNpcSyncConfig(settings);
    return !!config?.apiKey;
};

export const generateIntersectionPrecheck = async (
    input: string,
    npcSimulations: NpcSimulationSnapshot[],
    settings: AppSettings,
    currentGameTime?: string,
    signal?: AbortSignal
): Promise<{ intersectionBlock: string } | null> => {
    if (!isServiceOverrideEnabled(settings, 'npcSync')) return null;
    const config = resolveNpcSyncConfig(settings);
    if (!config?.apiKey) return null;
    const activeSimulations = filterActiveNpcSimulations(npcSimulations, currentGameTime);
    if (activeSimulations.length === 0) return null;
    const payload = {
        playerInput: input,
        npcSimulations: activeSimulations.map(sim => ({
            npcName: sim.npcName,
            location: sim.location || '',
            actionOneLine: sim.actionOneLine || '',
            expectedEnd: sim.expectedEnd || ''
        }))
    };
    try {
        const rawText = await dispatchAIRequest(
            config,
            P_INTERSECTION_PRECHECK,
            JSON.stringify(payload, null, 2),
            undefined,
            { responseFormat: 'json', signal }
        );
        if (!rawText || !rawText.trim()) return null;
        const parsed = parseAIResponseText(rawText);
        if (parsed.response && typeof (parsed.response as any).intersectionBlock === 'string') {
            return { intersectionBlock: (parsed.response as any).intersectionBlock };
        }
        if (parsed.response && typeof (parsed.response as any).augmentedInput === 'string') {
            const block = extractIntersectionBlock((parsed.response as any).augmentedInput);
            return { intersectionBlock: block };
        }
        const fallback = JSON.parse(rawText);
        if (fallback && typeof fallback.intersectionBlock === 'string') return { intersectionBlock: fallback.intersectionBlock };
        if (fallback && typeof fallback.augmentedInput === 'string') return { intersectionBlock: extractIntersectionBlock(fallback.augmentedInput) };
        return null;
    } catch (e) {
        return null;
    }
};

export const generateNpcBacklineSimulation = async (
    gameState: GameState,
    settings: AppSettings,
    intersectionBlock?: string,
    signal?: AbortSignal
): Promise<any[] | null> => {
    const config = resolveServiceConfig(settings, 'npcBrain');
    if (!config?.apiKey) return null;

    const worldTime = `[当前世界时间]\n${gameState.当前日期} ${gameState.游戏时间}`;
    const worldPlace = `当前地点: ${gameState.当前地点 || '未知'}\n当前楼层: ${gameState.当前楼层 ?? 0}`;
    const memoryContext = constructMemoryContext(
        gameState.记忆,
        gameState.日志,
        settings.memoryConfig || DEFAULT_MEMORY_CONFIG,
        {
            excludeTurnIndex: gameState.回合数 || 0,
            excludePlayerInput: true,
            fallbackGameTime: gameState.游戏时间
        }
    );
    const npcContext = constructNpcBacklineContext(gameState);
    const intersectionHint = intersectionBlock?.trim();
    const userContent = `${worldTime}\n${worldPlace}\n\n${memoryContext}\n\n${npcContext}${intersectionHint ? `\n\n${intersectionHint}` : ''}`;
    const systemPrompt = `${P_WORLD_FOUNDATION}\n\n${P_NPC_BACKLINE}`;

    try {
        const rawText = await dispatchAIRequest(
            config,
            systemPrompt,
            userContent,
            undefined,
            { responseFormat: 'json', signal }
        );
        if (!rawText || !rawText.trim()) {
            throw new Error('空响应');
        }
        const parsed = parseAIResponseText(rawText);
        if (parsed.response && Array.isArray((parsed.response as any).npcTrackingUpdates)) {
            return (parsed.response as any).npcTrackingUpdates;
        }
        const fallback = JSON.parse(rawText);
        if (fallback && Array.isArray(fallback.npcTrackingUpdates)) return fallback.npcTrackingUpdates;
        const preview = rawText.length > 600 ? `${rawText.slice(0, 600)}...` : rawText;
        throw new Error(`返回缺少 npcTrackingUpdates: ${preview}`);
    } catch (e) {
        if ((e as any)?.name === 'AbortError') throw e;
        throw new Error(`NPC后台更新错误: ${(e as any)?.message || e}`);
    }
};



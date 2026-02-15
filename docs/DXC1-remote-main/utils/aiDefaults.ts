import { PromptModule, MemoryConfig } from "../types";
import {
    P_SYS_FORMAT, P_SYS_CORE, P_SYS_STATS, P_SYS_LEVELING, P_SYS_COMBAT,
    P_WORLD_FOUNDATION, P_WORLD_DUNGEON, P_WORLD_PHONE, P_WORLD_ECO, P_WORLD_GUILD_REG, P_WORLD_FACTIONS, P_WORLD_EQUIPMENT, P_WORLD_IF_BELL_NO_H, P_WORLD_IF_NO_BELL, P_WORLD_IF_DAY3, P_DYN_NPC, P_NPC_MEMORY, P_WORLD_NEWS, P_WORLD_DENATUS, P_WORLD_RUMORS, P_WORLD_EVENTS, P_DYN_MAP, P_MAP_DISCOVERY,
    P_COT_LOGIC, P_START_REQ, P_DATA_STRUCT,
    P_WRITING_REQ, P_WORLD_VALUES, P_LOOT_SYSTEM,
    P_PHYSIOLOGY_EASY, P_PHYSIOLOGY_NORMAL, P_PHYSIOLOGY_HARD, P_PHYSIOLOGY_HELL,
    P_DIFFICULTY_EASY, P_DIFFICULTY_NORMAL, P_DIFFICULTY_HARD, P_DIFFICULTY_HELL,
    P_JUDGMENT_EASY, P_JUDGMENT_NORMAL, P_JUDGMENT_HARD, P_JUDGMENT_HELL,
    P_ACTION_OPTIONS, P_FAMILIA_JOIN, P_STORY_GUIDE,
    P_PHONE_SYSTEM, P_PHONE_COT,
    P_SYS_FORMAT_MULTI, P_COT_LOGIC_MULTI,
    P_SYS_COMMANDS, P_SYS_GLOSSARY,
    P_INTERSECTION_PRECHECK, P_NPC_BACKLINE, P_WORLD_SERVICE
} from "../prompts";

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
    { id: 'world_guild_reg', name: '2. 公会与登记流程', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_GUILD_REG, order: 21 },
    { id: 'world_phone', name: '3. 魔石通讯终端', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_PHONE, order: 22 },
    { id: 'world_eco_social', name: '4. 经济与社会', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_ECO, order: 23 },
    { id: 'world_factions', name: '5. 派阀与战争游戏', group: '世界观设定', usage: 'CORE', isActive: true, content: P_WORLD_FACTIONS, order: 23.5 },
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
    { id: 'world_denatus', name: '2. 诸神神会', group: '世界动态', usage: 'CORE', isActive: true, content: P_WORLD_DENATUS, order: 31 },
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
    { id: 'dyn_map_gen', name: '2. 地图动态绘制', group: '动态世界提示词', usage: 'CORE', isActive: true, content: P_DYN_MAP, order: 41 },
    { id: 'dyn_npc_mem', name: '3. NPC记忆更新', group: '动态世界提示词', usage: 'CORE', isActive: true, content: P_NPC_MEMORY, order: 42 },
    { id: 'dyn_map_discover', name: '4. 新地点发现', group: '动态世界提示词', usage: 'CORE', isActive: true, content: P_MAP_DISCOVERY, order: 43 },

    // 【微服务提示词】
    { id: 'svc_intersection_precheck', name: '交会预判', group: '微服务提示词', usage: 'CORE', isActive: true, content: P_INTERSECTION_PRECHECK, order: 200 },
    { id: 'svc_npc_backline', name: 'NPC后台行动模拟', group: '微服务提示词', usage: 'CORE', isActive: true, content: P_NPC_BACKLINE, order: 201 },
    { id: 'svc_world_service', name: '世界情报更新', group: '微服务提示词', usage: 'CORE', isActive: true, content: P_WORLD_SERVICE, order: 202 },

    // 【开局提示词】
    { id: 'start_req', name: '1. 开局要求', group: '开局提示词', usage: 'START', isActive: true, content: P_START_REQ, order: 0 },

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
    memoryParallelBySheet: false,
    memoryFillBatchSize: 5,
    memoryFillFlushDelayMs: 40,
    memoryRequestTimeoutMs: 20000
};

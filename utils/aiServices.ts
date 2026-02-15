import { AppSettings, GameState } from "../types";
import { P_NPC_BACKLINE, P_WORLD_SERVICE, P_LOOT_SYSTEM, P_NPC_MEMORY, P_DYN_MAP } from "../prompts";
import { extractServiceCommands } from "./aiJson";
import { dispatchAIRequest, resolveRequestTimeoutMs, resolveServiceConfig } from "./aiDispatch";
import { executeWithRetry, isRetryableServiceError } from "./aiRetry";
import { replaceUserPlaceholders, resolvePlayerName } from "./userPlaceholder";

export const SERVICE_BASE_PROMPT = [
    '你是后台微服务AI，只负责结构化状态更新。',
    '输出要求：只允许输出单一JSON对象，且仅包含 tavern_commands 数组。',
    '禁止输出 logs、thinking、narrative、phone_sync_plan 或任何叙事文本。',
    '若无更新，返回 {"tavern_commands": []}。',
    '严禁使用 set/add/push/delete 等 path 写入。',
    '仅允许表格主导命令：upsert_sheet_rows/delete_sheet_rows/upsert_npc/upsert_inventory/append_log_summary/append_log_outline/append_econ_ledger/apply_econ_delta 及战斗扩展命令。'
].join('\n');

export const SERVICE_ROLE_RULES: Record<string, string> = {
    social: '职责：社交互动补全（好感度、关系状态、NPC记忆补漏）。仅使用 upsert_npc 或 upsert_sheet_rows(sheetId=NPC_Registry)。',
    npcSync: '职责：NPC在场与坐标同步（是否在场、坐标、位置详情）。禁止修改好感度与记忆。',
    npcBrain: '职责：NPC行动决策与后台跟踪。仅允许 upsert_sheet_rows/delete_sheet_rows 写 WORLD_NpcTracking（可辅写 NPC_Registry）。禁止 path 写入。',
    map: '职责：地图生成（探索/战斗地图结构）。仅允许 upsert_exploration_map / set_map_visuals / upsert_battle_map_rows，禁止写其他业务表。',
    world: '职责：世界动态更新（头条新闻、传闻、神会、世界事件、下次更新回合）+ 探索地图结构（upsert_exploration_map）。',
    memory: '职责：在主叙事完成后异步填写 LOG_Summary + LOG_Outline（必须成对）。禁止修改其他业务表。',
    phone: '职责：智能终端消息与通知生成。',
    state: '职责：通用状态更新（地点/时间/任务/背包/剧情/NPC/手机/论坛/世界动态等）。必须使用表格命令写入，不允许 path 指令。经济变化必须使用 apply_econ_delta 或 append_econ_ledger。禁止输出叙事文本。',
    story: '职责：主叙事（仅供参考，微服务不应调用）。'
};

const resolveServicePrompt = (serviceKey: string, settings: AppSettings): string => {
    const modules = settings.promptModules || [];
    if (serviceKey === 'npcBrain') {
        const mod = modules.find(m => m.id === 'svc_npc_backline');
        if (mod) return mod.isActive === false ? '' : (mod.content || P_NPC_BACKLINE);
        return P_NPC_BACKLINE;
    }
    if (serviceKey === 'social') {
        const mod = modules.find(m => m.id === 'dyn_npc_mem');
        if (mod) return mod.isActive === false ? '' : (mod.content || P_NPC_MEMORY);
        return P_NPC_MEMORY;
    }
    if (serviceKey === 'world') {
        const mod = modules.find(m => m.id === 'svc_world_service');
        if (mod) return mod.isActive === false ? '' : (mod.content || P_WORLD_SERVICE);
        return P_WORLD_SERVICE;
    }
    if (serviceKey === 'map') {
        const mod = modules.find(m => m.id === 'dyn_map_gen');
        if (mod) return mod.isActive === false ? '' : (mod.content || P_DYN_MAP);
        return P_DYN_MAP;
    }
    if (serviceKey === 'state') {
        const mod = modules.find(m => m.id === 'sys_loot');
        if (mod) return mod.isActive === false ? '' : (mod.content || P_LOOT_SYSTEM);
        return P_LOOT_SYSTEM;
    }
    return '';
};

export const buildServiceContext = (serviceKey: string, gameState: GameState) => {
    const base = {
        当前日期: gameState.当前日期,
        游戏时间: gameState.游戏时间,
        当前地点: gameState.当前地点,
        当前楼层: gameState.当前楼层,
        世界坐标: gameState.世界坐标
    };
    const socialBrief = (gameState.社交 || []).map((c, index) => ({
        索引: index,
        ID: c.id,
        姓名: c.姓名,
        是否在场: c.是否在场,
        位置详情: c.位置详情,
        坐标: c.坐标,
        好感度: c.好感度,
        关系状态: c.关系状态,
        是否队友: c.是否队友,
        特别关注: c.特别关注,
        近期记忆: c.记忆 && c.记忆.length > 0 ? c.记忆.slice(-3).map(m => m.内容) : []
    }));
    if (serviceKey === 'npcSync') {
        return {
            ...base,
            社交: socialBrief.map(c => ({
                索引: c.索引,
                ID: c.ID,
                姓名: c.姓名,
                是否在场: c.是否在场,
                当前状态: (gameState.社交?.[c.索引] as any)?.当前状态,
                位置详情: c.位置详情,
                坐标: c.坐标
            }))
        };
    }
    if (serviceKey === 'npcBrain') {
        const fullTracking = gameState.世界?.NPC后台跟踪 || [];
        // Limit to last 20 entries to prevent context bloat
        const recentTracking = fullTracking.slice(-20);
        return {
            ...base,
            社交: socialBrief,
            NPC后台跟踪: recentTracking,
            任务: gameState.任务 || [],
            剧情: gameState.剧情 || {}
        };
    }
    if (serviceKey === 'state') {
        return {
            ...base,
            角色: gameState.角色 || {},
            任务: gameState.任务 || [],
            剧情: gameState.剧情 || {},
            战斗: gameState.战斗 || {},
            背包: gameState.背包 || [],
            公共战利品: gameState.公共战利品 || [],
            战利品: gameState.战利品 || [],
            战利品背负者: gameState.战利品背负者 || '',
            社交: socialBrief
        };
    }
    if (serviceKey === 'social') {
        return {
            ...base,
            社交: socialBrief,
            任务: gameState.任务 || [],
            剧情: gameState.剧情 || {}
        };
    }
    if (serviceKey === 'world') {
        const mapData = gameState.地图;
        const mapPayload = mapData ? {
            config: mapData.config,
            macroLocations: (mapData.macroLocations || []).map(loc => ({
                id: loc.id,
                name: loc.name,
                coordinates: loc.coordinates,
                area: loc.area,
                size: loc.size,
                floor: loc.floor
            })),
            midLocations: (mapData.midLocations || []).map(loc => ({
                id: loc.id,
                name: loc.name,
                parentId: loc.parentId,
                coordinates: loc.coordinates,
                area: loc.area,
                size: loc.size,
                floor: loc.floor,
                mapStructure: loc.mapStructure
            }))
        } : undefined;
        return {
            ...base,
            世界: gameState.世界 || {},
            地图: mapPayload
        };
    }
    if (serviceKey === 'map') {
        const mapData = gameState.地图;
        const mapPayload = mapData ? {
            config: mapData.config,
            macroLocations: (mapData.macroLocations || []).map(loc => ({
                id: loc.id,
                name: loc.name,
                coordinates: loc.coordinates,
                floor: loc.floor
            })),
            midLocations: (mapData.midLocations || []).map(loc => ({
                id: loc.id,
                name: loc.name,
                parentId: loc.parentId,
                coordinates: loc.coordinates,
                floor: loc.floor,
                mapStructure: loc.mapStructure
            }))
        } : undefined;
        return {
            ...base,
            场景描述: gameState.场景描述 || '',
            地图: mapPayload
        };
    }
    if (serviceKey === 'memory') {
        return {
            ...base,
            记忆: gameState.记忆 || {},
            日志摘要: Array.isArray(gameState.日志摘要) ? gameState.日志摘要.slice(-12) : [],
            日志大纲: Array.isArray(gameState.日志大纲) ? gameState.日志大纲.slice(-12) : [],
            最近日志: Array.isArray(gameState.日志)
                ? gameState.日志.slice(-40).map((log) => ({
                    turnIndex: log.turnIndex ?? null,
                    sender: log.sender,
                    text: log.text,
                    gameTime: log.gameTime || ''
                })).slice(-24)
                : []
        };
    }
    if (serviceKey === 'phone') {
        return {
            ...base,
            手机: gameState.手机 || {}
        };
    }
    return base;
};

export const buildServicePrompt = (serviceKey: string, input: string, gameState: GameState, settings: AppSettings): string => {
    const roleRule = SERVICE_ROLE_RULES[serviceKey] || '职责：通用后台任务。';
    const context = buildServiceContext(serviceKey, gameState);
    const playerName = resolvePlayerName(gameState.角色?.姓名 || 'Player');
    const servicePrompt = replaceUserPlaceholders(resolveServicePrompt(serviceKey, settings), playerName);
    const memoryFillRule = serviceKey === 'memory'
        ? [
            '【Memory Fill Rules】',
            '1. 你的唯一目标是填写 LOG_Summary + LOG_Outline，且每个目标回合必须成对写入。',
            '2. 若 [服务输入] 含 待填回合 数组，则按目标回合升序逐个处理；每个回合生成一对命令。',
            '3. 若 [服务输入].填表任务.targetSheet 存在，则只能输出该表对应命令（LOG_Summary 或 LOG_Outline），禁止跨表。',
            '4. 两条命令必须共享同一 编码索引（AMxxxx）；若无法确定可省略，由运行时自动分配。',
            '5. 时间格式硬约束：时间=YYYY-MM-DD HH:MM；时间跨度=YYYY-MM-DD HH:MM—YYYY-MM-DD HH:MM。',
            '6. LOG_Summary（总结表）字段语义：时间跨度 / 地点 / 纪要 / 重要对话 / 编码索引。',
            '7. LOG_Outline（总体大纲）字段语义：时间跨度 / 大纲 / 编码索引。',
            '8. 总结表纪要必须是“高保真、零解读”的客观记录：仅写可见动作与可闻信息，禁止心理、动机、意义升华；字数硬约束 180-240，目标约 200 字。',
            '9. 总结表重要对话只摘录关键原句（需标注说话者），总长度不超过80 token。',
            '10. 总体大纲必须是对同回合总结表的“精炼主干”，禁止与纪要同句复写；建议 40-120 字，只保留核心事件链。',
            '11. 反同质化硬约束：若“大纲”与“纪要/摘要”高度近似（同句改写或大量重合），必须重写大纲后再输出。',
            '12. append_log_summary.value 至少包含模板最小字段: 时间跨度, 地点, 纪要(或摘要), 重要对话(可空), 编码索引(可选)。兼容字段 回合/时间/摘要 可选。',
            '13. append_log_outline.value 至少包含模板最小字段: 时间跨度, 大纲, 编码索引(可选)。兼容字段 章节/标题/开始回合/事件列表 可选。',
            '14. 已有成对记录的回合必须跳过；全部已存在时返回 {"tavern_commands": []}。',
            '15. 输出前自检：本轮 Summary/Outline 是否共享同一 AM 编码、是否缺字段、是否同质化；不通过则先修正再输出。',
            '16. 禁止输出任何非日志表命令。'
        ].join('\n')
        : '';
    const stateFillRule = serviceKey === 'state'
        ? [
            '【State Fill Rules】',
            '1. 你的任务是根据 [服务输入].叙事 与 [服务输入].玩家输入，补齐本回合业务状态表写入。',
            '2. 必须严格遵守 [服务输入].表结构约束（sheetId/primaryKey/requiredColumns/columnsPreview），字段名以约束为准。',
            '2.1 若 [服务输入].填表任务.requiredSheets 存在，则只允许写这些表。',
            '2.2 若 [服务输入].填表任务.targetSheet 存在，则本次只允许输出该单表对应命令，禁止跨表。',
            '3. 若叙事明确发生了交易、获得物品、任务完成、时间推进、位置变化，禁止返回空命令。',
            '4. 经济变化一律使用 apply_econ_delta，不得把 delta 写成余额覆盖值。',
            '4.1 若 [服务输入].经济语义锚点 存在：必须优先依据锚点生成经济命令（apply_econ_delta 或 append_econ_ledger）。',
            '4.2 结账/买单/支付/消费：delta 必须为负数；获得/收入/奖励：delta 必须为正数。',
            '4.3 必须遵守余额约束：不得让 角色.法利 变成负数；若余额不足，禁止输出扣款命令（可返回空命令并在 rawResponse 中保持 tavern_commands 为空）。',
            '4.4 若叙事出现明确金额（例如 “一共是 30 法利”）且出现支付语义（例如 “结账/买单/支付”），禁止遗漏经济命令。',
            '5. 禁止输出 LOG_Summary/LOG_Outline 相关命令（该部分由 memory 服务负责）。',
            '6. 系统审计/映射表（SYS_CommandAudit/SYS_TransactionAudit/SYS_ValidationIssue/SYS_MappingRegistry）禁止写入。',
            '7. 若 [服务输入].已应用指令 已完整覆盖本回合事实变化，则可以返回空命令避免重复写入。',
            '8. SYS_GlobalState 硬约束：本回合一旦发生时间/地点/天气/系统通知变化，必须实时写入，禁止延后到下一回合。',
            '9. SYS_GlobalState 写入硬约束：每次仅允许一条 upsert_sheet_rows 命令，且 value.rows 必须且只能有 1 行（rows.length=1），禁止多行。',
            '10. 同一行需合并本回合全部全局字段变化（如 当前回合/当前场景/游戏时间/天气状况/系统通知），禁止拆分成多次写入。',
            '10.1 若叙事未给出精确时钟，但发生了明显行动（移动/探索/交易/训练/仪式/战斗），必须推断合理流逝并写入 游戏时间 + 上轮时间 + 流逝时长；禁止长时间停滞在同一时刻。',
            '10.2 时间推断范围约束（必须遵守）：短问答/寒暄=2-12 分钟；一般对话/请教=4-18 分钟；城内移动/交易/整备=15-60 分钟；跨区移动或多地点调查=30-90 分钟；单次战斗回合=5-25 分钟；长休/过夜=120-480 分钟。',
            '10.3 示例（按叙事就近取值）：例 A「问路 + 两句对话」=> 5-10 分钟；例 B「酒馆点单 + 吃完 + 结账」=> 20-45 分钟；例 C「跨区赶路并调查线索」=> 45-90 分钟。禁止“只聊几句却推进 1 小时以上”。',
            '11. 若输出 COMBAT_BattleMap：必须保证地图尺寸可还原（Config 语义或视觉层尺寸），单位坐标为整数网格坐标，禁止像素坐标。',
            '12. 若输出 COMBAT_Map_Visuals：建议包含 SceneName + VisualJSON + GridSize（如 20x20），并可还原为 set_map_visuals。',
            '13. 若输出 CHARACTER_Attributes/CHARACTER_Resources：优先完整提供 AC/先攻/速度/属性值/豁免熟练/技能熟练/被动感知/法术位/生命骰/金币。'
        ].join('\n')
        : '';
    const socialCompatibilityRule = serviceKey === 'social'
        ? [
            '【社交补全语义约束】',
            `主角名：${playerName}（禁止保留 {{user}} 占位符）。`,
            '当补全 NPC 最近记忆时，记忆内容建议保留第一人称自然语气线索。',
            '近期记忆建议保留 2-3 条关键互动，避免长段重复。'
        ].join('\n')
        : '';
    // Only include essential world modules for services, or even better, NONE if they don't need it.
    // Services mostly need context (where am I, who is here) rather than lore (history of Orario).
    // Let's include only 'System' (Data Struct) and maybe 'World Foundation' if strictly needed.
    // Actually, simply removing the massive join is safer.
    // If specific services need specific lore, we should inject only that.

    // For now, let's limit to just the system/data structure if available, or empty.
    // The SERVICE_BASE_PROMPT already defines the output format.
    // We'll keep it empty to save context, relying on 'context' object.
    const worldview = '';

    const prompt = [
        SERVICE_BASE_PROMPT,
        `服务标识: ${serviceKey}`,
        roleRule,
        servicePrompt,
        memoryFillRule,
        stateFillRule,
        socialCompatibilityRule,
        worldview,
        `[上下文]\n${JSON.stringify(context, null, 2)}`,
        `[服务输入]\n${input}`
    ].filter(Boolean).join('\n\n');
    return replaceUserPlaceholders(prompt, playerName);
};

export const generateServiceCommands = async (
    serviceKey: string,
    input: string,
    gameState: GameState,
    settings: AppSettings,
    signal?: AbortSignal | null
): Promise<{ tavern_commands: any[]; rawResponse: string; repairNote?: string }> => {
    const systemPrompt = buildServicePrompt(serviceKey, input, gameState, settings);
    const userContent = `Service Input: ${input}`;
    const config = resolveServiceConfig(settings, serviceKey, { strictService: true });
    if (!config?.apiKey) {
        return { tavern_commands: [], rawResponse: '' };
    }
    const timeoutMs = resolveRequestTimeoutMs(settings, serviceKey);
    const dispatchRequest = () => dispatchAIRequest(
        config,
        systemPrompt,
        userContent,
        undefined,
        { responseFormat: 'json', signal, timeoutMs }
    );
    const enableRetry = serviceKey === 'memory' || serviceKey === 'state';
    const rawText = enableRetry
        ? await executeWithRetry(dispatchRequest, {
            maxAttempts: 3,
            baseDelayMs: 500,
            backoffFactor: 2,
            signal,
            shouldRetry: ({ error }) => isRetryableServiceError(error)
        })
        : await dispatchRequest();
    if (!rawText || !rawText.trim()) {
        return { tavern_commands: [], rawResponse: rawText || '' };
    }
    return extractServiceCommands(rawText);
};

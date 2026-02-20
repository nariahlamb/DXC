import { P_ACTION_OPTIONS, P_COT_LOGIC_MULTI, P_PHONE_COT, P_PHONE_SYSTEM } from "../prompts";
import { AppSettings, ContextModuleConfig, ContextModuleType, GameState, PromptModule } from "../types";
import { DEFAULT_MEMORY_CONFIG } from "./aiDefaults";
import { constructCombatContext, constructInventoryContext, constructMapBaseContext, constructMapContext, constructMemoryContext, constructPhoneContextFromGameState, constructPhoneEnvironmentBrief, constructPhoneMemoryBrief, constructPhoneNarrativeBackdrop, constructPhoneSocialBrief, constructPhoneStoryBrief, constructPhoneTrackingBrief, constructPhoneWorldBrief, constructPhoneWorldview, constructSocialContext, constructTaskContext, constructWorldContext, buildPlayerDataContext } from "./aiContext";
import { Difficulty } from "../types/enums";
import { replaceUserPlaceholders, resolvePlayerName } from "./userPlaceholder";

const isCotModule = (mod: PromptModule) => mod.id === 'cot_logic' || mod.group === 'COT思维链';
const SERVICE_ONLY_PROMPT_IDS = new Set(['svc_intersection_precheck', 'svc_npc_backline', 'svc_world_service']);
const LEGACY_INLINE_COMMAND_PATTERN = /`(?:set|add|push|delete)\s+gameState\.[^`]*`/gi;
const LEGACY_ACTION_FIELD_PATTERN = /"action"\s*:\s*"(?:set|add|push|delete)"/gi;
const LEGACY_COMMAND_TEXT_PATTERN = /\b(?:set|add|push|delete)\s+gameState\.[^\s，。；、)\]}]+/gi;
const NARRATIVE_ONLY_EXCLUDED_PROMPT_IDS = new Set([
    'sys_format',
    'sys_format_multi',
    'sys_glossary',
    'sys_commands',
    'sys_data_struct',
    'world_service',
    'svc_intersection_precheck',
    'svc_npc_backline',
    'svc_world_service',
    'cot_logic',
    'cot_logic_multi'
]);
const NARRATIVE_ONLY_FORBIDDEN_PATTERNS: RegExp[] = [
    /tavern_commands/i,
    /\b(?:upsert_sheet_rows|delete_sheet_rows|upsert_npc|upsert_inventory|append_log_summary|append_log_outline|append_econ_ledger|apply_econ_delta|upsert_exploration_map|set_map_visuals|upsert_battle_map_rows|set_encounter_rows|set_action_economy|append_combat_resolution|set_initiative|roll_dice_check|resolve_attack_check|resolve_saving_throw|resolve_damage_roll|consume_dice_rows|refill_dice_pool|spend_action_resource)\b/i,
    /"action"\s*:/i,
    /动作白名单|命令载荷约束|常用表格写入目标|叙事-指令一致性|强制地图\/先攻输出|变量预思考/i
];
const containsNarrativeOnlyForbiddenPattern = (text: string): boolean => {
    if (!text) return false;
    return NARRATIVE_ONLY_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text));
};
const sanitizeNarrativeOnlyPrompt = (content: string): string => {
    if (!content) return content;
    const normalized = sanitizeTableFirstPrompt(content);
    const lines = normalized.split(/\r?\n/);
    const kept: string[] = [];
    let fenceBuffer: string[] | null = null;

    const flushFence = () => {
        if (!fenceBuffer) return;
        const block = fenceBuffer.join('\n');
        if (!containsNarrativeOnlyForbiddenPattern(block)) {
            kept.push(block);
        }
        fenceBuffer = null;
    };

    for (const line of lines) {
        const trimmed = line.trim();
        const isFence = /^```/.test(trimmed);
        if (fenceBuffer) {
            fenceBuffer.push(line);
            if (isFence) flushFence();
            continue;
        }
        if (isFence) {
            fenceBuffer = [line];
            continue;
        }
        if (containsNarrativeOnlyForbiddenPattern(line)) continue;
        kept.push(line);
    }
    if (fenceBuffer) {
        const pending = fenceBuffer.join('\n');
        if (!containsNarrativeOnlyForbiddenPattern(pending)) {
            kept.push(pending);
        }
    }
    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
const buildNarrativeOnlyOutputProtocol = (settings: AppSettings): string => {
    const nativeThinkingEnabled = settings.aiConfig?.nativeThinkingChain !== false;
    const multiStageThinking = settings.aiConfig?.multiStageThinking === true;
    const lines = [
        '[主叙事输出协议]',
        '- 仅输出单一 JSON 对象（禁止 markdown 代码块）。',
        '- 必须包含 `logs` 数组，元素结构为 `{ "sender": "...", "text": "..." }`。',
        '- `logs` 必须按“叙事片段/对白句”逐条输出，禁止把整段剧情压缩为单条日志。',
        '- 旁白统一使用 `sender: "旁白"`；角色对白必须使用真实角色名作为 sender。',
        '- 同一段文本中若出现多人对白，必须拆分为多条 logs，禁止旁白与对白混写在同一条 text。',
        '- **[严禁]** 角色 logs.text 中包含任何动作、神态、心理描写或括号内容（如 `(点头)`、`（冷笑）`）。',
        '- 任何非口语的动作/神态描述，必须剥离为独立的 `sender: "旁白"` 条目。',
        '- 可选输出 `action_options`（字符串数组）。',
        '- `tavern_commands` 必须是空数组 `[]`。',
        '- 变量写入、社交更新、经济变化、日志摘要/大纲全部交由 state 服务。'
    ];
    if (!nativeThinkingEnabled) {
        lines.push('- 不输出任何 `thinking_*` 字段。');
        return lines.join('\n');
    }
    if (multiStageThinking) {
        lines.push('- 必须输出多段思考：`thinking_plan`、`thinking_style`、`thinking_draft`、`thinking_check`、`thinking_canon`、`thinking_vars_pre`、`thinking_vars_other`、`thinking_vars_merge`、`thinking_gap`、`thinking_vars_post`。');
    } else {
        lines.push('- 必须输出双段思考：`thinking_pre` 与 `thinking_post`。');
    }
    lines.push('- thinking 字段仅用于思考与校验，不得写入业务指令。');
    return lines.join('\n');
};

const sanitizeTableFirstPrompt = (content: string): string => {
    if (!content) return content;
    return content
        .replace(LEGACY_INLINE_COMMAND_PATTERN, '`upsert_sheet_rows(...)`')
        .replace(LEGACY_ACTION_FIELD_PATTERN, '"action": "upsert_sheet_rows"')
        .replace(LEGACY_COMMAND_TEXT_PATTERN, 'upsert_sheet_rows(...)');
};
const buildNarrativeOnlyCotPrompt = (settings: AppSettings): string => {
    if (settings.aiConfig?.nativeThinkingChain === false) return "";
    const multiStage = settings.aiConfig?.multiStageThinking === true;
    const lines = multiStage
        ? [
            '<叙事思考约束>',
            '- thinking_* 仅用于叙事规划、风格控制与一致性检查。',
            '- 禁止在 thinking_* 中规划或输出任何 tavern_commands、表格写入动作或命令示例。',
            '- 仅围绕 logs 连贯性、角色动机一致性、世界观一致性与 action_options 可执行性思考。',
            '</叙事思考约束>'
        ]
        : [
            '<叙事思考约束>',
            '- thinking_pre/thinking_post 仅用于叙事规划与一致性复核。',
            '- 禁止在 thinking_* 中规划或输出任何 tavern_commands、表格写入动作或命令示例。',
            '- 仅围绕 logs 连贯性、角色动机一致性、世界观一致性与 action_options 可执行性思考。',
            '</叙事思考约束>'
        ];
    return lines.join('\n');
};

const shouldUseNarrativeOnlyStoryPrompt = (settings: AppSettings): boolean => {
    const stateApiKey = String(settings.aiConfig?.services?.state?.apiKey || '').trim();
    return !!stateApiKey;
};

export const buildCotPrompt = (settings: AppSettings): string => {
    const multiStage = settings.aiConfig?.multiStageThinking === true;
    const modules = settings.promptModules
        .filter(m => isCotModule(m));
    if (modules.length === 0) return "";
    if (multiStage) {
        const multi = modules.find(m => m.id === 'cot_logic_multi');
        if (multi && multi.isActive !== false) return sanitizeTableFirstPrompt(multi.content);
        return sanitizeTableFirstPrompt(P_COT_LOGIC_MULTI);
    }
    const base = modules.find(m => m.id === 'cot_logic');
    if (base && base.isActive !== false) return sanitizeTableFirstPrompt(base.content);
    const fallback = modules.find(m => m.isActive);
    return fallback ? sanitizeTableFirstPrompt(fallback.content) : "";
};

const parseDungeonFloorTrigger = (input: string): number | null => {
    if (!input) return null;
    const match = input.match(/(?:第\s*)?(\d{1,2})\s*层/);
    if (!match) return null;
    const floor = parseInt(match[1], 10);
    if (Number.isNaN(floor)) return null;
    if (floor < 1 || floor > 50) return null;
    return floor;
};

const hasMapKeyword = (input: string, params: any): boolean => {
    if (!input) return false;
    if (Array.isArray(params?.triggerKeywords)) {
        return params.triggerKeywords.some((kw: string) => kw && input.includes(kw));
    }
    return /地图|地形|路线|路径/.test(input);
};

export const generateSingleModuleContext = (mod: ContextModuleConfig, gameState: GameState, settings: AppSettings, commandHistory: string[] = [], playerInput: string = ""): string => {
    switch(mod.type) {
        case 'SYSTEM_PROMPTS': {
            const isStart = (gameState.回合数 || 1) <= 1;
            const difficulty = gameState.游戏难度 || Difficulty.NORMAL;
            const hasFamilia = gameState.角色.所属眷族 && gameState.角色.所属眷族 !== '无' && gameState.角色.所属眷族 !== 'None';
            const narrativeOnlyStoryPrompt = shouldUseNarrativeOnlyStoryPrompt(settings);

            const currentFloor = gameState.当前楼层 || 0;
            const mapData = gameState.地图;
            const hasMapDataForFloor = currentFloor === 0
                ? true
                : mapData.surfaceLocations.some(l => l.floor === currentFloor);

            let activePromptModules = settings.promptModules.filter(m => {
                if (!m.isActive) {
                    if (m.group === '难度系统' || m.group === '生理系统' || m.group === '判定系统') {
                        if (m.id.includes(difficulty.toLowerCase().replace('normal', 'normal'))) return true;
                        return false;
                    }
                    if (m.id === 'dyn_map_gen') {
                        return (currentFloor > 0 && !hasMapDataForFloor);
                    }
                    if (m.id === 'dyn_map_discover') return true;

                    return false;
                }

                if (m.id === 'sys_familia_join' && hasFamilia) return false;
                if (m.usage === 'CORE') return true;
                if (m.usage === 'START' && isStart) return true;
                return false;
            });
            activePromptModules = activePromptModules.filter(m => !SERVICE_ONLY_PROMPT_IDS.has(m.id));
            if (narrativeOnlyStoryPrompt) {
                activePromptModules = activePromptModules.filter(m => !NARRATIVE_ONLY_EXCLUDED_PROMPT_IDS.has(m.id));
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
            if (settings.writingConfig?.enableNarrativePerspective) {
                const perspective = settings.writingConfig.narrativePerspective;
                let narrativePrompt = '';
                if (perspective === 'third') {
                    narrativePrompt = `<写作人称>
  1. **第三人称叙述原则**:
     - **严格视角限制**: 所有叙述必须采用第三人称有限视角，仅描写外部可观察的事实、环境变化、角色（非玩家）的言行举止以及感官可感知的物理现象。绝不允许使用第二人称“你……”或第一人称“我……”的表述。
     - **玩家指代规则**: 统一使用“{{user}}”来指代用户角色（即玩家当前设置的名字）。绝不使用“你”来直接称呼玩家。
     - **严禁心理越权**: 绝对禁止描写{{user}}的内部心理活动、想法、感受、意图或主观判断（如“{{user}}感到恐惧”“{{user}}决定反击”）。
     - **客观感官描写**: 可以描写环境对{{user}}产生的物理影响，但必须保持纯粹客观，避免任何主观情感或生理解读。
     - *正确示范*: 巨龙张开巨口咆哮，震得洞顶碎石簌簌落下。炽热的龙息喷涌而出，空气瞬间变得灼热，热浪扑向{{user}}，让周围的地面都泛起焦痕。
     - *错误示范1（第二人称）*: 你感到热浪扑面，呼吸变得困难。
     - *错误示范2（心理越权）*: {{user}}心中一惊，腿软得几乎站不住。
     - *错误示范3（主观解读）*: {{user}}被龙威震慑，决定转身逃跑。
     - *错误示范4（混合人称）*: 你看到巨龙喷出火焰，艾伦吓得后退一步。

  2. **输出纯净性要求**:
     - 所有输出仅包含场景描述、你扮演的角色（及NPC）的言行动作、对话以及客观环境变化。{{user}}的任何行动、对话或反应必须完全留白，由玩家自行输入。
     - 如果剧情因{{user}}输入不足而无法推进，你扮演的角色可以自然地发问、观察或等待，但绝不能代为描述{{user}}的反应或推动事件。
     - 每条回复都必须保持纯粹的第三人称叙述风格，违反任何一条均视为破坏沉浸感，必须无条件避免。
</写作人称>`;
                } else if (perspective === 'second') {
                    narrativePrompt = `<写作人称>
  1. **第二人称叙述原则**:
     - **视角限制**: 所有叙述必须采用第二人称视角，以“你”作为叙述者，描写玩家角色所见、所闻、所感。禁止使用第一人称“我……”或第三人称“他/她/{{user}}”来指代玩家。
     - **玩家指代规则**: 使用“你”直接称呼玩家。禁止使用“我”“他/她”或“{{user}}”替代玩家。
     - **允许心理描写**: 可以描写“你”的内部心理活动、想法、感受、意图，但需保持角色一致性。
     - **客观感官描写**: 可以描写环境对“你”产生的物理影响与主观感受。
     - *正确示范*: 巨龙张开巨口咆哮，震得洞顶碎石簌簌落下。炽热的龙息喷涌而出，空气瞬间变得灼热，你感到热浪扑面，呼吸变得困难。
     - *错误示范1（第一人称）*: 我感到热浪扑面，呼吸变得困难。
     - *错误示范2（第三人称）*: {{user}}心中一惊，腿软得几乎站不住。
     - *错误示范3（混合人称）*: 你看到巨龙喷出火焰，我吓得后退一步。
  2. **输出纯净性要求**:
     - 所有输出仅包含场景描述、你扮演的角色（及NPC）的言行动作、对话以及客观环境变化。玩家的行动、对话或反应必须由玩家自行输入，但可以包含“你”的心理感受。
     - 如果剧情因玩家输入不足而无法推进，你扮演的角色可以自然地发问、观察或等待，但绝不能代为描述玩家的反应或推动事件。
     - 每条回复都必须保持纯粹的第二人称叙述风格。
</写作人称>`;
                } else {
                    narrativePrompt = `<写作人称>
  1. **第一人称叙述原则**:
     - **视角限制**: 所有叙述必须采用第一人称视角，以“我”作为叙述者，描写玩家角色所见、所闻、所感。禁止使用第二人称“你……”或第三人称“他/她……”来指代玩家。
     - **玩家指代规则**: 使用“我”来指代玩家角色，或使用玩家在设定中指定的名字（如“艾伦”）作为自称。禁止使用“你”来直接称呼玩家。
     - **允许心理描写**: 可以描写玩家的内部心理活动、想法、感受、意图，但需保持与角色一致性。
     - **客观感官描写**: 可以描写环境对玩家产生的物理影响，以及玩家的主观感受。
     - *正确示范*: 巨龙张开巨口咆哮，震得洞顶碎石簌簌落下。炽热的龙息喷涌而出，空气瞬间变得灼热，我感到热浪扑面，呼吸变得困难。
     - *错误示范1（第二人称）*: 你感到热浪扑面，呼吸变得困难。
     - *错误示范2（第三人称）*: {{user}}心中一惊，腿软得几乎站不住。
     - *错误示范3（混合人称）*: 你看到巨龙喷出火焰，艾伦吓得后退一步。
  2. **输出纯净性要求**:
     - 所有输出仅包含场景描述、你扮演的角色（及NPC）的言行动作、对话以及客观环境变化。玩家的行动、对话或反应必须由玩家自行输入，但可以包含玩家的心理感受。
     - 如果剧情因玩家输入不足而无法推进，你扮演的角色可以自然地发问、观察或等待，但绝不能代为描述玩家的反应或推动事件。
     - 每条回复都必须保持纯粹的第一人称叙述风格。
</写作人称>`;
                }
                const writingIndex = sorted.findIndex(m => m.id === 'sys_writing');
                if (writingIndex >= 0) {
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
            let content = sorted.map(m => m.content).join('\n\n');
            if (settings.enableActionOptions) content += "\n\n" + P_ACTION_OPTIONS;
            if (narrativeOnlyStoryPrompt) {
                const narrativeOnlyContent = sanitizeNarrativeOnlyPrompt(content);
                return [narrativeOnlyContent, buildNarrativeOnlyOutputProtocol(settings)].filter(Boolean).join('\n\n').trim();
            }
            return sanitizeTableFirstPrompt(content);
        }

        case 'WORLD_CONTEXT': {
            let worldContent = `[当前世界时间 (World Clock)]\n${gameState.当前日期} ${gameState.游戏时间}\n\n`;
            worldContent += constructWorldContext(gameState.世界, mod.params);
            const mapBase = constructMapBaseContext(gameState.地图);
            if (mapBase) worldContent += `\n\n${mapBase}`;
            return worldContent;
        }

        case 'PLAYER_DATA':
            return buildPlayerDataContext(gameState.角色, gameState.游戏难度 || Difficulty.NORMAL);
        case 'MAP_CONTEXT': {
            const mapFloor = gameState.当前楼层 || 0;
            const triggerFloor = parseDungeonFloorTrigger(playerInput);
            const hasKeyword = hasMapKeyword(playerInput, mod.params);
            if (mapFloor > 0 && !mod.params?.alwaysIncludeDungeon) {
                const floorMatch = triggerFloor !== null && triggerFloor === mapFloor;
                if (!hasKeyword || !floorMatch) return "";
            }
            return constructMapContext(gameState, { ...mod.params, forceFloor: triggerFloor ?? mapFloor });
        }
        case 'SOCIAL_CONTEXT':
            return constructSocialContext(gameState.社交, mod.params);
        case 'INVENTORY_CONTEXT':
            return constructInventoryContext(
                gameState.背包,
                gameState.战利品,
                gameState.公共战利品,
                gameState.战利品背负者,
                mod.params
            );
        case 'PHONE_CONTEXT':
            return constructPhoneContextFromGameState(gameState, {
                ...mod.params,
                playerName: gameState.角色?.姓名 || 'Player',
                excludeThreadTitles: Array.from(new Set([
                    '公会导航服务',
                    '健康统计助手',
                    '健康服务助手',
                    ...(Array.isArray(mod.params?.excludeThreadTitles) ? mod.params.excludeThreadTitles : [])
                ]))
            });
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
                    retrievalQuery: playerInput,
                    excludeTurnIndex: gameState.回合数 || 0,
                    excludePlayerInput: true,
                    fallbackGameTime: gameState.游戏时间
                },
                gameState.日志摘要,
                gameState.日志大纲,
                gameState
            );
        case 'COMMAND_HISTORY':
            return commandHistory.length > 0 ? `[指令历史]\n${commandHistory.join('\n')}` : "[指令历史] (Empty)";
        case 'USER_INPUT': {
            const narrativeOnlyStoryPrompt = shouldUseNarrativeOnlyStoryPrompt(settings);
            let inputText = `\n[玩家输入]\n"${playerInput}"`;
            const extraRequirementPrompt = String(settings.writingConfig?.extraRequirementPrompt || '').trim();
            if (extraRequirementPrompt) {
                inputText += `\n\n[额外要求提示词]\n${extraRequirementPrompt}`;
            }
            if (settings.writingConfig?.enableWordCountRequirement) {
                const required = settings.writingConfig.requiredWordCount || 800;
                inputText += narrativeOnlyStoryPrompt
                    ? `\n\n[字数强约束]\n- 本次回复的正文剧情部分（logs.text）**必须保证在${required}字以上**。\n- 请确保正文篇幅充实，细节丰富。`
                    : `\n\n[字数强约束]\n- 本次回复的正文剧情部分（logs.text）**必须保证在${required}字以上**。\n- 请确保正文篇幅充实，细节丰富，**严禁**正文短于思考内容（thinking）。`;
            }
            if (settings.aiConfig?.nativeThinkingChain !== false && !narrativeOnlyStoryPrompt) {
                const nextField = settings.aiConfig?.multiStageThinking ? 'thinking_plan' : 'thinking_pre';
                inputText += `\n<think>好，思考结束</think>\n\n接下来以"${nextField}"作为开头进行思考`;
            }
            if (narrativeOnlyStoryPrompt) {
                const nativeThinkingEnabled = settings.aiConfig?.nativeThinkingChain !== false;
                inputText += `\n\n[主叙事输出限制]\n- 仅输出 logs/action_options（如启用）。\n- 必须返回 \`"tavern_commands": []\`。${nativeThinkingEnabled ? '\n- 保留 thinking 字段输出（按当前 thinking 模式）。' : '\n- 不输出 thinking 字段。'}`;
            }
            return inputText;
        }
        default:
            return "";
    }
};

export const assembleFullPrompt = (
    playerInput: string,
    gameState: GameState,
    settings: AppSettings,
    commandHistory: string[] = []
): string => {
    const contextModules = settings.contextConfig?.modules || [];
    const narrativeOnlyStoryPrompt = shouldUseNarrativeOnlyStoryPrompt(settings);
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
            const modContent = generateSingleModuleContext(mod, gameState, settings, commandHistory, playerInput);
            if (modContent) {
                fullContent += modContent + "\n\n";
            }
        });
    };

    const orderedTypes: ContextModuleType[] = [
        'SYSTEM_PROMPTS',
        'MEMORY_CONTEXT',
        'PLAYER_DATA',
        'SOCIAL_CONTEXT',
        'MAP_CONTEXT',
        'INVENTORY_CONTEXT',
        'COMBAT_CONTEXT',
        'TASK_CONTEXT',
        'STORY_CONTEXT',
        'WORLD_CONTEXT',
        'FAMILIA_CONTEXT',
        'CONTRACT_CONTEXT',
        'PHONE_CONTEXT'
    ];
    const handledTypes = new Set<ContextModuleType>([...orderedTypes, 'COMMAND_HISTORY', 'USER_INPUT']);

    orderedTypes.forEach(appendModules);

    const remainingModules = enabledModules
        .filter(mod => !handledTypes.has(mod.type))
        .sort((a, b) => a.order - b.order);
    remainingModules.forEach(mod => {
        const modContent = generateSingleModuleContext(mod, gameState, settings, commandHistory, playerInput);
        if (modContent) {
            fullContent += modContent + "\n\n";
        }
    });

    const cotContent = narrativeOnlyStoryPrompt
        ? buildNarrativeOnlyCotPrompt(settings)
        : buildCotPrompt(settings);
    if (cotContent) {
        fullContent += cotContent + "\n\n";
    }
    appendModules('COMMAND_HISTORY');
    appendModules('USER_INPUT');

    const userName = resolvePlayerName(gameState.角色?.姓名);
    fullContent = replaceUserPlaceholders(fullContent, userName);
    fullContent = sanitizeTableFirstPrompt(fullContent);
    if (!narrativeOnlyStoryPrompt) {
        fullContent += `\n\n[协议强制覆盖]\n- 严禁输出 set/add/push/delete 的 gameState path 指令。\n- 仅允许表格白名单动作（upsert_sheet_rows/delete_sheet_rows/upsert_npc/upsert_inventory/append_log_summary/append_log_outline/append_econ_ledger/apply_econ_delta 及战斗扩展动作）。`;
    }
    const hasStateWriter = !!String(settings.aiConfig?.services?.state?.apiKey || '').trim();
    if (hasStateWriter) {
        fullContent += narrativeOnlyStoryPrompt
            ? `\n\n[运行时写入职责覆盖]\n- 当前回合启用“状态服务统一填表”模式。\n- 主叙事只负责 logs 与 action_options（如启用）。\n- 主叙事必须输出 "tavern_commands": []。\n- 剧情/任务/战斗/契约/手机/世界等业务表写入由 state 服务统一执行。`
            : `\n\n[运行时写入职责覆盖]\n- 当前回合启用“状态服务统一填表”模式。\n- 主叙事只负责 logs 与 action_options（如启用）。\n- 主叙事必须输出 "tavern_commands": []，禁止输出任何业务写表命令。\n- 剧情/任务/战斗/契约/手机/世界等业务表写入由 state 服务统一执行。`;
    }
    const unresolvedPlaceholders: string[] = [];
    if (/<玩家>/.test(fullContent)) unresolvedPlaceholders.push('<玩家>');
    if (/{{\\s*user\\s*}}/i.test(fullContent)) unresolvedPlaceholders.push('{{user}}');
    if (/{{\\s*player\\s*}}/i.test(fullContent)) unresolvedPlaceholders.push('{{player}}');
    if (unresolvedPlaceholders.length > 0) {
        console.warn('[PromptCheck] Unresolved user placeholders detected.', unresolvedPlaceholders);
    }

    return fullContent.trim();
};

export const assemblePhonePrompt = (
    playerInput: string,
    gameState: GameState,
    settings: AppSettings
): string => {
    const playerName = resolvePlayerName(gameState.角色?.姓名 || 'Player');
    const isPublicScope = /\[PHONE_POST\]|\[FORUM_AUTO\]|\[手机\/公共频道\]/i.test(playerInput || '');
    const phoneContext = constructPhoneContextFromGameState(gameState, {
        perThreadLimit: isPublicScope ? 8 : 10,
        includeMoments: true,
        includePublicPosts: true,
        forumLimit: isPublicScope ? 4 : 6,
        playerName
    });
    const socialBrief = constructPhoneSocialBrief(gameState.社交, { redactLocation: isPublicScope });
    const trackingBrief = constructPhoneTrackingBrief(gameState, { redactLocation: isPublicScope });
    const envBrief = constructPhoneEnvironmentBrief(gameState, { redactLocation: isPublicScope });
    const storyBrief = constructPhoneStoryBrief(gameState);
    const worldBrief = constructPhoneWorldBrief(gameState);
    const backdropBrief = constructPhoneNarrativeBackdrop(gameState);
    const worldview = constructPhoneWorldview(settings);
    const memoryBrief = constructPhoneMemoryBrief(gameState.记忆, gameState);
    const cot = P_PHONE_COT || "";
    const fullContent = [
        P_PHONE_SYSTEM,
        cot,
        worldview,
        envBrief,
        storyBrief,
        worldBrief,
        backdropBrief,
        memoryBrief,
        trackingBrief,
        socialBrief,
        phoneContext,
        `[用户输入]\n${playerInput}`
    ].filter(Boolean).join('\n\n');
    return sanitizeTableFirstPrompt(replaceUserPlaceholders(fullContent, playerName));
};

export const isCotModulePublic = isCotModule;

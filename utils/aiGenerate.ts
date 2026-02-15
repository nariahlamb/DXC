import { AppSettings, AIResponse, GameState, PhoneAIResponse } from "../types";
import { dispatchAIRequest, resolveRequestTimeoutMs, resolveServiceConfig } from "./aiDispatch";
import { assembleFullPrompt, assemblePhonePrompt } from "./aiPrompt";
import { extractThinkingBlocks, mergeThinkingSegments } from "./aiThinking";
import { parseAIResponseText } from "./aiJson";

const isDoneMarkerOnlyResponse = (rawText: string) => {
    const normalized = (rawText || '').trim();
    if (!normalized) return false;
    const lines = normalized
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    if (lines.length === 0) return false;
    return lines.every(line => /^(data:\s*)?\[done\]$/i.test(line));
};

const PROMPT_MAX_TOTAL_CHARS = 120000;
const PROMPT_MAX_SYSTEM_CHARS = 100000;
const PROMPT_MAX_USER_CHARS = 12000;

const normalizePromptBudget = (raw: unknown, fallback: number) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    const normalized = Math.floor(parsed);
    if (normalized < 2000) return fallback;
    return normalized;
};

const truncateWithHeadTail = (text: string, maxChars: number): string => {
    if (text.length <= maxChars) return text;
    if (maxChars <= 64) return text.slice(0, Math.max(0, maxChars));
    const ellipsis = '\n...[TRUNCATED]...\n';
    const available = maxChars - ellipsis.length;
    const headSize = Math.max(1, Math.floor(available * 0.7));
    const tailSize = Math.max(1, available - headSize);
    return `${text.slice(0, headSize)}${ellipsis}${text.slice(text.length - tailSize)}`;
};

const applyPromptBudget = (
    systemPrompt: string,
    userContent: string,
    settings: AppSettings,
    serviceKey: 'story' | 'phone' | 'world' | 'map'
): { systemPrompt: string; userContent: string; truncated: boolean } => {
    const aiConfig = settings?.aiConfig as any;
    const totalBudget = normalizePromptBudget(
        aiConfig?.servicePromptMaxChars?.[serviceKey] ?? aiConfig?.promptMaxChars,
        PROMPT_MAX_TOTAL_CHARS
    );
    const systemBudget = Math.min(
        normalizePromptBudget(aiConfig?.systemPromptMaxChars, PROMPT_MAX_SYSTEM_CHARS),
        totalBudget
    );
    const userBudget = Math.min(
        normalizePromptBudget(aiConfig?.userPromptMaxChars, PROMPT_MAX_USER_CHARS),
        totalBudget
    );

    let nextSystem = truncateWithHeadTail(systemPrompt, systemBudget);
    let nextUser = truncateWithHeadTail(userContent, userBudget);
    let combinedLength = nextSystem.length + nextUser.length;

    if (combinedLength > totalBudget) {
        const keepUser = Math.min(nextUser.length, Math.max(1000, Math.floor(totalBudget * 0.2)));
        nextUser = truncateWithHeadTail(nextUser, keepUser);
        const remainingSystem = Math.max(1000, totalBudget - nextUser.length);
        nextSystem = truncateWithHeadTail(nextSystem, remainingSystem);
        combinedLength = nextSystem.length + nextUser.length;
        if (combinedLength > totalBudget) {
            nextSystem = truncateWithHeadTail(nextSystem, Math.max(1000, totalBudget - nextUser.length));
        }
    }

    const truncated = nextSystem.length !== systemPrompt.length || nextUser.length !== userContent.length;
    if (truncated) {
        console.warn('[AI Prompt Budget] prompt truncated', {
            serviceKey,
            systemBefore: systemPrompt.length,
            systemAfter: nextSystem.length,
            userBefore: userContent.length,
            userAfter: nextUser.length,
            totalBudget
        });
    }
    return { systemPrompt: nextSystem, userContent: nextUser, truncated };
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
    const baseSystemPrompt = assembleFullPrompt(input, gameState, settings, commandsOverride);
    const baseUserContent = [
        `Player Input: "${input}"`,
        'Please respond in JSON format as defined in system prompt.',
        'Output must be a single JSON object only (no markdown code fence).',
        'All line breaks inside JSON strings must be escaped as \\n.'
    ].join('\n');
    const { systemPrompt, userContent } = applyPromptBudget(baseSystemPrompt, baseUserContent, settings, 'story');

    let rawText = "";
    try {
        const storyConfig = resolveServiceConfig(settings, 'story');
        const storyTimeoutMs = resolveRequestTimeoutMs(settings, 'story');
        const streamCallback = settings.enableStreaming ? onStream : undefined;
        rawText = await dispatchAIRequest(
            storyConfig,
            systemPrompt,
            userContent,
            streamCallback,
            { responseFormat: 'json', signal, timeoutMs: storyTimeoutMs }
        );

        // Some OpenAI-compatible gateways may occasionally return only "data: [DONE]".
        // Retry once without stream callback to fetch full JSON payload.
        if (isDoneMarkerOnlyResponse(rawText)) {
            rawText = await dispatchAIRequest(
                storyConfig,
                systemPrompt,
                userContent,
                undefined,
                { responseFormat: 'json', signal, timeoutMs: storyTimeoutMs }
            );
        }

        if (!rawText || !rawText.trim() || isDoneMarkerOnlyResponse(rawText)) throw new Error("AI returned empty response.");

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
            rawResponse: rawText || error.message
        };
    }
};

export const generatePhoneResponse = async (
    input: string,
    gameState: GameState,
    settings: AppSettings,
    signal?: AbortSignal
): Promise<PhoneAIResponse> => {
    const baseSystemPrompt = assemblePhonePrompt(input, gameState, settings);
    const baseUserContent = [
        `Phone Input: "${input}"`,
        '请仅输出 JSON。',
        '禁止 markdown 代码块。',
        '字符串中的换行必须使用 \\n 转义。'
    ].join('\n');
    const { systemPrompt, userContent } = applyPromptBudget(baseSystemPrompt, baseUserContent, settings, 'phone');
    const phoneConfig = resolveServiceConfig(settings, 'phone');
    const storyConfig = !phoneConfig?.apiKey ? resolveServiceConfig(settings, 'story') : null;
    const config = storyConfig?.apiKey ? storyConfig : phoneConfig;
    const timeoutServiceKey = storyConfig?.apiKey ? 'story' : 'phone';
    const phoneTimeoutMs = resolveRequestTimeoutMs(settings, timeoutServiceKey);

    let rawText = "";
    try {
        rawText = await dispatchAIRequest(
            config,
            systemPrompt,
            userContent,
            undefined,
            { responseFormat: 'json', signal, timeoutMs: phoneTimeoutMs }
        );
        if (!rawText || !rawText.trim()) throw new Error("AI returned empty response.");
        const extractedThinking = extractThinkingBlocks(rawText).thinking;
        const parsedResult = parseAIResponseText(rawText);
        if (parsedResult.response) {
            const parsed = parsedResult.response as unknown as PhoneAIResponse;
            const parsedThinking = mergeThinkingSegments(parsed as any);
            return {
                allowed: parsed.allowed ?? true,
                ...parsed,
                rawResponse: rawText,
                thinking: parsedThinking || extractedThinking,
                ...(parsedResult.repairNote ? { repairNote: parsedResult.repairNote } : {})
            };
        }
        return {
            allowed: false,
            blocked_reason: `JSON解析失败: ${parsedResult.error || "未知错误"}`,
            rawResponse: rawText
        };
    } catch (error: any) {
        if (error?.name === 'AbortError' || /abort/i.test(error?.message || '')) throw error;
        const rawBlock = rawText ? `\n\n【原始AI消息】\n${rawText}` : "";
        return {
            allowed: false,
            blocked_reason: `系统错误: ${error.message}${rawBlock}`,
            rawResponse: rawText || error.message
        };
    }
};

const MAP_SCHEMA_INSTRUCTION = `
【地图生成特别指令】
请根据当前场景生成详细的战术地图数据。严格遵守以下 JSON Schema 格式，并将其放入 JSON 响应的 \`tavern_commands\` 数组中。

【目标】
- MID 地图必须由 \`upsert_exploration_map\` + \`MapStructureJSON\` 驱动 SVG 渲染。
- 禁止返回“仅叙事描述”或“仅空命令”。
- 如果当前地点是室内/区域场景，必须返回地图结构命令。

【探索场景（非战斗）必须使用 command: \`upsert_exploration_map\`】
{
  "command": "upsert_exploration_map",
  "value": {
      "LocationName": "<当前场景名>",
      "MapStructureJSON": {
          "mapName": "string",
          "mapSize": { "width": 800, "height": 600 },
          "rooms": [
            {
              "id": "room_1",
              "name": "入口大厅",
              "type": "entrance/corridor/room/hall/secret_room/boss",
              "shape": "rectangular/circular/irregular/cave_blob",
              "x": 100, "y": 100, "width": 200, "height": 120,
              "description": "描述...",
              "color": "#hex"
            }
          ],
          "doors": [
            {
              "x": 300, "y": 160,
              "type": "open/door/secret_door/barred",
              "orientation": "horizontal/vertical",
              "connects": ["room_1", "room_2"]
            }
          ],
          "features": [
            { "x": 150, "y": 150, "type": "column/statue/chest/trap/fountain/table" }
          ]
      }
  }
}
*注意：MapStructureJSON 必须是对象，不要输出字符串化 JSON。*

【探索地图生成规则（必须遵守）】
1. 至少包含 8-12 个区域（房间 + 走廊），必须有入口与 Boss/核心区域。
2. 走廊(corridor)本身就是长条形房间，禁止用抽象线条表示路径。
3. 房间与走廊的坐标需紧密拼接，边缘贴合，形成连通整体。
4. 门与通道必须位于共享墙壁处（doors 连接 rooms 的 id）。
5. 布局允许不规则，但坐标必须在 mapSize 范围内。
6. 需要体现“可用性”：包含至少 2 个可交互/掩体特征（features）。
7. 地图风格目标：接近“酒馆助手 DND 沉浸式仪表盘 v1.9.0 + DND仪表盘配套模板”的结构化房间表达，而非抽象块图。
8. 返回命令时，LocationName 必须对齐当前地点中文名。

【输出约束】
- 仅输出 JSON。
- \`tavern_commands\` 至少包含 1 条 \`upsert_exploration_map\`。
- 禁止把探索地图误用为 \`set_map_visuals\`。

【战斗场景必须返回战斗视觉 + 战斗单位坐标】
{
  "command": "set_map_visuals",
  "value": {
      "地图尺寸": { "宽度": 20, "高度": 20 },
      "地形描述": "string",
      "特殊区域": [
        { "名称": "掩体区", "位置": { "x": 5, "y": 5 }, "范围": 2, "效果": "半掩体" }
      ],
      "光照": "昏暗",
      "天气": "潮湿"
  }
}

{
  "command": "upsert_battle_map_rows",
  "value": [
    {
      "UNIT_ID": "PC_001",
      "名称": "主角",
      "类型": "玩家",
      "位置": { "x": 2, "y": 3 },
      "生命值": { "当前": 20, "最大": 20 },
      "状态": "正常"
    },
    {
      "UNIT_ID": "ENEMY_001",
      "名称": "哥布林",
      "类型": "敌人",
      "位置": { "x": 8, "y": 6 },
      "生命值": { "当前": 12, "最大": 12 },
      "状态": "正常"
    }
  ]
}

兼容写法：也可直接返回 \`战斗.视觉\` 与 \`战斗.地图\`，系统会自动转换为上述命令。
若参考酒馆助手模板输出 legacy 行（Config/Token/Wall/Terrain/Zone）：
- 必须包含 1 条 Config 尺寸信息（如 \`{"单位名称":"Map_Config","类型":"Config","坐标":{"w":20,"h":20}}\`）。
- 每个在场单位必须有 1 条 Token 行，坐标是网格整数，禁止输出像素坐标（如 320,480 这类画布坐标）。
若返回 COMBAT_Map_Visuals 风格数据，VisualJSON 应包含 dimensions，且 GridSize 建议为 \`20x20\`。
`;

export const generateWorldInfoResponse = async (
    input: string,
    gameState: GameState,
    settings: AppSettings,
    signal?: AbortSignal,
    onStream?: (chunk: string) => void
): Promise<AIResponse> => {
    const isMapRequest = input.includes('Tactical Map') || input.includes('Visual Layout') || input.includes('地图数据') || input.includes('战术地图');
    
    let systemPrompt: string;
    let userContent: string;
    
    if (isMapRequest) {
        // Lightweight prompt for map generation - only include essential context
        const currentLocation = gameState.当前地点 || '未知地点';
        const currentFloor = gameState.当前楼层;
        const locationContext = {
            当前地点: currentLocation,
            当前楼层: currentFloor,
            场景描述: gameState.场景描述
        };
        
        systemPrompt = `你是一个专业的地图数据生成器。你的唯一任务是根据地点信息生成结构化的地图数据。
禁止生成任何叙事内容、新闻、传闻或故事。
只输出 JSON 格式的 tavern_commands。

【当前场景上下文】
${JSON.stringify(locationContext, null, 2)}

${MAP_SCHEMA_INSTRUCTION}`;
        
        userContent = [
            `生成地点「${currentLocation}」的详细战术地图数据。`,
            '只返回 JSON，包含 tavern_commands 数组，必须有 upsert_exploration_map 命令。',
            '禁止 markdown 代码块。',
            '字符串中的换行必须使用 \\n 转义。'
        ].join('\n');
    } else {
        systemPrompt = assembleFullPrompt(input, gameState, settings, []);
        userContent = [
            `World Update Input: "${input}"`,
            '请仅输出 JSON。',
            '禁止 markdown 代码块。',
            '字符串中的换行必须使用 \\n 转义。'
        ].join('\n');
    }
    const budgeted = applyPromptBudget(systemPrompt, userContent, settings, isMapRequest ? 'map' : 'world');
    systemPrompt = budgeted.systemPrompt;
    userContent = budgeted.userContent;
    
    const config = resolveServiceConfig(settings, isMapRequest ? 'map' : 'world');
    const timeoutMs = resolveRequestTimeoutMs(settings, isMapRequest ? 'map' : 'world');

    let rawText = "";
    try {
        rawText = await dispatchAIRequest(
            config,
            systemPrompt,
            userContent,
            onStream,
            { responseFormat: 'json', signal, timeoutMs }
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
            rawResponse: rawText,
            thinking: extractedThinking
        };
    } catch (error: any) {
        if (error?.name === 'AbortError' || /abort/i.test(error?.message || '')) throw error;
        const rawBlock = rawText ? `\n\n【原始AI消息】\n${rawText}` : "";
        return {
            tavern_commands: [],
            logs: [{ sender: "system", text: `系统错误: ${error.message}${rawBlock}` }],
            rawResponse: rawText || error.message
        };
    }
};

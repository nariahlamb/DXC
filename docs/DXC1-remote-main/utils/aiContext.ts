import { Difficulty } from "../types/enums";
import { normalizeForumBoards, normalizeForumPosts, normalizeNewsItems, normalizeRumorItems } from "./normalizers";
import {
    AppSettings,
    Confidant,
    GameState,
    InventoryItem,
    LogEntry,
    MemoryConfig,
    MemorySystem,
    PhoneMessage,
    PhoneState,
    PhoneThread,
    Task,
    WorldMapData
} from "../types";
import { LogSummary, LogOutline } from "./contracts";
import { buildFactBoundary, formatFactBoundaryBlock } from "./memory/factBoundary";
import { buildTavernTableSearchRows, projectGameStateToTavernTables } from "./taverndb/tableProjection";
import { formatTavernTableRetrievalBlock, retrieveTavernTableRows } from "./memory/tavernTableRetriever";
import { buildMemoryIndexProjection, type MemoryIndexSource } from "./memory/memoryIndexProjection";
import { formatMemoryRetrievalBlock, retrieveMemoryByQuery } from "./memory/memoryRetriever";
import { buildPhoneStateFromTables } from "./taverndb/phoneTableAdapter";

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
    contextOutput += "⚠️ 指令提示：修改NPC属性请使用 `upsert_npc` 或 `upsert_sheet_rows(NPC_Registry)`。\n";

    const teammates: string[] = [];
    const focusChars: string[] = [];
    const presentChars: string[] = [];
    const absentChars: string[] = [];

    confidants.forEach((c, index) => {
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

        const coordInfo = c.坐标 ? { 坐标: c.坐标 } : {};

        if (c.是否队友) {
            const fullData = {
                ...baseInfo,
                ...coordInfo,
                简介: c.简介, 外貌: c.外貌,
                生存数值: c.生存数值 || "需生成",
                能力值: c.能力值 || "需生成",
                装备: c.装备 || "需生成",
                背包: c.背包 || [],
                最近记忆: focusMemories
            };
            teammates.push(JSON.stringify(fullData, null, 2));
        } else if (c.特别关注 || c.强制包含上下文) {
            const isPresent = !!c.是否在场;
            const focusData = {
                ...baseInfo,
                ...coordInfo,
                简介: c.简介, 外貌: c.外貌, 背景: c.背景,
                位置详情: c.位置详情,
                最近记忆: isPresent ? focusMemories : formatMemories(specialAbsentMemoriesRaw)
            };
            focusChars.push(JSON.stringify(focusData));
        } else if (c.是否在场) {
            const presentData = {
                ...baseInfo,
                ...coordInfo,
                外貌: c.外貌,
                最近记忆: lastMemories
            };
            presentChars.push(JSON.stringify(presentData));
        } else {
            const absentData = {
                ...baseInfo,
                最近记忆: formatMemories(absentMemoriesRaw),
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

export const constructMapContext = (gameState: GameState, params: any): string => {
    const floor = typeof params?.forceFloor === 'number' ? params.forceFloor : (gameState.当前楼层 || 0);
    let output = `[地图环境 (Map Context)]\n`;
    output += `当前位置: ${gameState.当前地点} (Floor: ${floor})\n`;
    output += `坐标: X:${gameState.世界坐标?.x || 0} Y:${gameState.世界坐标?.y || 0}\n`;

    const mapData = gameState.地图;
    if (!mapData) return output + '(地图数据丢失)';

    const macroLocations = Array.isArray(mapData.macroLocations) ? mapData.macroLocations : [];
    const midLocations = Array.isArray(mapData.midLocations) ? mapData.midLocations : [];

    const normalizeName = (value?: string) => (value || '').toString().trim().toLowerCase().replace(/\s+/g, '');
    const matchByName = (name: string, target: { name: string; id: string }[]) => {
        const normalized = normalizeName(name);
        if (!normalized) return null;
        return (
            target.find(t => normalizeName(t.name) === normalized)
            || target.find(t => normalized.includes(normalizeName(t.name)))
            || null
        );
    };

    if (macroLocations.length > 0 || midLocations.length > 0) {
        const currentLocationName = gameState.当前地点 || '';
        const currentMid = matchByName(currentLocationName, midLocations as any) as any;
        const currentMacro = currentMid
            ? macroLocations.find(m => m.id === currentMid.parentId)
            : (macroLocations.length === 1 ? macroLocations[0] : null);

        if (currentMacro) output += `当前层级: ${currentMacro.name}${currentMid ? ` > ${currentMid.name}` : ''}\n`;

        const macroSummary = macroLocations.map(m => ({
            id: m.id,
            name: m.name,
            type: m.type,
            coordinates: m.coordinates,
            description: m.description,
            size: m.size ?? (m.area?.radius ? { width: m.area.radius * 2, height: m.area.radius * 2, unit: 'm' } : undefined),
            buildings: m.buildings || []
        }));
        const midSummary = midLocations
            .filter(m => !currentMacro || m.parentId === currentMacro.id)
            .map(m => ({
                id: m.id,
                name: m.name,
                coordinates: m.coordinates,
                parentId: m.parentId,
                description: m.description,
                size: m.size ?? (m.area?.radius ? { width: m.area.radius * 2, height: m.area.radius * 2, unit: 'm' } : undefined),
                buildings: m.buildings || []
            }));

        output += `【大地点(常驻)】\n${JSON.stringify(macroSummary, null, 2)}\n`;
        output += `【中地点(常驻)】\n${JSON.stringify(midSummary, null, 2)}\n`;
        if (floor === 0) {
            if (currentMid) {
                const midPayload = {
                    id: currentMid.id,
                    name: currentMid.name,
                    parentId: currentMid.parentId,
                    coordinates: currentMid.coordinates,
                    area: currentMid.area,
                    description: currentMid.description,
                    layout: currentMid.layout,
                    mapStructure: currentMid.mapStructure
                };
                output += `【中地点-当前局部结构】\n${JSON.stringify(midPayload, null, 2)}\n`;
            } else {
                output += `【中地点-当前局部结构】\n（当前地点未命中中地点，局部结构未载入）\n`;
            }
            return output.trimEnd();
        }
    }

    const surfaceLocations = Array.isArray(mapData.surfaceLocations) ? mapData.surfaceLocations : [];
    const routes = Array.isArray(mapData.routes) ? mapData.routes : [];
    const terrain = Array.isArray(mapData.terrain) ? mapData.terrain : [];
    const territories = Array.isArray(mapData.territories) ? mapData.territories : [];
    const filterByFloor = (items: any[]) => items.filter(item => (item?.floor ?? 0) === floor);

    const floorLocations = filterByFloor(surfaceLocations);
    const floorRoutes = filterByFloor(routes);
    const floorTerrain = filterByFloor(terrain);
    const floorTerritories = filterByFloor(territories);

    if (floor === 0) {
        output += `【地表节点 (Surface)】\n${JSON.stringify(floorLocations, null, 2)}\n`;
        output += `【道路 (Routes)】\n${JSON.stringify(floorRoutes, null, 2)}\n`;
        output += `【地形 (Terrain)】\n${JSON.stringify(floorTerrain, null, 2)}\n`;
        output += `【势力范围 (Territories)】\n${JSON.stringify(floorTerritories, null, 2)}`;
    } else {
        const layerInfo = Array.isArray(mapData.dungeonStructure)
            ? mapData.dungeonStructure.find(l => floor >= l.floorStart && floor <= l.floorEnd)
            : null;

        if (layerInfo) {
            output += `【区域信息 (Layer)】${JSON.stringify(layerInfo)}\n`;
        }

        if (floorLocations.length > 0 || floorRoutes.length > 0 || floorTerrain.length > 0 || floorTerritories.length > 0) {
            if (floorLocations.length > 0) output += `【已探明节点 (Nodes)】\n${JSON.stringify(floorLocations, null, 2)}\n`;
            if (floorRoutes.length > 0) output += `【道路 (Routes)】\n${JSON.stringify(floorRoutes, null, 2)}\n`;
            if (floorTerrain.length > 0) output += `【地形 (Terrain)】\n${JSON.stringify(floorTerrain, null, 2)}\n`;
            if (floorTerritories.length > 0) output += `【势力范围 (Territories)】\n${JSON.stringify(floorTerritories, null, 2)}`;
            output = output.trimEnd();
        } else {
            output += `【未知区域】本层尚未探索，请根据 <地图动态绘制> 规则生成节点。`;
        }
    }
    return output;
};

export const constructMapBaseContext = (mapData?: WorldMapData): string => {
    if (!mapData) return "";
    const factions = Array.isArray(mapData.factions) ? mapData.factions : [];
    const basePayload = {
        config: mapData.config || undefined,
        factions: factions.length > 0 ? factions : undefined
    };
    if (!basePayload.config && !basePayload.factions) return "";
    return `【地图基础】\n${JSON.stringify(basePayload, null, 2)}`;
};

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
    const gameTime = params?.gameTime || world?.当前时间;
    const news = normalizeNewsItems(world?.头条新闻, gameTime).map(item => ({
        标题: item.标题,
        时间戳: item.时间戳,
        来源: item.来源,
        重要度: item.重要度
    }));
    const rumors = normalizeRumorItems(world?.街头传闻, gameTime).map(item => ({
        主题: item.主题,
        传播度: item.传播度,
        可信度: item.可信度,
        来源: item.来源
    }));
    const schedulerLine = params?.includeSchedulerMeta === true
        ? `\n下次更新回合: ${typeof world.下次更新回合 === 'number' ? world.下次更新回合 : "待定"}`
        : '';
    return `[世界动态 (World State)]\n` +
           `异常指数: ${world.异常指数}\n` +
           `头条新闻: ${JSON.stringify(news)}\n` +
           `街头传闻: ${JSON.stringify(rumors)}\n` +
           `诸神神会: ${JSON.stringify(world.诸神神会 || {}, null, 0)}\n` +
           `NPC后台跟踪: ${JSON.stringify(world.NPC后台跟踪 || [])}\n` +
           `派阀格局: ${JSON.stringify(world.派阀格局 || {}, null, 0)}\n` +
           `战争游戏: ${JSON.stringify(world.战争游戏 || {}, null, 0)}` +
           schedulerLine;
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

export const constructPhoneContext = (phoneState: PhoneState | undefined, params: any): string => {
    let output = "[手机通讯 (Phone)]\n";
    if (!phoneState) return output + "（终端未接入）";

    const device = phoneState.设备 || { 电量: 0, 当前信号: 0 };
    const battery = typeof device.电量 === 'number' ? device.电量 : 0;
    const signal = typeof device.当前信号 === 'number' ? device.当前信号 : 0;
    const status = device.状态 || (battery <= 0 ? 'offline' : 'online');

    output += `终端状态: 电量 ${battery}%, 信号 ${signal}/4, 状态 ${status}\n`;

    const friends = Array.isArray(phoneState.联系人?.好友) ? phoneState.联系人.好友 : [];
    const recent = Array.isArray(phoneState.联系人?.最近) ? phoneState.联系人.最近 : [];
    if (friends.length > 0) output += `好友: ${friends.join(', ')}\n`;
    if (recent.length > 0) output += `最近联系人: ${recent.join(', ')}\n`;

    const perThreadLimit = typeof params?.perThreadLimit === 'number'
        ? params.perThreadLimit
        : (typeof params?.perTargetLimit === 'number' ? params.perTargetLimit : 10);
    const includeMoments = params?.includeMoments !== false;
    const momentLimit = typeof params?.momentLimit === 'number' ? params.momentLimit : 6;
    const includePublicPosts = params?.includePublicPosts !== false;
    const forumLimit = typeof params?.forumLimit === 'number' ? params.forumLimit : 6;

    const targetFilter = Array.isArray(params?.targets) && params.targets.length > 0 ? new Set(params.targets) : null;
    const targetLimits = params?.targetLimits || {};
    const playerName = params?.playerName || 'Player';
    const normalizeText = (value: unknown) => String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');
    const excludedThreadTitles = Array.isArray(params?.excludeThreadTitles)
        ? params.excludeThreadTitles.map((v: any) => String(v || '').trim()).filter(Boolean)
        : [];
    const excludedTitleTokens = excludedThreadTitles.map(normalizeText).filter(Boolean);
    const shouldExcludeThreadLike = (value: unknown) => {
        const normalized = normalizeText(value);
        if (!normalized) return false;
        return excludedTitleTokens.some(token => normalized.includes(token) || token.includes(normalized));
    };

    const getSortValue = (m: PhoneMessage) => {
        if (typeof m.timestampValue === 'number') return m.timestampValue;
        const parsed = parseGameTimeLabel(m.时间戳);
        if (parsed.sortValue !== null) return parsed.sortValue;
        return 0;
    };

    const formatMessage = (m: PhoneMessage) => {
        const time = m.时间戳 || '';
        const sender = m.发送者 || '未知';
        let content = m.内容 || '';
        if (m.图片描述) content += ` (图片: ${m.图片描述})`;
        if (m.引用?.内容) {
            const quoteSender = m.引用.发送者 ? `${m.引用.发送者}: ` : '';
            content += ` (引用: ${quoteSender}${m.引用.内容})`;
        }
        return `[${time}] ${sender}: ${content}`;
    };

    const buildThreadBlock = (label: string, threads: PhoneThread[], applyFilter: boolean) => {
        if (!threads || threads.length === 0) return;
        output += `${label}:\n`;
        threads.forEach(t => {
            if (applyFilter && targetFilter && !targetFilter.has(t.标题)) return;
            const limitOverride = typeof targetLimits?.[t.标题] === 'number' ? targetLimits[t.标题] : perThreadLimit;
            const messages = Array.isArray(t.消息) ? t.消息.slice().sort((a, b) => getSortValue(a) - getSortValue(b)) : [];
            if (shouldExcludeThreadLike(t.标题) || messages.some(m => shouldExcludeThreadLike(m.发送者))) return;
            const trimmed = limitOverride > 0 ? messages.slice(-limitOverride) : messages;
            if (trimmed.length === 0) return;
            output += `- ${t.标题} (${t.类型})\n`;
            if (t.摘要) {
                const summaryStamp = t.摘要时间 ? ` 截至 ${t.摘要时间}` : '';
                output += `  [摘要${summaryStamp}] ${t.摘要}\n`;
            }
            trimmed.forEach(m => {
                output += `  ${formatMessage(m)}\n`;
            });
        });
    };

    buildThreadBlock("私聊", phoneState.对话?.私聊 || [], true);
    buildThreadBlock("群聊", phoneState.对话?.群聊 || [], false);
    buildThreadBlock("公共频道", phoneState.对话?.公共频道 || [], false);

    if (includeMoments && Array.isArray(phoneState.朋友圈?.帖子)) {
        const friendSet = new Set(friends);
        const feed = phoneState.朋友圈?.仅好友可见
            ? phoneState.朋友圈.帖子.filter(p => p.发布者 === playerName || friendSet.has(p.发布者))
            : phoneState.朋友圈.帖子;
        const sorted = [...feed].sort((a, b) => (a.timestampValue || 0) - (b.timestampValue || 0));
        const trimmed = momentLimit > 0 ? sorted.slice(-momentLimit) : sorted;
        if (trimmed.length > 0) {
            output += "朋友圈动态:\n";
            trimmed.forEach(m => {
                const tags = Array.isArray(m.话题) && m.话题.length > 0 ? ` #${m.话题.join(' #')}` : '';
                output += `- [${m.时间戳 || ''}] ${m.发布者}: ${m.内容}${tags}\n`;
            });
        }
    }

    if (includePublicPosts) {
        const boards = normalizeForumBoards(phoneState.公共帖子?.板块);
        const forumPosts = normalizeForumPosts(phoneState.公共帖子?.帖子, boards);
        const sorted = [...forumPosts].sort((a, b) => (a.timestampValue || 0) - (b.timestampValue || 0));
        const trimmed = forumLimit > 0 ? sorted.slice(-forumLimit) : sorted;
        if (trimmed.length > 0) {
            output += "公共论坛:\n";
            trimmed.forEach(p => {
                const tag = Array.isArray(p.话题标签) && p.话题标签.length > 0 ? ` [${p.话题标签.join('/')}]` : '';
                const board = p.板块 ? `(${p.板块}) ` : '';
                output += `- [${p.时间戳 || ''}] ${board}${p.发布者}: ${p.标题} - ${p.内容}${tag}\n`;
            });
        }
    }

    if (Array.isArray(phoneState.待发送) && phoneState.待发送.length > 0) {
        const pendingBrief = phoneState.待发送.slice(0, 6).map(p => `${p.threadId} -> ${p.deliverAt}`).join(' | ');
        output += `\n待发送队列: ${pendingBrief}${phoneState.待发送.length > 6 ? ' ...' : ''}`;
    }

    return output.trim();
};

export const constructPhoneContextFromGameState = (gameState: GameState, params: any): string => {
    const phoneState = buildPhoneStateFromTables(gameState);
    return constructPhoneContext(phoneState, params);
};

export const constructPhoneSocialBrief = (
    confidants: Confidant[] = [],
    options?: { redactLocation?: boolean }
): string => {
    const redactLocation = options?.redactLocation === true;
    const list = confidants
        .filter(c => c.已交换联系方式)
        .map(c => ({
            姓名: c.姓名,
            关系: c.关系状态,
            是否在场: !!c.是否在场,
            ...(redactLocation ? {} : {
                位置: c.位置详情 || (c.坐标 ? `(${Math.round(c.坐标.x)},${Math.round(c.坐标.y)})` : undefined)
            })
        }));
    return `[手机联系人摘要]\n${list.length > 0 ? JSON.stringify(list, null, 2) : '（暂无已交换联系方式的联系人）'}`;
};

export const constructPhoneTrackingBrief = (
    gameState: GameState,
    options?: { redactLocation?: boolean }
): string => {
    const tracks = Array.isArray(gameState.世界?.NPC后台跟踪) ? gameState.世界.NPC后台跟踪 : [];
    if (tracks.length === 0) return `[NPC后台跟踪]\n（暂无在跟踪的NPC行动）`;
    const redactLocation = options?.redactLocation === true;
    const contactSet = new Set((gameState.社交 || []).filter(c => c.已交换联系方式).map(c => c.姓名));
    const filtered = tracks.filter(t => !contactSet.size || contactSet.has(t.NPC));
    const trimmed = (filtered.length > 0 ? filtered : tracks).slice(0, 8).map(t => ({
        NPC: t.NPC,
        当前行动: t.当前行动,
        ...(redactLocation ? {} : { 位置: t.位置 }),
        进度: t.进度,
        预计完成: t.预计完成
    }));
    return `[NPC后台跟踪]\n${JSON.stringify(trimmed, null, 2)}`;
};

export const constructPhoneStoryBrief = (gameState: GameState): string => {
    const story = gameState.剧情 || ({} as any);
    const main = story.主线 || {};
    const guide = story.引导 || {};
    return `[剧情摘要]\n主线: ${main.当前阶段 || '未知'} / ${main.关键节点 || '未知'}\n引导目标: ${guide.当前目标 || '未知'}`;
};

export const constructPhoneEnvironmentBrief = (
    gameState: GameState,
    options?: { redactLocation?: boolean }
): string => {
    const redactLocation = options?.redactLocation === true;
    const locationLabel = redactLocation ? '同城公共区域（精确位置隐藏）' : (gameState.当前地点 || '未知');
    const floorLabel = redactLocation ? '未公开' : (gameState.当前楼层 ?? '未知');
    return `[当前环境]\n时间: ${gameState.当前日期 || ''} ${gameState.游戏时间 || ''}\n地点: ${locationLabel} / 楼层: ${floorLabel} / 天气: ${gameState.天气 || '未知'}\n战斗中: ${gameState.战斗?.是否战斗中 ? '是' : '否'}`;
};

export const constructPhoneWorldBrief = (gameState: GameState): string => {
    const world = gameState.世界 || ({} as any);
    const news = normalizeNewsItems(world.头条新闻, gameState.游戏时间).slice(0, 5);
    const rumors = normalizeRumorItems(world.街头传闻, gameState.游戏时间).slice(0, 5);
    const newsText = news.length > 0 ? news.map(item => item.标题).join(' / ') : '无';
    const rumorText = rumors.length > 0 ? rumors.map(item => item.主题).join(' / ') : '无';
    return `[世界情报摘要]\n头条: ${newsText}\n传闻: ${rumorText}`;
};

export const constructPhoneNarrativeBackdrop = (gameState: GameState): string => {
    const world = gameState.世界 || ({} as any);
    const phoneState = buildPhoneStateFromTables(gameState);
    const boards = normalizeForumBoards(phoneState.公共帖子?.板块);
    const posts = normalizeForumPosts(phoneState.公共帖子?.帖子, boards, gameState.游戏时间);
    const news = normalizeNewsItems(world.头条新闻, gameState.游戏时间);

    const postScore = (post: any) => {
        const pinned = post?.置顶 ? 10000 : 0;
        const featured = post?.精华 ? 6000 : 0;
        const likes = typeof post?.点赞数 === 'number' ? post.点赞数 : 0;
        const replies = Array.isArray(post?.回复) ? post.回复.length : 0;
        const ts = typeof post?.timestampValue === 'number' ? post.timestampValue : 0;
        return pinned + featured + likes * 3 + replies * 8 + ts / 1e12;
    };
    const newsScore = (item: any) => {
        const importance = item?.重要度 === 'urgent' ? 3 : (item?.重要度 === 'normal' ? 2 : 1);
        const withContent = typeof item?.内容 === 'string' && item.内容.trim().length > 0 ? 1 : 0;
        return importance * 10 + withContent;
    };

    const topPosts = [...posts]
        .sort((a, b) => postScore(b) - postScore(a))
        .slice(0, 4);
    const topNews = [...news]
        .sort((a, b) => newsScore(b) - newsScore(a))
        .slice(0, 4);

    if (topPosts.length === 0 && topNews.length === 0) return '';

    const postLines = topPosts.map((post, idx) => {
        const replyCount = Array.isArray(post.回复) ? post.回复.length : 0;
        return `${idx + 1}. [${post.板块 || '欧拉丽快报'}] ${post.标题} | ${post.发布者} | 赞${post.点赞数 || 0}/回${replyCount}`;
    });
    const newsLines = topNews.map((item, idx) => {
        const importance = item.重要度 || 'normal';
        const brief = typeof item.内容 === 'string' && item.内容.trim()
            ? ` | ${item.内容.slice(0, 24)}${item.内容.length > 24 ? '…' : ''}`
            : '';
        return `${idx + 1}. [${importance}/${item.来源 || 'guild'}] ${item.标题}${brief}`;
    });

    return [
        '[叙事背景音/主贴与主要新闻]',
        '以下仅作为背景信号，AI可自行判断是否触发互动、分支事件或可选任务；不要求每条都触发。',
        postLines.length > 0 ? `主贴:\n${postLines.join('\n')}` : '主贴: 无',
        newsLines.length > 0 ? `主要新闻:\n${newsLines.join('\n')}` : '主要新闻: 无'
    ].join('\n');
};

export const constructPhoneWorldview = (settings: AppSettings): string => {
    const modules = (settings.promptModules || [])
        .filter(m => m.group === '世界观设定' && m.isActive)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (modules.length === 0) return '';
    return `[世界观设定]\n${modules.map(m => m.content).join('\n\n')}`;
};

export const constructPhoneMemoryBrief = (memory: MemorySystem | undefined, gameState?: GameState): string => {
    if (gameState) {
        const summaries = Array.isArray(gameState.日志摘要) ? gameState.日志摘要.slice(-3) : [];
        const outlines = Array.isArray(gameState.日志大纲) ? gameState.日志大纲.slice(-2) : [];
        if (summaries.length > 0 || outlines.length > 0) {
            const summaryText = summaries
                .map((row) => `${row.编码索引 || '-'} ${row.纪要 || row.摘要 || ''}`.trim())
                .filter(Boolean)
                .join(' | ');
            const outlineText = outlines
                .map((row) => `${row.编码索引 || '-'} ${row.大纲 || row.标题 || ''}`.trim())
                .filter(Boolean)
                .join(' | ');
            return `[记忆摘要]\n总结表: ${summaryText || '无'}\n大纲表: ${outlineText || '无'}`;
        }
    }
    return '';
};

export const constructInventoryContext = (
    inventory: InventoryItem[],
    archivedLoot: InventoryItem[],
    publicLoot: InventoryItem[],
    carrier: string | undefined,
    params: any
): string => {
    let invContent = `[背包物品 (Inventory)]\n${JSON.stringify(inventory, null, 2)}\n\n` +
        `[战利品保管库 (Archived Loot)]\n${JSON.stringify(archivedLoot || [], null, 2)}\n\n` +
        `[公共战利品背包 (Public Loot - Carrier: ${carrier || 'Unknown'})]\n${JSON.stringify(publicLoot || [], null, 2)}`;
    return invContent;
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

type RetrievalMode = 'action' | 'phone' | 'narrative' | 'custom';

interface RetrievalPreset {
    topK: number;
    sheetFilter: string[];
    sheetWeights: Record<string, number>;
}

interface IndexRetrievalOptions {
    topK: number;
    sourceFilter?: MemoryIndexSource[];
    summaryWindow?: number;
    outlineWindow?: number;
}

const TABLE_RETRIEVAL_PRESETS: Record<Exclude<RetrievalMode, 'custom'>, RetrievalPreset> = {
    action: {
        topK: 8,
        sheetFilter: [
            'SYS_GlobalState',
            'UI_ActionOptions',
            'QUEST_Active',
            'QUEST_Objectives',
            'QUEST_ProgressLog',
            'NPC_Registry',
            'NPC_LocationTrace',
            'NPC_InteractionLog',
            'WORLD_News',
            'WORLD_Rumors',
            'MAP_MidLocations',
            'LOG_Summary',
            'LOG_Outline'
        ],
        sheetWeights: {
            SYS_GlobalState: 1.6,
            UI_ActionOptions: 1.8,
            QUEST_Active: 1.6,
            QUEST_Objectives: 1.7,
            QUEST_ProgressLog: 1.4,
            NPC_Registry: 1.2,
            NPC_LocationTrace: 1.2,
            LOG_Summary: 1.1,
            LOG_Outline: 1.0
        }
    },
    phone: {
        topK: 10,
        sheetFilter: [
            'PHONE_Device',
            'PHONE_Contacts',
            'PHONE_Threads',
            'PHONE_Messages',
            'PHONE_Pending',
            'FORUM_Boards',
            'FORUM_Posts',
            'FORUM_Replies',
            'PHONE_Moments',
            'WORLD_News',
            'WORLD_Rumors',
            'LOG_Summary'
        ],
        sheetWeights: {
            PHONE_Threads: 1.8,
            PHONE_Messages: 2.0,
            PHONE_Pending: 1.5,
            FORUM_Posts: 1.5,
            FORUM_Replies: 1.4,
            PHONE_Moments: 1.4
        }
    },
    narrative: {
        topK: 8,
        sheetFilter: [
            'LOG_Summary',
            'LOG_Outline',
            'WORLD_News',
            'WORLD_Rumors',
            'STORY_Mainline',
            'STORY_Triggers',
            'STORY_Milestones',
            'NPC_Registry',
            'NPC_InteractionLog',
            'MAP_SurfaceLocations',
            'MAP_MidLocations',
            'QUEST_Active',
            'QUEST_ProgressLog'
        ],
        sheetWeights: {
            LOG_Summary: 1.8,
            LOG_Outline: 1.7,
            STORY_Mainline: 1.5,
            STORY_Triggers: 1.4,
            WORLD_News: 1.3,
            WORLD_Rumors: 1.3,
            NPC_InteractionLog: 1.2,
            QUEST_ProgressLog: 1.2
        }
    }
};

const resolveTableRetrievalOptions = (params: any) => {
    const modeRaw = String(params?.retrievalMode || params?.retrievalProfile || 'narrative').trim().toLowerCase();
    const mode: RetrievalMode = modeRaw === 'action' || modeRaw === 'phone' || modeRaw === 'custom'
        ? modeRaw
        : 'narrative';
    const preset = mode === 'custom' ? null : TABLE_RETRIEVAL_PRESETS[mode];
    const topK = Number.isFinite(Number(params?.retrievalTopK))
        ? Math.max(1, Number(params.retrievalTopK))
        : (preset?.topK || 8);
    const explicitFilter = Array.isArray(params?.retrievalSheetFilter) ? params.retrievalSheetFilter.map((item: any) => String(item)) : null;
    const sheetFilter = explicitFilter && explicitFilter.length > 0
        ? explicitFilter
        : (preset?.sheetFilter || undefined);
    const presetWeights = preset?.sheetWeights || {};
    const explicitWeights = params?.retrievalSheetWeights && typeof params.retrievalSheetWeights === 'object'
        ? params.retrievalSheetWeights as Record<string, number>
        : {};
    const sheetWeights = { ...presetWeights, ...explicitWeights };
    return {
        mode,
        topK,
        sheetFilter,
        sheetWeights: Object.keys(sheetWeights).length > 0 ? sheetWeights : undefined
    };
};

const INDEX_RETRIEVAL_SOURCE_PRESETS: Record<Exclude<RetrievalMode, 'custom'>, MemoryIndexSource[]> = {
    action: ['paired', 'summary'],
    phone: ['paired', 'summary', 'outline'],
    narrative: ['paired', 'summary', 'outline']
};

const resolveIndexRetrievalOptions = (params: any, mode: RetrievalMode): IndexRetrievalOptions => {
    const topK = Number.isFinite(Number(params?.indexRetrievalTopK))
        ? Math.max(1, Number(params.indexRetrievalTopK))
        : (Number.isFinite(Number(params?.retrievalTopK)) ? Math.max(1, Number(params.retrievalTopK)) : 6);
    const rawFilter = Array.isArray(params?.indexSourceFilter)
        ? params.indexSourceFilter
        : (Array.isArray(params?.retrievalSourceFilter) ? params.retrievalSourceFilter : null);
    const normalizedFilter = rawFilter
        ? rawFilter
            .map((item: unknown) => String(item || '').trim().toLowerCase())
            .map((item) => (item === 'pair' ? 'paired' : item))
            .filter((item): item is MemoryIndexSource => item === 'paired' || item === 'summary' || item === 'outline')
        : [];
    const sourceFilter = normalizedFilter.length > 0
        ? (Array.from(new Set(normalizedFilter)) as MemoryIndexSource[])
        : (mode === 'custom' ? undefined : INDEX_RETRIEVAL_SOURCE_PRESETS[mode]);

    const summaryWindowRaw = params?.indexSummaryWindow ?? params?.retrievalSummaryWindow;
    const outlineWindowRaw = params?.indexOutlineWindow ?? params?.retrievalOutlineWindow;
    const summaryWindow = Number.isFinite(Number(summaryWindowRaw))
        ? Math.max(1, Number(summaryWindowRaw))
        : undefined;
    const outlineWindow = Number.isFinite(Number(outlineWindowRaw))
        ? Math.max(1, Number(outlineWindowRaw))
        : undefined;

    return {
        topK,
        sourceFilter,
        summaryWindow,
        outlineWindow
    };
};

const EMPTY_SUMMARY_ROWS: LogSummary[] = [];
const EMPTY_OUTLINE_ROWS: LogOutline[] = [];
const INDEX_PROJECTION_CACHE_LIMIT = 8;

type TableProjectionCacheEntry = {
    searchRows: ReturnType<typeof buildTavernTableSearchRows>;
    hitsCache: Map<string, ReturnType<typeof retrieveTavernTableRows>>;
};

type IndexProjectionCacheEntry = {
    summaryRef: LogSummary[];
    outlineRef: LogOutline[];
    indexEntries: ReturnType<typeof buildMemoryIndexProjection>;
    hitsCache: Map<string, ReturnType<typeof retrieveMemoryByQuery>>;
};

const tableProjectionCache = new WeakMap<GameState, Map<string, TableProjectionCacheEntry>>();
const indexProjectionCache = new Map<string, IndexProjectionCacheEntry>();
let memoryContextCacheEpoch = 0;

const normalizeCacheToken = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
};

const stableSheetWeightsKey = (weights?: Record<string, number>): string => {
    if (!weights || typeof weights !== 'object') return '';
    return Object.entries(weights)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}:${value}`)
        .join('|');
};

const makeTableProjectionCacheKey = (params: {
    summaryLimit?: number;
    outlineLimit?: number;
    token: string;
}): string => {
    const summaryLimit = Number.isFinite(Number(params.summaryLimit)) ? Number(params.summaryLimit) : -1;
    const outlineLimit = Number.isFinite(Number(params.outlineLimit)) ? Number(params.outlineLimit) : -1;
    return `${memoryContextCacheEpoch}|${params.token}|s=${summaryLimit}|o=${outlineLimit}`;
};

const makeTableHitsCacheKey = (query: string, options: ReturnType<typeof resolveTableRetrievalOptions>): string => {
    const filter = Array.isArray(options.sheetFilter) ? options.sheetFilter.join(',') : '';
    return `q=${query}|topK=${options.topK}|filter=${filter}|weights=${stableSheetWeightsKey(options.sheetWeights)}`;
};

const makeIndexProjectionCacheKey = (params: {
    summaryWindow?: number;
    outlineWindow?: number;
    token: string;
}): string => {
    const summaryWindow = Number.isFinite(Number(params.summaryWindow)) ? Number(params.summaryWindow) : -1;
    const outlineWindow = Number.isFinite(Number(params.outlineWindow)) ? Number(params.outlineWindow) : -1;
    return `${memoryContextCacheEpoch}|${params.token}|sw=${summaryWindow}|ow=${outlineWindow}`;
};

const makeIndexHitsCacheKey = (query: string, options: IndexRetrievalOptions): string => {
    const sourceFilter = Array.isArray(options.sourceFilter) ? options.sourceFilter.join(',') : '';
    return `q=${query}|topK=${options.topK}|source=${sourceFilter}`;
};

const getOrCreateTableProjectionCacheEntry = (
    gameState: GameState,
    params: { summaryLimit?: number; outlineLimit?: number; token: string; }
): TableProjectionCacheEntry => {
    const cacheKey = makeTableProjectionCacheKey(params);
    let gameStateCache = tableProjectionCache.get(gameState);
    if (!gameStateCache) {
        gameStateCache = new Map<string, TableProjectionCacheEntry>();
        tableProjectionCache.set(gameState, gameStateCache);
    }
    const cached = gameStateCache.get(cacheKey);
    if (cached) return cached;

    const projectedTables = projectGameStateToTavernTables(gameState, {
        includeEmptySheets: false,
        summaryLimit: params.summaryLimit,
        outlineLimit: params.outlineLimit
    });
    const entry: TableProjectionCacheEntry = {
        searchRows: buildTavernTableSearchRows(projectedTables),
        hitsCache: new Map<string, ReturnType<typeof retrieveTavernTableRows>>()
    };
    gameStateCache.set(cacheKey, entry);
    return entry;
};

const trimIndexProjectionCache = () => {
    while (indexProjectionCache.size > INDEX_PROJECTION_CACHE_LIMIT) {
        const oldest = indexProjectionCache.keys().next().value;
        if (!oldest) return;
        indexProjectionCache.delete(oldest);
    }
};

const getOrCreateIndexProjectionCacheEntry = (
    summaryRows: LogSummary[],
    outlineRows: LogOutline[],
    params: { summaryWindow?: number; outlineWindow?: number; token: string; }
): IndexProjectionCacheEntry => {
    const cacheKey = makeIndexProjectionCacheKey(params);
    const cached = indexProjectionCache.get(cacheKey);
    if (cached && cached.summaryRef === summaryRows && cached.outlineRef === outlineRows) {
        return cached;
    }

    const entry: IndexProjectionCacheEntry = {
        summaryRef: summaryRows,
        outlineRef: outlineRows,
        indexEntries: buildMemoryIndexProjection(summaryRows, outlineRows, {
            summaryWindow: params.summaryWindow,
            outlineWindow: params.outlineWindow
        }),
        hitsCache: new Map<string, ReturnType<typeof retrieveMemoryByQuery>>()
    };
    indexProjectionCache.set(cacheKey, entry);
    trimIndexProjectionCache();
    return entry;
};

export const markMemoryContextRetrievalDirty = (): void => {
    memoryContextCacheEpoch += 1;
    indexProjectionCache.clear();
};

export const constructMemoryContext = (
    memory: MemorySystem,
    logs: LogEntry[],
    config: MemoryConfig,
    params: any,
    summary?: LogSummary[],
    outline?: LogOutline[],
    gameState?: GameState
): string => {
    let output = "[记忆流 (Memory Stream)]\n";

    const enableMemoryRetrieval = params?.enableMemoryRetrieval !== false;
    const enableTableRetrieval = params?.enableTableRetrieval !== false;
    const enableIndexRetrieval = params?.enableIndexRetrieval !== false;
    const enableFactBoundary = params?.enableFactBoundary !== false;
    const retrievalQuery = typeof params?.retrievalQuery === 'string'
        ? params.retrievalQuery
        : (logs?.[logs.length - 1]?.text || '');
    const retrievalOptions = resolveTableRetrievalOptions(params);
    const indexRetrievalOptions = resolveIndexRetrievalOptions(params, retrievalOptions.mode);
    const memoryContextCacheToken = normalizeCacheToken(
        params?.memoryContextDirtyToken ?? params?.memoryContextCacheKey
    );

    if (enableMemoryRetrieval) {
        let tableRetrieved = false;
        let tableHitCount = 0;

        if (enableTableRetrieval && gameState) {
            const tableCacheEntry = getOrCreateTableProjectionCacheEntry(gameState, {
                summaryLimit: params?.retrievalSummaryWindow,
                outlineLimit: params?.retrievalOutlineWindow,
                token: memoryContextCacheToken
            });
            const tableHitsCacheKey = makeTableHitsCacheKey(retrievalQuery, retrievalOptions);
            let hits = tableCacheEntry.hitsCache.get(tableHitsCacheKey);
            if (!hits) {
                hits = retrieveTavernTableRows(tableCacheEntry.searchRows, retrievalQuery, {
                    topK: retrievalOptions.topK,
                    sheetFilter: retrievalOptions.sheetFilter,
                    sheetWeights: retrievalOptions.sheetWeights
                });
                tableCacheEntry.hitsCache.set(tableHitsCacheKey, hits);
            }
            tableRetrieved = true;
            tableHitCount = hits.length;
            output += `${formatTavernTableRetrievalBlock({
                query: retrievalQuery,
                hits,
                totalCandidates: tableCacheEntry.searchRows.length
            })}\n\n`;
        }

        if (tableRetrieved && tableHitCount === 0) {
            output += `[表格记忆召回 (TavernDB Retrieval)]\n- query: ${retrievalQuery}\n- mode: ${retrievalOptions.mode}\n- hit_count: 0\n\n`;
        }

        if (enableIndexRetrieval) {
            const summaryRows = Array.isArray(summary) ? summary : EMPTY_SUMMARY_ROWS;
            const outlineRows = Array.isArray(outline) ? outline : EMPTY_OUTLINE_ROWS;
            const indexCacheEntry = getOrCreateIndexProjectionCacheEntry(summaryRows, outlineRows, {
                summaryWindow: indexRetrievalOptions.summaryWindow,
                outlineWindow: indexRetrievalOptions.outlineWindow,
                token: memoryContextCacheToken
            });
            const indexHitsCacheKey = makeIndexHitsCacheKey(retrievalQuery, indexRetrievalOptions);
            let hits = indexCacheEntry.hitsCache.get(indexHitsCacheKey);
            if (!hits) {
                hits = retrieveMemoryByQuery(indexCacheEntry.indexEntries, retrievalQuery, {
                    topK: indexRetrievalOptions.topK,
                    sourceFilter: indexRetrievalOptions.sourceFilter
                });
                indexCacheEntry.hitsCache.set(indexHitsCacheKey, hits);
            }
            output += `${formatMemoryRetrievalBlock({
                query: retrievalQuery,
                hits,
                totalCandidates: indexCacheEntry.indexEntries.length
            })}\n\n`;
        }
    }

    if (enableFactBoundary) {
        const boundary = buildFactBoundary(summary, outline, {
            knownFactLimit: params?.knownFactLimit,
            unknownSlotLimit: params?.unknownSlotLimit,
            summaryWindow: params?.factSummaryWindow,
            outlineWindow: params?.factOutlineWindow
        });
        output += `${formatFactBoundaryBlock(boundary)}\n\n`;
    }

    const instantTurnLimit = config.instantLimit || 10; // Number of turns
    const excludeTurnIndex = typeof params?.excludeTurnIndex === 'number' ? params.excludeTurnIndex : null;
    const excludePlayerInput = params?.excludePlayerInput === true;
    const aiOnlyContext = params?.aiOnlyContext !== false;
    const includePrecedingUser = params?.includePrecedingUser !== false;
    const contextLayerLimit = Number.isFinite(Number(params?.contextLayerLimit))
        ? Math.max(1, Number(params.contextLayerLimit))
        : instantTurnLimit;
    const fallbackGameTime = typeof params?.fallbackGameTime === 'string' ? params.fallbackGameTime : "";
    const filteredLogs = (excludePlayerInput && excludeTurnIndex !== null)
        ? logs.filter(l => !(l.sender === 'player' && (l.turnIndex || 0) === excludeTurnIndex))
        : logs;

    const allTurns = Array.from(new Set(filteredLogs.map(l => l.turnIndex || 0))).sort((a, b) => b - a);
    const activeInstantTurns = allTurns.slice(0, instantTurnLimit);
    const minInstantTurn = activeInstantTurns.length > 0 ? activeInstantTurns[activeInstantTurns.length - 1] : 0;

    const instantLogs = filteredLogs.filter(l => (l.turnIndex || 0) >= minInstantTurn);
    const buildInstantContextBlock = () => {
        if (instantLogs.length === 0) {
            return { title: "【即时上下文】: (暂无新消息)", lines: [] as string[] };
        }
        if (!aiOnlyContext) {
            const lines: string[] = [];
            let currentTurn = -1;
            instantLogs.forEach((log) => {
                const turn = log.turnIndex || 0;
                if (turn !== currentTurn) {
                    currentTurn = turn;
                    const logTime = log.gameTime || fallbackGameTime || '??:??';
                    lines.push(``);
                    lines.push(`[Turn ${currentTurn} | ${logTime}]`);
                }
                lines.push(`[${log.sender}]: ${log.text}`);
            });
            return {
                title: `【即时上下文 (Recent ${activeInstantTurns.length} Turns)】:`,
                lines
            };
        }

        const aiLogIndexes = instantLogs
            .map((log, idx) => ({ log, idx }))
            .filter(item => item.log.sender !== 'player')
            .map(item => item.idx);
        const selectedAiIndexes = aiLogIndexes.slice(-contextLayerLimit);
        const selectedIndexes = new Set<number>(selectedAiIndexes);
        if (includePrecedingUser) {
            selectedAiIndexes.forEach((idx) => {
                const prev = idx - 1;
                if (prev >= 0 && instantLogs[prev].sender === 'player') {
                    selectedIndexes.add(prev);
                }
            });
        }
        const orderedIndexes = Array.from(selectedIndexes).sort((a, b) => a - b);
        const lines: string[] = [];
        let layer = 0;
        orderedIndexes.forEach((idx) => {
            const log = instantLogs[idx];
            if (log.sender !== 'player') {
                layer += 1;
            }
            const layerLabel = String(Math.max(layer, 1)).padStart(2, '0');
            const roleLabel = log.sender === 'player' ? 'U' : 'A';
            const logTime = log.gameTime || fallbackGameTime || '??:??';
            lines.push(`[L${layerLabel}|${roleLabel}|${logTime}] ${log.sender}: ${log.text}`);
        });
        if (lines.length === 0) {
            return { title: "【即时上下文】: (暂无新消息)", lines };
        }
        const layerCount = selectedAiIndexes.length;
        return {
            title: `【即时上下文 (Context Layers=${layerCount})】:`,
            lines
        };
    };

    const instantBlock = buildInstantContextBlock();
    output += `${instantBlock.title}\n`;
    if (instantBlock.lines.length > 0) {
        output += `${instantBlock.lines.join('\n')}\n`;
    }

    return output.trim();
};

export const buildPlayerDataContext = (playerData: GameState["角色"], difficultySetting: Difficulty): string => {
    const { 头像, 生命值, 最大生命值, ...cleanPlayerData } = playerData;
    const filteredPlayerData = difficultySetting === Difficulty.EASY
        ? { ...cleanPlayerData, 生命值, 最大生命值 }
        : cleanPlayerData;
    return `[玩家数据 (Player Data)]\n${JSON.stringify(filteredPlayerData, null, 2)}`;
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

const filterActiveNpcSimulations = (
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
            const location = (track as any).地点 || track?.位置 || (track as any).位置详情 || '';
            const action = track?.当前行动 || '';
            const expectedEnd = (track as any).阶段结束时间 || track?.预计完成 || '';
            const keywords = new Set<string>();
            if (name) keywords.add(name);
            if ((confidant as any)?.称号) keywords.add((confidant as any).称号);
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

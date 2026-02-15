import { GameState } from '../../types';
import { computeMaxCarry, computeMaxHp, computeMaxMind, computeMaxStamina } from '../../utils/characterMath';

export const migrateNpcActionsToTracking = (state: GameState): GameState => {
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

const normalizeConfidantPresence = (confidant: any) => {
    if (!confidant || typeof confidant !== 'object') return confidant;

    const normalizeBooleanLike = (value: unknown): boolean | undefined => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') {
            if (value === 1) return true;
            if (value === 0) return false;
            return undefined;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (!normalized) return undefined;
            if (['true', '1', 'yes', 'y', 'on', '是', '真'].includes(normalized)) return true;
            if (['false', '0', 'no', 'n', 'off', '否', '假', 'null', 'undefined'].includes(normalized)) return false;
        }
        return undefined;
    };

    const status = confidant.当前状态;
    const hasStatus = typeof status === 'string' && status.length > 0;
    const rawPresence = normalizeBooleanLike(confidant.是否在场);
    const hasPresence = typeof rawPresence === 'boolean';

    let normalizedPresence: boolean | undefined = hasPresence ? rawPresence : undefined;
    if (status === '在场') normalizedPresence = true;
    if (status === '离场' || status === '死亡' || status === '失踪') normalizedPresence = false;
    const normalizedSpecialAttention = normalizeBooleanLike(confidant.特别关注) ?? false;
    const normalizedContactInfo = normalizeBooleanLike(confidant.已交换联系方式) ?? false;
    const normalizedPartyMember = normalizeBooleanLike(confidant.是否队友);

    const normalizedStatus = hasStatus
        ? status
        : (typeof normalizedPresence === 'boolean' ? (normalizedPresence ? '在场' : '离场') : undefined);

    const presenceUnchanged = normalizedPresence === confidant.是否在场;
    const statusUnchanged = normalizedStatus === undefined || normalizedStatus === confidant.当前状态;
    const specialAttentionUnchanged = normalizedSpecialAttention === confidant.特别关注;
    const contactInfoUnchanged = normalizedContactInfo === confidant.已交换联系方式;
    const partyMemberUnchanged = normalizedPartyMember === undefined || normalizedPartyMember === confidant.是否队友;
    if (presenceUnchanged && statusUnchanged && specialAttentionUnchanged && contactInfoUnchanged && partyMemberUnchanged) return confidant;

    return {
        ...confidant,
        ...(typeof normalizedPresence === 'boolean' ? { 是否在场: normalizedPresence } : {}),
        ...(normalizedStatus ? { 当前状态: normalizedStatus } : {}),
        特别关注: normalizedSpecialAttention,
        已交换联系方式: normalizedContactInfo,
        ...(typeof normalizedPartyMember === 'boolean' ? { 是否队友: normalizedPartyMember } : {})
    };
};

export const ensureDerivedStats = (state: GameState): GameState => {
    if (!state?.角色) return state;
    const baseAbilities = state.角色.隐藏基础能力 || { 力量: 0, 耐久: 0, 灵巧: 0, 敏捷: 0, 魔力: 0 };
    const maxCarry = computeMaxCarry(state.角色);
    const maxHp = computeMaxHp(state.角色);
    const maxMind = computeMaxMind(state.角色);
    const maxStamina = computeMaxStamina(state.角色);
    const nextMap = state.地图 ? {
        ...state.地图,
        macroLocations: Array.isArray(state.地图.macroLocations) ? state.地图.macroLocations : [],
        midLocations: Array.isArray(state.地图.midLocations) ? state.地图.midLocations : [],
        surfaceLocations: Array.isArray(state.地图.surfaceLocations) ? state.地图.surfaceLocations : [],
        dungeonStructure: Array.isArray(state.地图.dungeonStructure) ? state.地图.dungeonStructure : []
    } : state.地图;
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
    const nextConfidants = Array.isArray(state.社交)
        ? state.社交.map(normalizeConfidantPresence)
        : state.社交;

    return {
        ...state,
        社交: nextConfidants,
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
        地图: nextMap
    };
};

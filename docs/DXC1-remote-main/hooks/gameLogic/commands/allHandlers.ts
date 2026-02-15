import type { GameState } from '../../../types/gamestate';
import {
    EncounterRowSchema,
    MapVisualsSchema,
    ActionOptionSchema,
    LogSummarySchema,
    LogOutlineSchema,
    NPCTavernDBSchema,
    InventoryItemTavernDBSchema,
    BattleMapRowUpsertSchema,
    DicePoolRefillSchema,
    RollDiceCheckSchema,
    ActionEconomySchema,
    SpendActionResourceSchema,
    ResolveAttackCheckSchema,
    ResolveSavingThrowSchema,
    ResolveDamageRollSchema,
    InitiativeSchema,
    CombatResolutionEventSchema,
    AppendEconomicLedgerSchema,
    ApplyEconomicDeltaSchema,
    SheetUpsertRowsSchema,
    SheetDeleteRowsSchema,
    validateSchema
} from '../../../utils/contracts';
import type { BattleMapRow } from '../../../types/combat';
import type {
    DiceRow,
    TavernActionOption as ActionOption,
    LogSummary,
    LogOutline,
    CombatResolutionEvent,
    DicePoolRefillPayload,
    RollDiceCheckPayload,
    DiceType,
    SetActionEconomyPayload,
    SpendActionResourcePayload,
    ResolveAttackCheckPayload,
    ResolveSavingThrowPayload,
    ResolveDamageRollPayload,
    EconomicLedgerEntry
} from '../../../types/extended';
import {
    rollD20Check,
    rollDiceExpression,
    rollStandardDie,
    STANDARD_DICE_TYPES,
    parseDiceExpression
} from '../../../utils/diceEngine';
import { normalizeAmIndex } from '../../../utils/memory/amIndex';
import { getDomainMappingRegistry, isSheetId } from '../../../utils/taverndb/sheetRegistry';
import { isPlayerReference, replaceUserPlaceholders, resolvePlayerName } from '../../../utils/userPlaceholder';
import { ensurePhoneStateBase } from '../phoneUtils';
import { z } from 'zod'; // A-005 FIX: Import z for inline schema validation

// Helper: push user-visible system message if available
const pushMsg = (pushSystemMessage: ((msg: string) => void) | undefined, msg: string) => {
    if (pushSystemMessage) pushSystemMessage(msg);
    return msg;
};

const nowTag = () => Date.now().toString(36);
const randomTag = () => Math.random().toString(36).slice(2, 8);
const makeDiceId = () => `Die_${nowTag()}_${randomTag()}`;
const makeResolutionId = () => `Res_${nowTag()}_${randomTag()}`;

const consumeDiceFromPoolByType = (
    state: GameState,
    type: DiceType,
    amount: number
): DiceRow[] => {
    if (!state.骰池 || !Array.isArray(state.骰池) || amount <= 0) return [];
    const consumed: DiceRow[] = [];
    const remaining: DiceRow[] = [];

    for (const row of state.骰池) {
        if (row.类型 === type && consumed.length < amount) {
            consumed.push({ ...row, 已使用: true });
            continue;
        }
        remaining.push(row);
    }

    state.骰池 = remaining;
    return consumed;
};

const diceTypeBySides = (sides: number): DiceType | null => {
    const mapping: Record<number, DiceType> = {
        4: 'd4',
        6: 'd6',
        8: 'd8',
        10: 'd10',
        12: 'd12',
        20: 'd20',
        100: 'd100'
    };
    return mapping[sides] || null;
};

const consumeByDiceExpression = (
    state: GameState,
    expression: string
): number[] | null => {
    const parsed = parseDiceExpression(expression);
    if (!parsed || parsed.count <= 0) return [];
    const type = diceTypeBySides(parsed.sides);
    if (!type) return null;
    const consumed = consumeDiceFromPoolByType(state, type, parsed.count);
    if (consumed.length < parsed.count) return null;
    return consumed.map(row => row.数值);
};

const ensureCombatResolutionStore = (state: GameState) => {
    if (!state.战斗) state.战斗 = {} as any;
    if (!state.战斗.判定事件) state.战斗.判定事件 = [];
};

const pushCombatEvent = (state: GameState, event: CombatResolutionEvent) => {
    ensureCombatResolutionStore(state);
    state.战斗.判定事件!.push(event);
    if (state.战斗.判定事件!.length > 60) {
        state.战斗.判定事件 = state.战斗.判定事件!.slice(-60);
    }
};

const applyDamageToUnit = (
    state: GameState,
    targetUnitId: string | undefined,
    damage: number
): { before?: number; after?: number } => {
    if (!targetUnitId || !state.战斗?.地图 || !Number.isFinite(damage) || damage <= 0) {
        return {};
    }
    const target = state.战斗.地图.find(row => row.UNIT_ID === targetUnitId);
    if (!target?.生命值) return {};
    const before = target.生命值.当前;
    const after = Math.max(0, before - Math.floor(damage));
    target.生命值.当前 = after;
    return { before, after };
};

const LEGACY_BATTLEMAP_TYPES = new Set(['config', 'token', 'wall', 'terrain', 'zone']);

const toFiniteInt = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    return null;
};

const parseObjectLike = (value: unknown): Record<string, any> | null => {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, any>;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }
    return null;
};

const parseLegacyPoint = (value: unknown): { x: number; y: number } | null => {
    if (typeof value === 'string') {
        const tupleMatch = value.trim().match(/^\(?\s*(-?\d+)\s*[,，]\s*(-?\d+)\s*\)?$/);
        if (tupleMatch) {
            const x = Number(tupleMatch[1]);
            const y = Number(tupleMatch[2]);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                return { x: Math.round(x), y: Math.round(y) };
            }
        }
    }
    const obj = parseObjectLike(value);
    if (!obj) return null;
    const x = toFiniteInt(obj.x ?? obj.X ?? obj.col ?? obj.Col ?? obj.column ?? obj.列);
    const y = toFiniteInt(obj.y ?? obj.Y ?? obj.row ?? obj.Row ?? obj.行);
    if (x === null || y === null) return null;
    return { x, y };
};

const parseLegacySize = (value: unknown): { w: number; h: number } | null => {
    if (typeof value === 'string') {
        const sizeMatch = value.trim().match(/^(\d+)\s*[xX×]\s*(\d+)$/);
        if (sizeMatch) {
            const w = Number(sizeMatch[1]);
            const h = Number(sizeMatch[2]);
            if (Number.isFinite(w) && Number.isFinite(h)) {
                return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
            }
        }
    }
    const obj = parseObjectLike(value);
    if (!obj) return null;
    const w = toFiniteInt(obj.w ?? obj.W ?? obj.width ?? obj.宽度);
    const h = toFiniteInt(obj.h ?? obj.H ?? obj.height ?? obj.高度);
    if (w === null || h === null) return null;
    return { w: Math.max(1, w), h: Math.max(1, h) };
};

const parseLegacyMapSize = (value: unknown): { 宽度: number; 高度: number } | null => {
    if (typeof value === 'string') {
        const sizeMatch = value.trim().match(/^(\d+)\s*[xX×]\s*(\d+)$/);
        if (sizeMatch) {
            const width = Number(sizeMatch[1]);
            const height = Number(sizeMatch[2]);
            if (Number.isFinite(width) && Number.isFinite(height)) {
                return { 宽度: Math.max(1, Math.round(width)), 高度: Math.max(1, Math.round(height)) };
            }
        }
    }
    const obj = parseObjectLike(value);
    if (!obj) return null;
    const width = toFiniteInt(obj.w ?? obj.W ?? obj.width ?? obj.宽度 ?? obj.x);
    const height = toFiniteInt(obj.h ?? obj.H ?? obj.height ?? obj.高度 ?? obj.y);
    if (width === null || height === null) return null;
    return { 宽度: Math.max(1, width), 高度: Math.max(1, height) };
};

const parseLegacyHp = (row: Record<string, any>): { 当前: number; 最大: number } | undefined => {
    const hpObj = parseObjectLike(row.生命值 ?? row.hp ?? row.HP);
    const current = toFiniteInt(hpObj?.当前 ?? hpObj?.current ?? hpObj?.cur ?? row.当前生命 ?? row.currentHp ?? row.hpCurrent);
    const max = toFiniteInt(hpObj?.最大 ?? hpObj?.max ?? row.最大生命 ?? row.maxHp ?? row.hpMax);
    if (current === null || max === null) return undefined;
    return { 当前: Math.max(0, current), 最大: Math.max(1, max) };
};

const parseLegacyEffects = (row: Record<string, any>): string[] => {
    const source = row.状态效果 ?? row.effects ?? row.effect ?? row.效果 ?? row.BUFFS ?? row.DEBUFFS ?? row.tactical;
    if (Array.isArray(source)) return source.map(item => String(item)).filter(Boolean).slice(0, 6);
    if (typeof source === 'string' && source.trim()) {
        return source.split(/[;,，；|/]/g).map(item => item.trim()).filter(Boolean).slice(0, 6);
    }
    return [];
};

const normalizeLegacyIcon = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    const icon = raw.trim();
    if (!icon) return undefined;
    if (/^(https?:\/\/|data:|[a-z][a-z0-9+.-]*:\/\/)/i.test(icon)) return icon;
    const diceBearMatch = icon.match(/^([a-z0-9_-]+)\s*:\s*(.+)$/i);
    if (diceBearMatch) {
        const style = diceBearMatch[1];
        const seed = encodeURIComponent(diceBearMatch[2].trim());
        return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`;
    }
    return icon;
};

const normalizeLegacyUnitType = (legacyType: string, row: Record<string, any>): BattleMapRow['类型'] => {
    const lower = legacyType.toLowerCase();
    if (lower === 'wall') return '障碍物';
    if (lower === 'terrain' || lower === 'zone') return '地形';
    if (lower === 'token') {
        const hints = [
            row.阵营,
            row.faction,
            row.side,
            row.单位类型,
            row.单位名称,
            row.名称,
            row.name,
            row.UNIT_ID,
            row.id
        ].filter(Boolean).join(' ').toLowerCase();
        if (/(player|pc|main|主角|玩家)/.test(hints)) return '玩家';
        if (/(ally|friend|companion|友方|同伴|队友|随从)/.test(hints)) return '友方';
        if (/(enemy|mob|hostile|敌|怪)/.test(hints)) return '敌人';
        return '其他';
    }
    if (legacyType === '玩家' || legacyType === '敌人' || legacyType === '友方' || legacyType === '障碍物' || legacyType === '地形' || legacyType === '其他') {
        return legacyType;
    }
    return '其他';
};

const normalizeLegacyStatus = (row: Record<string, any>): BattleMapRow['状态'] | undefined => {
    const raw = String(row.状态 ?? row.status ?? '').trim();
    if (!raw) return undefined;
    if (raw === '正常' || raw === '倒地' || raw === '死亡' || raw === '隐身' || raw === '其他') return raw;
    if (/dead|killed|死亡/.test(raw.toLowerCase())) return '死亡';
    if (/down|倒地/.test(raw.toLowerCase())) return '倒地';
    if (/stealth|invisible|隐/.test(raw.toLowerCase())) return '隐身';
    return '其他';
};

const normalizeBattleMapPayload = (
    rows: unknown[]
): { normalizedRows: unknown[]; mapSize?: { 宽度: number; 高度: number }; errors: string[] } => {
    const normalizedRows: unknown[] = [];
    const errors: string[] = [];
    let mapSize: { 宽度: number; 高度: number } | undefined;

    rows.forEach((rawRow, index) => {
        if (!rawRow || typeof rawRow !== 'object') {
            normalizedRows.push(rawRow);
            return;
        }

        const row = rawRow as Record<string, any>;
        const legacyType = String(row.类型 ?? row.type ?? '').trim();
        const looksLikeLegacy = LEGACY_BATTLEMAP_TYPES.has(legacyType.toLowerCase())
            || ('单位名称' in row && '坐标' in row)
            || ('Token' in row && ('坐标' in row || '位置' in row || 'position' in row));

        if (!looksLikeLegacy) {
            normalizedRows.push(rawRow);
            return;
        }

        if (legacyType.toLowerCase() === 'config') {
            const parsedSize = parseLegacyMapSize(row.坐标 ?? row.位置 ?? row.position ?? row.大小 ?? row.size);
            if (!parsedSize) {
                errors.push(`Config 行 ${index + 1} 缺少合法地图尺寸`);
                return;
            }
            mapSize = parsedSize;
            return;
        }

        const position = parseLegacyPoint(row.坐标 ?? row.位置 ?? row.position);
        if (!position) {
            errors.push(`行 ${index + 1} 缺少合法坐标`);
            return;
        }

        const legacySize = parseLegacySize(row.大小 ?? row.size ?? row.尺寸);
        const unitName = String(row.单位名称 ?? row.名称 ?? row.name ?? row.UNIT_ID ?? row.id ?? `单位_${index + 1}`).trim();
        const unitIdCandidate = row.UNIT_ID ?? row.id ?? row.单位ID ?? unitName ?? `UNIT_${index + 1}`;
        const unitId = String(unitIdCandidate).trim();
        if (!unitId) {
            errors.push(`行 ${index + 1} 缺少 UNIT_ID`);
            return;
        }

        const hp = parseLegacyHp(row);
        const status = normalizeLegacyStatus(row);
        const effects = parseLegacyEffects(row);
        const icon = normalizeLegacyIcon(row.Token ?? row.token ?? row.图标 ?? row.icon);
        const descParts = [row.描述, row.description, row.tactical, row.效果].filter(Boolean).map(item => String(item).trim()).filter(Boolean);
        const normalizedRow: any = {
            UNIT_ID: unitId,
            名称: unitName || unitId,
            类型: normalizeLegacyUnitType(legacyType, row),
            位置: position
        };

        if (status) normalizedRow.状态 = status;
        if (hp) normalizedRow.生命值 = hp;
        if (icon) normalizedRow.图标 = icon;
        if (descParts.length > 0) normalizedRow.描述 = descParts.join(' / ');
        if (effects.length > 0) normalizedRow.状态效果 = effects;
        if (legacySize) normalizedRow.尺寸 = { 宽度: legacySize.w, 高度: legacySize.h };

        normalizedRows.push(normalizedRow);
    });

    return { normalizedRows, mapSize, errors };
};

export function handleSetEncounterRows(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string } {
    if (!Array.isArray(value)) {
        const msg = 'set_encounter_rows requires array value';
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const validatedRows = value.map(row => validateSchema(EncounterRowSchema, row));
    const errors = validatedRows.filter(r => !r.success);

    if (errors.length > 0) {
        const msg = `Validation failed for ${errors.length} rows`;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    state.遭遇 = validatedRows.map(r => (r as any).data);
    return { success: true };
}

export function handleUpsertBattleMapRows(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string } {
    if (!Array.isArray(value)) {
        const msg = pushMsg(pushSystemMessage, 'upsert_battle_map_rows requires array value');
        return { success: false, error: msg };
    }

    const { normalizedRows, mapSize, errors: normalizeErrors } = normalizeBattleMapPayload(value);
    if (normalizeErrors.length > 0) {
        const msg = pushMsg(pushSystemMessage, `Legacy payload normalization failed: ${normalizeErrors.join('; ')}`);
        return { success: false, error: msg };
    }

    if (!state.战斗) {
        state.战斗 = {} as any;
    }

    if (mapSize) {
        if (!state.战斗.视觉) {
            state.战斗.视觉 = {
                地图尺寸: { ...mapSize }
            } as any;
        } else {
            state.战斗.视觉.地图尺寸 = { ...mapSize };
        }
    }

    if (normalizedRows.length === 0) {
        return { success: true };
    }

    const validatedRows = normalizedRows.map(row => validateSchema(BattleMapRowUpsertSchema, row));
    const errors = validatedRows.filter(r => !r.success);

    if (errors.length > 0) {
        const details = errors.map(e => ('error' in e ? e.error : '')).join('; ');
        const msg = pushMsg(pushSystemMessage, `Validation failed: ${details}`);
        return { success: false, error: msg };
    }

    const newRows = validatedRows.map(r => (r as any).data as BattleMapRow);

    if (!state.战斗.地图) {
        state.战斗.地图 = [];
    }

    const width = state.战斗?.视觉?.地图尺寸?.宽度;
    const height = state.战斗?.视觉?.地图尺寸?.高度;
    const seen = new Set<string>();

    for (const row of newRows) {
        if (seen.has(row.UNIT_ID)) {
            const msg = pushMsg(pushSystemMessage, `Duplicate UNIT_ID in payload: ${row.UNIT_ID}`);
            return { success: false, error: msg };
        }
        seen.add(row.UNIT_ID);
        if (typeof width === 'number' && typeof height === 'number') {
            const x = row.位置?.x;
            const y = row.位置?.y;
            const inZeroBased = x >= 0 && y >= 0 && x < width && y < height;
            const inOneBased = x >= 1 && y >= 1 && x <= width && y <= height;
            if (!inZeroBased && !inOneBased) {
                const msg = pushMsg(pushSystemMessage, `坐标超出地图范围 (${row.UNIT_ID} @ ${row.位置?.x},${row.位置?.y})`);
                return { success: false, error: msg };
            }
        }
    }

    newRows.forEach(newRow => {
        const existingIndex = state.战斗.地图!.findIndex(
            (existing) => existing.UNIT_ID === newRow.UNIT_ID
        );
        if (existingIndex >= 0) {
            const existing = state.战斗.地图![existingIndex];
            state.战斗.地图![existingIndex] = {
                ...existing,
                ...newRow,
                位置: newRow.位置 ? { ...existing.位置, ...newRow.位置 } : existing.位置,
                生命值: newRow.生命值 ? { ...existing.生命值, ...newRow.生命值 } : existing.生命值
            };
        } else {
            state.战斗.地图!.push(newRow);
        }
    });

    return { success: true };
}

export function handleSetMapVisuals(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string } {
    const toFiniteNumber = (input: unknown, fallback: number) => {
        if (typeof input === 'number' && Number.isFinite(input)) return input;
        if (typeof input === 'string') {
            const parsed = Number(input);
            if (Number.isFinite(parsed)) return parsed;
        }
        return fallback;
    };

    const parseGridSize = (raw: unknown): { 宽度: number; 高度: number } | null => {
        if (typeof raw !== 'string') return null;
        const match = raw.trim().match(/^(\d+)\s*[xX×]\s*(\d+)$/);
        if (!match) return null;
        const width = Number(match[1]);
        const height = Number(match[2]);
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
        return { 宽度: width, 高度: height };
    };

    const normalizeLighting = (raw: unknown): '明亮' | '昏暗' | '黑暗' | '其他' | undefined => {
        if (raw === null || raw === undefined) return undefined;
        const text = String(raw).trim();
        if (!text) return undefined;
        const lower = text.toLowerCase();
        if (/(bright|daylight|light|明亮|亮|强光)/.test(lower)) return '明亮';
        if (/(dim|gloom|昏暗|微光|弱光)/.test(lower)) return '昏暗';
        if (/(dark|pitch|黑暗|漆黑|无光)/.test(lower)) return '黑暗';
        if (text === '明亮' || text === '昏暗' || text === '黑暗' || text === '其他') return text as any;
        return '其他';
    };

    const normalizeVisuals = (raw: unknown): unknown => {
        if (!raw || typeof raw !== 'object') return raw;
        const input = raw as any;

        const visualJSON = parseObjectLike(input.VisualJSON ?? input.visualJSON ?? input.visual_json);
        const dimensions = parseObjectLike(
            input.地图尺寸
            ?? visualJSON?.dimensions
            ?? input.dimensions
            ?? input.mapSize
            ?? visualJSON?.mapSize
        );
        const gridSize = parseGridSize(input.GridSize ?? input.gridSize);
        const width = Math.max(1, Math.round(toFiniteNumber(dimensions?.width ?? dimensions?.w ?? dimensions?.宽度 ?? gridSize?.宽度, 20)));
        const height = Math.max(1, Math.round(toFiniteNumber(dimensions?.height ?? dimensions?.h ?? dimensions?.高度 ?? gridSize?.高度, 20)));

        const terrainSource = Array.isArray(input.特殊区域)
            ? input.特殊区域
            : (Array.isArray(visualJSON?.terrain_objects)
                ? visualJSON.terrain_objects
                : (Array.isArray(input.terrain_objects) ? input.terrain_objects : []));

        const specialZones = terrainSource
            .map((item: any) => parseObjectLike(item))
            .filter((item): item is Record<string, any> => !!item)
            .map((item) => {
                const zonePosition = parseObjectLike(item.位置 ?? item.position);
                const x = toFiniteNumber(item.x ?? zonePosition?.x ?? zonePosition?.X, 0);
                const y = toFiniteNumber(item.y ?? zonePosition?.y ?? zonePosition?.Y, 0);
                const range = Math.max(1, Math.round(toFiniteNumber(item.范围 ?? item.range ?? item.w ?? item.h, 1)));
                const effect = [item.效果, item.tactical, item.description].filter(Boolean).join(' / ');
                return {
                    名称: String(item.名称 || item.type || item.name || '地形对象'),
                    位置: { x, y },
                    范围: range,
                    效果: effect || undefined
                };
            });

        const light = normalizeLighting(
            input.光照
            ?? input.light
            ?? input.lighting
            ?? visualJSON?.lighting
            ?? visualJSON?.light
        );

        return {
            地图尺寸: { 宽度: width, 高度: height },
            地形描述: input.地形描述 || visualJSON?.ground || input.SceneName || visualJSON?.mapName || input.mapName,
            特殊区域: specialZones.length > 0 ? specialZones : undefined,
            光照: light,
            天气: input.天气 || input.weather || visualJSON?.weather
        };
    };

    const normalizedValue = normalizeVisuals(value);
    const validation = validateSchema(MapVisualsSchema, normalizedValue);

    if (!validation.success) {
        const msg = (validation as any).error;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    state.战斗.视觉 = (validation as any).data;
    return { success: true };
}

export function handleConsumeDiceRows(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string; consumed?: DiceRow[] } {
    const payloadSchema = z.union([
        z.object({ ids: z.array(z.string()) }),
        z.object({ count: z.number().min(1) })
    ]);

    const payloadValidation = validateSchema(payloadSchema, value);
    if (!payloadValidation.success) {
        const msg = `Invalid payload: ${(payloadValidation as any).error}`;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const payload = value as any;

    if (!state.骰池) {
        state.骰池 = [];
    }

    let consumed: DiceRow[] = [];

    if (Array.isArray(payload?.ids)) {
        const idSet = new Set(payload.ids);
        consumed = state.骰池.filter(die => idSet.has(die.id));
        state.骰池 = state.骰池.filter(die => !idSet.has(die.id));
    } else if (typeof payload?.count === 'number' && payload.count > 0) {
        consumed = state.骰池.slice(0, payload.count);
        state.骰池 = state.骰池.slice(payload.count);
    } else {
        const msg = 'consume_dice_rows requires ids array or count number';
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    if (!consumed || consumed.length === 0) {
        const msg = 'consume_dice_rows 未找到可消费的骰子';
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    consumed.forEach(die => {
        die.已使用 = true;
    });

    return { success: true, consumed };
}

export function handleRefillDicePool(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string; added?: number } {
    const validation = validateSchema(DicePoolRefillSchema, value);
    if (!validation.success) {
        const msg = `Invalid payload: ${(validation as any).error}`;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const payload = (validation as any).data as DicePoolRefillPayload;
    const diceTypes: DiceType[] = (payload.类型 && payload.类型.length > 0
        ? payload.类型
        : STANDARD_DICE_TYPES) as DiceType[];

    if (!state.骰池) {
        state.骰池 = [];
    }

    const generated: DiceRow[] = [];
    for (let i = 0; i < payload.count; i += 1) {
        for (const type of diceTypes) {
            generated.push({
                id: makeDiceId(),
                类型: type,
                数值: rollStandardDie(type),
                用途: payload.用途 || '预生成骰池',
                时间戳: new Date().toISOString(),
                已使用: false
            });
        }
    }

    state.骰池.push(...generated);
    return { success: true, added: generated.length };
}

export function handleRollDiceCheck(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string; event?: CombatResolutionEvent } {
    const validation = validateSchema(RollDiceCheckSchema, value);
    if (!validation.success) {
        const msg = `Invalid payload: ${(validation as any).error}`;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const payload = (validation as any).data as RollDiceCheckPayload;
    const diceType = payload.骰子类型 || 'd20';
    const modifier =
        (payload.属性调整 || 0) +
        (payload.熟练加值 || 0) +
        (payload.额外加值 || 0);

    let rollValue = 0;
    let total = 0;
    let success: boolean | undefined = undefined;
    let diceLabel: string = diceType;
    const steps: CombatResolutionEvent['步骤'] = [];

    if (payload.表达式) {
        const expressionResult = rollDiceExpression(payload.表达式);
        if (!expressionResult) {
            const msg = `Invalid dice expression: ${payload.表达式}`;
            pushSystemMessage?.(msg);
            return { success: false, error: msg };
        }

        const term = expressionResult.terms[0];
        diceLabel = payload.表达式;
        rollValue = expressionResult.total;
        total = expressionResult.total + modifier;
        success = typeof payload.DC === 'number' ? total >= payload.DC : undefined;

        steps.push({
            标签: `表达式 ${payload.表达式}`,
            数值: expressionResult.total,
            类型: '掷骰',
            说明: term
                ? `掷骰结果 [${term.rolls.join(', ')}] + 修正 ${expressionResult.modifier}`
                : `常量结果 ${expressionResult.total}`
        });
    } else if (diceType === 'd20') {
        const needRolls = (payload.优势 || payload.劣势) ? 2 : 1;
        const poolRolls = payload.消耗骰池 !== false
            ? consumeDiceFromPoolByType(state, 'd20', needRolls)
            : [];
        const forcedRolls = poolRolls.map(row => row.数值);
        const check = rollD20Check({
            modifier,
            dc: payload.DC,
            advantage: payload.优势,
            disadvantage: payload.劣势,
            forcedRolls
        });

        rollValue = check.selected;
        total = check.total;
        success = check.success;
        const modeLabel = check.mode === 'normal' ? '普通' : check.mode === 'advantage' ? '优势' : '劣势';
        steps.push({
            标签: `${modeLabel} d20`,
            数值: check.selected,
            类型: '掷骰',
            说明: `候选 [${check.rolls.join(', ')}] -> 取 ${check.selected}`
        });
    } else {
        rollValue = rollStandardDie(diceType);
        total = rollValue + modifier;
        success = typeof payload.DC === 'number' ? total >= payload.DC : undefined;
        steps.push({
            标签: `${diceType} 掷骰`,
            数值: rollValue,
            类型: '掷骰'
        });
    }

    if (modifier !== 0) {
        steps.push({
            标签: '修正值',
            数值: modifier,
            类型: '对抗',
            说明: `属性 ${payload.属性调整 || 0} / 熟练 ${payload.熟练加值 || 0} / 其他 ${payload.额外加值 || 0}`
        });
    }
    if (typeof payload.DC === 'number') {
        steps.push({
            标签: '对抗 DC',
            数值: payload.DC,
            类型: '对抗',
            说明: success ? '判定通过' : '判定失败'
        });
    }

    const event: CombatResolutionEvent = {
        id: makeResolutionId(),
        时间: state.游戏时间 || new Date().toISOString(),
        回合: state.回合数,
        行动者: payload.行动者,
        目标: payload.目标,
        动作: payload.动作,
        骰子: diceLabel,
        掷骰: rollValue,
        修正: modifier,
        对抗值: payload.DC,
        是否成功: success,
        结果: typeof success === 'boolean' ? (success ? '成功' : '失败') : `总值 ${total}`,
        步骤: steps,
        标签: [...(payload.标签 || []), 'dnd_check']
    };

    pushCombatEvent(state, event);

    return { success: true, event };
}

export function handleSetActionEconomy(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string } {
    const validation = validateSchema(ActionEconomySchema, value);
    if (!validation.success) {
        const msg = `Invalid payload: ${(validation as any).error}`;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const payload = (validation as any).data as SetActionEconomyPayload;
    if (!state.战斗) state.战斗 = {} as any;
    state.战斗.行动经济 = {
        回合: payload.回合,
        当前行动者: payload.当前行动者,
        资源: payload.资源.map(row => ({ ...row }))
    };
    return { success: true };
}

export function handleSpendActionResource(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string } {
    const validation = validateSchema(SpendActionResourceSchema, value);
    if (!validation.success) {
        const msg = `Invalid payload: ${(validation as any).error}`;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const payload = (validation as any).data as SpendActionResourcePayload;
    if (!state.战斗?.行动经济) {
        return { success: false, error: '行动经济未初始化' };
    }

    const row = state.战斗.行动经济.资源.find(item => item.单位ID === payload.单位ID);
    if (!row) {
        return { success: false, error: `未找到单位资源: ${payload.单位ID}` };
    }

    const cost = payload.消耗 || 1;
    const before = row[payload.资源];
    row[payload.资源] = Math.max(0, before - cost);

    pushCombatEvent(state, {
        id: makeResolutionId(),
        时间: state.游戏时间 || new Date().toISOString(),
        回合: state.回合数,
        行动者: payload.单位ID,
        动作: `${payload.资源}消耗`,
        是否成功: before >= cost,
        结果: before >= cost
            ? `${payload.资源} ${before} -> ${row[payload.资源]}`
            : `${payload.资源}不足（${before}）`,
        步骤: [{
            标签: payload.资源,
            数值: row[payload.资源],
            类型: '状态',
            说明: payload.原因 || '行动经济扣减'
        }],
        标签: ['action_economy']
    });

    return { success: true };
}

export function handleResolveAttackCheck(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string; event?: CombatResolutionEvent } {
    const validation = validateSchema(ResolveAttackCheckSchema, value);
    if (!validation.success) {
        const msg = `Invalid payload: ${(validation as any).error}`;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const payload = (validation as any).data as ResolveAttackCheckPayload;
    const poolRolls = payload.消耗骰池 !== false
        ? consumeDiceFromPoolByType(state, 'd20', (payload.优势 || payload.劣势) ? 2 : 1)
        : [];
    const check = rollD20Check({
        modifier: payload.命中加值 || 0,
        dc: payload.命中DC,
        advantage: payload.优势,
        disadvantage: payload.劣势,
        forcedRolls: poolRolls.map(row => row.数值)
    });

    const steps: CombatResolutionEvent['步骤'] = [
        {
            标签: '攻击检定',
            数值: check.selected,
            类型: '掷骰',
            说明: `候选 [${check.rolls.join(', ')}]，修正 ${check.modifier >= 0 ? `+${check.modifier}` : check.modifier}`
        },
        {
            标签: '命中DC',
            数值: payload.命中DC,
            类型: '对抗',
            说明: check.success ? '命中' : '未命中'
        }
    ];

    let damage = 0;
    let hpChange: { before?: number; after?: number } = {};
    if (check.success && payload.伤害表达式) {
        const forced = payload.消耗骰池 !== false ? consumeByDiceExpression(state, payload.伤害表达式) : [];
        const dmgRoll = rollDiceExpression(payload.伤害表达式, undefined);
        if (!dmgRoll) {
            return { success: false, error: `Invalid damage expression: ${payload.伤害表达式}` };
        }
        if (Array.isArray(forced) && forced.length > 0 && dmgRoll.terms[0]) {
            dmgRoll.terms[0].rolls = forced;
            dmgRoll.terms[0].subtotal = forced.reduce((sum, val) => sum + val, 0);
            dmgRoll.total = dmgRoll.terms[0].subtotal + dmgRoll.modifier;
        }
        damage = dmgRoll.total + (payload.伤害加值 || 0);
        hpChange = applyDamageToUnit(state, payload.目标UNIT_ID, damage);
        steps.push({
            标签: '伤害',
            数值: damage,
            类型: '伤害',
            说明: `${payload.伤害表达式}${payload.伤害加值 ? ` + ${payload.伤害加值}` : ''}`
        });
    }

    const event: CombatResolutionEvent = {
        id: makeResolutionId(),
        时间: state.游戏时间 || new Date().toISOString(),
        回合: state.回合数,
        行动者: payload.行动者,
        目标: payload.目标,
        动作: payload.动作,
        骰子: 'd20',
        掷骰: check.selected,
        修正: check.modifier,
        对抗值: payload.命中DC,
        是否成功: check.success,
        伤害: damage > 0 ? damage : undefined,
        结果: check.success
            ? (hpChange.before !== undefined ? `命中并造成 ${damage} 伤害（HP ${hpChange.before} -> ${hpChange.after}）` : `命中并造成 ${damage} 伤害`)
            : '攻击未命中',
        步骤: steps,
        标签: [...(payload.标签 || []), 'attack_check']
    };
    pushCombatEvent(state, event);
    return { success: true, event };
}

export function handleResolveSavingThrow(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string; event?: CombatResolutionEvent } {
    const validation = validateSchema(ResolveSavingThrowSchema, value);
    if (!validation.success) {
        const msg = `Invalid payload: ${(validation as any).error}`;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const payload = (validation as any).data as ResolveSavingThrowPayload;
    const poolRolls = payload.消耗骰池 !== false
        ? consumeDiceFromPoolByType(state, 'd20', (payload.优势 || payload.劣势) ? 2 : 1)
        : [];
    const check = rollD20Check({
        modifier: payload.豁免加值 || 0,
        dc: payload.DC,
        advantage: payload.优势,
        disadvantage: payload.劣势,
        forcedRolls: poolRolls.map(row => row.数值)
    });

    const damageExpr = check.success ? payload.成功伤害表达式 : payload.失败伤害表达式;
    let damage = 0;
    let hpChange: { before?: number; after?: number } = {};
    if (damageExpr) {
        const dmgRoll = rollDiceExpression(damageExpr);
        if (!dmgRoll) {
            return { success: false, error: `Invalid damage expression: ${damageExpr}` };
        }
        damage = dmgRoll.total + (payload.伤害加值 || 0);
        hpChange = applyDamageToUnit(state, payload.目标UNIT_ID, damage);
    }

    const event: CombatResolutionEvent = {
        id: makeResolutionId(),
        时间: state.游戏时间 || new Date().toISOString(),
        回合: state.回合数,
        行动者: payload.行动者,
        目标: payload.目标 || payload.来源,
        动作: payload.动作,
        骰子: 'd20',
        掷骰: check.selected,
        修正: check.modifier,
        对抗值: payload.DC,
        是否成功: check.success,
        伤害: damage > 0 ? damage : undefined,
        结果: check.success
            ? `豁免成功${damage > 0 ? `，仍受 ${damage} 伤害` : ''}`
            : `豁免失败${damage > 0 ? `，受到 ${damage} 伤害` : ''}`,
        步骤: [
            {
                标签: `豁免${payload.豁免类型 ? `(${payload.豁免类型})` : ''}`,
                数值: check.selected,
                类型: '掷骰',
                说明: `候选 [${check.rolls.join(', ')}]，修正 ${check.modifier >= 0 ? `+${check.modifier}` : check.modifier}`
            },
            {
                标签: '豁免DC',
                数值: payload.DC,
                类型: '对抗',
                说明: check.success ? '通过' : '失败'
            },
            ...(damage > 0 ? [{
                标签: '伤害',
                数值: damage,
                类型: '伤害' as const,
                说明: hpChange.before !== undefined ? `HP ${hpChange.before} -> ${hpChange.after}` : undefined
            }] : [])
        ],
        标签: [...(payload.标签 || []), 'saving_throw']
    };
    pushCombatEvent(state, event);
    return { success: true, event };
}

export function handleResolveDamageRoll(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string; event?: CombatResolutionEvent } {
    const validation = validateSchema(ResolveDamageRollSchema, value);
    if (!validation.success) {
        const msg = `Invalid payload: ${(validation as any).error}`;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const payload = (validation as any).data as ResolveDamageRollPayload;
    const dmgRoll = rollDiceExpression(payload.伤害表达式);
    if (!dmgRoll) {
        return { success: false, error: `Invalid damage expression: ${payload.伤害表达式}` };
    }
    const damage = dmgRoll.total + (payload.伤害加值 || 0);
    const hpChange = applyDamageToUnit(state, payload.目标UNIT_ID, damage);

    const event: CombatResolutionEvent = {
        id: makeResolutionId(),
        时间: state.游戏时间 || new Date().toISOString(),
        回合: state.回合数,
        行动者: payload.行动者,
        目标: payload.目标,
        动作: payload.动作,
        骰子: payload.伤害表达式,
        掷骰: dmgRoll.total,
        修正: payload.伤害加值 || 0,
        伤害: damage,
        是否成功: true,
        结果: hpChange.before !== undefined
            ? `造成 ${damage} 伤害（HP ${hpChange.before} -> ${hpChange.after}）`
            : `造成 ${damage} 伤害`,
        步骤: [{
            标签: '伤害掷骰',
            数值: damage,
            类型: '伤害',
            说明: `${payload.伤害表达式}${payload.伤害加值 ? ` + ${payload.伤害加值}` : ''}`
        }],
        标签: [...(payload.标签 || []), 'damage_roll']
    };
    pushCombatEvent(state, event);
    return { success: true, event };
}

export function handleAppendCombatResolution(
    state: GameState,
    value: unknown
): { success: boolean; error?: string } {
    const entries = Array.isArray(value) ? value : [value];
    if (!entries.length) {
        return { success: false, error: 'append_combat_resolution requires non-empty value' };
    }

    const validated = entries.map(item => validateSchema(CombatResolutionEventSchema, item));
    const errors = validated.filter(item => !item.success);
    if (errors.length > 0) {
        return { success: false, error: `Validation failed for ${errors.length} combat resolution entries` };
    }

    if (!state.战斗) {
        state.战斗 = {} as any;
    }
    if (!state.战斗.判定事件) {
        state.战斗.判定事件 = [];
    }

    const nextRows = validated.map(item => (item as any).data as CombatResolutionEvent);
    state.战斗.判定事件.push(...nextRows);
    if (state.战斗.判定事件.length > 60) {
        state.战斗.判定事件 = state.战斗.判定事件.slice(-60);
    }

    return { success: true };
}

export function handleAppendLogSummary(
    state: GameState,
    value: unknown
): { success: boolean; error?: string } {
    const fallbackTime = resolveAbsoluteDateTime(state.游戏时间, state, `${toText(state.当前日期)} ${toText(state.游戏时间)}`) || '1000-01-01 00:00';
    const coerceSummaryValue = (raw: unknown): Record<string, unknown> | null => {
        if (raw === null || raw === undefined) return null;
        if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
            const text = String(raw).trim();
            if (isPhoneMemoryText(text)) return null;
            if (!text) return null;
            const span = resolveTimeSpan('', state, fallbackTime);
            return {
                回合: Math.max(0, Math.floor(state.回合数 || 0)),
                时间: fallbackTime,
                摘要: text,
                纪要: text,
                时间跨度: span || `${fallbackTime}—${fallbackTime}`,
                地点: state.当前地点 || '未知地点',
                重要对话: ''
            };
        }
        if (Array.isArray(raw)) {
            if (raw.length === 0) return null;
            for (const item of raw) {
                const candidate = coerceSummaryValue(item);
                if (candidate) return candidate;
            }
            return null;
        }
        if (typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            const nestedKeys = ['value', 'data', 'row', 'payload', 'rows', 'records'];
            for (const key of nestedKeys) {
                if (obj[key] !== undefined && obj[key] !== raw) {
                    const candidate = coerceSummaryValue(obj[key]);
                    if (candidate) return candidate;
                }
            }
            const summaryText = toText(
                obj.摘要
                ?? obj.纪要
                ?? obj.summary
                ?? obj.text
                ?? obj.content
                ?? obj.body
                ?? obj.message
                ?? obj.大纲
                ?? obj.标题
            );
            if (!summaryText) return null;
            if (isPhoneMemoryText(summaryText)) return null;
            const normalizedTime = resolveAbsoluteDateTime(obj.时间 ?? obj.time, state, fallbackTime) || fallbackTime;
            const normalizedSpan = resolveTimeSpan(obj.时间跨度 ?? obj.time_span, state, normalizedTime);
            return {
                回合: Math.max(0, Math.floor(toNumber(obj.回合 ?? obj.turn) ?? state.回合数 ?? 0)),
                时间: normalizedTime,
                摘要: summaryText,
                编码索引: toText(obj.编码索引 ?? obj.am_index) || undefined,
                时间跨度: normalizedSpan || `${normalizedTime}—${normalizedTime}`,
                地点: toText(obj.地点 ?? obj.location) || state.当前地点 || '未知地点',
                纪要: normalizeUserReferenceText(obj.纪要 ?? obj.summary, state) || normalizeUserReferenceText(summaryText, state),
                重要对话: normalizeDialogueSpeakerText(obj.重要对话 ?? obj.key_dialogue, state) || ''
            };
        }
        return null;
    };

    const normalizedInput = coerceSummaryValue(value);
    if (!normalizedInput) {
        if (containsPhoneMemoryMarker(value)) return { success: true };
        return { success: false, error: 'append_log_summary missing valid payload' };
    }
    const validation = validateSchema(LogSummarySchema, normalizedInput);

    if (!validation.success) {
        console.warn('append_log_summary validation error:', (validation as any).error);
        return { success: false, error: (validation as any).error };
    }

    if (!state.日志摘要) {
        state.日志摘要 = [];
    }

    const normalized = structuredClone((validation as any).data as LogSummary);
    normalized.时间 = resolveAbsoluteDateTime((normalized as any).时间, state, fallbackTime) || fallbackTime;
    const normalizedSummary = normalizeUserReferenceText((normalized as any).纪要, state)
        || normalizeUserReferenceText((normalized as any).摘要, state);
    if (!normalizedSummary) {
        return { success: false, error: 'append_log_summary requires 纪要/摘要' };
    }
    if (isPhoneMemoryText(normalizedSummary)) return { success: true };
    (normalized as any).时间跨度 = resolveTimeSpan((normalized as any).时间跨度, state, normalized.时间)
        || resolveTimeSpan('', state, normalized.时间)
        || `${normalized.时间}—${normalized.时间}`;
    (normalized as any).纪要 = normalizedSummary;
    (normalized as any).摘要 = normalizeUserReferenceText((normalized as any).摘要, state) || normalizedSummary;
    (normalized as any).地点 = toText((normalized as any).地点) || state.当前地点 || '未知地点';
    (normalized as any).重要对话 = normalizeDialogueSpeakerText((normalized as any).重要对话, state) || '';
    const rawIndex = (normalized as any).编码索引;
    if (rawIndex !== undefined) {
        const am = normalizeAmIndex(rawIndex);
        if (am) {
            (normalized as any).编码索引 = am;
        } else {
            delete (normalized as any).编码索引;
        }
    }

    state.日志摘要.push(normalized);
    return { success: true };
}

export function handleAppendLogOutline(
    state: GameState,
    value: unknown
): { success: boolean; error?: string } {
    const toEventList = (source: unknown, fallback: string): string[] => {
        if (Array.isArray(source)) {
            const list = source.map((item) => normalizeUserReferenceText(item, state)).filter(Boolean);
            if (list.length > 0) return list;
        }
        const asText = normalizeUserReferenceText(source, state);
        if (asText) {
            const split = asText.split(/[；;。|]/g).map((item) => item.trim()).filter(Boolean);
            if (split.length > 0) return split.slice(0, 8);
        }
        if (fallback) {
            return fallback.split(/[；;。|]/g).map((item) => item.trim()).filter(Boolean).slice(0, 8);
        }
        return ['剧情推进'];
    };
    const fallbackTime = resolveAbsoluteDateTime(state.游戏时间, state, `${toText(state.当前日期)} ${toText(state.游戏时间)}`) || '1000-01-01 00:00';
    const coerceOutlineValue = (raw: unknown): Record<string, unknown> | null => {
        if (raw === null || raw === undefined) {
            const lastSummary = Array.isArray(state.日志摘要) ? state.日志摘要[state.日志摘要.length - 1] : null;
            const fallbackOutline = toText((lastSummary as any)?.摘要 ?? (lastSummary as any)?.纪要);
            if (!fallbackOutline) return null;
            const events = toEventList((lastSummary as any)?.重要对话, fallbackOutline);
            const outline = resolveSegmentOutlineText(fallbackOutline, events, state, fallbackOutline);
            return {
                章节: `第${Math.max(1, Math.floor(state.回合数 || 1))}回`,
                标题: '自动补全大纲',
                开始回合: Math.max(0, Math.floor((lastSummary as any)?.回合 ?? state.回合数 ?? 0)),
                编码索引: toText((lastSummary as any)?.编码索引) || undefined,
                大纲: outline,
                时间跨度: resolveTimeSpan((lastSummary as any)?.时间跨度, state, (lastSummary as any)?.时间 || fallbackTime)
                    || resolveTimeSpan('', state, (lastSummary as any)?.时间 || fallbackTime)
                    || `${fallbackTime}—${fallbackTime}`,
                事件列表: events
            };
        }
        if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
            const text = String(raw).trim();
            if (isPhoneMemoryText(text)) return null;
            if (!text) return null;
            const events = toEventList(text, text);
            const outline = resolveSegmentOutlineText(text, events, state, text);
            return {
                章节: `第${Math.max(1, Math.floor(state.回合数 || 1))}回`,
                标题: '剧情大纲',
                开始回合: Math.max(0, Math.floor(state.回合数 || 0)),
                大纲: outline,
                时间跨度: resolveTimeSpan('', state, fallbackTime) || `${fallbackTime}—${fallbackTime}`,
                事件列表: events
            };
        }
        if (Array.isArray(raw)) {
            if (raw.length === 0) return null;
            for (const item of raw) {
                const candidate = coerceOutlineValue(item);
                if (candidate) return candidate;
            }
            return null;
        }
        if (typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            const nestedKeys = ['value', 'data', 'row', 'payload', 'rows', 'records'];
            for (const key of nestedKeys) {
                if (obj[key] !== undefined && obj[key] !== raw) {
                    const candidate = coerceOutlineValue(obj[key]);
                    if (candidate) return candidate;
                }
            }
            const outlineRaw = normalizeUserReferenceText(
                obj.大纲 ?? obj.outline ?? obj.摘要 ?? obj.标题 ?? obj.text ?? obj.content,
                state
            );
            if (isPhoneMemoryText(outlineRaw)) return null;
            const sectionRaw = obj.章节 ?? obj.chapter ?? obj.section;
            const titleRaw = obj.标题 ?? obj.title ?? obj.headline;
            const events = toEventList(obj.事件列表 ?? obj.events, outlineRaw || toText(titleRaw) || '剧情推进');
            const outline = resolveSegmentOutlineText(
                outlineRaw,
                events,
                state,
                events.join('；') || normalizeUserReferenceText(titleRaw, state) || '剧情推进'
            );
            return {
                章节: toText(sectionRaw) || `第${Math.max(1, Math.floor(state.回合数 || 1))}回`,
                标题: normalizeUserReferenceText(titleRaw, state) || '剧情大纲',
                开始回合: Math.max(0, Math.floor(toNumber(obj.开始回合 ?? obj.startTurn ?? obj.turn) ?? state.回合数 ?? 0)),
                结束回合: toNumber(obj.结束回合 ?? obj.endTurn) ?? undefined,
                编码索引: toText(obj.编码索引 ?? obj.am_index) || undefined,
                时间跨度: resolveTimeSpan(obj.时间跨度 ?? obj.time_span, state, fallbackTime)
                    || resolveTimeSpan('', state, fallbackTime)
                    || `${fallbackTime}—${fallbackTime}`,
                大纲: outline,
                事件列表: events
            };
        }
        return null;
    };

    const normalizedInput = coerceOutlineValue(value);
    if (!normalizedInput) {
        if (containsPhoneMemoryMarker(value)) return { success: true };
        return { success: false, error: 'append_log_outline missing valid payload' };
    }
    const validation = validateSchema(LogOutlineSchema, normalizedInput);

    if (!validation.success) {
        console.warn('append_log_outline validation error:', (validation as any).error);
        return { success: false, error: (validation as any).error };
    }

    if (!state.日志大纲) {
        state.日志大纲 = [];
    }

    const normalized = structuredClone((validation as any).data as LogOutline);
    const normalizedEvents = Array.isArray((normalized as any).事件列表)
        ? (normalized as any).事件列表
            .map((item: unknown) => normalizeUserReferenceText(item, state))
            .filter(Boolean)
            .filter((item: string) => !isPhoneMemoryText(item))
        : [];
    const baseOutline = normalizeUserReferenceText(toText((normalized as any).大纲 || (normalized as any).标题), state);
    if (isPhoneMemoryText(baseOutline) && normalizedEvents.length === 0) return { success: true };
    (normalized as any).事件列表 = normalizedEvents.length > 0 ? normalizedEvents : ['剧情推进'];
    (normalized as any).时间跨度 = resolveTimeSpan((normalized as any).时间跨度, state, fallbackTime)
        || resolveTimeSpan('', state, fallbackTime)
        || `${fallbackTime}—${fallbackTime}`;
    (normalized as any).大纲 = resolveSegmentOutlineText(
        baseOutline,
        (normalized as any).事件列表,
        state,
        normalizeUserReferenceText((normalized as any).标题, state) || '剧情推进'
    );
    if (isPhoneMemoryText((normalized as any).大纲)) return { success: true };
    const rawIndex = (normalized as any).编码索引;
    if (rawIndex !== undefined) {
        const am = normalizeAmIndex(rawIndex);
        if (am) {
            (normalized as any).编码索引 = am;
        } else {
            delete (normalized as any).编码索引;
        }
    }

    state.日志大纲.push(normalized);
    return { success: true };
}

export function handleSetActionOptions(
    state: GameState,
    value: unknown,
    settings?: { enableActionOptions?: boolean }
): { success: boolean; error?: string } {
    // Gate this feature if not enabled in settings
    if (settings && !settings.enableActionOptions) {
        console.warn('set_action_options: feature disabled in settings');
        return { success: false, error: 'Action options feature is disabled' };
    }

    if (!Array.isArray(value)) {
        return { success: false, error: 'set_action_options requires array value' };
    }

    const validatedOptions = value.map(opt => validateSchema(ActionOptionSchema, opt));
    const errors = validatedOptions.filter(r => !r.success);

    if (errors.length > 0) {
        console.warn('set_action_options validation errors:', errors.map(e => 'error' in e ? e.error : ''));
        return { success: false, error: `Validation failed for ${errors.length} options` };
    }

    state.可选行动列表 = validatedOptions.map(r => (r as any).data as ActionOption);
    return { success: true };
}

export function handleUpsertNPC(
    state: GameState,
    value: unknown
): { success: boolean; error?: string } {
    const unwrapNpcRows = (raw: unknown): Record<string, unknown>[] => {
        if (raw === null || raw === undefined) return [];
        if (Array.isArray(raw)) {
            return raw
                .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
        }
        if (typeof raw === 'string') {
            const text = raw.trim();
            if (!text) return [];
            try {
                const parsed = JSON.parse(text);
                return unwrapNpcRows(parsed);
            } catch {
                return [];
            }
        }
        if (typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            const arrayLikeKeys = ['rows', 'value', 'data', 'payload', 'npcs'];
            for (const key of arrayLikeKeys) {
                if (obj[key] !== undefined && obj[key] !== raw) {
                    const nested = unwrapNpcRows(obj[key]);
                    if (nested.length > 0) return nested;
                }
            }
            return [obj];
        }
        return [];
    };
    const normalizeNpcRow = (row: Record<string, unknown>): Record<string, unknown> | null => {
        const id = toText(row.id ?? row.NPC_ID ?? row.npc_id ?? row.姓名 ?? row.name ?? row.NPC);
        const name = toText(row.姓名 ?? row.name ?? row.NPC ?? row.npc_name);
        if (!id) return null;
        const presence = toBoolean(row.是否在场 ?? row.present);
        const currentStatus = normalizeNpcCurrentStatus(row.当前状态 ?? row.status ?? row.状态, presence);
        return {
            ...row,
            id,
            姓名: name || undefined,
            当前状态: currentStatus,
            所在位置: toText(row.所在位置 ?? row.位置详情 ?? row.location) || undefined,
            与主角关系: toText(row.与主角关系 ?? row.relation) || undefined,
            职业身份: toText(row.职业身份 ?? row.身份 ?? row.role) || undefined,
            是否在场: resolveNpcPresence(currentStatus, presence),
            好感度: toNumber(row.好感度 ?? row.affinity) ?? undefined
        };
    };
    const rows = unwrapNpcRows(value)
        .map((row) => normalizeNpcRow(row))
        .filter((row): row is Record<string, unknown> => !!row);
    const resolvedPlayerName = resolvePlayerName(state.角色?.姓名);
    const sanitizedRows = rows.filter((row) => {
        const incomingName = toText((row as any)?.姓名).trim();
        const incomingId = toText((row as any)?.id).trim();
        const incomingIdNormalized = incomingId.toLowerCase();
        if (isPlayerReference(incomingName, resolvedPlayerName)) return false;
        if (isPlayerReference(incomingId, resolvedPlayerName)) return false;
        if (
            incomingIdNormalized === 'pc_main'
            || incomingIdNormalized === 'player_main'
            || incomingIdNormalized === 'main_player'
        ) {
            return false;
        }
        return true;
    });

    if (!sanitizedRows || sanitizedRows.length === 0) {
        return { success: true };
    }

    const validatedRows = sanitizedRows.map(row => validateSchema(NPCTavernDBSchema, row));
    const errors = validatedRows.filter(r => !r.success);

    if (errors.length > 0) {
        console.warn('upsert_npc validation errors:', errors.map(e => 'error' in e ? e.error : ''));
        return { success: false, error: `Validation failed for ${errors.length} NPCs` };
    }

    const newNPCs = validatedRows.map(r => (r as any).data);

    if (!state.社交) {
        state.社交 = [];
    }

    const isCanonicalNpcId = (id: string) => /^char[_-]/i.test(id);
    const normalizeNpcIdentity = (value: unknown) => String(value ?? '').trim().toLowerCase();

    newNPCs.forEach(npc => {
        const incomingId = String((npc as any).id || '').trim();
        const incomingName = String((npc as any).姓名 || '').trim();
        let index = state.社交.findIndex(existing => String(existing.id || '').trim() === incomingId);
        if (index < 0 && incomingName) {
            const targetName = normalizeNpcIdentity(incomingName);
            index = state.社交.findIndex(existing => {
                const existingName = normalizeNpcIdentity(existing.姓名);
                const existingId = normalizeNpcIdentity(existing.id);
                return (existingName && existingName === targetName) || existingId === targetName;
            });
        }
        const { 特别关注: _ignoredSpecialAttention, ...safeNpc } = npc as any;
        if (index >= 0) {
            const currentSpecialAttention = !!state.社交[index].特别关注;
            const resolvedNpcId = (() => {
                const existingId = String(state.社交[index].id || '').trim();
                if (!incomingId) return existingId;
                if (existingId && !isCanonicalNpcId(incomingId)) return existingId;
                return incomingId || existingId;
            })();
            state.社交[index] = {
                记忆: state.社交[index].记忆 || [],
                好感度: state.社交[index].好感度 ?? 0,
                关系状态: state.社交[index].关系状态 || '普通',
                种族: state.社交[index].种族 || '未知',
                眷族: state.社交[index].眷族 || '无',
                身份: state.社交[index].身份 || '未知',
                ...state.社交[index],
                ...safeNpc,
                id: resolvedNpcId || state.社交[index].id,
                特别关注: currentSpecialAttention
            };
        } else {
            // A-XXX FIX: Default 是否在场 to true for new NPCs so they appear in "周围的人"
            const newConfidant = {
                记忆: [],
                好感度: 0,
                关系状态: '普通',
                种族: '未知',
                眷族: '无',
                身份: '未知',
                特别关注: false,
                是否在场: true,
                当前状态: '在场' as const,
                ...safeNpc
            };
            state.社交.push(newConfidant as any);
        }
    });

    const deduped: any[] = [];
    state.社交.forEach((npc) => {
        const npcId = String(npc?.id || '').trim();
        const npcName = String(npc?.姓名 || '').trim();
        const normalizedId = normalizeNpcIdentity(npcId);
        const normalizedName = normalizeNpcIdentity(npcName);
        const existingIndex = deduped.findIndex((row) => {
            const rowId = normalizeNpcIdentity(row?.id);
            const rowName = normalizeNpcIdentity(row?.姓名);
            if (normalizedId && rowId && normalizedId === rowId) return true;
            if (normalizedName && rowName && normalizedName === rowName) return true;
            return false;
        });
        if (existingIndex < 0) {
            deduped.push(npc);
            return;
        }
        const existing = deduped[existingIndex];
        const nextId = (() => {
            const existingId = String(existing?.id || '').trim();
            const incomingId = String(npc?.id || '').trim();
            if (existingId && isCanonicalNpcId(existingId)) return existingId;
            if (incomingId && isCanonicalNpcId(incomingId)) return incomingId;
            return existingId || incomingId;
        })();
        deduped[existingIndex] = {
            ...existing,
            ...npc,
            id: nextId || existing?.id || npc?.id
        };
    });
    state.社交 = deduped;

    return { success: true };
}

export function handleUpsertInventory(
    state: GameState,
    value: unknown
): { success: boolean; error?: string } {
    const unwrapInventoryRows = (raw: unknown): Record<string, unknown>[] => {
        if (raw === null || raw === undefined) return [];
        if (Array.isArray(raw)) {
            return raw
                .flatMap((item) => unwrapInventoryRows(item))
                .filter((row) => !!row && typeof row === 'object');
        }
        if (typeof raw === 'string') {
            const text = raw.trim();
            if (!text) return [];
            try {
                const parsed = JSON.parse(text);
                return unwrapInventoryRows(parsed);
            } catch {
                return [{ 名称: text }];
            }
        }
        if (typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            const arrayLikeKeys = ['rows', 'value', 'data', 'payload', 'items', 'inventory', 'list'];
            for (const key of arrayLikeKeys) {
                if (obj[key] !== undefined && obj[key] !== raw) {
                    const nested = unwrapInventoryRows(obj[key]);
                    if (nested.length > 0) return nested;
                }
            }
            return [obj];
        }
        return [];
    };

    const normalizeInventoryRow = (row: Record<string, unknown>): Record<string, unknown> | null => {
        const name = toText(
            row.名称
            ?? row.物品名称
            ?? row.name
            ?? row.item_name
            ?? row.itemName
            ?? row.title
            ?? row.label
        );
        if (!name) return null;
        const quantity = toNumber(row.数量 ?? row.count ?? row.qty ?? row.amount ?? row.num);
        const price = toNumber(row.价值 ?? row.value ?? row.price ?? row.cost);
        const attack = toNumber(row.攻击力 ?? row.attack ?? row.attackPower);
        const defense = toNumber(row.防御力 ?? row.defense ?? row.defensePower ?? row.armor);
        return {
            ...row,
            id: toText(row.id ?? row.物品ID ?? row.item_id ?? row.itemId) || undefined,
            名称: name,
            数量: quantity !== null ? Math.max(0, Math.floor(quantity)) : undefined,
            描述: toText(row.描述 ?? row.description ?? row.desc) || undefined,
            类型: toText(row.类型 ?? row.类别 ?? row.type ?? row.category) || undefined,
            所属人: toText(row.所属人 ?? row.owner ?? row.holder) || undefined,
            伤害: toText(row.伤害 ?? row.damage) || undefined,
            特性: toText(row.特性 ?? row.feature ?? row.trait ?? row.effect) || undefined,
            价值单位: toText(row.价值单位 ?? row.currency ?? row.value_unit ?? row.unit) || undefined,
            品质: toText(row.品质 ?? row.quality ?? row.rarity) || undefined,
            攻击力: attack !== null ? attack : undefined,
            防御力: defense !== null ? defense : undefined,
            价值: price !== null ? price : undefined
        };
    };

    const normalizedRows = unwrapInventoryRows(value)
        .map((row) => normalizeInventoryRow(row))
        .filter((row): row is Record<string, unknown> => !!row);
    if (normalizedRows.length === 0) {
        console.warn('upsert_inventory skipped: no valid item rows');
        return { success: true };
    }

    const validatedItems = normalizedRows.map((item) => validateSchema(InventoryItemTavernDBSchema, item));
    const errors = validatedItems.filter((r) => !r.success);
    const newItems = validatedItems
        .filter((result) => result.success)
        .map((result) => (result as any).data);
    if (errors.length > 0) {
        console.warn('upsert_inventory validation errors:', errors.map((e) => 'error' in e ? e.error : ''));
    }
    if (newItems.length === 0) {
        return { success: true };
    }

    if (!state.背包) {
        state.背包 = [];
    }

    newItems.forEach(item => {
        let index = -1;
        // A-007 FIX: Match by both 名称 AND 品质 to prevent item loss when qualities differ
        if (item.id) {
            index = state.背包.findIndex(existing => existing.id === item.id);
        } else {
            index = state.背包.findIndex(existing =>
                existing.名称 === item.名称 &&
                (existing.品质 === item.品质 || (!existing.品质 && !item.品质))
            );
        }

        if (index >= 0) {
            state.背包[index] = { ...state.背包[index], ...item };
        } else {
            const newItem = {
                id: item.id || crypto.randomUUID(),
                数量: 1,
                描述: '',
                类型: '杂项',
                ...item
            };
            state.背包.push(newItem as any);
        }
    });

    return { success: true };
}

const ECON_LEDGER_LIMIT = 500;

const pushEconomicLedgerEntries = (state: GameState, entries: EconomicLedgerEntry[]) => {
    const prev = Array.isArray(state.经济流水) ? state.经济流水 : [];
    const next = [...prev, ...entries];
    state.经济流水 = next.length > ECON_LEDGER_LIMIT ? next.slice(-ECON_LEDGER_LIMIT) : next;
};

const buildLedgerId = (account: string) => `ECO_${Date.now()}_${account.replace('.', '_')}_${Math.random().toString(36).slice(2, 7)}`;

const updateEconomicAccount = (state: GameState, account: '角色.法利' | '眷族.资金', nextValue: number): boolean => {
    if (account === '角色.法利') {
        if (typeof state.角色?.法利 !== 'number') return false;
        state.角色.法利 = nextValue;
        return true;
    }
    if (typeof state.眷族?.资金 !== 'number') return false;
    state.眷族.资金 = nextValue;
    return true;
};

const readEconomicAccount = (state: GameState, account: '角色.法利' | '眷族.资金'): number | null => {
    if (account === '角色.法利') return typeof state.角色?.法利 === 'number' ? state.角色.法利 : null;
    return typeof state.眷族?.资金 === 'number' ? state.眷族.资金 : null;
};

export function handleAppendEconomicLedger(
    state: GameState,
    value: unknown
): { success: boolean; error?: string } {
    const validation = validateSchema(AppendEconomicLedgerSchema, value);
    if (!validation.success) {
        return { success: false, error: (validation as any).error };
    }

    const rows = Array.isArray((validation as any).data) ? (validation as any).data : [(validation as any).data];
    const normalized = rows.map((row: EconomicLedgerEntry) => ({
        ...row,
        id: row.id || buildLedgerId(row.account),
        after: typeof row.after === 'number' ? row.after : (row.before + row.delta)
    }));

    pushEconomicLedgerEntries(state, normalized);
    return { success: true };
}

export function handleApplyEconomicDelta(
    state: GameState,
    value: unknown
): { success: boolean; error?: string; entry?: EconomicLedgerEntry } {
    const validation = validateSchema(ApplyEconomicDeltaSchema, value);
    if (!validation.success) {
        return { success: false, error: (validation as any).error };
    }

    const payload = (validation as any).data as {
        account: '角色.法利' | '眷族.资金';
        delta: number;
        reason: string;
        commandRef?: string;
        turn?: number;
        timestamp?: string;
    };

    const before = readEconomicAccount(state, payload.account);
    if (before === null) {
        return { success: false, error: `无法读取经济账户: ${payload.account}` };
    }

    const after = before + payload.delta;
    if (after < 0) {
        return { success: false, error: `经济守卫阻断: ${payload.account} 变更后为负数 (${after})` };
    }

    if (!updateEconomicAccount(state, payload.account, after)) {
        return { success: false, error: `无法写入经济账户: ${payload.account}` };
    }

    const entry: EconomicLedgerEntry = {
        id: buildLedgerId(payload.account),
        turn: typeof payload.turn === 'number' ? payload.turn : (state.回合数 || 0),
        timestamp: payload.timestamp || state.游戏时间 || new Date().toISOString(),
        account: payload.account,
        before,
        delta: payload.delta,
        after,
        reason: payload.reason,
        commandRef: payload.commandRef
    };
    pushEconomicLedgerEntries(state, [entry]);
    return { success: true, entry };
}

const upsertByKey = <T extends Record<string, any>>(list: T[], rows: T[], keyField: string) => {
    rows.forEach((row) => {
        const key = row?.[keyField];
        if (key === undefined || key === null || key === '') {
            list.push(row);
            return;
        }
        const index = list.findIndex((item) => item?.[keyField] === key);
        if (index >= 0) {
            list[index] = { ...list[index], ...row };
        } else {
            list.push(row);
        }
    });
};

const SHEET_PRIMARY_KEY_MAP = new Map<string, string>(
    getDomainMappingRegistry().map((mapping) => [mapping.sheetId, mapping.primaryKey])
);
const GLOBAL_STATE_ROW_ID = 'GLOBAL_STATE';

type SheetShadowStore = Record<string, Array<Record<string, unknown>>>;

const ensureSheetShadowStore = (state: GameState): SheetShadowStore => {
    const current = (state as any).__tableRows;
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
        (state as any).__tableRows = {};
    }
    return (state as any).__tableRows as SheetShadowStore;
};

const resolveSheetKeyField = (
    sheetId: string,
    override?: string,
    sampleRow?: Record<string, unknown>
): string => {
    const normalizedOverride = typeof override === 'string' ? override.trim() : '';
    if (normalizedOverride) return normalizedOverride;
    const mapped = SHEET_PRIMARY_KEY_MAP.get(sheetId);
    if (mapped) return mapped;
    const fallbackCandidates = ['id', 'ID', 'key', 'KEY'];
    for (const candidate of fallbackCandidates) {
        if (sampleRow && Object.prototype.hasOwnProperty.call(sampleRow, candidate)) {
            return candidate;
        }
    }
    return 'id';
};

const normalizeSheetPayloadAliases = (raw: unknown, depth: number = 0): unknown => {
    if (depth > 8) return raw;
    if (typeof raw === 'string') {
        const text = raw.trim();
        if (text) {
            try {
                return normalizeSheetPayloadAliases(JSON.parse(text), depth + 1);
            } catch {
                return raw;
            }
        }
        return raw;
    }
    if (Array.isArray(raw)) {
        return raw.map((item) => normalizeSheetPayloadAliases(item, depth + 1));
    }
    if (!raw || typeof raw !== 'object') return raw;
    const record = raw as Record<string, unknown>;
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

const upsertRowsInShadowStore = (
    state: GameState,
    sheetId: string,
    rows: Array<Record<string, unknown>>,
    keyField: string
) => {
    const store = ensureSheetShadowStore(state);
    if (!Array.isArray(store[sheetId])) {
        store[sheetId] = [];
    }
    const list = store[sheetId]!;
    rows.forEach((row) => {
        const key = row?.[keyField];
        if (key === undefined || key === null || key === '') {
            list.push({ ...row });
            return;
        }
        const idx = list.findIndex((item) => item?.[keyField] === key);
        if (idx >= 0) {
            list[idx] = { ...list[idx], ...row };
        } else {
            list.push({ ...row });
        }
    });
};

const deleteRowsInShadowStore = (
    state: GameState,
    sheetId: string,
    rowIds: Array<string | number>,
    keyField: string
) => {
    const store = ensureSheetShadowStore(state);
    const list = Array.isArray(store[sheetId]) ? store[sheetId] : [];
    const rowIdSet = new Set(rowIds.map((item) => String(item)));
    store[sheetId] = list.filter((row) => !rowIdSet.has(String(row?.[keyField])));
};

const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
};

const toText = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
};

const PHONE_MEMORY_PREFIX = /^【手机】/;

const isPhoneMemoryText = (value: unknown): boolean => PHONE_MEMORY_PREFIX.test(toText(value));

const normalizeUserReferenceText = (value: unknown, state: GameState): string => {
    const text = toText(value);
    if (!text) return '';
    const playerName = resolvePlayerName(state?.角色?.姓名);
    return replaceUserPlaceholders(text, playerName);
};

const normalizeDialogueSpeakerText = (value: unknown, state: GameState): string => {
    const playerName = resolvePlayerName(state?.角色?.姓名);
    const text = replaceUserPlaceholders(toText(value), playerName);
    if (!text) return '';
    return text.replace(
        /(^|[\n\r；;。!?！？]\s*)(player|user|you|玩家)\s*([:：])/gi,
        (_match, prefix: string, _speaker: string, colon: string) => `${prefix}${playerName}${colon}`
    );
};

const containsPhoneMemoryMarker = (value: unknown, depth: number = 0): boolean => {
    if (depth > 4 || value === null || value === undefined) return false;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return isPhoneMemoryText(value);
    }
    if (Array.isArray(value)) {
        return value.some((item) => containsPhoneMemoryMarker(item, depth + 1));
    }
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const candidateKeys = [
            '摘要', '纪要', 'summary', 'content', '内容', 'text', 'message',
            '大纲', '标题', 'outline', '重要对话', 'dialogue', 'key_dialogue',
            '事件列表', 'events', 'event_list', 'value', 'data', 'row', 'payload', 'rows', 'records'
        ];
        return candidateKeys.some((key) => containsPhoneMemoryMarker(record[key], depth + 1));
    }
    return false;
};

const toBoolean = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return null;
        if (['1', 'true', 'yes', 'y', '是', '开', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'n', '否', '关', 'off'].includes(normalized)) return false;
    }
    return null;
};

const pickRowValue = (row: Record<string, unknown>, keys: string[]): unknown => {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            const value = row[key];
            if (value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')) {
                return value;
            }
        }
    }
    return undefined;
};

const parseCurrentMaxPair = (value: unknown): { current: number; max: number } | null => {
    if (value && typeof value === 'object') {
        const source = value as Record<string, unknown>;
        const current = toNumber(source.current ?? source.cur ?? source.当前 ?? source.hp ?? source.value);
        const max = toNumber(source.max ?? source.最大 ?? source.hpMax ?? source.maximum);
        if (current !== null && max !== null) {
            return { current: Math.max(0, Math.floor(current)), max: Math.max(1, Math.floor(max)) };
        }
    }
    const text = toText(value);
    const match = text.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!match) return null;
    return {
        current: Math.max(0, Number(match[1])),
        max: Math.max(1, Number(match[2]))
    };
};

type NpcCurrentStatus = '在场' | '离场' | '死亡' | '失踪';

const NPC_STATUS_ALIAS_MAP: Array<{ normalized: string; status: NpcCurrentStatus }> = [
    { normalized: '在场', status: '在场' },
    { normalized: '出现', status: '在场' },
    { normalized: '活动', status: '在场' },
    { normalized: '在线', status: '在场' },
    { normalized: 'on', status: '在场' },
    { normalized: 'online', status: '在场' },
    { normalized: 'active', status: '在场' },
    { normalized: 'present', status: '在场' },
    { normalized: '离场', status: '离场' },
    { normalized: '离开', status: '离场' },
    { normalized: '不在场', status: '离场' },
    { normalized: '下线', status: '离场' },
    { normalized: '离线', status: '离场' },
    { normalized: '外出', status: '离场' },
    { normalized: 'off', status: '离场' },
    { normalized: 'offline', status: '离场' },
    { normalized: 'inactive', status: '离场' },
    { normalized: 'absent', status: '离场' },
    { normalized: '死亡', status: '死亡' },
    { normalized: '阵亡', status: '死亡' },
    { normalized: '身亡', status: '死亡' },
    { normalized: '击杀', status: '死亡' },
    { normalized: 'dead', status: '死亡' },
    { normalized: '失踪', status: '失踪' },
    { normalized: '不明', status: '失踪' },
    { normalized: 'missing', status: '失踪' }
];

const normalizeNpcStatusKey = (value: string): string => value
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]/g, '');

const normalizeNpcCurrentStatus = (value: unknown, present: boolean | null): NpcCurrentStatus | undefined => {
    const text = toText(value);
    if (text) {
        const normalized = normalizeNpcStatusKey(text);
        const mapped = NPC_STATUS_ALIAS_MAP.find((item) => item.normalized === normalized);
        if (mapped) return mapped.status;
        if (/在场|在线|出现|活动|online|active|present/.test(normalized)) return '在场';
        if (/离场|离开|不在场|下线|离线|外出|offline|inactive|absent/.test(normalized)) return '离场';
        if (/死亡|阵亡|身亡|击杀|dead/.test(normalized)) return '死亡';
        if (/失踪|不明|missing/.test(normalized)) return '失踪';
    }
    if (present === true) return '在场';
    if (present === false) return '离场';
    return undefined;
};

const resolveNpcPresence = (status: NpcCurrentStatus | undefined, present: boolean | null): boolean | undefined => {
    if (status === '在场') return true;
    if (status === '离场' || status === '死亡' || status === '失踪') return false;
    if (present === null) return undefined;
    return present;
};

const ABSOLUTE_TIME_PATTERN = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2})$/;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const RELATIVE_TIME_PATTERN = /^第?\s*(\d+)\s*日?\s*(\d{1,2}):(\d{2})$/;
const TIME_ONLY_PATTERN = /^(\d{1,2}):(\d{2})$/;
const SPAN_SPLIT_PATTERN = /\s*(?:—|--|-|~|～|至|到)\s*/;

const pad2 = (value: number) => String(value).padStart(2, '0');
const normalizeDateOnly = (year: number, month: number, day: number) => `${year}-${pad2(month)}-${pad2(day)}`;
const normalizeDateTime = (year: number, month: number, day: number, hour: number, minute: number) =>
    `${normalizeDateOnly(year, month, day)} ${pad2(hour)}:${pad2(minute)}`;

const parseDateOnly = (raw: string): { year: number; month: number; day: number } | null => {
    const match = raw.match(DATE_ONLY_PATTERN);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    return { year, month, day };
};

const parseRelativeClock = (raw: string): { day: number; hour: number; minute: number } | null => {
    const match = raw.match(RELATIVE_TIME_PATTERN);
    if (!match) return null;
    const day = Number(match[1]);
    const hour = Number(match[2]);
    const minute = Number(match[3]);
    if (!Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (day < 1 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { day, hour, minute };
};

const getCalendarAnchor = (state: GameState): { year: number; month: number; day: number } | null => {
    const currentDate = parseDateOnly(toText(state.当前日期));
    if (!currentDate) return null;
    const currentRelative = parseRelativeClock(toText(state.游戏时间));
    if (!currentRelative) return currentDate;
    const base = new Date(Date.UTC(currentDate.year, currentDate.month - 1, currentDate.day));
    base.setUTCDate(base.getUTCDate() - (currentRelative.day - 1));
    return {
        year: base.getUTCFullYear(),
        month: base.getUTCMonth() + 1,
        day: base.getUTCDate()
    };
};

const resolveAbsoluteDateTime = (raw: unknown, state: GameState, fallback?: unknown): string => {
    const text = toText(raw);
    if (text) {
        const absoluteMatch = text.match(ABSOLUTE_TIME_PATTERN);
        if (absoluteMatch) {
            const year = Number(absoluteMatch[1]);
            const month = Number(absoluteMatch[2]);
            const day = Number(absoluteMatch[3]);
            const hour = Number(absoluteMatch[4]);
            const minute = Number(absoluteMatch[5]);
            if (
                Number.isFinite(year)
                && month >= 1 && month <= 12
                && day >= 1 && day <= 31
                && hour >= 0 && hour <= 23
                && minute >= 0 && minute <= 59
            ) {
                return normalizeDateTime(year, month, day, hour, minute);
            }
        }

        const relative = parseRelativeClock(text);
        if (relative) {
            const anchor = getCalendarAnchor(state) || parseDateOnly(toText(state.当前日期));
            if (anchor) {
                const base = new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day));
                base.setUTCDate(base.getUTCDate() + (relative.day - 1));
                return normalizeDateTime(
                    base.getUTCFullYear(),
                    base.getUTCMonth() + 1,
                    base.getUTCDate(),
                    relative.hour,
                    relative.minute
                );
            }
        }

        const timeOnlyMatch = text.match(TIME_ONLY_PATTERN);
        if (timeOnlyMatch) {
            const hour = Number(timeOnlyMatch[1]);
            const minute = Number(timeOnlyMatch[2]);
            const currentDate = parseDateOnly(toText(state.当前日期));
            if (currentDate && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
                return normalizeDateTime(currentDate.year, currentDate.month, currentDate.day, hour, minute);
            }
        }
    }

    const fallbackText = toText(fallback);
    if (fallbackText && fallbackText !== text) {
        const fallbackResolved = resolveAbsoluteDateTime(fallbackText, state);
        if (fallbackResolved) return fallbackResolved;
    }

    const currentDate = parseDateOnly(toText(state.当前日期));
    const currentRelative = parseRelativeClock(toText(state.游戏时间));
    if (currentDate && currentRelative) {
        return normalizeDateTime(currentDate.year, currentDate.month, currentDate.day, currentRelative.hour, currentRelative.minute);
    }
    if (currentDate) {
        return `${normalizeDateOnly(currentDate.year, currentDate.month, currentDate.day)} 00:00`;
    }
    return '';
};

const resolveTimeSpan = (raw: unknown, state: GameState, fallbackSingle?: unknown): string => {
    const text = toText(raw);
    if (text) {
        const parts = text.split(SPAN_SPLIT_PATTERN).map((item) => item.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const start = resolveAbsoluteDateTime(parts[0], state, state.上轮时间 || state.游戏时间);
            const end = resolveAbsoluteDateTime(parts[1], state, state.游戏时间 || state.上轮时间);
            const finalStart = start || end;
            const finalEnd = end || start;
            if (finalStart && finalEnd) {
                return `${finalStart}—${finalEnd}`;
            }
        }
        const single = resolveAbsoluteDateTime(parts[0] || text, state, fallbackSingle);
        if (single) {
            return `${single}—${single}`;
        }
    }

    const fallbackStart = resolveAbsoluteDateTime(state.上轮时间, state);
    const fallbackEnd = resolveAbsoluteDateTime(state.游戏时间, state);
    const finalStart = fallbackStart || fallbackEnd;
    const finalEnd = fallbackEnd || fallbackStart;
    if (finalStart && finalEnd) {
        return `${finalStart}—${finalEnd}`;
    }

    const single = resolveAbsoluteDateTime(fallbackSingle, state);
    return single ? `${single}—${single}` : '';
};

const parseTimeLabelToMinutes = (value: string): number | null => {
    const text = toText(value);
    if (!text) return null;
    const relative = parseRelativeClock(text);
    if (relative) {
        return (relative.day - 1) * 24 * 60 + relative.hour * 60 + relative.minute;
    }
    const absoluteMatch = text.match(ABSOLUTE_TIME_PATTERN);
    if (absoluteMatch) {
        const year = Number(absoluteMatch[1]);
        const month = Number(absoluteMatch[2]);
        const day = Number(absoluteMatch[3]);
        const hour = Number(absoluteMatch[4]);
        const minute = Number(absoluteMatch[5]);
        if (
            Number.isFinite(year)
            && month >= 1 && month <= 12
            && day >= 1 && day <= 31
            && hour >= 0 && hour <= 23
            && minute >= 0 && minute <= 59
        ) {
            return Math.floor(Date.UTC(year, month - 1, day, hour, minute) / 60000);
        }
    }
    return null;
};

const formatElapsedDuration = (minutes: number): string => {
    const normalized = Math.max(0, Math.floor(minutes));
    if (normalized <= 0) return '0分钟';
    const days = Math.floor(normalized / (24 * 60));
    const remainAfterDays = normalized % (24 * 60);
    const hours = Math.floor(remainAfterDays / 60);
    const mins = remainAfterDays % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}分钟`);
    return parts.join('');
};

const inferElapsedDuration = (prevTime: unknown, nextTime: unknown): string => {
    const prevMinutes = parseTimeLabelToMinutes(toText(prevTime));
    const nextMinutes = parseTimeLabelToMinutes(toText(nextTime));
    if (prevMinutes === null || nextMinutes === null) return '';
    const delta = nextMinutes - prevMinutes;
    if (delta < 0) return '';
    return formatElapsedDuration(delta);
};

const describeValidationErrors = (
    validated: Array<{ success: boolean; error?: string }>
): string => {
    const details = validated
        .map((result, index) => result.success ? '' : `row#${index + 1}:${String((result as any).error || 'invalid')}`)
        .filter(Boolean)
        .slice(0, 3);
    return details.join(' | ');
};

const normalizeOutlineKey = (value: string) =>
    value
        .replace(/[\s，,。；;、:：!！?？"'“”‘’\-—_]/g, '')
        .trim()
        .toLowerCase();

const isGenericOutlineText = (value: string): boolean => {
    const text = value.trim();
    if (!text) return true;
    if (/^第[一二三四五六七八九十0-9]+[卷章节回]$/.test(text)) return true;
    if (/^(剧情大纲|自动补全大纲|故事梗概|主线推进|章节概述)$/.test(text)) return true;
    return false;
};

const resolveSegmentOutlineText = (
    candidate: string,
    events: string[],
    state: GameState,
    fallback: string
): string => {
    const normalizedCandidate = normalizeOutlineKey(candidate);
    const normalizedHistory = (Array.isArray(state.日志大纲) ? state.日志大纲 : [])
        .slice(-8)
        .map((row: any) => normalizeOutlineKey(toText(row?.大纲 || row?.标题)))
        .filter(Boolean);
    const repeated = normalizedCandidate ? normalizedHistory.some((item) => item === normalizedCandidate) : false;
    const eventOutline = events.map((item) => toText(item)).filter(Boolean).slice(0, 4).join('；');
    if (isGenericOutlineText(candidate) || repeated) {
        if (eventOutline) return eventOutline;
        if (fallback) return fallback;
    }
    return candidate.trim() || eventOutline || fallback || '剧情推进';
};

const normalizeGlobalStateSheetRows = (rows: Array<Record<string, unknown>>, state: GameState) => {
    const normalizedRows = rows.map((row) => {
        const turn = Math.max(0, Math.floor(toNumber(row.当前回合 ?? row.turn ?? state.回合数 ?? 0) ?? 0));
        const worldX = toNumber(row.世界坐标X ?? row.坐标X ?? row.x);
        const worldY = toNumber(row.世界坐标Y ?? row.坐标Y ?? row.y);
        const currentRuntimeGameTime = toText(state.游戏时间);
        const incomingGameTime = toText(row.游戏时间 ?? row.时间);
        const normalizedGameTime = incomingGameTime || currentRuntimeGameTime || undefined;
        const explicitPrevTime = toText(row.上轮时间);
        const normalizedPrevTime = explicitPrevTime
            || (
                normalizedGameTime && currentRuntimeGameTime && normalizedGameTime !== currentRuntimeGameTime
                    ? currentRuntimeGameTime
                    : (toText(state.上轮时间) || undefined)
            );
        const explicitElapsed = toText(row.流逝时长);
        const inferredElapsed = !explicitElapsed && normalizedPrevTime && normalizedGameTime
            ? inferElapsedDuration(normalizedPrevTime, normalizedGameTime)
            : '';
        const normalizedElapsed = explicitElapsed || inferredElapsed || toText(state.流逝时长) || undefined;
        return {
            _global_id: GLOBAL_STATE_ROW_ID,
            当前回合: turn,
            当前场景: toText(row.当前场景 ?? row.当前地点 ?? row.地点) || toText(state.当前地点) || undefined,
            场景描述: toText(row.场景描述) || toText(state.场景描述) || undefined,
            当前日期: toText(row.当前日期 ?? row.日期) || toText(state.当前日期) || undefined,
            游戏时间: normalizedGameTime,
            上轮时间: normalizedPrevTime,
            流逝时长: normalizedElapsed,
            世界坐标X: worldX ?? (typeof state.世界坐标?.x === 'number' ? state.世界坐标.x : undefined),
            世界坐标Y: worldY ?? (typeof state.世界坐标?.y === 'number' ? state.世界坐标.y : undefined),
            天气状况: toText(row.天气状况 ?? row.天气) || toText(state.天气) || undefined,
            战斗模式: toText(row.战斗模式) || toText(state.战斗模式) || undefined,
            系统通知: toText(row.系统通知) || toText(state.系统通知) || undefined
        };
    });
    if (normalizedRows.length === 0) return normalizedRows;
    return [normalizedRows[normalizedRows.length - 1]];
};

const normalizeNpcSheetRows = (rows: Array<Record<string, unknown>>) => {
    return rows
        .map((row) => {
            const id = toText(row.id ?? row.NPC_ID ?? row.姓名 ?? row.名称);
            if (!id) return null;
            const rawPresence = toBoolean(row.是否在场 ?? row.present);
            const currentStatus = normalizeNpcCurrentStatus(row.当前状态 ?? row.status ?? row.状态, rawPresence);
            const presence = resolveNpcPresence(currentStatus, rawPresence);
            const locationDetail = toText(row.位置详情 ?? row.所在位置 ?? row.location) || undefined;
            const coordinateRaw = row.坐标 ?? row.coordinate;
            let coordinate: unknown = coordinateRaw;
            if (typeof coordinateRaw === 'string') {
                const trimmed = coordinateRaw.trim();
                if (trimmed) {
                    try {
                        coordinate = JSON.parse(trimmed);
                    } catch {
                        coordinate = coordinateRaw;
                    }
                }
            }
            return {
                ...row,
                id,
                姓名: toText(row.姓名 || row.名称 || id),
                当前状态: currentStatus,
                是否在场: presence,
                所在位置: locationDetail,
                位置详情: locationDetail,
                坐标: coordinate,
                与主角关系: toText(row['与主角关系']),
                职业身份: toText(row['职业/身份'] ?? row.职业身份),
                种族: toText(row['种族/性别/年龄'] ?? row.种族),
                等级: toText(row.等级) || undefined,
                关键经历: toText(row.关键经历)
            };
        })
        .filter((row) => !!row) as Array<Record<string, unknown>>;
};

const normalizeInventorySheetRows = (rows: Array<Record<string, unknown>>) => {
    return rows
        .map((row) => {
            const name = toText(row.名称 ?? row.物品名称);
            if (!name) return null;
            const quantity = toNumber(row.数量);
            const equipped = toBoolean(row.已装备);
            return {
                id: toText(row.id ?? row.物品ID) || undefined,
                名称: name,
                类型: toText(row.类型 ?? row.类别) || '杂项',
                数量: quantity ?? 1,
                已装备: equipped ?? undefined,
                所属人: toText(row.所属人) || undefined,
                伤害: toText(row.伤害) || undefined,
                特性: toText(row.特性) || undefined,
                稀有度: toText(row.稀有度) || undefined,
                描述: toText(row.描述) || '',
                重量: toNumber(row.重量) ?? undefined,
                价值: toNumber(row.价值) ?? undefined
            };
        })
        .filter((row) => !!row) as Array<Record<string, unknown>>;
};

const normalizeLogSummarySheetRows = (rows: Array<Record<string, unknown>>, state: GameState) => {
    return rows
        .map((row) => {
            const summary = normalizeUserReferenceText(
                pickRowValue(row, ['纪要', '摘要', 'summary', 'content', '内容', '重要对话', '大纲']),
                state
            );
            if (!summary) return null;
            if (isPhoneMemoryText(summary)) return null;
            const normalizedIndex = normalizeAmIndex(
                pickRowValue(row, ['编码索引', 'am_index', 'amIndex', 'index', 'AM'])
            );
            const normalizedTime = resolveAbsoluteDateTime(
                pickRowValue(row, ['时间', 'time', 'timestamp']),
                state,
                state.游戏时间
            );
            const normalizedSpan = resolveTimeSpan(
                pickRowValue(row, ['时间跨度', 'time_span', 'timeSpan', 'period']),
                state,
                normalizedTime
            );
            const finalTime = normalizedTime || resolveAbsoluteDateTime(state.游戏时间, state) || '1000-01-01 00:00';
            return {
                回合: Math.max(0, Math.floor(toNumber(pickRowValue(row, ['回合', 'turn', 'round'])) ?? state.回合数 ?? 0)),
                时间: finalTime,
                摘要: summary,
                编码索引: normalizedIndex || undefined,
                时间跨度: normalizedSpan || resolveTimeSpan('', state, finalTime) || `${finalTime}—${finalTime}`,
                地点: toText(pickRowValue(row, ['地点', 'location', 'scene'])) || state.当前地点 || '未知地点',
                纪要: normalizeUserReferenceText(pickRowValue(row, ['纪要', 'summary']), state) || summary,
                重要对话: normalizeDialogueSpeakerText(pickRowValue(row, ['重要对话', 'dialogue', 'key_dialogue']), state) || ''
            };
        })
        .filter((row) => !!row) as Array<Record<string, unknown>>;
};

const normalizeLogOutlineSheetRows = (rows: Array<Record<string, unknown>>, state: GameState) => {
    return rows
        .map((row, index) => {
            const rawOutline = normalizeUserReferenceText(
                pickRowValue(row, ['大纲', 'outline', '标题', 'title', '纪要', '摘要', 'summary', 'content']),
                state
            );
            if (rawOutline && isPhoneMemoryText(rawOutline)) return null;
            const startTurn = Math.max(0, Math.floor(toNumber(pickRowValue(row, ['开始回合', 'startTurn', 'start_turn', '回合', 'turn'])) ?? state.回合数 ?? 0));
            const normalizedIndex = normalizeAmIndex(
                pickRowValue(row, ['编码索引', 'am_index', 'amIndex', 'index', 'AM'])
            );
            const eventsSource = pickRowValue(row, ['事件列表', 'events', 'event_list']);
            const events = Array.isArray(eventsSource)
                ? eventsSource.map((item) => normalizeUserReferenceText(item, state)).filter(Boolean)
                : rawOutline.split(/[；;。]/g).map((item) => item.trim()).filter(Boolean).slice(0, 6);
            const normalizedEventsRaw = events.filter((item) => !isPhoneMemoryText(item));
            const normalizedEvents = normalizedEventsRaw.length > 0 ? normalizedEventsRaw : [rawOutline || '剧情推进'];
            const outline = resolveSegmentOutlineText(
                rawOutline,
                normalizedEvents,
                state,
                normalizedEvents.join('；')
            );
            if (!outline) return null;
            if (isPhoneMemoryText(outline)) return null;
            return {
                章节: toText(pickRowValue(row, ['章节', 'chapter'])) || '章节',
                标题: normalizeUserReferenceText(pickRowValue(row, ['标题', 'title']), state) || `Outline ${index + 1}`,
                开始回合: startTurn,
                结束回合: toNumber(pickRowValue(row, ['结束回合', 'endTurn', 'end_turn'])) ?? undefined,
                编码索引: normalizedIndex || undefined,
                时间跨度: resolveTimeSpan(
                    pickRowValue(row, ['时间跨度', 'time_span', 'timeSpan', 'period']),
                    state,
                    resolveAbsoluteDateTime(state.游戏时间, state)
                )
                    || resolveTimeSpan('', state, resolveAbsoluteDateTime(state.游戏时间, state))
                    || `${resolveAbsoluteDateTime(state.游戏时间, state, '1000-01-01 00:00') || '1000-01-01 00:00'}—${resolveAbsoluteDateTime(state.游戏时间, state, '1000-01-01 00:00') || '1000-01-01 00:00'}`,
                大纲: outline,
                事件列表: normalizedEvents
            };
        })
        .filter((row) => !!row) as Array<Record<string, unknown>>;
};

const normalizeEconomicLedgerSheetRows = (rows: Array<Record<string, unknown>>, state: GameState) => {
    return rows
        .map((row, index) => {
            const account = toText(row.account ?? row.account);
            const normalizedAccount = account === '眷族.资金' ? '眷族.资金' : '角色.法利';
            const before = toNumber(row.before) ?? 0;
            const delta = toNumber(row.delta) ?? 0;
            const after = toNumber(row.after) ?? (before + delta);
            const reason = toText(row.reason) || 'sheet_upsert';
            return {
                id: toText(row.id ?? row.ledger_id) || `LEDGER_${Date.now()}_${index + 1}`,
                turn: Math.max(0, Math.floor(toNumber(row.turn) ?? state.回合数 ?? 0)),
                timestamp: toText(row.timestamp) || state.游戏时间 || new Date().toISOString(),
                account: normalizedAccount,
                before,
                delta,
                after,
                reason,
                commandRef: toText(row.commandRef ?? row.command_ref) || undefined
            };
        });
};

const applyGlobalStateFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    const row = rows.find((item) => toText(item?._global_id) === GLOBAL_STATE_ROW_ID) || rows[rows.length - 1];
    if (!row) return;
    const previousGameTime = toText(state.游戏时间);
    const currentScene = toText(row.当前场景 ?? row.当前地点 ?? row.地点);
    const sceneDesc = toText(row.场景描述);
    const gameDate = toText(row.当前日期 ?? row.日期);
    const gameTime = toText(row.游戏时间 ?? row.时间);
    const prevTime = toText(row.上轮时间);
    const elapsed = toText(row.流逝时长);
    const weather = toText(row.天气状况);
    const combatMode = toText(row.战斗模式);
    const systemNotice = toText(row.系统通知);
    const turn = toNumber(row.当前回合);
    const worldX = toNumber(row.世界坐标X ?? row.坐标X ?? row.x);
    const worldY = toNumber(row.世界坐标Y ?? row.坐标Y ?? row.y);

    if (currentScene) state.当前地点 = currentScene;
    if (sceneDesc) state.场景描述 = sceneDesc;
    if (gameDate) state.当前日期 = gameDate;
    if (!prevTime && gameTime && previousGameTime && gameTime !== previousGameTime) {
        state.上轮时间 = previousGameTime;
    }
    if (gameTime) state.游戏时间 = gameTime;
    if (prevTime) state.上轮时间 = prevTime;
    if (elapsed) {
        state.流逝时长 = elapsed;
    } else if (state.上轮时间 && state.游戏时间 && state.上轮时间 !== state.游戏时间) {
        const inferredElapsed = inferElapsedDuration(state.上轮时间, state.游戏时间);
        if (inferredElapsed) state.流逝时长 = inferredElapsed;
    }
    if (weather) state.天气 = weather;
    if (combatMode) state.战斗模式 = combatMode as any;
    if (systemNotice) state.系统通知 = systemNotice;
    if (turn !== null) state.回合数 = Math.max(0, Math.floor(turn));
    if (worldX !== null || worldY !== null) {
        const current = state.世界坐标 || { x: 0, y: 0 };
        state.世界坐标 = {
            x: Math.round(worldX ?? current.x ?? 0),
            y: Math.round(worldY ?? current.y ?? 0)
        };
    }
};

const normalizeQuestRuntimeStatus = (value: string): 'active' | 'completed' | 'failed' => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return 'active';
    if (normalized.includes('完成') || normalized.includes('completed') || normalized === 'done') return 'completed';
    if (normalized.includes('失败') || normalized.includes('failed')) return 'failed';
    return 'active';
};

const upsertQuestFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    if (!Array.isArray(state.任务)) state.任务 = [];
    rows.forEach((row, index) => {
        const id = toText(row.任务ID ?? row.id) || `QUEST_${index + 1}`;
        const title = toText(row.任务名称 ?? row.标题) || `任务${index + 1}`;
        const status = normalizeQuestRuntimeStatus(toText(row.状态));
        const nextTask = {
            id,
            标题: title,
            描述: toText(row.目标描述 ?? row.描述) || '',
            状态: status,
            奖励: toText(row.奖励) || '',
            评级: (toText(row.评级) || 'E') as any,
            截止时间: toText(row.时限) || undefined
        };
        const idx = state.任务.findIndex((task) => task.id === id);
        if (idx >= 0) {
            state.任务[idx] = { ...state.任务[idx], ...nextTask };
        } else {
            state.任务.push(nextTask as any);
        }
    });
};

const upsertFactionFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    if (!Array.isArray(state.势力)) state.势力 = [];
    const toRelation = (value: string): '友好' | '中立' | '敌对' | '未知' => {
        if (value.includes('敌')) return '敌对';
        if (value.includes('友') || value.includes('盟')) return '友好';
        if (value.includes('中立')) return '中立';
        return '未知';
    };
    rows.forEach((row, index) => {
        const id = toText(row.势力ID ?? row.id) || `FACTION_${index + 1}`;
        const name = toText(row.势力名称 ?? row.名称) || id;
        const relation = toRelation(toText(row.关系等级 ?? row.关系));
        const nextFaction = {
            id,
            名称: name,
            类型: '势力' as const,
            声望: toNumber(row.声望值 ?? row.声望) ?? 0,
            关系: relation,
            描述: toText(row.关键事件) || undefined
        };
        const idx = state.势力!.findIndex((faction) => faction.id === id);
        if (idx >= 0) {
            state.势力![idx] = { ...state.势力![idx], ...nextFaction };
        } else {
            state.势力!.push(nextFaction as any);
        }
    });
};

const applyActionOptionsFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    const row = rows[rows.length - 1];
    if (!row) return;
    const optionFields = ['选项A', '选项B', '选项C', '选项D'] as const;
    const options = optionFields
        .map((field, index) => {
            const name = toText(row[field]);
            if (!name) return null;
            return {
                id: `sheet_option_${index + 1}`,
                名称: name,
                描述: '',
                类型: '其他' as const
            };
        })
        .filter((option): option is { id: string; 名称: string; 描述: string; 类型: '其他' } => !!option);
    if (options.length > 0) {
        state.可选行动列表 = options as any;
    }
};

const applyDicePoolFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    const nextDice: any[] = [];
    const diceColumns: Array<{ column: string; type: DiceType }> = [
        { column: 'D4', type: 'd4' },
        { column: 'D6', type: 'd6' },
        { column: 'D8', type: 'd8' },
        { column: 'D10', type: 'd10' },
        { column: 'D12', type: 'd12' },
        { column: 'D20', type: 'd20' },
        { column: 'D100', type: 'd100' }
    ];
    rows.forEach((row, index) => {
        const rowId = toText(row.ID ?? row.id) || `sheet_dice_${index + 1}`;
        diceColumns.forEach(({ column, type }) => {
            const value = toNumber(row[column]);
            if (value === null) return;
            nextDice.push({
                id: `${rowId}_${type}`,
                类型: type,
                数值: Math.floor(value),
                用途: 'sheet_upsert',
                已使用: false
            });
        });
    });
    if (nextDice.length > 0) {
        state.骰池 = nextDice as any;
    }
};

const applyExplorationMapFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    if (!state.地图) return;
    if (!Array.isArray(state.地图.midLocations)) {
        state.地图.midLocations = [];
    }
    rows.forEach((row, index) => {
        const locationName = toText(
            pickRowValue(row, ['LocationName', 'locationName', 'location', 'SceneName', '地点名称', '场景名称'])
        );
        if (!locationName) return;
        const structureRaw = pickRowValue(
            row,
            ['MapStructureJSON', 'mapStructureJSON', 'map_structure', 'MapJSON', '地图结构', 'VisualJSON']
        );
        const structure = parseObjectLike(structureRaw) ?? structureRaw;
        const existing = state.地图.midLocations!.find((item) => item.name === locationName);
        if (existing) {
            (existing as any).mapStructure = structure || (existing as any).mapStructure;
            (existing as any).layout = parseObjectLike(structureRaw) || (existing as any).layout;
            return;
        }
        state.地图.midLocations!.push({
            id: `sheet_mid_${Date.now()}_${index + 1}`,
            name: locationName,
            parentId: 'sheet',
            coordinates: { x: 0, y: 0 },
            mapStructure: structure || '',
            description: '',
            floor: state.当前楼层 || 0
        } as any);
    });
};

const applyCombatVisualFromSheetRows = (
    state: GameState,
    rows: Array<Record<string, unknown>>
): { success: boolean; error?: string } => {
    const row = rows.find((item) => toText(item.SceneName) === toText(state.当前地点)) || rows[rows.length - 1];
    if (!row) return { success: true };
    const visualRaw = pickRowValue(
        row,
        ['VisualJSON', 'visualJSON', 'visual_json', '视觉JSON', 'map_visual_json', 'SceneJSON', 'MapJSON']
    );
    const parsedVisual = parseObjectLike(visualRaw);
    const grid = parseLegacyMapSize(
        pickRowValue(row, ['GridSize', 'gridSize', 'grid_size', '地图尺寸', 'mapSize', 'size'])
    );
    const payload = parsedVisual ? { ...parsedVisual } : {};
    if (!payload.地图尺寸) {
        payload.地图尺寸 = grid || { 宽度: 20, 高度: 20 };
    }
    return handleSetMapVisuals(state, payload);
};

type DndAbilityKey = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

const DND_ABILITY_ALIAS_MAP: Record<string, DndAbilityKey> = {
    STR: 'STR',
    DEX: 'DEX',
    CON: 'CON',
    INT: 'INT',
    WIS: 'WIS',
    CHA: 'CHA',
    力量: 'STR',
    敏捷: 'DEX',
    体质: 'CON',
    智力: 'INT',
    感知: 'WIS',
    魅力: 'CHA'
};

const parseStructuredValue = (value: unknown): unknown => {
    if (Array.isArray(value) || (value && typeof value === 'object')) return value;
    const text = toText(value);
    if (!text) return null;
    if (!/^[\[{]/.test(text)) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

const normalizeDndAbilityKey = (value: unknown): DndAbilityKey | null => {
    const text = toText(value);
    if (!text) return null;
    const normalized = text.toUpperCase().replace(/\s+/g, '');
    return DND_ABILITY_ALIAS_MAP[normalized] || DND_ABILITY_ALIAS_MAP[text] || null;
};

const ensurePlayerDndProfile = (state: GameState) => {
    if (!state.角色) return null;
    const base = (state.角色.dndProfile || state.角色.DND档案 || {}) as any;
    if (!base.属性值 || typeof base.属性值 !== 'object') {
        base.属性值 = { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
    } else {
        base.属性值 = {
            STR: Number(base.属性值.STR) || 10,
            DEX: Number(base.属性值.DEX) || 10,
            CON: Number(base.属性值.CON) || 10,
            INT: Number(base.属性值.INT) || 10,
            WIS: Number(base.属性值.WIS) || 10,
            CHA: Number(base.属性值.CHA) || 10
        };
    }
    if (!Number.isFinite(Number(base.熟练加值))) {
        base.熟练加值 = 2;
    }
    state.角色.dndProfile = base;
    state.角色.DND档案 = base;
    return base;
};

const parseDndAbilityScores = (value: unknown, fallback: Record<string, number>): Record<DndAbilityKey, number> | null => {
    const parsed = parseStructuredValue(value);
    const next: Record<DndAbilityKey, number> = {
        STR: Number(fallback?.STR) || 10,
        DEX: Number(fallback?.DEX) || 10,
        CON: Number(fallback?.CON) || 10,
        INT: Number(fallback?.INT) || 10,
        WIS: Number(fallback?.WIS) || 10,
        CHA: Number(fallback?.CHA) || 10
    };
    let changed = false;

    const applyEntry = (rawKey: unknown, rawValue: unknown) => {
        const ability = normalizeDndAbilityKey(rawKey);
        const amount = toNumber(rawValue);
        if (!ability || amount === null) return;
        next[ability] = Math.max(1, Math.floor(amount));
        changed = true;
    };

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed as Record<string, unknown>).forEach(([key, rawValue]) => applyEntry(key, rawValue));
    } else {
        const text = toText(value);
        if (!text) return null;
        const segments = text.split(/[，,；;|]/g).map((item) => item.trim()).filter(Boolean);
        segments.forEach((segment) => {
            const match = segment.match(/^([A-Za-z\u4e00-\u9fa5]+)\s*[:：=]\s*(-?\d+(?:\.\d+)?)$/);
            if (!match) return;
            applyEntry(match[1], Number(match[2]));
        });
    }

    return changed ? next : null;
};

const parseSavingThrowProficiencies = (value: unknown): Record<DndAbilityKey, boolean> | undefined => {
    const parsed = parseStructuredValue(value);
    const output: Partial<Record<DndAbilityKey, boolean>> = {};
    const applyFlag = (rawKey: unknown, rawValue: unknown) => {
        const ability = normalizeDndAbilityKey(rawKey);
        if (!ability) return;
        const flag = toBoolean(rawValue);
        output[ability] = flag !== false;
    };

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed as Record<string, unknown>).forEach(([key, rawValue]) => applyFlag(key, rawValue));
    } else {
        const source = Array.isArray(parsed) ? parsed : toText(value).split(/[，,；;|/]/g);
        source
            .map((item) => toText(item))
            .filter(Boolean)
            .forEach((item) => applyFlag(item, true));
    }

    return Object.keys(output).length > 0 ? output as Record<DndAbilityKey, boolean> : undefined;
};

const normalizeSkillLevel = (value: unknown): 'none' | 'proficient' | 'expertise' => {
    const text = toText(value).toLowerCase();
    if (!text) return 'proficient';
    if (['none', '无', '未掌握', '0', 'false', 'no'].includes(text)) return 'none';
    if (['expertise', '精通', '专精', 'expert'].includes(text)) return 'expertise';
    if (['proficient', '熟练', '掌握', 'true', 'yes', '1'].includes(text)) return 'proficient';
    return 'proficient';
};

const parseSkillProficiencies = (value: unknown): Record<string, 'none' | 'proficient' | 'expertise'> | undefined => {
    const parsed = parseStructuredValue(value);
    const output: Record<string, 'none' | 'proficient' | 'expertise'> = {};

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed as Record<string, unknown>).forEach(([key, rawValue]) => {
            const skillName = toText(key);
            if (!skillName) return;
            output[skillName] = normalizeSkillLevel(rawValue);
        });
    } else {
        const source = Array.isArray(parsed) ? parsed : toText(value).split(/[，,；;|/]/g);
        source
            .map((item) => toText(item))
            .filter(Boolean)
            .forEach((skillName) => {
                output[skillName] = 'proficient';
            });
    }

    return Object.keys(output).length > 0 ? output : undefined;
};

const parseSpeedFeet = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    const text = toText(value);
    if (!text) return null;
    const feetMatch = text.match(/(-?\d+(?:\.\d+)?)\s*尺/);
    if (feetMatch) return Math.max(0, Math.floor(Number(feetMatch[1])));
    const ftMatch = text.match(/(-?\d+(?:\.\d+)?)\s*(ft|feet)/i);
    if (ftMatch) return Math.max(0, Math.floor(Number(ftMatch[1])));
    const gridMatch = text.match(/(-?\d+(?:\.\d+)?)\s*格/);
    if (gridMatch) return Math.max(0, Math.floor(Number(gridMatch[1]) * 5));
    const fallback = toNumber(text);
    return fallback === null ? null : Math.max(0, Math.floor(fallback));
};

const parseSpellSlots = (value: unknown): Record<string, string> | undefined => {
    const parsed = parseStructuredValue(value);
    const output: Record<string, string> = {};

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.entries(parsed as Record<string, unknown>).forEach(([key, rawValue]) => {
            const slotKey = toText(key);
            const slotValue = toText(rawValue);
            if (!slotKey || !slotValue) return;
            output[slotKey] = slotValue;
        });
    } else if (Array.isArray(parsed)) {
        parsed.forEach((item, index) => {
            if (!item || typeof item !== 'object') return;
            const source = item as Record<string, unknown>;
            const level = toText(source.level ?? source.环阶 ?? source.slot ?? source.id) || String(index + 1);
            const current = toNumber(source.current ?? source.cur ?? source.当前);
            const max = toNumber(source.max ?? source.最大);
            if (current === null || max === null) return;
            output[level.includes('环') ? level : `${level}环`] = `${Math.max(0, Math.floor(current))}/${Math.max(0, Math.floor(max))}`;
        });
    } else {
        const text = toText(value);
        if (!text) return undefined;
        text.split(/[，,；;|]/g).map((item) => item.trim()).filter(Boolean).forEach((item) => {
            const [rawKey, rawVal] = item.split(/[:：=]/g);
            const slotKey = toText(rawKey);
            const slotValue = toText(rawVal);
            if (!slotKey || !slotValue) return;
            output[slotKey] = slotValue;
        });
    }

    return Object.keys(output).length > 0 ? output : undefined;
};

const applyCharacterRegistryFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    const target = rows.find((row) => toText(row.CHAR_ID) === 'PC_MAIN')
        || rows.find((row) => !toText(row.CHAR_ID));
    if (!target || !state.角色) return;
    const name = toText(target.姓名);
    if (name) state.角色.姓名 = name;
    const occupation = toText(target.职业);
    if (occupation) state.角色.称号 = occupation;
    const appearance = toText(target.外貌描述);
    if (appearance) state.角色.外貌 = appearance;
    const background = toText(target.背景故事);
    if (background) state.角色.背景 = background;

    const raceGenderAge = toText(target['种族/性别/年龄']);
    if (raceGenderAge) {
        const [race, gender, age] = raceGenderAge.split('/').map((item) => item.trim());
        if (race) state.角色.种族 = race;
        if (gender) state.角色.性别 = gender;
        const parsedAge = toNumber(age);
        if (parsedAge !== null) state.角色.年龄 = Math.floor(parsedAge);
    }
};

const applyCharacterAttributesFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    const target = rows.find((row) => toText(pickRowValue(row, ['CHAR_ID', 'char_id', 'character_id'])) === 'PC_MAIN')
        || rows.find((row) => !toText(pickRowValue(row, ['CHAR_ID', 'char_id', 'character_id'])));
    if (!target || !state.角色) return;

    const level = toNumber(pickRowValue(target, ['等级', 'level', 'Level']));
    if (level !== null) state.角色.等级 = Math.max(1, Math.floor(level));

    const hpPair = parseCurrentMaxPair(pickRowValue(target, ['HP', 'hp', 'hitPoints', '生命值']));
    if (hpPair) {
        state.角色.生命值 = hpPair.current;
        state.角色.最大生命值 = hpPair.max;
    }

    const expText = toText(pickRowValue(target, ['经验值', 'xp', 'XP', 'experience']));
    const expMatch = expText.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (expMatch) {
        state.角色.经验值 = Number(expMatch[1]);
        state.角色.升级所需伟业 = Number(expMatch[2]);
    } else {
        const singleExp = toNumber(pickRowValue(target, ['经验值', 'xp', 'XP', 'experience']));
        if (singleExp !== null) {
            state.角色.经验值 = Math.max(0, Math.floor(singleExp));
        }
    }

    const profile = ensurePlayerDndProfile(state);
    if (!profile) return;

    const ac = toNumber(pickRowValue(target, ['AC', '护甲等级', 'ac']));
    if (ac !== null) profile.护甲等级 = Math.max(0, Math.floor(ac));

    const initiative = toNumber(pickRowValue(target, ['先攻加值', 'initiative', 'initiativeBonus', 'init']));
    if (initiative !== null) profile.先攻加值 = Math.floor(initiative);

    const speedFeet = parseSpeedFeet(pickRowValue(target, ['速度', 'speed', 'movement']));
    if (speedFeet !== null) profile.速度尺 = speedFeet;

    const abilityScores = parseDndAbilityScores(
        pickRowValue(target, ['属性值', 'abilityScores', 'abilities']),
        profile.属性值 || {}
    );
    if (abilityScores) profile.属性值 = abilityScores;

    const savingProficiencies = parseSavingThrowProficiencies(
        pickRowValue(target, ['豁免熟练', 'savingThrows', 'saveProficiency'])
    );
    if (savingProficiencies) profile.豁免熟练 = savingProficiencies;

    const skillProficiencies = parseSkillProficiencies(
        pickRowValue(target, ['技能熟练', 'skillProficiencies', 'skills'])
    );
    if (skillProficiencies) profile.技能熟练 = skillProficiencies;

    const passivePerception = toNumber(pickRowValue(target, ['被动感知', 'passivePerception', 'passive_perception']));
    if (passivePerception !== null) profile.被动感知 = Math.max(0, Math.floor(passivePerception));

    const proficiencyBonus = toNumber(pickRowValue(target, ['熟练加值', 'proficiencyBonus', 'proficiency_bonus']));
    if (proficiencyBonus !== null) profile.熟练加值 = Math.max(0, Math.floor(proficiencyBonus));

    state.角色.dndProfile = profile;
    state.角色.DND档案 = profile;
};

const applyCharacterResourcesFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    const target = rows.find((row) => toText(pickRowValue(row, ['CHAR_ID', 'char_id', 'character_id'])) === 'PC_MAIN')
        || rows.find((row) => !toText(pickRowValue(row, ['CHAR_ID', 'char_id', 'character_id'])));
    if (!target || !state.角色) return;

    const profile = ensurePlayerDndProfile(state);
    if (profile) {
        const spellSlots = parseSpellSlots(
            pickRowValue(target, ['法术位', 'spellSlots', 'spell_slots', 'spells'])
        );
        if (spellSlots) profile.法术位 = spellSlots;
        const hitDice = toText(pickRowValue(target, ['生命骰', 'hitDice', 'hit_dice']));
        if (hitDice) profile.生命骰 = hitDice;
        state.角色.dndProfile = profile;
        state.角色.DND档案 = profile;
    }

    const coins = toNumber(pickRowValue(target, ['金币', 'gold', 'gp', 'currency']));
    if (coins !== null) {
        state.角色.法利 = Math.max(0, Math.floor(coins));
    }
};

const normalizeThreadType = (value: unknown): 'private' | 'group' | 'public' => {
    const text = toText(value).toLowerCase();
    if (text === 'group') return 'group';
    if (text === 'public') return 'public';
    return 'private';
};

const parseMemberList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map((item) => toText(item)).filter(Boolean);
    }
    const text = toText(value);
    if (!text) return [];
    return text.split(/[,，]/g).map((item) => item.trim()).filter(Boolean);
};

const ensurePhoneThreadBucket = (state: GameState, type: 'private' | 'group' | 'public') => {
    ensurePhoneStateBase(state);
    if (!state.手机) return [] as any[];
    if (!state.手机.对话) {
        state.手机.对话 = { 私聊: [], 群聊: [], 公共频道: [] } as any;
    }
    if (type === 'group') return state.手机.对话.群聊;
    if (type === 'public') return state.手机.对话.公共频道;
    return state.手机.对话.私聊;
};

const findPhoneThreadById = (state: GameState, threadId: string) => {
    ensurePhoneStateBase(state);
    const dialog = state.手机?.对话;
    if (!dialog) return null as null | { type: 'private' | 'group' | 'public'; thread: any; index: number };
    const buckets: Array<{ type: 'private' | 'group' | 'public'; list: any[] }> = [
        { type: 'private', list: Array.isArray(dialog.私聊) ? dialog.私聊 : [] },
        { type: 'group', list: Array.isArray(dialog.群聊) ? dialog.群聊 : [] },
        { type: 'public', list: Array.isArray(dialog.公共频道) ? dialog.公共频道 : [] }
    ];
    for (const bucket of buckets) {
        const index = bucket.list.findIndex((thread) => toText(thread?.id) === threadId);
        if (index >= 0) {
            return { type: bucket.type, thread: bucket.list[index], index };
        }
    }
    return null;
};

const applyPhoneDeviceFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    ensurePhoneStateBase(state);
    if (!state.手机?.设备) return;
    const row = rows[rows.length - 1];
    if (!row) return;
    const battery = toNumber(row.battery);
    const signal = toNumber(row.signal);
    const status = toText(row.status);
    if (battery !== null) state.手机.设备.电量 = Math.max(0, Math.min(100, Math.floor(battery)));
    if (signal !== null) state.手机.设备.当前信号 = Math.max(0, Math.min(5, Math.floor(signal)));
    if (status) state.手机.设备.状态 = status as any;
};

const applyPhoneContactsFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    ensurePhoneStateBase(state);
    if (!state.手机?.联系人) return;
    const playerName = state.角色?.姓名;
    const friends = new Set<string>();
    const blacklist = new Set<string>();
    const recent = new Set<string>();
    rows.forEach((row) => {
        const name = toText(row.name ?? row.contact_id);
        if (!name) return;
        if (isPlayerReference(name, playerName)) return;
        const bucket = toText(row.bucket).toLowerCase();
        const blacklisted = toBoolean(row.blacklisted) ?? bucket === 'blacklist';
        const isRecent = toBoolean(row.recent) ?? false;
        if (blacklisted) {
            blacklist.add(name);
        } else {
            friends.add(name);
        }
        if (isRecent) recent.add(name);
    });
    state.手机.联系人.好友 = Array.from(friends);
    state.手机.联系人.黑名单 = Array.from(blacklist);
    state.手机.联系人.最近 = Array.from(recent);
};

const normalizePlayerCharacterRows = (rows: Array<Record<string, unknown>>) => {
    const normalized = rows
        .map((row) => {
            const rawCharId = toText(pickRowValue(row, ['CHAR_ID', 'char_id', 'character_id']));
            if (rawCharId && rawCharId !== 'PC_MAIN') return null;
            return {
                ...row,
                CHAR_ID: 'PC_MAIN'
            };
        })
        .filter((row): row is Record<string, unknown> => !!row);
    if (normalized.length === 0) return normalized;
    return [normalized[normalized.length - 1]];
};

const applyPhoneThreadsFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    rows.forEach((row, index) => {
        const threadType = normalizeThreadType(row.type);
        const bucket = ensurePhoneThreadBucket(state, threadType);
        const threadId = toText(row.thread_id) || `Thr_sheet_${Date.now()}_${index + 1}`;
        const found = bucket.findIndex((item) => toText(item?.id) === threadId);
        const base = found >= 0 ? bucket[found] : { id: threadId, 类型: threadType, 标题: '', 成员: [], 消息: [] };
        const next = {
            ...base,
            id: threadId,
            类型: threadType,
            标题: toText(row.title) || base.标题 || threadId,
            成员: parseMemberList(row.members ?? base.成员),
            未读: toNumber(row.unread) ?? base.未读 ?? 0,
            置顶: toBoolean(row.pinned) ?? !!base.置顶,
            摘要: toText(row.summary) || base.摘要 || '',
            摘要时间: toText(row.summary_time) || base.摘要时间 || '',
            消息: Array.isArray(base.消息) ? base.消息 : []
        };
        if (found >= 0) {
            bucket[found] = next;
        } else {
            bucket.push(next);
        }
    });
};

const applyPhoneMessagesFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    rows.forEach((row, index) => {
        const threadId = toText(row.thread_id);
        if (!threadId) return;
        let located = findPhoneThreadById(state, threadId);
        if (!located) {
            const threadType = normalizeThreadType(row.thread_type);
            const bucket = ensurePhoneThreadBucket(state, threadType);
            const created = {
                id: threadId,
                类型: threadType,
                标题: toText(row.thread_title) || threadId,
                成员: [],
                消息: []
            };
            bucket.push(created);
            located = { type: threadType, thread: created, index: bucket.length - 1 };
        }
        const messageList = Array.isArray(located.thread?.消息) ? located.thread.消息 : [];
        const messageId = toText(row.message_id) || `${threadId}_sheet_${index + 1}`;
        const nextMessage = {
            id: messageId,
            发送者: toText(row.sender) || '系统',
            内容: toText(row.content),
            时间戳: toText(row.timestamp) || state.游戏时间 || '未知',
            类型: toText(row.msg_type) || 'text',
            状态: toText(row.status) || 'sent',
            送达时间: toText(row.deliver_at) || undefined
        };
        const msgIndex = messageList.findIndex((msg: any) => toText(msg?.id) === messageId);
        if (msgIndex >= 0) {
            messageList[msgIndex] = { ...messageList[msgIndex], ...nextMessage };
        } else {
            messageList.push(nextMessage as any);
        }
        located.thread.消息 = messageList;
    });
};

const applyPhonePendingFromSheetRows = (state: GameState, rows: Array<Record<string, unknown>>) => {
    ensurePhoneStateBase(state);
    if (!Array.isArray(state.手机?.待发送)) return;
    rows.forEach((row, index) => {
        const pendingId = toText(row.pending_id) || `pending_sheet_${Date.now()}_${index + 1}`;
        const threadId = toText(row.thread_id);
        const nextPending = {
            id: pendingId,
            threadId,
            threadTitle: toText(row.thread_title) || undefined,
            threadType: normalizeThreadType(row.thread_type),
            deliverAt: toText(row.deliver_at) || state.游戏时间 || '未知',
            status: toText(row.status) || 'scheduled',
            payload: {
                id: `${pendingId}_payload`,
                发送者: '系统',
                内容: toText(row.payload_preview) || '',
                时间戳: toText(row.deliver_at) || state.游戏时间 || '未知',
                类型: 'text',
                状态: 'pending'
            },
            trigger: parseObjectLike(row.trigger) || undefined
        };
        const idx = state.手机!.待发送!.findIndex((item: any) => toText(item?.id) === pendingId);
        if (idx >= 0) {
            state.手机!.待发送![idx] = { ...state.手机!.待发送![idx], ...nextPending } as any;
        } else {
            state.手机!.待发送!.push(nextPending as any);
        }
    });
};

const ensurePhoneSocialBase = (state: GameState) => {
    ensurePhoneStateBase(state);
    if (!state.手机) return;
    if (!state.手机.朋友圈 || typeof state.手机.朋友圈 !== 'object') {
        state.手机.朋友圈 = { 仅好友可见: true, 帖子: [] } as any;
    }
    if (!Array.isArray(state.手机.朋友圈.帖子)) {
        state.手机.朋友圈.帖子 = [] as any;
    }
    if (!state.手机.公共帖子 || typeof state.手机.公共帖子 !== 'object') {
        state.手机.公共帖子 = { 板块: [], 帖子: [] } as any;
    }
    if (!Array.isArray(state.手机.公共帖子.板块)) {
        state.手机.公共帖子.板块 = [] as any;
    }
    if (!Array.isArray(state.手机.公共帖子.帖子)) {
        state.手机.公共帖子.帖子 = [] as any;
    }
};

const toTagList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map((item) => toText(item)).filter(Boolean);
    }
    const text = toText(value);
    if (!text) return [];
    return text.split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
};

const rebuildPhoneMomentsFromShadowStore = (state: GameState) => {
    ensurePhoneSocialBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.PHONE_Moments) ? store.PHONE_Moments : [];
    const posts = rows
        .map((row, index) => {
            const momentId = toText((row as any)?.moment_id ?? (row as any)?.id) || `Moment_${index + 1}`;
            const content = toText((row as any)?.内容 ?? (row as any)?.content);
            const sender = toText((row as any)?.发布者 ?? (row as any)?.sender);
            if (!content || !sender) return null;
            const commentRaw = (row as any)?.评论 ?? (row as any)?.comments;
            const comments = Array.isArray(commentRaw)
                ? commentRaw
                    .map((item: any) => {
                        if (!item || typeof item !== 'object') return null;
                        const user = toText(item.用户 ?? item.user ?? item.发布者);
                        const text = toText(item.内容 ?? item.content ?? item.text);
                        if (!user || !text) return null;
                        return { 用户: user, 内容: text };
                    })
                    .filter((item) => !!item)
                : [];
            const visibilityRaw = toText((row as any)?.可见性 ?? (row as any)?.visibility).toLowerCase();
            const visibility = visibilityRaw === 'public' ? 'public' : 'friends';
            return {
                id: momentId,
                发布者: sender,
                头像: toText((row as any)?.头像 ?? (row as any)?.avatar) || undefined,
                内容: content,
                时间戳: toText((row as any)?.时间戳 ?? (row as any)?.timestamp) || state.游戏时间 || '未知',
                timestampValue: toNumber((row as any)?.timestamp_value) ?? undefined,
                点赞数: Math.max(0, Math.floor(toNumber((row as any)?.点赞数 ?? (row as any)?.likes) ?? 0)),
                评论: comments as any,
                图片描述: toText((row as any)?.图片描述 ?? (row as any)?.image_desc) || undefined,
                可见性: visibility as 'friends' | 'public',
                话题: toTagList((row as any)?.话题标签 ?? (row as any)?.话题)
            };
        })
        .filter((item) => !!item) as any[];
    state.手机.朋友圈.帖子 = posts as any;
    state.手机.朋友圈.仅好友可见 = !posts.some((post) => String((post as any)?.可见性 || '').toLowerCase() === 'public');
};

const rebuildForumFromShadowStore = (state: GameState) => {
    ensurePhoneSocialBase(state);
    const store = ensureSheetShadowStore(state);
    const boardRows = Array.isArray(store.FORUM_Boards) ? store.FORUM_Boards : [];
    const postRows = Array.isArray(store.FORUM_Posts) ? store.FORUM_Posts : [];
    const replyRows = Array.isArray(store.FORUM_Replies) ? store.FORUM_Replies : [];
    const fixedBoardNames = ['欧拉丽快报', '地下城攻略', '眷族招募', '酒馆闲谈'];
    const fixedBoardIds = ['board_news', 'board_dungeon', 'board_recruit', 'board_tavern'];
    const fixedBoardSet = new Set(fixedBoardNames);
    const boardNameToId = new Map<string, string>(fixedBoardNames.map((name, index) => [name, fixedBoardIds[index]]));
    const boardIdToName = new Map<string, string>(fixedBoardNames.map((name, index) => [fixedBoardIds[index], name]));
    const normalizeBoardName = (value: unknown) => {
        const text = toText(value);
        return fixedBoardSet.has(text) ? text : '';
    };
    const normalizeBoardId = (value: unknown) => {
        const text = toText(value);
        if (!text) return '';
        if (boardIdToName.has(text)) return text;
        return '';
    };

    const boardMetaByName = new Map<string, { id: string; 图标?: string; 颜色?: string; 描述?: string }>();
    boardRows.forEach((row, index) => {
        const boardName = normalizeBoardName((row as any)?.名称 ?? (row as any)?.name);
        if (!boardName || boardMetaByName.has(boardName)) return;
        boardMetaByName.set(boardName, {
            id: normalizeBoardId((row as any)?.board_id ?? (row as any)?.id) || boardNameToId.get(boardName) || `board_${index + 1}`,
            图标: toText((row as any)?.图标 ?? (row as any)?.icon) || undefined,
            颜色: toText((row as any)?.颜色 ?? (row as any)?.color) || undefined,
            描述: toText((row as any)?.描述 ?? (row as any)?.description) || undefined
        });
    });
    const boards = fixedBoardNames.map((name, index) => {
        const meta = boardMetaByName.get(name);
        return {
            id: meta?.id || boardNameToId.get(name) || `board_${index + 1}`,
            名称: name,
            图标: meta?.图标,
            颜色: meta?.颜色,
            描述: meta?.描述
        };
    }) as any[];
    state.手机.公共帖子.板块 = boards as any;

    const boardNameById = new Map<string, string>();
    boards.forEach((board: any) => {
        const id = toText(board?.id);
        const name = toText(board?.名称);
        if (id && name) boardNameById.set(id, name);
    });

    const replyMap = new Map<string, any[]>();
    replyRows.forEach((row, index) => {
        const postId = toText((row as any)?.post_id);
        const sender = toText((row as any)?.发布者 ?? (row as any)?.sender);
        const content = toText((row as any)?.内容 ?? (row as any)?.content);
        if (!postId || !sender || !content) return;
        const replyId = toText((row as any)?.reply_id ?? (row as any)?.id) || `${postId}_reply_${index + 1}`;
        const list = replyMap.get(postId) || [];
        list.push({
            id: replyId,
            楼层: Math.max(1, Math.floor(toNumber((row as any)?.楼层) ?? (list.length + 1))),
            发布者: sender,
            头像: toText((row as any)?.头像 ?? (row as any)?.avatar) || undefined,
            内容: content,
            时间戳: toText((row as any)?.时间戳 ?? (row as any)?.timestamp) || state.游戏时间 || '未知',
            引用楼层: toNumber((row as any)?.引用楼层 ?? (row as any)?.quote_floor) ?? undefined,
            点赞数: toNumber((row as any)?.点赞数 ?? (row as any)?.likes) ?? undefined
        });
        replyMap.set(postId, list);
    });

    const posts = postRows
        .map((row, index) => {
            const postId = toText((row as any)?.post_id ?? (row as any)?.id) || `Forum_${index + 1}`;
            const title = toText((row as any)?.标题 ?? (row as any)?.title);
            const content = toText((row as any)?.内容 ?? (row as any)?.content);
            const sender = toText((row as any)?.发布者 ?? (row as any)?.sender);
            if (!title || !content || !sender) return null;

            const boardId = normalizeBoardId((row as any)?.board_id);
            const directBoardName = normalizeBoardName((row as any)?.board_name ?? (row as any)?.板块);
            const idBoardName = boardId
                ? (normalizeBoardName(boardNameById.get(boardId)) || normalizeBoardName(boardIdToName.get(boardId)))
                : '';
            const boardName = directBoardName || idBoardName || fixedBoardNames[0];

            const inlineReplies = Array.isArray((row as any)?.回复)
                ? ((row as any).回复 as any[])
                    .map((item: any, replyIndex: number) => {
                        if (!item || typeof item !== 'object') return null;
                        const itemSender = toText(item.发布者 ?? item.sender);
                        const itemContent = toText(item.内容 ?? item.content);
                        if (!itemSender || !itemContent) return null;
                        return {
                            id: toText(item.id) || `${postId}_inline_${replyIndex + 1}`,
                            楼层: Math.max(1, Math.floor(toNumber(item.楼层) ?? (replyIndex + 1))),
                            发布者: itemSender,
                            头像: toText(item.头像 ?? item.avatar) || undefined,
                            内容: itemContent,
                            时间戳: toText(item.时间戳 ?? item.timestamp) || state.游戏时间 || '未知',
                            引用楼层: toNumber(item.引用楼层 ?? item.quote_floor) ?? undefined,
                            点赞数: toNumber(item.点赞数 ?? item.likes) ?? undefined
                        };
                    })
                    .filter((item) => !!item)
                : [];
            const replies = (replyMap.get(postId) || inlineReplies).slice().sort((a, b) => Number(a?.楼层 || 0) - Number(b?.楼层 || 0));
            return {
                id: postId,
                标题: title,
                内容: content,
                发布者: sender,
                头像: toText((row as any)?.头像 ?? (row as any)?.avatar) || undefined,
                时间戳: toText((row as any)?.时间戳 ?? (row as any)?.timestamp) || state.游戏时间 || '未知',
                timestampValue: toNumber((row as any)?.timestamp_value) ?? undefined,
                板块: boardName,
                话题标签: toTagList((row as any)?.话题标签 ?? (row as any)?.tags),
                置顶: toBoolean((row as any)?.置顶 ?? (row as any)?.pinned) ?? false,
                精华: toBoolean((row as any)?.精华 ?? (row as any)?.featured) ?? false,
                浏览数: toNumber((row as any)?.浏览数 ?? (row as any)?.views) ?? undefined,
                点赞数: Math.max(0, Math.floor(toNumber((row as any)?.点赞数 ?? (row as any)?.likes) ?? 0)),
                回复: replies as any,
                图片描述: toText((row as any)?.图片描述 ?? (row as any)?.image_desc) || undefined
            };
        })
        .filter((item) => !!item) as any[];
    state.手机.公共帖子.帖子 = posts as any;
};

const ensureWorldStateBase = (state: GameState) => {
    if (!state.世界 || typeof state.世界 !== 'object') {
        state.世界 = {
            异常指数: 0,
            头条新闻: [],
            街头传闻: [],
            诸神神会: {
                下次神会开启时间: '',
                神会主题: '',
                讨论内容: [],
                最终结果: ''
            },
            NPC后台跟踪: [],
            战争游戏: {
                状态: '未开始',
                参战眷族: [],
                形式: '',
                赌注: ''
            }
        } as any;
    }
    if (!Array.isArray(state.世界.头条新闻)) {
        state.世界.头条新闻 = [];
    }
    if (!Array.isArray(state.世界.街头传闻)) {
        state.世界.街头传闻 = [];
    }
    if (!state.世界.诸神神会 || typeof state.世界.诸神神会 !== 'object') {
        state.世界.诸神神会 = {
            下次神会开启时间: '',
            神会主题: '',
            讨论内容: [],
            最终结果: ''
        } as any;
    }
    if (!Array.isArray(state.世界.NPC后台跟踪)) {
        state.世界.NPC后台跟踪 = [];
    }
};

const rebuildWorldNewsFromShadowStore = (state: GameState) => {
    ensureWorldStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.WORLD_News) ? store.WORLD_News : [];
    state.世界.头条新闻 = rows
        .map((row, index) => {
            const id = toText((row as any)?.news_id ?? (row as any)?.id) || `NEWS_${index + 1}`;
            const title = toText((row as any)?.标题 ?? (row as any)?.title);
            const source = toText((row as any)?.来源 ?? (row as any)?.source) || 'street';
            if (!id || !title) return null;
            return {
                id,
                标题: title,
                内容: toText((row as any)?.内容 ?? (row as any)?.content) || undefined,
                时间戳: toText((row as any)?.时间戳 ?? (row as any)?.timestamp) || undefined,
                来源: source,
                重要度: toText((row as any)?.重要度 ?? (row as any)?.priority) || 'normal',
                关联传闻: toText((row as any)?.关联传闻 ?? (row as any)?.linked_rumor) || undefined
            };
        })
        .filter((item) => !!item) as any;
};

const rebuildWorldRumorsFromShadowStore = (state: GameState) => {
    ensureWorldStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.WORLD_Rumors) ? store.WORLD_Rumors : [];
    state.世界.街头传闻 = rows
        .map((row, index) => {
            const id = toText((row as any)?.rumor_id ?? (row as any)?.id) || `RUMOR_${index + 1}`;
            const topic = toText((row as any)?.主题 ?? (row as any)?.topic);
            if (!id || !topic) return null;
            const spread = toNumber((row as any)?.传播度 ?? (row as any)?.spread);
            const tagsRaw = (row as any)?.话题标签 ?? (row as any)?.tags;
            const tags = Array.isArray(tagsRaw)
                ? tagsRaw.map((item: any) => toText(item)).filter(Boolean)
                : toText(tagsRaw).split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
            return {
                id,
                主题: topic,
                内容: toText((row as any)?.内容 ?? (row as any)?.content) || undefined,
                传播度: spread === null ? 0 : Math.max(0, Math.floor(spread)),
                可信度: toText((row as any)?.可信度 ?? (row as any)?.credibility) || 'rumor',
                来源: toText((row as any)?.来源 ?? (row as any)?.source) || undefined,
                话题标签: tags.length > 0 ? tags : undefined,
                发现时间: toText((row as any)?.发现时间 ?? (row as any)?.found_at) || undefined,
                评论数: toNumber((row as any)?.评论数 ?? (row as any)?.comment_count) ?? undefined,
                已升级为新闻: toBoolean((row as any)?.已升级为新闻 ?? (row as any)?.upgraded) ?? false,
                关联新闻: toText((row as any)?.关联新闻 ?? (row as any)?.linked_news) || undefined
            };
        })
        .filter((item) => !!item) as any;
};

const rebuildWorldDenatusFromShadowStore = (state: GameState) => {
    ensureWorldStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.WORLD_Denatus) ? store.WORLD_Denatus : [];
    const row = rows[rows.length - 1];
    if (!row) {
        state.世界.诸神神会 = {
            下次神会开启时间: '',
            神会主题: '',
            讨论内容: [],
            最终结果: ''
        } as any;
        return;
    }
    const discussionRaw = (row as any)?.讨论内容 ?? (row as any)?.discussion;
    const discussion = Array.isArray(discussionRaw)
        ? discussionRaw
            .map((item: any) => {
                if (!item || typeof item !== 'object') return null;
                const role = toText(item.角色 ?? item.role);
                const speech = toText(item.对话 ?? item.text);
                if (!role && !speech) return null;
                return { 角色: role || '未知', 对话: speech };
            })
            .filter((item: any) => !!item)
        : toText(discussionRaw)
            .split(/[|]/g)
            .map((chunk) => chunk.trim())
            .filter(Boolean)
            .map((chunk) => {
                const pair = chunk.split(':');
                if (pair.length >= 2) {
                    return { 角色: pair[0].trim() || '未知', 对话: pair.slice(1).join(':').trim() };
                }
                return { 角色: '未知', 对话: chunk };
            });
    state.世界.诸神神会 = {
        下次神会开启时间: toText((row as any)?.下次神会开启时间 ?? (row as any)?.next_time),
        神会主题: toText((row as any)?.神会主题 ?? (row as any)?.topic),
        讨论内容: discussion as any,
        最终结果: toText((row as any)?.最终结果 ?? (row as any)?.result)
    } as any;
};

const rebuildWorldWarGameFromShadowStore = (state: GameState) => {
    ensureWorldStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.WORLD_WarGame) ? store.WORLD_WarGame : [];
    const row = rows[rows.length - 1];
    if (!row) {
        state.世界.战争游戏 = undefined;
        return;
    }
    const participantsRaw = (row as any)?.参战眷族 ?? (row as any)?.participants;
    const participants = Array.isArray(participantsRaw)
        ? participantsRaw.map((item: any) => toText(item)).filter(Boolean)
        : toText(participantsRaw).split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
    state.世界.战争游戏 = {
        状态: toText((row as any)?.状态 ?? (row as any)?.status) || '未开始',
        参战眷族: participants,
        形式: toText((row as any)?.形式 ?? (row as any)?.mode),
        赌注: toText((row as any)?.赌注 ?? (row as any)?.stake),
        举办时间: toText((row as any)?.举办时间 ?? (row as any)?.start_at) || undefined,
        结束时间: toText((row as any)?.结束时间 ?? (row as any)?.end_at) || undefined,
        结果: toText((row as any)?.结果 ?? (row as any)?.result) || undefined,
        备注: toText((row as any)?.备注 ?? (row as any)?.note) || undefined
    } as any;
};

const rebuildWorldNpcTrackingFromShadowStore = (state: GameState) => {
    ensureWorldStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.WORLD_NpcTracking) ? store.WORLD_NpcTracking : [];
    state.世界.NPC后台跟踪 = rows
        .map((row) => {
            const npc = toText((row as any)?.npc_name ?? (row as any)?.NPC ?? (row as any)?.npc);
            const action = toText((row as any)?.current_action ?? (row as any)?.当前行动 ?? (row as any)?.action);
            if (!npc || !action) return null;
            return {
                NPC: npc,
                当前行动: action,
                位置: toText((row as any)?.location ?? (row as any)?.位置) || undefined,
                进度: toText((row as any)?.progress ?? (row as any)?.进度) || undefined,
                预计完成: toText((row as any)?.eta ?? (row as any)?.预计完成) || undefined
            };
        })
        .filter((item) => !!item) as Array<{ NPC: string; 当前行动: string; 位置?: string; 进度?: string; 预计完成?: string }>;
};

const ensureMapStateBase = (state: GameState) => {
    if (!state.地图 || typeof state.地图 !== 'object') {
        state.地图 = {
            config: { width: 10000, height: 10000 },
            factions: [],
            territories: [],
            terrain: [],
            routes: [],
            surfaceLocations: [],
            dungeonStructure: [],
            macroLocations: [],
            midLocations: []
        } as any;
    }
    if (!Array.isArray(state.地图.surfaceLocations)) state.地图.surfaceLocations = [] as any;
    if (!Array.isArray(state.地图.dungeonStructure)) state.地图.dungeonStructure = [] as any;
    if (!Array.isArray(state.地图.macroLocations)) state.地图.macroLocations = [] as any;
    if (!Array.isArray(state.地图.midLocations)) state.地图.midLocations = [] as any;
};

const rebuildMapSurfaceLocationsFromShadowStore = (state: GameState) => {
    ensureMapStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.MAP_SurfaceLocations) ? store.MAP_SurfaceLocations : [];
    state.地图.surfaceLocations = rows
        .map((row, index) => {
            const name = toText((row as any)?.name ?? (row as any)?.名称);
            if (!name) return null;
            const locationType = toText((row as any)?.type ?? (row as any)?.类型) || 'POINT';
            return {
                id: toText((row as any)?.location_id ?? (row as any)?.id) || `surface_${index + 1}`,
                name,
                type: locationType,
                coordinates: {
                    x: toNumber((row as any)?.x ?? (row as any)?.坐标X) ?? 0,
                    y: toNumber((row as any)?.y ?? (row as any)?.坐标Y) ?? 0
                },
                radius: Math.max(0, toNumber((row as any)?.radius ?? (row as any)?.半径) ?? 0),
                description: toText((row as any)?.description ?? (row as any)?.描述),
                icon: toText((row as any)?.icon ?? (row as any)?.图标) || undefined,
                source: toText((row as any)?.source ?? (row as any)?.来源) || undefined,
                visited: toBoolean((row as any)?.visited ?? (row as any)?.已探索) ?? false,
                floor: toNumber((row as any)?.floor ?? (row as any)?.楼层) ?? undefined
            };
        })
        .filter((item) => !!item) as any;
};

const rebuildMapDungeonLayersFromShadowStore = (state: GameState) => {
    ensureMapStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.MAP_DungeonLayers) ? store.MAP_DungeonLayers : [];
    state.地图.dungeonStructure = rows
        .map((row) => {
            const floorStart = Math.floor(toNumber((row as any)?.floor_start ?? (row as any)?.floorStart) ?? Number.NaN);
            const floorEnd = Math.floor(toNumber((row as any)?.floor_end ?? (row as any)?.floorEnd) ?? floorStart);
            const name = toText((row as any)?.name ?? (row as any)?.名称);
            if (!Number.isFinite(floorStart) || !name) return null;
            const landmarksRaw = (row as any)?.landmarks ?? (row as any)?.地标;
            const landmarks = Array.isArray(landmarksRaw)
                ? landmarksRaw
                    .map((item: any) => {
                        if (!item || typeof item !== 'object') return null;
                        const floor = Math.floor(toNumber(item.floor) ?? Number.NaN);
                        const landmarkName = toText(item.name ?? item.名称);
                        const type = toText(item.type ?? item.类型) || 'POINT';
                        if (!Number.isFinite(floor) || !landmarkName) return null;
                        return { floor, name: landmarkName, type };
                    })
                    .filter((item) => !!item)
                : [];
            return {
                floorStart,
                floorEnd: Number.isFinite(floorEnd) ? floorEnd : floorStart,
                name,
                description: toText((row as any)?.description ?? (row as any)?.描述),
                dangerLevel: toText((row as any)?.danger_level ?? (row as any)?.dangerLevel ?? (row as any)?.危险度),
                landmarks
            };
        })
        .filter((item) => !!item) as any;
};

const rebuildMapMacroLocationsFromShadowStore = (state: GameState) => {
    ensureMapStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.MAP_MacroLocations) ? store.MAP_MacroLocations : [];
    state.地图.macroLocations = rows
        .map((row, index) => {
            const name = toText((row as any)?.name ?? (row as any)?.名称);
            if (!name) return null;
            const tagsRaw = (row as any)?.tags ?? (row as any)?.标签;
            const tags = Array.isArray(tagsRaw)
                ? tagsRaw.map((item: any) => toText(item)).filter(Boolean)
                : toText(tagsRaw).split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
            return {
                id: toText((row as any)?.macro_id ?? (row as any)?.id) || `macro_${index + 1}`,
                name,
                parentId: toText((row as any)?.parent_id ?? (row as any)?.parentId) || undefined,
                coordinates: {
                    x: toNumber((row as any)?.x ?? (row as any)?.坐标X) ?? 0,
                    y: toNumber((row as any)?.y ?? (row as any)?.坐标Y) ?? 0
                },
                floor: toNumber((row as any)?.floor ?? (row as any)?.楼层) ?? undefined,
                description: toText((row as any)?.description ?? (row as any)?.描述),
                tags
            };
        })
        .filter((item) => !!item) as any;
};

const rebuildMapMidLocationsFromShadowStore = (state: GameState) => {
    ensureMapStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.MAP_MidLocations) ? store.MAP_MidLocations : [];
    state.地图.midLocations = rows
        .map((row, index) => {
            const name = toText((row as any)?.name ?? (row as any)?.名称);
            if (!name) return null;
            const mapStructureRaw = (row as any)?.map_structure ?? (row as any)?.mapStructure;
            const layoutRaw = (row as any)?.layout;
            return {
                id: toText((row as any)?.mid_id ?? (row as any)?.id) || `mid_${index + 1}`,
                name,
                parentId: toText((row as any)?.parent_id ?? (row as any)?.parentId) || undefined,
                coordinates: {
                    x: toNumber((row as any)?.x ?? (row as any)?.坐标X) ?? 0,
                    y: toNumber((row as any)?.y ?? (row as any)?.坐标Y) ?? 0
                },
                floor: toNumber((row as any)?.floor ?? (row as any)?.楼层) ?? undefined,
                description: toText((row as any)?.description ?? (row as any)?.描述),
                mapStructure: parseObjectLike(mapStructureRaw) ?? mapStructureRaw ?? '',
                layout: parseObjectLike(layoutRaw) ?? layoutRaw ?? undefined
            };
        })
        .filter((item) => !!item) as any;
};

const ensureSocialBase = (state: GameState) => {
    if (!Array.isArray(state.社交)) state.社交 = [] as any;
};

const getOrCreateNpcBySheetIdentity = (state: GameState, npcId: string, npcName: string) => {
    ensureSocialBase(state);
    const byIdIndex = npcId ? state.社交.findIndex((npc: any) => String(npc?.id || '') === npcId) : -1;
    if (byIdIndex >= 0) return state.社交[byIdIndex] as any;
    const byNameIndex = npcName ? state.社交.findIndex((npc: any) => String(npc?.姓名 || '') === npcName) : -1;
    if (byNameIndex >= 0) return state.社交[byNameIndex] as any;
    const created = {
        id: npcId || `NPC_${state.社交.length + 1}`,
        姓名: npcName || `NPC_${state.社交.length + 1}`,
        关系状态: '认识',
        记忆: [],
        是否在场: false
    } as any;
    state.社交.push(created);
    return created;
};

const rebuildNpcRelationshipEventsFromShadowStore = (state: GameState) => {
    ensureSocialBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.NPC_RelationshipEvents) ? store.NPC_RelationshipEvents : [];
    const grouped = new Map<string, any[]>();

    rows.forEach((row, index) => {
        const npcId = toText((row as any)?.npc_id);
        const npcName = toText((row as any)?.npc_name);
        const npc = getOrCreateNpcBySheetIdentity(state, npcId, npcName);
        const resolvedId = toText(npc?.id) || `NPC_${index + 1}`;
        const list = grouped.get(resolvedId) || [];
        list.push({
            event_id: toText((row as any)?.event_id) || `${resolvedId}_rel_${list.length + 1}`,
            timestamp: toText((row as any)?.timestamp),
            event: toText((row as any)?.event),
            affinity_delta: toNumber((row as any)?.affinity_delta) ?? undefined,
            relationship_state: toText((row as any)?.relationship_state),
            notes: toText((row as any)?.notes)
        });
        grouped.set(resolvedId, list);
    });

    state.社交.forEach((npc: any) => {
        const npcId = toText(npc?.id);
        const events = grouped.get(npcId) || [];
        (npc as any).关系事件 = events;
        if (events.length > 0) {
            const latest = events[events.length - 1];
            if (toText(latest.relationship_state)) {
                npc.关系状态 = toText(latest.relationship_state);
            }
            const absoluteAffinity = toNumber((latest as any)?.affinity_score ?? (latest as any)?.好感度);
            if (absoluteAffinity !== null) {
                npc.好感度 = Math.floor(absoluteAffinity);
            }
        }
    });
};

const rebuildNpcLocationTraceFromShadowStore = (state: GameState) => {
    ensureSocialBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.NPC_LocationTrace) ? store.NPC_LocationTrace : [];
    const latestByNpc = new Map<string, any>();
    const tracesByNpc = new Map<string, any[]>();

    rows.forEach((row, index) => {
        const npcId = toText((row as any)?.npc_id);
        const npcName = toText((row as any)?.npc_name);
        const npc = getOrCreateNpcBySheetIdentity(state, npcId, npcName);
        const resolvedId = toText(npc?.id) || `NPC_${index + 1}`;
        const trace = {
            trace_id: toText((row as any)?.trace_id) || `${resolvedId}_trace_${index + 1}`,
            timestamp: toText((row as any)?.timestamp),
            location: toText((row as any)?.location),
            x: toNumber((row as any)?.x),
            y: toNumber((row as any)?.y),
            present: toBoolean((row as any)?.present),
            detail: toText((row as any)?.detail)
        };
        latestByNpc.set(resolvedId, trace);
        const list = tracesByNpc.get(resolvedId) || [];
        list.push(trace);
        tracesByNpc.set(resolvedId, list);
    });

    state.社交.forEach((npc: any) => {
        const npcId = toText(npc?.id);
        const latest = latestByNpc.get(npcId);
        if (!latest) return;
        if (latest.location) {
            npc.所在位置 = latest.location;
            npc.位置详情 = latest.detail || latest.location;
        }
        if (latest.x !== null || latest.y !== null) {
            npc.坐标 = {
                x: Math.round(latest.x ?? npc?.坐标?.x ?? 0),
                y: Math.round(latest.y ?? npc?.坐标?.y ?? 0)
            };
        }
        if (typeof latest.present === 'boolean') {
            npc.是否在场 = latest.present;
        }
        (npc as any).位置轨迹 = tracesByNpc.get(npcId) || [];
    });
};

const rebuildNpcInteractionLogFromShadowStore = (state: GameState) => {
    ensureSocialBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.NPC_InteractionLog) ? store.NPC_InteractionLog : [];
    const grouped = new Map<string, any[]>();

    rows.forEach((row, index) => {
        const npcId = toText((row as any)?.npc_id);
        const npcName = toText((row as any)?.npc_name);
        const npc = getOrCreateNpcBySheetIdentity(state, npcId, npcName);
        const resolvedId = toText(npc?.id) || `NPC_${index + 1}`;
        const entry = {
            interaction_id: toText((row as any)?.interaction_id) || `${resolvedId}_int_${index + 1}`,
            timestamp: toText((row as any)?.timestamp),
            type: toText((row as any)?.type),
            summary: toText((row as any)?.summary),
            source: toText((row as any)?.source)
        };
        const list = grouped.get(resolvedId) || [];
        list.push(entry);
        grouped.set(resolvedId, list);
    });

    state.社交.forEach((npc: any) => {
        const npcId = toText(npc?.id);
        const logs = grouped.get(npcId) || [];
        (npc as any).互动记录 = logs;
    });
};

const ensureQuestStateBase = (state: GameState) => {
    if (!Array.isArray(state.任务)) state.任务 = [] as any;
};

const getOrCreateQuestById = (state: GameState, questId: string) => {
    ensureQuestStateBase(state);
    const normalizedId = questId || `QUEST_${state.任务.length + 1}`;
    const index = state.任务.findIndex((task: any) => String(task?.id || '') === normalizedId);
    if (index >= 0) return state.任务[index] as any;
    const task = {
        id: normalizedId,
        标题: normalizedId,
        描述: '',
        状态: 'active',
        奖励: '',
        评级: 'E',
        日志: []
    } as any;
    state.任务.push(task);
    return task;
};

const rebuildQuestObjectivesFromShadowStore = (state: GameState) => {
    ensureQuestStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.QUEST_Objectives) ? store.QUEST_Objectives : [];
    const grouped = new Map<string, any[]>();

    rows.forEach((row, index) => {
        const questId = toText((row as any)?.quest_id) || `QUEST_${index + 1}`;
        const objective = toText((row as any)?.objective);
        if (!objective) return;
        const list = grouped.get(questId) || [];
        list.push({
            objective_id: toText((row as any)?.objective_id) || `${questId}_obj_${list.length + 1}`,
            objective,
            status: toText((row as any)?.status) || 'active',
            progress: toText((row as any)?.progress),
            target: toText((row as any)?.target),
            updated_at: toText((row as any)?.updated_at)
        });
        grouped.set(questId, list);
    });

    grouped.forEach((objectives, questId) => {
        const quest = getOrCreateQuestById(state, questId);
        (quest as any).目标列表 = objectives;
        if (!toText(quest?.描述) && objectives.length > 0) {
            quest.描述 = objectives[0].objective;
        }
        const hasIncomplete = objectives.some((item) => {
            const status = toText(item.status).toLowerCase();
            return !status.includes('completed') && !status.includes('完成');
        });
        quest.状态 = hasIncomplete ? 'active' : 'completed';
    });
};

const rebuildQuestProgressLogFromShadowStore = (state: GameState) => {
    ensureQuestStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.QUEST_ProgressLog) ? store.QUEST_ProgressLog : [];
    const grouped = new Map<string, any[]>();

    rows.forEach((row, index) => {
        const questId = toText((row as any)?.quest_id) || `QUEST_${index + 1}`;
        const content = toText((row as any)?.content);
        const timestamp = toText((row as any)?.timestamp);
        if (!content || !timestamp) return;
        const list = grouped.get(questId) || [];
        list.push({
            progress_id: toText((row as any)?.progress_id) || `${questId}_log_${list.length + 1}`,
            timestamp,
            content,
            status: toText((row as any)?.status),
            source: toText((row as any)?.source)
        });
        grouped.set(questId, list);
    });

    grouped.forEach((entries, questId) => {
        const quest = getOrCreateQuestById(state, questId);
        quest.日志 = entries.map((entry) => ({
            时间戳: entry.timestamp,
            内容: entry.content
        }));
        const latest = entries[entries.length - 1];
        const normalizedStatus = normalizeQuestRuntimeStatus(toText(latest?.status));
        quest.状态 = normalizedStatus;
    });
};

const ensureStoryStateBase = (state: GameState) => {
    if (!state.剧情 || typeof state.剧情 !== 'object') {
        state.剧情 = {
            主线: {
                当前卷数: 1,
                当前篇章: '',
                当前阶段: '',
                关键节点: '',
                节点状态: ''
            },
            引导: {
                当前目标: '',
                下一触发: '',
                行动提示: ''
            },
            时间轴: {
                预定日期: ''
            },
            路线: {
                是否正史: true,
                偏移度: 0,
                分歧说明: ''
            },
            待触发: [],
            里程碑: [],
            备注: ''
        } as any;
    }
    const story = state.剧情 as any;
    if (!story.主线 || typeof story.主线 !== 'object') {
        story.主线 = { 当前卷数: 1, 当前篇章: '', 当前阶段: '', 关键节点: '', 节点状态: '' };
    }
    if (!story.引导 || typeof story.引导 !== 'object') {
        story.引导 = { 当前目标: '', 下一触发: '', 行动提示: '' };
    }
    if (!story.时间轴 || typeof story.时间轴 !== 'object') {
        story.时间轴 = { 预定日期: '' };
    }
    if (!story.路线 || typeof story.路线 !== 'object') {
        story.路线 = { 是否正史: true, 偏移度: 0, 分歧说明: '' };
    }
    if (!Array.isArray(story.待触发)) story.待触发 = [];
    if (!Array.isArray(story.里程碑)) story.里程碑 = [];
    if (!Array.isArray(state.契约)) state.契约 = [];
};

const rebuildStoryMainlineFromShadowStore = (state: GameState) => {
    ensureStoryStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.STORY_Mainline) ? store.STORY_Mainline : [];
    const row = rows[rows.length - 1];
    const story = state.剧情 as any;
    if (!row) {
        story.主线 = { 当前卷数: 1, 当前篇章: '', 当前阶段: '', 关键节点: '', 节点状态: '' };
        story.引导 = { 当前目标: '', 下一触发: '', 行动提示: '' };
        story.时间轴 = { 预定日期: '' };
        story.路线 = { 是否正史: true, 偏移度: 0, 分歧说明: '' };
        story.备注 = '';
        return;
    }

    const mainline = { ...(story.主线 || {}) };
    const volume = toNumber((row as any)?.当前卷数);
    if (volume !== null) mainline.当前卷数 = Math.max(1, Math.floor(volume));
    const chapter = toText((row as any)?.当前篇章);
    if (chapter) mainline.当前篇章 = chapter;
    const phase = toText((row as any)?.当前阶段);
    if (phase) mainline.当前阶段 = phase;
    const keyNode = toText((row as any)?.关键节点);
    if (keyNode) mainline.关键节点 = keyNode;
    const nodeStatus = toText((row as any)?.节点状态);
    if (nodeStatus) mainline.节点状态 = nodeStatus;
    story.主线 = mainline;

    const guidance = { ...(story.引导 || {}) };
    const target = toText((row as any)?.当前目标);
    if (target) guidance.当前目标 = target;
    const nextTrigger = toText((row as any)?.下一触发);
    if (nextTrigger) guidance.下一触发 = nextTrigger;
    const actionHint = toText((row as any)?.行动提示);
    if (actionHint) guidance.行动提示 = actionHint;
    story.引导 = guidance;

    const timeline = { ...(story.时间轴 || {}) };
    const scheduledDate = toText((row as any)?.预定日期);
    if (scheduledDate) timeline.预定日期 = scheduledDate;
    const nextKeyTime = toText((row as any)?.下一关键时间);
    if (nextKeyTime) timeline.下一关键时间 = nextKeyTime;
    story.时间轴 = timeline;

    const route = { ...(story.路线 || {}) };
    const canonRaw = (row as any)?.是否正史;
    const canonFlag = typeof canonRaw === 'boolean'
        ? canonRaw
        : toText(canonRaw).toLowerCase();
    if (canonFlag === true || canonFlag === false) {
        route.是否正史 = canonFlag;
    } else if (typeof canonFlag === 'string' && canonFlag) {
        route.是否正史 = !['0', 'false', 'no', '否', 'off'].includes(canonFlag);
    }
    const drift = toNumber((row as any)?.偏移度);
    if (drift !== null) route.偏移度 = Math.max(0, Math.floor(drift));
    const divergence = toText((row as any)?.分歧说明);
    if (divergence || (row as any)?.分歧说明 === '') route.分歧说明 = divergence;
    story.路线 = route;

    const notes = toText((row as any)?.备注);
    if (notes || (row as any)?.备注 === '') story.备注 = notes;
};

const rebuildStoryTriggersFromShadowStore = (state: GameState) => {
    ensureStoryStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.STORY_Triggers) ? store.STORY_Triggers : [];
    (state.剧情 as any).待触发 = rows
        .map((row) => {
            const content = toText((row as any)?.内容);
            if (!content) return null;
            return {
                预计触发: toText((row as any)?.预计触发 || (row as any)?.eta),
                内容: content,
                类型: toText((row as any)?.类型 || (row as any)?.type) || undefined,
                触发条件: toText((row as any)?.触发条件 || (row as any)?.condition) || undefined,
                重要度: toText((row as any)?.重要度 || (row as any)?.priority) || undefined,
                状态: toText((row as any)?.状态 || (row as any)?.status) || '待触发'
            };
        })
        .filter((item) => !!item)
        .slice(0, 3) as any;
};

const rebuildStoryMilestonesFromShadowStore = (state: GameState) => {
    ensureStoryStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.STORY_Milestones) ? store.STORY_Milestones : [];
    (state.剧情 as any).里程碑 = rows
        .map((row) => {
            const event = toText((row as any)?.事件);
            if (!event) return null;
            return {
                时间: toText((row as any)?.时间) || state.游戏时间 || '未知',
                事件: event,
                影响: toText((row as any)?.影响 || (row as any)?.impact) || undefined
            };
        })
        .filter((item) => !!item) as any;
};

const rebuildContractRegistryFromShadowStore = (state: GameState) => {
    ensureStoryStateBase(state);
    const store = ensureSheetShadowStore(state);
    const rows = Array.isArray(store.CONTRACT_Registry) ? store.CONTRACT_Registry : [];
    state.契约 = rows
        .map((row, index) => {
            const contractId = toText((row as any)?.contract_id || (row as any)?.id) || `CONTRACT_${index + 1}`;
            const name = toText((row as any)?.名称 || (row as any)?.name);
            if (!name) return null;
            return {
                id: contractId,
                名称: name,
                描述: toText((row as any)?.描述 || (row as any)?.description),
                状态: toText((row as any)?.状态 || (row as any)?.status) || 'active',
                条款: toText((row as any)?.条款 || (row as any)?.terms)
            };
        })
        .filter((item) => !!item) as any;
};

export function handleUpsertSheetRows(
    state: GameState,
    value: unknown
): { success: boolean; error?: string } {
    const normalizedInput = normalizeSheetPayloadAliases(value);
    const asRecord = (input: unknown): Record<string, unknown> | null => {
        if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
        return input as Record<string, unknown>;
    };
    const stripPayloadControlFields = (row: Record<string, unknown>) => {
        const next: Record<string, unknown> = {};
        Object.entries(row).forEach(([key, rawValue]) => {
            if (
                key === 'sheetId'
                || key === 'sheet_id'
                || key === 'sheet'
                || key === 'tableId'
                || key === 'table_id'
                || key === 'keyField'
                || key === 'key_field'
                || key === 'rows'
                || key === 'value'
                || key === 'data'
                || key === 'payload'
                || key === 'records'
                || key === 'row'
            ) {
                return;
            }
            next[key] = rawValue;
        });
        return next;
    };
    const unwrapRows = (input: unknown): Record<string, unknown>[] => {
        if (Array.isArray(input)) {
            const directRows = input.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
            if (directRows.length > 0) return directRows;
            return input.flatMap((item) => unwrapRows(item));
        }
        const record = asRecord(input);
        if (!record) return [];
        const nestedKeys = ['rows', 'value', 'data', 'payload', 'records', 'row'];
        for (const key of nestedKeys) {
            if (record[key] !== undefined && record[key] !== input) {
                const nestedRows = unwrapRows(record[key]);
                if (nestedRows.length > 0) return nestedRows;
            }
        }
        return [record];
    };
    const coerceUpsertPayload = (input: unknown): Record<string, unknown> | null => {
        const record = asRecord(input);
        if (!record) return null;
        const sheetId = toText(record.sheetId ?? record.sheet_id ?? record.sheet ?? record.tableId ?? record.table_id);
        if (!sheetId) return null;
        const keyField = toText(record.keyField ?? record.key_field);
        const rowsSource = record.rows ?? record.value ?? record.data ?? record.payload ?? record.records ?? record.row;
        const rows = rowsSource !== undefined
            ? unwrapRows(rowsSource)
            : (() => {
                const inlineRow = stripPayloadControlFields(record);
                return Object.keys(inlineRow).length > 0 ? [inlineRow] : [];
            })();
        if (rows.length === 0) return null;
        return {
            sheetId,
            ...(keyField ? { keyField } : {}),
            rows
        };
    };
    // Compatibility: some models return value as an array of sheet payloads.
    if (Array.isArray(normalizedInput)) {
        const sheetPayloads = normalizedInput
            .map((item) => coerceUpsertPayload(item))
            .filter((item): item is Record<string, unknown> => !!item);
        if (sheetPayloads.length > 0) {
            let successCount = 0;
            let firstError = '';
            for (const payload of sheetPayloads) {
                const result = handleUpsertSheetRows(state, payload);
                if (result.success) {
                    successCount += 1;
                } else if (!firstError && result.error) {
                    firstError = result.error;
                }
            }
            if (successCount > 0) return { success: true };
            return { success: false, error: firstError || 'Invalid upsert_sheet_rows array payload' };
        }
    }

    const normalizedValue = coerceUpsertPayload(normalizedInput)
        ?? (() => {
            if (!Array.isArray(normalizedInput)) return normalizedInput;
            const objectRows = normalizedInput.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row));
            if (objectRows.length === 1) {
                return coerceUpsertPayload(objectRows[0]) ?? objectRows[0];
            }
            return normalizedInput;
        })();
    const validation = validateSchema(SheetUpsertRowsSchema, normalizedValue);
    if (!validation.success) {
        return { success: false, error: (validation as any).error };
    }

    const payload = (validation as any).data as {
        sheetId: string;
        keyField?: string;
        rows: Record<string, unknown>[];
    };
    if (!isSheetId(payload.sheetId)) {
        return { success: false, error: `Unknown sheet id: ${payload.sheetId}` };
    }
    let keyField = resolveSheetKeyField(payload.sheetId, payload.keyField, payload.rows[0]);
    let shadowRows = payload.rows;

    switch (payload.sheetId) {
        case 'SYS_GlobalState': {
            const normalizedRows = normalizeGlobalStateSheetRows(payload.rows, state);
            applyGlobalStateFromSheetRows(state, normalizedRows);
            shadowRows = normalizedRows;
            keyField = '_global_id';
            break;
        }
        case 'LOG_Summary': {
            const normalizedRows = normalizeLogSummarySheetRows(payload.rows, state);
            if (normalizedRows.length === 0) {
                shadowRows = [];
                break;
            }
            const validated = normalizedRows.map((row) => validateSchema(LogSummarySchema, row));
            const validRows = validated
                .filter((result) => result.success)
                .map((result) => (result as any).data);
            const errors = validated.length - validRows.length;
            if (validRows.length === 0) {
                const detail = describeValidationErrors(validated as any);
                return {
                    success: false,
                    error: `LOG_Summary validation failed: ${errors}${detail ? ` (${detail})` : ''}`
                };
            }
            if (!Array.isArray(state.日志摘要)) state.日志摘要 = [];
            upsertByKey(state.日志摘要 as any[], validRows, '编码索引');
            shadowRows = validRows as Array<Record<string, unknown>>;
            break;
        }
        case 'LOG_Outline': {
            const normalizedRows = normalizeLogOutlineSheetRows(payload.rows, state);
            if (normalizedRows.length === 0) {
                shadowRows = [];
                break;
            }
            const validated = normalizedRows.map((row) => validateSchema(LogOutlineSchema, row));
            const validRows = validated
                .filter((result) => result.success)
                .map((result) => (result as any).data);
            const errors = validated.length - validRows.length;
            if (validRows.length === 0) {
                const detail = describeValidationErrors(validated as any);
                return {
                    success: false,
                    error: `LOG_Outline validation failed: ${errors}${detail ? ` (${detail})` : ''}`
                };
            }
            if (!Array.isArray(state.日志大纲)) state.日志大纲 = [];
            upsertByKey(state.日志大纲 as any[], validRows, '编码索引');
            shadowRows = validRows as Array<Record<string, unknown>>;
            break;
        }
        case 'ECON_Ledger': {
            const normalizedRows = normalizeEconomicLedgerSheetRows(payload.rows, state);
            const result = handleAppendEconomicLedger(state, normalizedRows);
            if (!result.success) return result;
            break;
        }
        case 'NPC_Registry': {
            const playerName = state.角色?.姓名;
            const normalizedRows = normalizeNpcSheetRows(payload.rows).filter((row) => {
                const npcId = toText(row.id ?? row.NPC_ID);
                const npcName = toText(row.姓名 ?? row.名称);
                return !isPlayerReference(npcId, playerName) && !isPlayerReference(npcName, playerName);
            });
            const result = handleUpsertNPC(state, normalizedRows);
            if (!result.success) return result;
            shadowRows = normalizedRows;
            break;
        }
        case 'ITEM_Inventory': {
            const normalizedRows = normalizeInventorySheetRows(payload.rows);
            const result = handleUpsertInventory(state, normalizedRows);
            if (!result.success) return result;
            break;
        }
        case 'QUEST_Active':
            upsertQuestFromSheetRows(state, payload.rows);
            break;
        case 'FACTION_Standing':
            upsertFactionFromSheetRows(state, payload.rows);
            break;
        case 'COMBAT_Encounter': {
            const encounterRows = payload.rows.map((row, index) => ({
                id: toText(row.id ?? row.单位名称 ?? row.名称) || `ENCOUNTER_${index + 1}`,
                名称: toText(row.单位名称 ?? row.名称) || `遭遇${index + 1}`,
                类型: '战斗' as const,
                状态: '进行中' as const,
                描述: [
                    toText(row.阵营),
                    toText(row['先攻/位置']),
                    toText(row.HP状态),
                    toText(row.附着状态)
                ].filter(Boolean).join(' | ') || undefined
            }));
            const result = handleSetEncounterRows(state, encounterRows);
            if (!result.success) return result;
            break;
        }
        case 'COMBAT_BattleMap': {
            const battleRows = payload.rows.map((row, index) => {
                const rawType = toText(
                    pickRowValue(row, ['类型', 'type', 'row_type', 'unit_type'])
                );
                const rowTypeLower = rawType.toLowerCase();
                const isConfigRow = rowTypeLower === 'config'
                    || rowTypeLower === 'map_config'
                    || rawType === '地图配置'
                    || rawType === '配置';
                if (isConfigRow) {
                    return {
                        单位名称: toText(row.单位名称 ?? row.名称 ?? row.name ?? 'Map_Config'),
                        类型: 'Config',
                        坐标: pickRowValue(row, ['坐标', 'position', '位置', 'GridSize', 'gridSize', '大小', 'size', '地图尺寸'])
                    };
                }

                const hasPoint = pickRowValue(row, ['x', 'y']) !== undefined;
                const positionFromPoint = hasPoint
                    ? {
                        x: toNumber((row as any).x) ?? 0,
                        y: toNumber((row as any).y) ?? 0
                    }
                    : undefined;
                const hasSize = pickRowValue(row, ['w', 'h']) !== undefined;
                const sizeFromPoint = hasSize
                    ? {
                        w: toNumber((row as any).w) ?? 1,
                        h: toNumber((row as any).h) ?? 1
                    }
                    : undefined;
                return {
                    UNIT_ID: toText(row.UNIT_ID ?? row.unit_id ?? row.id ?? row.单位名称 ?? row.名称 ?? row.name) || `UNIT_${index + 1}`,
                    名称: toText(row.单位名称 ?? row.名称 ?? row.name) || `单位${index + 1}`,
                    类型: rawType || 'Token',
                    坐标: pickRowValue(row, ['坐标', 'position', '位置']) ?? positionFromPoint ?? { x: 0, y: 0 },
                    大小: pickRowValue(row, ['大小', 'size', '尺寸']) ?? sizeFromPoint,
                    Token: toText(row.Token ?? row.token ?? row.图标 ?? row.icon) || undefined,
                    阵营: pickRowValue(row, ['阵营', 'faction']),
                    状态: pickRowValue(row, ['状态', 'status']),
                    状态效果: pickRowValue(row, ['状态效果', 'effects']),
                    生命值: pickRowValue(row, ['生命值', 'hp'])
                };
            });
            const result = handleUpsertBattleMapRows(state, battleRows);
            if (!result.success) return result;
            break;
        }
        case 'UI_ActionOptions':
            applyActionOptionsFromSheetRows(state, payload.rows);
            break;
        case 'DICE_Pool':
            applyDicePoolFromSheetRows(state, payload.rows);
            break;
        case 'EXPLORATION_Map_Data':
            applyExplorationMapFromSheetRows(state, payload.rows);
            break;
        case 'COMBAT_Map_Visuals': {
            const result = applyCombatVisualFromSheetRows(state, payload.rows);
            if (!result.success) return result;
            break;
        }
        case 'CHARACTER_Registry':
            shadowRows = normalizePlayerCharacterRows(payload.rows);
            if (shadowRows.length === 0) break;
            applyCharacterRegistryFromSheetRows(state, shadowRows);
            keyField = 'CHAR_ID';
            break;
        case 'CHARACTER_Attributes':
            shadowRows = normalizePlayerCharacterRows(payload.rows);
            if (shadowRows.length === 0) break;
            applyCharacterAttributesFromSheetRows(state, shadowRows);
            keyField = 'CHAR_ID';
            break;
        case 'CHARACTER_Resources':
            shadowRows = normalizePlayerCharacterRows(payload.rows);
            if (shadowRows.length === 0) break;
            applyCharacterResourcesFromSheetRows(state, shadowRows);
            keyField = 'CHAR_ID';
            break;
        case 'PHONE_Device':
            applyPhoneDeviceFromSheetRows(state, payload.rows);
            break;
        case 'PHONE_Contacts':
            shadowRows = payload.rows
                .map((row) => {
                    const name = toText(row.name ?? row.contact_id);
                    if (!name || isPlayerReference(name, state.角色?.姓名)) return null;
                    return {
                        ...row,
                        contact_id: toText(row.contact_id) || name,
                        name
                    };
                })
                .filter((row): row is Record<string, unknown> => !!row);
            applyPhoneContactsFromSheetRows(state, shadowRows);
            keyField = 'contact_id';
            break;
        case 'PHONE_Threads':
            applyPhoneThreadsFromSheetRows(state, payload.rows);
            break;
        case 'PHONE_Messages':
            applyPhoneMessagesFromSheetRows(state, payload.rows);
            break;
        case 'PHONE_Pending':
            applyPhonePendingFromSheetRows(state, payload.rows);
            break;
        case 'FORUM_Boards':
            ensurePhoneSocialBase(state);
            break;
        case 'FORUM_Posts':
            ensurePhoneSocialBase(state);
            break;
        case 'FORUM_Replies':
            ensurePhoneSocialBase(state);
            break;
        case 'PHONE_Moments':
            ensurePhoneSocialBase(state);
            break;
        case 'WORLD_NpcTracking':
            ensureWorldStateBase(state);
            break;
        case 'WORLD_News':
            ensureWorldStateBase(state);
            break;
        case 'WORLD_Rumors':
            ensureWorldStateBase(state);
            break;
        case 'WORLD_Denatus':
            ensureWorldStateBase(state);
            break;
        case 'WORLD_WarGame':
            ensureWorldStateBase(state);
            break;
        case 'STORY_Mainline':
            ensureStoryStateBase(state);
            break;
        case 'STORY_Triggers':
            ensureStoryStateBase(state);
            break;
        case 'STORY_Milestones':
            ensureStoryStateBase(state);
            break;
        case 'CONTRACT_Registry':
            ensureStoryStateBase(state);
            break;
        case 'MAP_SurfaceLocations':
        case 'MAP_DungeonLayers':
        case 'MAP_MacroLocations':
        case 'MAP_MidLocations':
            ensureMapStateBase(state);
            break;
        case 'NPC_RelationshipEvents':
        case 'NPC_LocationTrace':
        case 'NPC_InteractionLog':
            ensureSocialBase(state);
            break;
        case 'QUEST_Objectives':
        case 'QUEST_ProgressLog':
            ensureQuestStateBase(state);
            break;
        default:
            break;
    }

    upsertRowsInShadowStore(state, payload.sheetId, shadowRows, keyField);
    if (payload.sheetId === 'WORLD_NpcTracking') {
        rebuildWorldNpcTrackingFromShadowStore(state);
    } else if (payload.sheetId === 'WORLD_News') {
        rebuildWorldNewsFromShadowStore(state);
    } else if (payload.sheetId === 'WORLD_Rumors') {
        rebuildWorldRumorsFromShadowStore(state);
    } else if (payload.sheetId === 'WORLD_Denatus') {
        rebuildWorldDenatusFromShadowStore(state);
    } else if (payload.sheetId === 'WORLD_WarGame') {
        rebuildWorldWarGameFromShadowStore(state);
    } else if (payload.sheetId === 'STORY_Mainline') {
        rebuildStoryMainlineFromShadowStore(state);
    } else if (payload.sheetId === 'STORY_Triggers') {
        rebuildStoryTriggersFromShadowStore(state);
    } else if (payload.sheetId === 'STORY_Milestones') {
        rebuildStoryMilestonesFromShadowStore(state);
    } else if (payload.sheetId === 'CONTRACT_Registry') {
        rebuildContractRegistryFromShadowStore(state);
    } else if (payload.sheetId === 'MAP_SurfaceLocations') {
        rebuildMapSurfaceLocationsFromShadowStore(state);
    } else if (payload.sheetId === 'MAP_DungeonLayers') {
        rebuildMapDungeonLayersFromShadowStore(state);
    } else if (payload.sheetId === 'MAP_MacroLocations') {
        rebuildMapMacroLocationsFromShadowStore(state);
    } else if (payload.sheetId === 'MAP_MidLocations') {
        rebuildMapMidLocationsFromShadowStore(state);
    } else if (payload.sheetId === 'NPC_RelationshipEvents') {
        rebuildNpcRelationshipEventsFromShadowStore(state);
    } else if (payload.sheetId === 'NPC_LocationTrace') {
        rebuildNpcLocationTraceFromShadowStore(state);
    } else if (payload.sheetId === 'NPC_InteractionLog') {
        rebuildNpcInteractionLogFromShadowStore(state);
    } else if (payload.sheetId === 'QUEST_Objectives') {
        rebuildQuestObjectivesFromShadowStore(state);
    } else if (payload.sheetId === 'QUEST_ProgressLog') {
        rebuildQuestProgressLogFromShadowStore(state);
    } else if (payload.sheetId === 'PHONE_Moments') {
        rebuildPhoneMomentsFromShadowStore(state);
    } else if (payload.sheetId === 'FORUM_Boards' || payload.sheetId === 'FORUM_Posts' || payload.sheetId === 'FORUM_Replies') {
        rebuildForumFromShadowStore(state);
    }
    return { success: true };
}

export function handleDeleteSheetRows(
    state: GameState,
    value: unknown
): { success: boolean; error?: string } {
    const normalizedInput = normalizeSheetPayloadAliases(value);
    const validation = validateSchema(SheetDeleteRowsSchema, normalizedInput);
    if (!validation.success) {
        return { success: false, error: (validation as any).error };
    }

    const payload = (validation as any).data as {
        sheetId: string;
        keyField?: string;
        rowIds: Array<string | number>;
    };
    if (!isSheetId(payload.sheetId)) {
        return { success: false, error: `Unknown sheet id: ${payload.sheetId}` };
    }
    const rowIdSet = new Set(payload.rowIds.map((item) => String(item)));
    const keyField = resolveSheetKeyField(payload.sheetId, payload.keyField);

    switch (payload.sheetId) {
        case 'LOG_Summary':
            state.日志摘要 = (Array.isArray(state.日志摘要) ? state.日志摘要 : []).filter((row: any) => !rowIdSet.has(String(row?.编码索引 ?? row?.[keyField])));
            break;
        case 'LOG_Outline':
            state.日志大纲 = (Array.isArray(state.日志大纲) ? state.日志大纲 : []).filter((row: any) => !rowIdSet.has(String(row?.编码索引 ?? row?.[keyField])));
            break;
        case 'ECON_Ledger':
            state.经济流水 = (Array.isArray(state.经济流水) ? state.经济流水 : []).filter((row: any) => !rowIdSet.has(String(row?.id ?? row?.[keyField])));
            break;
        case 'NPC_Registry':
            state.社交 = (Array.isArray(state.社交) ? state.社交 : []).filter((row: any) => !rowIdSet.has(String(row?.id ?? row?.NPC_ID ?? row?.[keyField])));
            break;
        case 'ITEM_Inventory':
            state.背包 = (Array.isArray(state.背包) ? state.背包 : []).filter((row: any) => !rowIdSet.has(String(row?.id ?? row?.物品ID ?? row?.[keyField])));
            break;
        case 'QUEST_Active':
            state.任务 = (Array.isArray(state.任务) ? state.任务 : []).filter((row: any) => !rowIdSet.has(String(row?.id ?? row?.任务ID ?? row?.[keyField])));
            break;
        case 'FACTION_Standing':
            state.势力 = (Array.isArray(state.势力) ? state.势力 : []).filter((row: any) => !rowIdSet.has(String(row?.id ?? row?.势力ID ?? row?.[keyField])));
            break;
        case 'DICE_Pool':
            state.骰池 = (Array.isArray(state.骰池) ? state.骰池 : []).filter((row: any) => !rowIdSet.has(String(row?.id ?? row?.ID ?? row?.[keyField]))) as any;
            break;
        case 'UI_ActionOptions':
            if (payload.rowIds.length > 0) {
                state.可选行动列表 = [];
            }
            break;
        case 'EXPLORATION_Map_Data':
            if (state.地图?.midLocations) {
                state.地图.midLocations = state.地图.midLocations.filter((row: any) => !rowIdSet.has(String(row?.name ?? row?.LocationName ?? row?.[keyField])));
            }
            break;
        case 'COMBAT_Map_Visuals':
            if (payload.rowIds.length > 0 && state.战斗?.视觉) {
                state.战斗.视觉 = undefined as any;
            }
            break;
        case 'PHONE_Device':
            if (payload.rowIds.length > 0 && state.手机?.设备) {
                state.手机.设备.状态 = 'offline';
            }
            break;
        case 'PHONE_Contacts': {
            ensurePhoneStateBase(state);
            const idSet = new Set(payload.rowIds.map((item) => String(item)));
            if (state.手机?.联系人) {
                state.手机.联系人.好友 = (state.手机.联系人.好友 || []).filter((name) => !idSet.has(String(name)));
                state.手机.联系人.黑名单 = (state.手机.联系人.黑名单 || []).filter((name) => !idSet.has(String(name)));
                state.手机.联系人.最近 = (state.手机.联系人.最近 || []).filter((name) => !idSet.has(String(name)));
            }
            break;
        }
        case 'PHONE_Threads': {
            ensurePhoneStateBase(state);
            const idSet = new Set(payload.rowIds.map((item) => String(item)));
            if (state.手机?.对话) {
                state.手机.对话.私聊 = (state.手机.对话.私聊 || []).filter((thread: any) => !idSet.has(String(thread?.id)));
                state.手机.对话.群聊 = (state.手机.对话.群聊 || []).filter((thread: any) => !idSet.has(String(thread?.id)));
                state.手机.对话.公共频道 = (state.手机.对话.公共频道 || []).filter((thread: any) => !idSet.has(String(thread?.id)));
            }
            if (Array.isArray(state.手机?.待发送)) {
                state.手机!.待发送 = state.手机!.待发送!.filter((item: any) => !idSet.has(String(item?.threadId)));
            }
            break;
        }
        case 'PHONE_Messages': {
            ensurePhoneStateBase(state);
            const idSet = new Set(payload.rowIds.map((item) => String(item)));
            const buckets = [state.手机?.对话?.私聊 || [], state.手机?.对话?.群聊 || [], state.手机?.对话?.公共频道 || []];
            buckets.forEach((bucket: any[]) => {
                bucket.forEach((thread: any) => {
                    if (!Array.isArray(thread?.消息)) return;
                    thread.消息 = thread.消息.filter((msg: any) => !idSet.has(String(msg?.id)));
                });
            });
            break;
        }
        case 'PHONE_Pending':
            ensurePhoneStateBase(state);
            if (Array.isArray(state.手机?.待发送)) {
                state.手机!.待发送 = state.手机!.待发送!.filter((item: any) => !rowIdSet.has(String(item?.id)));
            }
            break;
        case 'FORUM_Boards':
            ensurePhoneSocialBase(state);
            break;
        case 'FORUM_Posts': {
            ensurePhoneSocialBase(state);
            const store = ensureSheetShadowStore(state);
            if (Array.isArray(store.FORUM_Replies)) {
                store.FORUM_Replies = store.FORUM_Replies.filter((row) => !rowIdSet.has(String((row as any)?.post_id)));
            }
            break;
        }
        case 'FORUM_Replies':
            ensurePhoneSocialBase(state);
            break;
        case 'PHONE_Moments':
            ensurePhoneSocialBase(state);
            break;
        case 'WORLD_NpcTracking':
            ensureWorldStateBase(state);
            break;
        case 'WORLD_News':
            ensureWorldStateBase(state);
            break;
        case 'WORLD_Rumors':
            ensureWorldStateBase(state);
            break;
        case 'WORLD_Denatus':
            ensureWorldStateBase(state);
            break;
        case 'WORLD_WarGame':
            ensureWorldStateBase(state);
            break;
        case 'STORY_Mainline':
            ensureStoryStateBase(state);
            break;
        case 'STORY_Triggers':
            ensureStoryStateBase(state);
            break;
        case 'STORY_Milestones':
            ensureStoryStateBase(state);
            break;
        case 'CONTRACT_Registry':
            ensureStoryStateBase(state);
            break;
        case 'MAP_SurfaceLocations':
        case 'MAP_DungeonLayers':
        case 'MAP_MacroLocations':
        case 'MAP_MidLocations':
            ensureMapStateBase(state);
            break;
        case 'NPC_RelationshipEvents':
        case 'NPC_LocationTrace':
        case 'NPC_InteractionLog':
            ensureSocialBase(state);
            break;
        case 'QUEST_Objectives':
        case 'QUEST_ProgressLog':
            ensureQuestStateBase(state);
            break;
        default:
            break;
    }

    deleteRowsInShadowStore(state, payload.sheetId, payload.rowIds, keyField);
    if (payload.sheetId === 'WORLD_NpcTracking') {
        rebuildWorldNpcTrackingFromShadowStore(state);
    } else if (payload.sheetId === 'WORLD_News') {
        rebuildWorldNewsFromShadowStore(state);
    } else if (payload.sheetId === 'WORLD_Rumors') {
        rebuildWorldRumorsFromShadowStore(state);
    } else if (payload.sheetId === 'WORLD_Denatus') {
        rebuildWorldDenatusFromShadowStore(state);
    } else if (payload.sheetId === 'WORLD_WarGame') {
        rebuildWorldWarGameFromShadowStore(state);
    } else if (payload.sheetId === 'STORY_Mainline') {
        rebuildStoryMainlineFromShadowStore(state);
    } else if (payload.sheetId === 'STORY_Triggers') {
        rebuildStoryTriggersFromShadowStore(state);
    } else if (payload.sheetId === 'STORY_Milestones') {
        rebuildStoryMilestonesFromShadowStore(state);
    } else if (payload.sheetId === 'CONTRACT_Registry') {
        rebuildContractRegistryFromShadowStore(state);
    } else if (payload.sheetId === 'MAP_SurfaceLocations') {
        rebuildMapSurfaceLocationsFromShadowStore(state);
    } else if (payload.sheetId === 'MAP_DungeonLayers') {
        rebuildMapDungeonLayersFromShadowStore(state);
    } else if (payload.sheetId === 'MAP_MacroLocations') {
        rebuildMapMacroLocationsFromShadowStore(state);
    } else if (payload.sheetId === 'MAP_MidLocations') {
        rebuildMapMidLocationsFromShadowStore(state);
    } else if (payload.sheetId === 'NPC_RelationshipEvents') {
        rebuildNpcRelationshipEventsFromShadowStore(state);
    } else if (payload.sheetId === 'NPC_LocationTrace') {
        rebuildNpcLocationTraceFromShadowStore(state);
    } else if (payload.sheetId === 'NPC_InteractionLog') {
        rebuildNpcInteractionLogFromShadowStore(state);
    } else if (payload.sheetId === 'QUEST_Objectives') {
        rebuildQuestObjectivesFromShadowStore(state);
    } else if (payload.sheetId === 'QUEST_ProgressLog') {
        rebuildQuestProgressLogFromShadowStore(state);
    } else if (payload.sheetId === 'PHONE_Moments') {
        rebuildPhoneMomentsFromShadowStore(state);
    } else if (payload.sheetId === 'FORUM_Boards' || payload.sheetId === 'FORUM_Posts' || payload.sheetId === 'FORUM_Replies') {
        rebuildForumFromShadowStore(state);
    }
    return { success: true };
}

export function handleSetInitiative(
    state: GameState,
    value: unknown,
    pushSystemMessage?: (msg: string) => void
): { success: boolean; error?: string } {
    const validation = validateSchema(InitiativeSchema, value);
    if (!validation.success) {
        const msg = (validation as any).error;
        pushSystemMessage?.(msg);
        return { success: false, error: msg };
    }

    const { initiative_order, current_actor, unit_names } = (validation as any).data;

    if (initiative_order && state.战斗?.地图) {
        const mapIds = new Set(state.战斗.地图.map(row => row.UNIT_ID));
        const missing = initiative_order.filter(id => !mapIds.has(id));
        if (missing.length > 0) {
            pushSystemMessage?.(`initiative_order contains unknown UNIT_ID: ${missing.join(', ')}`);
        }
    }

    if (!state.战斗) {
        state.战斗 = {} as any;
    }
    state.战斗.initiative_order = initiative_order;
    state.战斗.current_actor = current_actor;
    if (unit_names) {
        (state.战斗 as any).unit_names = unit_names;
    }

    return { success: true };
}

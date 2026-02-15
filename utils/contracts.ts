import { z } from 'zod';

// Quest Contract Schema
export const QuestSchema = z.object({
    id: z.string(),
    名称: z.string(),
    描述: z.string(),
    状态: z.enum(['未接取', '进行中', '已完成', '已失败']),
    委托人: z.string().optional(),
    奖励: z.object({
        法利: z.number().optional(),
        物品: z.array(z.any()).optional(),
        经验: z.number().optional()
    }).optional(),
    目标: z.array(z.object({
        描述: z.string(),
        完成: z.boolean()
    })).optional(),
    时间限制: z.string().optional()
});

export type Quest = z.infer<typeof QuestSchema>;

// Faction Contract Schema
export const FactionSchema = z.object({
    id: z.string(),
    名称: z.string(),
    类型: z.enum(['眷族', '组织', '势力', '其他']),
    声望: z.number().default(0),
    关系: z.enum(['友好', '中立', '敌对', '未知']).default('未知'),
    描述: z.string().optional(),
    领袖: z.string().optional(),
    成员数: z.number().optional()
});

export type Faction = z.infer<typeof FactionSchema>;

// Encounter Contract Schema (遭遇)
export const EncounterRowSchema = z.object({
    id: z.string(),
    名称: z.string(),
    类型: z.enum(['战斗', '事件', '对话', '陷阱', '宝箱', '其他']),
    状态: z.enum(['未触发', '进行中', '已完成']).default('未触发'),
    描述: z.string().optional(),
    参与者: z.array(z.string()).optional(),
    位置: z.object({
        x: z.number(),
        y: z.number()
    }).optional(),
    触发条件: z.string().optional()
});

export type EncounterRow = z.infer<typeof EncounterRowSchema>;

// BattleMap Contract Schema (战斗.地图)
export const BattleMapRowSchema = z.object({
    UNIT_ID: z.string(), // Unique identifier for map entity
    名称: z.string(),
    类型: z.enum(['玩家', '敌人', '友方', '障碍物', '地形', '其他']),
    位置: z.object({
        x: z.number(), // Grid coordinate (1格 = 5尺)
        y: z.number()
    }),
    状态: z.enum(['正常', '倒地', '死亡', '隐身', '其他']).default('正常'),
    生命值: z.object({
        当前: z.number(),
        最大: z.number()
    }).optional(),
    图标: z.string().optional(), // Icon/symbol for display
    描述: z.string().optional(),
    尺寸: z.object({
        宽度: z.number().min(1),
        高度: z.number().min(1)
    }).optional(),
    状态效果: z.array(z.string()).optional()
});

export type BattleMapRow = z.infer<typeof BattleMapRowSchema>;

export const BattleMapRowUpsertSchema = BattleMapRowSchema.partial().extend({
    UNIT_ID: z.string()
});

// Initiative Contract Schema
export const InitiativeSchema = z.object({
    initiative_order: z.array(z.string()).optional(),
    current_actor: z.string().optional(),
    unit_names: z.record(z.string(), z.string()).optional()
});

export type Initiative = z.infer<typeof InitiativeSchema>;

// MapVisuals Contract Schema (战斗.视觉)
export const MapVisualsSchema = z.object({
    地图尺寸: z.object({
        宽度: z.number(), // in grid units
        高度: z.number()
    }),
    地形描述: z.string().optional(),
    特殊区域: z.array(z.object({
        名称: z.string(),
        位置: z.object({
            x: z.number(),
            y: z.number()
        }),
        范围: z.number().optional(), // radius or size
        效果: z.string().optional()
    })).optional(),
    光照: z.enum(['明亮', '昏暗', '黑暗', '其他']).optional(),
    天气: z.string().optional()
});

export type MapVisuals = z.infer<typeof MapVisualsSchema>;

// DiceRow Schema (骰池)
export const DiceRowSchema = z.object({
    id: z.string(),
    类型: z.enum(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', '其他']),
    数值: z.number(),
    用途: z.string().optional(), // What this die roll was for
    时间戳: z.string().optional(),
    已使用: z.boolean().default(false)
});

export type DiceRow = z.infer<typeof DiceRowSchema>;

export const DicePoolSchema = z.array(DiceRowSchema);
export type DicePool = z.infer<typeof DicePoolSchema>;

export const DiceTypeSchema = z.enum(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']);
export type DiceType = z.infer<typeof DiceTypeSchema>;

export const DicePoolRefillSchema = z.object({
    count: z.number().int().min(1).max(200).default(10),
    类型: z.array(DiceTypeSchema).min(1).optional(),
    用途: z.string().optional()
});

export type DicePoolRefill = z.infer<typeof DicePoolRefillSchema>;

export const RollDiceCheckSchema = z.object({
    行动者: z.string(),
    动作: z.string(),
    目标: z.string().optional(),
    DC: z.number().optional(),
    属性调整: z.number().optional(),
    熟练加值: z.number().optional(),
    额外加值: z.number().optional(),
    优势: z.boolean().optional(),
    劣势: z.boolean().optional(),
    骰子类型: DiceTypeSchema.default('d20'),
    表达式: z.string().optional(),
    消耗骰池: z.boolean().optional().default(true),
    标签: z.array(z.string()).optional()
});

export type RollDiceCheck = z.infer<typeof RollDiceCheckSchema>;

export const ActionEconomyResourceSchema = z.object({
    单位ID: z.string(),
    动作: z.number().min(0),
    附赠: z.number().min(0),
    反应: z.number().min(0),
    移动: z.number().min(0),
    速度: z.number().min(0).optional()
});

export const ActionEconomySchema = z.object({
    回合: z.number().int().min(0),
    当前行动者: z.string().optional(),
    资源: z.array(ActionEconomyResourceSchema)
});

export type ActionEconomy = z.infer<typeof ActionEconomySchema>;

export const SpendActionResourceSchema = z.object({
    单位ID: z.string(),
    资源: z.enum(['动作', '附赠', '反应', '移动']),
    消耗: z.number().positive().default(1),
    原因: z.string().optional()
});

export type SpendActionResource = z.infer<typeof SpendActionResourceSchema>;

export const ResolveAttackCheckSchema = z.object({
    行动者: z.string(),
    目标: z.string().optional(),
    动作: z.string(),
    命中DC: z.number(),
    命中加值: z.number().optional(),
    优势: z.boolean().optional(),
    劣势: z.boolean().optional(),
    伤害表达式: z.string().optional(),
    伤害加值: z.number().optional(),
    目标UNIT_ID: z.string().optional(),
    消耗骰池: z.boolean().optional().default(true),
    标签: z.array(z.string()).optional()
});

export type ResolveAttackCheck = z.infer<typeof ResolveAttackCheckSchema>;

export const ResolveSavingThrowSchema = z.object({
    行动者: z.string(),
    来源: z.string().optional(),
    目标: z.string().optional(),
    动作: z.string(),
    豁免类型: z.string().optional(),
    DC: z.number(),
    豁免加值: z.number().optional(),
    优势: z.boolean().optional(),
    劣势: z.boolean().optional(),
    失败伤害表达式: z.string().optional(),
    成功伤害表达式: z.string().optional(),
    伤害加值: z.number().optional(),
    目标UNIT_ID: z.string().optional(),
    消耗骰池: z.boolean().optional().default(true),
    标签: z.array(z.string()).optional()
});

export type ResolveSavingThrow = z.infer<typeof ResolveSavingThrowSchema>;

export const ResolveDamageRollSchema = z.object({
    行动者: z.string(),
    目标: z.string().optional(),
    动作: z.string(),
    伤害表达式: z.string(),
    伤害加值: z.number().optional(),
    目标UNIT_ID: z.string().optional(),
    标签: z.array(z.string()).optional()
});

export type ResolveDamageRoll = z.infer<typeof ResolveDamageRollSchema>;

export const CombatResolutionStepSchema = z.object({
    标签: z.string(),
    数值: z.number().optional(),
    说明: z.string().optional(),
    类型: z.enum(['掷骰', '对抗', '伤害', '状态', '结果', '其他']).optional()
});

export const CombatResolutionEventSchema = z.object({
    id: z.string(),
    时间: z.string().optional(),
    回合: z.number().optional(),
    行动者: z.string(),
    目标: z.string().optional(),
    动作: z.string(),
    骰子: z.string().optional(),
    掷骰: z.number().optional(),
    修正: z.number().optional(),
    对抗值: z.number().optional(),
    是否成功: z.boolean().optional(),
    伤害: z.number().optional(),
    结果: z.string().optional(),
    步骤: z.array(CombatResolutionStepSchema).optional(),
    标签: z.array(z.string()).optional()
});

export const CombatResolutionLogSchema = z.array(CombatResolutionEventSchema);
export type CombatResolutionEvent = z.infer<typeof CombatResolutionEventSchema>;

// ActionOptions Contract Schema (可选行动列表)
export const ActionOptionSchema = z.object({
    id: z.string(),
    名称: z.string(),
    描述: z.string(),
    类型: z.enum(['攻击', '移动', '技能', '魔法', '物品', '互动', '其他']),
    消耗: z.object({
        体力: z.number().optional(),
        精神: z.number().optional(),
        法利: z.number().optional(),
        物品: z.string().optional()
    }).optional(),
    效果: z.string().optional(),
    条件: z.string().optional(), // Requirements to use this action
    优先级: z.number().optional() // For sorting/highlighting
});

export type TavernActionOption = z.infer<typeof ActionOptionSchema>;

export const ActionOptionsSchema = z.array(ActionOptionSchema);
export type ActionOptions = z.infer<typeof ActionOptionsSchema>;

// LogSummary Schema (日志摘要)
export const LogSummarySchema = z.object({
    回合: z.number(),
    时间: z.string(),
    摘要: z.string(),
    编码索引: z.string().optional(),
    时间跨度: z.string().optional(),
    地点: z.string().optional(),
    纪要: z.string().optional(),
    重要对话: z.string().optional(),
    关键事件: z.array(z.string()).optional()
});

export type LogSummary = z.infer<typeof LogSummarySchema>;

// LogOutline Schema (日志大纲)
export const LogOutlineSchema = z.object({
    章节: z.string(),
    标题: z.string(),
    开始回合: z.number(),
    结束回合: z.number().optional(),
    编码索引: z.string().optional(),
    时间跨度: z.string().optional(),
    大纲: z.string().optional(),
    事件列表: z.array(z.string())
});

export type LogOutline = z.infer<typeof LogOutlineSchema>;

export const EconomicLedgerAccountSchema = z.enum(['角色.法利', '眷族.资金']);

export const EconomicLedgerEntrySchema = z.object({
    id: z.string(),
    turn: z.number().int().min(0),
    timestamp: z.string(),
    account: EconomicLedgerAccountSchema,
    before: z.number(),
    delta: z.number(),
    after: z.number(),
    reason: z.string(),
    commandRef: z.string().optional()
});

export type EconomicLedgerEntryPayload = z.infer<typeof EconomicLedgerEntrySchema>;

export const AppendEconomicLedgerSchema = z.union([
    EconomicLedgerEntrySchema,
    z.array(EconomicLedgerEntrySchema).min(1)
]);

export const ApplyEconomicDeltaSchema = z.object({
    account: EconomicLedgerAccountSchema,
    delta: z.number(),
    reason: z.string().min(1),
    commandRef: z.string().optional(),
    turn: z.number().int().min(0).optional(),
    timestamp: z.string().optional()
});

export type ApplyEconomicDeltaPayload = z.infer<typeof ApplyEconomicDeltaSchema>;

export const SheetUpsertRowsSchema = z.object({
    sheetId: z.string(),
    keyField: z.string().optional(),
    rows: z.array(z.record(z.string(), z.unknown())).min(1)
});

export type SheetUpsertRowsPayload = z.infer<typeof SheetUpsertRowsSchema>;

export const SheetDeleteRowsSchema = z.object({
    sheetId: z.string(),
    keyField: z.string().optional(),
    rowIds: z.array(z.union([z.string(), z.number()])).min(1)
});

export type SheetDeleteRowsPayload = z.infer<typeof SheetDeleteRowsSchema>;

// A-002 FIX: Add Enemy Schema for CombatState.敌方 validation
export const EnemySchema = z.object({
    id: z.string(),
    名称: z.string(),
    等级: z.union([z.string(), z.number()]),
    生命值: z.object({
        当前: z.number(),
        最大: z.number()
    }),
    精神值: z.object({
        当前: z.number(),
        最大: z.number()
    }).optional(),
    状态: z.array(z.string()).optional(),
    位置: z.object({
        x: z.number(),
        y: z.number()
    }).optional(),
    种族: z.string().optional(),
    描述: z.string().optional(),
    能力值: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
    技能: z.array(z.string()).optional(),
    装备: z.record(z.string(), z.string()).optional(),
    掉落物: z.array(z.string()).optional()
}).passthrough(); // Allow additional fields for flexibility

export type Enemy = z.infer<typeof EnemySchema>;

// NPCTavernDB Schema (TavernDB aligned)
export const NPCTavernDBSchema = z.object({
    id: z.string(),
    姓名: z.string().optional(),
    当前状态: z.enum(['在场', '离场', '死亡', '失踪']).optional(),
    所在位置: z.string().optional(),
    与主角关系: z.string().optional(),
    职业身份: z.string().optional(),
    称号: z.string().optional(),
    性别: z.string().optional(),
    种族: z.string().optional(),
    年龄: z.number().optional(),
    眷族: z.string().optional(),
    身份: z.string().optional(),
    好感度: z.number().optional(),
    关系状态: z.string().optional(),
    是否在场: z.boolean().optional(),
    已交换联系方式: z.boolean().optional(),
    特别关注: z.boolean().optional(),
    等级: z.union([z.string(), z.number()]).optional(),
    能力值: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
    装备: z.record(z.string(), z.string()).optional()
}).passthrough(); // Allow other fields

export type NPCTavernDB = z.infer<typeof NPCTavernDBSchema>;

// Inventory Item TavernDB Schema
export const InventoryItemTavernDBSchema = z.object({
    id: z.string().optional(),
    名称: z.string(),
    数量: z.number().optional(),
    描述: z.string().optional(),
    类型: z.string().optional(),
    所属人: z.string().optional(),
    伤害: z.string().optional(),
    特性: z.string().optional(),
    价值单位: z.string().optional(),
    品质: z.string().optional(),
    攻击力: z.number().optional(),
    防御力: z.number().optional()
}).passthrough();

export type InventoryItemTavernDB = z.infer<typeof InventoryItemTavernDBSchema>;

// Helper function to validate and parse with Zod
export function validateSchema<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    } else {
        return {
            success: false,
            error: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        };
    }
}

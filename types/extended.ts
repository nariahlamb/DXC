// Extended types for TavernDB-style contracts

// Encounter (遭遇)
export interface EncounterRow {
  id: string;
  名称: string;
  类型: '战斗' | '事件' | '对话' | '陷阱' | '宝箱' | '其他';
  状态?: '未触发' | '进行中' | '已完成';
  描述?: string;
  参与者?: string[];
  位置?: {
    x: number;
    y: number;
  };
  触发条件?: string;
}

// Dice Pool (骰池)
export interface DiceRow {
  id: string;
  类型: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100' | '其他';
  数值: number;
  用途?: string;
  时间戳?: string;
  已使用?: boolean;
}

export type DicePool = DiceRow[];

export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DicePoolRefillPayload {
  count: number;
  类型?: DiceType[];
  用途?: string;
}

export interface RollDiceCheckPayload {
  行动者: string;
  动作: string;
  目标?: string;
  DC?: number;
  属性调整?: number;
  熟练加值?: number;
  额外加值?: number;
  优势?: boolean;
  劣势?: boolean;
  骰子类型?: DiceType;
  表达式?: string;
  消耗骰池?: boolean;
  标签?: string[];
}

export interface SetActionEconomyPayload {
  回合: number;
  当前行动者?: string;
  资源: Array<{
    单位ID: string;
    动作: number;
    附赠: number;
    反应: number;
    移动: number;
    速度?: number;
  }>;
}

export interface SpendActionResourcePayload {
  单位ID: string;
  资源: '动作' | '附赠' | '反应' | '移动';
  消耗?: number;
  原因?: string;
}

export interface ResolveAttackCheckPayload {
  行动者: string;
  目标?: string;
  动作: string;
  命中DC: number;
  命中加值?: number;
  优势?: boolean;
  劣势?: boolean;
  伤害表达式?: string;
  伤害加值?: number;
  目标UNIT_ID?: string;
  消耗骰池?: boolean;
  标签?: string[];
}

export interface ResolveSavingThrowPayload {
  行动者: string;
  来源?: string;
  目标?: string;
  动作: string;
  豁免类型?: string;
  DC: number;
  豁免加值?: number;
  优势?: boolean;
  劣势?: boolean;
  失败伤害表达式?: string;
  成功伤害表达式?: string;
  伤害加值?: number;
  目标UNIT_ID?: string;
  消耗骰池?: boolean;
  标签?: string[];
}

export interface ResolveDamageRollPayload {
  行动者: string;
  目标?: string;
  动作: string;
  伤害表达式: string;
  伤害加值?: number;
  目标UNIT_ID?: string;
  标签?: string[];
}

// Combat Resolution (判定流程)
export interface CombatResolutionStep {
  标签: string;
  数值?: number;
  说明?: string;
  类型?: '掷骰' | '对抗' | '伤害' | '状态' | '结果' | '其他';
}

export interface CombatResolutionEvent {
  id: string;
  时间?: string;
  回合?: number;
  行动者: string;
  目标?: string;
  动作: string;
  骰子?: string;
  掷骰?: number;
  修正?: number;
  对抗值?: number;
  是否成功?: boolean;
  伤害?: number;
  结果?: string;
  步骤?: CombatResolutionStep[];
  标签?: string[];
}

export type CombatResolutionLog = CombatResolutionEvent[];

// Action Options (可选行动列表)
export interface TavernActionOption {
  id: string;
  名称: string;
  描述: string;
  类型: '攻击' | '移动' | '技能' | '魔法' | '物品' | '互动' | '其他';
  消耗?: {
    体力?: number;
    精神?: number;
    法利?: number;
    物品?: string;
  };
  效果?: string;
  条件?: string;
  优先级?: number;
}

export type ActionOptions = TavernActionOption[];

// Log Summary (日志摘要)
export interface LogSummary {
  回合: number;
  时间: string;
  摘要: string;
  编码索引?: string;
  时间跨度?: string;
  地点?: string;
  纪要?: string;
  重要对话?: string;
  关键事件?: string[];
}

// Log Outline (日志大纲)
export interface LogOutline {
  章节: string;
  标题: string;
  开始回合: number;
  结束回合?: number;
  编码索引?: string;
  时间跨度?: string;
  大纲?: string;
  事件列表: string[];
}

export type EconomicLedgerAccount = '角色.法利' | '眷族.资金';

export interface EconomicLedgerEntry {
  id: string;
  turn: number;
  timestamp: string;
  account: EconomicLedgerAccount;
  before: number;
  delta: number;
  after: number;
  reason: string;
  commandRef?: string;
}

// Enhanced Quest (with more fields than existing Task)
export interface QuestEnhanced {
  id: string;
  名称: string;
  描述: string;
  状态: '未接取' | '进行中' | '已完成' | '已失败';
  委托人?: string;
  奖励?: {
    法利?: number;
    物品?: any[];
    经验?: number;
  };
  目标?: Array<{
    描述: string;
    完成: boolean;
  }>;
  时间限制?: string;
}

// Faction (势力)
export interface Faction {
  id: string;
  名称: string;
  类型: '眷族' | '组织' | '势力' | '其他';
  声望?: number;
  关系?: '友好' | '中立' | '敌对' | '未知';
  描述?: string;
  领袖?: string;
  成员数?: number;
}

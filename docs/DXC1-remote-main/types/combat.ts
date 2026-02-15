
import type { CombatResolutionLog } from './extended';

export interface Enemy {
  id: string;
  名称: string;
  当前生命值?: number;
  最大生命值?: number;
  当前精神MP?: number;
  最大精神MP?: number;
  攻击力?: number;
  描述: string;
  图片?: string;
  等级?: number; // Level (includes threat logic)
  技能?: string[]; // Skills
  生命值?: number; // 旧字段兼容
  精神力?: number; // MP 旧字段兼容
  最大精神力?: number; // 旧字段兼容
}

// BattleMap entity (战斗地图单元)
export interface BattleMapRow {
  UNIT_ID: string; // Unique identifier
  名称: string;
  类型: '玩家' | '敌人' | '友方' | '障碍物' | '地形' | '其他';
  位置: {
    x: number; // Grid coordinate (1格 = 5尺)
    y: number;
  };
  状态?: '正常' | '倒地' | '死亡' | '隐身' | '其他';
  生命值?: {
    当前: number;
    最大: number;
  };
  图标?: string;
  描述?: string;
  尺寸?: {
    宽度: number;
    高度: number;
  };
  状态效果?: string[];
}

// Map visuals (战斗视觉信息)
export interface MapVisuals {
  地图尺寸: {
    宽度: number; // in grid units
    高度: number;
  };
  地形描述?: string;
  特殊区域?: Array<{
    名称: string;
    位置: {
      x: number;
      y: number;
    };
    范围?: number;
    效果?: string;
  }>;
  光照?: '明亮' | '昏暗' | '黑暗' | '其他';
  天气?: string;
}

export interface ActionEconomyResource {
  单位ID: string;
  动作: number;
  附赠: number;
  反应: number;
  移动: number;
  速度?: number;
}

export interface ActionEconomyState {
  回合: number;
  当前行动者?: string;
  资源: ActionEconomyResource[];
}

export interface CombatState {
  是否战斗中: boolean;
  // 当前回合 removed
  敌方: Enemy[] | null;
  战斗记录: string[];
  上一次行动?: string;

  // TavernDB extensions
  地图?: BattleMapRow[]; // Battle map entities
  视觉?: MapVisuals; // Map visual information
  initiative_order?: string[]; // Initiative order by UNIT_ID
  current_actor?: string; // Current acting UNIT_ID
  行动经济?: ActionEconomyState; // Action economy by UNIT_ID
  判定事件?: CombatResolutionLog; // Combat resolution timeline
  已提示战斗地图缺失?: boolean; // Internal flag to avoid spammy prompts
}

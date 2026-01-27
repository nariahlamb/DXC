
export interface InventoryItem {
  id: string;
  名称: string;
  描述: string;
  数量: number;
  
  // 类型定义
  类型: 'consumable' | 'material' | 'key_item' | 'weapon' | 'armor' | 'loot'; 
  获取途径?: 'dungeon' | 'public'; 

  // 标签与来源
  标签?: string[] | string;
  来源?: string;
  制作者?: string;
  材质?: string;
  堆叠上限?: number;
  是否绑定?: boolean;
  
  // 状态
  已装备?: boolean; 
  装备槽位?: string; 
  
  // --- 核心属性 (原 ItemStats 扁平化) ---
  品质?: 'Broken' | 'Common' | 'Rare' | 'Epic' | 'Legendary' | '普通' | '稀有' | '史诗' | '传说' | '破损'; // 兼容中文枚举
  
  // 战斗数值
  攻击力?: number;
  防御力?: number;
  恢复量?: number; 
  
  // 耐久系统
  耐久?: number;
  最大耐久?: number;
  
  // 特效与描述
  效果?: string; 
  攻击特效?: string; 
  防御特效?: string; 
  
  // 附加属性 (Affixes) - 保持数组结构因为是列表
  附加属性?: { 名称: string; 数值: string }[]; 
  
  // 扩展字段 (丰富功能)
  价值?: number; // 商店售价
  重量?: number; // 负重影响
  等级需求?: number;

  // 装备与子类信息
  武器?: {
    类型?: string; // 长剑/短剑/枪/斧/弓/杖/魔剑等
    伤害类型?: string; // 斩击/突刺/打击/魔法等
    射程?: string;
    攻速?: string;
    双手?: boolean;
    特性?: string[] | string;
  };
  防具?: {
    类型?: string; // 轻甲/中甲/重甲/布甲等
    部位?: string; // 头部/身体/手部/腿部/足部/饰品
    护甲等级?: string;
    抗性?: string[] | string;
  };
  消耗?: {
    类别?: string;
    持续?: string;
    冷却?: string;
    副作用?: string;
  };
  材料?: {
    来源?: string;
    用途?: string;
    处理?: string;
  };

  // 魔剑专用
  魔剑?: {
    魔法名称?: string;
    属性?: string;
    威力?: string;
    触发方式?: string;
    冷却?: string;
    剩余次数?: number;
    最大次数?: number;
    破损率?: number | string;
    过载惩罚?: string;
    备注?: string;
  };
}

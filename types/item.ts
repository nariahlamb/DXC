
export interface InventoryItem {
  id: string;
  名称: string;
  描述: string;
  数量: number;
  
  // 类型定义
  类型: 'consumable' | 'material' | 'key_item' | 'weapon' | 'armor' | 'loot'
    | '消耗品' | '材料' | '关键物品' | '钥匙物品' | '武器' | '防具' | '护甲' | '饰品' | '战利品' | '掉落' | '杂项'; 
  图标?: string; // 支持 URL 或 Iconify 格式
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
  // 写入标准：统一使用中文品质；仍兼容历史英文/字母档输入
  品质?: '破损' | '普通' | '稀有' | '史诗' | '传说' | '神话'
    | '精良' | '完美'
    | 'Broken' | 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Pristine'
    | 'N' | 'R' | 'SR' | 'SSR' | 'UR' | 'EX' | 'S' | 'SS' | 'SSS';
  稀有度?: string; // 兼容旧字段（最终会与 品质 保持一致）
  
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

// === TavernDB-Aligned Extensions ===
// Additional fields to align with TavernDB ITEM_Inventory structure

export interface InventoryItemTavernDB extends InventoryItem {
  // TavernDB specific fields (all optional for backward compatibility)
  所属人?: string; // Owner name (empty = public/player)
  伤害?: string; // Weapon damage (e.g., "1d8+3")
  特性?: string; // Item properties (e.g., "轻型, 灵巧")
  价值单位?: string; // Value unit (e.g., "gp", "sp", "cp")
}

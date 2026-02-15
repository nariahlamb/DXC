
import { GeoPoint } from './world';
import { InventoryItem } from './item';

export interface InteractionMemory {
    内容: string; // content
    时间戳: string; // timestamp
}

export interface Confidant {
  id: string;
  姓名: string;
  
  // --- 基础数据 ---
  称号?: string;
  性别?: string;
  种族: string;
  年龄?: number;
  眷族: string;
  身份: '冒险者' | '神明' | '平民' | string; 
  
  简介?: string; // intro
  外貌?: string; // appearance
  性格?: string; // personality
  背景?: string; // background
  
  好感度: number;
  关系状态: string; // relationshipStatus
  
  // 状态标识
  是否在场?: boolean; // isPresent
  已交换联系方式: boolean; // hasContactInfo
  特别关注: boolean; // isSpecialAttention
  强制包含上下文?: boolean; // forceIncludeInContext
  
  // 动态数据
  坐标?: GeoPoint; 
  位置详情?: string; // locationDetail
  
  // 记忆系统
  记忆: InteractionMemory[];
  头像?: string; 
  排除提示词?: boolean; 

  // --- 战斗/队友数据 ---
  是否队友?: boolean; // isPartyMember
  等级: string | number; 
  已知能力?: string; // knownAbilities

  // 战斗数值 (Vitals)
  生存数值?: {
      当前生命: number; 最大生命: number;
      当前精神: number; 最大精神: number;
      当前体力: number; 最大体力: number;
  };

  // 基础能力 (Stats)
  能力值?: { 
      力量: number | string;
      耐久: number | string;
      灵巧: number | string;
      敏捷: number | string;
      魔力: number | string;
  };

  // 装备 (Equipment)
  装备?: {
      主手?: string;
      副手?: string;
      身体?: string;
      头部?: string;
      腿部?: string;
      足部?: string;
      饰品?: string;
  };

  // 独立背包
  背包?: InventoryItem[]; 
}

// === TavernDB-Aligned Extensions ===
// Additional fields to align with TavernDB NPC_Registry structure

export interface NPCTavernDB extends Confidant {
  // TavernDB specific fields (all optional for backward compatibility)
  当前状态?: '在场' | '离场' | '死亡' | '失踪'; // NPC current status
  所在位置?: string; // Current location (scene name)
  与主角关系?: string; // Relationship with player
  职业身份?: string; // Occupation/identity
  种族性别年龄?: string; // Combined basic info
  关键经历?: string; // Key experiences
}

export interface PhoneMessage {
  id: string;
  发送者: string;
  内容: string;
  时间戳: string; // Display string "第X日 HH:MM"
  timestampValue?: number; // Sorting value
  类型?: 'text' | 'system' | 'image' | string;
  状态?: 'pending' | 'sent' | 'received' | 'read' | 'failed' | string;
  图片描述?: string;
  表情包?: string;
  媒体类型?: 'image' | 'sticker' | string;
  送达时间?: string; // 计划送达的游戏时间（第X日 HH:MM）
  延迟分钟?: number; // 便于调试/展示
  引用?: { id?: string; 内容?: string; 发送者?: string };
}

export interface PhonePendingMessage {
  id: string;
  threadId: string;
  threadTitle?: string;
  threadType: 'private' | 'group' | 'public';
  deliverAt: string; // 游戏时间
  payload: PhoneMessage;
  status?: 'scheduled' | 'delivered' | 'canceled';
  trigger?: {
    locations?: string[];
    confidants?: string[];
    storyKeywords?: string[];
    taskIds?: string[];
    worldKeywords?: string[];
  };
}

export interface PhoneThread {
  id: string;
  类型: 'private' | 'group' | 'public';
  标题: string;
  成员: string[];
  消息: PhoneMessage[];
  未读?: number;
  置顶?: boolean;
  备注?: string;
  摘要?: string;
  摘要时间?: string;
  摘要更新时间?: number;
}

export interface PhonePost {
  id: string;
  发布者: string;
  头像?: string;
  内容: string;
  时间戳: string;
  timestampValue?: number;
  点赞数: number;
  评论: { 用户: string; 内容: string }[];
  图片描述?: string; 
  可见性: 'friends' | 'public';
  话题?: string[];
  来源?: string;
}

export interface ForumBoard {
  id: string;
  名称: string;
  图标?: string;
  颜色?: string;
  描述?: string;
}

export interface ForumReply {
  id: string;
  楼层: number;
  发布者: string;
  头像?: string;
  内容: string;
  时间戳: string;
  引用楼层?: number;
  点赞数?: number;
}

export interface ForumPost {
  id: string;
  标题: string;
  内容: string;
  发布者: string;
  头像?: string;
  时间戳: string;
  timestampValue?: number;
  板块: string;
  话题标签?: string[];
  置顶?: boolean;
  精华?: boolean;
  浏览数?: number;
  点赞数: number;
  回复: ForumReply[];
  图片描述?: string;
}

export interface PhoneState {
  设备: {
    电量: number;
    当前信号: number;
    状态?: 'online' | 'offline' | 'silent' | string;
  };
  联系人: {
    好友: string[];
    黑名单?: string[];
    最近?: string[];
  };
  对话: {
    私聊: PhoneThread[];
    群聊: PhoneThread[];
    公共频道: PhoneThread[];
  };
  朋友圈: {
    仅好友可见: boolean;
    帖子: PhonePost[];
  };
  公共帖子: {
    板块?: ForumBoard[];
    帖子: ForumPost[];
  };
  待发送?: PhonePendingMessage[];
}

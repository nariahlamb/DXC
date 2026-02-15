
import { Screen, Difficulty } from './enums';
import { CharacterStats } from './character';
import { LogEntry, MemorySystem } from './ai';
import { InventoryItem } from './item';
import { Confidant, PhoneState } from './social';
import { WorldState, WorldMapData, GeoPoint, FamiliaState } from './world';
import { Task, StoryState, Contract } from './story';
import { NoteEntry } from './notes';
import { CombatState } from './combat';
import { Skill } from './character';
import {
  EncounterRow,
  DicePool,
  ActionOptions,
  LogSummary,
  LogOutline,
  EconomicLedgerEntry,
  Faction,
  QuestEnhanced
} from './extended';
import type { TavernDBRuntimeMeta } from './taverndb';

export interface RawGameData {
    [key: string]: any;
}

export interface DailyDashboardState {
  当前目标?: string;
  最近日志?: string;
}

export interface GameState {
  当前界面: Screen;
  游戏难度: Difficulty;
  处理中: boolean;
  规则集?: 'danmachi' | 'dnd5e';

  // 核心数据
  角色: CharacterStats;
  背包: InventoryItem[];
  日志: LogEntry[];

  // 环境信息
  游戏时间: string;
  当前日期: string; // YYYY-MM-DD
  当前地点: string;
  当前楼层: number;
  天气: string;

  // 坐标系统
  世界坐标: GeoPoint;
  // 显示坐标 removed - derived from 世界坐标 in UI

  // 子系统
  战利品: InventoryItem[]; // 这里的"战利品"指代"战利品保管库(已归档)"
  公共战利品: InventoryItem[]; // NEW: 探索中的临时战利品背包
  战利品背负者: string; // NEW: 谁背着大包 (Player 或 支援者名字)

  社交: Confidant[];
  手机: PhoneState;
  世界: WorldState;
  地图: WorldMapData;

  任务: Task[];
  技能: Skill[];
  剧情: StoryState;
  契约: Contract[];
  眷族: FamiliaState;
  笔记: NoteEntry[];

  // 核心机制
  记忆: MemorySystem;
  战斗: CombatState;
  回合数: number;

  // TavernDB extensions (optional)
  遭遇?: EncounterRow[]; // Encounters
  骰池?: DicePool; // Dice pool
  可选行动列表?: ActionOptions; // Available action options
  日志摘要?: LogSummary[]; // Log summaries
  日志大纲?: LogOutline[]; // Log outlines
  经济流水?: EconomicLedgerEntry[]; // Economic ledger
  势力?: Faction[]; // Factions (if not using 眷族)
  增强任务?: QuestEnhanced[]; // Enhanced quests (if needed beyond 任务)
  __tableRows?: Record<string, Array<Record<string, unknown>>>;
  __tableMeta?: TavernDBRuntimeMeta;

  // TavernDB Global State Extensions (SYS_GlobalState alignment)
  场景描述?: string; // Scene environment description
  上轮时间?: string; // Previous round time (YYYY-MM-DD HH:MM)
  流逝时长?: string; // Time elapsed since last round (e.g., "2小时30分钟")
  战斗模式?: '非战斗' | '战斗中' | '战斗结束'; // Combat mode status
  系统通知?: string; // System notifications
  日常仪表盘?: DailyDashboardState;

  [key: string]: any;

  // Legacy / Archive
  historyArchive?: LogEntry[];

  // Global Settings
  系统设置?: SystemSettings;
}

export interface SystemSettings {
  世界更新间隔回合: number;
  通知设置: {
    新闻推送: boolean;
    传闻更新: boolean;
    私信通知: boolean;
    论坛动态: boolean;
  };
  订阅源: string[]; // e.g., ['guild', 'street', 'familia']
  更新频率?: 'realtime' | 'fast' | 'normal' | 'manual';
}

export interface SaveSlot {
    id: number | string;
    type: 'MANUAL' | 'AUTO';
    timestamp: number;
    summary: string;
    data: GameState;
    version?: string;
}

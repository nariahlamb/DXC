
import { InventoryItem } from './item';

// --- Basic Geo Types ---
export interface GeoPoint {
    x: number;
    y: number;
}

export interface MapBounds {
  width: number;
  height: number;
}

export interface MapWorldLocation {
  id: string;
  name: string;
  type?: string;
  description?: string;
  center: GeoPoint;
  size: { width: number; height: number; unit?: string };
  regionId?: string;
}

export interface MapWorld {
  id: string;
  name: string;
  description?: string;
  bounds: MapBounds;
  center: GeoPoint;
  size: { width: number; height: number; unit?: string };
  locations: MapWorldLocation[];
}

export interface MapRegionLandmark {
  id: string;
  name: string;
  type?: string;
  description?: string;
  position: GeoPoint;
  radius?: number;
}

export interface MapRegionBuildingRef {
  id: string;
  name: string;
  description: string;
  type?: string;
}

export interface MapRegion {
  id: string;
  name: string;
  description?: string;
  worldLocationId: string;
  bounds: MapBounds;
  center: GeoPoint;
  size: { width: number; height: number; unit?: string };
  landmarks: MapRegionLandmark[];
  buildings: MapRegionBuildingRef[];
  dungeonId?: string;
}

export interface MapRoom {
  id: string;
  name: string;
  type?: string;
  bounds: { x: number; y: number; width: number; height: number };
  connections?: string[];
  features?: string[];
}

export interface MapFurniture {
  id: string;
  name: string;
  type?: string;
  position: GeoPoint;
  size?: { width: number; height: number };
  roomId?: string;
  description?: string;
}

export interface MapEntrance {
  id: string;
  name: string;
  position: GeoPoint;
  connectsTo?: string;
}

export interface MapBuildingLayout {
  scale?: string;
  width: number;
  height: number;
  rooms: MapRoom[];
  furniture: MapFurniture[];
  entrances: MapEntrance[];
  notes?: string[];
}

export interface MapBuilding {
  id: string;
  regionId: string;
  name: string;
  description?: string;
  bounds: MapBounds;
  anchor: GeoPoint;
  layout: MapBuildingLayout;
}

export interface DungeonRoom {
  id: string;
  name: string;
  type?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  discovered?: boolean;
  description?: string;
}

export interface DungeonEdge {
  id: string;
  from: string;
  to: string;
  points: GeoPoint[];
  discovered?: boolean;
  type?: string;
}

export interface DungeonFloor {
  floor: number;
  bounds: MapBounds;
  rooms: DungeonRoom[];
  edges: DungeonEdge[];
}

export interface DungeonGraph {
  id: string;
  regionId: string;
  name: string;
  description?: string;
  entrance: GeoPoint;
  floors: DungeonFloor[];
}

export interface MapViewState {
  mode: 'WORLD' | 'REGION' | 'BUILDING' | 'DUNGEON';
  regionId?: string;
  buildingId?: string;
  dungeonId?: string;
  floor?: number;
}

export interface WorldMapData {
  world: MapWorld;
  regions: MapRegion[];
  buildings: Record<string, MapBuilding>;
  dungeons: Record<string, DungeonGraph>;
  current: MapViewState;
}

export interface DenatusState {
  下次神会开启时间: string;
  神会主题: string;
  讨论内容: { 角色: string; 对话: string }[];
  最终结果: string;
}

export interface NpcBackgroundTracking {
  NPC: string;
  当前行动: string;
  位置?: string;
  进度?: string;
  预计完成?: string;
}

export interface FactionTierState {
  S级: string[];
  A级: string[];
  B级至I级: string[];
  备注?: string;
}

export interface WarGameState {
  状态: '未开始' | '筹备' | '进行中' | '结束' | string;
  参战眷族: string[];
  形式: string;
  赌注: string;
  举办时间?: string;
  结束时间?: string;
  结果?: string;
  备注?: string;
}

// Refactor Business States to Chinese
export interface WorldState {
  异常指数: number; // tensionLevel
  头条新闻: string[]; // breakingNews
  街头传闻: { 主题: string; 传播度: number }[]; // activeRumors
  诸神神会: DenatusState;
  NPC后台跟踪: NpcBackgroundTracking[];
  派阀格局?: FactionTierState;
  战争游戏?: WarGameState;
  下次更新?: string; // nextUpdate
}

export interface FamiliaState {
  名称: string;
  等级: string; // Rank
  主神: string;
  资金: number;
  声望: number;
  设施状态: any;
  仓库: InventoryItem[]; 
}

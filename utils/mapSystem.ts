
import { Direction, Enemy, WorldMapData, DungeonLayer, MapMacroLocation, MapMidLocation, MapSmallLocation } from "../types";

// Helper to get opposite direction
export const getOppositeDir = (dir: Direction): Direction => {
  switch (dir) {
    case 'North': return 'South';
    case 'South': return 'North';
    case 'East': return 'West';
    case 'West': return 'East';
  }
};

// --- Combat Helper ---
export const generateEnemy = (floor: number, isBoss: boolean = false): Enemy => {
  const baseHp = 50 + (floor * 20);
  const baseAtk = 8 + (floor * 2);
  const baseMp = 20 + (floor * 6);
  const level = Math.max(1, Math.floor((floor - 1) / 12) + 1);

  if (isBoss) {
    return {
      id: 'boss_' + Date.now(),
      名称: `第${floor}层 迷宫孤王`,
      当前生命值: baseHp * 3,
      最大生命值: baseHp * 3,
      当前精神MP: baseMp * 2,
      最大精神MP: baseMp * 2,
      攻击力: Math.round(baseAtk * 1.5),
      描述: "统治该楼层的强大怪物。",
      图片: "https://images.unsplash.com/photo-1620560024765-685b306b3a0c?q=80&w=600&auto=format&fit=crop",
      等级: level + 1,
      技能: ["咆哮震慑", "重击"]
    };
  }

  const commonEnemies = [
    { name: "狗头人", desc: "如同猎犬般的人形怪物。", img: "https://images.unsplash.com/photo-1509557965875-b88c97052f0e?q=80&w=400" },
    { name: "哥布林", desc: "身材矮小但生性残忍。", img: "https://images.unsplash.com/photo-1591185854884-1d37452d3774?q=80&w=400" },
    { name: "杀人蚁", desc: "拥有坚硬甲壳的群居怪物。", img: "https://images.unsplash.com/photo-1550747528-cdb45925b3f7?q=80&w=400" },
    { name: "弥诺陶洛斯", desc: "发狂的牛头人怪物。", img: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=400" }
  ];

  const template = commonEnemies[Math.floor(Math.random() * commonEnemies.length)];

  return {
    id: 'enemy_' + Date.now(),
    名称: template.name,
    当前生命值: baseHp + Math.floor(Math.random() * 20),
    最大生命值: baseHp + Math.floor(Math.random() * 20),
    当前精神MP: baseMp + Math.floor(Math.random() * 10),
    最大精神MP: baseMp + Math.floor(Math.random() * 10),
    攻击力: baseAtk,
    描述: template.desc,
    图片: template.img,
    等级: level,
    技能: ["突袭", "连击"]
  };
};

// --- SVG Path Helpers ---

/**
 * 创建扇形区域路径 (Sector)
 * 角度定义 (标准SVG坐标系):
 * 0度 = 3点钟 (东)
 * 90度 = 6点钟 (南)
 * 180度 = 9点钟 (西)
 * 270度 = 12点钟 (北)
 */
const createSectorPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number, innerR: number = 0): string => {
    // Convert to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Outer Arc
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    // Inner Arc
    const x3 = cx + innerR * Math.cos(endRad);
    const y3 = cy + innerR * Math.sin(endRad);
    const x4 = cx + innerR * Math.cos(startRad);
    const y4 = cy + innerR * Math.sin(startRad);

    // Large Arc Flag (if > 180 degrees)
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

    // SVG Path Command
    // M (Move to Start Outer)
    // A (Arc to End Outer)
    // L (Line to End Inner)
    // A (Arc Back to Start Inner, sweep flag 0 for reverse)
    // Z (Close)
    return [
        `M ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
        `Z`
    ].join(' ');
};

const createCirclePath = (cx: number, cy: number, r: number): string => {
    return [
        `M ${cx - r}, ${cy}`,
        `a ${r},${r} 0 1,0 ${r * 2},0`,
        `a ${r},${r} 0 1,0 -${r * 2},0`
    ].join(' ');
};

const createPolylinePath = (points: { x: number; y: number }[]): string => {
    if (points.length === 0) return '';
    const [first, ...rest] = points;
    return [
        `M ${first.x} ${first.y}`,
        ...rest.map(p => `L ${p.x} ${p.y}`)
    ].join(' ');
};

// --- 欧拉丽全地图生成 (Strict layout) ---

export const generateDanMachiMap = (): WorldMapData => {
    const WORLD_SIZE = 100000;
    const ORARIO_CENTER = { x: 50000, y: 50000 };
    const ORARIO_RADIUS = 8000;
    const ORARIO_BOUNDS = { minX: 40000, minY: 40000, maxX: 60000, maxY: 60000 };
    const DUNGEON_BOUNDS = { minX: 0, minY: 0, maxX: 8000, maxY: 8000 };

    const macroLocations: MapMacroLocation[] = [
        {
            id: 'macro_world',
            name: '下界',
            type: 'WORLD',
            coordinates: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 },
            area: { shape: 'RECT', center: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 }, width: WORLD_SIZE, height: WORLD_SIZE, note: '下界大陆范围(示意)' },
            size: { width: WORLD_SIZE, height: WORLD_SIZE, unit: 'm' },
            mapLayerId: 'layer_world',
            description: '下界世界地图(示意)，包含欧拉丽与诸国。',
            floor: 0
        }
    ];

    const midLocations: MapMidLocation[] = [
        {
            id: 'mid_orario',
            name: '欧拉丽',
            parentId: 'macro_world',
            coordinates: ORARIO_CENTER,
            area: { shape: 'CIRCLE', center: ORARIO_CENTER, radius: ORARIO_RADIUS, note: '迷宫都市范围(示意)' },
            size: { width: ORARIO_RADIUS * 2, height: ORARIO_RADIUS * 2, unit: 'm' },
            mapLayerId: 'layer_orario',
            description: '迷宫都市欧拉丽，地下城入口位于巴别塔之下。',
            floor: 0
        },
        {
            id: 'mid_rakia',
            name: '拉基亚王国',
            parentId: 'macro_world',
            coordinates: { x: 30000, y: 60000 },
            area: { shape: 'RECT', center: { x: 30000, y: 60000 }, width: 14000, height: 9000, note: '大陆西侧的军事强国(示意)' },
            size: { width: 14000, height: 9000, unit: 'm' },
            description: '以军事实力著称的国家，位于大陆西侧。',
            floor: 0
        },
        {
            id: 'mid_melen',
            name: '梅伦',
            parentId: 'macro_world',
            coordinates: { x: ORARIO_CENTER.x - 3000, y: ORARIO_CENTER.y + 3000 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x - 3000, y: ORARIO_CENTER.y + 3000 }, radius: 900, note: '欧拉丽西南约3公里的港镇(示意)' },
            size: { width: 1800, height: 1800, unit: 'm' },
            description: '欧拉丽西南约3公里的港镇。',
            floor: 0
        },
        {
            id: 'mid_telskyura',
            name: '特尔斯库拉',
            parentId: 'macro_world',
            coordinates: { x: 82000, y: 82000 },
            area: { shape: 'RECT', center: { x: 82000, y: 82000 }, width: 18000, height: 11000, note: '远东南半岛区域(示意)' },
            size: { width: 18000, height: 11000, unit: 'm' },
            description: '远东南方的半岛国家。',
            floor: 0
        }
    ];

    const smallLocations: MapSmallLocation[] = [
        {
            id: 'small_orario_babel',
            name: '巴别塔',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x, y: ORARIO_CENTER.y },
            area: { shape: 'CIRCLE', center: ORARIO_CENTER, radius: 700, note: '地下城入口与都市核心' },
            description: '50层高塔，被视为地下城的盖子。',
            floor: 0
        },
        {
            id: 'small_orario_abandoned_church',
            name: '废弃教堂',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x, y: ORARIO_CENTER.y + 6000 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x, y: ORARIO_CENTER.y + 6000 }, radius: 500, note: '赫斯缇雅眷族旧居' },
            description: '赫斯缇雅眷族旧居，曾被阿波罗眷族摧毁。',
            floor: 0
        },
        {
            id: 'small_orario_hostess',
            name: '丰饶的女主人',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x - 3500, y: ORARIO_CENTER.y + 3000 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x - 3500, y: ORARIO_CENTER.y + 3000 }, radius: 400, note: '酒馆与情报据点' },
            description: '米雅·格兰德经营的酒馆。',
            floor: 0
        },
        {
            id: 'small_orario_guild',
            name: '万神殿（公会总部）',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x - 2500, y: ORARIO_CENTER.y - 2500 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x - 2500, y: ORARIO_CENTER.y - 2500 }, radius: 450, note: '公会总部大楼' },
            description: '公会总部大楼所在。',
            floor: 0
        },
        {
            id: 'small_orario_hephaestus_shop',
            name: '赫菲斯托丝眷族西北商铺',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x - 4200, y: ORARIO_CENTER.y - 4200 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x - 4200, y: ORARIO_CENTER.y - 4200 }, radius: 350, note: '西北商铺' },
            description: '赫斯缇雅曾在此下跪请求的商铺。',
            floor: 0
        },
        {
            id: 'small_orario_amphitheatron',
            name: '圆形竞技场',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x - 2500, y: ORARIO_CENTER.y - 5200 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x - 2500, y: ORARIO_CENTER.y - 5200 }, radius: 500, note: '怪物祭竞技场' },
            description: '伽尼萨眷族举办怪物祭的竞技场。',
            floor: 0
        },
        {
            id: 'small_orario_daedalus',
            name: '代达罗斯街',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x + 4200, y: ORARIO_CENTER.y + 3200 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x + 4200, y: ORARIO_CENTER.y + 3200 }, radius: 500, note: '第二迷宫' },
            description: '被称为第二迷宫的街区。',
            floor: 0
        },
        {
            id: 'small_orario_amor_square',
            name: '阿莫尔广场',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x + 3200, y: ORARIO_CENTER.y },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x + 3200, y: ORARIO_CENTER.y }, radius: 450, note: '彩砖与花园广场' },
            description: '彩色地砖与花园广场，矗立女神雕像。',
            floor: 0
        },
        {
            id: 'small_orario_blue_pharmacy',
            name: '蓝色药铺',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x + 4200, y: ORARIO_CENTER.y - 2500 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x + 4200, y: ORARIO_CENTER.y - 2500 }, radius: 350, note: '米亚赫眷族据点' },
            description: '米亚赫眷族据点。',
            floor: 0
        },
        {
            id: 'small_orario_training',
            name: '艾丝训练贝尔之地',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x + 5200, y: ORARIO_CENTER.y - 500 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x + 5200, y: ORARIO_CENTER.y - 500 }, radius: 350, note: '训练场所' },
            description: '艾丝训练贝尔的地点。',
            floor: 0
        },
        {
            id: 'small_orario_jagamaru',
            name: '炸土豆球摊位',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x + 1500, y: ORARIO_CENTER.y + 3500 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x + 1500, y: ORARIO_CENTER.y + 3500 }, radius: 300, note: '赫斯缇雅打工处' },
            description: '赫斯缇雅打工的土豆球摊位。',
            floor: 0
        },
        {
            id: 'small_orario_hephaestus_forge',
            name: '赫菲斯托丝眷族锻造作坊',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x - 1500, y: ORARIO_CENTER.y - 3600 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x - 1500, y: ORARIO_CENTER.y - 3600 }, radius: 400, note: '锻造作坊群' },
            description: '赫菲斯托丝眷族的锻造作坊群。',
            floor: 0
        },
        {
            id: 'small_orario_twilight_manor',
            name: '暮光庄园',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x - 1200, y: ORARIO_CENTER.y - 6200 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x - 1200, y: ORARIO_CENTER.y - 6200 }, radius: 500, note: '洛基眷族据点' },
            description: '洛基眷族据点。',
            floor: 0
        },
        {
            id: 'small_orario_dian_cecht',
            name: '狄安·凯特眷族药铺',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x + 2000, y: ORARIO_CENTER.y - 4200 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x + 2000, y: ORARIO_CENTER.y - 4200 }, radius: 350, note: '白石药铺' },
            description: '白色石材建筑，亦是眷族据点。',
            floor: 0
        },
        {
            id: 'small_orario_three_hammers',
            name: '三锤铁匠铺',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x + 400, y: ORARIO_CENTER.y - 5600 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x + 400, y: ORARIO_CENTER.y - 5600 }, radius: 350, note: '戈比纽眷族作坊' },
            description: '戈比纽眷族作坊兼据点。',
            floor: 0
        },
        {
            id: 'small_orario_clothing_shops',
            name: '北大街服装店',
            parentId: 'mid_orario',
            coordinates: { x: ORARIO_CENTER.x + 1600, y: ORARIO_CENTER.y - 6600 },
            area: { shape: 'CIRCLE', center: { x: ORARIO_CENTER.x + 1600, y: ORARIO_CENTER.y - 6600 }, radius: 350, note: '购物街服装店' },
            description: '北部主街购物区的服装店。',
            floor: 0
        }
    ];

    const dungeonStructure: DungeonLayer[] = [
        { floorStart: 1, floorEnd: 12, name: '上层 (Upper Floors)', description: '入门层区，地图相对简洁。', dangerLevel: 'LOW', landmarks: [] },
        { floorStart: 13, floorEnd: 17, name: '中层 (Middle Floors)', description: '死线之后，结构复杂，17层出现楼层主。', dangerLevel: 'HIGH', landmarks: [{ floor: 17, name: '楼层主·歌利亚', type: 'BOSS' }] },
        { floorStart: 18, floorEnd: 18, name: '安全层·Under Resort (里维拉)', description: '安全楼层，怪物不在此诞生。', dangerLevel: 'SAFE', landmarks: [{ floor: 18, name: '里维拉镇', type: 'SAFE_ZONE' }] },
        { floorStart: 19, floorEnd: 24, name: '中层 (Middle Floors)', description: '迷宫与生态更复杂，通路易变。', dangerLevel: 'HIGH', landmarks: [] },
        { floorStart: 25, floorEnd: 27, name: '下层 (Lower Floors) · Water City', description: 'Great Fall 瀑布区，27层有楼层主。', dangerLevel: 'EXTREME', landmarks: [{ floor: 27, name: '楼层主·安菲斯比纳', type: 'BOSS' }] },
        { floorStart: 28, floorEnd: 28, name: '安全层·Under Garden', description: '花园般的安全楼层，怪物不在此诞生。', dangerLevel: 'SAFE', landmarks: [{ floor: 28, name: 'Under Garden', type: 'SAFE_ZONE' }] },
        { floorStart: 29, floorEnd: 36, name: '下层 (Lower Floors)', description: '生态极端，地形复杂，高危区域。', dangerLevel: 'EXTREME', landmarks: [] },
        { floorStart: 37, floorEnd: 38, name: '深层 (Deep Floors)', description: '极限区域，37层中心有楼层主。', dangerLevel: 'HELL', landmarks: [{ floor: 37, name: '楼层主·乌代俄斯', type: 'BOSS' }] },
        { floorStart: 39, floorEnd: 39, name: '安全层·Under Bridge', description: '深层安全点，怪物不在此诞生。', dangerLevel: 'SAFE', landmarks: [{ floor: 39, name: 'Under Bridge', type: 'SAFE_ZONE' }] },
        { floorStart: 40, floorEnd: 43, name: '深层 (Deep Floors)', description: '记录稀少，生态不稳定。', dangerLevel: 'HELL', landmarks: [] },
        { floorStart: 44, floorEnd: 48, name: '深层·Crimson Mountains', description: '火山地貌与炽热岩层。', dangerLevel: 'HELL+', landmarks: [] },
        { floorStart: 49, floorEnd: 49, name: '深层·Moytura', description: '巨型荒野区域，存在楼层主。', dangerLevel: 'HELL+', landmarks: [{ floor: 49, name: '楼层主·巴罗尔', type: 'BOSS' }] },
        { floorStart: 50, floorEnd: 50, name: '安全层·第50层', description: '深层安全点，怪物不在此诞生。', dangerLevel: 'SAFE', landmarks: [{ floor: 50, name: '安全层·第50层', type: 'SAFE_ZONE' }] },
        { floorStart: 51, floorEnd: 58, name: '深层·Hall of the Grafite', description: '平整迷宫结构与石墨厅域。', dangerLevel: 'HELL+', landmarks: [] },
        { floorStart: 59, floorEnd: 65, name: '深层·Glacial Domain', description: '冰河与极寒环境，生态异常。', dangerLevel: 'HELL+', landmarks: [] }
    ];

    return {
        config: { width: WORLD_SIZE, height: WORLD_SIZE },
        factions: [],
        territories: [],
        terrain: [],
        routes: [],
        surfaceLocations: [],
        dungeonStructure,
        macroLocations,
        midLocations,
        smallLocations,
        leaflet: {
            layers: [
                {
                    id: 'layer_world',
                    name: '下界世界地图',
                    scope: 'macro',
                    url: '/maps/world-map.svg',
                    bounds: { minX: 0, minY: 0, maxX: WORLD_SIZE, maxY: WORLD_SIZE },
                    minZoom: -2,
                    maxZoom: 2,
                    defaultZoom: -1
                },
                {
                    id: 'layer_orario',
                    name: '欧拉丽地区地图',
                    scope: 'mid',
                    ownerId: 'mid_orario',
                    url: '/maps/orario-map.svg',
                    bounds: ORARIO_BOUNDS,
                    minZoom: -1,
                    maxZoom: 4,
                    defaultZoom: 0
                },
                {
                    id: 'layer_dungeon',
                    name: '地下城网格',
                    scope: 'dungeon',
                    url: '/maps/dungeon-grid.svg',
                    bounds: DUNGEON_BOUNDS,
                    minZoom: -1,
                    maxZoom: 4,
                    defaultZoom: 0
                }
            ]
        }
    };
};

export const resolveLocationHierarchy = (mapData: WorldMapData | undefined, locationName?: string): { macro?: string; mid?: string; small?: string } => {
    if (!mapData || !locationName) return {};
    const macroLocations = Array.isArray(mapData.macroLocations) ? mapData.macroLocations : [];
    const midLocations = Array.isArray(mapData.midLocations) ? mapData.midLocations : [];
    const smallLocations = Array.isArray(mapData.smallLocations) ? mapData.smallLocations : [];
    const normalize = (value?: string) => (value || '').toString().trim().toLowerCase().replace(/\s+/g, '');
    const matchByName = (name: string, list: { id: string; name: string }[]) => {
        const n = normalize(name);
        if (!n) return null;
        return list.find(i => normalize(i.name) === n) || list.find(i => n.includes(normalize(i.name))) || null;
    };
    const currentSmall = matchByName(locationName, smallLocations as any);
    const currentMid = currentSmall
        ? midLocations.find(m => m.id === (currentSmall as any).parentId) || null
        : matchByName(locationName, midLocations as any);
    const currentMacro = currentMid
        ? macroLocations.find(m => m.id === (currentMid as any).parentId) || null
        : (macroLocations.length === 1 ? macroLocations[0] : matchByName(locationName, macroLocations as any));
    return {
        macro: currentMacro?.name,
        mid: currentMid?.name,
        small: currentSmall?.name
    };
};




import { Direction, Enemy, WorldMapData, MapRegion, MapBuilding, MapWorld, DungeonGraph } from "../types";

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

// --- 地错世界地图生成 (前传时间点) ---

export const generateDanMachiMap = (): WorldMapData => {
    const WORLD_BOUNDS = { width: 100000, height: 100000 };
    const WORLD_CENTER = { x: WORLD_BOUNDS.width / 2, y: WORLD_BOUNDS.height / 2 };

    const world: MapWorld = {
        id: 'world_lower',
        name: '下界',
        description: '众神降临后的人类世界。',
        bounds: WORLD_BOUNDS,
        center: WORLD_CENTER,
        size: { width: WORLD_BOUNDS.width, height: WORLD_BOUNDS.height, unit: 'px' },
        locations: [
            {
                id: 'loc_orario',
                name: '欧拉丽',
                type: 'CITY',
                description: '迷宫都市，地下城入口位于巴别塔之下。',
                center: { x: 22000, y: 52000 },
                size: { width: 20000, height: 20000, unit: 'px' },
                regionId: 'region_orario'
            },
            {
                id: 'loc_rakia',
                name: '拉基亚王国',
                type: 'KINGDOM',
                description: '大陆西侧的军事王国。',
                center: { x: 36000, y: 52000 },
                size: { width: 26000, height: 18000, unit: 'px' }
            },
            {
                id: 'loc_telskyura',
                name: '特尔斯库拉',
                type: 'COUNTRY',
                description: '远东南半岛国家。',
                center: { x: 82000, y: 76000 },
                size: { width: 24000, height: 16000, unit: 'px' }
            },
            {
                id: 'loc_melen',
                name: '梅伦',
                type: 'PORT_TOWN',
                description: '欧拉丽西南的港镇。',
                center: { x: 18000, y: 56000 },
                size: { width: 8000, height: 8000, unit: 'px' }
            }
        ]
    };

    const orarioBounds = { width: 20000, height: 20000 };
    const orarioCenter = { x: orarioBounds.width / 2, y: orarioBounds.height / 2 };

    const regions: MapRegion[] = [
        {
            id: 'region_orario',
            name: '欧拉丽',
            description: '迷宫都市与地下城入口所在的核心区域。',
            worldLocationId: 'loc_orario',
            bounds: orarioBounds,
            center: orarioCenter,
            size: { width: orarioBounds.width, height: orarioBounds.height, unit: 'px' },
            landmarks: [
                { id: 'lm_babel', name: '巴别塔', type: 'LANDMARK', description: '地下城入口与都市核心。', position: { x: 10000, y: 10000 }, radius: 900 },
                { id: 'lm_guild', name: '万神殿（公会本部）', type: 'GUILD', description: '公会总部大楼。', position: { x: 9000, y: 9300 }, radius: 700 },
                { id: 'lm_hostess', name: '丰饶的女主人', type: 'TAVERN', description: '著名酒馆与情报据点。', position: { x: 7600, y: 11200 }, radius: 600 },
                { id: 'lm_church', name: '废弃教堂', type: 'LANDMARK', description: '旧教堂与偏僻街区。', position: { x: 9800, y: 14500 }, radius: 500 },
                { id: 'lm_hephaestus_shop', name: '赫菲斯托丝眷族西北商铺', type: 'SHOP', description: '西北工坊商铺聚集区。', position: { x: 7200, y: 7200 }, radius: 550 },
                { id: 'lm_amphitheatron', name: '圆形竞技场', type: 'ARENA', description: '怪物祭竞技场。', position: { x: 8200, y: 6800 }, radius: 750 },
                { id: 'lm_daedalus', name: '代达罗斯街', type: 'DISTRICT', description: '复杂街区，被称为第二迷宫。', position: { x: 12400, y: 11800 }, radius: 800 },
                { id: 'lm_amor_square', name: '阿莫尔广场', type: 'SQUARE', description: '彩砖与花园广场。', position: { x: 11800, y: 9800 }, radius: 650 }
            ],
            buildings: [
                { id: 'building_babel_entry', name: '巴别塔·地面入口厅', description: '通往地下城的入口与公会通行检查区。', type: 'LANDMARK' },
                { id: 'building_guild_pantheon', name: '公会本部·一层大厅', description: '冒险者登记与任务接取的主要区域。', type: 'GUILD' },
                { id: 'building_hostess', name: '丰饶的女主人', description: '冒险者聚集的酒馆。', type: 'TAVERN' },
                { id: 'building_abandoned_church', name: '废弃教堂', description: '偏僻街区的旧教堂建筑。', type: 'LANDMARK' },
                { id: 'building_hephaestus_shop', name: '赫菲斯托丝眷族西北商铺', description: '工坊街区内的锻造与售卖点。', type: 'SHOP' },
                { id: 'building_amphitheatron', name: '圆形竞技场', description: '怪物祭举办地。', type: 'ARENA' },
                { id: 'building_daedalus', name: '代达罗斯街', description: '错综复杂的街区入口。', type: 'DISTRICT' },
                { id: 'building_amor_square', name: '阿莫尔广场', description: '花园与女神雕像所在广场。', type: 'SQUARE' }
            ],
            dungeonId: 'dungeon_orario'
        }
    ];

    const buildings: Record<string, MapBuilding> = {
        building_babel_entry: {
            id: 'building_babel_entry',
            regionId: 'region_orario',
            name: '巴别塔·地面入口厅',
            description: '公会通行检查与地下城入口大厅。',
            bounds: { width: 70, height: 50 },
            anchor: { x: 10000, y: 10000 },
            layout: {
                scale: '1格=1米',
                width: 70,
                height: 50,
                rooms: [
                    { id: 'babel_lobby', name: '入口大厅', type: 'public', bounds: { x: 4, y: 4, width: 62, height: 22 } },
                    { id: 'babel_gate', name: '通行检查区', type: 'checkpoint', bounds: { x: 8, y: 28, width: 54, height: 10 } },
                    { id: 'babel_stairs', name: '下行阶梯', type: 'stairs', bounds: { x: 28, y: 40, width: 14, height: 6 } }
                ],
                furniture: [
                    { id: 'babel_desk', name: '检票柜台', type: 'counter', position: { x: 12, y: 30 }, size: { width: 18, height: 2 }, roomId: 'babel_gate' },
                    { id: 'babel_guard', name: '守卫岗', type: 'post', position: { x: 44, y: 30 }, size: { width: 6, height: 2 }, roomId: 'babel_gate' }
                ],
                entrances: [
                    { id: 'babel_main', name: '正门', position: { x: 35, y: 2 }, connectsTo: '欧拉丽中心大道' }
                ],
                notes: ['入口大厅保持人流畅通，公会人员随时巡逻。']
            }
        },
        building_guild_pantheon: {
            id: 'building_guild_pantheon',
            regionId: 'region_orario',
            name: '公会本部·一层大厅',
            description: '冒险者登记与任务受理区。',
            bounds: { width: 80, height: 50 },
            anchor: { x: 9000, y: 9300 },
            layout: {
                scale: '1格=1米',
                width: 80,
                height: 50,
                rooms: [
                    { id: 'guild_lobby', name: '大厅', type: 'public', bounds: { x: 4, y: 4, width: 72, height: 20 } },
                    { id: 'guild_counter', name: '接待区', type: 'counter', bounds: { x: 6, y: 26, width: 68, height: 10 } },
                    { id: 'guild_office', name: '办公区', type: 'office', bounds: { x: 10, y: 38, width: 60, height: 8 } }
                ],
                furniture: [
                    { id: 'guild_main_counter', name: '主柜台', type: 'counter', position: { x: 10, y: 28 }, size: { width: 20, height: 2 }, roomId: 'guild_counter' },
                    { id: 'guild_board', name: '公告板', type: 'board', position: { x: 40, y: 10 }, size: { width: 6, height: 2 }, roomId: 'guild_lobby' },
                    { id: 'guild_wait', name: '等候座椅', type: 'seat', position: { x: 18, y: 14 }, size: { width: 8, height: 2 }, roomId: 'guild_lobby' }
                ],
                entrances: [
                    { id: 'guild_main', name: '正门', position: { x: 40, y: 2 }, connectsTo: '欧拉丽中心大道' }
                ],
                notes: ['大厅常有冒险者等待任务分配。']
            }
        },
        building_hostess: {
            id: 'building_hostess',
            regionId: 'region_orario',
            name: '丰饶的女主人',
            description: '冒险者聚集的酒馆。',
            bounds: { width: 60, height: 40 },
            anchor: { x: 7600, y: 11200 },
            layout: {
                scale: '1格=1米',
                width: 60,
                height: 40,
                rooms: [
                    { id: 'hostess_hall', name: '酒馆大厅', type: 'public', bounds: { x: 3, y: 3, width: 54, height: 18 } },
                    { id: 'hostess_bar', name: '吧台', type: 'counter', bounds: { x: 6, y: 24, width: 30, height: 6 } },
                    { id: 'hostess_kitchen', name: '后厨', type: 'kitchen', bounds: { x: 38, y: 24, width: 18, height: 10 } }
                ],
                furniture: [
                    { id: 'hostess_tables', name: '餐桌', type: 'table', position: { x: 10, y: 10 }, size: { width: 10, height: 3 }, roomId: 'hostess_hall' },
                    { id: 'hostess_counter', name: '主吧台', type: 'counter', position: { x: 8, y: 26 }, size: { width: 18, height: 2 }, roomId: 'hostess_bar' }
                ],
                entrances: [
                    { id: 'hostess_main', name: '正门', position: { x: 30, y: 2 }, connectsTo: '西街区' }
                ],
                notes: ['高峰时段人流密集，吧台后常有人低声交谈。']
            }
        },
        building_abandoned_church: {
            id: 'building_abandoned_church',
            regionId: 'region_orario',
            name: '废弃教堂',
            description: '偏僻街区的旧教堂建筑。',
            bounds: { width: 50, height: 40 },
            anchor: { x: 9800, y: 14500 },
            layout: {
                scale: '1格=1米',
                width: 50,
                height: 40,
                rooms: [
                    { id: 'church_nave', name: '礼拜堂', type: 'hall', bounds: { x: 4, y: 4, width: 42, height: 16 } },
                    { id: 'church_altar', name: '祭坛区', type: 'altar', bounds: { x: 16, y: 22, width: 18, height: 6 } },
                    { id: 'church_side', name: '侧室', type: 'room', bounds: { x: 6, y: 30, width: 14, height: 6 } }
                ],
                furniture: [
                    { id: 'church_bench', name: '长椅', type: 'bench', position: { x: 10, y: 10 }, size: { width: 12, height: 2 }, roomId: 'church_nave' }
                ],
                entrances: [
                    { id: 'church_main', name: '正门', position: { x: 25, y: 2 }, connectsTo: '南街区小巷' }
                ],
                notes: ['内部尘封已久，仍保留简陋的礼拜设施。']
            }
        }
    };

    const dungeon: DungeonGraph = {
        id: 'dungeon_orario',
        regionId: 'region_orario',
        name: '欧拉丽地下城',
        description: '位于巴别塔下方的活体迷宫。',
        entrance: { x: 10000, y: 10000 },
        floors: [
            {
                floor: 1,
                bounds: { width: 1600, height: 1600 },
                rooms: [
                    { id: 'f1_entrance', name: '入口大厅', type: 'ENTRANCE', x: 700, y: 700, width: 200, height: 200, discovered: true, description: '巴别塔下方的第一入口。' },
                    { id: 'f1_hall_a', name: '回廊A', type: 'HALL', x: 700, y: 520, width: 200, height: 120, discovered: false },
                    { id: 'f1_room_a', name: '探索房间', type: 'ROOM', x: 520, y: 360, width: 160, height: 140, discovered: false }
                ],
                edges: [
                    { id: 'f1_edge_entrance', from: 'f1_entrance', to: 'f1_hall_a', points: [{ x: 800, y: 700 }, { x: 800, y: 640 }], discovered: true },
                    { id: 'f1_edge_room', from: 'f1_hall_a', to: 'f1_room_a', points: [{ x: 760, y: 520 }, { x: 600, y: 430 }], discovered: false }
                ]
            }
        ]
    };

    return {
        world,
        regions,
        buildings,
        dungeons: { [dungeon.id]: dungeon },
        current: {
            mode: 'REGION',
            regionId: 'region_orario',
            floor: 0
        }
    };
};

export const resolveLocationHierarchy = (mapData: WorldMapData | undefined, locationName?: string): { macro?: string; mid?: string; small?: string } => {
    if (!mapData) return {};
    const worldName = mapData.world?.name;
    const current = mapData.current || { mode: 'REGION' as const };
    const region = mapData.regions.find(r => r.id === current.regionId) || mapData.regions[0];
    let small: string | undefined;
    if (current.mode === 'BUILDING' && current.buildingId) {
        small = mapData.buildings[current.buildingId]?.name;
    } else if (current.mode === 'DUNGEON' && current.dungeonId) {
        const dungeonName = mapData.dungeons[current.dungeonId]?.name;
        small = dungeonName ? (current.floor ? `${dungeonName}·第${current.floor}层` : dungeonName) : undefined;
    } else if (locationName) {
        small = locationName;
    }
    return {
        macro: worldName,
        mid: region?.name,
        small
    };
};



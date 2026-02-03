
import { GameState, RawGameData, Screen, Difficulty, InventoryItem, BodyParts, Task } from "../types";
import { generateDanMachiMap } from "./mapSystem";
import { computeMaxCarry } from './characterMath';

export const createNewGameState = (
    name: string, 
    gender: string, 
    race: string, 
    age: number = 14, 
    birthday: string = "01-01",
    appearance: string = "",
    background: string = "",
    difficulty: Difficulty = Difficulty.NORMAL,
    initialPackage: 'standard' | 'combat' | 'survival' | 'wealth' = 'standard'
): GameState => {
    // 1. 种族映射与基础属性
    const raceNameMap: {[key:string]: string} = {
        'Human': '人类', 'Elf': '精灵', 'Dwarf': '矮人',
        'Pallum': '小人族', 'Amazon': '亚马逊', 'Beastman': '兽人'
    };
    const displayRace = raceNameMap[race] || race;
    const worldMap = generateDanMachiMap();
    const startLoc = { x: 10000, y: 10000 }; // 统一出生点：巴别塔广场（区域像素坐标）

    // 2. 差异化开局配置 (Difficulty Config)
    let startValis = 0;
    let totalHp = 300;
    let initialInventory: InventoryItem[] = [];
    let initialTasks: Task[] = [];
    let initialNews: string[] = [];
    let initialRumors: { 主题: string; 传播度: number }[] = [];
    let startMind = 60;
    let maxMind = 60;
    let startStamina = 100;
    let maxStamina = 100;
    let startEquipment = {
        头部: "",
        身体: "",
        手部: "",
        腿部: "",
        足部: "",
        主手: "",
        副手: "",
        饰品1: "",
        饰品2: "",
        饰品3: ""
    };
    const playerName = name;

    // --- 难度分支逻辑 ---
    if (difficulty === Difficulty.EASY) {
        // Easy: 资源充足，公会优待
        startValis = 15000;
        totalHp = 520;
        startMind = 100;
        maxMind = 100;

        initialInventory = [
            { id: 'Eq_Wpn_E', 名称: '精炼长剑', 描述: '出自高阶工坊的练成剑，锋利且顺手。', 数量: 1, 类型: 'weapon', 武器: { 类型: '长剑', 伤害类型: '斩击', 射程: '近战', 攻速: '中', 双手: false }, 已装备: true, 装备槽位: '主手', 攻击力: 18, 品质: 'Rare', 耐久: 90, 最大耐久: 90, 价值: 12000, 重量: 1.3 },
            { id: 'Eq_Arm_E', 名称: '轻银皮甲', 描述: '以轻质合金加固的皮甲，兼顾机动与防护。', 数量: 1, 类型: 'armor', 防具: { 类型: '轻甲', 部位: '身体', 护甲等级: '轻' }, 已装备: true, 装备槽位: '身体', 防御力: 10, 品质: 'Rare', 耐久: 80, 最大耐久: 80, 价值: 8000, 重量: 2.2 },
            { id: 'Eq_Glv_E', 名称: '皮制护手', 描述: '便于握持武器的护手。', 数量: 1, 类型: 'armor', 防具: { 类型: '轻甲', 部位: '手部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '手部', 防御力: 2, 品质: 'Common', 耐久: 40, 最大耐久: 40, 价值: 600, 重量: 0.4 },
            { id: 'Eq_Leg_E', 名称: '旅行护腿', 描述: '适合长途行动的护腿。', 数量: 1, 类型: 'armor', 防具: { 类型: '轻甲', 部位: '腿部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '腿部', 防御力: 3, 品质: 'Common', 耐久: 45, 最大耐久: 45, 价值: 800, 重量: 0.8 },
            { id: 'Eq_Boot_E', 名称: '轻行长靴', 描述: '轻便且耐磨的长靴。', 数量: 1, 类型: 'armor', 防具: { 类型: '轻甲', 部位: '足部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '足部', 防御力: 3, 品质: 'Common', 耐久: 45, 最大耐久: 45, 价值: 700, 重量: 0.7 },
            { id: 'Eq_Acc_E', 名称: '冒险者护符', 描述: '公会赠送的护符，提升精神稳定性。', 数量: 1, 类型: 'armor', 防具: { 类型: '饰品', 部位: '饰品', 护甲等级: '无' }, 已装备: true, 装备槽位: '饰品1', 效果: '轻微稳定精神', 品质: 'Rare', 价值: 3000, 重量: 0.2 },
            { id: 'Itm_Pot_M', 名称: '中级回复药', 描述: '用于战后快速恢复的标准药剂。', 数量: 3, 类型: 'consumable', 恢复量: 180, 品质: 'Rare', 价值: 2000 },
            { id: 'Itm_Map', 名称: '欧拉丽精细地图', 描述: '标注了推荐店铺和安全路线的地图。', 数量: 1, 类型: 'key_item', 品质: 'Common', 价值: 800 },
            { id: 'Itm_Letter', 名称: '公会贵宾推荐信', 描述: '盖有公会印章的推荐信，可获得优先接待。', 数量: 1, 类型: 'key_item', 品质: 'Epic', 价值: 0 }
        ];

        startEquipment = {
            头部: '', 身体: '轻银皮甲', 手部: '皮制护手', 腿部: '旅行护腿', 足部: '轻行长靴',
            主手: '精炼长剑', 副手: '', 饰品1: '冒险者护符', 饰品2: '', 饰品3: ''
        };

        initialTasks.push({
            id: 'Tsk_001',
            标题: '贵宾登记',
            描述: '目标：在公会本部二楼贵宾柜台完成登记。\n达成条件：完成登记流程并取得冒险者ID/登记凭证。',
            状态: 'active',
            奖励: '专属支援者情报',
            评级: 'D',
            接取时间: '第1日 07:00'
        });
        initialTasks.push({
            id: 'Tsk_002',
            标题: '眷族接洽',
            描述: '目标：携带推荐信与任一眷族进行初次会面。\n达成条件：与至少一位神明完成正式面谈并建立接触记录。',
            状态: 'active',
            奖励: '眷族候选情报',
            评级: 'C',
            接取时间: '第1日 07:10'
        });

    } else if (difficulty === Difficulty.NORMAL) {
        // Normal: 标准新人配置
        startValis = 1200;
        totalHp = 320;
        startMind = 60;
        maxMind = 60;

        initialInventory = [
            { id: 'Eq_Wpn_N', 名称: '铁制短剑', 描述: '公会发放的标准自卫武器。', 数量: 1, 类型: 'weapon', 武器: { 类型: '短剑', 伤害类型: '突刺', 射程: '近战', 攻速: '快', 双手: false }, 已装备: true, 装备槽位: '主手', 攻击力: 6, 品质: 'Common', 耐久: 50, 最大耐久: 50, 价值: 3000, 重量: 0.8 },
            { id: 'Eq_Arm_N', 名称: '冒险者皮甲', 描述: '耐磨的基础防具，防护有限。', 数量: 1, 类型: 'armor', 防具: { 类型: '轻甲', 部位: '身体', 护甲等级: '轻' }, 已装备: true, 装备槽位: '身体', 防御力: 3, 品质: 'Common', 耐久: 40, 最大耐久: 40, 价值: 2000, 重量: 1.4 },
            { id: 'Eq_Glv_N', 名称: '简易护手', 描述: '基础护手，便于握持武器。', 数量: 1, 类型: 'armor', 防具: { 类型: '轻甲', 部位: '手部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '手部', 防御力: 1, 品质: 'Common', 耐久: 30, 最大耐久: 30, 价值: 500, 重量: 0.3 },
            { id: 'Eq_Leg_N', 名称: '粗布长裤', 描述: '普通旅人穿着的粗布长裤。', 数量: 1, 类型: 'armor', 防具: { 类型: '布甲', 部位: '腿部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '腿部', 防御力: 1, 品质: 'Common', 耐久: 30, 最大耐久: 30, 价值: 400, 重量: 0.6 },
            { id: 'Eq_Boot_N', 名称: '旧皮靴', 描述: '耐用但略显磨损的皮靴。', 数量: 1, 类型: 'armor', 防具: { 类型: '轻甲', 部位: '足部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '足部', 防御力: 1, 品质: 'Common', 耐久: 25, 最大耐久: 25, 价值: 400, 重量: 0.6 },
            { id: 'Itm_Pot_L', 名称: '低级回复药', 描述: '略带苦味的红色药水。', 数量: 1, 类型: 'consumable', 恢复量: 50, 品质: 'Common', 价值: 600 },
            { id: 'Itm_Food', 名称: '热麦面包', 描述: '欧拉丽街头常见的热面包。', 数量: 2, 类型: 'consumable', 恢复量: 10, 品质: 'Common', 价值: 30 }
        ];

        startEquipment = {
            头部: '', 身体: '冒险者皮甲', 手部: '简易护手', 腿部: '粗布长裤', 足部: '旧皮靴',
            主手: '铁制短剑', 副手: '', 饰品1: '', 饰品2: '', 饰品3: ''
        };

        initialTasks.push({
            id: 'Tsk_001',
            标题: '冒险者登记',
            描述: '目标：在公会本部完成新人注册。\n达成条件：完成登记并获得冒险者ID卡。',
            状态: 'active',
            奖励: '冒险者ID卡',
            评级: 'E',
            接取时间: '第1日 07:00'
        });
        initialTasks.push({
            id: 'Tsk_002',
            标题: '寻找眷族',
            描述: '目标：在欧拉丽接触愿意接纳新人的神明。\n达成条件：与任一眷族完成正式接洽，获得加入邀请或进入考察流程。',
            状态: 'active',
            奖励: '神之恩惠 (Falna)',
            评级: 'S',
            接取时间: '第1日 07:05'
        });

    } else if (difficulty === Difficulty.HARD) {
        // Hard: 资金紧张，装备老旧
        startValis = 150;
        totalHp = 320; // 优化开局状态：满血
        startMind = 60; // 优化开局状态：满精神
        maxMind = 60;

        initialInventory = [
            { id: 'Eq_Wpn_H', 名称: '磨损短刀', 描述: '刃口缺损，但还能勉强使用。', 数量: 1, 类型: 'weapon', 武器: { 类型: '短刀', 伤害类型: '斩击', 射程: '近战', 攻速: '快', 双手: false }, 已装备: true, 装备槽位: '主手', 攻击力: 3, 品质: 'Common', 耐久: 20, 最大耐久: 40, 价值: 1200, 重量: 0.6 },
            { id: 'Eq_Arm_H', 名称: '旧布背心', 描述: '几乎没有防护力的旧衣。', 数量: 1, 类型: 'armor', 防具: { 类型: '布甲', 部位: '身体', 护甲等级: '轻' }, 已装备: true, 装备槽位: '身体', 防御力: 1, 品质: 'Common', 耐久: 20, 最大耐久: 30, 价值: 800, 重量: 0.5 },
            { id: 'Eq_Leg_H', 名称: '补丁长裤', 描述: '补丁缝合的旧长裤。', 数量: 1, 类型: 'armor', 防具: { 类型: '布甲', 部位: '腿部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '腿部', 防御力: 1, 品质: 'Common', 耐久: 18, 最大耐久: 25, 价值: 600, 重量: 0.5 },
            { id: 'Eq_Boot_H', 名称: '裂口短靴', 描述: '鞋底磨损严重的短靴。', 数量: 1, 类型: 'armor', 防具: { 类型: '布甲', 部位: '足部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '足部', 防御力: 0, 品质: 'Common', 耐久: 15, 最大耐久: 25, 价值: 500, 重量: 0.4 },
            { id: 'Itm_Pot_S', 名称: '劣质回复药', 描述: '气味刺鼻的廉价药剂。', 数量: 1, 类型: 'consumable', 恢复量: 35, 品质: 'Common', 价值: 400 },
            { id: 'Itm_Bread', 名称: '干面包', 描述: '硬得能当武器的干面包。', 数量: 1, 类型: 'consumable', 恢复量: 5, 品质: 'Common', 价值: 20 }
        ];

        startEquipment = {
            头部: '', 身体: '旧布背心', 手部: '', 腿部: '补丁长裤', 足部: '裂口短靴',
            主手: '磨损短刀', 副手: '', 饰品1: '', 饰品2: '', 饰品3: ''
        };

        initialTasks.push({
            id: 'Tsk_001',
            标题: '生计问题',
            描述: '目标：解决今晚的落脚处与最低生活开销。\n达成条件：获得住处（旅店/临时落脚/眷族收留）并确保基础开销。',
            状态: 'active',
            奖励: '生存保障',
            评级: 'E',
            接取时间: '第1日 07:00'
        });
        initialTasks.push({
            id: 'Tsk_002',
            标题: '眷族线索',
            描述: '目标：打听愿意接纳新人的眷族消息。\n达成条件：获取至少一条可验证的眷族线索（神明所在地点或接洽渠道）。',
            状态: 'active',
            奖励: '眷族情报',
            评级: 'E',
            接取时间: '第1日 07:10'
        });

    } else if (difficulty === Difficulty.HELL) {
        // Hell: 近乎赤贫，设备损坏
        startValis = 0;
        totalHp = 320; // 优化开局状态：满血
        startMind = 60; // 优化开局状态：满精神
        maxMind = 60;

        initialInventory = [
            { id: 'Eq_Wpn_X', 名称: '缺口小刀', 描述: '随身破旧的小刀，勉强能用。', 数量: 1, 类型: 'weapon', 武器: { 类型: '小刀', 伤害类型: '斩击', 射程: '近战', 攻速: '快', 双手: false }, 已装备: true, 装备槽位: '主手', 攻击力: 1, 品质: 'Broken', 耐久: 6, 最大耐久: 20, 价值: 0, 重量: 0.4 },
            { id: 'Eq_Arm_X', 名称: '破旧外套', 描述: '缝补多次的旧外套，几乎没有防护力。', 数量: 1, 类型: 'armor', 防具: { 类型: '布甲', 部位: '身体', 护甲等级: '极低' }, 已装备: true, 装备槽位: '身体', 防御力: 0, 品质: 'Broken', 耐久: 8, 最大耐久: 20, 价值: 0 },
            { id: 'Eq_Leg_X', 名称: '破布长裤', 描述: '边缘磨损的破旧长裤。', 数量: 1, 类型: 'armor', 防具: { 类型: '布甲', 部位: '腿部', 护甲等级: '极低' }, 已装备: true, 装备槽位: '腿部', 防御力: 0, 品质: 'Broken', 耐久: 8, 最大耐久: 20, 价值: 0 },
            { id: 'Eq_Boot_X', 名称: '磨破布鞋', 描述: '几乎失去缓冲的旧鞋。', 数量: 1, 类型: 'armor', 防具: { 类型: '布甲', 部位: '足部', 护甲等级: '极低' }, 已装备: true, 装备槽位: '足部', 防御力: 0, 品质: 'Broken', 耐久: 6, 最大耐久: 15, 价值: 0 },
            { id: 'Itm_Bag_X', 名称: '空水袋', 描述: '破旧的水袋，急需补给。', 数量: 1, 类型: 'key_item', 品质: 'Broken', 价值: 0 }
        ];

        startEquipment = {
            头部: '', 身体: '破旧外套', 手部: '', 腿部: '破布长裤', 足部: '磨破布鞋',
            主手: '缺口小刀', 副手: '', 饰品1: '', 饰品2: '', 饰品3: ''
        };

        initialTasks.push({
            id: 'Tsk_001',
            标题: '活下去',
            描述: '目标：解决饥饿与饮水。\n达成条件：补充食物与水分，并确保至少一条安全落脚点线索。',
            状态: 'active',
            奖励: '生存机会',
            评级: 'SS',
            接取时间: '第1日 07:00'
        });
        initialTasks.push({
            id: 'Tsk_002',
            标题: '寻找落脚处',
            描述: '目标：在贫民区或公会周边找到临时容身处。\n达成条件：获得明确落脚地点或保护承诺。',
            状态: 'active',
            奖励: '生存保障',
            评级: 'S',
            接取时间: '第1日 07:05'
        });
    }

    // 3. 初始资源包逻辑 (Initial Resource Selection)
    if (initialPackage === 'combat') {
        initialInventory.push(
            { id: 'Itm_Pot_L_Ex', 名称: '备用回复药', 描述: '额外的低级回复药。', 数量: 2, 类型: 'consumable', 恢复量: 50, 品质: 'Common', 价值: 600 },
             { id: 'Itm_Whetstone', 名称: '简易磨刀石', 描述: '用于维护武器耐久。', 数量: 1, 类型: 'consumable', 品质: 'Common', 价值: 200 }
        );
    } else if (initialPackage === 'survival') {
         initialInventory.push(
             { id: 'Itm_Food_Ex', 名称: '旅行干粮', 描述: '便于携带的口粮。', 数量: 4, 类型: 'consumable', 恢复量: 15, 品质: 'Common', 价值: 40 },
             { id: 'Itm_Water_Ex', 名称: '过滤水', 描述: '干净的饮用水。', 数量: 3, 类型: 'consumable', 恢复量: 10, 品质: 'Common', 价值: 30 }
        );
    } else if (initialPackage === 'wealth') {
        startValis += 2000;
    }


// --- 3. 统一世界动态与社交内容 ---
    
    // 增加通用新闻
    initialNews.push("【庆典】怪物祭进入倒计时 11 天，公会全面提升安保等级。【第十二日开启】");
    initialNews.push("【公会】上层第 5~7 层出现异常刷新，请新人冒险者谨慎进入、优先组队。");
    
    // 增加通用传闻
    initialRumors.push({ 主题: "听说洛基眷族正在筹备一次大规模远征。", 传播度: 55 });
    initialRumors.push({ 主题: "东区的贫民窟里住着一位贫穷女神。", 传播度: 35 });
    initialRumors.push({ 主题: "芙蕾雅眷族最近频繁在酒馆露面。", 传播度: 25 });
        

    // 4. 生存与身体部位初始化
    const mkPart = (ratio: number) => ({ 当前: Math.floor(totalHp * ratio), 最大: Math.floor(totalHp * ratio) });
    const bodyParts: BodyParts = {
        头部: mkPart(0.15), 胸部: mkPart(0.30), 腹部: mkPart(0.15),
        左臂: mkPart(0.10), 右臂: mkPart(0.10), 左腿: mkPart(0.10), 右腿: mkPart(0.10)
    };
    
    // Hell 模式开局状态 (疲劳与饥饿，而非受伤)
    // 优化：所有难度开局状态均为最佳，不再带病上阵
    let fatigue = 0;
    // if (difficulty === Difficulty.HELL) {
    //     fatigue = 60; // 旅途劳顿
    // } else if (difficulty === Difficulty.HARD) {
    //     fatigue = 30;
    // }

    // 生存状态
    let survival = { 饱腹度: 100, 最大饱腹度: 100, 水分: 100, 最大水分: 100 };
    // if (difficulty === Difficulty.HARD) {
    //     survival.饱腹度 = 80; 
    //     survival.水分 = 80;
    // } else if (difficulty === Difficulty.HELL) {
    //     survival.饱腹度 = 40; // 饥饿
    //     survival.水分 = 50;   // 口渴
    // }

    // 5. 构造最终状态
    
    // 生成开局描述 Text
    let introText = "";
    if (difficulty === Difficulty.EASY) {
        introText = `${playerName}刚抵达巴别塔广场。晨光铺在石砖上，人潮与公会卫队让广场秩序井然，贵宾通道提示在公告牌上闪烁如同通行印章。

补给与装备齐整，地图与推荐信被妥善收起，足以支撑一段从容的起步。怪物祭倒计时的公告贴在广场一侧，喧闹声里夹着紧张的节奏。`;
    } else if (difficulty === Difficulty.NORMAL) {
        introText = `${playerName}踏入巴别塔广场时，人声与铁匠铺的敲击混在一起。基础装备与几份补给勉强齐备，公会登记提醒在手心里微微震动。

怪物祭倒计时的通告贴在公告栏，公会旗帜随风摆动。广场的节奏正在加快。`;
    } else if (difficulty === Difficulty.HARD) {
        introText = `${playerName}在巴别塔广场停下脚步，口袋里的法利所剩无几，旧刀贴着腰侧发出轻响。行人匆匆，公会告示反复提醒上层异常频发，紧张的空气把广场压得更低。

怪物祭倒计时的标语在风里抖动，物价与警戒的阴影逐渐笼罩街区。`;
    } else {
        introText = `风掠过巴别塔广场的石阶，${playerName}的徽章只剩微光。饥饿与寒意沉在身上，卫兵的影子在石砖上拉长，人群的脚步声像潮水。

怪物祭倒计时的布告在高处摇晃，喧闹与冷风一同卷过。`;
    }

    const initialNpcTracking = [
        {
            NPC: '希儿',
            地点: '丰饶的女主人',
            当前行动: '在后厨备料，准备午间菜单。',
            计划阶段: ['备料', '出餐', '打烊整理'],
            当前阶段: 0,
            阶段结束时间: '第1日 09:00',
            预计完成: '第1日 23:00',
            进度: '备料中'
        },
        {
            NPC: '艾伊娜',
            地点: '公会本部',
            当前行动: '整理委托告示，核对新人登记。',
            计划阶段: ['整理公告', '接待新人', '汇总报告'],
            当前阶段: 0,
            阶段结束时间: '第1日 08:30',
            预计完成: '第1日 18:00',
            进度: '整理中'
        },
        {
            NPC: '赫斯缇雅',
            地点: '废弃教堂',
            当前行动: '清理教堂内的杂物，准备迎接新的眷属。',
            计划阶段: ['清理', '修补', '准备迎接'],
            当前阶段: 0,
            阶段结束时间: '第1日 10:00',
            预计完成: '第1日 20:00',
            进度: '清理中'
        },
        {
            NPC: '赫菲斯托丝',
            地点: '赫菲斯托丝眷族工房',
            当前行动: '检查订单进度，安排工匠轮班。',
            计划阶段: ['检查订单', '安排轮班', '验收成品'],
            当前阶段: 0,
            阶段结束时间: '第1日 11:00',
            预计完成: '第1日 19:00',
            进度: '检视中'
        }
    ];

    const state: GameState = {
        当前界面: Screen.GAME,
        游戏难度: difficulty,
        处理中: false,
        角色: {
            姓名: name,
            种族: displayRace,
            性别: gender === 'Male' ? '男性' : '女性',
            年龄: age,
            生日: birthday,
            称号: "新人",
            所属眷族: "无",
            等级: 1,
            头像: `https://ui-avatars.com/api/?name=${name}&background=random&size=200`,
            外貌: appearance || "相貌平平的冒险者。",
            背景: background || "为了寻求邂逅而来到欧拉丽。",
            
            生命值: Object.values(bodyParts).reduce((sum, p) => sum + p.当前, 0), 
            最大生命值: Object.values(bodyParts).reduce((sum, p) => sum + p.最大, 0),
            精神力: startMind, 
            最大精神力: maxMind,
            体力: startStamina,
            最大体力: maxStamina,
            
            生存状态: survival,
            身体部位: bodyParts,

            经验值: 0,
            伟业: 0,
            升级所需伟业: 5,
            法利: startValis,
            
            疲劳度: fatigue,
            公会评级: "I",
            魔法栏位: { 上限: 3, 已使用: 0, 扩展来源: [] },

            能力值: { 力量: 0, 耐久: 0, 灵巧: 0, 敏捷: 0, 魔力: 0 },
            隐藏基础能力: { 力量: 0, 耐久: 0, 灵巧: 0, 敏捷: 0, 魔力: 0 },
            发展能力: [], 
            技能: [],
            魔法: [],
            诅咒: [],
            装备: { ...startEquipment },
            状态: [],
            最大负重: 0
        },
        日志: [
            { id: 'Log_Intro', text: introText, sender: '旁白', timestamp: Date.now() + 100, turnIndex: 0 }
        ],
        游戏时间: "第1日 07:00",
        当前日期: "1000-01-01",
        当前地点: "巴别塔广场",
        当前楼层: 0,
        天气: "晴朗",
        
        世界坐标: startLoc,
        
        背包: initialInventory, 
        战利品: [], 
        公共战利品: [], 
        战利品背负者: name, 

        社交: [],
        
        地图: worldMap,

        世界: {
            异常指数: difficulty === Difficulty.HELL ? 40 : 10, 
            头条新闻: initialNews, 
            街头传闻: initialRumors,
            诸神神会: {
                下次神会开启时间: "第3日 20:00",
                神会主题: "升格者称号授予",
                讨论内容: [],
                最终结果: "待议"
            },
            NPC后台跟踪: initialNpcTracking,
            派阀格局: { S级: ["芙蕾雅眷族", "洛基眷族"], A级: [], B级至I级: [], 备注: "可根据剧情调整" },
            战争游戏: { 状态: "未开始", 参战眷族: [], 形式: "", 赌注: "", 举办时间: "", 结束时间: "", 结果: "", 备注: "" },
            下次更新: "第1日 12:00"
        },
        任务: initialTasks,
        技能: [],
        剧情: {
            对应原著对应章节: "第1卷 序章",
            对应章节名: "序章 - 抵达巴别塔",
            原著大概剧情走向: "原著此阶段为贝尔抵达欧拉丽，完成公会登记并寻找眷族，随后加入赫斯缇雅眷族，开始地下城生涯。",
            本世界分歧剧情: {
                说明: "以玩家为主角，原著事件仅作背景参考。",
                分点: ["主角非贝尔", "眷族归属未定", "贝尔线暂不进入"],
                归纳总结: ""
            },
            剧情规划: {
                规划长期剧情走向: "在欧拉丽站稳脚跟，建立或加入眷族，并被卷入怪物祭与城市大事件。",
                规划中期剧情走向: "完成登记→接触眷族→取得恩惠→进入地下城获取立足资源。",
                规划短期剧情走向: "完成公会登记并获取可接洽眷族的线索。"
            },
            待激活事件: [
                { 事件: "公会发布新人讲习会报名名单", 激活时间: "第2日 09:00", 激活条件: "时间到达并关注公会公告" },
                { 事件: "酒馆流出神会传闻与称号猜测", 激活时间: "第3日 19:00", 激活条件: "夜间在酒馆或街头停留" },
                { 事件: "怪物祭开幕与交通管制", 激活时间: "第12日 18:00", 激活条件: "时间到达或经过主干道" }
            ]
        },
        契约: [],
        眷族: { 名称: "无", 等级: "I", 主神: "None", 资金: 0, 声望: 50, 设施状态: {}, 仓库: [] },
        记忆: { lastLogIndex: 0, instant: [], shortTerm: [], mediumTerm: [], longTerm: [] },
        战斗: { 是否战斗中: false, 敌方: null, 战斗记录: [] },
        回合数: 1
    };
    state.角色.最大负重 = computeMaxCarry(state.角色);
    return state;
};

export const mapRawDataToGameState = (raw: RawGameData): GameState => {
   const data = raw as GameState;
   if (!data.眷族) {
       data.眷族 = { 名称: "无", 等级: "I", 主神: "None", 资金: 0, 声望: 0, 设施状态: {}, 仓库: [] };
   }
    if (data?.角色) {
        data.角色.最大负重 = computeMaxCarry(data.角色);
    }
   if (typeof (data.眷族 as any).声望 !== 'number') {
       const legacy = (data as any).世界?.眷族声望;
       if (typeof legacy === 'number') {
           data.眷族.声望 = legacy;
       } else if (typeof (data.眷族 as any).声望 !== 'number') {
           data.眷族.声望 = 0;
       }
   }
   return data;
};






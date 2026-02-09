
import { GameState, RawGameData, Screen, Difficulty, InventoryItem, BodyParts, Task } from "../types";
import type { NpcBackgroundTracking } from "../types/world";
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
    initialPackage: 'standard' | 'combat' | 'survival' | 'wealth' = 'standard',
    narrativePerspective?: 'first' | 'second' | 'third'
): GameState => {
    // 1. 种族映射与基础属性
    const raceNameMap: {[key:string]: string} = {
        'Human': '人类', 'Elf': '精灵', 'Dwarf': '矮人',
        'Pallum': '小人族', 'Amazon': '亚马逊', 'Beastman': '兽人'
    };
    const displayRace = raceNameMap[race] || race;
    const worldMap = generateDanMachiMap();

    // 2. 差异化开局配置 (Difficulty Config)
    let startValis = 0;
    let totalHp = 300;
    let initialInventory: InventoryItem[] = [];
    let initialTasks: Task[] = [];
    let initialNews: string[] = [];
    let initialRumors: { 主题: string; 广为人知日: string; 风波平息日: string }[] = [];
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
    let introLogs: string[] = [];
    const resolvePerspective = (value?: 'first' | 'second' | 'third'): 'first' | 'second' | 'third' => {
        if (value === 'first' || value === 'second' || value === 'third') return value;
        if (typeof localStorage === 'undefined') return 'third';
        try {
            const saved = localStorage.getItem('danmachi_settings');
            if (!saved) return 'third';
            const parsed = JSON.parse(saved);
            const p = parsed?.writingConfig?.narrativePerspective;
            if (p === 'first' || p === 'second' || p === 'third') return p;
        } catch {}
        return 'third';
    };
    const perspective = resolvePerspective(narrativePerspective);
    const selfRef = perspective === 'third' ? playerName : (perspective === 'first' ? '我' : '你');
    const selfPossessive = perspective === 'third' ? `${playerName}的` : (perspective === 'first' ? '我的' : '你的');

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
            标题: '自由选择眷族',
            描述: '目标：凭贵族推荐信向任意眷族提交加入申请。\n达成条件：完成任意眷族的入团手续（基于推荐信特权快速放行）。',
            状态: 'active',
            奖励: '神之恩惠 (Falna)',
            评级: 'C',
            接取时间: '第1日 07:10'
        });

        introLogs = [
            `${selfRef}推开“丰饶的女主人”的门，暖意与麦香混着炖汤的气息扑上来。木地板被脚步踩出细响，杯盏相碰的清脆声在大厅里回荡，壁炉的火光在酒渍斑驳的桌面上跳动。`,
            `吧台后，希儿把新擦好的杯子一字排开，笑意明亮却忙而不乱；琉在一旁核对账单，目光沉静而警惕。靠窗的冒险者低声交换情报，羽毛笔在羊皮纸上划过，像把城市的呼吸写进夜里。`,
            `${selfPossessive}行囊安稳地贴在椅背，装备整齐、刃口锋利，护甲扣带被仔细整理过，补给与地图各在其位。旅途的疲惫被热气渐渐拂开，掌心里那枚公会的推荐物件带来一种从容的起步感。`,
            `墙上的告示板贴着新人指引与近期动向，${selfPossessive}贵族推荐信在掌心带来额外的分量。凭这份特权，${selfRef}可以向任意眷族提交申请，手续与接洽将比常规流程更顺畅。门缝外传来街道的车轮声与人声浪潮，城市在等${selfRef}迈出下一步，而此刻只需确认要前往哪里。`,
            `靠窗的位置能看见石板路上来往的脚步与远处高塔的影子，阳光在玻璃上投下淡淡的纹路。${selfRef}有足够的余地去选择自己的第一步，不必急于做出仓促的决定。`,
            `一张临时张贴的委托单在风里轻轻摆动，纸角压着酒杯留下的水痕。大厅里的喧闹并不刺耳，反而像在为新的起点铺平路面。`
        ];

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

        introLogs = [
            `${selfRef}踏进“丰饶的女主人”，热气裹着麦香与烤肉味迎面而来。大厅里木桌紧挨着，杯盏相碰的声音此起彼伏，壁炉里的火光把人影拉长，给这座城市的清晨添了些松弛。`,
            `吧台后，希儿把菜单递给新来的客人，声音清亮而不急躁；琉在旁边安静地收拾酒具，动作利落，像在把每一处细节都锁回秩序。角落里有人压低声音谈起公会与地下城，话题在烟雾里飘散。`,
            `${selfPossessive}装备与补给属于标准新人的范围，护甲与武器都算可靠，但还谈不上奢侈。行囊不重不轻，足以应付一段短程行动，却仍需要谨慎规划每一次的消耗。`,
            `告示板上贴着登记流程与眷族接洽的指引，几张新张的纸边还带着浆糊的味道。门外的街道传来车轮碾过石板的声响，城市的步伐正等着${selfRef}走出下一步。`,
            `窗边的光落在木纹上，空气里有酒香与铁器的味道交织。${selfRef}可以先理清目标，再决定是去公会登记还是寻找眷族的门扉。`,
            `几名冒险者在角落里低声谈论上层的异常刷新，语速不快，却都带着谨慎。信息在桌与桌之间传递，像一条被反复确认的路线。`
        ];

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

        introLogs = [
            `${selfRef}推开“丰饶的女主人”的门，炉火带来的暖意并不能驱散肩上的沉重。酒馆里人声嘈杂，却多是短句与低语，像每个人都在计算下一步该做什么。`,
            `希儿在吧台忙着招呼客人，笑容里带着职业性的明亮；琉把酒桶抬上架，目光扫过大厅，仿佛在为一切突发做好准备。角落里有人翻看破旧的地图，指尖在褶皱上停留很久。`,
            `${selfPossessive}护具简陋，旧刀挂在腰侧，刃口不够锋利却仍能使用。行囊里补给稀薄，法利紧张，任何一次错误选择都会拖慢${selfRef}在欧拉丽站稳脚跟的速度。`,
            `告示板上写着公会的注意事项与近期风险，纸张的边缘被反复撕扯。门外的街道传来嘈杂的脚步声与铁器摩擦声，城市的压力从门缝里一点点涌进来。`,
            `${selfRef}把目光从人群移开，留意到桌面上的旧痕与被反复划过的木纹。先稳住眼前的资源，再决定要去哪里探路，这一步会影响接下来的一切。`,
            `墙角的油灯偶尔轻轻摇晃，影子在桌脚间拉长又缩短。周围的谈话没有多余的寒暄，像把“选择”摆在每个人面前。`
        ];

    } else if (difficulty === Difficulty.HELL) {
        // Hell: 近乎赤贫，设备损坏
        startValis = 0;
        totalHp = 320; // 优化开局状态：满血
        startMind = 60; // 优化开局状态：满精神
        maxMind = 60;

        initialInventory = [
            { id: 'Eq_Wpn_X', 名称: '铁制短剑', 描述: '常见的短剑，刃口规整。', 数量: 1, 类型: 'weapon', 武器: { 类型: '短剑', 伤害类型: '突刺', 射程: '近战', 攻速: '快', 双手: false }, 已装备: true, 装备槽位: '主手', 攻击力: 5, 品质: 'Common', 耐久: 40, 最大耐久: 40, 价值: 2000, 重量: 0.8 },
            { id: 'Eq_Arm_X', 名称: '旧皮甲', 描述: '普通皮甲，缝合结实。', 数量: 1, 类型: 'armor', 防具: { 类型: '轻甲', 部位: '身体', 护甲等级: '轻' }, 已装备: true, 装备槽位: '身体', 防御力: 2, 品质: 'Common', 耐久: 35, 最大耐久: 35, 价值: 1500, 重量: 1.2 },
            { id: 'Eq_Glv_X', 名称: '布护手', 描述: '粗布缝制的护手。', 数量: 1, 类型: 'armor', 防具: { 类型: '布甲', 部位: '手部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '手部', 防御力: 1, 品质: 'Common', 耐久: 25, 最大耐久: 25, 价值: 300, 重量: 0.2 },
            { id: 'Eq_Leg_X', 名称: '粗布长裤', 描述: '结实耐磨的粗布长裤。', 数量: 1, 类型: 'armor', 防具: { 类型: '布甲', 部位: '腿部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '腿部', 防御力: 1, 品质: 'Common', 耐久: 25, 最大耐久: 25, 价值: 300, 重量: 0.5 },
            { id: 'Eq_Boot_X', 名称: '旧皮靴', 描述: '行走多年的旧皮靴，仍能支撑长途。', 数量: 1, 类型: 'armor', 防具: { 类型: '轻甲', 部位: '足部', 护甲等级: '轻' }, 已装备: true, 装备槽位: '足部', 防御力: 1, 品质: 'Common', 耐久: 28, 最大耐久: 28, 价值: 400, 重量: 0.6 },
            { id: 'Itm_Pot_S', 名称: '低级回复药', 描述: '基础的红色药水。', 数量: 1, 类型: 'consumable', 恢复量: 50, 品质: 'Common', 价值: 600 }
        ];

        startEquipment = {
            头部: '', 身体: '旧皮甲', 手部: '布护手', 腿部: '粗布长裤', 足部: '旧皮靴',
            主手: '铁制短剑', 副手: '', 饰品1: '', 饰品2: '', 饰品3: ''
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

        introLogs = [
            `${selfRef}踏入“丰饶的女主人”，门被合上时，外面的冷风被暂时隔在街道。酒馆里暖意并不奢侈，却足以让人回想起城市依旧在转动的事实。`,
            `吧台处的灯光把杯沿映得发亮，希儿忙着穿行于桌与桌之间；琉的身影在火光里沉稳而清晰，像一根稳住场面的钉子。冒险者们低声交换消息，偶尔抬眼评估新面孔。`,
            `${selfPossessive}装备是普通而完整的一套，护甲扣带齐全，武器也尚可依靠，虽然没有多余的选择，但至少不存在破损的隐患。行囊里空隙很多，补给稀少，起步显得格外艰难。`,
            `告示板上贴着新人登记与地下城提醒，纸上墨迹还很新。门缝透进街道的喧嚣，像在催促${selfRef}尽快作出选择，但此刻仍能先确认下一步的方向。`,
            `靠墙的座位空着，木椅有些硬，却能给${selfRef}一个短暂的停靠。${selfRef}需要在这里整理思路，决定是立刻离开还是先探听能救命的线索。`,
            `酒馆的门帘被人掀起又放下，冷风夹着尘土味短暂地扫过桌面。短促的喧哗过后，空气里只剩下杯底碰桌的轻响。`
        ];
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
    
    // 增加通用传闻（传播倒计时）
    initialRumors.push({ 主题: "听说洛基眷族正在筹备一次大规模远征。", 广为人知日: "第3日", 风波平息日: "第7日" });
    initialRumors.push({ 主题: "东区的贫民窟里住着一位贫穷女神。", 广为人知日: "第4日", 风波平息日: "第8日" });
    initialRumors.push({ 主题: "芙蕾雅眷族最近频繁在酒馆露面。", 广为人知日: "第5日", 风波平息日: "第9日" });
        

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

    const initialNpcTracking: NpcBackgroundTracking[] = [
        {
            NPC: '希儿',
            当前行动: '在后厨备料，准备午间菜单。',
            地点: '丰饶的女主人',
            位置: '后厨备餐区',
            计划阶段: ['备料', '出餐', '打烊整理'],
            当前阶段: 0,
            阶段结束时间: '第1日 09:00',
            进度: '备料中',
            预计完成: '第1日 23:00'
        },
        {
            NPC: '艾伊娜',
            当前行动: '整理委托告示，核对新人登记。',
            地点: '公会本部',
            位置: '公会接待与公告区',
            计划阶段: ['整理公告', '接待新人', '汇总报告'],
            当前阶段: 0,
            阶段结束时间: '第1日 08:30',
            进度: '整理中',
            预计完成: '第1日 18:00'
        },
        {
            NPC: '赫斯缇雅',
            当前行动: '清理教堂内的杂物，准备迎接新的眷属。',
            地点: '废弃教堂',
            位置: '礼拜堂主厅',
            计划阶段: ['清理', '修补', '准备迎接'],
            当前阶段: 0,
            阶段结束时间: '第1日 10:00',
            进度: '清理中',
            预计完成: '第1日 20:00'
        },
        {
            NPC: '赫菲斯托丝',
            当前行动: '检查订单进度，安排工匠轮班。',
            地点: '赫菲斯托丝眷族工房',
            位置: '工房主作业区',
            计划阶段: ['检查订单', '安排轮班', '验收成品'],
            当前阶段: 0,
            阶段结束时间: '第1日 11:00',
            进度: '检视中',
            预计完成: '第1日 19:00'
        },
        {
            NPC: '琉',
            当前行动: '在大厅巡查动线，维持酒馆秩序并留意可疑人员。',
            地点: '丰饶的女主人',
            位置: '大厅与吧台之间',
            计划阶段: ['巡场观察', '处理突发冲突', '整理当班记录'],
            当前阶段: 0,
            阶段结束时间: '第1日 09:30',
            进度: '巡场中',
            预计完成: '第1日 22:30'
        },
        {
            NPC: '赫尔墨斯',
            当前行动: '在市中心收集各眷族近期动向与委托风向情报。',
            地点: '欧拉丽中央广场',
            位置: '情报贩子聚集区',
            计划阶段: ['接触线人', '交叉验证', '回传情报'],
            当前阶段: 0,
            阶段结束时间: '第1日 10:30',
            进度: '采集中',
            预计完成: '第1日 18:30'
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
        日志: introLogs.map((text, index) => ({
            id: `Log_Intro_${index + 1}`,
            text,
            sender: '旁白',
            timestamp: Date.now() + 100 + index,
            turnIndex: 0
        })),
        游戏时间: "第1日 07:00",
        当前日期: "1000-01-01",
        当前地点: "丰饶的女主人",
        当前楼层: 0,
        天气: "晴朗",
        
        背包: initialInventory, 
        公共战利品: [], 

        社交: [],
        
        地图: worldMap,

        世界: {
            地下城异常指数: difficulty === Difficulty.HELL ? 40 : 10, 
            公会官方通告: initialNews, 
            街头传闻: initialRumors,
            NPC后台跟踪: initialNpcTracking,
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






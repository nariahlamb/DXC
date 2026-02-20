export const GAME_SCHEMA_DOCS = [
    {
        title: "1. 全局状态 (Global)",
        path: "gameState",
        desc: "全局环境与元数据。",
        structure: {
            "当前界面": "Screen (HOME/CHAR_CREATION/GAME/SETTINGS)",
            "游戏难度": "Difficulty (Easy/Normal/Hard/Hell)",
            "处理中": "Boolean",
            "回合数": "Number",
            "游戏时间": "String ('第X日 HH:MM')",
            "当前日期": "String ('1000-01-01')",
            "当前地点": "String (中文地名)",
            "当前楼层": "Number (0=地表)",
            "天气": "String",
            "世界坐标": { "x": "Number", "y": "Number" },
            "historyArchive": "Array<LogEntry>?"
        }
    },
    {
        title: "2. 日志 (Logs)",
        path: "gameState.日志",
        desc: "剧情与对话历史。",
        structure: "Array<LogEntry>",
        itemStructure: {
            "id": "String",
            "text": "String",
            "sender": "String",
            "timestamp": "Number",
            "turnIndex": "Number?",
            "thinking": "String?",
            "rawResponse": "String?",
            "snapshot": "String?",
            "isRaw": "Boolean?",
            "responseId": "String?",
            "repairNote": "String?",
            "gameTime": "String?",
            "tags": "String[]?"
        }
    },
    {
        title: "3. 角色核心 (Character)",
        path: "gameState.角色",
        desc: "玩家属性与状态。",
        structure: {
            "姓名": "String",
            "称号": "String",
            "种族": "String",
            "所属眷族": "String",
            "等级": "Number",
            "性别": "String",
            "年龄": "Number",
            "生日": "String",
            "头像": "String",
            "外貌": "String",
            "背景": "String",
            "生命值": "Number",
            "最大生命值": "Number",
            "精神力": "Number",
            "最大精神力": "Number",
            "体力": "Number",
            "最大体力": "Number",
            "疲劳度": "Number",
            "最大负重": "Number",
            "公会评级": "String",
            "魔法栏位": "{上限, 已使用, 扩展来源[]}",
            "生存状态": { "饱腹度": "Number", "最大饱腹度": "Number", "水分": "Number", "最大水分": "Number" },
            "身体部位": { "头部": "{当前/最大}", "胸部": "{当前/最大}", "腹部": "{当前/最大}", "左臂": "{当前/最大}", "右臂": "{当前/最大}", "左腿": "{当前/最大}", "右腿": "{当前/最大}" },
            "能力值": { "力量": "Number", "耐久": "Number", "灵巧": "Number", "敏捷": "Number", "魔力": "Number" },
            "隐藏基础能力": { "力量": "Number", "耐久": "Number", "灵巧": "Number", "敏捷": "Number", "魔力": "Number" },
            "经验值": "Number",
            "伟业": "Number",
            "升级所需伟业": "Number",
            "法利": "Number",
            "发展能力": "Array<{名称, 等级, 类型, 描述, 效果, 解锁条件, 备注}>",
            "技能": "Array<{id, 名称, 类别, 描述, 效果, 触发, 持续, 冷却, 消耗, 范围, 命中, 适用, 等级, 关联发展能力, 限制, 标签, 稀有, 备注}>",
            "魔法": "Array<{id, 名称, 咏唱, 类别, 属性, 描述, 效果, 范围, 射程, 冷却, 消耗, 施放条件, 标签, 稀有, 备注}>",
            "诅咒": "Array<{名称, 类型, 效果, 持续时间}>",
            "状态": "Array<{名称, 类型, 效果, 持续时间}>",
            "装备": { "主手": "String", "副手": "String", "头部": "String", "身体": "String", "手部": "String", "腿部": "String", "足部": "String", "饰品1": "String", "饰品2": "String", "饰品3": "String" }
        }
    },
    {
        title: "4. 背包 (Inventory)",
        path: "gameState.背包",
        desc: "物品列表。",
        structure: "Array<InventoryItem>",
        itemStructure: {
            "id": "String",
            "名称": "String",
            "描述": "String",
            "数量": "Number",
            "类型": "consumable | weapon | armor | material | key_item | loot | 消耗品 | 武器 | 防具 | 饰品 | 材料 | 关键物品 | 战利品 | 掉落",
            "获取途径": "dungeon | public",
            "品质": "Broken/Common/Rare/Epic/Legendary/破损/普通/精良/稀有/史诗/传说/神话",
            "标签": "String[] | String",
            "来源": "String?",
            "制作者": "String?",
            "材质": "String?",
            "堆叠上限": "Number?",
            "是否绑定": "Boolean?",
            "已装备": "Boolean",
            "装备槽位": "String",
            "攻击力": "Number?",
            "防御力": "Number?",
            "恢复量": "Number?",
            "耐久": "Number?",
            "最大耐久": "Number?",
            "效果": "String?",
            "攻击特效": "String?",
            "防御特效": "String?",
            "附加属性": "Array<{名称, 数值}>",
            "价值": "Number?",
            "重量": "Number?",
            "等级需求": "Number?",
            "武器": "{类型, 伤害类型, 射程, 攻速, 双手, 特性}",
            "防具": "{类型, 部位, 护甲等级, 抗性}",
            "消耗": "{类别, 持续, 冷却, 副作用}",
            "材料": "{来源, 用途, 处理}",
            "魔剑": "{魔法名称, 属性, 威力, 触发方式, 冷却, 剩余次数, 最大次数, 破损率, 过载惩罚, 备注}"
        }
    },
    {
        title: "5. 战利品 (Loot)",
        path: "gameState.战利品 / gameState.公共战利品",
        desc: "已归档与临时战利品。",
        structure: {
            "战利品": "Array<InventoryItem>",
            "公共战利品": "Array<InventoryItem>",
            "战利品背负者": "String"
        }
    },
    {
        title: "6. 社交 (Social)",
        path: "gameState.社交",
        desc: "NPC 关系与状态。",
        structure: "Array<Confidant>",
        itemStructure: {
            "id": "String",
            "姓名": "String",
            "称号": "String",
            "种族": "String",
            "眷族": "String",
            "身份": "String",
            "等级": "Number",
            "好感度": "Number",
            "关系状态": "String",
            "是否在场": "Boolean",
            "是否队友": "Boolean",
            "已交换联系方式": "Boolean",
            "特别关注": "Boolean",
            "强制包含上下文": "Boolean",
            "位置详情": "String",
            "坐标": "{x, y}",
            "记忆": "Array<{内容, 时间戳}>",
            "简介": "String",
            "外貌": "String",
            "性格": "String",
            "背景": "String",
            "头像": "String",
            "排除提示词": "Boolean",
            "已知能力": "String",
            "生存数值": "{当前生命/最大生命/当前精神/最大精神/当前体力/最大体力}",
            "能力值": "{力量/耐久/灵巧/敏捷/魔力}",
            "装备": "{主手/副手/身体/头部/腿部/足部/饰品}",
            "背包": "Array<InventoryItem>"
        }
    },
    {
        title: "7. 战斗 (Combat)",
        path: "gameState.战斗",
        desc: "实时战斗状态。",
        structure: {
            "是否战斗中": "Boolean",
            "敌方": "Array<Enemy> | null",
            "战斗记录": "String[]",
            "上一次行动": "String?"
        },
        itemStructure: {
            "敌对目标": {
                "名称": "String",
                "最大生命值": "Number",
                "当前生命值": "Number",
                "攻击力": "Number",
                "最大精神MP": "Number",
                "当前精神MP": "Number",
                "技能": "String[]",
                "描述": "String",
                "等级": "Number?",
                "图片": "String?"
            }
        }
    },
    {
        title: "8. 任务 (Tasks)",
        path: "gameState.任务",
        desc: "任务列表与进度。",
        structure: "Array<Task>",
        itemStructure: {
            "id": "String",
            "标题": "String",
            "描述": "String",
            "状态": "active/completed/failed",
            "奖励": "String",
            "评级": "E-S",
            "接取时间": "String",
            "结束时间": "String?",
            "截止时间": "String?",
            "日志": "Array<{时间戳, 内容}>"
        }
    },
    {
        title: "9. 世界动态 (World)",
        path: "gameState.世界",
        desc: "公会与都市动态。",
        structure: {
            "异常指数": "Number",
            "头条新闻": "Array<{id, 标题, 内容?, 时间戳, 来源, 重要度, 关联传闻?}>",
            "街头传闻": "Array<{id, 主题, 内容, 传播度, 可信度, 来源?, 话题标签?, 发现时间?, 评论数?, 已升级为新闻?}>",
            "诸神神会": "{下次神会开启时间, 神会主题, 讨论内容[{角色, 对话}], 最终结果}",
            "NPC后台跟踪": "Array<{NPC, 当前行动, 位置?, 进度?, 预计完成?}>",
            "派阀格局": "{S级[], A级[], B级至I级[], 备注?}",
            "战争游戏": "{状态, 参战眷族[], 形式, 赌注, 举办时间, 结束时间, 结果, 备注}",
            "下次更新回合": "Number"
        }
    },
    {
        title: "10. 地图 (Map)",
        path: "gameState.地图",
        desc: "地表与地下层地图数据。",
        structure: {
            "config": "{width, height}",
            "factions": "Array<{id, name, color, borderColor, textColor, description, strength}>",
            "territories": "Array<{id, factionId, name, centerX, centerY, color, floor, shape?, sector?, points?, boundary?}>",
            "terrain": "Array<{id, type, name, path, color, strokeColor, strokeWidth, floor}>",
            "routes": "Array<{id, name, path, type, width, color, floor}>",
            "surfaceLocations": "Array<{id, name, type, coordinates, radius, description, icon, floor}>",
            "dungeonStructure": "Array<{floorStart, floorEnd, name, description, dangerLevel, landmarks}>",
            "macroLocations": "Array<{id, name, type?, coordinates, area, size?, buildings?, layout?, description?, floor?}>",
            "midLocations": "Array<{id, name, parentId, coordinates, area?, size?, buildings?, layout?, mapStructure?, description?, floor?}>"
        }
    },
    {
        title: "11. 手机系统 (Phone)",
        path: "gameState.手机",
        desc: "聊天、朋友圈与公共论坛。",
        structure: {
            "设备": "{电量, 当前信号, 状态}",
            "联系人": "{好友[], 黑名单[], 最近[]}",
            "对话": "{私聊[], 群聊[], 公共频道[]}",
            "朋友圈": "{仅好友可见, 帖子[]}",
            "公共帖子": "{板块[], 帖子[]}",
            "待发送": "Array<PhonePendingMessage>?"
        }
    },
    {
        title: "12. 剧情与契约 (Story & Contract)",
        path: "gameState.剧情 / gameState.契约",
        desc: "剧情推进与契约。",
        structure: {
            "剧情": {
                "主线": "{当前卷数, 当前篇章, 当前阶段, 关键节点, 节点状态}",
                "引导": "{当前目标, 下一触发, 行动提示}",
                "时间轴": "{预定日期, 下一关键时间?}",
                "路线": "{是否正史, 偏移度, 分歧说明?}",
                "待触发": "Array<{预计触发, 内容, 类型?, 触发条件?, 重要度?, 状态?}> (最多3条)",
                "里程碑": "Array<{时间, 事件, 影响?}>",
                "备注": "String?"
            },
            "契约": "Array<{id, 名称, 描述, 状态, 条款}>"
        }
    },
    {
        title: "13. 眷族 (Familia)",
        path: "gameState.眷族",
        desc: "眷族资产与状态。",
        structure: {
            "名称": "String",
            "等级": "String",
            "主神": "String",
            "资金": "Number",
            "声望": "Number",
            "设施状态": "Object",
            "仓库": "Array<InventoryItem>"
        }
    },
    {
        title: "14. 技能池 (Skill Pool)",
        path: "gameState.技能",
        desc: "可用技能池。",
        structure: "Array<Skill>"
    },
    {
        title: "15. 记忆系统 (Memory)",
        path: "gameState.记忆",
        desc: "表格记忆游标元数据（事实内容写入 LOG_Summary/LOG_Outline）。",
        structure: {
            "lastLogIndex": "Number"
        }
    },
    {
        title: "16. 遭遇 (Encounters)",
        path: "gameState.遭遇",
        desc: "战斗与事件遭遇管理 (TavernDB扩展)。",
        structure: "Array<EncounterRow>?",
        itemStructure: {
            "id": "String (Enc_...)",
            "名称": "String",
            "类型": "'战斗'|'事件'|'对话'|'陷阱'|'宝箱'|'其他'",
            "状态": "'未触发'|'进行中'|'已完成'",
            "描述": "String?",
            "参与者": "String[]?",
            "位置": "{x: Number, y: Number}?",
            "触发条件": "String?"
        }
    },
    {
        title: "18. 战斗地图 (Battle Map)",
        path: "gameState.战斗.地图",
        desc: "战斗网格单元 (TavernDB扩展，1格=5尺)。",
        structure: "Array<BattleMapRow>?",
        itemStructure: {
            "UNIT_ID": "String (唯一标识符)",
            "名称": "String",
            "类型": "'玩家'|'敌人'|'友方'|'障碍物'|'地形'|'其他'",
            "位置": "{x: Number, y: Number}",
            "状态": "'正常'|'倒地'|'死亡'|'隐身'|'其他'",
            "生命值": "{当前: Number, 最大: Number}?",
            "图标": "String?",
            "描述": "String?"
        }
    },
    {
        title: "19. 地图视觉 (Map Visuals)",
        path: "gameState.战斗.视觉",
        desc: "战斗地图视觉信息 (TavernDB扩展)。",
        structure: "MapVisuals?",
        itemStructure: {
            "地图尺寸": "{宽度: Number, 高度: Number}",
            "地形描述": "String?",
            "特殊区域": "Array<{名称, 位置, 范围?, 效果?}>?",
            "光照": "'明亮'|'昏暗'|'黑暗'|'其他'?",
            "天气": "String?"
        }
    },
    {
        title: "20. 骰池 (Dice Pool)",
        path: "gameState.骰池",
        desc: "随机骰子结果池 (TavernDB扩展)。",
        structure: "Array<DiceRow>?",
        itemStructure: {
            "id": "String (Die_...)",
            "类型": "'d4'|'d6'|'d8'|'d10'|'d12'|'d20'|'d100'|'其他'",
            "数值": "Number",
            "用途": "String?",
            "时间戳": "String?",
            "已使用": "Boolean"
        }
    },
    {
        title: "21. 可选行动列表 (Action Options)",
        path: "gameState.可选行动列表",
        desc: "当前可选行动 (TavernDB扩展，需启用设置)。",
        structure: "Array<ActionOption>?",
        itemStructure: {
            "id": "String (Act_...)",
            "名称": "String",
            "描述": "String",
            "类型": "'攻击'|'移动'|'技能'|'魔法'|'物品'|'互动'|'其他'",
            "消耗": "{体力?, 精神?, 法利?, 物品?}?",
            "效果": "String?",
            "条件": "String?",
            "优先级": "Number?"
        }
    },
    {
        title: "22. 日志摘要 (Log Summaries)",
        path: "gameState.日志摘要",
        desc: "回合摘要记录 (TavernDB扩展)。",
        structure: "Array<LogSummary>?",
        itemStructure: {
            "回合": "Number",
            "时间": "String",
            "摘要": "String",
            "编码索引": "String? (AMxxxx)",
            "时间跨度": "String?",
            "地点": "String?",
            "纪要": "String?",
            "重要对话": "String?",
            "关键事件": "String[]?"
        }
    },
    {
        title: "23. 日志大纲 (Log Outlines)",
        path: "gameState.日志大纲",
        desc: "章节大纲记录 (TavernDB扩展)。",
        structure: "Array<LogOutline>?",
        itemStructure: {
            "章节": "String",
            "标题": "String",
            "开始回合": "Number",
            "结束回合": "Number?",
            "编码索引": "String? (AMxxxx)",
            "时间跨度": "String?",
            "大纲": "String?",
            "事件列表": "String[]"
        }
    },
    {
        title: "24. 经济流水 (Economic Ledger)",
        path: "gameState.经济流水",
        desc: "资金变更追溯记录 (TavernDB扩展)。",
        structure: "Array<EconomicLedgerEntry>?",
        itemStructure: {
            "id": "String",
            "turn": "Number",
            "timestamp": "String",
            "account": "'角色.法利' | '眷族.资金'",
            "before": "Number",
            "delta": "Number",
            "after": "Number",
            "reason": "String",
            "commandRef": "String?"
        }
    },
    {
        title: "25. 全局状态扩展 (Global State Extensions)",
        path: "gameState (TavernDB扩展字段)",
        desc: "全局状态的TavernDB扩展字段，用于时间推进和场景描述。",
        structure: {
            "场景描述": "String? (环境描述)",
            "上轮时间": "String? (YYYY-MM-DD HH:MM)",
            "流逝时长": "String? (如'2小时30分钟')",
            "战斗模式": "'非战斗'|'战斗中'|'战斗结束'?",
            "系统通知": "String?"
        }
    },
    {
        title: "26. NPC扩展字段 (NPC Extensions)",
        path: "gameState.社交[i] (TavernDB扩展字段)",
        desc: "NPC的TavernDB扩展字段，用于状态和位置追踪。",
        structure: {
            "当前状态": "'在场'|'离场'|'死亡'|'失踪'?",
            "所在位置": "String? (场景名)",
            "与主角关系": "String? (关系描述)",
            "职业身份": "String?",
            "种族性别年龄": "String?",
            "关键经历": "String?"
        }
    },
    {
        title: "27. 物品扩展字段 (Item Extensions)",
        path: "gameState.背包[i] (TavernDB扩展字段)",
        desc: "物品的TavernDB扩展字段，补充DND5E风格属性。",
        structure: {
            "所属人": "String? (持有者姓名)",
            "伤害": "String? (武器伤害骰, 如'1d8+3')",
            "特性": "String? (物品特性, 如'轻型, 灵巧')",
            "价值单位": "String? (如'gp', 'sp', 'cp')"
        }
    }
];



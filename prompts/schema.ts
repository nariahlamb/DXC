export const P_DATA_STRUCT = `<数据结构定义>
# 【数据结构定义】DanMachi SaveData (V3.1 Chinese Native)

> 本文档定义了游戏状态树的**完整**结构。AI 在生成 \`tavern_commands\` 时必须**严格遵守**此路径和字段定义。
> 所有的 Key 必须使用**中文**。禁止删除、精简或臆造字段。

## 1. 全局环境与元数据 (gameState)
- \`gameState.游戏难度\`: Difficulty ("Easy" | "Normal" | "Hard" | "Hell")
- \`gameState.回合数\`: Number
- \`gameState.游戏时间\`: String (格式 "第X日 HH:MM")
- \`gameState.当前日期\`: String ("1000-01-01")
- \`gameState.当前地点\`: String (中文地名，如 "欧拉丽南大街")
- \`gameState.当前楼层\`: Number (0=地表, 1+=地下层数)
- \`gameState.天气\`: String ("晴朗", "小雨" 等)

## 2. 玩家状态核心 (gameState.角色)
**基础信息**
- \`gameState.角色.姓名\`: String
- \`gameState.角色.称号\`: String
- \`gameState.角色.种族\`: String ("人类", "精灵", "矮人", "小人族", "亚马逊", "兽人")
- \`gameState.角色.所属眷族\`: String
- \`gameState.角色.等级\`: Number (Level)
- \`gameState.角色.外貌\`: String
- \`gameState.角色.背景\`: String
- \`gameState.角色.性别\`: String ("男性" / "女性")
- \`gameState.角色.年龄\`: Number
- \`gameState.角色.生日\`: String ("MM-DD")

**核心数值 (Vitals)**
- \`gameState.角色.生命值\`: Number (当前 HP 普通及以上难度不启用)
- \`gameState.角色.最大生命值\`: Number(普通及以上难度不启用)
- \`gameState.角色.精神力\`: Number (当前 MP/Mind)
- \`gameState.角色.最大精神力\`: Number
- \`gameState.角色.体力\`: Number (当前 Stamina)
- \`gameState.角色.最大体力\`: Number

**生存状态 (Survival)**
- \`gameState.角色.生存状态.饱腹度\`: Number (0-100)
- \`gameState.角色.生存状态.最大饱腹度\`: Number
- \`gameState.角色.生存状态.水分\`: Number (0-100)
- \`gameState.角色.生存状态.最大水分\`: Number

**身体部位 (Body Parts)**普通及以上难度启用
*每个部位包含 { "当前": Number, "最大": Number }*
- \`gameState.角色.身体部位.头部\`
- \`gameState.角色.身体部位.胸部\`
- \`gameState.角色.身体部位.腹部\`
- \`gameState.角色.身体部位.左臂\`
- \`gameState.角色.身体部位.右臂\`
- \`gameState.角色.身体部位.左腿\`
- \`gameState.角色.身体部位.右腿\`

**恩惠能力值 (Falna Stats)**
*范围 0-999+*
- \`gameState.角色.能力值.力量\` (STR)
- \`gameState.角色.能力值.耐久\` (END)
- \`gameState.角色.能力值.灵巧\` (DEX)
- \`gameState.角色.能力值.敏捷\` (AGI)
- \`gameState.角色.能力值.魔力\` (MAG)
**隐藏基础能力 (Hidden Base)**
- \`gameState.角色.隐藏基础能力.力量\`
- \`gameState.角色.隐藏基础能力.耐久\`
- \`gameState.角色.隐藏基础能力.灵巧\`
- \`gameState.角色.隐藏基础能力.敏捷\`
- \`gameState.角色.隐藏基础能力.魔力\`

**资源与成长**
- \`gameState.角色.经验值\`: Number (Excelia)
- \`gameState.角色.法利\`: Number (金钱)
- \`gameState.角色.伟业\`: Number (Feats)
- \`gameState.角色.升级所需伟业\`: Number
- \`gameState.角色.疲劳度\`: Number (0-100)
- \`gameState.角色.最大负重\`: Number (kg)
- \`gameState.角色.公会评级\`: String ("I" 到 "S")

**技能与魔法**
- \`gameState.角色.魔法栏位.上限\`: Number
- \`gameState.角色.魔法栏位.已使用\`: Number
- \`gameState.角色.魔法栏位.扩展来源\`: String[]
- \`gameState.角色.发展能力\`: Array<{ "名称", "等级", "类型", "描述", "效果", "解锁条件", "备注" }>
- \`gameState.角色.技能\`: Array<{ "id", "名称", "类别", "描述", "效果", "触发", "持续", "冷却", "消耗", "范围", "命中", "适用", "等级", "关联发展能力", "限制", "标签", "稀有"(Bool), "备注" }>
- \`gameState.角色.魔法\`: Array<{ "id", "名称", "咏唱", "类别", "属性", "描述", "效果", "范围", "射程", "冷却", "消耗", "施放条件", "标签", "稀有"(Bool), "备注" }>
- \`gameState.角色.状态\`: Array<{ "名称", "类型": "Buff" | "DeBuff", "效果", "结束时间" }>
- \`gameState.角色.诅咒\`: Array<{ "名称", "类型": "Buff" | "DeBuff", "效果", "结束时间" }>

**装备栏 (Equipment)**
*值为物品名称字符串*
- \`gameState.角色.装备.主手\`
- \`gameState.角色.装备.副手\`
- \`gameState.角色.装备.头部\`
- \`gameState.角色.装备.身体\`
- \`gameState.角色.装备.手部\`
- \`gameState.角色.装备.腿部\`
- \`gameState.角色.装备.足部\`
- \`gameState.角色.装备.饰品1\`
- \`gameState.角色.装备.饰品2\`
- \`gameState.角色.装备.饰品3\`

## 3. 背包系统 (gameState.背包)
*Array<InventoryItem>*
- \`id\`: String (唯一ID "Itm_...")
- \`名称\`: String
- \`描述\`: String
- \`数量\`: Number
- \`类型\`: String ("consumable" | "weapon" | "armor" | "material" | "key_item" | "loot" | "消耗品" | "武器" | "防具" | "材料" | "关键物品" | "战利品")
- \`获取途径\`: String ("dungeon" | "public")
- \`品质\`: String ("Broken" | "Common" | "Rare" | "Epic" | "Legendary" | "破损" | "普通" | "精良" | "稀有" | "史诗" | "传说" | "神话")
- \`标签\`: String[] | String
- \`来源\`: String
- \`制作者\`: String
- \`材质\`: String
- \`堆叠上限\`: Number
- \`是否绑定\`: Boolean
- \`已装备\`: Boolean
- \`装备槽位\`: String (可选, 如 "主手")
- \`攻击力\`: Number (可选)
- \`防御力\`: Number (可选)
- \`耐久\`: Number (可选)
- \`最大耐久\`: Number (可选)
- \`恢复量\`: Number (可选)
- \`价值\`: Number (单价)
- \`效果\`: String (特殊效果描述)
- \`攻击特效\`: String
- \`防御特效\`: String
- \`附加属性\`: Array<{ "名称": String, "数值": String }>
- \`重量\`: Number (可选)
- \`等级需求\`: Number (可选)
- \`武器\`: { "类型", "伤害类型", "射程", "攻速", "双手", "特性" }
- \`防具\`: { "类型", "部位", "护甲等级", "抗性" }
- \`消耗\`: { "类别", "持续", "冷却", "副作用" }
- \`材料\`: { "来源", "用途", "处理" }
- \`魔剑\`: { "魔法名称", "属性", "威力", "触发方式", "冷却", "剩余次数", "最大次数", "破损率", "过载惩罚", "备注" }

## 4. 公共战利品 (gameState.公共战利品)
- \`gameState.公共战利品\`: Array<InventoryItem> (探索中的临时战利品)
- 说明: 公共战利品 = 地下城临时/已拾取但未分配；未明确分配前不进入背包。

## 5. 社交系统 (gameState.社交)
*Array<Confidant>*
- \`id\`: String ("Char_...")
- \`姓名\`: String
- \`称号\`: String
- \`种族\`: String
- \`年龄\`: Number
- \`性别\`: String
- \`身份\`: String
- \`眷族\`: String
- \`等级\`: Number
- \`好感度\`: Number
- \`关系状态\`: String ("陌生" | "认识" | "友善" | "信任" | "敌对")
- \`是否在场\`: Boolean
- \`是否队友\`: Boolean
- \`特别关注\`: Boolean
- \`记忆\`: Array<{ "内容": String, "时间戳": String }>
- \`档案\`: String
- 档案需覆盖「身份定位/外貌要点/性格特征/背景经历/与玩家关系或当前状态」。
- 当 \`特别关注=true\` 时必须补全 \`档案\` 内容。
- \`已知能力\`: String
- **队友/敌对数据** (仅战斗相关NPC拥有):
  - \`生存数值\`: { "当前生命", "最大生命", "当前精神", "最大精神", "当前体力", "最大体力" }
  - \`能力值\`: { "力量", "耐久", "灵巧", "敏捷", "魔力" }
  - \`隐藏基础能力\`: { "力量", "耐久", "灵巧", "敏捷", "魔力" }
  - \`装备\`: { "主手", "副手", "身体", "头部", "腿部", "足部", "饰品" }
  - \`背包\`: Array<InventoryItem>

## 6. 战斗系统 (gameState.战斗)
- \`gameState.战斗.是否战斗中\`: Boolean
- \`gameState.战斗.敌方\`: Array<敌对目标> | null
- \`gameState.战斗.战斗记录\`: String[] (最近的战斗日志)
- \`gameState.战斗.上一次行动\`: String (可选)

**敌对目标结构 (Enemy Target)**
- \`名称\`: String
- \`最大生命值\`: Number
- \`当前生命值\`: Number
- \`攻击力\`: Number
- \`最大精神MP\`: Number
- \`当前精神MP\`: Number
- \`技能\`: String[]
- \`描述\`: String
- \`等级\`: Number

## 7. 任务系统 (gameState.任务)
*Array<Task>*
- \`id\`: String ("Tsk_...")
- \`标题\`: String
- \`描述\`: String
- \`状态\`: String ("active" | "completed" | "failed")
- \`奖励\`: String
- \`评级\`: String ("E"-"SSS")
- \`接取时间\`: String
- \`结束时间\`: String
- \`截止时间\`: String
- \`日志\`: Array<{ "时间戳": String, "内容": String }>

## 9. 世界动态 (gameState.世界)
- \`gameState.世界.地下城异常指数\`: Number (0-100)
- \`gameState.世界.公会官方通告\`: String[]
- \`gameState.世界.街头传闻\`: Array<{ "主题": String, "广为人知日": String, "风波平息日": String }>
- \`gameState.世界.NPC后台跟踪\`: Array<{ "NPC": String, "当前行动": String, "地点?": String, "位置?": String, "计划阶段?": String[], "当前阶段?": Number, "阶段结束时间?": String, "进度?": String, "预计完成?": String }>
- \`gameState.世界.战争游戏\`: { "状态": String, "参战眷族": String[], "形式": String, "赌注": String, "举办时间": String, "结束时间": String, "结果": String, "备注": String }
- \`gameState.世界.下次更新\`: String（每回合需确认是否已经抵达下次更新时间，若抵达则更具体的日期如：第一日 18:00）

## 10. 地点系统 (gameState.地图)
- \`gameState.地图.macroLocations\`: Array<{ "id", "名称", "地点?", "描述?", "内容?" }>
- \`gameState.地图.midLocations\`: Array<{ "id", "名称", "描述?", "归属?", "内部建筑?" }>
- \`gameState.地图.smallLocations\`: Array<{ "id", "名称", "描述?", "归属?" }>
- \`gameState.地图.current\`: { "macroId?", "midId?", "smallId?" }

## 11. 剧情进度 (gameState.剧情)
- \`gameState.剧情.对应原著对应章节\`: String
- \`gameState.剧情.对应章节名\`: String
- \`gameState.剧情.原著大概剧情走向\`: String (200字内)
- \`gameState.剧情.本世界分歧剧情\`: { "说明": String, "分点": String[], "归纳总结?": String }
- \`gameState.剧情.剧情规划\`: { "规划长期剧情走向": String, "规划中期剧情走向": String, "规划短期剧情走向": String }
- \`gameState.剧情.待激活事件\`: Array<{ "事件": String, "激活时间": String, "激活条件": String }>

## 12. 契约系统 (gameState.契约)
- \`gameState.契约\`: Array<{ "id", "名称", "描述", "状态", "条款", "开始时间?", "结束时间?", "结束条件?", "违约代价?", "备注?" }>

## 13. 眷族信息 (gameState.眷族)
- \`gameState.眷族.名称\`: String
- \`gameState.眷族.等级\`: String
- \`gameState.眷族.主神\`: String
- \`gameState.眷族.资金\`: Number
- \`gameState.眷族.声望\`: Number
- \`gameState.眷族.设施状态\`: Object
- \`gameState.眷族.仓库\`: Array<InventoryItem>

</数据结构定义>`;

# DND 模板 21 表映射矩阵（冻结版）

- 生成时间：2026-02-08
- 参考源：`docs/ref/DND仪表盘配套模板.json`、`types/gamestate.ts`、`types/extended.ts`
- 说明：状态定义为 `已覆盖 / 部分 / 缺失`，`部分` 表示已有承接但字段或语义未完全对齐。

| sheet名 | 字段 | 当前类型路径 | 状态 | 备注 |
|---|---|---|---|---|
| sheet_CHARACTER_Attributes | CHAR_ID | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Attributes | 等级 | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Attributes | HP | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Attributes | AC | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Attributes | 先攻加值 | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Attributes | 速度 | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Attributes | 属性值 | GameState.角色 + CharacterStats.dndProfile | 部分 | 可映射到 `CharacterStats.DND档案?.属性值` |
| sheet_CHARACTER_Attributes | 豁免熟练 | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Attributes | 技能熟练 | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Attributes | 被动感知 | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Attributes | 经验值 | GameState.角色 + CharacterStats.dndProfile | 部分 | 主角属性已覆盖，多角色属性表缺失 |
| sheet_CHARACTER_Feats | LINK_ID | CharacterStats.发展能力[] (无关联表) | 缺失 | 缺少 CHAR_ID-FEAT_ID 关系表 |
| sheet_CHARACTER_Feats | CHAR_ID | CharacterStats.发展能力[] (无关联表) | 缺失 | 缺少 CHAR_ID-FEAT_ID 关系表 |
| sheet_CHARACTER_Feats | FEAT_ID | CharacterStats.发展能力[] (无关联表) | 缺失 | 缺少 CHAR_ID-FEAT_ID 关系表 |
| sheet_CHARACTER_Feats | 获取来源 | CharacterStats.发展能力[] (无关联表) | 缺失 | 缺少 CHAR_ID-FEAT_ID 关系表 |
| sheet_CHARACTER_Feats | 获取等级 | CharacterStats.发展能力[] (无关联表) | 缺失 | 缺少 CHAR_ID-FEAT_ID 关系表 |
| sheet_CHARACTER_Feats | 已选择项 | CharacterStats.发展能力[] (无关联表) | 缺失 | 缺少 CHAR_ID-FEAT_ID 关系表 |
| sheet_CHARACTER_Feats | 备注 | CharacterStats.发展能力[] (无关联表) | 缺失 | 缺少 CHAR_ID-FEAT_ID 关系表 |
| sheet_CHARACTER_Registry | CHAR_ID | GameState.角色 + GameState.社交 | 缺失 | 当前主角无显式 CHAR_ID 字段 |
| sheet_CHARACTER_Registry | 成员类型 | GameState.角色 + GameState.社交 | 缺失 | 缺少多角色 registry 与成员类型模型 |
| sheet_CHARACTER_Registry | 姓名 | GameState.角色 + GameState.社交 | 缺失 | 缺少多角色 registry 与成员类型模型 |
| sheet_CHARACTER_Registry | 种族/性别/年龄 | GameState.角色 + GameState.社交 | 缺失 | 缺少多角色 registry 与成员类型模型 |
| sheet_CHARACTER_Registry | 职业 | GameState.角色 + GameState.社交 | 缺失 | 缺少多角色 registry 与成员类型模型 |
| sheet_CHARACTER_Registry | 外貌描述 | GameState.角色 + GameState.社交 | 缺失 | 缺少多角色 registry 与成员类型模型 |
| sheet_CHARACTER_Registry | 性格特点 | GameState.角色 + GameState.社交 | 缺失 | 缺少多角色 registry 与成员类型模型 |
| sheet_CHARACTER_Registry | 背景故事 | GameState.角色 + GameState.社交 | 缺失 | 缺少多角色 registry 与成员类型模型 |
| sheet_CHARACTER_Registry | 加入时间 | GameState.角色 + GameState.社交 | 缺失 | 缺少多角色 registry 与成员类型模型 |
| sheet_CHARACTER_Resources | CHAR_ID | GameState.角色 (法术位/职业资源/生命骰/金币) | 部分 | 字段分散在 CharacterStats，缺少角色资源行模型 |
| sheet_CHARACTER_Resources | 法术位 | GameState.角色 (法术位/职业资源/生命骰/金币) | 部分 | 可映射到 `CharacterStats.魔法栏位` 或 `dndProfile.法术位` |
| sheet_CHARACTER_Resources | 职业资源 | GameState.角色 (法术位/职业资源/生命骰/金币) | 部分 | 字段分散在 CharacterStats，缺少角色资源行模型 |
| sheet_CHARACTER_Resources | 生命骰 | GameState.角色 (法术位/职业资源/生命骰/金币) | 部分 | 字段分散在 CharacterStats，缺少角色资源行模型 |
| sheet_CHARACTER_Resources | 特殊能力 | GameState.角色 (法术位/职业资源/生命骰/金币) | 部分 | 字段分散在 CharacterStats，缺少角色资源行模型 |
| sheet_CHARACTER_Resources | 金币 | GameState.角色 (法术位/职业资源/生命骰/金币) | 部分 | 字段分散在 CharacterStats，缺少角色资源行模型 |
| sheet_CHARACTER_Skills | LINK_ID | CharacterStats.技能[] (单角色内联) | 缺失 | 缺少 LINK_ID + CHAR_ID 关联结构 |
| sheet_CHARACTER_Skills | CHAR_ID | CharacterStats.技能[] (单角色内联) | 缺失 | 缺少 LINK_ID + CHAR_ID 关联结构 |
| sheet_CHARACTER_Skills | SKILL_ID | CharacterStats.技能[] (单角色内联) | 缺失 | 缺少 LINK_ID + CHAR_ID 关联结构 |
| sheet_CHARACTER_Skills | 获取方式 | CharacterStats.技能[] (单角色内联) | 缺失 | 缺少 LINK_ID + CHAR_ID 关联结构 |
| sheet_CHARACTER_Skills | 已准备 | CharacterStats.技能[] (单角色内联) | 缺失 | 缺少 LINK_ID + CHAR_ID 关联结构 |
| sheet_CHARACTER_Skills | 熟练度 | CharacterStats.技能[] (单角色内联) | 缺失 | 缺少 LINK_ID + CHAR_ID 关联结构 |
| sheet_CHARACTER_Skills | 备注 | CharacterStats.技能[] (单角色内联) | 缺失 | 缺少 LINK_ID + CHAR_ID 关联结构 |
| sheet_COMBAT_BattleMap | 单位名称 | GameState.战斗.地图[] (BattleMapRow) | 部分 | 坐标与 token 已有基础映射，尺寸与类型枚举需对齐 |
| sheet_COMBAT_BattleMap | 类型 | GameState.战斗.地图[] (BattleMapRow) | 部分 | 坐标与 token 已有基础映射，尺寸与类型枚举需对齐 |
| sheet_COMBAT_BattleMap | 坐标 | GameState.战斗.地图[] (BattleMapRow) | 部分 | 坐标与 token 已有基础映射，尺寸与类型枚举需对齐 |
| sheet_COMBAT_BattleMap | 大小 | GameState.战斗.地图[] (BattleMapRow) | 部分 | 坐标与 token 已有基础映射，尺寸与类型枚举需对齐 |
| sheet_COMBAT_BattleMap | Token | GameState.战斗.地图[] (BattleMapRow) | 部分 | 坐标与 token 已有基础映射，尺寸与类型枚举需对齐 |
| sheet_COMBAT_Encounter | 单位名称 | GameState.遭遇[] (EncounterRow) + GameState.战斗 | 部分 | 结构已存在，先攻/位置/资源需细化 |
| sheet_COMBAT_Encounter | 阵营 | GameState.遭遇[] (EncounterRow) + GameState.战斗 | 部分 | 结构已存在，先攻/位置/资源需细化 |
| sheet_COMBAT_Encounter | 先攻/位置 | GameState.遭遇[] (EncounterRow) + GameState.战斗 | 部分 | 结构已存在，先攻/位置/资源需细化 |
| sheet_COMBAT_Encounter | HP状态 | GameState.遭遇[] (EncounterRow) + GameState.战斗 | 部分 | 结构已存在，先攻/位置/资源需细化 |
| sheet_COMBAT_Encounter | 防御/抗性 | GameState.遭遇[] (EncounterRow) + GameState.战斗 | 部分 | 结构已存在，先攻/位置/资源需细化 |
| sheet_COMBAT_Encounter | 附着状态 | GameState.遭遇[] (EncounterRow) + GameState.战斗 | 部分 | 结构已存在，先攻/位置/资源需细化 |
| sheet_COMBAT_Encounter | 是否为当前行动者 | GameState.遭遇[] (EncounterRow) + GameState.战斗 | 部分 | 结构已存在，先攻/位置/资源需细化 |
| sheet_COMBAT_Encounter | 回合资源 | GameState.遭遇[] (EncounterRow) + GameState.战斗 | 部分 | 结构已存在，先攻/位置/资源需细化 |
| sheet_COMBAT_Map_Visuals | SceneName | GameState.战斗.视觉 (MapVisuals) | 部分 | set_map_visuals 已有，GridSize 字段需对齐 |
| sheet_COMBAT_Map_Visuals | VisualJSON | GameState.战斗.视觉 (MapVisuals) | 部分 | set_map_visuals 已有，GridSize 字段需对齐 |
| sheet_COMBAT_Map_Visuals | GridSize | GameState.战斗.视觉 (MapVisuals) | 部分 | set_map_visuals 已有，GridSize 字段需对齐 |
| sheet_COMBAT_Map_Visuals | LastUpdated | GameState.战斗.视觉 (MapVisuals) | 部分 | set_map_visuals 已有，GridSize 字段需对齐 |
| sheet_DICE_Pool | ID | GameState.骰池[] (DicePool) | 部分 | 当前是行式骰池，模板是聚合列式结构 |
| sheet_DICE_Pool | D4 | GameState.骰池[] (DicePool) | 部分 | 当前是行式骰池，模板是聚合列式结构 |
| sheet_DICE_Pool | D6 | GameState.骰池[] (DicePool) | 部分 | 当前是行式骰池，模板是聚合列式结构 |
| sheet_DICE_Pool | D8 | GameState.骰池[] (DicePool) | 部分 | 当前是行式骰池，模板是聚合列式结构 |
| sheet_DICE_Pool | D10 | GameState.骰池[] (DicePool) | 部分 | 当前是行式骰池，模板是聚合列式结构 |
| sheet_DICE_Pool | D12 | GameState.骰池[] (DicePool) | 部分 | 当前是行式骰池，模板是聚合列式结构 |
| sheet_DICE_Pool | D20 | GameState.骰池[] (DicePool) | 部分 | 当前是行式骰池，模板是聚合列式结构 |
| sheet_DICE_Pool | D100 | GameState.骰池[] (DicePool) | 部分 | 当前是行式骰池，模板是聚合列式结构 |
| sheet_EXPLORATION_Map_Data | LocationName | GameState.地图 + upsert_exploration_map 流程 | 部分 | MapStructureJSON 已有处理，显示地图字段待标准化 |
| sheet_EXPLORATION_Map_Data | MapStructureJSON | GameState.地图 + upsert_exploration_map 流程 | 部分 | MapStructureJSON 已有处理，显示地图字段待标准化 |
| sheet_EXPLORATION_Map_Data | LastUpdated | GameState.地图 + upsert_exploration_map 流程 | 部分 | MapStructureJSON 已有处理，显示地图字段待标准化 |
| sheet_EXPLORATION_Map_Data | 当前显示地图 | GameState.地图 + upsert_exploration_map 流程 | 部分 | MapStructureJSON 已有处理，显示地图字段待标准化 |
| sheet_FACTION_Standing | 势力ID | GameState.势力[] (Faction) / GameState.眷族 | 部分 | 关系等级可映射，声望和事件字段需扩展 |
| sheet_FACTION_Standing | 势力名称 | GameState.势力[] (Faction) / GameState.眷族 | 部分 | 关系等级可映射，声望和事件字段需扩展 |
| sheet_FACTION_Standing | 关系等级 | GameState.势力[] (Faction) / GameState.眷族 | 部分 | 关系等级可映射，声望和事件字段需扩展 |
| sheet_FACTION_Standing | 声望值 | GameState.势力[] (Faction) / GameState.眷族 | 部分 | 关系等级可映射，声望和事件字段需扩展 |
| sheet_FACTION_Standing | 主角头衔 | GameState.势力[] (Faction) / GameState.眷族 | 部分 | 关系等级可映射，声望和事件字段需扩展 |
| sheet_FACTION_Standing | 关键事件 | GameState.势力[] (Faction) / GameState.眷族 | 部分 | 关系等级可映射，声望和事件字段需扩展 |
| sheet_FACTION_Standing | 特权/通缉 | GameState.势力[] (Faction) / GameState.眷族 | 部分 | 关系等级可映射，声望和事件字段需扩展 |
| sheet_FEAT_Library | FEAT_ID | CharacterStats.发展能力[] | 缺失 | 当前无 DND feat 主数据模型 |
| sheet_FEAT_Library | 专长名称 | CharacterStats.发展能力[] | 缺失 | 发展能力与 DND feat 语义不同 |
| sheet_FEAT_Library | 类别 | CharacterStats.发展能力[] | 缺失 | 发展能力与 DND feat 语义不同 |
| sheet_FEAT_Library | 前置条件 | CharacterStats.发展能力[] | 缺失 | 发展能力与 DND feat 语义不同 |
| sheet_FEAT_Library | 效果描述 | CharacterStats.发展能力[] | 缺失 | 发展能力与 DND feat 语义不同 |
| sheet_FEAT_Library | 属性提升 | CharacterStats.发展能力[] | 缺失 | 发展能力与 DND feat 语义不同 |
| sheet_FEAT_Library | 附带能力ID | CharacterStats.发展能力[] | 缺失 | 发展能力与 DND feat 语义不同 |
| sheet_ITEM_Inventory | 物品ID | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 物品名称 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 类别 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 数量 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 已装备 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 所属人 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 伤害 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 特性 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 稀有度 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 描述 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 重量 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_ITEM_Inventory | 价值 | GameState.背包[]/公共战利品[]/战利品[] (InventoryItem) | 部分 | 已有 upsert_inventory，所属人/特性/伤害为可选扩展 |
| sheet_LOG_Outline | 时间跨度 | GameState.日志大纲[] (LogOutline) | 已覆盖 | append_log_outline 已接入 |
| sheet_LOG_Outline | 大纲 | GameState.日志大纲[] (LogOutline) | 已覆盖 | append_log_outline 已接入 |
| sheet_LOG_Outline | 编码索引 | GameState.日志大纲[] (LogOutline) | 已覆盖 | append_log_outline 已接入 |
| sheet_LOG_Summary | 时间跨度 | GameState.日志摘要[] (LogSummary) | 已覆盖 | append_log_summary 已接入 |
| sheet_LOG_Summary | 地点 | GameState.日志摘要[] (LogSummary) | 已覆盖 | append_log_summary 已接入 |
| sheet_LOG_Summary | 纪要 | GameState.日志摘要[] (LogSummary) | 已覆盖 | append_log_summary 已接入 |
| sheet_LOG_Summary | 重要对话 | GameState.日志摘要[] (LogSummary) | 已覆盖 | append_log_summary 已接入 |
| sheet_LOG_Summary | 编码索引 | GameState.日志摘要[] (LogSummary) | 已覆盖 | append_log_summary 已接入 |
| sheet_NPC_Registry | NPC_ID | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 姓名 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 种族/性别/年龄 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 职业/身份 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 外貌描述 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 等级 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | HP | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | AC | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 主要技能 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 随身物品 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 当前状态 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 所在位置 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 与主角关系 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_NPC_Registry | 关键经历 | GameState.社交[] + extendedCommands.upsert_npc | 部分 | 已有 upsert 与校验，但字段粒度不完全一致 |
| sheet_QUEST_Active | 任务ID | GameState.任务[] (Task) + GameState.增强任务[] (QuestEnhanced) | 部分 | 基础字段可承接，任务类型/发布者等仍需映射 |
| sheet_QUEST_Active | 任务名称 | GameState.任务[] (Task) + GameState.增强任务[] (QuestEnhanced) | 部分 | 基础字段可承接，任务类型/发布者等仍需映射 |
| sheet_QUEST_Active | 类型 | GameState.任务[] (Task) + GameState.增强任务[] (QuestEnhanced) | 部分 | 基础字段可承接，任务类型/发布者等仍需映射 |
| sheet_QUEST_Active | 发布者 | GameState.任务[] (Task) + GameState.增强任务[] (QuestEnhanced) | 部分 | 基础字段可承接，任务类型/发布者等仍需映射 |
| sheet_QUEST_Active | 目标描述 | GameState.任务[] (Task) + GameState.增强任务[] (QuestEnhanced) | 部分 | 基础字段可承接，任务类型/发布者等仍需映射 |
| sheet_QUEST_Active | 当前进度 | GameState.任务[] (Task) + GameState.增强任务[] (QuestEnhanced) | 部分 | 基础字段可承接，任务类型/发布者等仍需映射 |
| sheet_QUEST_Active | 状态 | GameState.任务[] (Task) + GameState.增强任务[] (QuestEnhanced) | 部分 | 基础字段可承接，任务类型/发布者等仍需映射 |
| sheet_QUEST_Active | 时限 | GameState.任务[] (Task) + GameState.增强任务[] (QuestEnhanced) | 部分 | 基础字段可承接，任务类型/发布者等仍需映射 |
| sheet_QUEST_Active | 奖励 | GameState.任务[] (Task) + GameState.增强任务[] (QuestEnhanced) | 部分 | 基础字段可承接，任务类型/发布者等仍需映射 |
| sheet_SKILL_Library | SKILL_ID | GameState.技能[] / CharacterStats.技能[] | 部分 | 当前技能对象 `Skill.id` 可承接，但缺少全局库 |
| sheet_SKILL_Library | 技能名称 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SKILL_Library | 技能类型 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SKILL_Library | 环阶 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SKILL_Library | 学派 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SKILL_Library | 施法时间 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SKILL_Library | 射程 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SKILL_Library | 成分 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SKILL_Library | 持续时间 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SKILL_Library | 效果描述 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SKILL_Library | 升阶效果 | GameState.技能[] / CharacterStats.技能[] | 部分 | 缺少独立 skill library 主数据表 |
| sheet_SYS_GlobalState | 当前场景 | GameState (当前地点/游戏时间/天气/回合数/战斗模式/系统通知) | 部分 | 当前实现使用 `GameState.当前地点`，需别名映射 |
| sheet_SYS_GlobalState | 场景描述 | GameState (当前地点/游戏时间/天气/回合数/战斗模式/系统通知) | 部分 | 已存在 `GameState.场景描述?` 可承接 |
| sheet_SYS_GlobalState | 游戏时间 | GameState (当前地点/游戏时间/天气/回合数/战斗模式/系统通知) | 部分 | 字段命名不完全一致，需兼容层做别名映射 |
| sheet_SYS_GlobalState | 上轮时间 | GameState (当前地点/游戏时间/天气/回合数/战斗模式/系统通知) | 部分 | 字段命名不完全一致，需兼容层做别名映射 |
| sheet_SYS_GlobalState | 流逝时长 | GameState (当前地点/游戏时间/天气/回合数/战斗模式/系统通知) | 部分 | 字段命名不完全一致，需兼容层做别名映射 |
| sheet_SYS_GlobalState | 天气状况 | GameState (当前地点/游戏时间/天气/回合数/战斗模式/系统通知) | 部分 | 当前实现为 `GameState.天气` |
| sheet_SYS_GlobalState | 战斗模式 | GameState (当前地点/游戏时间/天气/回合数/战斗模式/系统通知) | 部分 | 字段命名不完全一致，需兼容层做别名映射 |
| sheet_SYS_GlobalState | 当前回合 | GameState (当前地点/游戏时间/天气/回合数/战斗模式/系统通知) | 部分 | 当前实现为 `GameState.回合数` |
| sheet_SYS_GlobalState | 系统通知 | GameState (当前地点/游戏时间/天气/回合数/战斗模式/系统通知) | 部分 | 字段命名不完全一致，需兼容层做别名映射 |
| sheet_UI_ActionOptions | 选项A | GameState.可选行动列表[] (ActionOptions) | 已覆盖 | set_action_options 与 UI 已接入 |
| sheet_UI_ActionOptions | 选项B | GameState.可选行动列表[] (ActionOptions) | 已覆盖 | set_action_options 与 UI 已接入 |
| sheet_UI_ActionOptions | 选项C | GameState.可选行动列表[] (ActionOptions) | 已覆盖 | set_action_options 与 UI 已接入 |
| sheet_UI_ActionOptions | 选项D | GameState.可选行动列表[] (ActionOptions) | 已覆盖 | set_action_options 与 UI 已接入 |

## 冲突字段复查（Task 0.1 Step 3）

- `SYS_GlobalState`：`当前场景/天气状况/当前回合` 与现有 `当前地点/天气/回合数` 命名冲突，需在 compatibility adapter 统一别名。
- `CHARACTER_*`：当前仅有单主角结构，缺少 `CHARACTER_Registry` 的多角色行模型与 `CHAR_ID` 主键体系。
- `SKILL_*`：技能目前以内联数组存在（`GameState.技能`、`CharacterStats.技能`），缺少 `SKILL_Library + CHARACTER_Skills` 双表关系。
- `FEAT_*`：现有 `发展能力` 不能直接等价 DND `Feat`，需要新增库表与角色关联表。

## 状态汇总

- 已覆盖：`sheet_LOG_Summary`、`sheet_LOG_Outline`、`sheet_UI_ActionOptions`。
- 部分覆盖：其余核心战斗/探索/物品/任务等 13 表。
- 缺失：`sheet_CHARACTER_Registry`、`sheet_CHARACTER_Skills`、`sheet_FEAT_Library`、`sheet_CHARACTER_Feats`。

# DND 仪表盘配套模板（分解说明）

## 1. 文件定位

- 文件名：`DND仪表盘配套模板.json`
- 根结构：对象（非数组）。
- 内容由 `mate` + 多个 `sheet_*` 构成，当前共 `20` 张业务表。

## 2. 通用 sheet 结构

每张 `sheet_*` 都是统一格式：

- `uid`: 表唯一 ID
- `name`: 展示名称
- `sourceData`: 规则说明（`note/initNode/updateNode/insertNode/deleteNode`）
- `content`: 二维数组（第 1 行通常是列头）
- `updateConfig`: 更新策略配置
- `exportConfig`: 导出/注入配置
- `orderNo`: 表顺序

## 3. 表域分组理解

### 3.1 世界与剧情状态

- `sheet_SYS_GlobalState`：全局状态（单行核心表）
- `sheet_QUEST_Active`：活跃任务
- `sheet_FACTION_Standing`：势力关系

### 3.2 人物与能力

- `sheet_NPC_Registry`
- `sheet_CHARACTER_Registry`
- `sheet_CHARACTER_Attributes`
- `sheet_CHARACTER_Resources`
- `sheet_SKILL_Library`
- `sheet_CHARACTER_Skills`
- `sheet_FEAT_Library`
- `sheet_CHARACTER_Feats`

### 3.3 物品与行动

- `sheet_ITEM_Inventory`
- `sheet_UI_ActionOptions`

### 3.4 战斗与地图

- `sheet_COMBAT_Encounter`
- `sheet_COMBAT_BattleMap`
- `sheet_COMBAT_Map_Visuals`
- `sheet_EXPLORATION_Map_Data`
- `sheet_DICE_Pool`

### 3.5 叙事日志

- `sheet_LOG_Summary`
- `sheet_LOG_Outline`

## 4. 关键机制说明

- 该模板是“数据库脚本 + 仪表盘脚本”的共同数据契约。
- 多张表含“禁止删除/单行限制”等硬约束，需遵守 `sourceData` 规则。
- `orderNo` 决定前端展示顺序和部分导出顺序。
- `sheet_DICE_Pool` 是战斗推进预设的关键输入。
- `sheet_LOG_Summary` 与 `sheet_LOG_Outline` 通过编码索引建立记忆链路。

## 5. 使用建议

1. 新项目先保留列头与规则字段，不要直接删列。
2. 若需要扩展列，优先在末尾新增，避免破坏既有脚本解析逻辑。
3. 若替换模板，必须同步检查数据库脚本里的默认模板和导入逻辑。


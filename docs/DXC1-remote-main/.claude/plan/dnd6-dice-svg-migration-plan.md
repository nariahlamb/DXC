# DND6 + Dice + SVG 迁移实施计划（执行版）

## 目标
在不破坏现有 DXC 存档与玩法的前提下，引入：
1. DND 6维（STR/DEX/CON/INT/WIS/CHA）真实机制。
2. DND 骰子机制（可复现检定、骰池消费与补充）。
3. 探索/战斗地图 SVG 的真实战术作用（后续阶段）。
4. 技能/魔法与属性/豁免/地形深度绑定（后续阶段）。

## 约束
- 保留现有五维主链路，新增 `ruleSet` 双轨支持（danmachi / dnd5e）。
- 新能力先以扩展命令接入，不破坏旧 `set/add/push/delete`。
- 所有新增能力必须有可观测判定流水与回退路径。

## 阶段路线图

### Phase 0：基线对标（M0）
- [ ] 建立酒馆脚本对标样例（地图/战斗/骰池/属性）。
- [ ] 形成 parity 基线与验收清单。

### Phase 1：规则内核引入（M1）
- [x] P1-1 数据模型扩展：`CharacterStats` / `GameState` 新增 DND 字段。
- [x] P1-2 Dice Engine：支持 d20 检定、优势/劣势、表达式掷骰。
- [x] P1-3 扩展命令：`refill_dice_pool`、`roll_dice_check`。
- [x] P1-4 AI 合约示例同步（commands/schema）。

### Phase 2：战斗判定流水（M2）
- [x] 行动经济（动作/附赠/反应/移动）结构化。
- [x] 命中/豁免/伤害/状态流程结构化日志。
- [ ] 技能/魔法执行器接入战斗上下文。

### Phase 3：地图 SVG 真实化（M3）
- [ ] 探索地图：Structure -> SVG 生成编排。
- [ ] 战斗地图：视觉层 + 逻辑层联动（LOS/掩体/地形）。
- [ ] 地图元素对判定结果生效。

### Phase 4：可用性与发布（M4）
- [ ] 判定可视化与交互优化（桌面/移动端）。
- [ ] 灰度开关与回归测试集。
- [ ] 全量发布与兼容迁移说明。

## 当前迭代（本次开始实现）

### I1：第一批落地范围
- [x] 新增 DND6 类型与状态字段（仅扩展，不替换旧字段）。
- [x] 新增 `utils/diceEngine.ts`（核心掷骰能力）。
- [x] 新增 `refill_dice_pool` 命令处理（批量补池）。
- [x] 新增 `roll_dice_check` 命令处理（可写入判定事件）。
- [x] 在 `processTavernCommands` 完成新 action 路由。
- [x] 同步 prompts 文档示例。
- [x] `npm run build` 验证。

## 验收标准（I1）
- 可通过 tavern_commands 执行：
  - `{"action":"refill_dice_pool","value":{"count":5}}`
  - `{"action":"roll_dice_check","value":{"行动者":"Bell","动作":"侦查","DC":15,"属性调整":2,"熟练加值":2,"优势":true}}`
- 检定完成后：
  - 骰池被正确消费（若启用消费）。
  - `gameState.战斗.判定事件` 追加结构化事件。
- 构建通过。

## 文件清单（I1）
- `types/character.ts`
- `types/gamestate.ts`
- `utils/diceEngine.ts` (new)
- `utils/contracts.ts`
- `hooks/gameLogic/extendedCommands.ts`
- `hooks/useGameLogic.ts`
- `prompts/commands.ts`
- `prompts/schema.ts`

## 当前迭代（继续）

### I2：战斗判定流水第一批
- [x] 新增行动经济数据结构（`gameState.战斗.行动经济`）。
- [x] 新增命令：`set_action_economy`、`spend_action_resource`。
- [x] 新增命令：`resolve_attack_check`、`resolve_saving_throw`、`resolve_damage_roll`。
- [x] 攻击/豁免/伤害命令可写入结构化判定流水并支持目标HP更新。
- [x] CombatPanel 增加行动经济可视化面板。
- [x] 技能/魔法执行器深度绑定第一批（`DND机制`字段 + ActionDock 注入 + 行动文本携带判定提示）。
- [x] CenterPanel 常驻战斗信号可视化（判定/行动经济/战术地图摘要 + 非战斗态入口）。
- [ ] 回归测试场景补齐（下一批）。

### I3：沉浸式战斗仪表盘（本轮）
- [x] CombatPanel 改为“顶栏状态 + 左战术图 + 右单位卡 + 底部资源条”单屏布局。
- [x] 战斗单位卡接入 AC/HP/状态/效果展示（兼容 battleMap 扩展字段）。
- [x] 新增快速动作区（移动/技能/物品/攻击）并保持目标注入。
- [x] ActionDock 与遭遇日志改为可折叠扩展区，保留完整功能。
- [x] 视觉风格切换为酒馆插件风格（深红金属 + 金色描边 + 发光重点）。
- [x] `npm run build` 通过。

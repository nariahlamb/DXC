# DND 适配实现差距清单（Gap Backlog）

- 生成时间：2026-02-08
- 基线范围：`hooks/useGameLogic.ts`、`hooks/gameLogic/extendedCommands.ts`、`components/game/CombatPanel.tsx`
- 分级规则：`P0` 阻塞主链、`P1` 核心增强、`P2` 体验增强

## 1) 已覆盖能力（By Domain）

| Domain | 已覆盖能力 | 现状说明 | 主要落点 |
|---|---|---|---|
| Combat | 遭遇写入、战斗地图 upsert、先攻顺序、行动经济、攻击/豁免/伤害结算、判定事件追加 | 命令处理链已形成闭环 | `hooks/gameLogic/extendedCommands.ts` |
| Dice | 骰池补充、消费、d20 检定、表达式掷骰 | 可驱动判定与日志写入 | `hooks/gameLogic/extendedCommands.ts` |
| ActionOptions | `set_action_options` 命令 + UI 展示与点击回调 | 已能从 AI 输出进入战斗交互 | `hooks/gameLogic/extendedCommands.ts`、`components/game/CombatPanel.tsx` |
| Logs | `append_log_summary`、`append_log_outline` | 已支持摘要/大纲增量追加 | `hooks/gameLogic/extendedCommands.ts` |
| Exploration | `upsert_exploration_map` 规范化、结构校验、回写地图层级 | 可把地图结构写回 `GameState.地图` | `hooks/useGameLogic.ts` |

## 2) 部分覆盖能力（缺什么 + 对应文件）

| Domain | 当前能力 | 还缺什么 | 对应文件 |
|---|---|---|---|
| Combat | 战斗命令齐全 | 缺少跨命令事务不变量（回合/先攻/HP 约束）统一守卫 | `hooks/gameLogic/extendedCommands.ts` |
| Combat | 战斗地图与视觉已可显示 | `COMBAT_BattleMap/COMBAT_Map_Visuals` 字段与模板仍有命名差异（如 GridSize、Token 语义） | `components/game/CombatPanel.tsx`、`hooks/gameLogic/extendedCommands.ts` |
| Dice | 行式骰池可运作 | 模板是列式 `sheet_DICE_Pool`，仍缺 adapter 层转换 | `types/extended.ts`、`hooks/gameLogic/extendedCommands.ts` |
| ActionOptions | 已支持结构化 options | 模板四列（A/B/C/D）与当前数组模型未建立稳定双向映射 | `components/game/CombatPanel.tsx`、`types/extended.ts` |
| Logs | 摘要/大纲已追加 | 模板中的 `时间跨度/编码索引` 规则未标准化 | `hooks/gameLogic/extendedCommands.ts` |
| Exploration | 地图写入链路可跑 | `LastUpdated/当前显示地图` 等模板字段未形成统一 schema | `hooks/useGameLogic.ts` |

## 3) 缺失能力与优先级（Missing Backlog）

| Priority | 能力项 | 阻塞原因/收益 | 建议入口 |
|---|---|---|---|
| P0 | Sheet Registry（核心 10 表） | 无统一 registry 则无法稳定声明模板契约 | `types/taverndb.ts`、`utils/taverndb/sheetRegistry.ts` |
| P0 | `GameState -> Sheet` Projection | 无投影视图则 AI 上下文无法与模板语义对齐 | `utils/taverndb/sheetProjection.ts`、`utils/aiContext.ts` |
| P0 | Row Operation Translator（insert/update/delete） | 无 translator 则模板脚本操作无法安全落到 SSOT | `utils/taverndb/rowTranslator.ts`、`hooks/useGameLogic.ts` |
| P1 | Combat Invariants 守卫 | 降低回合状态错写/脏数据风险 | `utils/taverndb/invariants.ts`、`hooks/gameLogic/extendedCommands.ts` |
| P1 | Character 多表模型（Registry/Attributes/Resources） | 当前仅单主角结构，无法承接 21 表角色域 | `types/gamestate.ts`、`types/character.ts` |
| P1 | Skill/Feat 库与角色关联表 | `SKILL_* / FEAT_*` 缺主数据与 link 关系 | `types/extended.ts`、`hooks/gameLogic/extendedCommands.ts` |
| P2 | Template Studio（导入导出 + preset + profile isolation） | 提升模板可运营性与配置隔离能力 | `components/game/modals/settings`、`utils/templateStudio/*` |
| P2 | Director Mode（风险可视 + 行动编排） | 提升互动感与战斗决策反馈 | `components/game/CombatPanel.tsx`、`components/game/CenterPanel.tsx` |

## 4) 执行建议（与计划对齐）

1. 先完成 P0（三件套：registry/projection/translator），保证模板协议可落地。  
2. 再完成 P1（invariants + 角色域），补齐一致性与数据模型。  
3. 最后完成 P2（模板工作流与 Director Mode）做体验增强。

## 5) 验证基线

- 当前基线要求：每个任务完成后执行对应测试；文档任务执行构建验证。  
- 本阶段已完成构建验证：`npm run build`（PASS）。

## 6) Phase 1.5 UI Sprint 验收状态（2026-02-08）

- `TopNav` 已新增 `仪表盘` 按钮，并接入 `DailyDashboardModal` 打开流程。  
- `DailyDashboardModal` 已完成四象限信息面板：全局状态、任务概览、NPC 动态、资源速览。  
- `CenterPanel` 非战斗状态下可稳定显示行动条，且点击复用既有 `onActionOptionSelect`。  
- 验收记录已落档：`docs/plans/artifacts/ui-sprint-acceptance.md`。

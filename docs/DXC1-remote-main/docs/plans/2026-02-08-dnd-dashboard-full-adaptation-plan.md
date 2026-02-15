# DND沉浸式仪表盘全量适配 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `docs/ref` 中 DND 仪表盘（脚本+模板）可用能力完整适配到当前 DXC 架构，并显著增强游戏性与互动感。

**Architecture:** 采用 Hybrid Dual-Track：短期通过 `Sheet Compatibility Adapter` 兼容模板语义（不破坏 `GameState + tavern_commands` 主链），中期落地 `Director Mode` 交互导演层，长期把脚本式流程收敛为可测试、可维护的领域服务。所有写入以 `GameState` 为 SSOT，sheet 仅作为投影视图与 AI 协议层。

**Tech Stack:** React 19 + TypeScript + Vite + Vitest + Zod + IndexedDB

---

## 阶段总览（Phase Breakdown）

| Phase | 目标 | 主要产出 | 预计耗时 |
|---|---|---|---|
| Phase 0 | 基线与映射冻结 | 21表映射矩阵、差距清单、测试基线 | 0.5 周 |
| Phase 1 | 兼容层核心（10张表） | sheet registry/projection/translator + 核心表闭环 | 1.5 周 |
| Phase 1.5 | UI Sprint（先见变化） | 日常仪表盘入口 + 非战斗行动条 + 四象限信息面板 | 1 周 |
| Phase 2 | 战斗/探索链路补齐 | Combat/Map parity 与回合事务一致性 | 1 周 |
| Phase 3 | 角色域扩展 | Character/Skill/Feat 多表关系模型 | 1 周 |
| Phase 4 | 模板工作流 | Template Studio + preset + profile isolation | 1.5 周 |
| Phase 5 | 互动增强 | Director Mode（风险可视+行动编排） | 1 周 |
| Phase 6 | 稳定化与发布 | 回归测试、性能优化、文档验收 | 0.5 周 |

---

## Phase 0：基线与映射冻结

### Task 0.1: 建立 21 表映射矩阵（Source of Truth）

**Files:**
- Create: `docs/plans/artifacts/dnd-sheet-mapping-matrix.md`
- Reference: `docs/ref/DND仪表盘配套模板.json`
- Reference: `types/gamestate.ts`
- Reference: `types/extended.ts`

**Step 1: 创建映射表骨架**
- 列：`sheet名 / 字段 / 当前类型路径 / 状态(已覆盖/部分/缺失) / 备注`。

**Step 2: 填写 21 张表字段映射**
- 对每张 `sheet_*` 完成字段级映射；标出 `missing` 字段。

**Step 3: 人工复查冲突字段**
- 重点检查：`CHARACTER_*`、`SKILL_*`、`FEAT_*`、`SYS_GlobalState`。

**Step 4: Commit**
```bash
git add docs/plans/artifacts/dnd-sheet-mapping-matrix.md
git commit -m "docs: 冻结DND模板21表映射矩阵"
```

---

### Task 0.2: 生成实现差距清单（Gap Backlog）

**Files:**
- Create: `docs/plans/artifacts/dnd-gap-backlog.md`
- Reference: `hooks/useGameLogic.ts`
- Reference: `hooks/gameLogic/extendedCommands.ts`
- Reference: `components/game/CombatPanel.tsx`

**Step 1: 列出已覆盖能力**
- 按域：Combat / Dice / ActionOptions / Logs / Exploration。

**Step 2: 列出部分覆盖能力**
- 记录“缺什么 + 对应文件”。

**Step 3: 列出缺失能力并排序**
- 优先级：`P0`（阻塞）/ `P1`（核心增强）/ `P2`（体验增强）。

**Step 4: Commit**
```bash
git add docs/plans/artifacts/dnd-gap-backlog.md
git commit -m "docs: 输出DND适配差距清单与优先级"
```

---

## Phase 1：兼容层核心（先打通10张表）

### Task 1.1: 新增 TavernDB 兼容类型与注册表

**Files:**
- Create: `types/taverndb.ts`
- Create: `utils/taverndb/sheetRegistry.ts`
- Modify: `types/index.ts`
- Test: `tests/taverndb/sheetRegistry.test.ts`

**Step 1: 写 failing test（registry 可加载 10 张核心表）**
Run:
```bash
npm test -- tests/taverndb/sheetRegistry.test.ts
```
Expected: FAIL（模块不存在）。

**Step 2: 实现最小 registry**
- 注册：`SYS/NPC/ITEM/QUEST/COMBAT_Encounter/COMBAT_BattleMap/UI_ActionOptions/DICE/LOG_Summary/LOG_Outline`。

**Step 3: 运行测试验证通过**
```bash
npm test -- tests/taverndb/sheetRegistry.test.ts
```

**Step 4: Commit**
```bash
git add types/taverndb.ts utils/taverndb/sheetRegistry.ts tests/taverndb/sheetRegistry.test.ts types/index.ts
git commit -m "feat: 新增TavernDB核心sheet注册表"
```

---

### Task 1.2: 实现 `GameState -> Sheet` 投影层

**Files:**
- Create: `utils/taverndb/sheetProjection.ts`
- Modify: `utils/aiContext.ts`
- Test: `tests/taverndb/sheetProjection.test.ts`

**Step 1: 写 failing test（投影输出完整且稳定）**
```bash
npm test -- tests/taverndb/sheetProjection.test.ts
```

**Step 2: 实现最小投影逻辑**
- 输入 `GameState`，输出核心 10 表的可序列化对象。

**Step 3: 接入 `aiContext` 输出路径**
- 在构建 AI 上下文时可选择附加 sheet 视图。

**Step 4: 运行测试**
```bash
npm test -- tests/taverndb/sheetProjection.test.ts
```

**Step 5: Commit**
```bash
git add utils/taverndb/sheetProjection.ts utils/aiContext.ts tests/taverndb/sheetProjection.test.ts
git commit -m "feat: 增加GameState到sheet视图投影"
```

---

### Task 1.3: 实现 row operation translator（insert/update/delete -> tavern_commands）

**Files:**
- Create: `utils/taverndb/rowCommandTranslator.ts`
- Modify: `types/ai.ts`
- Modify: `hooks/useGameLogic.ts`
- Test: `tests/taverndb/rowCommandTranslator.test.ts`

**Step 1: 写 failing test（row op 翻译为有效命令）**
```bash
npm test -- tests/taverndb/rowCommandTranslator.test.ts
```

**Step 2: 实现 translator 最小路径**
- 先支持核心 10 表；不支持的表返回明确错误。

**Step 3: 接入命令执行前置转换**
- 在 `processTavernCommands` 前做可选翻译层。

**Step 4: 测试通过后提交**
```bash
npm test -- tests/taverndb/rowCommandTranslator.test.ts
git add utils/taverndb/rowCommandTranslator.ts types/ai.ts hooks/useGameLogic.ts tests/taverndb/rowCommandTranslator.test.ts
git commit -m "feat: 新增row操作到tavern_commands翻译层"
```

---

## Phase 1.5：UI Sprint（先见变化）

> 目标：在不等待后续底层全部完成的前提下，先交付“日常也可用”的可见仪表盘交互。

### Task 1.5.1: 新增日常仪表盘入口与主容器

**Files:**
- Create: `components/game/modals/DailyDashboardModal.tsx`
- Modify: `components/game/TopNav.tsx`
- Modify: `components/GameInterface.tsx`
- Test: `tests/ui/dailyDashboardModal.test.tsx`

**Step 1: 写 failing test（点击入口可打开模态）**
```bash
npm test -- tests/ui/dailyDashboardModal.test.tsx
```

**Step 2: 在 TopNav 增加“仪表盘”入口按钮**
- 文案建议：`仪表盘` / `Dashboard`。

**Step 3: 在 GameInterface 增加开关状态并挂载 `DailyDashboardModal`**
- 默认关闭，点击按钮开启。

**Step 4: 实现 `DailyDashboardModal` 基础壳（标题、四象限占位）**

**Step 5: 验证与提交**
```bash
npm test -- tests/ui/dailyDashboardModal.test.tsx
npm run build
git add components/game/modals/DailyDashboardModal.tsx components/game/TopNav.tsx components/GameInterface.tsx tests/ui/dailyDashboardModal.test.tsx
git commit -m "feat: 新增日常仪表盘入口与基础模态"
```

---

### Task 1.5.2: 非战斗行动条（日常交互模板）

**Files:**
- Modify: `components/game/CenterPanel.tsx`
- Modify: `hooks/useGameLogic.ts`
- Test: `tests/ui/centerPanelActionOptions.test.tsx`

**Step 1: 写 failing test（非战斗状态可显示行动选项）**
```bash
npm test -- tests/ui/centerPanelActionOptions.test.tsx
```

**Step 2: CenterPanel 接入 `gameState.可选行动列表` 常驻展示**
- 非战斗状态显示 A/B/C/D 行动卡；保留现有战斗逻辑。

**Step 3: 点击行动卡后仍复用现有 `onActionOptionSelect` 流程**
- 不新增分叉，避免流程重复。

**Step 4: 验证与提交**
```bash
npm test -- tests/ui/centerPanelActionOptions.test.tsx
npm run build
git add components/game/CenterPanel.tsx hooks/useGameLogic.ts tests/ui/centerPanelActionOptions.test.tsx
git commit -m "feat: 日常状态下启用常驻行动交互条"
```

---

### Task 1.5.3: 日常仪表盘四象限信息面板

**Files:**
- Modify: `components/game/modals/DailyDashboardModal.tsx`
- Modify: `types/gamestate.ts`
- Modify: `components/game/modals/TasksModal.tsx`
- Modify: `components/game/modals/social/ContactsView.tsx`
- Test: `tests/ui/dailyDashboardPanels.test.tsx`

**Step 1: 写 failing test（四个面板都能渲染）**
```bash
npm test -- tests/ui/dailyDashboardPanels.test.tsx
```

**Step 2: 实现全局状态区块**
- 时间、天气、场景、战斗模式。

**Step 3: 实现任务/NPC/资源区块**
- 任务：active/completed 数量 + 当前目标；
- NPC：在场数量 + 特别关注数量；
- 资源：HP/MP、背包计数、最近日志。

**Step 4: 与现有模态保持可跳转联动（可选按钮）**
- 例如“查看任务”“查看社交”。

**Step 5: 验证与提交**
```bash
npm test -- tests/ui/dailyDashboardPanels.test.tsx
npm run build
git add components/game/modals/DailyDashboardModal.tsx types/gamestate.ts components/game/modals/TasksModal.tsx components/game/modals/social/ContactsView.tsx tests/ui/dailyDashboardPanels.test.tsx
git commit -m "feat: 完成日常仪表盘四象限信息面板"
```

---

### Task 1.5.4: UI Sprint 验收（必须截图点位）

**Files:**
- Modify: `docs/plans/artifacts/dnd-gap-backlog.md`
- Create: `docs/plans/artifacts/ui-sprint-acceptance.md`

**Step 1: 验收截图点位**
- 点位A：TopNav 的“仪表盘”按钮
- 点位B：DailyDashboardModal 四象限
- 点位C：CenterPanel 非战斗行动条

**Step 2: 验证命令**
```bash
npm test
npm run build
```

**Step 3: 提交验收记录**
```bash
git add docs/plans/artifacts/dnd-gap-backlog.md docs/plans/artifacts/ui-sprint-acceptance.md
git commit -m "docs: 完成UI Sprint可见变化验收"
```

---

## Phase 2：战斗/探索链路补齐与一致性

### Task 2.1: 引入回合事务（turn transaction）

**Files:**
- Create: `utils/taverndb/turnTransaction.ts`
- Modify: `hooks/useGameLogic.ts`
- Test: `tests/taverndb/turnTransaction.test.ts`

**Step 1: 写 failing test（同回合命令原子性）**
```bash
npm test -- tests/taverndb/turnTransaction.test.ts
```

**Step 2: 实现事务执行器**
- 批量命令要么全部成功，要么回滚。

**Step 3: 接入 `useGameLogic`**
- 战斗相关命令走事务路径（可降级）。

**Step 4: 测试与提交**
```bash
npm test -- tests/taverndb/turnTransaction.test.ts
git add utils/taverndb/turnTransaction.ts hooks/useGameLogic.ts tests/taverndb/turnTransaction.test.ts
git commit -m "feat: 引入回合事务执行保障状态一致性"
```

---

### Task 2.2: 增加一致性校验器（invariant validator）

**Files:**
- Create: `utils/taverndb/invariants.ts`
- Modify: `hooks/gameLogic/extendedCommands.ts`
- Test: `tests/taverndb/invariants.test.ts`

**Step 1: 写 failing test（典型不一致场景）**
- 例如 `current_actor` 不在 `initiative_order` 中。

**Step 2: 实现 invariants**
- 战斗、骰池、行动经济、日志链路最小约束。

**Step 3: 在扩展命令后调用校验**
- 失败则打系统日志并阻断危险更新。

**Step 4: 测试与提交**
```bash
npm test -- tests/taverndb/invariants.test.ts
git add utils/taverndb/invariants.ts hooks/gameLogic/extendedCommands.ts tests/taverndb/invariants.test.ts
git commit -m "feat: 增加战斗与回合一致性校验"
```

---

## Phase 3：角色域扩展（CHAR/SKILL/FEAT）

### Task 3.1: 扩展角色注册与属性资源模型

**Files:**
- Modify: `types/gamestate.ts`
- Modify: `types/character.ts`
- Create: `types/character-registry.ts`
- Test: `tests/domain/characterRegistry.test.ts`

**Step 1: 写 failing test（多角色档案可关联）**

**Step 2: 新增 `CHARACTER_Registry/Attributes/Resources` typed model**

**Step 3: 与现有主角结构兼容迁移**
- 保持旧字段可读，新增字段增量启用。

**Step 4: 测试与提交**

---

### Task 3.2: 新增技能/专长库与角色关联表

**Files:**
- Modify: `types/extended.ts`
- Modify: `utils/contracts.ts`
- Modify: `hooks/gameLogic/extendedCommands.ts`
- Test: `tests/domain/skillFeatLink.test.ts`

**Step 1: 写 failing test（skill/feat link upsert）**

**Step 2: 增加 `SKILL_Library/CHARACTER_Skills/FEAT_Library/CHARACTER_Feats` schema**

**Step 3: 实现 upsert 命令处理**

**Step 4: 测试与提交**

---

## Phase 4：模板工作流（Template Studio）

### Task 4.1: 模板导入导出与校验

**Files:**
- Create: `utils/templateStudio/templateSchema.ts`
- Create: `utils/templateStudio/templateIO.ts`
- Create: `components/game/modals/settings/views/TemplateStudioView.tsx`
- Modify: `components/game/modals/SettingsModal.tsx`
- Test: `tests/templateStudio/templateIO.test.ts`

**Step 1: failing test（模板JSON导入合法/非法）**

**Step 2: 实现导入导出与错误提示**

**Step 3: 接入 Settings 入口（先简版）**

**Step 4: 测试与提交**

---

### Task 4.2: 预设（preset）与 profile isolation

**Files:**
- Create: `utils/templateStudio/presetStore.ts`
- Create: `utils/templateStudio/profileIsolation.ts`
- Modify: `utils/storage/storageAdapter.ts`
- Modify: `hooks/useAppSettings.ts`
- Test: `tests/templateStudio/presetIsolation.test.ts`

**Step 1: failing test（不同profile读取隔离）**

**Step 2: 实现 `profileKeyResolver` + preset CRUD**

**Step 3: 接入 settings 持久化路径**

**Step 4: 测试与提交**

---

## Phase 5：游戏性增强（Director Mode）

### Task 5.1: 风险可视与行动编排

**Files:**
- Create: `utils/directorMode/riskEvaluator.ts`
- Create: `utils/directorMode/actionComposer.ts`
- Modify: `components/game/CenterPanel.tsx`
- Modify: `components/game/CombatPanel.tsx`
- Test: `tests/directorMode/riskEvaluator.test.ts`

**Step 1: failing test（给定状态输出风险标签）**

**Step 2: 实现风险评估器（低/中/高）**

**Step 3: 在行动选项UI展示风险与收益标签**

**Step 4: 测试与提交**

---

### Task 5.2: 回合结算摘要与反馈链

**Files:**
- Modify: `hooks/gameLogic/extendedCommands.ts`
- Modify: `components/combat/BattleTimeline.tsx`
- Modify: `components/combat/CombatResolutionPanel.tsx`
- Test: `tests/directorMode/turnSummary.test.ts`

**Step 1: failing test（回合摘要正确汇总）**

**Step 2: 实现摘要生成器（命中/伤害/状态变化/资源）**

**Step 3: 接入时间线与结算面板**

**Step 4: 测试与提交**

---

## Phase 6：稳定化与发布

### Task 6.1: 全链路回归与性能守卫

**Files:**
- Modify: `tests/aiRouting.test.ts`
- Create: `tests/e2e/dndAdapterFlow.test.ts`
- Modify: `DEVREADME.md`
- Modify: `docs/plans/artifacts/dnd-gap-backlog.md`

**Step 1: 增加关键场景回归测试**
- 开局 -> 战斗 -> 掷骰 -> 结算 -> 日志 -> 存档。

**Step 2: 执行全量验证**
```bash
npm test
npm run build
```

**Step 3: 记录性能指标与已知限制**
- 首屏、战斗面板响应、模板切换耗时。

**Step 4: 发布前提交**
```bash
git add tests DEVREADME.md docs/plans/artifacts/dnd-gap-backlog.md
git commit -m "chore: 完成DND适配全链路回归与发布文档"
```

---

## 验收标准（Definition of Done）

1. 参考模板 21 张表至少达到：
   - 核心 10 表 `完全可用`
   - 其余表 `有明确定义与执行路径`
2. `GameState` 仍为唯一写入真源，无双写冲突。
3. 战斗/骰池/行动/日志链路在事务与一致性校验下稳定。
4. 模板工作流支持：导入导出、预设切换、profile 隔离。
5. Director Mode 可在 UI 层清晰提升互动感（风险标签 + 回合反馈）。
6. `npm test` 与 `npm run build` 通过。
7. 在非战斗日常界面可见：仪表盘入口、四象限信息、常驻行动交互条。

---

## 执行顺序建议（严格）

1. 先完成已进行中的 Phase 0 + Phase 1（你当前进度）。
2. 立即执行 Phase 1.5（UI Sprint），确保每轮都可见变化。
3. UI Sprint 评审通过后推进 Phase 2 + Phase 3。
4. 再推进 Phase 4（模板工作流），最后上 Phase 5（Director Mode 深化）。
5. Phase 6 只做稳定化，不引入新能力。

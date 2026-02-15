# DXC 异步 State 变量体系迁移执行清单（task.md）

更新时间：2026-02-15
适用仓库：`E:\github\Aha-Loop\DXC`
基线文档：`docs/plans/2026-02-15-async-state-variable-migration-plan.md`

## 一句话目标

在 **不废弃现有表格体系**、**不改 memory 总结/大纲链路** 的前提下，落地“变量事件序列化 + 异步 writer”写入路径，系统性降低数值漂移与覆盖冲突。

---

## 0. 硬约束（执行前先确认）

- [x] 保持 table-first 存储事实源，不做“回退旧版直写”方案。
- [x] `LOG_Summary` / `LOG_Outline` 与 `append_log_summary` / `append_log_outline` **不纳入迁移范围**。
- [x] 主叙事链路在 state service 启用时继续 `"tavern_commands": []`。
- [x] 单元测试后台执行时，单条命令最大超时 `60s`。
- [x] 每个阶段必须产出可回滚点（feature flag 或路由开关）。

---

## 1. 执行方式与节奏

## 1.1 分支与提交节奏

- 建议分支：`feat/state-variable-writer-serial`
- 提交粒度：每完成 1 ~ 2 个 Task 提交一次。
- 提交格式：`feat|fix|refactor|test|docs: 中文简短描述`

## 1.2 测试 60s 超时包装（PowerShell）

先定义一次（会话内复用）：

```powershell
function Invoke-Test60 {
  param([string]$Command)
  $p = Start-Process -FilePath powershell -ArgumentList '-NoProfile','-Command', $Command -PassThru -NoNewWindow
  if (-not $p.WaitForExit(60000)) {
    try { $p.Kill() } catch {}
    throw "Test timeout > 60s: $Command"
  }
  if ($p.ExitCode -ne 0) {
    throw "Test failed ($($p.ExitCode)): $Command"
  }
}
```

示例：

```powershell
Invoke-Test60 "npm run test -- tests/taverndb/tableStore.test.ts"
Invoke-Test60 "npm run test -- tests/taverndb/turnTransaction.test.ts"
```

---

## 2. 任务总览（依赖图）

- Stage A：基线与边界固化（A01 ~ A06）
- Stage B：变量事件模型（B01 ~ B08）
- Stage C：异步 writer（影子模式）（C01 ~ C11）
- Stage D：试点切流（GlobalState / Resources / Inventory）（D01 ~ D12）
- Stage E：全域迁移与收口（E01 ~ E08）
- Stage F：观测、回放、回滚演练（F01 ~ F09）

并行建议：
- B 组测试与类型可并行。
- C 组 writer 与 replay 可并行。
- D 组按域拆分可并行，但同域任务串行。

---

## 3. Stage A：基线与边界固化

### A01 基线快照任务

- [x] 目标：记录迁移前冲突率、回滚率、漂移样本。
- 依赖：无。
- 文件：
  - 新增：`docs/plans/2026-02-15-state-migration-baseline.md`
- 操作：
  1. 统计最近可用回合中的 `conflictStats.total/byReason`。
  2. 记录 `SYS_GlobalState`、`CHARACTER_Resources`、`ITEM_Inventory` 的典型漂移案例。
  3. 固化为 baseline 文档。
- 验收：
  - [x] baseline 文档包含样本、指标、采样方式。

### A02 迁移范围守卫（memory 排除）

- [x] 目标：代码层面固定“memory 不迁移”的红线。
- 依赖：A01。
- 文件：
  - 修改：`hooks/gameLogic/microservice/commandGuard.ts`
  - 修改：`prompts/system.ts`
  - 修改：`prompts/commands.ts`
- 操作：
  1. guard 增加注释与断言：`append_log_summary/append_log_outline` 不进入 writer。
  2. prompt 文案补充“LOG_Summary/LOG_Outline 不在迁移范围”。
- 验收：
  - [x] `rg -n "LOG_Summary|LOG_Outline|不在迁移范围" prompts hooks/gameLogic/microservice/commandGuard.ts` 有命中。

### A03 迁移开关定义

- [x] 目标：为双写/切流提供可回滚开关。
- 依赖：A02。
- 文件：
  - 修改：`types/ai.ts`（或配置类型定义处）
  - 修改：`hooks/useAppSettings.ts`
  - 修改：`components/game/modals/settings/SettingsContext.tsx`
- 新增开关建议：
  - `stateVarWriter.enabled`
  - `stateVarWriter.shadowMode`
  - `stateVarWriter.cutoverDomains`
  - `stateVarWriter.rejectNonWriterForCutoverDomains`
- 验收：
  - [x] 设置可持久化读取。
  - [x] 默认值不改变现有行为。

### A04 最小回归防线补齐

- [x] 目标：先补失败测试，再改实现。
- 依赖：A03。
- 文件：
  - 新增：`tests/state/stateVariableMigrationGuard.test.ts`
- 覆盖点：
  - memory 命令不进 writer。
  - 未开启 writer 时行为不变。
  - 启用 shadowMode 不影响现有落表结果。
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/state/stateVariableMigrationGuard.test.ts"`

### A05 文档链接固化

- [x] 目标：把执行清单与架构计划互链，防止信息分叉。
- 依赖：A01。
- 文件：
  - 修改：`docs/plans/2026-02-15-async-state-variable-migration-plan.md`
- 验收：
  - [x] 计划文档存在 `task.md` 引用。

### A06 Stage A 提交

- [x] 提交建议：`docs: 固化 state 变量迁移边界与开关定义`
- [x] 提交前验证：
  - `Invoke-Test60 "npm run test -- tests/state/stateVariableMigrationGuard.test.ts"`

---

## 4. Stage B：变量事件模型（不改变落表路径）

### B01 定义事件类型

- [x] 目标：引入统一事件结构。
- 依赖：A06。
- 文件：
  - 新增：`utils/taverndb/stateVariableEvent.ts`
- 类型字段：
  - `event_id`, `turn_id`, `source`, `domain`, `entity_id`, `path`, `op`, `value`, `expected_version`, `idempotency_key`, `created_at`
- 验收：
  - [x] 导出类型 + 工具函数（创建、校验、归一化）。

### B02 事件 schema 校验器

- [x] 目标：拒绝无效事件。
- 依赖：B01。
- 文件：
  - 修改：`utils/taverndb/stateVariableEvent.ts`
  - 新增：`tests/taverndb/stateVariableEvent.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/taverndb/stateVariableEvent.test.ts"`

### B03 路径 -> 域映射器

- [x] 目标：规范化 `gameState.xxx` 到 domain/sheet 目标。
- 依赖：B02。
- 文件：
  - 新增：`utils/taverndb/stateVariableMapping.ts`
  - 修改：`utils/taverndb/sheetRegistry.ts`（必要时仅补注释/映射入口）
- 验收：
  - [x] 覆盖 `SYS_GlobalState`、`CHARACTER_Resources`、`ITEM_Inventory` 三域映射。

### B04 事件构建器（桥接层）

- [x] 目标：从 runtime 命令生成变量事件，但先不接管写入。
- 依赖：B03。
- 文件：
  - 修改：`hooks/gameLogic/useGameLogicCore.ts`
  - 新增：`tests/state/stateVariableBridge.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/state/stateVariableBridge.test.ts"`

### B05 事件审计表接入

- [x] 目标：新增事件日志，不替代原审计。
- 依赖：B04。
- 文件：
  - 修改：`utils/taverndb/sheetRegistry.ts`
  - 修改：`hooks/gameLogic/extendedCommands.ts`（如涉及表写处理入口）
- 表建议：
  - `SYS_StateVarEventLog`
  - `SYS_StateVarApplyLog`
- 验收：
  - [x] 两张表可被 upsert 并可投影查看。

### B06 审计写入测试

- [x] 目标：验证事件日志可落库。
- 依赖：B05。
- 文件：
  - 新增：`tests/taverndb/stateVariableAuditTables.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/taverndb/stateVariableAuditTables.test.ts"`

### B07 Stage B 回归

- [x] 验收命令：
  - `Invoke-Test60 "npm run test -- tests/taverndb/stateVariableEvent.test.ts"`
  - `Invoke-Test60 "npm run test -- tests/state/stateVariableBridge.test.ts"`
  - `Invoke-Test60 "npm run test -- tests/taverndb/stateVariableAuditTables.test.ts"`

### B08 Stage B 提交

- [x] 提交建议：`feat: 新增 state 变量事件模型与审计表`

---

## 5. Stage C：异步 Writer（影子模式）

### C01 Writer 骨架

- [x] 目标：实现事件消费器基础能力。
- 依赖：B08。
- 文件：
  - 新增：`hooks/gameLogic/microservice/stateVariableWriter.ts`
- 能力：
  - 批量消费
  - 幂等去重
  - 调用现有事务提交

### C02 分区队列策略

- [x] 目标：同实体顺序、跨实体并行。
- 依赖：C01。
- 文件：
  - 新增：`hooks/gameLogic/microservice/stateVariableQueue.ts`
  - 新增：`tests/state/stateVariableQueue.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/state/stateVariableQueue.test.ts"`

### C03 事件 -> patch 映射

- [x] 目标：writer 把事件转成 `sheet patch`。
- 依赖：C02。
- 文件：
  - 修改：`hooks/gameLogic/microservice/stateVariableWriter.ts`
  - 修改：`utils/taverndb/stateVariableMapping.ts`
- 验收：
  - [x] 支持 `set/add/push/delete` 到目标 sheet row。

### C04 冲突处理策略落地

- [x] 目标：加入版本冲突重试与拒绝策略。
- 依赖：C03。
- 文件：
  - 修改：`hooks/gameLogic/microservice/stateVariableWriter.ts`
  - 修改：`utils/taverndb/tableStore.ts`
- 新冲突码建议：
  - `idempotency_conflict`
  - `stale_event`
- 验收：
  - [x] 冲突日志进入 `conflictStats.byReason`。

### C05 影子模式接线

- [x] 目标：writer 跑影子写，不影响真实写入。
- 依赖：C04。
- 文件：
  - 修改：`hooks/gameLogic/useGameLogicCore.ts`
  - 修改：`hooks/useAppSettings.ts`
- 验收：
  - [x] `shadowMode=true` 下业务行为与当前一致。

### C06 差异对账器

- [x] 目标：对比“真实写入 vs writer 重放”结果。
- 依赖：C05。
- 文件：
  - 新增：`utils/taverndb/stateVariableDiff.ts`
  - 新增：`tests/taverndb/stateVariableDiff.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/taverndb/stateVariableDiff.test.ts"`

### C07 Writer 指标投影

- [x] 目标：暴露积压、重试、失败域分布。
- 依赖：C06。
- 文件：
  - 修改：`utils/taverndb/tableProjection.ts`
  - 新增：`tests/taverndb/tableProjection.stateWriterMetrics.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/taverndb/tableProjection.stateWriterMetrics.test.ts"`

### C08 影子模式端到端测试

- [x] 目标：三域样本在 shadow 下完成对账。
- 依赖：C07。
- 文件：
  - 新增：`tests/state/stateVariableShadowMode.e2e.test.tsx`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/state/stateVariableShadowMode.e2e.test.tsx"`

### C09 Stage C 回归

- [x] 重点回归：
  - `tests/state/logTableAutofill.test.tsx`（memory 不受影响）
  - `tests/taverndb/turnTransaction.test.ts`
  - `tests/taverndb/tableStore.test.ts`
- 命令：
  - `Invoke-Test60 "npm run test -- tests/state/logTableAutofill.test.tsx"`
  - `Invoke-Test60 "npm run test -- tests/taverndb/turnTransaction.test.ts"`
  - `Invoke-Test60 "npm run test -- tests/taverndb/tableStore.test.ts"`

### C10 Stage C 提交

- [x] 提交建议：`feat: 引入 state variable writer 影子模式`

### C11 阶段评审 Gate

- [x] 条件：
  - 影子对账差异率 <= 5%
  - memory 相关用例 0 回归
- [x] 未达标：不适用（已达标并进入 D）。

---

## 6. Stage D：试点切流（仅 3 域）

试点域：
- `SYS_GlobalState`
- `CHARACTER_Resources`
- `ITEM_Inventory`

排除域：
- `LOG_Summary`
- `LOG_Outline`

### D01 切流配置生效

- [x] 目标：仅 3 域启用 writer 主写。
- 依赖：C11。
- 文件：
  - 修改：`hooks/useAppSettings.ts`
  - 修改：`hooks/gameLogic/useGameLogicCore.ts`
- 验收：
  - [x] `cutoverDomains` 可精确配置。

### D02 非 writer 来源拒绝（试点域）

- [x] 目标：阻断绕过写入。
- 依赖：D01。
- 文件：
  - 修改：`utils/taverndb/turnTransaction.ts`
  - 修改：`hooks/gameLogic/useGameLogicCore.ts`
- 验收：
  - [x] 非 writer 写入试点域被拒绝并记审计日志。

### D03 GlobalState 切流测试

- [x] 文件：
  - 新增：`tests/state/stateWriter.cutover.globalState.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/state/stateWriter.cutover.globalState.test.ts"`

### D04 Character_Resources 切流测试

- [x] 文件：
  - 新增：`tests/state/stateWriter.cutover.characterResources.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/state/stateWriter.cutover.characterResources.test.ts"`

### D05 Inventory 切流测试

- [x] 文件：
  - 新增：`tests/state/stateWriter.cutover.inventory.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/state/stateWriter.cutover.inventory.test.ts"`

### D06 memory 不受影响回归

- [x] 文件：
  - 复用：`tests/state/logTableAutofill.test.tsx`
  - 复用：`tests/memory/logSourceOwnership.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/state/logTableAutofill.test.tsx"`
  - `Invoke-Test60 "npm run test -- tests/memory/logSourceOwnership.test.ts"`

### D07 冲突注入测试

- [x] 目标：验证并发冲突可控。
- 依赖：D02。
- 文件：
  - 新增：`tests/state/stateWriter.conflictInjection.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/state/stateWriter.conflictInjection.test.ts"`

### D08 指标门禁

- [x] 条件：
  - 试点域漂移率较 baseline 降低 >= 50%
  - 试点域覆盖冲突率降低 >= 30%
- [x] 输出：`docs/plans/2026-02-15-state-migration-pilot-report.md`

### D09 Stage D 提交

- [x] 提交建议：`feat: state writer 试点域切流`

### D10 回滚演练（试点）

- [x] 目标：验证一键回退可用。
- 操作：
  - 关闭 `stateVarWriter.enabled` 或清空 `cutoverDomains`
- 验收：
  - [x] 行为恢复到旧路径，测试通过。

### D11 试点阶段复盘

- [x] 目标：记录异常样本与修复策略。
- 输出：`docs/plans/2026-02-15-state-migration-pilot-retro.md`

### D12 进入全域评审

- [x] 评审结论：通过/不通过（若不通过返回 C 或 D 修复）。

---

## 7. Stage E：全域迁移与收口

### E01 全域切换清单确认

- [x] 目标：列出除 memory 外所有待切域。
- 依赖：D12。
- 文件：
  - 新增：`docs/plans/2026-02-15-state-migration-cutover-domains.md`

### E02 批量切流（按模块波次）

- [x] 波次建议：
  1. `character + inventory + global_state`（已试点）
  2. `quest + story + world`
  3. `phone + map + combat + social + economy + ui`
- 验收：每波次都要跑对应模块测试。

### E03 legacy 直写桥收口

- [x] 目标：`set/add/push/delete` 仅进事件桥，不再直接落业务字段。
- 文件：
  - 修改：`hooks/gameLogic/useGameLogicCore.ts`
  - 修改：`utils/aiPrompt.ts`
- 验收：
  - [x] 业务直写路径被统一拒绝或桥接。

### E04 Prompt 收口

- [x] 目标：避免模型重新学习 legacy 直写。
- 文件：
  - 修改：`prompts/system.ts`
  - 修改：`prompts/commands.ts`
- 验收：
  - [x] 说明“变量更新由 writer 内部处理”。

### E05 投影与诊断补齐

- [x] 目标：UI/日志可观察 writer 健康度。
- 文件：
  - 修改：`utils/taverndb/tableProjection.ts`
  - 视需要修改：`components/game/modals/MemoryModal.tsx`（仅展示指标，不改 memory 流）

### E06 全量回归

- [x] 验收命令（可分批 60s）：
  - `Invoke-Test60 "npm run test -- tests/taverndb/tableStore.test.ts"`
  - `Invoke-Test60 "npm run test -- tests/taverndb/turnTransaction.test.ts"`
  - `Invoke-Test60 "npm run test -- tests/taverndb/tableProjection.test.ts"`
  - `Invoke-Test60 "npm run test -- tests/state/logTableAutofill.test.tsx"`
  - `Invoke-Test60 "npm run test -- tests/memory/logSourceOwnership.test.ts"`

### E07 Stage E 提交

- [x] 提交建议：`refactor: 全域切换至 state variable writer`

### E08 收口清理

- [x] 删除或封存迁移期临时代码与一次性脚本。
- [x] 保留可回滚开关至少 1 个版本周期。

---

## 8. Stage F：回放、稳定性与上线门禁

### F01 事件回放工具

- [x] 文件：
  - 新增：`utils/taverndb/stateVariableReplay.ts`
  - 新增：`tests/taverndb/stateVariableReplay.test.ts`
- 验收命令：
  - `Invoke-Test60 "npm run test -- tests/taverndb/stateVariableReplay.test.ts"`

### F02 快照一致性检查

- [x] 目标：同回合快照重放后状态一致。
- 文件：
  - 新增：`tests/state/stateReplayConsistency.test.ts`

### F03 漂移追踪任务

- [x] 输出：`docs/plans/2026-02-15-state-migration-drift-report.md`
- [x] 指标：
  - 漂移率下降 >= 80%
  - 覆盖冲突率下降 >= 60%

### F04 性能门禁

- [x] 指标：
  - 事件处理 P95 <= 300ms
  - 队列积压峰值可解释且可恢复

### F05 灰度发布开关策略

- [x] 明确：按域开、按环境开、按账号开（如支持）。

### F06 失败自动降级

- [x] 目标：writer 异常时阻断并告警（按当前要求不启用 fallback 兜底）。

### F07 memory 兼容确认（最终）

- [x] 验证项：
  - `LOG_Summary` / `LOG_Outline` 生成逻辑无改动
  - AM 编码与配对逻辑无回归

### F08 上线复盘

- [x] 输出：`docs/plans/2026-02-15-state-migration-final-retro.md`

### F09 最终提交

- [x] 提交建议：`chore: 完成 state 变量体系迁移与验证`

---

## 9. 执行顺序（建议）

1. 先做 A -> B，确保“只加不改行为”。
2. 完成 C 影子模式并达标后再进 D 试点。
3. D 未达标不进入 E。
4. E 完成后必须经过 F 的回放与门禁。

---

## 10. 每日执行模板（可复制）

```markdown
## 今日批次
- 计划任务：A03, A04, A05
- 实际完成：
- 阻塞项：
- 风险：
- 回滚点：
- 相关提交：
- 测试记录（含 60s 超时结果）：
```

---

## 11. 明确非目标（本轮不做）

- 不重构 memory 总结/大纲体系。
- 不实现“按编码检索召回”的 memory 新架构。
- 不迁移 `LOG_Summary`、`LOG_Outline` 到 writer。
- 不删除现有 table-first 存储结构。

---

## 12. 开工指令（下次会话直接用）

建议开场输入：

```text
按 task.md 从 Stage A 开始执行。严格遵守 memory 排除边界：LOG_Summary/LOG_Outline 不迁移。每完成 1-2 个 Task 提交一次，并回报测试结果。
```

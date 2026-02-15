[根目录](../CLAUDE.md) > **tests**

# Tests 模块

## 模块职责
提供 DXC 的回归安全网，重点覆盖 strict routing、state writer cutover、rollback drill、replay consistency 与 writer 指标投影。

## 入口与启动
- `tests/setup.ts`: Vitest 环境初始化
- 运行命令：`npm run test`

## 对外接口
- 不对运行时暴露接口；对开发流程提供稳定性验证信号

## 关键依赖与配置
- Vitest + jsdom + Testing Library
- 配置来源：`vitest.config.ts`

## 数据模型
- 统一使用 `createNewGameState` 构造状态
- 关键断言对象：`TavernCommand` / `StateVariableEvent` / `__tableMeta` / `__stateVarWriter*`

## State 测试矩阵（文件 -> 覆盖能力）
### 1) strict routing / service execution
- `tests/state/serviceRunnerStrictRouting.test.ts`
  - 验证 memory/state/map 严格分流
  - 验证 state 路径不发生跨服务误路由
- `tests/state/serviceRunnerEconomyFallback.test.ts`
  - 验证 state 缺失经济命令时注入 `apply_econ_delta`
- `tests/state/econNarrativeFallback.test.ts`
  - 验证金额抽取、中文数字、已有经济命令时不重复注入

### 2) writer 事件语义 / 版本冲突
- `tests/state/stateVariableWriter.test.ts`
  - 覆盖 `set/add/push/delete/upsert` 映射
  - 覆盖 `duplicate_idempotency`、`stale_event`
  - 覆盖 `conflictStats` 与 writer runtime metrics
- `tests/taverndb/stateVariableEvent.test.ts`
  - 覆盖事件 schema、规范化、batch envelope

### 3) cutover / rollback drill / source ownership
- `tests/state/stateWriter.cutover.globalState.test.ts`
- `tests/state/stateWriter.cutover.characterResources.test.ts`
- `tests/state/stateWriter.cutover.inventory.test.ts`
  - 覆盖三大 pilot domain 的 cutover 写入路径
- `tests/state/stateWriter.rollbackDrill.test.ts`
  - writer disabled 时恢复旧写入路径（验证 source_not_allowed 不应误触发）
- `tests/state/stateWriter.conflictInjection.test.ts`
  - 注入 `source_not_allowed` / `row_version_conflict` 并验证回滚
- `tests/taverndb/turnTransaction.test.ts`
  - 验证事务回滚、提交、txJournal 与并发冲突

### 4) replay consistency / diff
- `tests/state/stateReplayConsistency.test.ts`
  - 同回合快照与 event-log replay 一致性
- `tests/taverndb/stateVariableReplay.test.ts`
  - 从 `SYS_StateVarEventLog` 回放 + invalid row 统计
- `tests/taverndb/stateVariableDiff.test.ts`
  - missing/changedRows/changedCells 维度 diff

### 5) migration guard / shadow mode / queue
- `tests/state/stateVariableMigrationGuard.test.ts`
  - memory/state 命令边界 + writer 默认开关迁移
- `tests/state/stateVariableShadowMode.e2e.test.tsx`
  - shadowMode 不接管业务写入，仅产出 shadow 指标
- `tests/state/stateVariableQueue.test.ts`
  - 分区 FIFO 与跨分区并行
- `tests/taverndb/tableProjection.stateWriterMetrics.test.ts`
  - writer shadow/queue/failure 指标投影到 `SYS_ValidationIssue`

## 测试与质量
- state 主线：`tests/state/*`
- TavernDB 基础设施：`tests/taverndb/*`
- 其他域：`tests/ui/*`, `tests/components/*`, `tests/memory/*`

## State 故障快速定位（测试失败 -> 先看哪里）

| 失败现象 / 关键词 | 先看测试 | 首要定位文件 |
|---|---|---|
| strict routing / service 串路由 | `tests/state/serviceRunnerStrictRouting.test.ts` | `hooks/gameLogic/microservice/serviceRunner.ts` |
| `apply_econ_delta` 缺失/重复 | `tests/state/serviceRunnerEconomyFallback.test.ts`, `tests/state/econNarrativeFallback.test.ts` | `hooks/gameLogic/microservice/serviceRunner.ts`, `utils/state/econNarrativeFallback.ts` |
| `source_not_allowed` / cutover 拒写 | `tests/state/stateWriter.conflictInjection.test.ts`, `tests/state/stateWriter.cutover.*.test.ts` | `utils/taverndb/turnTransaction.ts`, `hooks/gameLogic/useGameLogicCore.ts` |
| `row_version_conflict` / `sheet_version_conflict` | `tests/taverndb/turnTransaction.test.ts`, `tests/state/stateWriter.conflictInjection.test.ts` | `utils/taverndb/turnTransaction.ts`, `utils/taverndb/tableStore.ts` |
| `stale_event` / `duplicate_idempotency` | `tests/state/stateVariableWriter.test.ts` | `hooks/gameLogic/microservice/stateVariableWriter.ts`, `utils/taverndb/stateVariableEvent.ts` |
| replay diff 不一致 | `tests/state/stateReplayConsistency.test.ts`, `tests/taverndb/stateVariableReplay.test.ts`, `tests/taverndb/stateVariableDiff.test.ts` | `utils/taverndb/stateVariableBridge.ts`, `utils/taverndb/stateVariableReplay.ts`, `utils/taverndb/stateVariableDiff.ts` |
| writer 指标异常（shadow/queue/failure） | `tests/taverndb/tableProjection.stateWriterMetrics.test.ts`, `tests/state/stateVariableQueue.test.ts`, `tests/state/stateVariableShadowMode.e2e.test.tsx` | `utils/taverndb/tableProjection.ts`, `hooks/gameLogic/microservice/stateVariableQueue.ts`, `hooks/gameLogic/microservice/stateVariableWriter.ts` |
| 经济守卫/不变量失败 | `tests/state/economicGuardFlow.test.tsx`, `tests/state/invariants.test.ts`, `tests/state/economicLedger.test.ts` | `hooks/gameLogic/useGameLogicCore.ts`, `utils/state/invariants.ts`, `utils/state/economicLedger.ts` |

## 常见问题 (FAQ)
- Q: 做 state 全局 debug 最先跑哪些？
  - A: 先跑 `serviceRunnerStrictRouting`、`stateVariableWriter`、`stateWriter.conflictInjection`、`stateReplayConsistency`。
- Q: 如何确认 writer 指标链路通了？
  - A: 看 `tableProjection.stateWriterMetrics.test.ts`。
- Q: 跑完测试后怎么最快定位？
  - A: 先按本页“State 故障快速定位”匹配关键词，再进对应“首要定位文件”，避免全仓语义检索。

## 相关文件清单
- `tests/state/serviceRunnerStrictRouting.test.ts`
- `tests/state/stateVariableWriter.test.ts`
- `tests/state/stateWriter.rollbackDrill.test.ts`
- `tests/state/stateReplayConsistency.test.ts`
- `tests/taverndb/turnTransaction.test.ts`
- `tests/taverndb/stateVariableReplay.test.ts`

## 变更记录 (Changelog)
- **2026-02-15 15:51:21**: 新增“State 故障快速定位”映射表（失败关键词 -> 对应测试 -> 首要定位文件），用于测试失败后直接定位。
- **2026-02-15 15:18:41**: ECONNRESET 重试后完善 state 测试矩阵措辞，补充 rollback drill 与 source ownership 关联说明。
- **2026-02-15 14:59:52**: 新建 tests 模块文档，按领域梳理测试分层。

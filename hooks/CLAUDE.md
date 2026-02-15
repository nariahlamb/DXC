[根目录](../CLAUDE.md) > **hooks**

# Hooks 模块

## 模块职责
承载游戏状态主流程、AI 服务编排、命令队列与写表流水线，是 DXC 的应用调度内核。

## 入口与启动
- `hooks/useGameLogic.ts`: 对外导出门面（重导 `gameLogic/useGameLogicCore.ts`）
- `hooks/gameLogic/useGameLogicCore.ts`: 核心状态机（回合、微服务请求、事务应用、守卫回滚）
- `hooks/useAppSettings.ts`: 设置默认值、迁移与持久化

## 对外接口
- Hook API: `useGameLogic(initialState, onExit)`
- Microservice 链路：
  - 输入构建：`hooks/gameLogic/microservice/inputBuilder.ts`
  - 服务路由：`hooks/gameLogic/microservice/serviceRunner.ts`
  - 写入事务：`hooks/gameLogic/microservice/applyTransaction.ts`
  - 命令边界：`hooks/gameLogic/microservice/commandGuard.ts`
  - 事件消费：`hooks/gameLogic/microservice/stateVariableWriter.ts`

## 关键依赖与配置
- `settings.stateVarWriter`（定义位于 `hooks/gameLogic/useGameLogicCore.ts`）：
  - `enabled`
  - `shadowMode`
  - `cutoverDomains`
  - `rejectNonWriterForCutoverDomains`
- `createApplyCommandsWithTurnTransaction(...)` 强制 `forceAtomic: true`（文件：`hooks/gameLogic/microservice/applyTransaction.ts`）
- `useGameLogicCore` 中 cutover 流程：
  - `rewriteCommandsForStateWriterCutover(...)`
  - `resolveStateWriterCutoverSheets(...)`
  - `commandTouchesCutoverSheet(...)`

## State 调用链（文件路径级）
1. `handleAIInteraction(...)`（`hooks/gameLogic/useGameLogicCore.ts`）触发服务执行。
2. `createServiceInputBuilder(...)`（`hooks/gameLogic/microservice/inputBuilder.ts`）组装 state/memory 输入。
3. `executeServiceRequest(...)`（`hooks/gameLogic/microservice/serviceRunner.ts`）按 `serviceKey` 严格分流：
   - `memory` 仅走 `runMemoryParallelBySheet`
   - `state` 仅走 `runStateParallelBySheet`
   - `map` 仅走 `generateServiceCommands('map', ...)`
4. `filterCommandsForService(...)`（`hooks/gameLogic/microservice/commandGuard.ts`）切断 memory/state 边界。
5. `applyCommandsWithTurnTransaction(...)` 应用命令，进入 `utils/taverndb/turnTransaction.ts`。
6. bridge + writer：
   - bridge: `utils/taverndb/stateVariableBridge.ts`
   - writer: `hooks/gameLogic/microservice/stateVariableWriter.ts`
7. 后置守卫：`validateStateInvariants(...)` + 配对校验失败时回滚到 `stateWithUserLog`。

## writer 事件语义（set/add/push/delete + version）
- 事件定义：`utils/taverndb/stateVariableEvent.ts`
  - `op`: `set/add/push/delete/upsert`
  - `expected_version`
  - `idempotency_key`
- 事件消费：`consumeStateVariableEvents(...)`（`hooks/gameLogic/microservice/stateVariableWriter.ts`）
  - `duplicate_idempotency`：跳过并累计 `idempotency_conflict`
  - `stale_event`：比较 `expected_version` 与 `__tableMeta.rowVersions`，命中则跳过
  - 命令输出：`upsert_sheet_rows` / `delete_sheet_rows`
  - 审计输出：`SYS_StateVarEventLog` / `SYS_StateVarApplyLog`

## 失败路径与降级策略
- 回滚（事务层）：
  - 来源不合法（`source_not_allowed`）
  - 行/表版本冲突（`row_version_conflict` / `sheet_version_conflict`）
  - apply error（含命令执行异常）
- 拒绝写入（writer 层）：
  - `stale_event` / `duplicate_idempotency` / `invalid_event` / `no_command`
- 降级（服务层）：
  - state 漏写经济变更时，由 `serviceRunner.ts` 触发 `applyNarrativeEconomicFallback` 注入 `apply_econ_delta`

## 数据模型
- 主状态：`types/gamestate.ts`
- 命令：`types/ai.ts`, `types/taverndb.ts`
- 事件：`utils/taverndb/stateVariableEvent.ts`

## 测试与质量
- 严格路由：`tests/state/serviceRunnerStrictRouting.test.ts`
- writer 语义：`tests/state/stateVariableWriter.test.ts`
- 影子模式：`tests/state/stateVariableShadowMode.e2e.test.tsx`
- cutover/drill：
  - `tests/state/stateWriter.cutover.globalState.test.ts`
  - `tests/state/stateWriter.cutover.characterResources.test.ts`
  - `tests/state/stateWriter.cutover.inventory.test.ts`
  - `tests/state/stateWriter.rollbackDrill.test.ts`
  - `tests/state/stateWriter.conflictInjection.test.ts`
- 迁移门禁：`tests/state/stateVariableMigrationGuard.test.ts`

## 常见问题 (FAQ)
- Q: strict routing 在哪里落实？
  - A: `hooks/gameLogic/microservice/serviceRunner.ts` 的 `executeServiceRequest(...)`。
- Q: cutover 打开后如何阻止旧 source 写入？
  - A: `useGameLogicCore.ts` 为 turn transaction 注入 `sourceOwnershipRules`，仅允许 `ms:state-writer`。
- Q: stale event 如何判定？
  - A: `stateVariableWriter.ts` 读取 `__tableMeta.rowVersions` 与事件 `expected_version` 对比。

## 相关文件清单
- `hooks/useGameLogic.ts`
- `hooks/gameLogic/useGameLogicCore.ts`
- `hooks/gameLogic/microservice/serviceRunner.ts`
- `hooks/gameLogic/microservice/stateVariableWriter.ts`
- `hooks/gameLogic/microservice/commandGuard.ts`
- `hooks/gameLogic/microservice/inputBuilder.ts`

## 变更记录 (Changelog)
- **2026-02-15 15:18:41**: ECONNRESET 重试后补全 state 深扫：补齐 strict routing、cutover source ownership、stale_event 判定与回滚路径文档。
- **2026-02-15 15:12:37**: 修正设置层文档，明确四路 AI 服务默认值与旧档迁移逻辑。
- **2026-02-15 14:59:52**: 新建 hooks 模块文档，补充微服务与 state variable writer 链路索引。

[根目录](../CLAUDE.md) > **utils**

# Utils 模块

## 模块职责
提供 AI 调度、状态输入裁剪、TavernDB 投影/事务/回放/diff、存储适配等横切能力。

## 入口与启动
- `utils/ai.ts`: AI 子模块聚合导出
- `utils/aiGenerate.ts`: 主生成逻辑
- `utils/aiDispatch.ts`: provider 请求与流式处理
- `utils/taverndb/*`: table-first 基础设施（投影、事务、回放、映射）

## 对外接口
- AI: `dispatchAIRequest`, `generateDungeonMasterResponse`, `generateServiceCommands`
- 状态输入: `buildStateServiceInputPayload`（`utils/state/stateServiceInput.ts`）
- TavernDB:
  - `projectGameStateToTavernTables`
  - `applyTurnTransaction`
  - `buildStateVariableEventsFromCommands`
  - `replayStateVariableEventsToSnapshot` / `replayStateVariableEventLogFromState`
  - `diffStateVariableSnapshots`

## 关键依赖与配置
- provider 分发：
  - `gemini` 分支使用 `@google/genai`
  - `openai` / `deepseek` / `custom` 走 OpenAI-compatible 接口
- `resolveServiceConfig(settings, serviceKey)` 将服务键路由到 `story/memory/state/map`
- Sheet/Domain SSOT：`utils/taverndb/sheetRegistry.ts`
  - 包含 `SYS_StateVarEventLog` / `SYS_StateVarApplyLog` 定义
  - 包含 `state_var_event_log` / `state_var_apply_log` 映射

## State debug 重点文件与职责
- `utils/taverndb/tableProjection.ts`
  - 将 `__tableMeta.conflictStats`、`__stateVarWriterShadow`、`__stateVarWriter.metrics` 投影到 `SYS_ValidationIssue`
  - 指标键：`METRIC_STATE_WRITER_SHADOW` / `METRIC_STATE_WRITER_QUEUE` / `METRIC_STATE_WRITER_FAILURE_DIST`
- `utils/taverndb/turnTransaction.ts`
  - 事务提交/回滚核心；冲突类型与 source ownership 阻断
  - 审计：`__tableMeta.txJournal`
- `utils/taverndb/tableStore.ts`
  - 维护 `sheetVersions`/`rowVersions`/lock/conflictStats
  - `applyPatchesWithReport` 输出冲突报告
- `utils/taverndb/stateVariableEvent.ts`
  - 事件 schema：`op=set/add/push/delete/upsert`
  - `expected_version` 与 `idempotency_key` 规范化
- `utils/taverndb/stateVariableBridge.ts`
  - legacy path / upsert_sheet_rows -> StateVariableEvent
  - 支持 `includeSheets` 仅桥接 pilot sheet
- `utils/taverndb/stateVariableReplay.ts`
  - 从 `SYS_StateVarEventLog` 解析事件并回放
  - 输出 replay snapshot + invalid rows 统计
- `utils/taverndb/stateVariableDiff.ts`
  - baseline vs replay 差异比较（missing/changedRows/changedCells）

## 失败路径与降级策略（utils 视角）
- 事务阻断：
  - `source_not_allowed`（受保护 sheet 非 writer source）
  - `row_version_conflict` / `sheet_version_conflict`
  - `cell_locked`
- 回放容错：
  - `stateVariableReplay.ts` 跳过坏日志行并统计 `invalidRows`
- 经济降级：
  - `utils/state/econNarrativeFallback.ts` 在 state 命令缺失时补 `apply_econ_delta`

## 数据模型
- `utils/contracts.ts`：协议验证（zod）
- `types/taverndb.ts`：table/patch/runtimeMeta/transaction trace
- `utils/taverndb/stateVariableEvent.ts`：writer 事件协议

## 测试与质量
- 事务：`tests/taverndb/turnTransaction.test.ts`
- 事件协议：`tests/taverndb/stateVariableEvent.test.ts`
- 回放与 diff：
  - `tests/taverndb/stateVariableReplay.test.ts`
  - `tests/taverndb/stateVariableDiff.test.ts`
  - `tests/state/stateReplayConsistency.test.ts`
- 指标投影：`tests/taverndb/tableProjection.stateWriterMetrics.test.ts`
- bridge：`tests/state/stateVariableBridge.test.ts`

## 常见问题 (FAQ)
- Q: writer 指标在哪里看？
  - A: `tableProjection.ts` 会把 writer 指标投影到 `SYS_ValidationIssue`。
- Q: 事务回滚证据在哪里？
  - A: `turnTransaction.ts` 会把 trace 追加到 `__tableMeta.txJournal`。
- Q: 为什么文档不能写成“Google API 项目”？
  - A: 运行时已支持 gemini/openai/deepseek/custom 多 provider。

## 相关文件清单
- `utils/taverndb/tableProjection.ts`
- `utils/taverndb/turnTransaction.ts`
- `utils/taverndb/tableStore.ts`
- `utils/taverndb/stateVariableEvent.ts`
- `utils/taverndb/stateVariableBridge.ts`
- `utils/taverndb/stateVariableReplay.ts`
- `utils/taverndb/stateVariableDiff.ts`
- `utils/state/stateServiceInput.ts`

## 变更记录 (Changelog)
- **2026-02-15 15:18:41**: ECONNRESET 重试后补齐 state 深扫证据：writer 指标投影键、source ownership 阻断与回放/diff 语义已对齐到具体文件。
- **2026-02-15 15:12:37**: 修正文档表述，明确多 provider dispatch 与四路服务路由事实。
- **2026-02-15 14:59:52**: 新建 utils 模块文档，补充 AI 与 TavernDB 工具链说明。

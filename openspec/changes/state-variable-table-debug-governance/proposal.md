## Why

当前 state 变量填表链路在“语义分析、轮次限定、变量范围控制”三条主轴上存在不稳定与不规范：同一类输入在不同轮次/不同开关组合下可能出现 silent skip、事务回滚、回放偏差与指标抖动。
项目已具备 strict routing、cutover、rollback、writer 审计等基础能力，但缺少统一治理约束与可验证门禁，导致问题难以持续收敛。

## What Changes

- 建立 state 变量填表治理基线，覆盖输入构建 → 服务路由 → 命令守卫 → 事务提交/回滚 → writer 事件语义 → 回放/diff/指标。
- 将“语义分析、轮次限定、变量范围控制”转为明确约束集（hard/soft）与可验证场景。
- 在不破坏现有 strict routing/cutover/rollback 审计链路前提下，补齐稳定性观测与失败分类（rollback/skip/fallback）。
- 形成分阶段优化策略（快速止血 / 结构修复 / 机制固化），并绑定回归测试矩阵。
- 将用户确认策略固化为约束：
  - 治理节奏：稳定性与规范并行推进；
  - 跨回合写入：采用软告警（不直接硬阻断）；
  - 变量范围：采用严格域白名单；
  - 经济兜底：保留但收紧触发条件与可解释性。

## Capabilities

### New Capabilities
- `state-variable-governance-baseline`: 定义 state 填表全链路治理基线、约束模型、失败分类与审计口径。
- `state-variable-semantic-turn-scope-guard`: 定义语义约束、跨回合软告警机制、域/表/字段范围白名单规则。
- `state-variable-replay-observability`: 定义 replay/diff 一致性门禁、不稳定性指标口径与验收阈值。
- `state-variable-econ-fallback-tightening`: 定义经济语义 fallback 的准入边界、误触发防护与观测要求。

### Modified Capabilities
- （当前仓库无既有 openspec/specs 能力定义，待 specs 阶段创建新能力基线）

## Impact

- 受影响核心代码：
  - `hooks/gameLogic/microservice/inputBuilder.ts`
  - `utils/state/stateServiceInput.ts`
  - `hooks/gameLogic/microservice/serviceRunner.ts`
  - `hooks/gameLogic/microservice/commandGuard.ts`
  - `hooks/gameLogic/microservice/applyTransaction.ts`
  - `hooks/gameLogic/microservice/stateVariableWriter.ts`
  - `utils/taverndb/turnTransaction.ts`
  - `utils/taverndb/tableProjection.ts`
  - `utils/taverndb/stateVariableReplay.ts`
  - `utils/taverndb/stateVariableDiff.ts`
  - `utils/state/econNarrativeFallback.ts`
  - `hooks/useAppSettings.ts`
- 受影响测试矩阵：`tests/state/*` 与 `tests/taverndb/*` 中 state writer/cutover/rollback/replay/metrics 相关用例。
- 对外 API 无新增，但会新增/收紧内部行为约束与告警指标；需保证现有开关语义兼容。

---

## Constraint Sets（研究产出）

### Hard Constraints（不可违反）
1. **路由边界不可串线**：memory/state/map 必须保持 strict routing，不允许跨服务写入越权。
2. **事务原子性不可放松**：state 写入路径保持 `forceAtomic: true`，冲突类错误需可回滚且可审计。
3. **writer 事件语义不可弱化**：`idempotency_key`、`expected_version`、`op` 语义必须可判定且可计数。
4. **source ownership 不可绕过**：cutover 保护域内仅允许白名单 source 前缀写入。
5. **变量范围必须可验证**：采用 domain+sheet+field 三层白名单，越域写入按拒绝策略执行。
6. **失败分类必须落账**：rollback / skip / fallback 三类路径需在日志或指标中可区分、可统计。
7. **回放一致性必须可量化**：replay/diff 结果需可输出 totals（missing/changedRows/changedCells）用于门禁。
8. **经济兜底不可泛化**：fallback 仅在符合准入条件时触发，且必须保留可解释 repairNote 与指标痕迹。

### Soft Constraints（偏好与策略）
1. 治理节奏采用“稳定性与规范并行推进”。
2. 跨回合写入优先软告警，不作为第一阶段硬阻断条件。
3. 兼容现有 `stateVarWriter.enabled / shadowMode / cutoverDomains / rejectNonWriterForCutoverDomains` 组合语义。
4. 优先复用现有审计表（`SYS_StateVarEventLog` / `SYS_StateVarApplyLog`）与验证指标（`SYS_ValidationIssue`）。

### Dependencies（执行依赖与顺序）
1. 输入与语义层：`inputBuilder.ts` + `stateServiceInput.ts`。
2. 路由与执行层：`serviceRunner.ts` + `useGameLogicCore.ts`。
3. 守卫与事务层：`commandGuard.ts` + `applyTransaction.ts` + `turnTransaction.ts`。
4. writer 与桥接层：`stateVariableWriter.ts` + `stateVariableBridge.ts` + `stateVariableEvent.ts`。
5. 观测与回放层：`tableProjection.ts` + `stateVariableReplay.ts` + `stateVariableDiff.ts`。
6. 配置与入口层：`useAppSettings.ts` + 设置界面上下文。
7. 回归门禁层：`tests/state/*` + `tests/taverndb/*`。

### Risks（已识别风险）
1. 语义启发式误判导致错误 delta（尤其经济方向）。
2. 跨回合约束不足导致状态漂移累积。
3. 越域写入在开关组合下出现“部分拦截、部分放行”的不一致。
4. replay 行标识缺失（`__missing_id_*`）导致 diff 假阳性。
5. skip/rollback 只在内部计数、缺少上层消费时会形成“隐性失败”。

---

## Verifiable Success Criteria（可验证成功判据）

1. **失败分类可见性**
   - 在回归与联调数据中，rollback/skip/fallback 三类路径均能被稳定观测与区分；
   - 证据来源：事务日志、writer metrics、`SYS_ValidationIssue`。

2. **范围约束有效性（严格域白名单）**
   - 越域写入被拒绝并计入冲突统计（例如 `source_not_allowed` 或等价拒绝原因）；
   - 不允许“越域成功写入但无告警”的路径。

3. **轮次约束可观测性（软告警）**
   - 跨回合写入不直接阻断业务，但必须产生日志/指标告警并可追踪来源；
   - 告警字段需能定位 turn/source/domain/sheet。

4. **经济 fallback 收紧有效**
   - 仅在“缺少经济命令 + 满足准入条件”时触发；
   - 每次触发必须带可解释标记（如 repairNote），并具备可回归断言。

5. **回放一致性门禁可执行**
   - 在既有与新增回归用例中，`diffStateVariableSnapshots` 的 totals 可用于稳定门禁；
   - 对预期一致场景，`matched=true`；对注入冲突场景，差异项可解释且可复现。

6. **测试矩阵完整性提升**
   - 覆盖输入裁剪、严格路由、writer 事件语义、cutover 冲突注入、事务回滚、回放一致性、指标投影、经济兜底；
   - 新增缺口场景（如 replay delete/重复 keyField/rowId 缺失、stableStringify 边界）后，全量测试通过。

## Context

DXC 当前的 state 变量填表链路已具备：strict routing（`executeServiceRequest`）、命令守卫（`commandGuard`）、事务原子与回滚（`applyTurnTransaction`）、writer 事件协议与审计（`consumeStateVariableEvents` + `SYS_StateVar*Log`）、以及回放/diff 与投影指标（`stateVariableReplay/diff` + `SYS_ValidationIssue` metrics）。

但“稳定性不稳定/不规范”的根因集中在三条主轴的缺口与耦合：

1) **语义分析（Semantic）**
- 目前显式语义锚点集中在经济（输入构建 `buildEconomySemanticAnchor` + `applyNarrativeEconomicFallback`）。
- 其他域（任务/社交/战斗/背包）缺少同等强度的语义约束与解释型信号，导致模型输出更依赖自由生成，出现越域/缺字段/漏写的概率更高。

2) **轮次限定（Turn / Temporal Scope）**
- 当前 turn 级约束主要体现在 requiredSheets 的节拍（`resolveStateRequiredSheets`），而非“写入发生在哪些回合范围内”的显式契约。
- writer/事务层虽能处理版本冲突与回滚，但对“跨回合误写”缺少独立分类与告警口径（用户选择为软告警策略）。

3) **变量范围控制（Domain/Sheet/Field Scope）**
- 现有边界控制主要是 service 边界 + cutover 时的 source ownership（protectedSheets + allowedSourcePrefixes）。
- 仍缺少 domain+sheet+field 的统一白名单治理模型（用户选择为严格域白名单）。

同时，系统存在多种失败路径：
- rollback：事务层 apply error / patch conflict / source_not_allowed / version conflicts。
- skip：writer 层 stale_event / duplicate_idempotency / invalid_event / no_command。
- fallback：服务层经济命令缺失时注入 `apply_econ_delta`。

设计需要在不破坏既有审计链路与开关语义的前提下，把上述问题转为“可验证约束 + 可观测指标 + 可回归测试”。

约束与策略输入（来自用户确认）：
- 治理节奏：稳定性与规范并行推进。
- 跨回合写入：软告警（不直接硬阻断）。
- 变量范围：严格域白名单。
- 经济兜底：保留但收紧（更明确准入条件 + 可解释信号）。

## Goals / Non-Goals

**Goals:**
- 定义并落地 state 填表治理的统一约束模型：语义约束、turn 约束、范围约束三轴一致。
- 对 rollback / skip / fallback 建立统一分类口径，并将其暴露到可观测层（指标/审计表/系统日志）。
- 建立可执行的回归门禁：基于 replay/diff totals 与 `SYS_ValidationIssue` 指标，将“当前不稳定”量化。
- 收紧 econ fallback 的触发边界：减少误注入/双记账概率，同时保留故障恢复能力与可解释性。
- 完整覆盖测试矩阵缺口（特别是 replay/diff 对齐噪声、delete 事件、重复 keyField、stableStringify 边界等）。

**Non-Goals:**
- 不在本变更中重写 AI prompts/world schema 或替换 AI provider。
- 不引入新的外部依赖或新的数据库/存储系统。
- 不把“跨回合写入”直接升级为强阻断（除非后续数据证明必须）。
- 不做大规模 UI 重构，仅在必要时新增/调整诊断可视化入口（如设置项/指标展示）。

## Decisions

### Decision 1: 以“治理契约（Governance Contract）”统一三轴约束
- **Choice**：定义一个可序列化的治理契约（turnScope + domainScope + semanticScope），并在 state 输入构建、命令守卫、writer/事务落地、回放校验四个位置复用同一契约。
- **Rationale**：目前约束散落在 requiredSheets、cutover source ownership、输入裁剪、以及 fallback 注入中，缺少统一声明，导致“规范不一致/不可验证”。
- **Alternatives**：
  - 仅增强 tests 与 metrics：能发现问题但不能根治“谁该拦/何时拦”。
  - 仅在事务层统一拦截：丢失语义上下文，无法做精确告警/解释。

### Decision 2: 跨回合写入采用“软告警 + 审计字段化”
- **Choice**：不阻断业务写入，但为每次跨回合写入生成独立告警信号（可写入 `SYS_ValidationIssue` 或系统日志；并在 `SYS_StateVarApplyLog` 增加可追踪字段，若不改表则通过 payload/metadata 记）。
- **Rationale**：用户明确选择软告警；同时避免因为模型偶发跨回合更新导致整批 rollback。
- **Alternatives**：强阻断会显著提升 rollback 率并放大“静默失败”。

### Decision 3: 范围约束采用 domain+sheet+field 严格白名单（并与 cutover source ownership 解耦）
- **Choice**：建立“允许写入矩阵”，将 domain->sheet->field 的可写集合显式化；越域写入直接拒绝并计数（拒绝原因需可定位）。
- **Rationale**：当前主要靠 sheet 级与 source ownership；对字段级越权/越域不敏感。
- **Alternatives**：仅 sheet 级会让字段污染难定位；先记录后拦截会推迟收敛。

### Decision 4: 经济 fallback 保留但收紧：增加准入条件 + 解释型证据
- **Choice**：保留 `applyNarrativeEconomicFallback`，但以治理契约约束其触发，并确保每次触发都输出可解释 repairNote 与指标计数；同时避免对未识别的经济命令表达形式重复注入。
- **Rationale**：系统需要“叙事漏写经济”时的止血能力，但必须降低误记账与双记账风险。
- **Alternatives**：完全关闭会放大 state 服务的不稳定；继续现状会保留误触发风险。

### Decision 5: 回放/一致性门禁以 replay/diff totals 为主，补充 rowId/keyField 稳定化策略
- **Choice**：以 `diffStateVariableSnapshots` 的 totals 作为强门禁；并为 `__missing_id_*`/重复 keyField/行排序变化等场景新增显式测试与诊断输出，降低假阳性。
- **Rationale**：当前 diff 已可量化，但对 row identity 依赖较强；需要把“不稳定噪声”与“真实不一致”分离。

## Risks / Trade-offs

- [Risk] 严格域白名单可能导致短期拒绝率上升（更多 blocked/rollback）。
  → Mitigation：分阶段上线：先在 shadow/metrics 模式统计，再在 cutover domains 先启用强校验。

- [Risk] 软告警可能让跨回合问题持续存在。
  → Mitigation：明确告警阈值与升级策略（连续 N 次/占比超过阈值则进入强策略评估）。

- [Risk] econ fallback 收紧可能导致部分“确实需要补账”的场景不再触发。
  → Mitigation：把“未触发原因”写入 repairNote/指标（例如 reason=no-sheet-access / input-not-json / has-econ-mutation），便于调参。

- [Risk] replay/diff 扩展测试会暴露历史数据/投影旁路差异，出现大量初始失败。
  → Mitigation：先把失败分类与诊断输出补齐，再分批修复一致性；对已知噪声场景引入明确断言（例如重复 keyField 视为 invalid baseline）。

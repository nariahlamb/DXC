## 1. 治理契约与配置基线

- [x] 1.1 在 state 链路定义统一治理契约结构（turnScope/domainScope/semanticScope）并接入现有设置归一化流程。
- [x] 1.2 将 domain+sheet+field 严格白名单配置化，建立默认白名单与非法配置回退策略。
- [x] 1.3 将跨回合软告警策略配置化（阈值、采样与升级条件），并保持默认非阻断。

## 2. 输入构建与语义约束接入

- [x] 2.1 在 state 输入构建阶段附加治理契约上下文，确保后续守卫/writer/事务可共享同一约束视图。
- [x] 2.2 在语义锚点层补充“语义有效/缺失/歧义”状态标记，并形成可观测字段。
- [x] 2.3 为 requiredSheets 与范围白名单建立一致性检查，检测并标记潜在越域请求。

## 3. 路由守卫、writer 与事务分类落地

- [x] 3.1 在命令守卫层实现 domain+sheet+field 白名单校验，越域写入返回可诊断拒绝原因。
- [x] 3.2 在 writer 消费路径统一 skip 原因输出结构（duplicate_idempotency/stale_event/invalid_event/no_command）。
- [x] 3.3 在事务路径统一 rollback 原因映射（source_not_allowed/row_version_conflict/sheet_version_conflict/apply_error）并保证审计落账。
- [x] 3.4 在 state 执行结果中统一暴露 rollback/skip/fallback 分类摘要，便于上层日志与 UI 消费。

## 4. 经济 fallback 收紧

- [x] 4.1 收紧 fallback 触发准入（结构化输入、sheet 访问许可、无等价经济命令）并显式输出跳过原因类别。
- [x] 4.2 为 fallback 注入路径增加解释性标记（含 delta 上下文）并纳入统一分类口径。
- [x] 4.3 将 fallback 输出纳入范围白名单校验，防止越域修复命令被提交。

## 5. 回放一致性与指标门禁

- [x] 5.1 强化 replay 输入校验与 invalidRows 统计对外可见性，确保异常日志不静默吞噬。
- [x] 5.2 对 diff 行标识噪声场景（缺失 keyField、重复 key、行序变化）补充诊断与稳定化策略。
- [x] 5.3 将 replay/diff totals 与 writer/冲突指标统一投影到质量视图并定义门禁阈值。

## 6. 测试矩阵补强与回归门禁

- [x] 6.1 新增/补强范围白名单测试：domain/sheet/field 允许与拒绝场景全覆盖。
- [x] 6.2 新增/补强跨回合软告警测试：不阻断写入但有可追踪告警信号。
- [x] 6.3 新增/补强 fallback 收紧测试：触发、抑制、跳过原因与解释标记覆盖。
- [x] 6.4 新增/补强 replay/diff 边界测试：delete 事件、重复 keyField、`__missing_id_*`、stableStringify 复杂对象对比。
- [x] 6.5 运行全量 state/taverndb 相关测试并建立验收门禁（失败分类可见、范围拒绝有效、回放门禁可执行）。

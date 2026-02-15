# DXC vs SillyTavern：索引召回机制对比（Recall / Memory Retrieval）

本文聚焦“索引召回”机制对比：SillyTavern 参考预设如何产出 `<recall>`，以及 DXC 当前如何做记忆召回与上下文注入。

---

**核心结论**

1. **方向一致**：两者都把 `LOG_Summary / LOG_Outline` 当作记忆主来源。
2. **机制不等价**：SillyTavern 参考是“独立 recall 编码生成管线”；DXC 是“召回命中内容直接注入主 prompt”。
3. **污染风险来源明确**：DXC 默认窗口更大（`instantLimit=10` + `contextLayerLimit=12`），旧回合更容易持续进入后续生成。

---

**对照范围**

- 参考文档：
- `docs/ref/SillyTavern脚本模板-总索引.md`
- `docs/ref/sillytavern数据库脚本-分解说明.md`
- `docs/ref/数据库默认索引召回预设-分解说明.md`
- `docs/ref/数据库默认索引召回预设.json`

- DXC 实现：
- `utils/aiPrompt.ts`
- `utils/aiContext.ts`
- `utils/memory/tavernTableRetriever.ts`
- `utils/memory/memoryIndexProjection.ts`
- `utils/memory/memoryRetriever.ts`
- `hooks/useAppSettings.ts`
- `utils/aiDefaults.ts`
- `tests/memory/memoryContextRetrieval.test.ts`

---

**1. 目标产物对比**

- SillyTavern 参考：
1. 召回预设目标产物为 `<recall>{AM编码列表}</recall>`。
2. `extractTags=recall`，下游主要消费 recall 编码。

- DXC 当前：
1. 记忆召回是上下文构建步骤，不产出 `<recall>` 结构化集合。
2. 产物是文本块：
- `[表格记忆召回 (TavernDB Retrieval)]`
- `[记忆索引召回 (Memory Index Retrieval)]`
- `[事实边界 (Fact Boundary)]`
- `【即时上下文】`

**结论**：DXC 不是 recall-only 管线，而是 retrieval-as-context 管线。

---

**2. 真值来源与候选集**

- SillyTavern 参考：
1. 强调编码必须来自 `SUMMARY_DATA / MEMORY_INDEX_DB`，严禁编造。

- DXC 当前：
1. 表格召回候选来自 TavernDB 投影（按 mode 有 `sheetFilter/sheetWeights`）。
2. 索引召回候选来自 `buildMemoryIndexProjection(summary, outline)`，来源类型 `paired/summary/outline`。

**结论**：两者都围绕摘要/大纲真值，但 DXC 是程序检索结果注入，不是模型自由“选码后提交”。

---

**3. 历史窗口策略**

- SillyTavern 参考：
1. `contextTurnCount=3`。
2. 预设语义强调前文偏“历史 AI 输出”。

- DXC 当前：
1. `memoryConfig.instantLimit=10`（默认）。
2. `m_mem.params.contextLayerLimit=12`，且 `includePrecedingUser=true`。
3. `aiOnlyContext=true` 时会抽取最近 AI 层并带前置用户句。

**结论**：DXC 默认窗口明显更宽，旧场景残留概率更高。

---

**4. 检索与排序逻辑**

- SillyTavern 参考：
1. 提示词层定义 CoAT 轮次、审计、反思、终止（偏策略约束）。
2. 强约束 18-22 条、去重、字典序输出。

- DXC 当前：
1. 表格召回：token 命中 + sheet 权重 + TopK + 行级去重。
2. 索引召回：AM 命中高权重 + token 命中 + source/turn 微加权 + TopK。
3. 两通道并列展示，不做统一 recall 集合 merge 与 18-22 约束。

**结论**：DXC 有工程化检索打分，但缺少参考预设那套“召回集合收敛协议”。

---

**5. 校验与终止机制**

- SillyTavern 参考：
1. 要求真实性审计（幻觉编码必须剔除）。
2. 不满足条件需 reflect/pivot，直到 RM 终止条件满足。

- DXC 当前：
1. 候选来自本地数据，天然减少“编码不存在”风险。
2. 有 Fact Boundary 提示不确定项，但不会阻断主流程。
3. 无“召回失败重试直到合规”的硬门槛。

**结论**：DXC 是“可观测但非强阻断”的召回策略。

---

**6. 配置项映射**

- 参考字段：
1. `extractTags=recall`
2. `contextTurnCount=3`
3. recall 条目数 18-22（库存不足例外）

- DXC 对应：
1. `memoryConfig.instantLimit`
2. `m_mem.params.contextLayerLimit`
3. `m_mem.params.retrievalTopK / indexRetrievalTopK`
4. `m_mem.params.indexSummaryWindow / indexOutlineWindow`
5. `m_mem.params.indexSourceFilter`

**结论**：DXC 可配置项丰富，但目标是“上下文注入质量”，不是“recall 编码协议合规”。

---

**主要差异清单（Gap）**

1. 缺少 Recall-only 输出阶段：DXC 没有 `<recall>` 作为显式中间产物。
2. 缺少数量硬约束：DXC 无 18-22 的统一召回集合约束。
3. 缺少 RM 终止循环：DXC 不会因召回质量失败而反复重试。
4. 默认窗口偏大：容易让早期场景持续影响后续回合。

---

**对齐建议（按优先级）**

1. 新增“Recall-only 模式”：先产出结构化 recall 编码，再喂给主叙事。
2. 为 recall 集合加预算约束（如最小/最大条目数 + 去重 + 排序）。
3. 下调默认窗口：`instantLimit/contextLayerLimit` 改为更保守值。
4. 将“真实性校验”下沉到 runtime（仅允许已存在 AM 编码进入 recall 集合）。

---

**附：证据锚点（快速定位）**

- 参考机制入口：`docs/ref/SillyTavern脚本模板-总索引.md`
- 预设参数说明：`docs/ref/数据库默认索引召回预设-分解说明.md`
- 预设原文：`docs/ref/数据库默认索引召回预设.json`
- DXC 召回主逻辑：`utils/aiContext.ts`
- DXC 默认窗口：`utils/aiDefaults.ts`、`hooks/useAppSettings.ts`
- DXC 检索算法：`utils/memory/tavernTableRetriever.ts`、`utils/memory/memoryRetriever.ts`
- DXC 检索测试：`tests/memory/memoryContextRetrieval.test.ts`

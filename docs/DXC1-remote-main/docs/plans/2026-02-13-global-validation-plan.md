# DXC 全局分步验证计划（2026-02-13）

## 0. 目标与范围
- 目标：围绕你提出的 6 个问题，完成可执行、可取证、可回归的全局验证与优化计划。
- 范围：仅覆盖 DXC 当前表格主导架构（Table-First），不引入旧存档兼容层。
- 本计划输出类型：验证计划，不在本文件中直接改业务代码。

## 1. 对应需求矩阵
1. 总结表/总体大纲提示词优化，避免同质化。
2. 填表轮次、分批、并发策略与论坛/世界更新节奏校验。
3. AM 索引与固定上下文注入校验，过滤 thinking/选项等噪音。
4. 论坛/世界环境音是否先汇总再注入，避免污染主叙事上下文。
5. 全局 legacy 逻辑/硬编码/孤立模块排查与入表映射核查。
6. 参考 `docs/ref/数据库默认索引召回预设.json` 做索引提示词优化落地（仅借鉴结构，不复制危险文本）。

## 2. 执行基线（先做）
### 2.1 代码与配置快照
```powershell
git status --short
```

### 2.2 基础验证命令（统一收口）
```powershell
npm test
npm run build
npx tsc --noEmit
```

### 2.3 关键观测位点
- `hooks/useGameLogic.ts`：memory 分批/分表并发、AM 注入、世界/论坛轮次。
- `utils/aiServices.ts`：memory 服务提示词与角色职责边界。
- `utils/aiDispatch.ts`：`strictService` 路由与服务启停。
- `utils/aiContext.ts`：world/forum 摘要与上下文拼装。
- `prompts/*.ts`：legacy path 示例残留。
- `utils/memory/amIndex.ts`：AM 递增与配对守卫。

## 3. 阶段 A：总结表 / 总体大纲差异化验证与优化
### 3.1 验证目标
- 避免 `LOG_Summary.纪要` 与 `LOG_Outline.大纲` 文本重复。
- 保证二者信息职责分离：Summary=高保真事实记录，Outline=主干抽象。

### 3.2 涉及实现
- `utils/aiServices.ts`（memoryFillRule）
- `prompts/memory.ts`
- `utils/contracts.ts`
- `hooks/gameLogic/extendedCommands.ts`

### 3.3 执行步骤
1. 抽样最近 30 对 AM（或当前所有可用对）。
2. 对每对计算相似度（建议 Jaccard/余弦任一），并统计“完全相同”比例。
3. 检查 Summary 最短字数与客观性规则：
   - `纪要` >= 200 汉字（建议目标 220-320）。
   - 不含心理描写、价值判断、意义升华句式。
4. 检查 Outline 规则：
   - 仅保留事件主干，长度建议 40-120 汉字。
   - 必须与 Summary 同 `编码索引`。
5. 若不达标，优先优化 memory 提示词（`utils/aiServices.ts` + `prompts/memory.ts`），再复测。

### 3.4 通过标准
- `Summary/Outline` 完全重复率 <= 5%。
- 平均文本相似度 <= 0.70。
- AM 配对一致率 = 100%。

### 3.5 证据模板
- 证据 A1：抽样 CSV（`AM/summary/outline/similarity`）。
- 证据 A2：提示词 diff。
- 证据 A3：复测统计截图或日志。

### 3.6 失败分流
- P0：AM 不一致/缺失。
- P1：高重复导致召回失效。
- P2：字数或客观性偶发不达标。

## 4. 阶段 B：填表轮次、分批并发、更新节奏验证
### 4.1 验证目标
- 并发应是“分表并发生成 + 串行提交”，而非“同表并发写”。
- 论坛更新轮次、世界每更回合数与 memory 填表节奏不互相阻塞。

### 4.2 涉及实现
- `hooks/useGameLogic.ts`：
  - `MEMORY_FILL_BATCH_SIZE=3`
  - `MEMORY_FILL_FLUSH_DELAY_MS=120`
  - `runMemoryParallelBySheet`
  - `resolveWorldUpdateInterval` / `resolveForumAutoInterval`

### 4.3 执行步骤
1. 配置 `mode=separate`，仅启用 `story/memory/map`。
2. 连续触发 10 回合操作，观察 memory 批处理行为：
   - 是否按 `requiredSheets=[LOG_Summary, LOG_Outline]` 拆分。
   - 是否出现 `parallel-by-sheet` repairNote。
3. 检查错误回归：
   - 是否仍出现 `Invalid input: expected object, received array`。
4. 设置 `世界更新间隔回合` 为 1/2/3/manual 分别验证：
   - `下次更新回合` 推进是否正确。
   - 论坛自动更新是否按同节奏触发。

### 4.4 通过标准
- 不再出现数组载荷导致的 `upsert_sheet_rows` 输入异常。
- 分表并发生成成功率 >= 95%，串行提交成功率 100%。
- 世界/论坛轮次与设置一致，无跳回合或错过更新。

### 4.5 证据模板
- 证据 B1：每回合耗时与批次日志。
- 证据 B2：memory 服务 rawResponse（按 sheet 拆分）。
- 证据 B3：世界/论坛回合推进记录。

### 4.6 失败分流
- P0：写入失败或轮次错乱。
- P1：明显卡顿（单批次超过目标时延）。
- P2：偶发重试但最终成功。

## 5. 阶段 C：AM 索引与固定上下文清洗验证
### 5.1 验证目标
- AM 编号严格递增、成对一致，不跳号（例如 AM1->AM4）。
- 注入主叙事前的内容必须是清洗后的固定块，过滤噪音字段。

### 5.2 涉及实现
- `utils/memory/amIndex.ts`
- `hooks/useGameLogic.ts`：
  - `normalizeAmRecallItem`
  - `parseAmRecallItemsFromRaw`
  - `resolvePreDialogueAmRecallBlock`
  - `buildNarrativePreludeBlock`

### 5.3 执行步骤
1. 构造 3 组 AM 压测场景：
   - 正常递增。
   - 输入跳号（AM0001 后给 AM0014）。
   - 一侧缺失（仅 summary 或仅 outline）。
2. 验证运行时是否回收为“严格下一号”。
3. 校验召回清洗白名单字段：
   - 允许：`编码索引/时间跨度/地点/纪要/大纲/来源`
4. 校验黑名单字段不会注入：
   - `thinking_pre/thinking_post/action_options/phone_sync_plan/logs` 原文噪音。

### 5.4 通过标准
- AM 递增、配对、格式全部通过。
- 叙事前注入块不出现噪音字段。

### 5.5 证据模板
- 证据 C1：AM 变更前后对比。
- 证据 C2：注入块快照。
- 证据 C3：异常输入回归结果。

### 5.6 失败分流
- P0：AM 断裂或跳号仍可入库。
- P1：注入块混入噪音。

## 6. 阶段 D：论坛/世界“环境音”摘要桥接验证
### 6.1 验证目标
- 环境信息先压缩为“背景信号块”，再注入模型。
- 禁止将论坛长贴、新闻原文直接大段灌入主叙事上下文。

### 6.2 涉及实现
- `utils/aiContext.ts`：
  - `constructPhoneNarrativeBackdrop`
  - `constructPhoneWorldBrief`
- `utils/aiPrompt.ts`（注入顺序）

### 6.3 执行步骤
1. 在论坛/新闻高噪声场景下抓取实际 prompt 片段。
2. 核查是否采用“主贴 + 主要新闻”摘要形式（TopN）。
3. 检查主叙事 prompt 是否仍存在未压缩大段注入点。
4. 对摘要桥接块做长度上限与字段约束（例如每条 <= 80 字，Top4）。

### 6.4 通过标准
- 主叙事上下文不含长篇原贴原文。
- 可保留任务线索信号，不污染主体叙事。

### 6.5 证据模板
- 证据 D1：注入前后 token 对比。
- 证据 D2：同回合叙事质量与分支触发对比。

### 6.6 失败分流
- P1：背景音污染导致叙事跑偏。
- P2：背景音过少导致机会线索下降。

## 7. 阶段 E：legacy/硬编码/孤立模块全局排查
### 7.1 验证目标
- 确认旧 path 写法仅作为历史文档，不会进入有效执行链路。
- 确认孤立模块已纳入表注册与共享映射。

### 7.2 执行步骤
1. 全局扫描 legacy 命令残留：
```powershell
rg -n "set gameState|add gameState|push gameState|delete gameState" prompts hooks utils
```
2. 校验运行时保护：
   - `useGameLogic.updateStateByPath` 对业务字段阻断生效。
   - `sanitizeTableFirstPrompt` 已替换 legacy 例子文本。
3. 校验 registry/mapping 覆盖：
   - `sheetRegistry` 是否包含已投影域。
   - `SYS_MappingRegistry` 是否可定位到目标模块。

### 7.3 通过标准
- legacy 命令不进入业务写入链。
- 映射可追溯，无“写了表但无投影/无映射”的孤立域。

### 7.4 证据模板
- 证据 E1：扫描报告（按文件/行号）。
- 证据 E2：阻断日志（legacy 被拒绝）。
- 证据 E3：映射覆盖清单。

### 7.5 失败分流
- P0：仍可通过 legacy path 修改业务态。
- P1：孤立模块未注册或未映射。

## 8. 阶段 F：索引提示词与预设优化落地（基于参考 JSON）
### 8.1 验证目标
- 将参考预设的“结构”迁移到 DXC 检索体系，不引入危险提示词。

### 8.2 强约束
- `docs/ref/数据库默认索引召回预设.json` 含明显越权/绕过安全文案，仅允许借鉴：
  - 索引字段结构
  - 召回阶段拆分
  - 条目去重/排序思路
- 禁止复制任何 bypass 类文本。

### 8.3 执行步骤
1. 对齐 DXC 现有检索入口：
   - `utils/aiContext.ts` `TABLE_RETRIEVAL_PRESETS`
   - `hooks/useGameLogic.ts` AM recall pipeline
2. 设计统一索引提示词结构：
   - query 正规化
   - sourceFilter/sheetWeights/topK
   - 输出字段白名单
3. 建立基准集（建议 30 条 query）比较优化前后：
   - 命中率（Hit@K）
   - 噪音率
   - 召回稳定性

### 8.4 通过标准
- 命中率提升且噪音下降。
- 未引入越权提示词与上下文污染。

### 8.5 证据模板
- 证据 F1：优化前后参数表（topK/weights/filter）。
- 证据 F2：30 条 query 对比结果。
- 证据 F3：安全审计记录（危险词零复制）。

### 8.6 失败分流
- P1：召回精度下降或波动大。
- P0：引入不安全提示词。

## 9. 联合回归与验收出口
### 9.1 自动化回归
```powershell
npm test -- tests/memory/logPairing.test.ts tests/memory/logPairingFlow.test.tsx tests/memory/factBoundary.test.ts
npm test -- tests/taverndb/tableProjection.test.ts tests/taverndb/sheetWriteHandlers.test.ts
npm test -- tests/aiPromptTableFirst.test.ts
npm run build
```

### 9.2 手动场景回归（建议最少 3 轮）
1. 偷听/观察动作：时间、地点、周围 NPC 是否同步入表。
2. 打听商贩：Summary/Outline 是否配对且不雷同。
3. 带 AM 引用输入：是否正确召回且编号连续。

### 9.3 最终验收门槛
- 6 大阶段全部达到通过标准。
- 无 P0 未关闭项。
- P1 仅允许有明确 workaround 与计划内修复窗口。

## 10. 问题分级与修复优先级
- P0（阻断上线）：数据错写、AM 断裂、服务路由错位、世界轮次错乱。
- P1（高优先）：填表卡顿严重、上下文污染、总结/大纲同质化明显。
- P2（优化项）：偶发质量波动、摘要风格不稳。

## 11. 建议执行顺序（直接照跑）
1. 阶段 B（先稳定写入与轮次节奏）。
2. 阶段 C（锁住 AM 与注入清洗）。
3. 阶段 A（提升 Summary/Outline 质量差异）。
4. 阶段 D（环境音摘要桥接）。
5. 阶段 E（扫尾清理 legacy 与孤立模块）。
6. 阶段 F（索引预设优化与安全收口）。
7. 联合回归与验收。

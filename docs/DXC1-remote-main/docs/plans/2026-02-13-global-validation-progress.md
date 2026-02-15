# DXC 全局验证执行进度（2026-02-13）

## 当前阶段
- 阶段 A（总结表/总体大纲差异化）: 进行中（已完成代码优化与基础回归）
- 阶段 B（分批并发/轮次节奏）: 已完成自动化验证补齐
- 阶段 C（AM 索引与注入清洗）: 已完成自动化验证补齐
- 阶段 E（legacy/硬编码扫描）: 已完成首轮扫描与防回归
- 阶段 D（环境音摘要桥接）: 已完成自动化验证补齐
- 阶段 F（索引预设优化）: 已完成首轮模式化召回验证

## 已完成项（A-1）
1. 强化 memory 填表提示词，落实总结表/大纲表职责分离与反同质化约束。  
   文件: `utils/aiServices.ts:221`
2. 同步项目内日志模板定义，避免旧版简化规则继续生效。  
   文件: `prompts/memory.ts:39`
3. 在分表并发填表链路增加同质化保护，命中高重合时自动降级为单次 memory 生成。  
   文件: `hooks/useGameLogic.ts:4449`
4. 在质量报告表新增同质化指标，便于 UI 侧持续观察。  
   文件: `utils/taverndb/tableProjection.ts:1169`

## 阶段 B 代码预检（已完成）
1. memory 分批参数确认：`MEMORY_FILL_BATCH_SIZE=3`，`MEMORY_FILL_FLUSH_DELAY_MS=120`。  
   文件: `hooks/useGameLogic.ts:178`
2. 并发模型确认：`runMemoryParallelBySheet` 为“分表并发生成 + 串行配对提交”。  
   文件: `hooks/useGameLogic.ts:4460`
3. 世界/论坛轮次调度确认：`resolveWorldUpdateInterval` 与 `resolveForumAutoInterval` 已联动系统设置。  
   文件: `hooks/useGameLogic.ts:7425`

## 本轮通过的验证
```powershell
npm test -- tests/aiPromptTableFirst.test.ts tests/memory/logPairing.test.ts tests/memory/logPairingFlow.test.tsx
npm test -- tests/taverndb/tableProjection.test.ts tests/memory/logPairing.test.ts tests/aiPromptTableFirst.test.ts
npm run build
```

## 下一步（A-2 -> B）
1. A-2: 进行真实回合抽样（30 对 AM）并统计同质化率（重点看 `METRIC_SUMMARY_OUTLINE_OVERLAP`）。
2. B-1: 验证 memory 分批并发时延与回合节奏（`batch=3 / flush=120ms`）。
3. B-2: 联动检查世界/论坛更新轮次与 `世界更新间隔回合` 配置一致性。

## 本轮新增修复（2026-02-13）
1. 修复 `upsert_sheet_rows + key=gameState.*` 异常载荷桥接缺口：补齐 `背包/任务/任务日志` 的 legacy-key 到表命令转换。  
   文件: `hooks/useGameLogic.ts:2126`, `hooks/useGameLogic.ts:2228`
2. 新增“异常载荷自动桥接”触发条件：当 `upsert_sheet_rows` 缺少 `sheetId` 且存在 `key/path` 时，自动走兼容转换。  
   文件: `hooks/useGameLogic.ts:3029`
3. 新增回归测试覆盖：`背包+任务状态`、`任务日志 -> QUEST_ProgressLog`。  
   文件: `tests/state/logTableAutofill.test.tsx:454`, `tests/state/logTableAutofill.test.tsx:493`

## 本轮新增验证（B/C）
1. 新增“世界/论坛轮次联动”测试：  
   - `世界更新间隔回合` 调度 `下次更新回合`；  
   - `manual(0)` 清空 `下次更新回合`；  
   - 论坛在整除轮次触发自动生成。  
   文件: `tests/state/worldForumIntervals.test.tsx`
2. 新增“AM 叙事前注入清洗”测试：  
   - 验证固定注入块存在；  
   - 验证 AM 来源标记与编号归一化；  
   - 验证 `thinking_pre/action_options/phone_sync_plan/logs` 不进入模型输入。  
   文件: `tests/memory/amRecallPreludeSanitization.test.tsx`
3. 修复测试过程中暴露的局部编译问题（`extractMemoryCommandTurn` 数值解析作用域）。  
   文件: `hooks/useGameLogic.ts`

## 本轮验证命令与结果
```powershell
npm test -- tests/state/worldForumIntervals.test.tsx tests/memory/amRecallPreludeSanitization.test.tsx
npm test -- tests/memory/logPairing.test.ts tests/memory/logPairingFlow.test.tsx tests/memory/memoryContextRetrieval.test.ts tests/memory/memoryRetriever.test.ts tests/memory/factBoundary.test.ts tests/memory/amRecallPreludeSanitization.test.tsx tests/state/logTableAutofill.test.tsx tests/state/worldForumIntervals.test.tsx
npm run build
```
- 结果：全部通过（新增 4 条测试 + 既有相关回归 27 条）。
- 备注：`npx tsc --noEmit` 当前仍存在仓库既有类型问题（与本轮改动无关，主要在 `components/game/phone/views/ChatsView.tsx`、`mobile-demo/*`、`vitest.config.ts` 等）。

## 阶段 E 首轮扫描与收口
1. 扫描命令：  
   `rg -n "set gameState|add gameState|push gameState|delete gameState" prompts hooks utils`
2. 扫描结果：legacy 示例仍主要存在于 `prompts/*.ts` 文案层（世界/眷族/战利品等说明文本），运行时通过 prompt 组装器统一净化。  
   核心净化点：`utils/aiPrompt.ts` `sanitizeTableFirstPrompt`。
3. 新增防回归测试：覆盖 `push/add/delete gameState.*` 与 `\"action\":\"set\"` 变体，验证组装后全部转换为 table-first 形式。  
   文件: `tests/aiPromptTableFirst.test.ts`
4. 验证命令：  
   `npm test -- tests/aiPromptTableFirst.test.ts`（通过）

## 阶段 D 自动化验证
1. 新增 `constructPhoneNarrativeBackdrop` / `constructPhoneWorldBrief` 测试：  
   - 验证论坛/新闻注入为 TopN 摘要（非全量原文）；  
   - 验证新闻正文被截断（含省略号），避免上下文污染；  
   - 验证 world brief 仅保留限定数量条目。  
   文件: `tests/aiContextBackdrop.test.ts`
2. 验证命令：  
   `npm test -- tests/aiContextBackdrop.test.ts`（通过）

## 阶段 F 首轮验证（索引预设）
1. 审阅参考文件 `docs/ref/数据库默认索引召回预设.json`：确认其包含明显不安全/越权文本，仅借鉴“检索结构思路”，不复用危险内容。
2. 新增检索预设测试：验证 `retrievalMode=phone/action` 的分表过滤生效。  
   - `phone` 模式可召回 `FORUM_Posts`；  
   - `action` 模式过滤掉 `FORUM_Posts`。  
   文件: `tests/memory/tableRetrievalPresets.test.ts`
3. 验证命令：  
   `npm test -- tests/memory/tableRetrievalPresets.test.ts`（通过）

## 本轮新增修复（2026-02-13，补充）
1. 修复 `upsert_sheet_rows + key=gameState.世界坐标` 在 legacy-bridge 下未被识别的问题。  
   - 根因：`gameState.世界坐标` 未纳入 `TABLE_MANAGED_LEGACY_PATH_PREFIXES`，导致 malformed 命令无法重写为 `SYS_GlobalState`，从而触发事务整批回滚。  
   - 修复：将 `gameState.世界坐标` 加入表管控前缀，确保 `世界坐标/x/y` 均可桥接入表。  
   - 文件：`hooks/useGameLogic.ts`
2. 新增 `reroll` 回归测试：验证重roll后 summary/outline 会替换旧回合结果而不是累积。  
   - 文件：`tests/state/logTableAutofill.test.tsx`
3. 扩展混合异常载荷测试：在同一批命令中加入 `gameState.世界坐标` 与富字段背包对象，验证不再触发整批回滚。  
   - 文件：`tests/state/logTableAutofill.test.tsx`

## 本轮验证命令与结果（补充）
```powershell
npm test -- tests/state/logTableAutofill.test.tsx
npm run build
```
- 结果：通过（`10 passed`，包含新增 `reroll` 与 `世界坐标` 回归）。

## 本轮新增修复（2026-02-13，第二批）
1. 修复 legacy `upsert_sheet_rows` 资金写入语义：当 `gameState.角色.法利/眷族.资金` 以负数输入（如 `-50`）时，按 delta 解释，不再误判为“绝对值=-50”导致守卫阻断。  
   文件: `hooks/useGameLogic.ts`
2. 新增 `gameState.角色.生存状态.水分/饱腹度` 兼容桥接：支持 malformed `upsert_sheet_rows + key` 写入，并按增量语义处理（带上限/下限钳制）。  
   文件: `hooks/useGameLogic.ts`
3. 对 malformed legacy `upsert_sheet_rows` 增加降级兜底：无法桥接成表命令时，非表管控路径自动降级为路径 `set`，避免整批事务回滚。  
   文件: `hooks/useGameLogic.ts`
4. 新增同构回归测试：覆盖“负数资金 + 生存状态 + 时间 + NPC”混合 payload，验证不再只剩 summary/outline 生效。  
   文件: `tests/state/logTableAutofill.test.tsx`

## 本轮验证命令与结果（第二批）
```powershell
npm test -- tests/state/logTableAutofill.test.tsx
npm run build
```
- 结果：通过（`11 passed`）。

## 本轮新增修复（2026-02-13，第三批）
1. 修复 memory 分表并发在同回合返回“占位 summary（如 1/2）+ 正常 summary”时的重复入库问题。  
   - 策略：对 `LOG_Summary/LOG_Outline` 命令按回合分桶择优，仅保留每回合最优命令；同时过滤纯数字占位文本。  
   - 文件：`hooks/useGameLogic.ts`
2. 新增回归测试：当 memory summary 子任务返回 `append_log_summary: 1` 与一条正常 summary 并存时，最终仅保留有效配对行，不生成“summary-only 空行”。  
   - 文件：`tests/state/logTableAutofill.test.tsx`

## 本轮验证命令与结果（第三批）
```powershell
npm test -- tests/state/logTableAutofill.test.tsx
npm run build
```
- 结果：通过（`12 passed`）。

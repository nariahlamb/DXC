# Memory Fill Stability & Template Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复“记忆填表经常报错且速度慢”的核心痛点，并严格对齐 `DND仪表盘配套模板.json` 的关键约束，防止模型长任务自作主张。

**Architecture:** 采用“模板约束前置 + memory 链路稳定化 + 事务冲突补偿 + 可观测性 + 回归测试”五段式改造。先收口输入输出约束，再处理异步/并发吞吐与冲突恢复，最后补齐测试与灰度开关，保证可回滚。

**Tech Stack:** React + TypeScript + Vitest + TavernDB 事务层 + 微服务队列

---

## 0. 对照基线（必须遵守）

### 0.1 参考源（只认这两个）

- `docs/ref/DND仪表盘配套模板.json`
- `docs/ref/sillytavern数据库脚本.js`

### 0.2 本项目最终规则（相对模板的定制）

1. 保持模板的结构与行为约束：
   - `LOG_Summary` 与 `LOG_Outline` 必须同回合同 `AMxxxx` 配对
   - 两表仅允许新增语义（insert-only），禁止业务层 update/delete 覆盖旧轮次
   - 输出仍只允许日志表相关命令
2. 字数规则采用 DXC 定制：
   - `LOG_Summary.纪要` 目标约束改为 **180-260 字（目标约 200 字）**
   - `LOG_Outline.大纲` 保持短摘要（建议 40-120 字）
3. 防跑偏策略：
   - 长任务下必须有“硬校验 + 自动拒收 + 重试/回退”，不能只依赖提示词自觉

---

## 1. 模板对齐矩阵（实施验收基准）

### Task 1: 固化模板对齐文档（Spec Freeze）

**Files:**

- Create: `docs/specs/memory-fill-template-alignment.md`
- Reference: `docs/ref/DND仪表盘配套模板.json`
- Reference: `docs/ref/sillytavern数据库脚本.js`

**Step 1: 写入字段与约束对照**

- `LOG_Summary`: `时间跨度/地点/纪要/重要对话/编码索引`
- `LOG_Outline`: `时间跨度/大纲/编码索引`
- 配对约束：同回合同 `编码索引`
- 行为约束：insert-only（业务语义）
- 输出约束：仅日志表命令

**Step 2: 写入 DXC 定制规则**

- 将“纪要不少于300字”显式改为“180-260字，目标约200字”
- 说明此项是 DXC 与 ST 的差异化策略，不属于回归缺陷

**Step 3: 验收**

- 文档中每条规则都能映射到“实现位置 + 测试位置”

---

## 2. P0 约束硬化（防自作主张优先）

### Task 2: 收口 memory 输出命令白名单与字段必填

**Files:**

- Modify: `utils/aiServices.ts`
- Modify: `hooks/useGameLogic.ts`
- Test: `tests/state/logTableAutofill.test.tsx`

**Step 1: 严格白名单**

- 仅允许：
  - `append_log_summary`
  - `append_log_outline`
  - `upsert_sheet_rows` 且 `sheetId in {LOG_Summary, LOG_Outline}`

**Step 2: 字段必填校验**

- `LOG_Summary` 必填：`时间跨度/地点/纪要/编码索引(可运行时补)`
- `LOG_Outline` 必填：`时间跨度/大纲/编码索引(可运行时补)`
- 缺字段直接拒收并进入重试/回退流程

**Step 3: 测试**

- 缺字段返回时：不写库 + 产生系统日志 + 触发后续补偿

**Step 4: Commit**

```bash
git add utils/aiServices.ts hooks/useGameLogic.ts tests/state/logTableAutofill.test.tsx
git commit -m "fix(memory): harden command whitelist and required fields"
```

### Task 3: 纪要长度本地校验（200字目标）

**Files:**

- Modify: `utils/aiServices.ts`
- Modify: `hooks/useGameLogic.ts`
- Create: `utils/memory/memoryTextPolicy.ts`
- Test: `tests/memory/memoryTextPolicy.test.ts`

**Step 1: 新增文本策略模块**

- `validateSummaryLength(text)`：180-260 合法
- `validateOutlineLength(text)`：40-120 合法
- `isOverHomogeneous(summary, outline)`：维持现有同质化检测

**Step 2: 接入 memory 应用前校验**

- 不合法文本不入库，进入重试或回退

**Step 3: 更新提示词规则**

- 明确“纪要目标约200字”

**Step 4: 测试**

- 空文本、数值占位文本均被拒收

**Step 5: Commit**

```bash
git add utils/memory/memoryTextPolicy.ts utils/aiServices.ts hooks/useGameLogic.ts tests/memory/memoryTextPolicy.test.ts
git commit -m "feat(memory): enforce 200-char summary policy"
```

---

## 3. P1 异步与稳定性（报错率下降）

### Task 4: 给 memory API 调用加重试与指数退避

**Files:**

- Create: `utils/aiRetry.ts`
- Modify: `utils/aiServices.ts`
- Test: `tests/aiDispatch.test.ts`

**Step 1: 新增通用重试器**

- 默认：`maxRetries=3`
- 退避：`500ms -> 1000ms -> 2000ms`
- 仅对可重试错误生效（429/5xx/网络错误/空响应）

**Step 2: 接入 `generateServiceCommands('memory')`**

- 非 memory 服务先不改，避免放大变更面

**Step 3: 测试**

- 前两次失败第三次成功时，最终返回可用命令

**Step 4: Commit**

```bash
git add utils/aiRetry.ts utils/aiServices.ts tests/aiDispatch.test.ts
git commit -m "feat(memory): add retry with exponential backoff"
```

### Task 5: 增加请求超时与可取消能力

**Files:**

- Modify: `utils/aiDispatch.ts`
- Modify: `hooks/useGameLogic.ts`
- Test: `tests/state/logTableAutofill.test.tsx`

**Step 1: 请求级超时**

- 给 memory 请求增加超时（例如 20s，可配置）
- 超时抛出标准化错误

**Step 2: 传递 AbortSignal 到 memory 微服务调用链**

- 在 `enqueueMicroserviceTask -> runMemoryParallelBySheet -> generateServiceCommands` 全链传递

**Step 3: stale 任务中止**

- 任务过期时不仅 skip apply，还应尝试取消进行中的请求

**Step 4: 测试**

- 模拟慢请求：任务被新回合覆盖后应及时 abort，不阻塞后续批次

**Step 5: Commit**

```bash
git add utils/aiDispatch.ts hooks/useGameLogic.ts tests/state/logTableAutofill.test.tsx
git commit -m "fix(memory): add timeout and cancellation for stale tasks"
```

---

## 4. P2 并发与吞吐（速度优化）

### Task 6: memory 双请求并行改为可配置策略

**Files:**

- Modify: `hooks/useGameLogic.ts`
- Modify: `types/ai.ts`
- Test: `tests/state/logTableAutofill.test.tsx`

**Step 1: 新增策略开关**

- `memoryParallelBySheet: boolean`（默认 false）
- false 时单请求生成 summary+outline；true 时保留现有双请求并行

**Step 2: 默认使用单请求模式**

- 降低 “2次并行 + 1次fallback” 的额外延迟与不一致风险

**Step 3: 测试**

- 单请求下仍保持 AM 配对与字段校验通过

**Step 4: Commit**

```bash
git add hooks/useGameLogic.ts types/ai.ts tests/state/logTableAutofill.test.tsx
git commit -m "perf(memory): add configurable single-request generation mode"
```

### Task 7: 队列版本戳冲突补偿

**Files:**

- Modify: `hooks/useGameLogic.ts`
- Modify: `utils/taverndb/turnTransaction.ts`
- Test: `tests/taverndb/turnTransaction.test.ts`

**Step 1: 识别可补偿冲突**

- `sheet_version_conflict`
- `row_version_conflict`
- `memory-pair-rollback`

**Step 2: 自动补偿机制**

- 对 memory 任务做一次“重建快照后重排队”
- 限制最多一次，避免死循环

**Step 3: 测试**

- 人工制造冲突后，第二次补偿可成功写入且不重复

**Step 4: Commit**

```bash
git add hooks/useGameLogic.ts utils/taverndb/turnTransaction.ts tests/taverndb/turnTransaction.test.ts
git commit -m "fix(memory): add one-shot compensation for version conflicts"
```

---

## 5. P3 模板参数化（按模板驱动，不靠猜）

### Task 8: 引入 memory 填表参数配置（映射模板 updateConfig）

**Files:**

- Create: `utils/memory/memoryFillConfig.ts`
- Modify: `hooks/useGameLogic.ts`
- Modify: `components/game/modals/settings/*`（实际设置页对应文件）
- Test: `tests/state/logTableAutofill.test.tsx`

**Step 1: 新增配置项**

- `memoryFillBatchSize`
- `memoryFillFlushDelayMs`
- `memoryRequestTimeoutMs`
- `memoryMaxRetries`
- `summaryTargetChars`（默认 200）

**Step 2: 与模板字段建立映射说明**

- 模板 `updateConfig` 不直接驱动运行时，但在该模块中维护映射注释与默认值来源

**Step 3: 测试**

- 修改配置后，批处理数量与 flush 时机可观测变化

**Step 4: Commit**

```bash
git add utils/memory/memoryFillConfig.ts hooks/useGameLogic.ts components/game/modals/settings tests/state/logTableAutofill.test.tsx
git commit -m "feat(memory): parameterize fill pipeline with template-aligned config"
```

### Task 9: insert-only 语义收口

**Files:**

- Modify: `hooks/useGameLogic.ts`
- Modify: `utils/taverndb/turnTransaction.ts`
- Test: `tests/memory/logSourceOwnership.test.ts`

**Step 1: 限制 LOG 表写入方式**

- 对已存在 `编码索引` 的行，memory 写入默认拒绝覆盖
- 仅允许新增 AM 行；覆盖需显式 `forceReplace` 标记（默认关闭）

**Step 2: 测试**

- 重复写同一 AM 时应阻断并记录原因

**Step 3: Commit**

```bash
git add hooks/useGameLogic.ts utils/taverndb/turnTransaction.ts tests/memory/logSourceOwnership.test.ts
git commit -m "fix(memory): enforce insert-only semantics for LOG sheets"
```

---

## 6. P4 可观测性与验收

### Task 10: 统一 memory 错误码与诊断事件

**Files:**

- Modify: `hooks/useGameLogic.ts`
- Create: `utils/memory/memoryErrorCodes.ts`
- Test: `tests/memory/pairRollback.test.ts`

**Step 1: 错误码标准化**

- `MEM_TIMEOUT`
- `MEM_PARSE_FAIL`
- `MEM_FIELD_MISSING`
- `MEM_PAIR_MISMATCH`
- `MEM_VERSION_CONFLICT`
- `MEM_HOMOGENEOUS_REJECT`

**Step 2: 记录指标**

- 每回合记录：尝试次数、命中回退次数、耗时、最终状态

**Step 3: 测试**

- 触发每类错误码时可在日志中定位

**Step 4: Commit**

```bash
git add hooks/useGameLogic.ts utils/memory/memoryErrorCodes.ts tests/memory/pairRollback.test.ts
git commit -m "chore(memory): standardize error codes and diagnostics"
```

### Task 11: 端到端验收脚本与基准

**Files:**

- Create: `docs/qa/memory-fill-acceptance.md`
- Create: `tests/e2e/memory-fill-stability.test.ts`（若仓内已有 e2e 规范则按现有路径）

**Step 1: 验收场景**

- 连续 30 回合短对话（每轮 1-3 句）
- 强并发输入（快速触发回合）
- 人工注入 API 失败与慢响应

**Step 2: 指标门槛**

- 记忆填表成功率 >= 98%
- AM 配对错误率 <= 0.5%
- memory 单任务 P95 耗时 <= 3s（本地环境）

**Step 3: Commit**

```bash
git add docs/qa/memory-fill-acceptance.md tests/e2e/memory-fill-stability.test.ts
git commit -m "test(memory): add end-to-end stability acceptance suite"
```

---

## 7. 执行顺序（严格）

1. P0 约束硬化
2. P1 失败重试与超时取消
3. P2 并发策略与冲突补偿
4. P3 模板参数化与 insert-only 收口
5. P4 可观测性与验收

---

## 8. 回滚策略

1. 任何阶段上线后若错误率升高：
   - 先关闭 `memoryParallelBySheet`
   - 再关闭“自动补偿重排队”
   - 最后回退到旧 memory prompt 与旧长度策略
2. 保持配置开关可热切换，不依赖代码回滚

---

## 9. 完成定义（DoD）

1. 对照 `DND仪表盘配套模板.json` 的核心约束全部有实现映射与测试映射
2. 纪要长度策略明确为“约 200 字”，且由本地校验保证
3. memory 链路具备：重试、超时、取消、冲突补偿、错误码诊断
4. 通过稳定性验收并产出测试证据

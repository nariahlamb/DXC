# 3AI 硬合并：清单与执行计划

## 0. 目标边界（本次重构后）

- 仅保留 3 个可配置 AI 入口：`story`、`state`、`map`。
- 主叙事只负责：`logs`、`action_options`。
- 填表召回负责：
  - 叙事后异步并发填表（`LOG_Summary` + `LOG_Outline`）
  - 叙事前 AM 索引召回（固定注入 prelude）
- 地图生成 AI 只负责地图命令。
- 不允许通过隐藏开关方式“保留旧模式”，而是删除可达入口。

---

## 1. 全量清单（按改动层分组）

### A. 类型与配置层（必须先改）

1. 删除旧模式字段
- `types/ai.ts:15` 删除 `mode?: 'unified' | 'separate'`
- `types/ai.ts:4`、`types/ai.ts:16` 删除 `StoryWorkloadMode` / `storyWorkloadMode`
- `types/ai.ts:31` 删除 `unified`
- `types/ai.ts:43`、`types/ai.ts:44` 删除 `useServiceOverrides` / `serviceOverridesEnabled`

2. 收敛服务结构
- `types/ai.ts` 将 `services` 收敛为 `{ story, state, map }`

3. 默认配置收敛
- `hooks/useAppSettings.ts:118`
- `hooks/gameLogic/useGameLogicCore.ts:146`
- 删除所有 `memory/social/world/npcSync/npcBrain/phone` 的独立 endpoint 默认值，仅保留 3 服务

### B. 路由与分发层（高风险核心）

1. 重写服务解析
- `utils/aiDispatch.ts:68`
- 目标：`resolveServiceConfig(serviceKey)` 只解析 3 路
  - `story` -> `services.story`
  - `map` -> `services.map`
  - 其他全部 -> `services.state`
- 删除：`unified` 回退、`serviceOverrides` 分支、`state->memory` 旧回退

2. 路由判定简化
- `utils/aiRouting.ts` 删除 `storyWorkloadMode` 条件
- `shouldUseNarrativeOnlyPipeline` 改为固定 `true`（当 state 可用）

3. Prompt 判定去模式化
- `utils/aiPrompt.ts:45` `shouldUseNarrativeOnlyStoryPrompt` 不再读取 `mode`
- 直接以 `state` 可用性决定叙事输出协议

### C. 主流程与兼容桥接（高复杂度）

1. 删除 legacy path 执行通道
- `hooks/gameLogic/useGameLogicCore.ts:3739`
- 移除未命中扩展 action 时的 `updateStateByPath` 执行器

2. 删除 state 兼容补丁
- `hooks/gameLogic/useGameLogicCore.ts:4756` `applyStateServiceFallbacks`
- 禁止“自动补写/修复”掩盖 AI 输出问题

3. 清理 triad 外微服务入口
- `hooks/gameLogic/useGameLogicCore.ts:7781`
- 当前已禁用 `npcSync/social/npcBrain`，应进一步删除其调度入口与无效输入构建

4. 清理历史硬编码 debug
- `hooks/gameLogic/useGameLogicCore.ts:6619` 删除固定 `DEBUG_SESSION_ID` / `DEBUG_LOG_PATH`

### D. 服务输入与命令守卫

1. 明确服务边界
- `hooks/gameLogic/microservice/inputBuilder.ts`
- 仅维护：`memory`（填表任务）与 `state`（批次并发）与 `map`（地图上下文）

2. 命令白名单收敛
- `hooks/gameLogic/microservice/commandGuard.ts`
- 保留 `state/memory/map` 守卫，删除 triad 外服务 guard

### E. 测试与文档同步（必须同批）

1. 删除旧语义测试
- `tests/aiDispatch.test.ts:4`、`tests/aiDispatch.test.ts:67`
- `tests/aiRouting.test.ts:41`

2. 新增 triad-only 回归测试
- `resolveServiceConfig`：无 unified / 无 override / 无 legacy-memory 回退
- 主叙事命令强约束：仅 logs/action_options
- state 并发填表：批次并发 + 成对 AM
- map 专责命令：仅地图命令

3. 更新开发文档
- `README.md`、`DEVREADME.md` 的 AI 架构说明

---

## 2. 并行执行图（按依赖）

### 第 1 轮（可并行）

- Track A：类型与默认配置收敛（A）
- Track B：测试基线重构（E-1 初步）
- Track C：文档草案更新（E-3）

### 第 2 轮（可并行，依赖第 1 轮）

- Track D：`utils/aiDispatch.ts` + `utils/aiRouting.ts`（B）
- Track E：`utils/aiPrompt.ts` 判定去模式化（B-3）

### 第 3 轮（串行，依赖第 2 轮）

- Track F：`useGameLogicCore.ts` 删除 legacy 执行器与 fallback（C）

### 第 4 轮（可并行，依赖第 3 轮）

- Track G：`inputBuilder.ts` / `commandGuard.ts` 收敛（D）
- Track H：测试补齐与修复（E-2）

### 第 5 轮（串行）

- Track I：全量验证 + 风险回归 + 最终文档收敛

---

## 3. 验证清单（完成判定）

1. 类型与构建
- `npx tsc --noEmit`

2. 核心测试（每条 <= 60s）
- `npm test -- tests/aiDispatch.test.ts`
- `npm test -- tests/aiRouting.test.ts`
- `npm test -- tests/state/logTableAutofill.test.tsx`
- `npm test -- tests/memory/amRecallPreludeSanitization.test.tsx`

3. 行为验收
- 设置页仅可编辑 3 服务端点
- 主叙事返回时 `tavern_commands` 恒为空或被硬过滤
- state 服务可并发批次填表并维持 AM 成对
- map 请求仅产生地图命令
- 任何配置下都不存在 unified/legacy fallback 生效路径

---

## 4. 风险与缓解

1. 风险：直接删除 fallback 后，部分历史存档行为变化
- 缓解：在设置加载阶段做一次性 migration（旧字段 -> 3 路），并打迁移日志

2. 风险：测试大面积失败
- 缓解：先改类型与工厂，再改实现；每轮提交后跑最小测试集

3. 风险：流程中断时难定位
- 缓解：保留本会话文档与 NDJSON，按 H2/H3 优先排查

---

## 5. 本轮建议实施顺序（最小返工）

1. 先做 A（类型/默认值）
2. 再做 B（dispatch/routing/prompt）
3. 然后做 C（core legacy/fallback 删除）
4. 最后做 D + E（守卫/测试/文档）

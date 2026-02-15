# Understanding Document

**Session ID**: DBG-ai-triad-hard-consolidation-2026-02-14  
**Bug Description**: 彻底拆分重构 AI 模式为主叙事 + 填表召回 + 地图生成，安全删除其他入口，不再通过隐藏或关闭方式保留旧模式。  
**Started**: 2026-02-14T03:11:10.8374958+08:00

---

## Exploration Timeline

### Iteration 1 - Initial Exploration (2026-02-14 03:11 +08:00)

#### Current Understanding

- UI 层已经展示为 3 AI 终端，但运行时与类型层仍保留旧模式入口。
- 当前核心路由是：`story/map/state` 三路，但存在 `unified` 回退与 `legacy memory` 回退。
- 内部存在“兼容桥接 + fallback 注入 + 旧路径执行器”，这会让旧行为在运行时继续生效。

#### Evidence from Code Search

1. 入口与模型定义仍保留旧模式字段
- `types/ai.ts:15`：`mode?: 'unified' | 'separate'`
- `types/ai.ts:31`：`unified` 端点仍为必备结构
- `types/ai.ts:43`、`types/ai.ts:44`：`useServiceOverrides` / `serviceOverridesEnabled`
- `types/ai.ts:4`、`types/ai.ts:16`：`storyWorkloadMode` 与 `combined` 历史语义

2. 路由层存在统一模式与回退路径
- `utils/aiDispatch.ts:99`、`utils/aiDispatch.ts:120`：返回 `aiConfig.unified`
- `utils/aiDispatch.ts:83`-`utils/aiDispatch.ts:85`：`state` 缺失时回退 `memory`
- `utils/aiDispatch.ts:102`-`utils/aiDispatch.ts:113`：`useServiceOverrides` 分支仍保留

3. 设置归一化虽然强制 3 路，但仍复制旧字段
- `hooks/useAppSettings.ts:88`-`hooks/useAppSettings.ts:104`
- `hooks/gameLogic/settings.ts:60`-`hooks/gameLogic/settings.ts:76`
- `components/game/modals/settings/views/AIServicesView.tsx:33`-`components/game/modals/settings/views/AIServicesView.tsx:48`

4. 主流程保留旧兼容执行器与 fallback 逻辑
- `hooks/gameLogic/useGameLogicCore.ts:3739`：未命中扩展命令时走 legacy path handler
- `hooks/gameLogic/useGameLogicCore.ts:4756`：`applyStateServiceFallbacks` 自动补丁
- `hooks/gameLogic/useGameLogicCore.ts:5540`、`hooks/gameLogic/useGameLogicCore.ts:5781`：memory/state 并行失败后 fallback 请求
- `hooks/gameLogic/useGameLogicCore.ts:7398`：AM 召回 API 失败回退 local index
- `hooks/gameLogic/useGameLogicCore.ts:8618`：world update 分支仍受 `serviceOverridesEnabled.world` 影响

5. AM 召回与填表并行能力已部分就位
- `hooks/gameLogic/useGameLogicCore.ts:7336`：`resolvePreDialogueAmRecallBlock`（叙事前 AM 索引召回）
- `hooks/gameLogic/useGameLogicCore.ts:5468`：`runMemoryParallelBySheet`
- `hooks/gameLogic/useGameLogicCore.ts:5759`：`runStateParallelBySheet`
- `hooks/gameLogic/microservice/inputBuilder.ts:205`：memory 任务默认 `LOG_Summary + LOG_Outline`

6. 测试仍绑定旧模式/旧回退语义
- `tests/aiDispatch.test.ts:4`：测试工厂仍覆盖 `unified|separate`
- `tests/aiDispatch.test.ts:67`：显式断言 “falls back to legacy memory endpoint”
- `tests/aiRouting.test.ts:41`：显式断言 unified 分支语义

7. 存在硬编码历史调试会话残留
- `hooks/gameLogic/useGameLogicCore.ts:6619`：固定 `DEBUG_SESSION_ID` 与 `DEBUG_LOG_PATH` 指向旧缺陷会话

#### Corrected Understanding (Initial)

- ~~系统已经完全是纯 3 AI 模式~~ → UI 是 3 AI，运行时仍是“3 AI + 多层旧兼容”。
- ~~旧模式只是被隐藏~~ → 旧模式不仅被隐藏，还在类型、路由、fallback、测试中继续活跃。

#### Next Steps

- 生成可验证假设并建立清理顺序。
- 输出“删除入口清单”与“执行计划（分阶段 + 风险控制）”。
- 进入实现前，先锁定哪些 fallback 必须保留，哪些必须硬删除。

---

## Current Consolidated Understanding

### What We Know

- 当前目标 3 AI 拆分能力已在主链路存在：
  - 主叙事：`story`
  - 填表召回：`state`（并含 `memory` 并行补全）
  - 地图：`map`
- 叙事前 AM 索引召回能力已实现，且支持 memory API 参与召回。
- 真正阻碍“彻底合并为 3 AI”的，不是 UI，而是 **类型定义 + 路由回退 + 兼容执行器 + 测试断言**。

### What Was Disproven

- ~~只要去掉 UI 开关就能彻底收敛~~（错误；运行时与测试仍会激活旧路径）
- ~~旧模式仅表现为配置项~~（错误；旧模式已渗透到调度与回退逻辑）

### Current Investigation Focus

- 定位并下线所有会导致 `unified` / `legacy fallback` / `serviceOverrides` 再次生效的入口。
- 在不破坏“memory 并发填表 + AM 召回 + map 专职生成”的前提下做硬删除。

### Remaining Questions

- 哪些 fallback 是业务必需（容灾）且可保留为“同一 3AI 模型内部兜底”？
- 哪些 fallback 本质是旧架构兼容，必须彻底删除？
- 需要迁移的存量设置数据规模如何（线上/本地）？

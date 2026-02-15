# Idea Deep Dive: Runtime 权威化 + 审计闭环

## 核心概念
在 `state` 已启用时，主叙事输出只允许 `logs` 与 `action_options`。`tavern_commands` 一律不执行，并且每条被拒命令都写入可检索审计。

## 关键改动点
- `utils/aiRouting.ts`
  - `filterStoryCommands(commands, true)` 返回 `[]`。
- `hooks/gameLogic/useGameLogicCore.ts`
  - 对 `rawCommandsForService` 与 `filteredCommandsForService` 做差集。
  - 生成系统审计日志，字段建议：`turnId/requestId/source/action/sheetId/key/reasonCode`。
  - 保留并增强 `MEM_BOUNDARY_001`。

## 风险与缓解
- 风险：现有测试会失败。
- 缓解：同步更新 `tests/aiRouting.test.ts` 与 boundary 相关测试。

## MVP 验收
1. state 开启情况下，story 命令执行条数恒为 0。
2. 被过滤命令都能在审计中定位。
3. 主流程回合事务、日志写入、memory 填表不回归。

## 建议结论
**立即推进（pursue）**。

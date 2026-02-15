# DXC 开发说明（当前基线）

更新时间：2026-02-13

## 1. 当前架构结论（先看这个）

- AI 运行时已切换为 **triad-only（3AI）**：
  - `story`：只负责叙事与选项（`logs` / `action_options`）。
  - `state`：负责状态写表、记忆填表批处理、AM 召回相关状态任务。
  - `map`：只负责地图命令。
- 非 `story/map` 的服务键统一路由到 `state`，不再支持 unified/override/legacy-memory 回退。
- 记忆系统已切换为 **Table-First**。
- 运行时不再维护“短/中/长期记忆数组”。
- 记忆写入与读取统一走 TavernDB 表格链路：
  - 写入：`append_log_summary`、`append_log_outline`
  - 读取：`constructMemoryContext` + 表格召回模块

## 2. 关键约束

### 2.1 AI 输出契约

- 主叙事输出只接受：
  - `logs`
  - `tavern_commands`
  - `action_options`（可选）
- 不再接受旧版记忆兼容字段（包括手机侧旧字段）。

### 2.2 类型契约

- `MemorySystem` 仅保留：
  - `lastLogIndex`
- `MemoryConfig` 仅保留：
  - `instantLimit`
  - `memoryParallelBySheet?`
  - `memoryFillBatchSize?`
  - `memoryFillFlushDelayMs?`
  - `memoryRequestTimeoutMs?`

## 3. 运行时数据流

1. `useGameLogic` 接收主叙事响应并应用 `tavern_commands`。  
2. `commandQueue` + `turnTransaction` 做回合级处理与一致性校验。  
3. `state/memory` 链路执行批次填表，写入 `LOG_Summary` / `LOG_Outline`。  
4. `constructMemoryContext` 从表格与索引模块召回记忆并组装上下文。  

## 4. 关键文件地图

### 4.1 主流程

- `hooks/useGameLogic.ts`
- `hooks/gameLogic/commandQueue.ts`
- `hooks/gameLogic/extendedCommands.ts`
- `utils/taverndb/turnTransaction.ts`

### 4.2 记忆写入与召回

- `utils/aiContext.ts`
- `utils/memory/tavernTableRetriever.ts`
- `utils/memory/memoryIndexProjection.ts`
- `utils/memory/memoryRetriever.ts`
- `utils/memory/factBoundary.ts`
- `utils/memory/memoryTextPolicy.ts`

### 4.3 表格基础设施

- `utils/taverndb/sheetRegistry.ts`
- `utils/taverndb/tableStore.ts`
- `utils/taverndb/tableProjection.ts`
- `utils/taverndb/phoneTableAdapter.ts`

### 4.4 类型与提示词

- `types/ai.ts`
- `types/gamestate.ts`
- `prompts/system.ts`
- `prompts/system_multi.ts`
- `prompts/commands.ts`
- `prompts/phone.ts`
- `prompts/writing.ts`

## 5. 已下线旧链路

以下旧“记忆摘要链路”模块已移除，不再恢复：

- 旧摘要 Hook
- 旧摘要弹窗组件
- 旧摘要管理测试

## 6. 开发与验证

```bash
npm install
npm run dev
npm test
npx tsc --noEmit
npm run build
```

建议在提交前至少执行：

1. 目标变更相关测试（可按文件运行）。
2. `npx tsc --noEmit`。
3. `npm run build`。

## 7. 排障建议（记忆相关）

- 先查 `tavern_commands` 是否有成对写入：
  - `append_log_summary`
  - `append_log_outline`
- 再查 `turnTransaction` 是否触发配对校验/回滚。
- 最后查 `constructMemoryContext` 的召回模式与过滤参数。

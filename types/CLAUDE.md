[根目录](../CLAUDE.md) > **types**

# Types 模块

## 模块职责
提供 DXC 的静态契约层，统一游戏状态、AI 输入输出、TavernDB 表结构与扩展协议类型。

## 入口与启动
- `types/index.ts`: 统一导出
- `types/gamestate.ts`: 核心 `GameState` 定义
- `types/ai.ts`: AI provider / endpoint / global settings 契约

## 对外接口
- `GameState`, `AppSettings`, `TavernCommand`
- `AIProvider`: `gemini | openai | deepseek | custom`
- `GlobalAISettings.services`: `story/memory/state/map`
- `TavernDBSheetId`, `TavernDBRuntimeMeta`, `TavernDBSheetPatch`

## 关键依赖与配置
- 被 `components/`, `hooks/`, `utils/`, `tests/` 全域依赖
- `types/taverndb.ts` 维护模板表 ID 与冲突元数据

## 数据模型
- 玩家/世界：`character.ts`, `world.ts`, `social.ts`
- 状态主树：`gamestate.ts`
- 表格层：`taverndb.ts`
- AI 配置层：`ai.ts`

## 测试与质量
- 间接由全部测试覆盖；重点在 `tests/taverndb/*` 与 `tests/state/*`

## 常见问题 (FAQ)
- Q: AI 服务键是三路还是四路？
  - A: 核心配置是四路（story/memory/state/map）。
- Q: 新增 provider 时先改哪里？
  - A: 先改 `types/ai.ts` 的 `AIProvider`，再同步 UI、dispatch、测试。

## 相关文件清单
- `types/index.ts`
- `types/ai.ts`
- `types/gamestate.ts`
- `types/taverndb.ts`

## 变更记录 (Changelog)
- **2026-02-15 15:12:37**: 增补 AI 类型契约说明，明确四路服务与多 provider 联合类型。
- **2026-02-15 14:59:52**: 新建 types 模块文档，明确状态树与 TavernDB 契约边界。

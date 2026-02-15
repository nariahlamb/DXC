[根目录](../CLAUDE.md) > **prompts**

# Prompts 模块（AI Core）

## 模块职责
定义 DXC 的 AI 行为边界与协议约束，覆盖：
- 系统身份/叙事原则
- table-first 命令规范
- 数据结构与动作白名单
- 世界观、难度、社交、写作风格等提示模板

## 入口与启动
- `prompts/index.ts`: 模块聚合导出
- `prompts/system.ts`: 核心协议与铁律
- `prompts/commands.ts`: 命令场景与规范示例
- `prompts/schema.ts`: 状态树与字段结构定义

## 对外接口
- 被 `utils/aiPrompt.ts` 动态拼装
- 按 `AppSettings.promptModules` 进行启停与排序
- 支持 narrative-only 路由下的模块裁剪

## 关键依赖与配置
- 与 `utils/aiPrompt.ts`、`utils/aiGenerate.ts` 强耦合
- 与 `types/*`、`utils/contracts.ts` 的命令契约必须一致

## 数据模型
- 重点描述对象：`logs`、`tavern_commands`、`action_options`
- 强调表动作：`upsert_sheet_rows` / `delete_sheet_rows` / `apply_econ_delta` 等

## 测试与质量
- 协议相关：`tests/aiPromptTableFirst.test.ts`, `tests/aiRouting.test.ts`
- 服务提示词相关：`tests/socialServicePrompt.test.ts`

## 常见问题 (FAQ)
- Q: 业务规则调整优先改哪里？
  - A: 优先改 prompts，再同步 types/contracts/handlers/tests。
- Q: 是否允许 story 模型直接写业务命令？
  - A: 默认 narrative-only 模式下不允许，应由 state/memory 服务承担。

## 相关文件清单
- `prompts/index.ts`
- `prompts/system.ts`
- `prompts/commands.ts`
- `prompts/schema.ts`
- `prompts/system_multi.ts`

## 变更记录 (Changelog)
- **2026-02-15 14:59:52**: 重写模块文档结构，补充协议分层、接口关系与测试索引。

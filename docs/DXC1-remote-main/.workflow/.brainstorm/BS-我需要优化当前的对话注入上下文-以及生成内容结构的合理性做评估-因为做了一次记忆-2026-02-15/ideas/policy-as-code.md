# Idea Deep Dive: Policy-as-Code 单一策略源

## 核心概念
定义统一策略 schema（角色职责、允许动作、禁止动作、sheet 归属、注入配额），由此同时生成 Prompt 约束与 Runtime 守卫配置。

## 设计草案
- `policy.roles.story.allowedOutput = [logs, action_options]`
- `policy.roles.story.commands = deny_all`
- `policy.roles.memory.allowedSheets = [LOG_Summary, LOG_Outline]`
- `policy.roles.map.allowedActions = [upsert_exploration_map, set_map_visuals, upsert_battle_map_rows]`

## 风险与缓解
- 风险：初期引入编译层与迁移成本。
- 缓解：先只覆盖 story/memory/map 三个核心角色，state 后续再纳入。

## MVP 验收
1. Prompt 与 Runtime 规则从同一策略文件生成。
2. 增删角色规则不再需要改多处代码。
3. 与现有回合事务和 commandGuard 兼容。

## 建议结论
**中期推进（pursue-later）**。

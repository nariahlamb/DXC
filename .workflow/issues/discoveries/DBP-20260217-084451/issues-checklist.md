# 单独 API 配置下 state 变量更新 vs 前端显示 问题清单

- Discovery ID: DBP-20260217-084451
- Prompt: 检查当前项目的单独api配置的state变量更新和前端显示的所有内容，因为项目被破坏过一次 做了一次修复，现在state变量很多内容不填
- Intent: comparison
- 总发现数: 18
- 生成问题数: 11
- 对齐匹配率: 52%

## 高优先问题

1. [Critical] 剧情输入结构不匹配
   - 现象: state 服务输入使用扁平 STORY_ALLOWED_KEYS，而真实 StoryState 是嵌套结构。
   - 影响: 剧情主线/引导等核心字段容易丢失，前端回退到 Unknown 或 暂无。
   - 证据: utils/state/stateServiceInput.ts:48, types/story.ts:17

2. [High] 社交字段覆盖不足
   - 现象: 输入白名单不含 特别关注/记忆 等字段。
   - 影响: 日常仪表盘 NPC 动态、最近互动显示弱化或为空。
   - 证据: utils/state/stateServiceInput.ts:3, components/game/modals/DailyDashboardModal.tsx:145

3. [High] state 服务触发门槛导致更新缺失
   - 现象: 仅 ACTION + state apiKey 时才运行 state 服务。
   - 影响: 非 ACTION 场景不会补齐业务状态。
   - 证据: hooks/gameLogic/useGameLogicCore.ts:293

4. [High] state-owned 模式下 legacy 写入被丢弃
   - 现象: 开启 state 服务后，旧路径 set/push 业务写入会被阻断。
   - 影响: 如果模型仍输出旧命令格式，字段直接不更新。
   - 证据: hooks/gameLogic/useGameLogicCore.ts:146

5. [High] cadence_not_due 抑制世界/论坛更新
   - 现象: world/forum 命令在未到回合时被 guard 拒绝。
   - 影响: 新闻、传闻、论坛 UI 可多回合不刷新。
   - 证据: hooks/gameLogic/microservice/commandGuard.ts:131

6. [High] stateVariableWriter 域覆盖不完整
   - 现象: writer 仅覆盖 global_state/character_resources/inventory。
   - 影响: 其他域事件易出现 no_command，造成“看起来有事件但没更新”。
   - 证据: hooks/gameLogic/microservice/stateVariableWriter.ts:276

## 中优先问题

7. [Medium] 日常仪表盘字段缺乏稳定写入源
   - 现象: 日常仪表盘 为可选扩展，未检索到稳定写入链路。
   - 影响: UI 主要依赖 fallback，不利于一致性。
   - 证据: types/gamestate.ts:95, components/game/modals/DailyDashboardModal.tsx:66

8. [Medium] 世界更新判定对 nextTurn 依赖较脆弱
   - 现象: 下次更新回合 异常时 world 更新判定直接 false。
   - 影响: 可能出现世界状态停更。
   - 证据: hooks/gameLogic/useGameLogicCore.ts:412

9. [Medium] memory 默认回退到 state 配置存在隐式耦合
   - 现象: memoryService = rawServices.memory || rawServices.state。
   - 影响: 单独配置 state 时，memory 行为可能被意外改变。
   - 证据: hooks/gameLogic/settings.ts:41

10. [Medium] 日志摘要/大纲归 memory-owned，memory 不可用时相关面板可能空白
   - 现象: state 路径拒绝写入 LOG_Summary/LOG_Outline。
   - 影响: 战斗日志面板在某些配置下持续无数据。
   - 证据: hooks/gameLogic/microservice/commandGuard.ts:125, components/game/CombatPanel.tsx:194

11. [Medium] state 输入裁剪策略可能截断关键上下文
   - 现象: 字符串/层级/数组有固定上限。
   - 影响: 复杂状态下填表质量下降，表现为“部分字段不填”。
   - 证据: utils/state/stateServiceInput.ts:80

## 建议优先修复顺序

1. 先修 剧情输入结构 与 社交字段覆盖。
2. 再处理 legacy 写入阻断可观测性 与 cadence 抑制提示。
3. 最后补 日常仪表盘写入源 与 memory/state 配置解耦。

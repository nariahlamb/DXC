# DXC × SillyTavern DND 面板对齐实施计划（分阶段执行）

## 目标
- 在保持 DXC `GameState` 为 SSOT 的前提下，实现 `docs/ref` 模板与脚本机制的高兼容迁移。
- 让 UI 可见效果达到“沉浸式战斗面板 + 可用 NPC 面板 + 地图/骰池自动化”的可感知升级。
- 调整记忆注入策略，吸收 `docs/ref/sillytavern数据库脚本.js` 的“上下文层数与注入门控”思路。

## 非目标
- 不直接引入 chatSheets 作为主存储。
- 不直接复用高风险 prompt 片段。
- 不在本轮重写 DanMachi 主判定链。

## 阶段路线图

### Phase 0：基线与验收定义（1 天）
- [ ] 建立 `docs/ref` 对照矩阵（模板字段 -> DXC 字段/命令）。
- [ ] 固化可视化验收清单（战斗面板、NPC 列表、地图、骰池、判定日志）。
- [ ] 增加最小手工验收脚本（命令样例集）。

### Phase 1：UI 可见改造（2-3 天）
- [x] 战斗面板新增 NPC 列表抽屉（搜索、状态筛选、数量统计、战斗关联高亮）。
- [x] 战斗面板增强单位卡细节（阵营、状态效果、回合资源关联标识）。
- [x] 地图视图收敛：移除 `MICRO` 小地图入口，保留 `MID` 作为区域结构视图主入口。
- [ ] 移动端适配与抽屉交互优化。

### Phase 2：模板兼容层（2-4 天）
- [x] `set_map_visuals` 兼容 `VisualJSON + dimensions + terrain_objects` 输入。
- [x] `COMBAT_BattleMap` 兼容类型映射（`Config/Token/Wall/Terrain/Zone` -> DXC 结构）。
- [ ] `chatSheets import adapter`（最小支持：Encounter/BattleMap/MapVisuals/Dice/Exploration）。

### Phase 3：自动化层（2-3 天）
- [ ] DicePool auto-refill（阈值触发、批量补池、冷却防抖）。
- [x] 探索地图结构生成编排（最小闭环：缺失命令时自动注入 `upsert_exploration_map` + 本地 fallback 结构图）。
- [ ] 战斗地图视觉编排（底图对象与逻辑层联动）。

### Phase 4：记忆注入与上下文治理（1-2 天）
- [x] 记忆模块支持“上下文层”注入模式（优先 AI 层，按层数裁剪，可携带前置用户消息）。
- [ ] 细化上下文门控策略（静默/后台请求不污染主链注入）。
- [ ] 为记忆注入增加调试标记与可视化诊断信息。

### Phase 5：验证与收口（1-2 天）
- [ ] 增加回归测试（commands contract、map visuals compatibility、memory context shaping）。
- [ ] `npm run build` + 手工 UI 验收通过。
- [ ] 输出迁移说明与开关策略（默认路径与 fallback）。

## 当前执行批次（2026-02-08）
- [x] P1-UI-01：CombatPanel 增加 NPC 抽屉与检索筛选。
- [x] P2-COMPAT-01：`set_map_visuals` 增加 `VisualJSON` 兼容转换。
- [x] P4-MEM-01：`constructMemoryContext` 增加“Context Layers”注入策略。
- [x] P1-UI-02：NPC 抽屉与战斗 token 定位联动。
- [x] P2-COMPAT-02：`upsert_battle_map_rows` 兼容 `Config/Token/Wall/Terrain/Zone + 坐标/大小` 行格式。
- [x] P1-UI-03：TacticalGrid 增加静态层（障碍物/地形）渲染。
- [x] P3-AUTO-01：地图更新流程增加 `upsert_exploration_map` 命令归一化与 fallback 自动补图。
- [x] P3-AUTO-02：MapModal / MobileMapView 在缺失结构时自动触发地图更新请求。
- [x] P1-UI-04：MapModal / MobileMapView 移除 `MICRO/small` 视图与关联切换逻辑，统一以 `MID` 承载结构图展示。
- [x] P5-VERIFY-01：构建与回归验证（`npm run build`）。

## 验收标准（本批次）
- 打开战斗面板时，顶栏可进入 NPC 列表抽屉，并可进行搜索与状态筛选。
- 传入 SillyTavern 风格 `VisualJSON` 时，战斗地图能正常显示，不因 schema 不一致失败。
- 记忆上下文中出现 `Instant Context Layers` 样式块，且层数裁剪生效。

## 风险与缓解
- 风险：兼容转换过宽导致错误字段吞并。
  - 缓解：保留 `MapVisualsSchema` 作为最终校验口。
- 风险：历史设置覆盖默认 `m_mem` 参数。
  - 缓解：设置加载时对 `params` 深合并（已执行）。
- 风险：UI 交互改动影响现有战斗流程。
  - 缓解：先保持只读抽屉，不侵入战斗指令提交链。

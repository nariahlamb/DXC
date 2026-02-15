# DXC 说明书式导航参考资料（ref 对照版）

## 1. 文档目标

本资料用于把 `docs/ref` 的 SillyTavern 参考体系，与 DXC 当前运行时实现做一一对照，形成可直接执行的导航手册。

适用场景：

- 你要优化记忆索引召回，但不想误改战斗或表结构。
- 你要升级 DND/战斗能力，需要先确认“参考依据”在 DXC 的落点。
- 你要做回归排查，需要快速定位链路与校验点。

---

## 2. 先看边界（非常关键）

### 2.1 参考源与实现源

- 参考源：`docs/ref/*`
- 实现源：`hooks/*`、`utils/*`、`types/*`、`components/*`

### 2.2 运行时基线

- 基线 1：`triad-only`（`story` / `state` / `map`）
- 基线 2：`table-first`（事实以表为主，模块对象为投影）
- 基线 3：记忆写入/召回统一走 `LOG_Summary` + `LOG_Outline`

对应依据：

- `DEVREADME.md`
- `docs/architecture/table-first-ssot.md`

---

## 3. 参考体系速览（docs/ref）

### 3.1 文件职责

- `SillyTavern脚本模板-总索引.md`：全局导览
- `sillytavern数据库脚本-分解说明.md`：数据库主脚本职责与 API
- `DND仪表盘配套模板-分解说明.md`：20 张核心业务表与约束
- `数据库默认索引召回预设-分解说明.md`：索引召回预设语义
- `战斗推进v1-1-分解说明.md`：战斗推进预设语义

### 3.2 关键结构结论

- 模板核心表（示例）：
  - `LOG_Summary` / `LOG_Outline`
  - `COMBAT_Encounter` / `COMBAT_BattleMap` / `COMBAT_Map_Visuals`
  - `DICE_Pool`
  - `EXPLORATION_Map_Data`
  - `CHARACTER_Attributes` / `CHARACTER_Resources`
- 预设提取标签：
  - 默认索引召回：`extractTags=recall`
  - 战斗推进：`extractTags=用户输入,recall`

---

## 4. 当前实现速览（DXC）

### 4.1 总入口

- 主流程：`hooks/gameLogic/useGameLogicCore.ts`
- 事务与一致性：`utils/taverndb/turnTransaction.ts`
- 表定义与映射：`utils/taverndb/sheetRegistry.ts`
- 表投影：`utils/taverndb/tableProjection.ts`

### 4.2 记忆与召回

- 记忆上下文构建：`utils/aiContext.ts` `constructMemoryContext`
- AM 编码规则：`utils/memory/amIndex.ts`
- 索引投影：`utils/memory/memoryIndexProjection.ts`
- 索引召回：`utils/memory/memoryRetriever.ts`
- 表行召回：`utils/memory/tavernTableRetriever.ts`

### 4.3 DND 与战斗

- DND 映射与表写处理：`hooks/gameLogic/commands/allHandlers.ts`
- 战斗命令模块：`hooks/gameLogic/commands/combatHandlers.ts`
- 战斗 UI：`components/game/CombatPanel.tsx`

---

## 5. 四条主链导航

## 5.1 记忆写入与配对链

### 参考依据

- `DND仪表盘配套模板-分解说明.md`
- `数据库默认索引召回预设-分解说明.md`

### DXC 落点

- 写入动作：`append_log_summary`、`append_log_outline`
- 校验与规范化：`hooks/gameLogic/commands/allHandlers.ts`
- AM 自动分配与配对检查：`utils/memory/amIndex.ts`
- 非 memory 来源拦截：`utils/taverndb/turnTransaction.ts`

### 必查点

1. `append_log_summary` 是否最少包含有效纪要信息。
2. `append_log_outline` 是否与摘要共享同一 `AMxxxx`。
3. `LOG_*` 补丁来源是否为 `ms:memory`（否则可能被事务阻断）。

### 回归证据

- `tests/memory/pairRollback.test.ts`：单边写入时回滚。

---

## 5.2 索引召回链

### 参考依据

- `数据库默认索引召回预设.json`（`extractTags=recall`）

### DXC 落点

- 参数入口：`useGameLogicCore.ts` 的 `m_mem.params`
  - `indexRetrievalTopK`
  - `indexSummaryWindow`
  - `indexOutlineWindow`
  - `indexSourceFilter`
- 实际构建：`utils/aiContext.ts` `constructMemoryContext`
- 投影与打分：
  - `utils/memory/memoryIndexProjection.ts`
  - `utils/memory/memoryRetriever.ts`

### 必查点

1. `enableIndexRetrieval` 是否开启。
2. `summary/outline window` 是否与内容规模匹配。
3. query 是否为空；为空时会退化到最近记忆切片。

---

## 5.3 DND 表契约链

### 参考依据

- `DND仪表盘配套模板.json`
- `DND仪表盘配套模板-分解说明.md`

### DXC 落点

- 表 ID 注册：`types/taverndb.ts`
- 列定义：`utils/taverndb/sheetRegistry.ts`
- DND 档案映射：`hooks/gameLogic/commands/allHandlers.ts`
  - `CHARACTER_Attributes` -> `state.角色.dndProfile`
  - `CHARACTER_Resources` -> `法术位`、`生命骰`
- 反投影：`utils/taverndb/tableProjection.ts`

### 必查点

1. `CHARACTER_Attributes` 的关键字段是否齐全：`AC/先攻加值/速度/属性值/豁免熟练/技能熟练/被动感知`。
2. `CHARACTER_Resources` 是否写回 `法术位/生命骰/金币`。
3. `dndProfile` 与 `DND档案` 双字段是否保持一致。

---

## 5.4 战斗推进链

### 参考依据

- `战斗推进v1-1.json`
- `战斗推进v1-1-分解说明.md`

### DXC 落点

- 命令处理：
  - `set_encounter_rows`
  - `upsert_battle_map_rows`
  - `set_map_visuals`
  - `set_initiative`
  - `append_combat_resolution`
- 处理文件：`hooks/gameLogic/commands/combatHandlers.ts`
- 具体实现：`hooks/gameLogic/commands/allHandlers.ts`
- UI 承载：`components/game/CombatPanel.tsx`

### 必查点

1. `COMBAT_BattleMap` 是否存在可恢复尺寸的 config 语义。
2. 单位坐标是否在地图尺寸范围内。
3. 战斗结果是否落入 `判定事件` 或可回放日志。

---

## 6. 参考与实现对照索引（执行版）

## 6.1 记忆系统

- 参考：`数据库默认索引召回预设-分解说明.md`
- 实现：
  - `utils/aiContext.ts`
  - `utils/memory/memoryIndexProjection.ts`
  - `utils/memory/memoryRetriever.ts`
  - `utils/memory/amIndex.ts`
- 测试：
  - `tests/memory/memoryContextRetrieval.test.ts`
  - `tests/memory/memoryRetriever.test.ts`
  - `tests/memory/pairRollback.test.ts`

## 6.2 DND 系统

- 参考：`DND仪表盘配套模板-分解说明.md`
- 实现：
  - `utils/taverndb/sheetRegistry.ts`
  - `hooks/gameLogic/commands/allHandlers.ts`
  - `utils/taverndb/tableProjection.ts`

## 6.3 战斗系统

- 参考：`战斗推进v1-1-分解说明.md`
- 实现：
  - `hooks/gameLogic/commands/combatHandlers.ts`
  - `hooks/gameLogic/commands/allHandlers.ts`
  - `components/game/CombatPanel.tsx`
  - `utils/diceEngine.ts`

---

## 7. 常见问题与排查路径

### 问题 1：明明写了摘要，但召回不到

排查顺序：

1. 看 `append_log_summary` 和 `append_log_outline` 是否成对。
2. 看 AM 是否被规范化为 `AMxxxx`。
3. 看 `indexSummaryWindow/indexOutlineWindow` 是否太小。
4. 看 sourceFilter 是否把该来源过滤掉。

### 问题 2：战斗地图显示错位

排查顺序：

1. `COMBAT_BattleMap` 是否有 Config 行或可恢复尺寸信息。
2. `set_map_visuals` 与 `upsert_battle_map_rows` 是否同轮同步。
3. 坐标是否超出地图尺寸边界。

### 问题 3：DND 属性看起来没生效

排查顺序：

1. `CHARACTER_Attributes` 行中 `CHAR_ID` 是否命中主角。
2. 映射字段是否命中别名（中英文字段）。
3. `dndProfile` 与 `DND档案` 是否同步回写。

---

## 8. 建议实施路线（对后续升级）

1. 先固定本手册为团队统一入口。
2. 增加 `navigation-manifest.json`，把“参考->实现”映射结构化。
3. 增加 `navigation-drift` 测试，防止文档与代码漂移。
4. 稳定后再做 UI 内嵌导航与可视化召回分析。

---

## 9. 结论

你当前体系已经具备“以参考为依据做增量优化”的基础条件。

最稳妥策略不是重构系统，而是先把“参考依据 -> 当前实现 -> 验证证据”做成可维护导航层，再基于该导航层推进记忆召回、DND、战斗能力升级。

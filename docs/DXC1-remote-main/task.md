# DXC 适配改造任务看板

更新时间：2026-02-13

## 目标
- 让现有记忆体系、属性体系、提示词模块更好适配参考体系（DND 仪表盘模板 + 召回预设 + 战斗推进预设）。
- 优先做不破坏现有 table-first 架构的增量改造。

## 执行阶段

### P0（必须先完成）
- [x] P0-1 记忆双通道召回接入主链
  - 文件：`utils/aiContext.ts`、`utils/memory/memoryIndexProjection.ts`、`utils/memory/memoryRetriever.ts`
  - 目标：在表格召回之外，新增索引召回块（AM/关键词），支持开关与过滤。
  - 验收：`tests/memory/memoryContextRetrieval.test.ts` 新增/更新通过。

- [x] P0-2 角色属性/资源完整回写
  - 文件：`hooks/gameLogic/extendedCommands.ts`
  - 目标：`CHARACTER_Attributes/Resources` 完整回写到 `角色.dndProfile/DND档案`（AC、先攻、速度、属性值、豁免、技能熟练、被动感知、法术位、生命骰、金币）。
  - 验收：`tests/taverndb/sheetWriteHandlers.test.ts` 增加字段回写用例并通过。

- [x] P0-3 提示词源治理（去 legacy path 示例）
  - 文件：`prompts/logic.ts`、`prompts/story.ts`、`prompts/world.ts`、`prompts/loot.ts`、`utils/aiContext.ts`
  - 目标：源提示词/上下文提示直接 table-first，不再依赖 sanitize 补丁兜底。
  - 验收：新增测试校验不出现业务 `set/add/push/delete gameState.*` 示例。

### P1（可视化与可控性增强）
- [x] P1-1 设置页开放记忆检索参数（mode/topK/filter/source）
  - 文件：`components/game/modals/settings/SettingsContext.tsx`、`hooks/useAppSettings.ts`、`hooks/useGameLogic.ts`
  - 结果：`MEMORY_CONTEXT` 支持模式、表格/索引召回开关、TopK、表格过滤、索引来源过滤、索引窗口配置。

- [x] P1-2 记忆面板展示召回质量指标（AM 配对率、unknown slots、同质化）
  - 文件：`components/game/modals/MemoryModal.tsx`
  - 结果：复用 `SYS_ValidationIssue` 质量指标行，新增顶部指标卡并展示严重级别。

- [x] P1-3 战斗事件到记忆摘要联动增强
  - 文件：`hooks/useGameLogic.ts`
  - 结果：memory fill 输入新增 `本回合战斗事件`，并将战斗判定事件转为叙事片段参与本回合记忆填表。

### P2（字段全局对齐与DND脚本兼容）
- [x] P2-1 全局检索与差异定位
  - 文件：`docs/ref/DND仪表盘配套模板.json`、`docs/ref/酒馆助手脚本-DND沉浸式仪表盘 v1.9.0.json`、`utils/taverndb/tableProjection.ts`、`hooks/gameLogic/extendedCommands.ts`
  - 结论：核心差异集中在 `COMBAT_BattleMap` 语义行（`Config/Token/Wall/Terrain/Zone`）与 `upsert` 英文别名输入链路，而非模板字段定义本身。

- [x] P2-2 Projection 输出口径修补（模板+脚本双兼容）
  - 文件：`utils/taverndb/tableProjection.ts`
  - 结果：
    - `COMBAT_BattleMap` 投影增加 `Map_Config` 行并输出 `Config` 类型。
    - 地图实体类型标准化为 `Token/Wall/Terrain/Zone`。
    - 坐标与尺寸统一输出脚本可解析格式（`{"x":...,"y":...}` / `{"w":...,"h":...}`）。
    - `LOG_Summary/LOG_Outline` 补齐常见别名读取（`summary/outline/amIndex/timeSpan`）。

- [x] P2-3 Upsert 别名兼容修补（全局输入口）
  - 文件：`hooks/gameLogic/extendedCommands.ts`
  - 结果：
    - `COMBAT_BattleMap` 不再提前“去语义化”，保留并正确处理 `Config` 行。
    - `CHARACTER_Attributes/Resources` 新增英文别名支持（`level/hp/ac/initiativeBonus/speed/abilityScores/spellSlots/hitDice/gp`）。
    - `LOG_Summary/LOG_Outline` 新增别名支持（`summary/outline/amIndex/time/timeSpan/chapter/title/events`）。
    - `COMBAT_Map_Visuals` 与 `EXPLORATION_Map_Data` 新增更多字段别名兼容。

- [x] P2-4 回归验证
  - 文件：`tests/taverndb/tableProjection.test.ts`、`tests/taverndb/sheetWriteHandlers.test.ts`、`tests/state/logTableAutofill.test.tsx`
  - 结果：新增 battlemap/config 与别名输入测试，目标回归全部通过。

- [x] P2-5 DND 兼容诊断指标（逻辑层）
  - 文件：`utils/taverndb/tableProjection.ts`
  - 结果：
    - `SYS_ValidationIssue` 新增 `METRIC_DND_BATTLEMAP`（Config/尺寸/类型/越界检查）
    - `SYS_ValidationIssue` 新增 `METRIC_DND_CHARACTER`（角色 DND 关键字段完整性检查）

- [x] P2-6 DND 兼容诊断卡（UI层）+ 提示词约束补强
  - 文件：`components/game/modals/MemoryModal.tsx`、`prompts/commands.ts`、`utils/aiServices.ts`
  - 结果：
    - MemoryModal 顶部新增 `BattleMap兼容`、`角色DND字段` 两张诊断卡
    - 命令提示与 state 服务提示词新增 battlemap/visuals/character 表字段硬约束

- [x] P2-7 总结/大纲日志纯净化（AM条目）+ 玩家名占位统一
  - 文件：`hooks/useGameLogic.ts`、`hooks/gameLogic/extendedCommands.ts`、`tests/taverndb/sheetWriteHandlers.test.ts`、`tests/state/logTableAutofill.test.tsx`
  - 结果：
    - 手机事件不再写入 `LOG_Summary/LOG_Outline`（仅保留在 `PHONE_*` / `FORUM_*`）。
    - `append_log_summary` / `upsert LOG_Summary` 的 `重要对话` 统一支持 `{{user}}` 与 `player/user/you` 说话者替换为当前玩家名。
    - 对 `【手机】...` 形式条目在日志写入层做过滤，避免污染 AM 配对记忆链。

- [x] P2-8 物品写入容错（upsert_inventory）
  - 文件：`hooks/gameLogic/extendedCommands.ts`、`tests/taverndb/sheetWriteHandlers.test.ts`
  - 结果：
    - `upsert_inventory` 支持单对象/嵌套 payload（`value/rows/items`）与英文别名字段（`name/item_name/qty/type/description/quality`）。
    - 对无效物品行改为“跳过并继续”，避免单条坏数据导致整批事务回滚。

- [x] P2-9 经济指令容错 + 同表多行事务版本冲突修复
  - 文件：`hooks/useGameLogic.ts`、`tests/state/logTableAutofill.test.tsx`
  - 结果：
    - `apply_econ_delta` 支持直字段容错解析（无 `value` 时从命令体抽取），并纳入非阻断校验，避免空 payload 触发全事务回滚。
    - 同一命令内同表多行 patch 的 `expectedSheetVersion` 按行递增，修复 `expected=0 actual=1` 的自冲突。

- [x] P2-10 发送前卡顿排查与预处理性能减负
  - 文件：`hooks/useGameLogic.ts`
  - 结果：
    - 删除发送前无效的 `setSnapshotState(structuredClone(gameState))` 深拷贝路径（该状态未被消费）。
    - 快照生成改为 `JSON.stringify` + 字段过滤（跳过 `snapshot/rawResponse`），避免先整树 `structuredClone` 再清洗导致的大对象复制。
    - 新增发送前耗时告警：当预处理超过 180ms，在控制台输出 `preflightMs/snapshotMs/logsCount`，用于定位卡顿来源。

- [x] P2-11 流式渲染真实性排查与重排卡顿治理
  - 文件：`utils/aiDispatch.ts`、`components/game/CenterPanel.tsx`
  - 结果：
    - 确认 openai-compatible 路径使用 `response.body.getReader()` 按 SSE 分块消费，属于真流式。
    - 增加可开关流式诊断日志（`__DXC_STREAM_TRACE`）：输出 `chunks/firstChunkMs/totalMs/chars`，用于识别网关是否把流合并成尾部大包。
    - 流式期间自动滚动改为“近底部触发 + 180ms节流 + behavior:auto”，减少 `scrollIntoView(smooth)` 高频触发导致的 forced reflow。

- [x] P2-12 命令动作字段兼容修复（`name` 别名）
  - 文件：`hooks/useGameLogic.ts`、`tests/state/logTableAutofill.test.tsx`
  - 结果：
    - 命令归一化动作提取新增 `name` 别名（覆盖主事务处理、过滤器、sheet 推断、调试分支）。
    - 修复 `{name:'upsert_sheet_rows', args:{...}}` / `{name:'apply_econ_delta', args:{...}}` 被误判为 `missing action/key` 的问题。
    - 新增 `name+args(+value)` 回归测试，覆盖 `PHONE_*` 与 `apply_econ_delta` 混合批次。

## 当前执行顺序
1. 继续做提示词模块与字段约束对齐（memory/combat prompt 输入约束显式化）
2. 补充跨模块 E2E 验证（表投影 -> prompt 输入 -> upsert 回写闭环）

## 进度日志
- [2026-02-13] 初始化任务看板，开始执行 P0-1。
- [2026-02-13] 完成 P0-1：`constructMemoryContext` 已接入 Memory Index Retrieval，并支持 `enableIndexRetrieval/indexSourceFilter/indexRetrievalTopK`。
- [2026-02-13] 完成 P0-2：`CHARACTER_Attributes/Resources` 已完整回写 DND 档案关键字段（AC/先攻/速度/属性值/熟练/法术位/生命骰/金币）。
- [2026-02-13] 完成 P0-3：`story/loot/logic/world` 路径式命令示例已清理为 table-first；`aiContext` NPC 写入提示已改为表格命令。
- [2026-02-13] 测试通过：`tests/aiPromptTableFirst.test.ts`、`tests/memory/memoryContextRetrieval.test.ts`、`tests/taverndb/sheetWriteHandlers.test.ts`。
- [2026-02-13] 完成 P1-1：设置页已开放 MEMORY_CONTEXT 检索参数（mode/topK/filter/source/window/开关）。
- [2026-02-13] 完成 P1-2：MemoryModal 已展示 AM配对率、UNKNOWN_SLOTS、同质化指标卡（来自 SYS_ValidationIssue）。
- [2026-02-13] 完成 P1-3：memory fill 请求已注入本回合战斗判定事件与战斗叙事片段。
- [2026-02-13] 测试通过：`components/game/modals/SettingsModal.test.tsx`、`tests/ui/memoryModalDevtools.test.tsx`、`tests/state/logTableAutofill.test.tsx`。
- [2026-02-13] 完成 P2-1：全局检索对比模板/脚本与代码实现，确认字段定义层基本对齐，差异集中在 battlemap 语义与 upsert 别名。
- [2026-02-13] 完成 P2-2：`COMBAT_BattleMap` 投影新增 `Map_Config` 与 `Config/Token/Wall/Terrain/Zone` 兼容输出。
- [2026-02-13] 完成 P2-3：扩展 `LOG_*`、`CHARACTER_*`、`COMBAT_*`、`EXPLORATION_*` 的别名输入兼容并修复 `token://` 图标协议误识别。
- [2026-02-13] 测试通过：`tests/taverndb/tableProjection.test.ts`、`tests/taverndb/sheetWriteHandlers.test.ts`、`tests/state/logTableAutofill.test.tsx`（62/62）。
- [2026-02-13] 完成 P2-5：`SYS_ValidationIssue` 增加 DND 兼容诊断指标（BattleMap/Character）。
- [2026-02-13] 完成 P2-6：MemoryModal 新增 DND 兼容诊断卡；`prompts/commands.ts` 与 `utils/aiServices.ts` 增强 battlemap/character 约束提示。
- [2026-02-13] 测试通过：`tests/taverndb/tableProjection.test.ts`、`tests/taverndb/sheetWriteHandlers.test.ts`、`tests/ui/memoryModalDevtools.test.tsx`、`tests/state/logTableAutofill.test.tsx`（65/65）。
- [2026-02-13] 完成 P2-7：修复总结表 `player/user/you` 未替换问题，统一走 `{{user}}`->玩家名；同时过滤 `【手机】...` 进入 `LOG_Summary/LOG_Outline` 的路径。
- [2026-02-13] 测试通过：`tests/taverndb/tableProjection.test.ts`、`tests/taverndb/sheetWriteHandlers.test.ts`、`tests/ui/memoryModalDevtools.test.tsx`、`tests/state/logTableAutofill.test.tsx`（68/68）。
- [2026-02-13] 完成 P2-8：修复 `upsert_inventory` 对英文字段/单对象 payload 的兼容，避免 `名称` 缺失校验导致整批回滚。
- [2026-02-13] 测试通过：`tests/taverndb/sheetWriteHandlers.test.ts`、`tests/state/logTableAutofill.test.tsx`、`tests/taverndb/tableProjection.test.ts`、`tests/ui/memoryModalDevtools.test.tsx`（70/70）。
- [2026-02-13] 完成 P2-9：修复 `apply_econ_delta` 空 payload 阻断与同表多行版本自冲突（`sheet_version_conflict expected=0 actual=1`）。
- [2026-02-13] 测试通过：`tests/state/logTableAutofill.test.tsx`、`tests/taverndb/sheetWriteHandlers.test.ts`、`tests/taverndb/tableProjection.test.ts`、`tests/ui/memoryModalDevtools.test.tsx`（71/71）。
- [2026-02-13] 完成 P2-10：修复发送前预处理卡顿（移除无效深拷贝 + 轻量快照序列化 + 慢路径告警）。
- [2026-02-13] 测试通过：`tests/state/logTableAutofill.test.tsx`、`tests/taverndb/sheetWriteHandlers.test.ts`、`tests/taverndb/tableProjection.test.ts`、`tests/ui/memoryModalDevtools.test.tsx`（71/71）。
- [2026-02-13] 完成 P2-11：确认流式链路为真流式；新增流式 trace 指标；修复流式期间高频 smooth scroll 引发的布局抖动。
- [2026-02-13] 测试通过：`tests/aiDispatch.test.ts`、`tests/ui/memoryModalDevtools.test.tsx`、`tests/state/logTableAutofill.test.tsx`（41/41）。
- [2026-02-13] 完成 P2-12：修复命令 `name` 字段未识别导致的 `missing action/key`，`upsert_sheet_rows/apply_econ_delta` 可正常落表。
- [2026-02-13] 测试通过：`tests/state/logTableAutofill.test.tsx`、`tests/taverndb/sheetWriteHandlers.test.ts`、`tests/taverndb/tableProjection.test.ts`、`tests/ui/memoryModalDevtools.test.tsx`（72/72）。

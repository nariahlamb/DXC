# Analysis Discussion

**Session ID**: ANL-sillytavern-dnd-dashboard-dxc-migration-2026-02-08
**Topic**: 总结 docs\ref\酒馆助手脚本-DND沉浸式仪表盘 v1.9.0.json 与 docs\ref\DND仪表盘配套模板.json 的 DND 机制实现；对照 DXC 项目同类实现；识别可无损移植机会。
**Started**: 2026-02-08T15:58:00+08:00
**Dimensions**: architecture, implementation, comparison, decision

---

## User Context

**Focus Areas**: DND机制 / 日常地图 / 战斗地图 / 骰子判定 / 战斗判定 / 人物6维机制 / DXC迁移路径
**Analysis Depth**: deep

---

## Discussion Timeline

### Round 1 - Initial Understanding (2026-02-08 15:58+08:00)

#### Topic Analysis

基于当前 topic，拆分为三条主线：

1. 解析 SillyTavern 脚本 + 模板的“数据契约 + UI逻辑 + AI生成链路”。
2. 对照 DXC 的现有契约与渲染链路（types/contracts/hooks/components/prompts）。
3. 评估“可无损移植”范围与边界（直接迁移 / 需适配 / 不建议）。

#### Key Questions to Explore

- 酒馆脚本的 DND 核心机制，哪些是“数据层强约束”，哪些是“UI侧增强”？
- DXC 在地图、战斗、骰池、判定事件、属性体系上与其重合度有多高？
- 哪些能力可在不破坏 DXC 现有架构的前提下直接接入？

#### Exploration Results (2026-02-08 16:10+08:00)

**Sources Analyzed**:
- docs/ref/酒馆助手脚本-DND沉浸式仪表盘 v1.9.0.json（脚本主逻辑，含 chatSheets 读写、地图与骰池函数）
- docs/ref/DND仪表盘配套模板.json（chatSheets schema 模板）
- hooks/gameLogic/extendedCommands.ts（DXC 扩展指令执行）
- hooks/useGameLogic.ts（DXC 指令路由 + upsert_exploration_map）
- types/combat.ts、types/world.ts、types/gamestate.ts（契约）
- components/game/modals/MapModal.tsx、components/combat/map/TacticalGrid.tsx、components/game/CombatPanel.tsx（UI落地）
- prompts/commands.ts、prompts/schema.ts、prompts/judgment.ts（AI输出约束）

**Key Findings (SillyTavern 侧)**:
1. **整体架构是「chatSheets as SSOT + 前端脚本增强」**：模板把 `SYS_GlobalState / COMBAT_Encounter / COMBAT_BattleMap / DICE_Pool / EXPLORATION_Map_Data / CHARACTER_Attributes` 等表定义为强结构，脚本通过 `getTable/saveData` 驱动 UI 与状态。
2. **日常地图机制是二段式生成**：
   - 先生成 `MapStructureJSON`（房间/门/特征的结构 JSON，含网格化约束）。
   - 再渲染成 SVG（探索地图结构图）。
   - 触发点依赖 `EXPLORATION_Map_Data` 按 LocationName 命中或新建。
3. **战斗地图机制是三段式**：
   - `COMBAT_BattleMap` 持有逻辑层（Token/Wall/Terrain/Zone + 坐标）。
   - `COMBAT_Map_Visuals` 持有视觉层（ground/terrain_objects）。
   - 脚本通过 `battleStructure -> battleSVG` 生成底图，再叠加 token 与交互。
4. **骰子机制是预生成骰池**：`DICE_Pool` 维护 D4~D100 列，脚本含 `generateRow/checkAndRefill/getDicePoolData/rollDice/rollCustomDice`，强调“消费即删除 + 自动补充”。
5. **战斗判定机制是“表驱动 + UI轨道”**：`COMBAT_Encounter` 维护先攻/HP/状态/当前行动者；UI按先攻排序并高亮当前单位。
6. **人物6维机制采用 DND5E 六维语义**：脚本内存在 `str/dex/con/int/wis/cha -> STR/DEX/CON/INT/WIS/CHA` 映射并绑定技能/豁免展示。

**Key Findings (DXC 侧)**:
1. **DXC 已实现 TavernDB 风格命令总线**：`processTavernCommands` 路由 `set_encounter_rows / upsert_battle_map_rows / set_map_visuals / set_initiative / consume_dice_rows / append_combat_resolution / upsert_exploration_map`。
2. **战斗地图链路已完整可用**：
   - 数据：`types/combat.ts` 定义 `BattleMapRow + MapVisuals + initiative`。
   - 校验：`utils/contracts.ts` + `extendedCommands.ts` 做 Zod 验证、UNIT_ID 合并、越界检查。
   - 展示：`BattleStage + TacticalGrid + CombatPanel` 支持地图/卡片双模、先攻轨道、判定面板。
3. **日常地图链路已具备结构图能力**：
   - `upsert_exploration_map` 会解析/归一化 `MapStructureJSON` 并挂接到 `smallLocations/midLocations`。
   - `MapModal` 支持 macro/mid/small 三级 + `MapStructureSVG` 渲染。
4. **骰池是“结果池消费模型”，非“前端真随机补池模型”**：
   - DXC 有 `gameState.骰池` 与 `consume_dice_rows`。
   - 当前更偏 AI 产出/消费，不包含酒馆脚本那种自动 refill 的前端 RNG worker。
5. **战斗判定已引入“事件流”**：`append_combat_resolution -> gameState.战斗.判定事件`，`CombatResolutionPanel` 可展示步骤。
6. **属性体系与 DND6 不同**：DXC 主轴为 DanMachi 五维（力量/耐久/灵巧/敏捷/魔力 + 隐藏基础能力），并非 STR/DEX/CON/INT/WIS/CHA 原生结构。

**No-Loss Migration Opportunity Matrix**:
1. **可无损直接移植（High Confidence）**
- A. `COMBAT_Encounter` 行为语义：可直接映射到 `gameState.遭遇` + 先攻字段。
- B. `COMBAT_BattleMap` 行为语义：与 DXC `BattleMapRow` 高度同构，已有 upsert 合并。
- C. `COMBAT_Map_Visuals` 基础字段（尺寸/地形/光照/天气/特殊区域）：DXC 已有同名语义。
- D. 判定事件流水思想：DXC 已有 `append_combat_resolution`，可直接承接更细步骤。
2. **可低风险适配移植（Medium Confidence）**
- A. `DICE_Pool` 的“预生成+消费”策略：可在 DXC 新增 auto-refill 服务，不破坏现有 `consume_dice_rows`。
- B. 探索图生成 prompts（structure/svg）与 `EXPLORATION_Map_Data` 工作流：可复用 prompt 思路，落点改为 `upsert_exploration_map`。
- C. 战斗底图生成（battleStructure/battleSVG）：可迁移成 DXC 的地图生成插件层。
3. **不属于无损迁移（Low Confidence / Requires Model Change）**
- A. DND 六维属性原模直塞：DXC 当前是五维 + DanMachi 公式；若强塞 6 维会影响成长、判定、UI、存档兼容。
- B. chatSheets 原生存储格式直接落地：DXC 当前 SSOT 是 `GameState`，建议做适配层而非替换主存储。

#### Updated Understanding

- 酒馆方案强在“模板 schema 完整 + 前端脚本闭环自动化（地图与骰池）”。
- DXC 强在“命令契约 + 类型校验 + React 组件化呈现 + 现有 TavernDB 扩展通路”。
- 两者并非冲突关系，最优路径是“保留 DXC SSOT，选择性吸收酒馆机制”。

### Round 2 - Synthesis (2026-02-08 16:18+08:00)

#### Consolidated Recommendations

1. 先做 **无损增量层**：补 `auto dice refill` + `battle/exploration map generation orchestrator`，不改核心 state 结构。
2. 再做 **兼容映射层**：支持酒馆模板字段别名导入（例如 MapStructureJSON / VisualJSON -> DXC 对应字段）。
3. 对 6 维需求采用 **旁路方案**：新增 `dndProfile` 扩展字段，而不是覆盖主角色五维。

---

## Conclusions (2026-02-08 16:20+08:00)

### Summary

SillyTavern 的 DND 仪表盘本质是“chatSheets 模板定义 + 脚本自动化（地图生成/骰池补充/战斗面板）”的整包方案。DXC 已具备同类核心骨架（扩展命令、地图结构渲染、战斗网格与先攻、判定事件流），因此在战斗/地图/判定层存在较高可迁移性；最大差异点在于属性模型（DND6 vs DanMachi5）与存储主干（chatSheets vs GameState）。

### Key Conclusions

1. **战斗与地图层可高比例复用**（Confidence: high）
- Evidence: DXC 已存在 `upsert_battle_map_rows / set_map_visuals / set_initiative / upsert_exploration_map` 完整链路。

2. **骰池机制可功能等价迁移**（Confidence: high）
- Evidence: DXC 已有 `gameState.骰池 + consume_dice_rows`，仅缺自动补池策略。

3. **6维角色机制不属于无损迁移**（Confidence: high）
- Evidence: DXC 主 schema 与判定提示词围绕五维（力量/耐久/灵巧/敏捷/魔力），替换将引发系统级联动。

### Recommendations

1. **P0: 实装 DicePool Auto-Refill 服务**（Priority: high）
- Rationale: 与现有 `consume_dice_rows` 完全兼容，收益高、改动小。

2. **P0: 增加 Battle/Exploration Map 生成编排器**（Priority: high）
- Rationale: 直接复制酒馆“结构JSON -> SVG/结构图”的闭环，提升可视化质量。

3. **P1: 建立 chatSheets Import Adapter**（Priority: medium）
- Rationale: 支持参考模板快速导入 DXC，而不破坏内部 SSOT。

4. **P2: 可选 DND6 扩展档案（非主档）**（Priority: low）
- Rationale: 满足 DND 用户需求，同时隔离对主系统的侵入。

### Remaining Questions

- 是否需要 DXC 在“普通模式”下支持严格 DND5E 检定公式（含熟练加值、豁免、技能熟练）？
- 地图生成希望优先“探索图质量”还是“战斗图战术可读性”？
- 6 维扩展是否仅用于展示，还是要进入核心结算？

---

## Current Understanding (Final)

### What We Established

- SillyTavern 方案依赖 chatSheets 多表结构 + 前端脚本自动化。
- DXC 已具备同类核心能力，尤其在战斗地图与命令路由方面。
- 无损迁移重点不在“重写 DXC”，而在“补齐自动化层与兼容层”。

### What Was Clarified/Corrected

- ~~DXC 缺少战斗地图能力~~ → DXC 已有完整战斗地图数据/校验/渲染链路。
- ~~DXC 无法承接酒馆地图结构~~ → DXC 已支持 `upsert_exploration_map + mapStructure`。
- ~~6维可直接替换~~ → 6维会破坏现有五维主模型，不属于无损。

### Key Insights

- DXC 与酒馆脚本的最佳融合方式是“协议兼容 + 生成增强”，不是“存储替换”。
- 只要控制在命令层/适配层，迁移可保持对现有存档与UI的最小扰动。

---

## Session Statistics

- **Total Rounds**: 2
- **Duration**: ~22 minutes
- **Sources Used**: docs/ref JSON + DXC types/hooks/components/prompts
- **Artifacts Generated**: discussion.md, explorations.json, conclusions.json

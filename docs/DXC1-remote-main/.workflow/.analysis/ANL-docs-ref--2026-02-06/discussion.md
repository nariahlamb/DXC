# Analysis Discussion

**Session ID**: ANL-docs-ref--2026-02-06
**Topic**: docs\ref内酒馆助手相关脚本
**Started**: 2026-02-06T23:01:29+08:00
**Dimensions**: implementation, architecture, decision

---

## User Context

**Focus Areas**: 实现落地
**Analysis Depth**: full
**Max Discussion Rounds**: 5

---

## Discussion Timeline

### Round 1 - Initial Understanding (2026-02-06 23:01)

#### Topic Analysis

基于 topic `docs\ref内酒馆助手相关脚本`，本轮聚焦 `implementation mapping`：

- **Primary dimensions**: implementation + architecture + decision
- **Initial scope**:
  1. 识别 `docs/ref` 中酒馆助手相关资产（模板、脚本、战斗推进、迁移文档）
  2. 建立 “参考资产 → DXC 契约/类型/命令路由/UI 展示” 的落地路径
  3. 输出当前缺口、风险与可执行后续建议
- **Key questions to explore**:
  - `docs/ref` 的脚本/模板在 DXC 中由哪些模块承接？
  - TavernDB 风格指令的执行链是否完整（validate → route → mutate → render）？
  - 当前仍有哪些字段或能力是“文档提到但实现未完全闭环”？

#### Exploration Results (2026-02-06 23:08)

**Sources Analyzed**:
- `docs/ref` 参考资产：TavernDB 模板、DND 仪表盘脚本、SillyTavern DB 脚本、战斗推进规则、迁移总结文档
- DXC 落地代码：`types/*`、`utils/contracts.ts`、`hooks/gameLogic/extendedCommands.ts`、`hooks/useGameLogic.ts`
- 展示/提示词层：`components/game/CombatPanel.tsx`、`components/game/CenterPanel.tsx`、`components/combat/BattleStage.tsx`、`prompts/commands.ts`、`prompts/schema.ts`

**Key Findings**:
1. `docs/ref` 已包含完整的 TavernDB 参考面：20 张 `sheet_*` 表 + DND 仪表盘 Userscript + SillyTavern 数据脚本。
2. DXC 已建立契约层：`utils/contracts.ts` 中包含 Encounter/BattleMap/MapVisuals/Dice/ActionOptions/Log/NPC/Inventory/Initiative 的 Zod schema。
3. DXC 已建立执行层：`processTavernCommands` 先路由扩展 action，再 fallback 到 legacy `updateStateByPath`，并对错误写入系统日志。
4. 扩展 action 已覆盖核心战斗与日志链路，并且已落地 `upsert_npc`、`upsert_inventory`、`set_initiative` 等实现。
5. UI 已消费关键结构化数据：CombatPanel/CenterPanel/BattleStage/BattleTimeline 可展示骰池、遭遇、日志、行动选项、先攻。
6. 参考脚本存在“不可直接引入”内容：`战斗推进v1-1.json` 含 filter bypass prompt 段，需仅提取 DND5E 机制，不可直接复用。

**Points for Discussion**:
1. 是否将 `docs/ref` 中“仅方法论参考”与“可直接迁移素材”做白名单分层（如新增 docs 索引）？
2. 是否需要为 `upsert_inventory` 命名与文档统一（`upsert_item` vs `upsert_inventory`）？
3. 是否需要补充 `EXPLORATION_Map_Data` 对应的最小实现或明确“暂不实现”策略？

**Open Questions**:
- `docs/ref/战斗推进v1-1.json` 的可用子集边界是否需要单独文档化（建议：规则可迁移、越权 prompt 禁止）？
- 是否要将 `docs/ref/酒馆助手脚本-DND沉浸式仪表盘 v1.5.0.json` 拆分为“存储策略”与“UI行为”两类参考注释？

---

## Conclusions (2026-02-06 23:15)

### Summary

`docs/ref` 中“酒馆助手相关脚本”在 DXC 的落地主链已基本形成：`schema contract (Zod) → command routing (useGameLogic) → state mutation (extendedCommands + legacy path) → UI rendering (Combat/Center/BattleStage/Timeline)`。目前主要风险不在“缺少基本实现”，而在“参考资产质量分层与命名一致性治理”。

### Key Conclusions

1. **数据契约层已经可支撑 TavernDB 核心结构**（Confidence: high）
   - Evidence: `utils/contracts.ts`, `types/gamestate.ts`, `types/social.ts`, `types/item.ts`
2. **命令执行链路已实现扩展优先与向后兼容**（Confidence: high）
   - Evidence: `hooks/useGameLogic.ts`, `hooks/gameLogic/extendedCommands.ts`
3. **UI 展示已覆盖战斗态关键信息，但仍受 AI 数据供给约束**（Confidence: high）
   - Evidence: `components/game/CombatPanel.tsx`, `components/combat/BattleStage.tsx`, `components/combat/BattleTimeline.tsx`
4. **参考资产中存在安全/合规噪声，必须“抽方法论不抽原始 prompt”**（Confidence: high）
   - Evidence: `docs/ref/战斗推进v1-1.json`, `docs/ref/METHODOLOGY_EXTRACTION.md`

### Recommendations

1. **建立 `docs/ref` 参考分级索引（可迁移/仅参考/禁止直接使用）**（Priority: high）
   - Rationale: 防止 unsafe prompt 或 UI 强耦合逻辑被误导入主链。
2. **统一命令命名与文档措辞（inventory/item）**（Priority: medium）
   - Rationale: 降低 prompt 与 handler 的语义漂移成本。
3. **补一份“参考资产落地矩阵”到 DEV 文档**（Priority: medium）
   - Rationale: 提高后续维护者定位效率，减少重复分析。

### Remaining Questions

- 是否需要在 CI 中加入对 prompt 文本“高风险模式片段”的静态扫描？
- 是否优先实现 `EXPLORATION_Map_Data` 还是继续保持 defer 状态？

---

## Current Understanding (Final)

### What We Established

- `docs/ref` 不是直接运行依赖，而是“方法论与资产来源”。
- DXC 现状已具备 TavernDB 核心战斗/日志/行动选项的契约和执行能力。
- `upsert_npc` 与 `upsert_inventory` 已在 `extendedCommands` 与 `useGameLogic` 路由中落地。
- UI 面板已消费核心扩展字段，战斗信息展示链路已连通。

### What Was Clarified/Corrected

- ~~假设仍未实现 `upsert_npc`~~ → `upsert_npc` 已实现并接入命令路由。
- ~~假设 `docs/ref` 资产可直接套用~~ → 当前策略是抽取规则与数据结构，不引入脚本 UI 依赖。

### Key Insights

- 现在的主要工作重心是“治理与文档收口”，不是“从零实现能力”。
- `docs/ref` 中 `战斗推进` 文件含越权 prompt，必须作为负面样本处理。

---

## Session Statistics

- **Total Rounds**: 1
- **Duration**: ~14 minutes
- **Sources Used**: docs/ref assets, types/hooks/utils/components/prompts
- **Artifacts Generated**: discussion.md, explorations.json, conclusions.json


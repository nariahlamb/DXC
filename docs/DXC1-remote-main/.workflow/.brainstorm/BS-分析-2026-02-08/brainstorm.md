# Brainstorm Session

**Session ID**: BS-分析-2026-02-08  
**Topic**: 分析 `docs/ref/酒馆助手脚本-DND沉浸式仪表盘 v1.9.0.json`、`docs/ref/DND仪表盘配套模板.json`、`docs/ref/sillytavern数据库脚本.js` 并适配到当前 DXC 体系  
**Started**: 2026-02-08T16:30:00+08:00  
**Dimensions**: technical, ux, innovation, feasibility, scalability

---

## Initial Context

**Focus Areas**: 功能覆盖、数据模型兼容、交互游戏性增强、增量落地路径  
**Depth**: Deep Dive  
**Constraints**:
- 不破坏现有 `GameState + tavern_commands` 主链
- 保持现有 React/TypeScript 组件体系
- 优先兼容再增强，避免一次性重构高风险

---

## Seed Expansion

### Original Idea
> 分析并完整适配 DND 沉浸式面板能力到当前项目体系

### Exploration Vectors

#### Vector 1: 功能全量盘点
**Question**: 参考脚本+模板到底提供了哪些“可使用功能域”？  
**Angle**: 以 21 张 `sheet_*` + 脚本运行能力做双维度拆解  
**Potential**: 形成“覆盖清单 + 缺口地图”

#### Vector 2: 数据主线统一
**Question**: 如何避免 “sheet 数据源” 与 `GameState` 双写冲突？  
**Angle**: 建立 `GameState(SSOT) -> Sheet Projection` 单向投影  
**Potential**: 稳定一致性，减少状态漂移

#### Vector 3: 交互游戏性升级
**Question**: 如何把脚本式面板提升为更强互动体验？  
**Angle**: 回合导演层 + 事件驱动 HUD + 交互动作编排  
**Potential**: 提升沉浸感与可玩性

#### Vector 4: 适配策略
**Question**: 全量重写 vs 兼容适配，哪条路收益更高？  
**Angle**: 兼容层先行，分阶段迁移  
**Potential**: 最快上线核心价值并可回滚

#### Vector 5: 风险治理
**Question**: 最大失败点是什么？  
**Angle**: 数据一致性、性能、提示词链复杂度、UI 过载  
**Potential**: 在架构层前置防线

#### Vector 6: 与现有命令体系融合
**Question**: 参考脚本的 row-level 操作如何接入 `tavern_commands`？  
**Angle**: Row DSL -> Command Translator -> Existing Handlers  
**Potential**: 复用既有验证链路，缩短开发周期

#### Vector 7: 模板与预设工作流
**Question**: 如何复制“模板预设 + profile 隔离 + 对话种子注入”能力？  
**Angle**: Settings Center 新增 Template Studio 子系统  
**Potential**: 获得脚本级生产力与可维护性

---

## Thought Evolution Timeline

### Round 1 - Seed Understanding (2026-02-08T16:45:00+08:00)

#### Initial Parsing
- **Core concept**: 把 SillyTavern DND 数据库面板能力迁移为 DXC 原生模块
- **Problem space**: 参考实现是 Userscript + 表格驱动；当前项目是 React + typed state + command handlers
- **Opportunity**: 当前项目已具备战斗扩展命令与 UI 基础，可用“兼容层”低风险吃下大部分能力

#### Key Questions to Explore
1. 21 张模板表在当前项目中的覆盖率是多少？
2. 脚本中的 profile/preset/isolation 如何映射到 DXC 设置体系？
3. 如何在不破坏现有流程下增强“游戏性与互动感”？
4. 哪些功能可以第一阶段直接落地，哪些应延期？

---

### Round 2 - Multi-Perspective Exploration (2026-02-08T17:05:00+08:00)

#### Creative Perspective

**Top Creative Ideas**:
1. **Director Mode（回合导演模式）** ⭐ Novelty: 5/5 | Impact: 5/5  
   将“可选行动 + 骰池 + 场景状态”组合成 cinematic 事件卡，给玩家“拍电影式”决策体验。

2. **Living Dashboard（活态仪表盘）** ⭐ Novelty: 4/5 | Impact: 5/5  
   面板不只展示数据，还主动提示风险、机会、连锁反应（如仇恨升高、地形崩塌）。

3. **Intent Wheel（意图轮盘）** ⭐ Novelty: 4/5 | Impact: 4/5  
   将行动选项从按钮升级为“攻击/控制/社交/撤退”意图轮盘，强化交互反馈。

4. **Narrative Dice FX（叙事骰效）** ⭐ Novelty: 4/5 | Impact: 4/5  
   掷骰结果触发即时视觉反馈与文本分支提示，提升手感。

5. **Co-GM Assistant（双主持建议）** ⭐ Novelty: 5/5 | Impact: 3/5  
   AI 在玩家行动前给出“保守/激进/策略”三种建议路线。

**Challenged Assumptions**:
- ~~仪表盘只能是被动显示层~~ → 可以成为“导演层交互系统”
- ~~战斗交互必须线性~~ → 可支持多策略分支并并行评估风险

---

#### Pragmatic Perspective

**Implementation Approaches**:
1. **Compatibility Adapter First** | Effort: 2/5 | Risk: 2/5  
   在现有 `GameState` 上增加 `sheet projection` 与 `row command translator`。
   - Quick win: 先把 `sheet_SYS/NPC/ITEM/QUEST/COMBAT/UI/DICE` 跑通
   - Dependencies: `types/gamestate.ts`、`hooks/useGameLogic.ts`、`hooks/gameLogic/extendedCommands.ts`

2. **Template Studio Incremental** | Effort: 3/5 | Risk: 3/5  
   先实现模板导入/导出与预设切换，再补 profile 隔离与对话种子注入。
   - Quick win: JSON 模板校验 + 可视化字段映射
   - Dependencies: `components/game/modals/settings`、`utils/storage/*`

3. **Full Script Parity Rewrite** | Effort: 5/5 | Risk: 5/5  
   目标 1:1 还原脚本行为，不推荐第一阶段执行。

**Technical Blockers**:
- 当前缺少“多角色关系表（CHAR/Skill/Feat link）”领域层
- 缺少“profile 隔离 + 模板版本迁移”工作流
- 缺少“自动总结合并/剧情推进”统一编排器

---

#### Systematic Perspective

**Problem Decomposition**:
1. **Schema Layer**: 21 张 `sheet_*` 的 typed model 映射
2. **State Layer**: `GameState` 单一真源 + 投影缓存
3. **Command Layer**: row op 到 `tavern_commands` 的 translator
4. **Orchestration Layer**: 回合事务、自动结算、自动总结
5. **Experience Layer**: 战斗 HUD、行动编排、剧情反馈

**Architectural Options**:
1. **Sheet-Mirror Architecture**
   - Pros: 迁移快，兼容强
   - Cons: 长期技术债，双语义维护成本高
   - Best for: 快速上线

2. **Domain-Native Architecture**
   - Pros: 结构干净，长期可维护
   - Cons: 初期开发量大
   - Best for: 长期演进

3. **Hybrid Dual-Track（推荐）**
   - Pros: 短期兼容 + 中期重构可并行
   - Cons: 需要明确阶段边界
   - Best for: 当前项目节奏

---

#### Perspective Synthesis

**Convergent Themes** (all perspectives agree):
- ✅ 采用“兼容层先行 + 原生架构演进”的双轨策略
- ✅ `GameState` 必须是 SSOT，sheet 仅为协议视图
- ✅ 优先落地战斗、行动、骰池、日志、地图链路

**Conflicting Views** (need resolution):
- 🔄 是否第一阶段实现完整 Template Studio
  - Creative: 先做体验升级
  - Pragmatic: 先做最小可用模板切换
  - Systematic: 分两期，先导入导出后 profile 隔离

**Unique Contributions**:
- 💡 [Creative] Director Mode 可显著提升“互动感”
- 💡 [Pragmatic] 复用现有命令 handlers 能快速闭环
- 💡 [Systematic] 回合事务与一致性校验是成败关键

---

### Round 3 - Deep Dive (2026-02-08T17:25:00+08:00)

#### User Direction
- **Selected ideas**: Hybrid Dual-Track, Director Mode, Template Studio Incremental
- **Action**: deep-dive
- **Reasoning**: 既要尽快可用，也要避免后续架构返工

#### Deep Dive: Hybrid Dual-Track Adaptation

**Elaborated Concept**:
建立三个核心引擎：
1. `Sheet Compatibility Adapter`：解析模板并投影到 `GameState` 片段；
2. `Turn Orchestrator`：统一处理“行动->判定->资源->日志->时间推进”；
3. `Panel Experience Engine`：把战斗/探索/社交动作做成可组合互动模块。

**Implementation Requirements**:
- 引入 `sheet schema registry`（21 张表的 typed descriptors）
- 引入 `row operation translator`（insert/update/delete -> tavern_commands）
- 引入 `turn transaction`（一次回合内原子更新）
- 新增模板管理 UI（导入、校验、预设切换、版本迁移）
- 新增 profile 隔离键（角色/存档维度）

**Challenges & Mitigations**:
- ⚠️ 双写冲突 → ✅ 仅允许 `GameState` 写入，sheet 由投影生成
- ⚠️ 命令风暴导致状态漂移 → ✅ 使用事务队列 + invariant 检查
- ⚠️ UI 复杂度提升 → ✅ 采用 progressive disclosure（默认精简，按需展开）

**MVP Definition**:
- 支持 10 张核心表：`SYS/NPC/ITEM/QUEST/COMBAT_Encounter/COMBAT_BattleMap/UI_ActionOptions/DICE/LOG_Summary/LOG_Outline`
- 支持模板导入与预设切换（无 profile）
- 支持 Director Mode v1（动作建议 + 风险标签 + 回合结算摘要）

**Recommendation**: pursue

---

### Round 4 - Challenge (2026-02-08T17:40:00+08:00)

#### Devil's Advocate Results

- 🔴 **Hybrid Dual-Track**: 可能形成长期“双系统并存”
  - Counter: 设定 sunset 里程碑，逐步将 sheet adapter 降级为 I/O 层
  - Survivability: 4/5

- 🔴 **Director Mode**: 可能压过玩家自由叙事
  - Counter: 提供“建议强度”开关（观察/建议/强引导）
  - Survivability: 5/5

- 🔴 **Template Studio**: 配置项爆炸，学习成本高
  - Counter: 提供“简版模板向导 + 高级模式”分层入口
  - Survivability: 4/5

**Ideas That Survived**:
- ✅ Hybrid Dual-Track
- ✅ Director Mode
- ✅ Incremental Template Studio

---

### Round 5 - Merge (2026-02-08T17:55:00+08:00)

#### Merged Idea: DXC DND Panel Integration Blueprint

**Source Ideas Combined**:
- Hybrid Dual-Track
- Director Mode
- Template Studio Incremental

**Unified Concept**:
以“兼容层兜底 + 原生体验增强”为主线：
短期保证参考模板能力可映射，
中期通过导演层提升游戏性，
长期将脚本式逻辑替换为领域服务。

**Key Elements Preserved**:
- ✅ 模板驱动的可配置能力
- ✅ 战斗/地图/骰池/行动选项联动
- ✅ 日志摘要与剧情大纲自动化
- ✅ 预设管理与隔离能力（分阶段）

**Tradeoffs Accepted**:
- ⚖️ 第一阶段不追求 1:1 还原所有脚本 UI 行为
- ⚖️ 先做兼容适配，后做彻底领域化

---

## Reference Capability Matrix (Template/Script vs Current DXC)

| 能力域 | 参考模板/脚本 | 当前项目状态 | 结论 |
|---|---|---|---|
| 全局状态（时间/天气/战斗模式） | `sheet_SYS_GlobalState` | 已有字段与扩展位 | 🟡 需补回合事务一致性 |
| NPC注册表 | `sheet_NPC_Registry` + `upsert_npc` | 社交/NPC 已有 + upsert | 🟡 缺 AC/HP/技能物品标准化视图 |
| 背包 | `sheet_ITEM_Inventory` | 背包/装备/物品模态齐全 | ✅ |
| 任务 | `sheet_QUEST_Active` | `Task` + `TasksModal` | 🟡 缺任务类型/发布者/进度标准列 |
| 势力声望 | `sheet_FACTION_Standing` | 世界地图有 factions；无专用声望面板 | 🟡 |
| 战斗遭遇 | `sheet_COMBAT_Encounter` | 遭遇扩展 + 面板展示 | ✅ |
| 战斗地图 | `sheet_COMBAT_BattleMap` | `BattleMapRow` + `TacticalGrid` | ✅ |
| 日志总结/大纲 | `sheet_LOG_*` | append handlers + 面板展示 | ✅ |
| 行动选项 | `sheet_UI_ActionOptions` | `set_action_options` + 快捷按钮 | ✅ |
| 骰子池 | `sheet_DICE_Pool` | refill/roll/consume + UI | ✅ |
| 探索地图数据 | `sheet_EXPLORATION_Map_Data` | `upsert_exploration_map` 已接入 | 🟡 缺模板化管理 |
| 战斗视觉绘制 | `sheet_COMBAT_Map_Visuals` | `set_map_visuals` + grid 视觉 | 🟡 缺可视化编辑器 |
| 角色注册表 | `sheet_CHARACTER_Registry` | 主角+联系人分散存储 | 🟡 |
| 角色属性/资源 | `sheet_CHARACTER_*` | 有 `DND档案` 与资源字段 | 🟡 缺多角色规范表 |
| 技能/专长库及关联 | `sheet_SKILL/FEAT/*` | 技能有，专长库弱 | ❌ 需新增领域模块 |
| 模板预设切换 | Script preset/profile | 当前无 Template Studio | ❌ |
| profile 隔离 | Script isolation code | 当前无角色级隔离键 | ❌ |
| 自动总结合并 | Script auto-merge summary | 当前仅局部日志追加 | 🟡 |
| 多窗体可视化编辑器 | Script visualizer/window manager | 当前是固定模态/面板 | 🟡/❌ |

---

## Synthesis & Conclusions (2026-02-08T18:05:00+08:00)

### Executive Summary

DXC 已经具备 DND 面板“战斗主链”的大部分基础能力（命令协议、骰池、行动、地图、日志）。
要实现“完整适配 + 更强互动”，关键不是复制 Userscript UI，而是将参考能力分解为：
**兼容适配层（短期）+ 导演交互层（中期）+ 领域原生化（长期）**。

### Top Ideas (Final Ranking)

#### 1. Hybrid Dual-Track Adapter ⭐ Score: 9.4/10
**Description**: 以 `GameState` 为真源，新增 sheet 兼容投影与 row 操作翻译。
- ✅ 快速落地、风险可控、复用现有 handlers
- ⚠️ 需管理好兼容层生命周期

**Recommended Next Steps**:
1. 建立 21 表 schema registry
2. 上线 10 张核心表适配
3. 接入回合事务与 invariant 校验

---

#### 2. Director Mode Experience Engine ⭐ Score: 8.8/10
**Description**: 把行动选项升级为“风险可视 + 连锁反馈”的互动系统。
- ✅ 显著增强游戏性与沉浸感
- ⚠️ 需控制信息密度与引导强度

**Recommended Next Steps**:
1. 先做行动风险标签
2. 加入事件卡与结果预告
3. 迭代 cinematic 动效

---

#### 3. Template Studio Incremental ⭐ Score: 8.2/10
**Description**: 分期建设模板导入、预设、隔离 profile、可视化编辑。
- ✅ 复制参考脚本生产力
- ⚠️ 工作量较大，需要分期

**Recommended Next Steps**:
1. 先导入/导出+校验
2. 再做预设切换
3. 最后做 profile 隔离+可视化编辑器

---

### Primary Recommendation

> 先实施 **Hybrid Dual-Track Adapter**，并在第二阶段叠加 **Director Mode**，第三阶段补齐 **Template Studio 全量能力**。

**Quick Start Path**:
1. `Phase A`：核心 10 表映射 + command translator
2. `Phase B`：Director Mode（行动编排、风险提示、回合结算）
3. `Phase C`：Template Studio（预设/隔离/可视化编辑）

### Alternative Approaches

1. **全量重写优先**
   - When to consider: 团队可接受 2~3 倍周期
   - Tradeoff: 前期无产出，风险高

2. **仅UI改造**
   - When to consider: 只追求观感升级
   - Tradeoff: 无法补齐数据与流程能力

---

## Key Insights

- 💡 真正的迁移对象是“数据语义 + 回合流程”，不是脚本 DOM。
- 💡 当前项目在命令层基础很好，最缺的是模板工作流与角色关系表。
- 💡 游戏性提升应由“导演层”驱动，而非继续堆按钮。

### Assumptions Challenged
- ~~必须 1:1 还原脚本界面~~ → 只要能力语义一致即可超越体验
- ~~先做所有表再谈交互~~ → 核心表先行即可支撑高价值交互迭代

---

## Current Understanding (Final)

### Problem Reframed
当前任务不是“搬脚本”，而是“将表格驱动 RPG 内核嵌入 DXC 领域架构”。

### Solution Space Mapped
- 方案A：仅兼容（快，但体验提升有限）
- 方案B：仅重构（纯，但慢）
- 方案C：双轨混合（推荐）

### Decision Framework
- 时间优先：选 C（先兼容）
- 稳定优先：选 C（事务与校验）
- 创新优先：在 C 基础上加 Director Mode

---

## Session Statistics

- **Total Rounds**: 5
- **Ideas Generated**: 12
- **Ideas Survived**: 3
- **Perspectives Used**: Creative, Pragmatic, Systematic
- **Artifacts**: `brainstorm.md`, `perspectives.json`, `synthesis.json`, `ideas/*.md`


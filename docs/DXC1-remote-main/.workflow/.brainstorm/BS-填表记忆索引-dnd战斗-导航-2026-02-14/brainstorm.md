# Brainstorm Session

**Session ID**: BS-填表记忆索引-dnd战斗-导航-2026-02-14
**Topic**: 我当前的填表和记忆系统是以 docs/ref 中多份 SillyTavern 脚本与模板为基础构建的；后期记忆索引召回、DND 系统、战斗系统优化升级都要以此为参考依据。请基于这些文件与当前 DXC 实现做比对，并输出说明书式导航参考资料。
**Started**: 2026-02-14T22:25:13+08:00
**Dimensions**: technical, architecture, scalability, ux

---

## Initial Context

**Focus Areas**: 记忆写入与召回、索引召回（AM）、DND 表契约、战斗推进
**Depth**: deep
**Constraints**:
- 运行时基线：triad-only（story/state/map），table-first（表为 SSOT）。
- AI 输出契约：必须维持 logs / tavern_commands 分离。

---

## Seed Expansion

### Original Idea

> docs/ref 的脚本很长，但已做了对应说明和索引。希望对照当前 DXC 的记忆系统、索引召回系统、DND 系统、战斗系统，输出一份可用的说明书式导航资料。

### Exploration Vectors

#### Vector 1: 对照范围界定
**Question**: 参考体系哪些是“语义/契约”，哪些是“实现/脚本”？
**Angle**: architecture
**Potential**: 避免把 ref 当运行时依赖导致错误演进。

#### Vector 2: 主链路导航
**Question**: 按“写入->事务->召回->提示”把记忆系统讲清楚，锚点在哪？
**Angle**: technical
**Potential**: 直接支持后续召回优化与排障。

#### Vector 3: 表契约映射
**Question**: DND 模板 20 表与 DXC TavernDB 表定义是否同构？差异点在哪？
**Angle**: contract
**Potential**: 让后续扩展不破坏字段语义。

#### Vector 4: 战斗推进闭环
**Question**: 战斗推进预设输出（用户输入 + recall）在 DXC 哪些模块承接？
**Angle**: system
**Potential**: 战斗升级能以可验证路径推进。

---

## Thought Evolution Timeline

### Round 1 - Seed Understanding (2026-02-14 22:25+08:00)

- 参考体系由 5 类组件组成：数据库主脚本、仪表盘脚本、模板（表契约）、索引召回预设、战斗推进预设。
- DXC 当前实现基线明确：triad-only + table-first，不再维护短中长期记忆数组。

关键证据：
- `docs/ref/SillyTavern脚本模板-总索引.md`
- `DEVREADME.md`
- `docs/architecture/table-first-ssot.md`

### Round 2 - Evidence Collection (2026-02-14 22:30+08:00)

抓取到 DXC 的关键落点：

- 记忆召回组装：`utils/aiContext.ts` `constructMemoryContext`
  - 同时支持表格召回（TavernDB Retrieval）与索引召回（Memory Index Retrieval）。
- AM 索引投影与打分：
  - `utils/memory/memoryIndexProjection.ts`（paired/summary/outline 投影）
  - `utils/memory/memoryRetriever.ts`（AM 精确命中高权重 + token 命中）
- 写表与 DND 档案映射：`hooks/gameLogic/commands/allHandlers.ts`
- 服务命令隔离：`hooks/gameLogic/microservice/commandGuard.ts`（memory 只允许 LOG_*）
- 事务一致性：`utils/taverndb/turnTransaction.ts`（LOG 表 source 必须为 ms:memory 才允许）
- 配对与回滚守卫：`tests/memory/pairRollback.test.ts`

### Round 3 - Multi-Perspective Exploration (2026-02-14 22:38+08:00)

- Creative: 提出“说明书导航卡片”“AM 链路可视化”等，核心是把 AM 变成导航主键。
- Pragmatic: 建议先做 Docs + Manifest，再迭代 UI 内嵌导航与漂移测试。
- Systematic: 推荐“Manifest 驱动（Docs + Generator + Tests）”作为长期架构。

对应产物：
- `perspectives.json`

### Round 4 - Convergence (2026-02-14 22:45+08:00)

收敛结论：

1. 本次最优产出形态是“说明书式导航 + 可维护的映射清单”。
2. 说明书必须围绕三类锚点组织：`sheetId`、`tavern_commands action`、`AM 编码`。
3. 先把手册落地，再以 manifest 与 drift test 防止漂移。

最终产物：
- `manual-navigation.md`
- `synthesis.json`

---

## Synthesis & Conclusions

### Executive Summary

DXC 当前已经实现与 SillyTavern 参考体系高度同构的表契约与命令闭环（LOG、战斗、地图、骰池、DND 档案映射）。问题不在“缺实现”，而在“缺可持续导航”。因此最优策略是先建立说明书式导航层（把参考依据与实现锚点锁定），再在该导航层之上推进记忆召回与战斗系统优化。

### Primary Recommendation

采用 Manifest 驱动的说明书导航（方案 B）：先完成文档闭环，再考虑 UI 内嵌导航与可视化。

---

## Artifacts

- `manual-navigation.md`：说明书式导航参考资料（可直接用）
- `perspectives.json`：三视角结果
- `synthesis.json`：最终收敛与路线建议


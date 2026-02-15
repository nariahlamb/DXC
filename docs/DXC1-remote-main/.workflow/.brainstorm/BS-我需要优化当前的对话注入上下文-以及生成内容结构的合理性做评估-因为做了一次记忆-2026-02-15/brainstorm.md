# Brainstorm Session

**Session ID**: BS-我需要优化当前的对话注入上下文-以及生成内容结构的合理性做评估-因为做了一次记忆-2026-02-15
**Topic**: 我需要优化当前的对话注入上下文，以及生成内容结构的合理性做评估。因为做了一次记忆系统重构，现在分清楚主叙事应当只做好叙事+选项，记忆ai负责分批并发填表+检索召回，地图ai只负责地图生成。但我看到现在主叙事ai仍然在做taverncommand的事且不会被记录。帮我查分析式
**Started**: 2026-02-15T03:44:18+08:00
**Dimensions**: technical, feasibility, scalability, innovation

---

## Initial Context

**Focus Areas**: 技术方案，职责边界，可观测性与审计
**Depth**: Balanced Exploration
**Constraints**: 不破坏 triad-only；优先低风险可落地；保留现有事务回滚与命令守卫

---

## Seed Expansion

### Original Idea
> 我需要优化当前的对话注入上下文，以及生成内容结构的合理性做评估。因为做了一次记忆系统重构，现在分清楚主叙事应当只做好叙事+选项，记忆ai负责分批并发填表+检索召回，地图ai只负责地图生成。但我看到现在主叙事ai仍然在做taverncommand的事且不会被记录。帮我查分析式

### Exploration Vectors

#### Vector 1: 根问题重述
**Question**: 当前真正的问题是模型“乱写命令”，还是系统“规则双轨导致看起来在乱写”？
**Angle**: 运行时事实链路
**Potential**: 快速止血并明确改造优先级

#### Vector 2: Prompt 注入冲突
**Question**: 主叙事 prompt 是否仍然在要求生成 tavern_commands？
**Angle**: prompt module 组合与覆盖
**Potential**: 找到行为漂移的一号源头

#### Vector 3: 过滤与记录
**Question**: story 命令在哪些层被过滤，过滤后是否有完整可追踪记录？
**Angle**: filter/sanitize/guard 全链路
**Potential**: 解决“不会被记录”的感知问题

#### Vector 4: 责任边界一致性
**Question**: story/state/memory/map 的职责是否在 Prompt、Routing、Guard 三处完全同构？
**Angle**: 合同一致性
**Potential**: 降低维护成本和回归风险

#### Vector 5: map/world 入口一致性
**Question**: 地图与世界更新是否经过同级命令守卫？
**Angle**: 入口治理
**Potential**: 避免旁路写入破坏边界

#### Vector 6: 可观测性
**Question**: 被丢弃命令能否落到审计表并给出 reason_code？
**Angle**: 运维与调试
**Potential**: 把“黑盒怀疑”转成“白盒证据”

#### Vector 7: 中长期架构
**Question**: 是否需要 policy-as-code 来统一 prompt/runtime 规则源？
**Angle**: 架构演进
**Potential**: 从根本消除双轨冲突

---

## Thought Evolution Timeline

### Round 1 - Seed Understanding (2026-02-15T03:44:18+08:00)

#### Initial Parsing
- **Core concept**: 主叙事与微服务职责已经拆分，但输出协议与运行时过滤仍未完全对齐。
- **Problem space**: Prompt 层、路由层、命令守卫层存在重复与冲突规则，导致 story 仍尝试生成命令，随后被静默丢弃或部分过滤。
- **Opportunity**: 通过“运行时权威 + Prompt 去冲突 + 审计可观测”三步，将 triad-only 真正落地。

#### Key Questions to Explore
1. 现在 story 命令是“还在执行”还是“已被过滤但不可见”？
2. 为什么 state 开启后，prompt 仍会诱导生成命令？
3. map/world 是否存在绕过 guard 的入口差异？
4. memory 专责是否被严格保护为 LOG_Summary/LOG_Outline？
5. 如何在不大改架构前提下快速稳定？

### Round 2 - Multi-Perspective Exploration (2026-02-15T03:44:18+08:00)

#### Creative Perspective

**Top Creative Ideas**:
1. **双通道硬协议（Narrative 与 Commands 物理隔离）** ⭐ Novelty: 4/5 | Impact: 5/5
   非空 story 命令直接判失败并重试纯叙事，避免“生成后再丢”。
2. **过滤即审计（Discard-to-Ledger）** ⭐ Novelty: 3/5 | Impact: 5/5
   把每条被拦截命令写入审计事件，含命中规则与来源。
3. **Prompt 防火墙（profile lint）** ⭐ Novelty: 3/5 | Impact: 5/5
   narrative-profile 里出现命令导向词就阻断 CI。
4. **上下文注入编排器（配额+溯源）** ⭐ Novelty: 4/5 | Impact: 5/5
   memory/map/state 注入按预算分配并打 sourceTag。
5. **两阶段生成（意图草案 -> 纯叙事改写）** ⭐ Novelty: 5/5 | Impact: 4/5
   分离内部推理与外部文本，减少命令泄漏。
6. **泄漏率监控与自动降级** ⭐ Novelty: 3/5 | Impact: 4/5
   以 command_leak_rate 驱动 prompt 自动切换。

#### Pragmatic Perspective

**Implementation Approaches**:
1. **P0：运行时强制 story 空命令 + 审计** | Effort: M | Risk: 中
   - Quick win: narrative-only 下 `filterStoryCommands` 收敛为 `[]`
   - Dependencies: `aiRouting.ts`, `useGameLogicCore.ts`, `SYS_CommandAudit` 投影
2. **P0：Map 专责闭环** | Effort: S-M | Risk: 低-中
   - Quick win: map 分支统一过 `commandGuard(map)`
   - Dependencies: `handleWorldInfoUpdate`, `commandGuard.ts`
3. **P1：Prompt 协议去冲突** | Effort: M | Risk: 中
   - Quick win: story prompt 去掉命令生成导向
   - Dependencies: `aiPrompt.ts`, `prompts/system.ts`, `prompts/logic.ts`
4. **P1：Memory 越权审计强化** | Effort: M | Risk: 低-中
   - Quick win: memory 拒绝命令逐条 reason_code
   - Dependencies: `inputBuilder.ts`, `commandGuard.ts`, `useGameLogicCore.ts`

**Technical Blockers**:
- 现有 `tests/aiRouting.test.ts` 基线与“story 必空命令”目标冲突。
- 预过滤阶段仅 debug toast，缺少结构化审计。
- map/world 入口路径未完全共用同一 guard 策略。
- prompt 历史文本仍残留“主叙事写命令”语义。

#### Systematic Perspective

**Problem Decomposition**:
- D1：Prompt 规则自冲突（既要求 story 空命令，也给出大量命令生成指令）。
- D2：Runtime 多层过滤（routing -> strip -> guard）重复，行为不透明。
- D3：serviceKey 与实际 endpoint 路由存在名实差异（多数最终走 state endpoint）。
- D4：world/map 某些路径未走同级 guard，策略可能漂移。

**Architectural Options**:
1. **Runtime 权威化（短期）**
   - Pros: 快速稳定，风险低
   - Cons: prompt 自校验价值下降
   - Best for: 先止血
2. **Policy-as-Code 单一策略源（中期）**
   - Pros: 统一 prompt/runtime 规则，彻底消除双轨
   - Cons: 需要编译层和回归成本
   - Best for: triad-only 长期演进
3. **命令总线化（长期）**
   - Pros: 强治理和可回放
   - Cons: 改造量最大
   - Best for: 后续扩展复杂后台能力

#### Perspective Synthesis

**Convergent Themes**:
- ✅ 先做运行时权威化，再做 prompt 清理。
- ✅ 过滤必须可审计，不能仅 debug toast。
- ✅ map/memory 边界需要入口级统一守卫。
- ✅ 中期应建立单一策略源，避免规则漂移。

**Conflicting Views**:
- 🔄 要不要立即做大重构
  - Creative: 倾向快速引入 DSL/总线等新范式
  - Pragmatic: 先做低风险 P0，保证线上稳定
  - Systematic: 采用“过渡方案 + 目标架构”双阶段

**Unique Contributions**:
- 💡 [Creative] 提出 command_leak_rate 指标闭环
- 💡 [Pragmatic] 给出按文件与测试的落地改造序列
- 💡 [Systematic] 明确 D1-D4 四层冲突与模式迁移路径

### Round 3 - Convergence (2026-02-15T03:44:18+08:00)

#### User Direction
- **Selected ideas**: Runtime 权威化，Prompt 去冲突，Discard 审计
- **Action**: 合并综合
- **Reasoning**: 满足“尽快稳态 + 可追踪 + 不破坏现有重构”的目标

#### Merged Idea: Triad Boundary Hardening

**Source Ideas Combined**:
- Runtime 强制 story 空命令
- Prompt narrative-profile 清理
- 全链路命令拦截审计
- map/memory 专责守卫一致化

**Unified Concept**:
将“主叙事只产出 logs/action_options”从软约束升级为硬约束；所有被过滤命令必须可追溯；map/memory/state 在所有入口执行统一守卫；中期以 policy-as-code 同步 prompt/runtime 规则。

**Key Elements Preserved**:
- ✅ 保留现有事务回滚与 AM 配对校验
- ✅ 不改动 triad-only 运行时总框架
- ✅ 兼容现有 microservice queue 与 input builder

**Tradeoffs Accepted**:
- ⚖️ 短期增加审计日志噪音，换取排障透明度
- ⚖️ 先以 runtime 为准，prompt 改造分批进行

---

## Synthesis & Conclusions (2026-02-15T03:44:18+08:00)

### Executive Summary
你遇到的是“边界已拆分，但协议仍双轨”的典型问题。当前代码中，story 命令大多会被过滤或清空；真正不合理的是 Prompt 仍诱导 story 生成 tavern_commands，导致输出与执行认知不一致。应先统一运行时硬边界和审计，再清理 prompt，最后收敛到单一策略源。

### Top Ideas (Final Ranking)

#### 1. Runtime 权威化 + 丢弃审计 ⭐ Score: 9.4/10
**Description**: state 启用时 story 命令执行数必须为 0；所有被丢弃命令写审计并附 reason_code。
**Recommended Next Steps**:
1. 修改 `filterStoryCommands` narrative-only 返回空集。
2. 在 `useGameLogicCore` 记录 raw->filtered 差集。
3. 给 `MEM_BOUNDARY_001` 扩展结构化字段。

#### 2. Prompt 去冲突（story profile） ⭐ Score: 8.9/10
**Description**: story prompt 仅保留叙事与选项，不再携带命令生成导向。
**Recommended Next Steps**:
1. 新增 story narrative-only 协议模板。
2. 从 `prompts/system.ts` / `prompts/logic.ts` 拆出命令导向到服务 prompt。
3. 加 prompt 组装测试与快照更新。

#### 3. Map 入口统一守卫 ⭐ Score: 8.6/10
**Description**: map 请求路径统一走 map 命令白名单守卫。
**Recommended Next Steps**:
1. `handleWorldInfoUpdate` map 分支接入 `commandGuard(map)`。
2. 记录 `MAP_SCOPE_VIOLATION`。
3. 回归地图 fallback 测试。

#### 4. Memory 越权拒绝可追踪 ⭐ Score: 8.4/10
**Description**: memory 只允许 LOG_Summary/LOG_Outline，拒绝命令逐条审计。

#### 5. Policy-as-Code（中期） ⭐ Score: 8.2/10
**Description**: 单一策略源同时生成 prompt 与 runtime 规则，消除漂移。

### Primary Recommendation
> 先执行 P0（运行时权威化 + map 守卫 + 审计），再执行 P1（prompt 去冲突 + memory 审计强化），最后推进 policy-as-code。

### Quick Start Path
1. `utils/aiRouting.ts`：narrative-only 下 `filterStoryCommands` 改为空集。
2. `hooks/gameLogic/useGameLogicCore.ts`：记录 story 命令差集审计（含 reason_code）。
3. `hooks/gameLogic/useGameLogicCore.ts` map 分支复用 `commandGuard(map)`。

---

## Key Insights

- Prompt 与 runtime 同时描述职责，但当前并非同一规则源。
- “主叙事还在做 tavern_commands”多数是生成层现象，执行层已过滤。
- 真正缺口是“过滤后看不见”造成的诊断不透明。

---

## Current Understanding (Final)

### Problem Reframed
核心问题不是“主叙事写命令被执行”，而是“主叙事仍被 prompt 诱导写命令，随后在 runtime 被过滤且审计不足”。

### Solution Space Mapped
- 短期：Runtime 权威化 + 审计可见
- 中期：Prompt 去冲突
- 长期：Policy-as-Code 统一规则源

### Decision Framework
- 追求最快稳定：先做 runtime + 审计。
- 追求生成质量：补做 prompt 去冲突。
- 追求长期可维护：上 policy-as-code。

---

## Session Statistics

- **Total Rounds**: 3
- **Ideas Generated**: 13
- **Ideas Survived**: 5
- **Perspectives Used**: Creative, Pragmatic, Systematic
- **Artifacts**: brainstorm.md, perspectives.json, synthesis.json, 3 idea deep-dives

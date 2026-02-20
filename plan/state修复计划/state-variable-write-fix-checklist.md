# State 变量写入修复 Checklist

> 创建日期：2026-02-18
> 基于：commandGuard.ts / sheetRegistry.ts / aiServices.ts / stateServiceInput.ts / stateVariableWriter.ts 全链路分析
> 状态：进行中（已完成部分关键修复，待下轮完整落地）

---

## 诊断结论

**现象**：只有 NPC 的 `当前状态` 字段能正常写入，其余业务变量（世界/论坛/手机/任务/背包/剧情/经济等）大面积缺失。

**根因**：三层叠加阻断

1. **Legacy path 一刀切拦截**：commandGuard 白名单只放行 `处理中/当前界面/日常仪表盘`，旧格式业务写入全部被拦截
2. **"职责覆盖"导致写入真空**：启用 state 服务后 story 被禁止写表，但 state 服务 prompt 缺乏具体写入示例, AI 两边都不写
3. **Cadence 门控过度阻断**：世界/论坛轮次条件不满足时，即使表命令也被拦截

**唯一能正常写入的原因**：NPC `当前状态` 走 `upsert_sheet_rows(NPC_Registry)` 表命令链路，不经 legacy path 拦截，且 NPC_Registry 在 allowlist 中，social 服务有明确 prompt 指引。

---

## 当前代码基线（截至 2026-02-18）

### 已完成（可作为下轮起点）

- [x] 修复 `table_op` 动作别名识别：`action=table_op` 可回落到 `command`（避免 `missing action/key`）
- [x] 修复 NPC `status` 双语义冲突：
  - `status=dead/offline` 可映射到 `当前状态`
  - `status=初识/熟识` 不再污染 `当前状态`，改写到 `关系状态/与主角关系`
- [x] `strictAllowlist` 增加默认 allowlist 兜底，避免核心 sheet 被误判 `sheet_not_allowed`
- [x] Guard 拦截结果已具备系统日志可见性（`[MS_GUARD_001]`）

### 未完成（高优先，需下轮落地）

- [x] **A 组：state 服务 prompt 写表示例补全**（`SYS_GlobalState / QUEST_Active / ITEM_Inventory / CHARACTER_*`）
- [x] **C 组：story/state 职责冲突消解**（`aiPrompt.ts` 与 `prompts/story.ts` 指令统一）
- [x] **G 组：stateVariableWriter domain 覆盖扩展**（当前仅 `global_state / character_resources / inventory`）
- [x] **B1：interval=0 语义收敛**（采用“禁自动，不拦显式写入”）

---

## 下轮执行顺序（建议固定）

1. 先做 **A 组**：补齐 stateFillRule 的“可直接抄用”命令示例与 keyField
2. 再做 **C 组**：确定剧情表归属（story 保留 or state 接管），并消除 prompt 矛盾
3. 再做 **G 组**：扩展 writer domain handler，至少补 `quest/story/phone/world/forum`
4. 最后做 **B1**：调整 cadence 对 `interval=0` 的行为并补测试
5. 全量回归：state/taverndb/aiDispatch/hooks 相关测试集 + 一次手动剧情验证

---

## 涉及文件索引

| 缩写    | 文件路径                                              | 职责                                   |
| ------- | ----------------------------------------------------- | -------------------------------------- |
| **CG**  | `hooks/gameLogic/microservice/commandGuard.ts`        | 命令守卫：拦截/放行逻辑                |
| **SR**  | `utils/taverndb/sheetRegistry.ts`                     | 表定义 + domain 映射 + allowlist 构建  |
| **AS**  | `utils/aiServices.ts`                                 | 微服务 prompt 构建 + AI 调用           |
| **SSI** | `utils/state/stateServiceInput.ts`                    | state 服务输入 payload 构建 + sanitize |
| **SVW** | `hooks/gameLogic/microservice/stateVariableWriter.ts` | state variable event → 表命令转换      |
| **AP**  | `utils/aiPrompt.ts`                                   | 主叙事 prompt 构建（含职责覆盖注入）   |
| **SM**  | `prompts/system_multi.ts`                             | 多阶段 thinking 模板                   |
| **ST**  | `prompts/story.ts`                                    | 剧情导演系统 prompt                    |
| **LG**  | `prompts/logic.ts`                                    | COT 预思考协议                         |
| **UAS** | `hooks/useAppSettings.ts`                             | 默认 governance 配置                   |

---

## FIX-A：State 服务 Prompt 指引补全（最高优先）

> 目标：让 state 服务 AI 知道要写哪些表、怎么写、keyField 是什么

### A1. SYS_GlobalState 写入示例缺失

- **文件**：AS (`utils/aiServices.ts`)
- **位置**：`stateFillRule` 数组（约 line 233-260）
- **现状**：规则 8 只说"SYS_GlobalState 硬约束：必须实时写入"，但没给出示例
- **问题**：AI 不知道 `keyField: '_global_id'`、`rows: [{ _global_id: 'GLOBAL_STATE', ... }]` 的格式

**Checklist**：

- [x] 在 stateFillRule 中追加 SYS_GlobalState 的完整 upsert 示例：
  ```
  示例：时间/地点/天气变化时：
  {"action":"upsert_sheet_rows","value":{"sheetId":"SYS_GlobalState","keyField":"_global_id","rows":[{"_global_id":"GLOBAL_STATE","当前场景":"xxx","游戏时间":"HH:MM","当前日期":"YYYY-MM-DD","天气状况":"xxx","当前回合":N}]}}
  ```
- [x] 明确列出 SYS_GlobalState 的可写字段清单（当前场景/场景描述/当前日期/游戏时间/上轮时间/流逝时长/世界坐标X/世界坐标Y/天气状况/战斗模式/当前回合/系统通知）

### A2. QUEST_Active 写入示例缺失

- **文件**：AS
- **现状**：stateFillRule 规则 3 说"任务完成禁止返回空命令"，但没给示例
- **问题**：AI 不知道 QUEST_Active 的 keyField 是 `任务ID`

**Checklist**：

- [x] 追加 QUEST_Active 写入示例：
  ```
  任务变化时：
  {"action":"upsert_sheet_rows","value":{"sheetId":"QUEST_Active","keyField":"任务ID","rows":[{"任务ID":"Q001","任务名称":"xxx","状态":"进行中","当前进度":"xxx"}]}}
  ```

### A3. ITEM_Inventory 写入示例缺失

- **文件**：AS
- **现状**：stateFillRule 规则 3 说"获得物品禁止返回空命令"，但没给示例

**Checklist**：

- [x] 追加 ITEM_Inventory 写入示例：
  ```
  物品获得/消耗时：
  {"action":"upsert_sheet_rows","value":{"sheetId":"ITEM_Inventory","keyField":"物品ID","rows":[{"物品ID":"ITM_xxx","物品名称":"xxx","类别":"消耗品","数量":1}]}}
  ```
- [x] 追加物品删除示例（使用 delete_sheet_rows）

### A4. STORY_Mainline 写入指引缺失

- **文件**：AS
- **现状**：story.ts 中有 STORY_Mainline 示例，但**启用 state 服务后 story 被禁止写表**（AP line 487-489 的"职责覆盖"），而 state 服务没有剧情写入指引

**Checklist**：

- [x] 确认设计意图：剧情表由谁写？（已选方案 B：state 接管）
  - 方案 A：剧情表保留给 story 服务写（从职责覆盖中豁免）
  - 方案 B：剧情表交给 state 服务写（在 stateFillRule 中追加示例）
- [x] 根据确认的方案实施对应改动

### A5. CHARACTER_Attributes / CHARACTER_Resources 写入指引缺失

- **文件**：AS
- **现状**：state 服务看到的角色数据被 SSI 的 `pickAllowedFields` 压缩，state AI 无法获得完整角色信息

**Checklist**：

- [x] 追加 CHARACTER_Resources 写入示例（法术位/职业资源/生命骰/金币变化）
- [x] 追加 CHARACTER_Attributes 写入示例（HP/等级/经验值变化）
- [x] 评估 SSI 中 `CHARACTER_ALLOWED_KEYS` 是否需要扩展以传递更多角色信息给 AI

### A6. 综合：在 stateFillRule 中追加表命令速查表

**Checklist**：

- [x] 在 stateFillRule 末尾追加一个简洁的"可写表速查"块：
  ```
  可写表速查（keyField | 主要列）:
  - SYS_GlobalState: _global_id | 当前场景,游戏时间,当前日期,天气状况,战斗模式,当前回合
  - NPC_Registry: NPC_ID | 姓名,当前状态,所在位置,与主角关系,关键经历
  - ITEM_Inventory: 物品ID | 物品名称,类别,数量,已装备,描述
  - QUEST_Active: 任务ID | 任务名称,类型,状态,当前进度,目标描述
  - STORY_Mainline: mainline_id | 当前篇章,当前阶段,当前目标,行动提示
  - FACTION_Standing: 势力ID | 势力名称,关系等级,声望值
  - CHARACTER_Resources: CHAR_ID | 法术位,职业资源,生命骰,金币
  - CHARACTER_Attributes: CHAR_ID | HP,等级,经验值
  ```

---

## FIX-B：Cadence 门控修复（高优先）

> 目标：确保世界/论坛在合理条件下可被写入

### B1. `interval=0` 时世界/论坛永不更新

- **文件**：CG (`commandGuard.ts` line 201-206)
- **现状**：当 `interval=0`（手动模式）时，`stateWorldCadenceDue` 和 `stateForumCadenceDue` 始终为 false，导致 WORLD*\* 和 FORUM*\* 表命令全部被 `cadence_not_due` 拒绝

**Checklist**：

- [x] 确认 `interval=0` 的设计语义：（已选方案 C：禁自动，不拦显式写入）
  - 方案 A：`interval=0` = 手动模式 = 只在用户主动触发时更新（当前行为合理，但需提供手动触发入口）
  - 方案 B：`interval=0` = 每回合都更新（改为 cadenceDue=true）
  - 方案 C：`interval=0` = 从不主动更新，但不阻断 state 服务的显式写入
- [x] 根据确认的方案修改 cadence 计算逻辑
- [x] 明确：哪些 WORLD\_\* 表受 cadence 控制（`worldIntervalControlledSheets`）、哪些不受（如 WORLD_NpcTracking 应由 npcBrain 服务写，不受 cadence 拦截）

### B2. Cadence 计算来源确认

- **文件**：需追查 `stateWorldCadenceDue` 的计算位置
- **现状**：`commandGuard.ts` 接收 `stateWorldCadenceDue` 作为上下文参数，但计算在调用侧

**Checklist**：

- [ ] 找到 `stateWorldCadenceDue` 的计算位置并确认其逻辑
- [ ] 确认 `下次更新回合` 字段是否被正确读取和比较
- [ ] 确认首次初始化时 `下次更新回合` 的默认值（如果未设置，cadence 的行为是什么）

---

## FIX-C：职责覆盖问题（高优先）

> 目标：消除 story 被禁写 + state 不知道写 的真空地带

### C1. story 服务的"写入禁令"范围过大

- **文件**：AP (`utils/aiPrompt.ts` line 485-490)
- **现状**：
  ```
  [运行时写入职责覆盖]
  - 主叙事只负责 logs 与 action_options（如启用）。
  - 主叙事必须输出 "tavern_commands": []，禁止输出任何业务写表命令。
  ```
- **问题**：剧情表（STORY*\*）、战斗表（COMBAT*\*）的写入职责不明确。story prompt 中有明确示例但被职责覆盖禁止。

**Checklist**：

- [x] 评估哪些表应该豁免于"职责覆盖"禁令：
  - STORY_Mainline / STORY_Triggers / STORY_Milestones → story 服务可能更适合写
  - COMBAT_Encounter / COMBAT_BattleMap → 战斗逻辑与叙事紧密耦合
  - CONTRACT_Registry → 契约变更通常发生在剧情推进中
- [x] 方案 A：修改职责覆盖文本，列出 story 仍可写的表（已评估，不采用）
- [x] 方案 B：确保 state 服务完全接管这些表的写入（需在 stateFillRule 补全示例）
- [x] 确认最终方案并实施

### C2. story prompt (story.ts) 中的写入示例与实际行为不一致

- **文件**：ST (`prompts/story.ts`)
- **现状**：story prompt 中有详细的 `upsert_sheet_rows(STORY_Mainline)` 示例，但运行时被职责覆盖禁止
- **问题**：prompt 指令互相矛盾，AI 行为不可预测

**Checklist**：

- [ ] 若采用 C1 方案 A（story 保留部分写权）：修改职责覆盖文本，明确 story 可写 STORY\_\* 表
- [x] 若采用 C1 方案 B（state 完全接管）：从 story.ts 中移除表写入示例，避免矛盾指令

---

## FIX-D：stateServiceInput 数据截断（中优先）

> 目标：确保 state 服务 AI 获得足够信息做出正确决策

### D1. 字符串长度截断过严

- **文件**：SSI (`utils/state/stateServiceInput.ts` line 55)
- **现状**：`MAX_STRING_LENGTH = 160`
- **问题**：任务描述、物品描述、剧情目标等字段可能超过 160 字符被截断，AI 信息丢失

**Checklist**：

- [ ] 评估将 `MAX_STRING_LENGTH` 提升到 256 或 320 的 token 成本
- [ ] 或按字段类型区分：描述类字段允许更长，ID/名称类保持短截断

### D2. 数组长度限制

- **文件**：SSI (line 51-54)
- **现状**：
  - `MAX_SOCIAL_ROWS = 24`
  - `MAX_TASK_ROWS = 24`
  - `MAX_INVENTORY_ROWS = 40`
- **问题**：中后期游戏物品/NPC 可能超出限制

**Checklist**：

- [ ] 确认当前数量是否够用（需要实际游戏数据验证）
- [ ] 若不够用，评估提升的 token 成本

### D3. 嵌套深度限制

- **文件**：SSI (sanitize 逻辑)
- **现状**：`maxDepth = 2`
- **问题**：复杂嵌套结构（如剧情 StoryState）在深度 2 被截断

**Checklist**：

- [ ] 确认 `剧情` 字段经 `pickAllowedFields` + depth 截断后是否仍有用
- [ ] 评估将 maxDepth 提升到 3 的影响

---

## FIX-E：Phone 服务 Prompt 缺失（中优先）

> 目标：手机相关表有明确的写入指引

### E1. phone 服务无专属 prompt

- **文件**：AS (`utils/aiServices.ts` line 29-57)
- **现状**：`resolveServicePrompt` 中有 npcBrain/social/world 的专属 prompt，但 **phone 没有**
- **问题**：phone 服务的 role rule 只说"智能终端消息与通知生成"，缺乏具体表操作指引

**Checklist**：

- [ ] 确认 phone 服务是否实际被调用（可能从未启用）
- [ ] 若已启用：创建 phone 专属 prompt，包含 PHONE_Threads/Messages/Pending/Contacts 的写入示例
- [ ] 若未启用：将手机表写入合并到 state 服务 stateFillRule 中

---

## FIX-F：Legacy Path 白名单审查（低优先）

> 目标：确认白名单覆盖是否合理

### F1. UI 瞬态白名单审查

- **文件**：CG (`commandGuard.ts` line 6-10)
- **现状**：
  ```
  UI_TRANSIENT_LEGACY_PATH_PREFIXES = [
    'gameState.处理中',
    'gameState.当前界面',
    'gameState.日常仪表盘'
  ];
  ```
- **问题**：白名单是否遗漏了其他合法的 UI 瞬态字段？

**Checklist**：

- [ ] 审查 GameState 类型定义（`types/gamestate.ts`），确认是否有其他 UI 瞬态字段被误拦截
- [ ] 特别关注：`战斗模式`、`系统通知` 是否需要通过 legacy path 写入
- [ ] 确认：在表命令链路完全可用的前提下，legacy path 白名单是否可以维持现状

### F2. commandGuard 拒绝日志可见性

- **文件**：CG
- **现状**：rejected 数组被返回但不确定是否显示给用户

**Checklist**：

- [ ] 确认 rejected 命令的诊断信息是否在系统日志/调试面板可见
- [ ] 若不可见：增加日志输出，至少在调试模式下显示被拦截的命令及原因

---

## FIX-G：State Variable Writer 路径映射审查（低优先）

> 目标：确认 stateVariableWriter 的 domain 路径映射完整

### G1. 支持的 domain 覆盖度

- **文件**：SVW (`stateVariableWriter.ts`)
- **现状**：`buildWriterCommandsFromEvent` 中显式处理了 `global_state`、`character_resources`、`inventory` 等 domain

**Checklist**：

- [x] 列出 SVW 中所有已实现的 domain handler
- [x] 与 SR 中的 `DOMAIN_MAPPING_REGISTRY` 对比，找出缺失的 domain
- [x] 对缺失 domain 评估是否需要补充 handler

---

## 验收标准

- [ ] state 服务能正确写入 SYS_GlobalState（时间/地点/天气每回合更新）
- [ ] state 服务能正确写入 QUEST_Active（任务状态变化时）
- [ ] state 服务能正确写入 ITEM_Inventory（物品获得/消耗时）
- [ ] state 服务能正确写入 CHARACTER_Resources（法术位/金币变化时）
- [ ] 世界/论坛更新在合理条件下（cadence 满足或手动触发）能正常执行
- [ ] 剧情表有明确的写入负责方，且 prompt 指令一致（无矛盾）
- [ ] 被拦截的命令在调试面板可见，便于排查

---

## 决策待办（需人工确认）

| #   | 决策项                           | 相关 Fix   | 选项                                 |
| --- | -------------------------------- | ---------- | ------------------------------------ |
| D1  | 剧情表由谁写？                   | A4, C1, C2 | A=story保留 / B=state接管            |
| D2  | `interval=0` 的语义？            | B1         | A=手动触发 / B=每回合更新 / C=不阻断 |
| D3  | phone 服务是否已启用？           | E1         | 若未启用可延后处理                   |
| D4  | `MAX_STRING_LENGTH` 提升到多少？ | D1         | 256 / 320 / 按字段区分               |

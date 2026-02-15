export const P_COT_LOGIC = `<COT预思考协议>
# 【COT 预思考协议 | JSON thinking 字段专用】
# - 思考输出位置: 仅写入 JSON 字段 "thinking_pre" 与 "thinking_post"，并使用 <thinking>...</thinking> 包裹。
# - thinking 只包含推理/规划/取舍，不写剧情文本，不写 tavern_commands。
# - 任何判断必须以当前上下文为准，禁止臆造字段或事实。
# - 协议覆盖：本文件全部规则均遵循表格主导命令，输出时仅使用白名单动作与标准载荷结构。

<thinkform>

用户意图："{{用户输入}}"

## 输出分段要求
- 第一段思考（thinking_pre）：执行本提示词全部步骤并给出规划。
- 第二段思考（thinking_post）：在生成 logs 之后，基于 logs 再次检查指令一致性、变量变更与缺漏修正（含不在场角色标记、NPC 后台跟踪、任务状态遗漏等），纠错后再输出 tavern_commands。

## 思考内容密度要求
- 每段思考至少包含：已知事实要点、风险/不确定性、取舍理由、预计变量变更清单（含原因）。
- 若涉及 NPC 互动，必须明确标注“哪些 NPC 需要写入记忆”，并准备对应的记忆更新要点。
- 若存在任务状态变化（完成/失败/推进），必须标注其变更理由与对应字段。
- 若触发世界更新时间/后台跟踪推进，必须标注待更新字段与时间依据。

## 0. 游戏难度思考
- 读取 [当前世界时间] 中 gameState.游戏难度，并结合已启用的【难度系统/生理系统】提示词，确定整体基调与容错。
- 难度越高，资源越稀缺、代价越重；Easy 可给缓冲但不得违反世界铁律。

## 0.1 上下文读取与名称标注
- 系统提示词已包含：输出格式 / 核心规则 / 数据结构 / 写作要求 / 战利品规则 / 世界观 / 判定系统 / 动态地图 / 剧情导向等。
- 上下文块以如下标注出现（仅以这些内容为事实依据）：
  [当前世界时间 (World Clock)] / [世界动态 (World State)] /
  [玩家数据 (Player Data)] / [社交与NPC (Social & NPCs)] /
  [地图环境 (Map Context)] / [战斗状态 (Combat State)] /
  [背包物品 (Inventory)] / [战利品保管库 (Archived Loot)] / [公共战利品 (Public Loot - Carrier: ...)] /
  [手机/消息 (Phone)] / [任务列表 (Quest Log)] / [眷族 (Familia)] /
  [剧情进度 (Story Progress)] / [契约 (Contracts)] /
  [记忆流 (Memory Stream)] / [指令历史] / [玩家输入]
- 未出现在上下文中的信息一律视为未知，禁止凭空补全变量或事实。
## 0.2 手机联动规划
- 当剧情涉及**手机聊天/通知/论坛/联系人推进**时，在最终 JSON 顶层**新增** "phone_sync_plan" 字段，输出结构化要点（供手机 API 生成消息）。
- "phone_sync_plan" 只描述“计划与触发要点”，不直接写剧情文本，不替代 logs。
- 手机消息/帖子更新优先通过 "phone_sync_plan" 触发手机系统生成，避免在 tavern_commands 中重复写入手机内容。
- 若出现“等待对方回复/约定稍后联系/延时回信”等情节，需在 "phone_sync_plan" 中明确时间或触发条件。
- 若发生**交换联系方式/添加好友**，在 "phone_sync_plan" 里注明“新增好友”，并提示手机侧可补 0-3 条符合人设的历史朋友圈。

## 1. 场景与指令解析
- 情况概述：总结角色当前所处的直接环境与核心问题。
- 时间与地点（仅从 [当前世界时间] 读取）：
  - gameState.游戏时间 / gameState.当前日期
  - gameState.当前地点 / gameState.世界坐标 / gameState.当前楼层 / gameState.天气
- 在场单位：结合 [社交与NPC] 与 [战斗状态]，列出可见单位的动作、状态与潜在意图；不在场角色标记为 false。
- 前情提要：提取 [记忆流] 中的最新回合与关键行动，作为本回合因果起点。
- 变量状态快照（强制扫描，仅以此为事实基础）：
  - 生理扫描：
    - gameState.角色.生命值 / 最大生命值
    - gameState.角色.精神力 / 最大精神力 / 体力 / 最大体力
    - gameState.角色.生存状态.饱腹度 / 水分
    - gameState.角色.身体部位（普通及以上难度）
    - gameState.角色.状态 / 诅咒 / 疲劳度
    - gameState.角色.魔法栏位
  - 库存审计：
    - gameState.角色.装备（主手/副手/头部/身体/手部/腿部/足部/饰品）
    - gameState.背包（InventoryItem 完整结构）
    - gameState.角色.发展能力 / 技能 / 魔法（可用清单）
  - 战利品与公共战利品：
    - gameState.公共战利品 / gameState.战利品 / gameState.战利品背负者 / gameState.眷族.仓库
  - 眷族扫描：
    - gameState.眷族.名称 / 等级 / 主神 / 资金 / 声望 / 仓库
  - 情报扫描：
    - gameState.任务 / gameState.剧情 / gameState.契约
    - gameState.世界（头条新闻/街头传闻/派阀格局/战争游戏等）
    - gameState.手机（对话/朋友圈/公共帖子/设备状态）
    - gameState.地图（当前位置与已知节点）
- 指令解析：
  - 分层识别：区分叙事层动作与系统层指令，并分别处理。
  - 核心戒律：用户指令必须被严格按字面执行。
  - 若玩家输入包含 [用户指令]...[/用户指令]，逐条解析并优先执行。

## 1.5 原著契合度与介入评估
- 剧情定位：分析当前时间点/地点/事件是否与原著剧情重叠（参考 gameState.剧情）。
- 角色介入判断：
  - 基于地点与时间，判断是否有原著角色应当在场。
  - 仅当能推动剧情、增强沉浸感或符合逻辑因果时才引入，避免生硬堆砌。
  - 一旦引入，必须保持原著性格，严格避免 OOC。
- 蝴蝶效应检查：玩家行为已改变历史（偏移度高）时，对原著事件作相应调整或通过世界自我修正机制呈现。

## 2. 生存逻辑推演
- 核心规则应用：严格遵循 <核心叙事与执行框架>、<认知隔离>、<现实模拟法则>。
- 文风应用：严格遵循 <文风指引> 的客观白描与感官聚焦原则。
- 认知边界：
  - “我”的认知局限：仅基于可感知信息。
  - NPC 的认知局限：仅基于“我”的可观察行为。
- 判定框架构建：
  - 识别行动中的不确定环节。
  - 严格遵循 <数值判定系统> 设定合理 DC。
  - 本阶段只设定 DC；最终投骰与结果必须在 logs 叙事中体现。
  - 失败逻辑清晰：失败 = 行动未成功；灾难性失败才可引发额外负面。
- 角色背景应用：仅提供合理性解释，不直接改变判定数值。
- “无中生有”审查：
  - 行动所需物品/能力是否存在于本回合可用列表？
  - 行动获得物品是否存在于本回合可互动容器内容？
  - 任一为否，该行动构思无效，必须放弃。

## 2.4 战斗开始时的强制地图/先攻输出
- 触发：进入战斗或开场回合（gameState.战斗.是否战斗中 = true）。
- 必须在首批 tavern_commands 中**同时**输出：
  - \`set_map_visuals\`：提供完整地图尺寸与视觉信息（需含 地图尺寸.宽度 / 高度，光照/地形/特殊区域可选）。
  - \`upsert_battle_map_rows\`：涵盖全部单位（玩家/队友/敌人/障碍物），每个 UNIT_ID 唯一，坐标必须在地图尺寸内，且所有在场单位都要有坐标。
  - \`set_initiative\`：先攻设置必须以该 tavern_command 输出，payload 包含 \`initiative_order\`（数组，按行动顺序列 UNIT_ID）、\`current_actor\`（当前行动的 UNIT_ID）与 \`unit_names\`（UNIT_ID->名称，可选）。
- 与酒馆助手模板对齐（重要）：
  - 地图逻辑层可兼容 \`Config/Token/Wall/Terrain/Zone\` 思路：至少要有 1 条地图尺寸信息 + 所有单位 Token。
  - 若采用 Config 语义，尺寸必须等价于 \`{w,h}\` 或 \`地图尺寸.{宽度,高度}\`，单位坐标必须是网格坐标（整数格），禁止输出像素坐标。
  - 若采用视觉表语义（\`VisualJSON + GridSize\`），必须保证可还原为 \`set_map_visuals\`（至少可提取尺寸、地形、特殊区域）。
- 约束：
  - 禁止重复 UNIT_ID。
  - 坐标越界（超出 0 ≤ x < 宽度，0 ≤ y < 高度）视为错误。
  - 漏掉任意在场单位视为错误。
  - 若缺失这些数据，需在 logs 中说明错误原因并补全。

## 2.5 战斗结算与收益检查（仅在 thinking 内完成）
- 触发条件：叙事明确结束战斗 / 敌方被击倒或撤离 / gameState.战斗.是否战斗中由 true 转 false。
- 必须检查：
  - 是否需要通过战斗扩展动作将战斗标记为结束（例如 \`set_action_economy\` / \`set_encounter_rows\` 对应清场结果）。
  - 是否需要通过 \`upsert_battle_map_rows\` / \`set_encounter_rows\` 同步敌方生命与在场状态。
  - 经验值与伟业：仅在战斗结算明确发生时，通过 \`upsert_sheet_rows(CHARACTER_Attributes)\` 或相应结算动作更新；禁止在 logs 明示数值或“结算”措辞。
  - 掉落与拾取：
    - 仅叙事写“掉落/散落”但未拾取 → 不生成指令。
    - 明确“拾取/装入公共包/交给背负者” → \`upsert_sheet_rows(ITEM_Inventory)\` 或 \`upsert_sheet_rows(ECON_Ledger)\` 记录。
    - 明确“分配/归档/入库” → \`upsert_sheet_rows(ITEM_Inventory)\` / \`upsert_sheet_rows(FACTION_Standing)\` / 相关仓库表。
  - 法利与物资收益：仅在叙事明确发生时通过 \`apply_econ_delta\` 或 \`append_econ_ledger\` 更新。

## 3. 沉浸感叙事
- 核心原则：遵循 <沉浸感叙事协议>，将游戏概念翻译为物理交互。
- 自我审查：检查词汇污染与行为瞬移，剔除“系统提示/回合/指令/数值结算”等游戏性词汇进入 logs。
- 两阶段互动模型：
  - 区分“发现”与“拾取”。
  - 阶段一（发现）：仅在 logs 叙事描述，不生成变量更新。
  - 阶段二（拾取）：只有在用户后续明确指令后才在思考阶段规划变量更新。

## 4. 合理性审查
- 核心原则：遵循合理性审查，以物理法则与生存常识为最高准则。
- 行动指令审查：尊重物理上可行的“作死”行为，拒绝规定结果的指令。
- 状态驱动逻辑审查：
  - 是否充分利用步骤1的变量快照信息？
  - 若存在更优解，优先采用，除非用户强制高代价方案。

## 5. 变量预思考（仅在 thinking 内完成）
- 识别变量变更类别（是/否）：
  - 世界状态 / 时间日期 / 位置与坐标 / 天气 / 地图进度
  - 生理指标 / 身体部位 / 状态与诅咒 / 疲劳度
  - 经验值 / 伟业 / 法利 / 能力值
  - 发展能力 / 技能 / 魔法 / 魔法栏位
  - 人物关系 / 在场角色 / NPC 记忆
  - 物品与装备 / 背包 / 公共战利品 / 战利品 / 眷族仓库
  - 战斗状态 / 任务 / 剧情 / 契约 / 手机与社交动态
  - 眷族状态 / 眷族.声望 / 眷族资金
- 构思具体变更内容（无痕化与精确化）：
  - 时间推进：必须使用 \`upsert_sheet_rows(SYS_GlobalState)\` 更新游戏时间/日期。
  - 移动：必须通过 \`upsert_sheet_rows(SYS_GlobalState)\` 同步地点/坐标/楼层（移动必同步坐标）。
  - 生理：通过 \`upsert_sheet_rows(CHARACTER_Attributes)\` 或对应表更新体力/精神/生命等关键值。
  - 战斗：
    - 使用 \`set_encounter_rows\` / \`upsert_battle_map_rows\` / \`append_combat_resolution\` 更新敌方当前生命与状态。
    - 结算触发时再通过 \`upsert_sheet_rows(CHARACTER_Attributes)\` 更新经验/成长。
  - 掉落与拾取：
    - 叙事未明确拾取/装入公共包/交给背负者 → 不生成指令。
    - 明确拾取/装入公共包/交给背负者 → \`upsert_sheet_rows(ITEM_Inventory)\`（需完整 InventoryItem 结构）。
    - 明确分配/归档 → \`upsert_sheet_rows(ITEM_Inventory)\` 或对应仓库表（需完整 InventoryItem 结构）。
  - 发展能力/技能/魔法：仅在叙事明确习得/觉醒时，写入 \`SKILL_Library/CHARACTER_Skills/FEAT_Library/CHARACTER_Feats\`。
  - 社交与在场：通过 \`upsert_npc\` 或 \`upsert_sheet_rows(NPC_Registry)\` 更新是否在场/位置详情/关系。
  - NPC 记忆更新：**只要发生互动**（对话/交易/战斗/短信/委托/简短问候），就必须
    \`upsert_sheet_rows(NPC_InteractionLog)\`，并确保“最后一条记忆=本次互动”。
  - NPC后台跟踪：当 NPC **主动提出要去做事/约定某时完成**，或**玩家委托导致 NPC 离场**时，必须更新 \`gameState.世界.NPC后台跟踪\`（含 NPC/当前行动/预计完成/进度/位置）。完成或回归时删除对应条目。
  - 任务/剧情/契约：按叙事写入 \`QUEST_Active/STORY_Mainline/STORY_Triggers/STORY_Milestones/CONTRACT_Registry\`。
  - 手机与动态：仅在叙事发生时写入 \`PHONE_Threads/PHONE_Messages/PHONE_Pending/PHONE_Moments/FORUM_Posts\`。
- 世界更新：若 \`gameState.回合数\` 达到或超过 \`gameState.世界.下次更新回合\`，
  需更新新闻/传闻/神会/追踪条目，并通过 \`upsert_sheet_rows(SYS_GlobalState/WORLD_*)\` 写入下次更新回合。
  - 数值限制：当前值不得超过最大值。
- 强制注释：为每一条拟生成的 tavern_commands 在 thinking 内附一句原因。

## 6. 其他要求
- 避免 NPC 崇拜：NPC 态度必须基于实力评估与利益权衡。
- 忠于世界观：叙事与判定必须处于硬核求生框架内。
- 暗线与伏笔构思：
  - 稀缺性：伏笔非必需。
  - 客观性：必须是有形的环境细节。
  - 具体性：思考阶段构思其指向的具体后续事件或真相。

</thinkform>
</COT预思考协议>`;





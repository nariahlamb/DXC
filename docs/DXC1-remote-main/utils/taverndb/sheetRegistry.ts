import {
  CORE_TAVERNDB_SHEET_IDS,
  CoreTavernDBSheetId,
  TAVERNDB_TEMPLATE_SHEET_IDS,
  TavernDBDomainMapping,
  TavernDBSheetDefinition,
  TavernDBSheetId
} from '../../types/taverndb';

const TEMPLATE_SHEET_REGISTRY: TavernDBSheetDefinition[] = [
  {
    id: 'SYS_GlobalState',
    label: '全局状态',
    description: '世界场景、时间推进、天气与战斗模式。',
    order: 0,
    columns: [
      { key: '当前场景', required: true },
      { key: '场景描述' },
      { key: '当前日期' },
      { key: '游戏时间', required: true },
      { key: '上轮时间' },
      { key: '流逝时长' },
      { key: '世界坐标X' },
      { key: '世界坐标Y' },
      { key: '天气状况' },
      { key: '战斗模式' },
      { key: '当前回合', required: true },
      { key: '系统通知' }
    ]
  },
  {
    id: 'SYS_CommandAudit',
    label: '命令审计',
    description: '记录每条命令的来源、结果和摘要。',
    order: 1,
    columns: [
      { key: 'command_id', required: true },
      { key: 'turn' },
      { key: 'action', required: true },
      { key: 'sheet' },
      { key: 'result' },
      { key: 'reason' },
      { key: 'source' },
      { key: 'timestamp' }
    ]
  },
  {
    id: 'SYS_TransactionAudit',
    label: '事务审计',
    description: '记录事务提交/回滚与 patch 数量。',
    order: 2,
    columns: [
      { key: 'tx_id', required: true },
      { key: 'turn' },
      { key: 'status', required: true },
      { key: 'patch_count' },
      { key: 'command_count' },
      { key: 'reason' },
      { key: 'timestamp' }
    ]
  },
  {
    id: 'SYS_ValidationIssue',
    label: '校验问题',
    description: '记录 schema 校验失败与守卫阻断问题。',
    order: 3,
    columns: [
      { key: 'issue_id', required: true },
      { key: 'turn' },
      { key: 'severity', required: true },
      { key: 'action' },
      { key: 'sheet' },
      { key: 'path' },
      { key: 'message', required: true },
      { key: 'timestamp' }
    ]
  },
  {
    id: 'SYS_MappingRegistry',
    label: '映射注册表',
    description: '模块到 sheet 主键映射，作为 SSOT 字典。',
    order: 4,
    columns: [
      { key: 'domain', required: true },
      { key: 'module', required: true },
      { key: 'sheet_id', required: true },
      { key: 'primary_key', required: true },
      { key: 'description' }
    ]
  },
  {
    id: 'ECON_Ledger',
    label: '经济流水',
    description: '资金变更流水，必须由显式命令写入。',
    order: 5,
    columns: [
      { key: 'ledger_id', required: true },
      { key: 'turn', required: true },
      { key: 'timestamp', required: true },
      { key: 'account', required: true },
      { key: 'before', required: true },
      { key: 'delta', required: true },
      { key: 'after', required: true },
      { key: 'reason', required: true },
      { key: 'command_ref' }
    ]
  },
  {
    id: 'NPC_Registry',
    label: 'NPC注册表',
    description: 'NPC 的身份、状态、关系与关键经历。',
    order: 1,
    columns: [
      { key: 'NPC_ID', required: true },
      { key: '姓名', required: true },
      { key: '种族/性别/年龄' },
      { key: '职业/身份' },
      { key: '外貌描述' },
      { key: '等级' },
      { key: 'HP' },
      { key: 'AC' },
      { key: '主要技能' },
      { key: '随身物品' },
      { key: '当前状态' },
      { key: '所在位置' },
      { key: '与主角关系' },
      { key: '关键经历' }
    ]
  },
  {
    id: 'ITEM_Inventory',
    label: '背包',
    description: '玩家背包与装备物品列表。',
    order: 2,
    columns: [
      { key: '物品ID', required: true },
      { key: '物品名称', required: true },
      { key: '类别' },
      { key: '数量' },
      { key: '已装备' },
      { key: '所属人' },
      { key: '伤害' },
      { key: '特性' },
      { key: '稀有度' },
      { key: '描述' },
      { key: '重量' },
      { key: '价值' }
    ]
  },
  {
    id: 'QUEST_Active',
    label: '任务',
    description: '任务主线/支线追踪与进度状态。',
    order: 3,
    columns: [
      { key: '任务ID', required: true },
      { key: '任务名称', required: true },
      { key: '类型' },
      { key: '发布者' },
      { key: '目标描述' },
      { key: '当前进度' },
      { key: '状态' },
      { key: '时限' },
      { key: '奖励' }
    ]
  },
  {
    id: 'FACTION_Standing',
    label: '势力声望',
    description: '势力关系等级、声望值、关键事件。',
    order: 4,
    columns: [
      { key: '势力ID', required: true },
      { key: '势力名称', required: true },
      { key: '关系等级' },
      { key: '声望值' },
      { key: '主角头衔' },
      { key: '关键事件' },
      { key: '特权/通缉' }
    ]
  },
  {
    id: 'COMBAT_Encounter',
    label: '战斗遭遇表',
    description: '回合战斗单位、状态、资源。',
    order: 5,
    columns: [
      { key: '单位名称', required: true },
      { key: '阵营' },
      { key: '先攻/位置' },
      { key: 'HP状态' },
      { key: '防御/抗性' },
      { key: '附着状态' },
      { key: '是否为当前行动者' },
      { key: '回合资源' }
    ]
  },
  {
    id: 'COMBAT_BattleMap',
    label: '战斗地图',
    description: '战斗地图逻辑对象、坐标与尺寸。',
    order: 6,
    columns: [
      { key: '单位名称', required: true },
      { key: '类型' },
      { key: '坐标' },
      { key: '大小' },
      { key: 'Token' }
    ]
  },
  {
    id: 'LOG_Summary',
    label: '总结表',
    description: '每轮纪要与关键对白，AM 编码索引。',
    order: 7,
    columns: [
      { key: '时间跨度' },
      { key: '地点' },
      { key: '纪要', required: true },
      { key: '重要对话' },
      { key: '编码索引', required: true }
    ]
  },
  {
    id: 'LOG_Outline',
    label: '总体大纲',
    description: '每轮大纲摘要，必须与 summary 共用 AM。',
    order: 8,
    columns: [
      { key: '时间跨度' },
      { key: '大纲', required: true },
      { key: '编码索引', required: true }
    ]
  },
  {
    id: 'UI_ActionOptions',
    label: '行动选项',
    description: '供 UI 渲染的四路行动按钮。',
    order: 9,
    columns: [
      { key: '选项A', required: true },
      { key: '选项B', required: true },
      { key: '选项C', required: true },
      { key: '选项D', required: true }
    ]
  },
  {
    id: 'DICE_Pool',
    label: '骰子池',
    description: '前端/系统可消费的随机骰值池。',
    order: 10,
    columns: [
      { key: 'ID', required: true },
      { key: 'D4' },
      { key: 'D6' },
      { key: 'D8' },
      { key: 'D10' },
      { key: 'D12' },
      { key: 'D20' },
      { key: 'D100' }
    ]
  },
  {
    id: 'SKILL_Library',
    label: '技能/法术库',
    description: '技能定义与完整机制描述库。',
    order: 11,
    columns: [
      { key: 'SKILL_ID', required: true },
      { key: '技能名称', required: true },
      { key: '技能类型' },
      { key: '环阶' },
      { key: '学派' },
      { key: '施法时间' },
      { key: '射程' },
      { key: '成分' },
      { key: '持续时间' },
      { key: '效果描述' },
      { key: '升阶效果' }
    ]
  },
  {
    id: 'CHARACTER_Skills',
    label: '角色技能关联',
    description: '角色和技能库的多对多关系表。',
    order: 12,
    columns: [
      { key: 'LINK_ID', required: true },
      { key: 'CHAR_ID', required: true },
      { key: 'SKILL_ID', required: true },
      { key: '获取方式' },
      { key: '已准备' },
      { key: '熟练度' },
      { key: '备注' }
    ]
  },
  {
    id: 'FEAT_Library',
    label: '专长库',
    description: '专长定义与效果描述库。',
    order: 13,
    columns: [
      { key: 'FEAT_ID', required: true },
      { key: '专长名称', required: true },
      { key: '类别' },
      { key: '前置条件' },
      { key: '效果描述' },
      { key: '属性提升' },
      { key: '附带能力ID' }
    ]
  },
  {
    id: 'CHARACTER_Feats',
    label: '角色专长关联',
    description: '角色与专长库的多对多关系表。',
    order: 14,
    columns: [
      { key: 'LINK_ID', required: true },
      { key: 'CHAR_ID', required: true },
      { key: 'FEAT_ID', required: true },
      { key: '获取来源' },
      { key: '获取等级' },
      { key: '已选择项' },
      { key: '备注' }
    ]
  },
  {
    id: 'CHARACTER_Registry',
    label: '角色表',
    description: '主角与同伴角色基础信息。',
    order: 15,
    columns: [
      { key: 'CHAR_ID', required: true },
      { key: '成员类型', required: true },
      { key: '姓名', required: true },
      { key: '种族/性别/年龄' },
      { key: '职业' },
      { key: '外貌描述' },
      { key: '性格特点' },
      { key: '背景故事' },
      { key: '加入时间' }
    ]
  },
  {
    id: 'CHARACTER_Attributes',
    label: '角色属性',
    description: '角色战斗属性、熟练与经验。',
    order: 16,
    columns: [
      { key: 'CHAR_ID', required: true },
      { key: '等级' },
      { key: 'HP' },
      { key: 'AC' },
      { key: '先攻加值' },
      { key: '速度' },
      { key: '属性值' },
      { key: '豁免熟练' },
      { key: '技能熟练' },
      { key: '被动感知' },
      { key: '经验值' }
    ]
  },
  {
    id: 'CHARACTER_Resources',
    label: '角色资源',
    description: '法术位、职业资源、生命骰与金币。',
    order: 17,
    columns: [
      { key: 'CHAR_ID', required: true },
      { key: '法术位' },
      { key: '职业资源' },
      { key: '生命骰' },
      { key: '特殊能力' },
      { key: '金币' }
    ]
  },
  {
    id: 'PHONE_Device',
    label: '手机设备',
    description: '智能终端设备状态。',
    order: 18,
    columns: [
      { key: 'device_id', required: true },
      { key: 'status' },
      { key: 'battery' },
      { key: 'signal' },
      { key: 'last_seen' }
    ]
  },
  {
    id: 'PHONE_Contacts',
    label: '手机联系人',
    description: '联系人、黑名单与最近联系人。',
    order: 19,
    columns: [
      { key: 'contact_id', required: true },
      { key: 'name', required: true },
      { key: 'bucket' },
      { key: 'blacklisted' },
      { key: 'recent' }
    ]
  },
  {
    id: 'PHONE_Threads',
    label: '手机会话',
    description: '私聊/群聊/公共频道线程。',
    order: 20,
    columns: [
      { key: 'thread_id', required: true },
      { key: 'type', required: true },
      { key: 'title', required: true },
      { key: 'members' },
      { key: 'unread' },
      { key: 'pinned' },
      { key: 'summary' },
      { key: 'summary_time' }
    ]
  },
  {
    id: 'PHONE_Messages',
    label: '手机消息',
    description: '线程内消息明细。',
    order: 21,
    columns: [
      { key: 'message_id', required: true },
      { key: 'thread_id', required: true },
      { key: 'sender' },
      { key: 'content' },
      { key: 'timestamp' },
      { key: 'msg_type' },
      { key: 'status' },
      { key: 'deliver_at' }
    ]
  },
  {
    id: 'PHONE_Pending',
    label: '手机待发送',
    description: '延迟发送/触发发送队列。',
    order: 22,
    columns: [
      { key: 'pending_id', required: true },
      { key: 'thread_id' },
      { key: 'thread_type' },
      { key: 'thread_title' },
      { key: 'deliver_at', required: true },
      { key: 'status' },
      { key: 'payload_preview' },
      { key: 'trigger' }
    ]
  },
  {
    id: 'FORUM_Boards',
    label: '论坛板块',
    description: '公共论坛板块定义与元信息。',
    order: 23,
    columns: [
      { key: 'board_id', required: true },
      { key: '名称', required: true },
      { key: '图标' },
      { key: '颜色' },
      { key: '描述' }
    ]
  },
  {
    id: 'FORUM_Posts',
    label: '论坛帖子',
    description: '公共论坛帖子主表。',
    order: 24,
    columns: [
      { key: 'post_id', required: true },
      { key: 'board_id' },
      { key: 'board_name' },
      { key: '标题', required: true },
      { key: '内容' },
      { key: '发布者', required: true },
      { key: '时间戳' },
      { key: '点赞数' },
      { key: '浏览数' },
      { key: '置顶' },
      { key: '精华' },
      { key: '话题标签' },
      { key: '图片描述' }
    ]
  },
  {
    id: 'FORUM_Replies',
    label: '论坛回复',
    description: '论坛帖子楼层回复明细。',
    order: 25,
    columns: [
      { key: 'reply_id', required: true },
      { key: 'post_id', required: true },
      { key: '楼层' },
      { key: '发布者', required: true },
      { key: '内容', required: true },
      { key: '时间戳' },
      { key: '引用楼层' },
      { key: '点赞数' }
    ]
  },
  {
    id: 'PHONE_Moments',
    label: '朋友圈动态',
    description: '朋友圈动态主表。',
    order: 26,
    columns: [
      { key: 'moment_id', required: true },
      { key: '发布者', required: true },
      { key: '内容', required: true },
      { key: '时间戳' },
      { key: '可见性' },
      { key: '点赞数' },
      { key: '评论数' },
      { key: '话题标签' },
      { key: '图片描述' }
    ]
  },
  {
    id: 'WORLD_NpcTracking',
    label: '世界-NPC后台跟踪',
    description: 'NPC后台行动追踪表（替代 gameState.世界.NPC后台跟踪 path 写入）。',
    order: 27,
    columns: [
      { key: 'tracking_id', required: true },
      { key: 'npc_name', required: true },
      { key: 'current_action', required: true },
      { key: 'location' },
      { key: 'progress' },
      { key: 'eta' },
      { key: 'updated_at' }
    ]
  },
  {
    id: 'WORLD_News',
    label: '世界-头条新闻',
    description: '世界新闻主表，支持来源、重要度与关联传闻。',
    order: 28,
    columns: [
      { key: 'news_id', required: true },
      { key: '标题', required: true },
      { key: '内容' },
      { key: '时间戳' },
      { key: '来源', required: true },
      { key: '重要度' },
      { key: '关联传闻' }
    ]
  },
  {
    id: 'WORLD_Rumors',
    label: '世界-街头传闻',
    description: '世界传闻主表，支持传播度、可信度与关联新闻。',
    order: 29,
    columns: [
      { key: 'rumor_id', required: true },
      { key: '主题', required: true },
      { key: '内容' },
      { key: '传播度' },
      { key: '可信度' },
      { key: '来源' },
      { key: '话题标签' },
      { key: '发现时间' },
      { key: '评论数' },
      { key: '已升级为新闻' },
      { key: '关联新闻' }
    ]
  },
  {
    id: 'WORLD_Denatus',
    label: '世界-诸神神会',
    description: '神会主题、讨论记录与最终结果。',
    order: 30,
    columns: [
      { key: 'denatus_id', required: true },
      { key: '下次神会开启时间' },
      { key: '神会主题' },
      { key: '讨论内容' },
      { key: '最终结果' }
    ]
  },
  {
    id: 'WORLD_WarGame',
    label: '世界-战争游戏',
    description: '战争游戏状态、参战方、赌注与结果。',
    order: 31,
    columns: [
      { key: 'war_game_id', required: true },
      { key: '状态' },
      { key: '参战眷族' },
      { key: '形式' },
      { key: '赌注' },
      { key: '举办时间' },
      { key: '结束时间' },
      { key: '结果' },
      { key: '备注' }
    ]
  },
  {
    id: 'STORY_Mainline',
    label: '剧情-主线',
    description: '剧情主线、引导、路线与时间轴快照。',
    order: 32,
    columns: [
      { key: 'mainline_id', required: true },
      { key: '当前卷数' },
      { key: '当前篇章' },
      { key: '当前阶段' },
      { key: '关键节点' },
      { key: '节点状态' },
      { key: '当前目标' },
      { key: '下一触发' },
      { key: '行动提示' },
      { key: '预定日期' },
      { key: '下一关键时间' },
      { key: '是否正史' },
      { key: '偏移度' },
      { key: '分歧说明' },
      { key: '备注' }
    ]
  },
  {
    id: 'STORY_Triggers',
    label: '剧情-待触发',
    description: '剧情待触发事件池（触发条件与状态）。',
    order: 33,
    columns: [
      { key: 'trigger_id', required: true },
      { key: '预计触发', required: true },
      { key: '内容', required: true },
      { key: '类型' },
      { key: '触发条件' },
      { key: '重要度' },
      { key: '状态' }
    ]
  },
  {
    id: 'STORY_Milestones',
    label: '剧情-里程碑',
    description: '剧情关键里程碑与影响记录。',
    order: 34,
    columns: [
      { key: 'milestone_id', required: true },
      { key: '时间', required: true },
      { key: '事件', required: true },
      { key: '影响' }
    ]
  },
  {
    id: 'CONTRACT_Registry',
    label: '契约-注册表',
    description: '契约条目、状态与条款。',
    order: 35,
    columns: [
      { key: 'contract_id', required: true },
      { key: '名称', required: true },
      { key: '描述' },
      { key: '状态' },
      { key: '条款' }
    ]
  },
  {
    id: 'MAP_SurfaceLocations',
    label: '地图-地表地点',
    description: '地表地点元数据（坐标、类型、描述、可见性）。',
    order: 36,
    columns: [
      { key: 'location_id', required: true },
      { key: 'name', required: true },
      { key: 'type', required: true },
      { key: 'x' },
      { key: 'y' },
      { key: 'radius' },
      { key: 'floor' },
      { key: 'description' },
      { key: 'icon' },
      { key: 'source' },
      { key: 'visited' }
    ]
  },
  {
    id: 'MAP_DungeonLayers',
    label: '地图-地下城层',
    description: '地下城层区间、危险度与地标。',
    order: 37,
    columns: [
      { key: 'layer_id', required: true },
      { key: 'floor_start', required: true },
      { key: 'floor_end', required: true },
      { key: 'name', required: true },
      { key: 'danger_level' },
      { key: 'description' },
      { key: 'landmarks' }
    ]
  },
  {
    id: 'MAP_MacroLocations',
    label: '地图-宏观区域',
    description: '大区块地图节点，用于路线与场景切换。',
    order: 38,
    columns: [
      { key: 'macro_id', required: true },
      { key: 'name', required: true },
      { key: 'parent_id' },
      { key: 'x' },
      { key: 'y' },
      { key: 'floor' },
      { key: 'description' },
      { key: 'tags' }
    ]
  },
  {
    id: 'MAP_MidLocations',
    label: '地图-中观地点',
    description: '中观地点与结构模板（可驱动场景地图）。',
    order: 39,
    columns: [
      { key: 'mid_id', required: true },
      { key: 'name', required: true },
      { key: 'parent_id' },
      { key: 'x' },
      { key: 'y' },
      { key: 'floor' },
      { key: 'description' },
      { key: 'map_structure' },
      { key: 'layout' }
    ]
  },
  {
    id: 'NPC_RelationshipEvents',
    label: 'NPC-关系事件',
    description: 'NPC 关系变化事件日志（可审计）。',
    order: 40,
    columns: [
      { key: 'event_id', required: true },
      { key: 'npc_id', required: true },
      { key: 'npc_name' },
      { key: 'timestamp' },
      { key: 'event' },
      { key: 'affinity_delta' },
      { key: 'relationship_state' },
      { key: 'notes' }
    ]
  },
  {
    id: 'NPC_LocationTrace',
    label: 'NPC-位置轨迹',
    description: 'NPC 位置追踪与在场状态。',
    order: 41,
    columns: [
      { key: 'trace_id', required: true },
      { key: 'npc_id', required: true },
      { key: 'npc_name' },
      { key: 'timestamp' },
      { key: 'location' },
      { key: 'x' },
      { key: 'y' },
      { key: 'present' },
      { key: 'detail' }
    ]
  },
  {
    id: 'NPC_InteractionLog',
    label: 'NPC-互动日志',
    description: 'NPC 互动记录（对话、事件、印象）。',
    order: 42,
    columns: [
      { key: 'interaction_id', required: true },
      { key: 'npc_id', required: true },
      { key: 'npc_name' },
      { key: 'timestamp' },
      { key: 'type' },
      { key: 'summary', required: true },
      { key: 'source' }
    ]
  },
  {
    id: 'QUEST_Objectives',
    label: '任务-目标子表',
    description: '任务目标拆分（便于细粒度追踪）。',
    order: 43,
    columns: [
      { key: 'objective_id', required: true },
      { key: 'quest_id', required: true },
      { key: 'objective', required: true },
      { key: 'status' },
      { key: 'progress' },
      { key: 'target' },
      { key: 'updated_at' }
    ]
  },
  {
    id: 'QUEST_ProgressLog',
    label: '任务-进度日志',
    description: '任务进度事件流水（替代大文本拼接）。',
    order: 44,
    columns: [
      { key: 'progress_id', required: true },
      { key: 'quest_id', required: true },
      { key: 'timestamp', required: true },
      { key: 'content', required: true },
      { key: 'status' },
      { key: 'delta' },
      { key: 'source' }
    ]
  },
  {
    id: 'EXPLORATION_Map_Data',
    label: '探索地图数据',
    description: '探索场景地图结构 JSON 与更新时间。',
    order: 45,
    columns: [
      { key: 'LocationName', required: true },
      { key: 'MapStructureJSON' },
      { key: 'LastUpdated' },
      { key: '当前显示地图' }
    ]
  },
  {
    id: 'COMBAT_Map_Visuals',
    label: '战斗地图绘制',
    description: '战斗视觉层 JSON 与网格尺寸。',
    order: 46,
    columns: [
      { key: 'SceneName', required: true },
      { key: 'VisualJSON' },
      { key: 'GridSize' },
      { key: 'LastUpdated' }
    ]
  }
];

const SHEET_SET = new Set<string>(TAVERNDB_TEMPLATE_SHEET_IDS);
const CORE_SHEET_SET = new Set<string>(CORE_TAVERNDB_SHEET_IDS);

const DOMAIN_MAPPING_REGISTRY: TavernDBDomainMapping[] = [
  { domain: 'global_state', module: 'core', sheetId: 'SYS_GlobalState', primaryKey: '_global_id', description: '全局状态单行快照（始终仅一行）' },
  { domain: 'command_audit', module: 'core', sheetId: 'SYS_CommandAudit', primaryKey: 'command_id', description: '命令执行审计' },
  { domain: 'transaction_audit', module: 'core', sheetId: 'SYS_TransactionAudit', primaryKey: 'tx_id', description: '事务提交与回滚审计' },
  { domain: 'validation_issue', module: 'core', sheetId: 'SYS_ValidationIssue', primaryKey: 'issue_id', description: '校验错误追踪' },
  { domain: 'mapping_registry', module: 'core', sheetId: 'SYS_MappingRegistry', primaryKey: 'domain', description: '模块映射字典' },
  { domain: 'npc_registry', module: 'social', sheetId: 'NPC_Registry', primaryKey: 'NPC_ID', description: 'NPC 主档' },
  { domain: 'inventory', module: 'inventory', sheetId: 'ITEM_Inventory', primaryKey: '物品ID', description: '背包与物品' },
  { domain: 'quest', module: 'quest', sheetId: 'QUEST_Active', primaryKey: '任务ID', description: '任务状态与进度' },
  { domain: 'faction', module: 'world', sheetId: 'FACTION_Standing', primaryKey: '势力ID', description: '势力关系' },
  { domain: 'economy_ledger', module: 'economy', sheetId: 'ECON_Ledger', primaryKey: 'ledger_id', description: '资金流水' },
  { domain: 'combat_encounter', module: 'combat', sheetId: 'COMBAT_Encounter', primaryKey: '单位名称', description: '战斗遭遇信息' },
  { domain: 'combat_map', module: 'combat', sheetId: 'COMBAT_BattleMap', primaryKey: '单位名称', description: '战斗地图对象' },
  { domain: 'log_summary', module: 'memory', sheetId: 'LOG_Summary', primaryKey: '编码索引', description: '回合纪要' },
  { domain: 'log_outline', module: 'memory', sheetId: 'LOG_Outline', primaryKey: '编码索引', description: '章节大纲' },
  { domain: 'action_options', module: 'ui', sheetId: 'UI_ActionOptions', primaryKey: '选项A', description: '行动选项' },
  { domain: 'dice_pool', module: 'combat', sheetId: 'DICE_Pool', primaryKey: 'ID', description: '骰池' },
  { domain: 'skill_library', module: 'character', sheetId: 'SKILL_Library', primaryKey: 'SKILL_ID', description: '技能库' },
  { domain: 'character_skill_link', module: 'character', sheetId: 'CHARACTER_Skills', primaryKey: 'LINK_ID', description: '角色技能关联' },
  { domain: 'feat_library', module: 'character', sheetId: 'FEAT_Library', primaryKey: 'FEAT_ID', description: '专长库' },
  { domain: 'character_feat_link', module: 'character', sheetId: 'CHARACTER_Feats', primaryKey: 'LINK_ID', description: '角色专长关联' },
  { domain: 'character_registry', module: 'character', sheetId: 'CHARACTER_Registry', primaryKey: 'CHAR_ID', description: '角色主档' },
  { domain: 'character_attributes', module: 'character', sheetId: 'CHARACTER_Attributes', primaryKey: 'CHAR_ID', description: '角色属性' },
  { domain: 'character_resources', module: 'character', sheetId: 'CHARACTER_Resources', primaryKey: 'CHAR_ID', description: '角色资源' },
  { domain: 'phone_device', module: 'phone', sheetId: 'PHONE_Device', primaryKey: 'device_id', description: '终端设备状态' },
  { domain: 'phone_contacts', module: 'phone', sheetId: 'PHONE_Contacts', primaryKey: 'contact_id', description: '联系人与黑名单' },
  { domain: 'phone_threads', module: 'phone', sheetId: 'PHONE_Threads', primaryKey: 'thread_id', description: '对话线程' },
  { domain: 'phone_messages', module: 'phone', sheetId: 'PHONE_Messages', primaryKey: 'message_id', description: '消息内容' },
  { domain: 'phone_pending', module: 'phone', sheetId: 'PHONE_Pending', primaryKey: 'pending_id', description: '延迟发送队列' },
  { domain: 'forum_boards', module: 'phone', sheetId: 'FORUM_Boards', primaryKey: 'board_id', description: '论坛板块定义' },
  { domain: 'forum_posts', module: 'phone', sheetId: 'FORUM_Posts', primaryKey: 'post_id', description: '论坛帖子主表' },
  { domain: 'forum_replies', module: 'phone', sheetId: 'FORUM_Replies', primaryKey: 'reply_id', description: '论坛回复明细' },
  { domain: 'phone_moments', module: 'phone', sheetId: 'PHONE_Moments', primaryKey: 'moment_id', description: '朋友圈动态' },
  { domain: 'world_npc_tracking', module: 'world', sheetId: 'WORLD_NpcTracking', primaryKey: 'tracking_id', description: 'NPC后台行动跟踪' },
  { domain: 'world_news', module: 'world', sheetId: 'WORLD_News', primaryKey: 'news_id', description: '世界新闻' },
  { domain: 'world_rumors', module: 'world', sheetId: 'WORLD_Rumors', primaryKey: 'rumor_id', description: '街头传闻' },
  { domain: 'world_denatus', module: 'world', sheetId: 'WORLD_Denatus', primaryKey: 'denatus_id', description: '诸神神会' },
  { domain: 'world_wargame', module: 'world', sheetId: 'WORLD_WarGame', primaryKey: 'war_game_id', description: '战争游戏' },
  { domain: 'story_mainline', module: 'story', sheetId: 'STORY_Mainline', primaryKey: 'mainline_id', description: '剧情主线快照' },
  { domain: 'story_triggers', module: 'story', sheetId: 'STORY_Triggers', primaryKey: 'trigger_id', description: '剧情待触发事件' },
  { domain: 'story_milestones', module: 'story', sheetId: 'STORY_Milestones', primaryKey: 'milestone_id', description: '剧情里程碑' },
  { domain: 'contract_registry', module: 'story', sheetId: 'CONTRACT_Registry', primaryKey: 'contract_id', description: '契约注册表' },
  { domain: 'map_surface_locations', module: 'map', sheetId: 'MAP_SurfaceLocations', primaryKey: 'location_id', description: '地表地点元数据' },
  { domain: 'map_dungeon_layers', module: 'map', sheetId: 'MAP_DungeonLayers', primaryKey: 'layer_id', description: '地下城层级元数据' },
  { domain: 'map_macro_locations', module: 'map', sheetId: 'MAP_MacroLocations', primaryKey: 'macro_id', description: '宏观区域元数据' },
  { domain: 'map_mid_locations', module: 'map', sheetId: 'MAP_MidLocations', primaryKey: 'mid_id', description: '中观地点元数据' },
  { domain: 'npc_relationship_events', module: 'social', sheetId: 'NPC_RelationshipEvents', primaryKey: 'event_id', description: 'NPC关系事件日志' },
  { domain: 'npc_location_trace', module: 'social', sheetId: 'NPC_LocationTrace', primaryKey: 'trace_id', description: 'NPC位置轨迹' },
  { domain: 'npc_interaction_log', module: 'social', sheetId: 'NPC_InteractionLog', primaryKey: 'interaction_id', description: 'NPC互动日志' },
  { domain: 'quest_objectives', module: 'quest', sheetId: 'QUEST_Objectives', primaryKey: 'objective_id', description: '任务目标子表' },
  { domain: 'quest_progress_log', module: 'quest', sheetId: 'QUEST_ProgressLog', primaryKey: 'progress_id', description: '任务进度日志' },
  { domain: 'exploration_map', module: 'map', sheetId: 'EXPLORATION_Map_Data', primaryKey: 'LocationName', description: '探索地图' },
  { domain: 'combat_visuals', module: 'combat', sheetId: 'COMBAT_Map_Visuals', primaryKey: 'SceneName', description: '战斗视觉' }
];

export { CORE_TAVERNDB_SHEET_IDS, TAVERNDB_TEMPLATE_SHEET_IDS };

export const getSheetRegistry = (): TavernDBSheetDefinition[] => {
  return TEMPLATE_SHEET_REGISTRY.map((sheet) => ({
    ...sheet,
    columns: sheet.columns.map((column) => ({ ...column }))
  }));
};

export const getCoreSheetRegistry = (): TavernDBSheetDefinition[] => {
  return getSheetRegistry().filter((sheet) => CORE_SHEET_SET.has(sheet.id));
};

export const isSheetId = (sheetId: string): sheetId is TavernDBSheetId => {
  return SHEET_SET.has(sheetId);
};

export const isCoreSheetId = (sheetId: string): sheetId is CoreTavernDBSheetId => {
  return CORE_SHEET_SET.has(sheetId);
};

export const getDomainMappingRegistry = (): TavernDBDomainMapping[] => {
  return DOMAIN_MAPPING_REGISTRY.map((item) => ({ ...item }));
};

export const getDomainMappingsByModule = (module: string): TavernDBDomainMapping[] => {
  const normalized = String(module || '').trim().toLowerCase();
  if (!normalized) return [];
  return getDomainMappingRegistry().filter((item) => String(item.module).toLowerCase() === normalized);
};

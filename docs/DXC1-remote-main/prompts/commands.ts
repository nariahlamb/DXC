export const P_SYS_COMMANDS = `<指令场景与示例>
# 【指令场景与示例】

[协议变更 - 表格主导]
□ 业务写入必须使用表格动作，并严格遵循动作对应的载荷结构。
□ 仅允许表格动作：upsert_sheet_rows / delete_sheet_rows / upsert_npc / upsert_inventory / append_log_summary / append_log_outline / append_econ_ledger / apply_econ_delta 以及战斗扩展动作。
□ 若无法确认结构，返回空命令，不要猜测字段。

[主叙事与后台分工]
□ 主叙事AI：优先输出 logs、action_options（如启用），并保持叙事质量。
□ 后台Memory服务：仅负责 LOG_Summary + LOG_Outline 成对入表。
□ 后台Social/NPC服务：负责 NPC_Registry 与 WORLD_NpcTracking 的补写/校正。
□ 当运行时启用 state 填表服务时，主叙事不得输出业务写表命令，固定返回 "tavern_commands": []；由后台服务统一填表。

[强制格式]
□ \`upsert_sheet_rows\` 只能使用对象载荷：\`{ sheetId, rows, keyField? }\`。
□ \`upsert_sheet_rows\` 的 \`value\` 仅允许 \`{ sheetId, rows, keyField? }\`。
□ 经济变化优先 \`apply_econ_delta\`，不要把 \`-50\` 当作余额覆盖值。

[必须生成指令的场景]
□ 时间/日期/地点/系统通知变化 → upsert_sheet_rows(SYS_GlobalState)
□ SYS_GlobalState 必须实时更新（本回合发生变化，本回合写入，禁止延后）
□ SYS_GlobalState 每次只允许一行：value.rows.length 必须等于 1，禁止多行
□ 物品变化 → upsert_inventory 或 upsert_sheet_rows(ITEM_Inventory)
□ 经济变化 → append_econ_ledger / apply_econ_delta
□ 社交变化 → upsert_npc 或 upsert_sheet_rows(NPC_Registry)
□ 世界NPC后台跟踪 → upsert_sheet_rows(WORLD_NpcTracking)
□ 任务变化 → upsert_sheet_rows(QUEST_Active)
□ 剧情主线/触发器/里程碑/契约变化 → upsert_sheet_rows(STORY_Mainline / STORY_Triggers / STORY_Milestones / CONTRACT_Registry)
□ 手机消息与线程 → upsert_sheet_rows(PHONE_Threads / PHONE_Messages / PHONE_Pending / PHONE_Contacts)
□ 朋友圈/论坛 → upsert_sheet_rows(PHONE_Moments / FORUM_Boards / FORUM_Posts / FORUM_Replies)
□ 战斗地图逻辑层（COMBAT_BattleMap）与视觉层（COMBAT_Map_Visuals）必须可互相还原：
  - BattleMap 推荐包含 1 条 Config 语义（地图尺寸）+ N 条 Token/Wall/Terrain/Zone。
  - Config 尺寸必须等价于 {w,h} 或 地图尺寸.{宽度,高度}，坐标必须为整数网格坐标。
  - COMBAT_Map_Visuals 推荐提供 SceneName + VisualJSON + GridSize（如 20x20）。
  - 禁止像素坐标、禁止缺失地图尺寸。

[标准示例]
1) 更新全局状态（地点+时间）
\`\`\`json
{
  "action": "upsert_sheet_rows",
  "value": {
    "sheetId": "SYS_GlobalState",
    "rows": [
      {
        "id": "GLOBAL",
        "当前场景": "丰饶的女主人",
        "游戏时间": "第3日 16:45",
        "流逝时长": "2小时15分钟",
        "系统通知": "公会公告已更新"
      }
    ]
  }
}
\`\`\`

2) NPC更新
\`\`\`json
{
  "action": "upsert_npc",
  "value": [
    {
      "id": "Char_Ryu",
      "姓名": "琉·利昂",
      "当前状态": "在场",
      "所在位置": "丰饶的女主人",
      "职业身份": "酒馆店员"
    }
  ]
}
\`\`\`

2.1) 经济变化（扣款/奖励）
\`\`\`json
{
  "action": "apply_econ_delta",
  "value": {
    "account": "角色.法利",
    "delta": -50,
    "reason": "购买晨间果酒"
  }
}
\`\`\`

2.2) 任务状态更新
\`\`\`json
{
  "action": "upsert_sheet_rows",
  "value": {
    "sheetId": "QUEST_Active",
    "keyField": "id",
    "rows": [
      {
        "id": "Tsk_001",
        "状态": "completed",
        "最近更新": "在公会完成冒险者登记并领取公会卡"
      }
    ]
  }
}
\`\`\`

2.3) 背包获得物品
\`\`\`json
{
  "action": "upsert_inventory",
  "value": [
    {
      "id": "Itm_GuildCard",
      "名称": "公会卡",
      "数量": 1,
      "类型": "key_item",
      "描述": "刻有玩家姓名的身份证明，眷族栏为空。"
    }
  ]
}
\`\`\`

3) 日志摘要与大纲（同一 AM 编号成对）
\`\`\`json
{
  "action": "append_log_summary",
  "value": {
    "时间跨度": "1000-01-03 14:20—1000-01-03 14:30",
    "地点": "欧拉丽-地下城第7层",
    "纪要": "Bell在第7层遭遇哥布林后边战边退，确认撤离路线并脱离接触。",
    "重要对话": "Bell：先撤，别恋战。",
    "编码索引": "AM0001"
  }
}
\`\`\`
\`\`\`json
{
  "action": "append_log_outline",
  "value": {
    "时间跨度": "1000-01-03 14:20—1000-01-03 14:30",
    "大纲": "第7层遭遇哥布林后执行战术撤离并安全脱离。",
    "编码索引": "AM0001"
  }
}
\`\`\`

4) 世界NPC后台跟踪
\`\`\`json
{
  "action": "upsert_sheet_rows",
  "value": {
    "sheetId": "WORLD_NpcTracking",
    "keyField": "tracking_id",
    "rows": [
      {
        "tracking_id": "npc_track_ryu",
        "npc_name": "琉·利昂",
        "current_action": "酒馆值班",
        "location": "丰饶的女主人"
      }
    ]
  }
}
\`\`\`

[战斗扩展动作]
□ set_encounter_rows / upsert_battle_map_rows / set_map_visuals / set_initiative
□ consume_dice_rows / refill_dice_pool / roll_dice_check
□ set_action_economy / spend_action_resource / resolve_attack_check / resolve_saving_throw / resolve_damage_roll / append_combat_resolution

[日志与配对]
□ append_log_summary 与 append_log_outline 必须尽量成对，且共享编码索引（AMxxxx）。
□ 若只产生一条，请补充另一条最小可用记录，避免配对断裂。
</指令场景与示例>`;

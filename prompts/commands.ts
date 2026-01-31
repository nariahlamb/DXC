export const P_SYS_COMMANDS = `<指令场景与示例>
# 【指令场景与示例】

[必须生成指令的场景]
□ 时间/日期/位置变化 → set gameState.游戏时间 / set gameState.当前日期 / set gameState.当前地点 / set gameState.世界坐标
□ 物品获得(明确拾取/收到/放入背包) → push gameState.背包 (必须生成完整InventoryItem结构, id需唯一)
□ 掉落但未拾取 → 仅叙事描述，不生成指令
□ 物品消耗 → add gameState.背包[i].数量 -1 (若数量归0，则 delete gameState.背包[i])
□ 战斗伤害 → add gameState.角色.生命值 -X / add gameState.角色.身体部位.胸部.当前 -X
□ 属性变化 → add gameState.角色.能力值.力量 1 (仅限恩惠更新时)
□ 社交变化 → add gameState.社交[i].好感度 X / push gameState.社交 (新NPC) / set gameState.社交[i].是否在场 true
□ NPC互动记忆 → 只要与NPC发生对话/交易/战斗/短信/委托/问候，必须 push gameState.社交[i].记忆 (确保末条为本次互动)
□ 任务更新 → set gameState.任务[i].状态 "completed"

[指令操作示例库]

**A. 物品指令示例**
- **获得物品 (完整结构)**:
  \`{"action":"push", "key":"gameState.背包", "value":{"id":"Itm_gen_01", "名称":"双角兽的角", "描述":"坚硬的素材。", "数量":1, "类型":"material", "品质":"Common", "价值":500}}\`
- **消耗物品 (指定索引)**:
  \`{"action":"add", "key":"gameState.背包[2].数量", "value":-1}\`
- **金钱变化**:
  \`{"action":"add", "key":"gameState.角色.法利", "value":-1200}\`

**B. 恩惠/能力值指令示例**
- **能力值更新**:
  \`{"action":"add", "key":"gameState.角色.能力值.力量", "value": 5}\`
- **习得技能**:
  \`{"action":"push", "key":"gameState.角色.技能", "value":{"id":"Skl_Argonaut", "名称":"英雄愿望(Argonaut)", "类别":"主动", "描述":"对主动行动进行蓄力...", "效果":"蓄力完成后获得高倍率爆发", "触发":"主动蓄力", "持续":"短", "冷却":"中", "消耗":{"体力":"中","精神":"低"}, "标签":["蓄力"], "稀有":true}}\`
- **习得魔法**:
  \`{"action":"push", "key":"gameState.角色.魔法", "value":{"id":"Mag_Firebolt", "名称":"Firebolt", "咏唱":"炎之精灵，化为炽矢。", "类别":"攻击", "属性":"火", "描述":"快速咏唱的火系弹道魔法", "效果":"单体火焰冲击", "射程":"中", "范围":"单体", "消耗":{"精神":30}}}\`

**C. NPC指令示例**
- **创建NPC (完整结构)**:
  \`{"action":"push", "key":"gameState.社交", "value":{"id":"Char_Ryu", "姓名":"琉·利昂", "种族":"精灵", "年龄":21, "身份":"酒馆店员", "眷族":"阿斯特莉亚(前)", "等级":4, "好感度":20, "关系状态":"认识", "是否在场":true, "已交换联系方式":false, "记忆":[], "外貌":"淡绿色的短发。", "坐标":{"x":50000,"y":50000}}}\`
- **好感变化**:
  \`{"action":"add", "key":"gameState.社交[3].好感度", "value":5}\`
- **互动记忆写入**:
  \`{"action":"push", "key":"gameState.社交[3].记忆", "value":{"内容":"对方询问了当前委托并约定稍后回信。","时间戳":"当前时间"}}\`
</指令场景与示例>`;

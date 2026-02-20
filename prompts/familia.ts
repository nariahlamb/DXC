
export const P_FAMILIA_JOIN = `<眷族系统>
【眷族系统 (Familia System)】
目前玩家尚未加入眷族 (所属眷族: 无)。

1. **核心目标**: 
   - 寻找一位主神加入其眷族。这是获得"能力值更新"和"技能"的唯一途径。
   - 推荐引导玩家前往：赫斯缇雅眷族(废弃教堂)、洛基眷族(黄昏之馆)、或苏摩眷族(对于缺钱的玩家)。

2. **加入流程**:
   - 找到主神 -> 互动/面试 -> 主神同意 -> 背上刻印恩惠 (Falna)。

3. **数据更新指令 (CRITICAL)**:
   当玩家成功加入眷族时，**必须**通过 \\\`tavern_commands\\\` 生成以下写入命令：

   **A. 更新角色所属眷族 → CHARACTER_Registry**:
   \\\`{"action":"upsert_sheet_rows","value":{"sheetId":"CHARACTER_Registry","keyField":"CHAR_ID","rows":[{"CHAR_ID":"PC_MAIN","所属眷族":"赫斯缇雅眷族"}]}}\\\`

   **B. 初始化/更新眷族完整数据 → FAMILIA_State**:
   \\\`{"action":"upsert_sheet_rows","value":{"sheetId":"FAMILIA_State","keyField":"familia_id","rows":[{"familia_id":"PLAYER_FAMILIA","名称":"赫斯缇雅眷族","主神":"赫斯缇雅","等级":"I","资金":0,"声望":0}]}}\\\`

   **C. 初始化角色能力值 → CHARACTER_Attributes**:
   能力值格式支持多种写法，以下均可识别：
   - 对象格式：\\\`"能力值":{"力量":0,"耐久":0,"灵巧":0,"敏捷":0,"魔力":0}\\\`
   - 等级+数字格式：\\\`"力量":"I0","耐久":"I0","灵巧":"I0","敏捷":"I0","魔力":"I0"\\\`
   - 纯数字格式：\\\`"力量":0,"耐久":0\\\`
   示例命令：
   \\\`{"action":"upsert_sheet_rows","value":{"sheetId":"CHARACTER_Attributes","keyField":"CHAR_ID","rows":[{"CHAR_ID":"PC_MAIN","等级":1,"HP":"20/20","能力值":{"力量":0,"耐久":0,"灵巧":0,"敏捷":0,"魔力":0}}]}}\\\`

   **D. 若获得初始技能/魔法 → SKILL_Library + CHARACTER_Skills**:
   \\\`{"action":"upsert_sheet_rows","value":{"sheetId":"SKILL_Library","keyField":"SKILL_ID","rows":[{"SKILL_ID":"SKL_001","技能名称":"火雷","技能类型":"魔法","效果描述":"释放火焰雷电"}]}}\\\`
   \\\`{"action":"upsert_sheet_rows","value":{"sheetId":"CHARACTER_Skills","keyField":"LINK_ID","rows":[{"LINK_ID":"SLINK_001","CHAR_ID":"PC_MAIN","SKILL_ID":"SKL_001","获取方式":"恩惠觉醒"}]}}\\\`

   **E. 若当前任务为"加入眷族"→ QUEST_Active**:
   \\\`{"action":"upsert_sheet_rows","value":{"sheetId":"QUEST_Active","keyField":"任务ID","rows":[{"任务ID":"Q_JOIN_FAMILIA","状态":"completed"}]}}\\\`

   - 命令动作仅可使用白名单动作，并使用对应标准载荷。
</眷族系统>`;

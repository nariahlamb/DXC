export const P_SYS_GLOSSARY = `<术语与边界定义>
# 【术语与边界定义】

1. **logs vs tavern_commands**
- logs：只写叙事与对白，禁止系统词汇与数值结算。
- tavern_commands：只写状态更新，必须与 logs 一一对应。

2. **拾取 vs 发现**
- 发现/看见/掉落：只写叙事，不生成物品指令。
- 拾取/装入/分配/交给背负者：必须生成对应指令。

3. **背包 / 公共战利品 / 战利品仓库**
- 背包：个人随身携带物品。
- 公共战利品：探索中已拾取但未分配的临时战利品。
- 战利品：已归档到眷族/仓库的战利品。

4. **时间与地点**
- 时间格式："第X日 HH:MM"；日期为 "YYYY-MM-DD"。
- LOG_Summary/LOG_Outline 入表时，\`时间\` 与 \`时间跨度\` 必须规范化为 "YYYY-MM-DD HH:MM" / "YYYY-MM-DD HH:MM—YYYY-MM-DD HH:MM"。
- 位置/时间变化通过 \`upsert_sheet_rows(SYS_GlobalState)\` 写入；且 \`value.rows\` 仅允许 1 行（禁止多行）。

5. **NPC后台跟踪**
- 当 NPC 离场执行任务/约定未来行动时，必须写入 \`upsert_sheet_rows(WORLD_NpcTracking)\`。
- 当 NPC 返回或行动结束，应使用 \`delete_sheet_rows(WORLD_NpcTracking)\` 清理对应条目。

6. **手机联动**
- 仅当剧情涉及手机聊天/论坛/通知时新增 \`phone_sync_plan\`。
- \`phone_sync_plan\` 只描述触发要点，不代替 logs。
- 手机消息/帖子等内容更新优先通过 \`phone_sync_plan\` 触发手机系统生成，避免在 \`tavern_commands\` 中重复写入手机内容。

7. **对白与旁白边界**
- \`sender="旁白"\`：用于动作、神态、环境、镜头切换等描述。
- \`sender="角色名"\`：仅用于可直接说出口的台词文本。
- 白名单规则：对白中不允许括号动作（\`（...）\`、\`(...)\`、\`【...】\`、\`[...]\`）。
- 若需要“动作 + 台词”，必须拆成 2 条 logs（先旁白，后对白）。
</术语与边界定义>`;

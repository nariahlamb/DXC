import { P_SYS_FORMAT } from './system';

const replaceOnce = (base: string, from: string, to: string) => {
  return base.includes(from) ? base.replace(from, to) : base;
};

export const P_SYS_FORMAT_MULTI = (() => {
  let output = P_SYS_FORMAT;
  output = replaceOnce(
    output,
    '**输出顺序必须是**：thinking_pre → logs → thinking_post → tavern_commands → shortTerm → action_options(可选)',
    '**输出顺序必须是**：thinking_plan → thinking_style → thinking_draft → thinking_check → thinking_canon → thinking_vars_pre → thinking_vars_other → thinking_vars_merge → thinking_gap → logs → thinking_vars_post → tavern_commands → shortTerm → action_options(可选)'
  );
  output = output.replace(
    /\*\*thinking_pre \/ thinking_post 字段要求\*\*:[\s\S]*?\n\n/,
    [
      '**thinking 字段要求**:',
      '- JSON 必须包含以下 thinking 字段，且全部使用 `<thinking>...</thinking>` 包裹。',
      '- `thinking_plan`：剧情预先思考（规划/分析）。',
      '- `thinking_plan` 必须包含“变量门禁结论（通过/不通过）”，并说明若不通过将采用的改道方案。',
      '- `thinking_style`：文风思考（视角/语气/节奏/感官重点）。',
      '- `thinking_draft`：剧情草稿（允许叙事文本，但不写指令）。',
      '- `thinking_check`：剧情合理性校验（基于草稿/上下文）。',
      '- `thinking_check` 必须回答“变量可执行性检查”结论（支持性/下限/上限）。',
      '- `thinking_canon`：原著思考（角色/世界观一致性）。',
      '- `thinking_vars_pre`：变量预思考（列出需变更的变量与理由）。',
      '- `thinking_vars_pre` 必须逐条列出候选命令的“前值→后值 + 合法性结论”。',
      '- `thinking_vars_other`：其它功能变量是否需要更新（NPC 跟踪/世界消息/公会通告等）。',
      '- `thinking_vars_merge`：变量融入剧情修正（修正草稿与叙事逻辑）。',
      '- `thinking_vars_merge` 必须在门禁不通过时先修正剧情草稿，再确定最终命令。',
      '- `thinking_gap`：查缺补漏思考（检查遗漏变量更新、未标记不在场角色等）。',
      '- `thinking_gap` 必须确认“是否仍残留非法命令/越界命令”。',
      '- `thinking_vars_post`：变量校正思考（基于 logs 复核 tavern_commands）。',
      '- `thinking_vars_post` 必须逐条复核最终命令并剔除非法命令，不得保留假成功。',
      '- 除 `thinking_draft` 可写叙事外，其余 thinking 字段只写推理/校验/取舍，不写 tavern_commands。',
      '',
      ''
    ].join('\n')
  );
  output = output.replace(
    new RegExp('("thinking_pre": "<thinking>[^\\n]*<\\/thinking>",)'),
    [
      '  "thinking_plan": "<thinking>（剧情预先思考）请在此给出规划与推演，并写明变量门禁结论（通过/不通过）。</thinking>",',
      '  "thinking_style": "<thinking>（文风思考）请在此定义本回合文风与语气（视角/节奏/感官重点）。</thinking>",',
      '  "thinking_draft": "<thinking>（剧情草稿）请在此写出本回合的剧情草稿。</thinking>",',
      '  "thinking_check": "<thinking>（合理性校验）请校验草稿的合理性与因果，并回答变量可执行性（支持性/下限/上限）。</thinking>",',
      '  "thinking_canon": "<thinking>（原著思考）请校验角色/世界观一致性。</thinking>",',
      '  "thinking_vars_pre": "<thinking>（变量预思考）列出需要更新的变量与理由，并逐条给出前值→后值与合法性。</thinking>",',
      '  "thinking_vars_other": "<thinking>（其它功能变量）检查 NPC 跟踪/世界消息/公会通告等是否需要更新。</thinking>",',
      '  "thinking_vars_merge": "<thinking>（变量融入剧情）将变量变化融入叙事并修正草稿；若门禁不通过先改稿再定命令。</thinking>",',
      '  "thinking_gap": "<thinking>（查缺补漏思考）检查是否遗漏变量更新，并确认无非法命令/越界命令残留。</thinking>",'
    ].join('\n')
  );
  output = output.replace(/\n  \"thinking_post\": .*?\n/, '\n');
  output = output.replace(
    /"logs": \[/,
    '"logs": ['
  );
  output = output.replace(
    /("logs": \[[\s\S]*?\])\s*,\s*\n/,
    `$1,\n  "thinking_vars_post": "<thinking>（变量校正思考）基于 logs 逐条复核 tavern_commands，剔除非法/越界后再输出。</thinking>",\n`
  );
  return output;
})();

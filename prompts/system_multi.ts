import { P_SYS_FORMAT } from './system';

const replaceOnce = (base: string, from: string, to: string) => {
  return base.includes(from) ? base.replace(from, to) : base;
};

export const P_SYS_FORMAT_MULTI = (() => {
  let output = P_SYS_FORMAT;
  output = replaceOnce(
    output,
    '**输出顺序必须是**：thinking_pre → logs → thinking_post → tavern_commands → shortTerm',
    '**输出顺序必须是**：thinking_plan → thinking_draft → thinking_check → thinking_canon → thinking_vars_pre → thinking_vars_other → thinking_vars_merge → logs → thinking_vars_post → tavern_commands → shortTerm'
  );
  output = output.replace(
    /\*\*thinking_pre \/ thinking_post 字段要求\*\*:[\s\S]*?\n\n/,
    [
      '**thinking 字段要求**:',
      '- JSON 必须包含以下 thinking 字段，且全部使用 `<thinking>...</thinking>` 包裹。',
      '- `thinking_plan`：剧情预先思考（规划/分析）。',
      '- `thinking_draft`：剧情草稿（允许叙事文本，但不写指令）。',
      '- `thinking_check`：剧情合理性校验（基于草稿/上下文）。',
      '- `thinking_canon`：原著思考（角色/世界观一致性）。',
      '- `thinking_vars_pre`：变量预思考（列出需变更的变量与理由）。',
      '- `thinking_vars_other`：其他功能变量是否需要更新（NPC 跟踪/世界消息/神会等）。',
      '- `thinking_vars_merge`：变量融入剧情矫正（修正草稿与叙事逻辑）。',
      '- `thinking_vars_post`：变量矫正思考（基于 logs 复核 tavern_commands）。',
      '- 除 `thinking_draft` 可写叙事外，其余 thinking 字段只写推理/校验/取舍，不写 tavern_commands。',
      '',
      ''
    ].join('\n')
  );
  output = output.replace(
    new RegExp('("thinking_pre": "<thinking>[^\\\\n]*<\\\\/thinking>",)'),
    [
      '  "thinking_plan": "<thinking>（剧情预先思考）请在此给出规划与推演。</thinking>",',
      '  "thinking_draft": "<thinking>（剧情草稿）请在此写出本回合的剧情草稿。</thinking>",',
      '  "thinking_check": "<thinking>（合理性校验）请校验草稿的合理性与因果。</thinking>",',
      '  "thinking_canon": "<thinking>（原著思考）请校验角色/世界观一致性。</thinking>",',
      '  "thinking_vars_pre": "<thinking>（变量预思考）列出需要更新的变量与理由。</thinking>",',
      '  "thinking_vars_other": "<thinking>（其他功能变量）检查 NPC 跟踪/世界消息/神会等是否需要更新。</thinking>",',
      '  "thinking_vars_merge": "<thinking>（变量融入剧情）将变量变化融入叙事并修正草稿。</thinking>",'
    ].join('\n')
  );
  output = output.replace(/\n  \"thinking_post\": .*?\n/, '\n');
  output = output.replace(
    /"logs": \[/,
    '"logs": ['
  );
  output = output.replace(
    /("logs": \[[\s\S]*?\])\s*,\s*\n/,
    `$1,\n  "thinking_vars_post": "<thinking>（变量矫正思考）基于 logs 复核 tavern_commands，一致后再输出。</thinking>",\n`
  );
  return output;
})();

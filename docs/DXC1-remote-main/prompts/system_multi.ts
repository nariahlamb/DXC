import { P_SYS_FORMAT } from './system';

const replaceOnce = (base: string, from: string, to: string) => {
  return base.includes(from) ? base.replace(from, to) : base;
};

export const P_SYS_FORMAT_MULTI = (() => {
  let output = P_SYS_FORMAT;
  output = replaceOnce(
    output,
    '**输出顺序必须是**：thinking_pre → logs → thinking_post → tavern_commands',
    '**输出顺序必须是**：thinking_plan → thinking_style → thinking_draft → thinking_check → thinking_canon → thinking_vars_pre → thinking_vars_other → thinking_vars_merge → thinking_gap → logs → thinking_vars_post → tavern_commands'
  );
  output = output.replace(
    /\*\*thinking_pre \/ thinking_post 字段要求\*\*:[\s\S]*?\n\n/,
    [
      '**thinking 字段要求**:',
      '- JSON 必须包含以下 thinking 字段，且全部使用 `<thinking>...</thinking>` 包裹。',
      '- `thinking_plan`：剧情预先思考。要求结构化：[动机分析] -> [行动推演(因果推断)] -> [环境/NPC交互反馈]。',
      '- `thinking_style`：文风思考。要求结构化：[感官基调设定] -> [叙事节奏把控(动/静)] -> [日系轻小说氛围映射]。',
      '- `thinking_draft`：剧情草稿（基于规划构建骨架，填充轻小说感官细节与台词片段，不允许写指令）。',
      '- `thinking_check`：逻辑校验。要求结构化：[无越权检查(NoControl)] -> [世界观物理干涉检查] -> [战力与客观设定检查]。',
      '- `thinking_canon`：原著内核考量。要求结构化：[NPC性格/做派锚定] -> [情境/语境契合度审核]。',
      '- `thinking_vars_pre`：变量预思考（列出需变更的变量与理由）。',
      '- `thinking_vars_other`：其他功能变量是否需要更新（NPC 跟踪/世界消息/神会等）。',
      '- `thinking_vars_merge`：变量融入剧情矫正（修正草稿与叙事逻辑）。',
      '- `thinking_gap`：查缺补漏思考（检查遗漏变量更新、不在场角色标记等）。',
      '- `thinking_vars_post`：变量矫正思考（基于 logs 复核 tavern_commands）。',
      '- 除 `thinking_draft` 可写叙事外，其余 thinking 字段只写推理/校验/取舍，不写 tavern_commands。',
      '',
      ''
    ].join('\n')
  );
  output = output.replace(
    /"thinking_pre"\s*:\s*"<thinking>[\s\S]*?<\/thinking>",?/,
    [
      '  "thinking_plan": "<thinking>（剧情预先思考）[动机分析]... [行动推演]... [预期反馈]...</thinking>",',
      '  "thinking_style": "<thinking>（文风思考）[感官基调]... [叙事节奏]... [轻小说元素与氛围]...</thinking>",',
      '  "thinking_draft": "<thinking>（剧情草稿）请在此写出本回合的骨架与剧情草稿...</thinking>",',
      '  "thinking_check": "<thinking>（合理性校验）[无越权检查]... [物理/战力定律检查]... [因果逻辑检查]...</thinking>",',
      '  "thinking_canon": "<thinking>（原著思考）[NPC性格契合度]... [原著设定映射]...</thinking>",',
      '  "thinking_vars_pre": "<thinking>（变量预思考）列出需要更新的变量与理由。</thinking>",',
      '  "thinking_vars_other": "<thinking>（其他功能变量）检查 NPC 跟踪/世界消息/神会等是否需要更新。</thinking>",',
      '  "thinking_vars_merge": "<thinking>（变量融入剧情）将变量变化融入叙事并修正草稿。</thinking>",',
      '  "thinking_gap": "<thinking>（查缺补漏思考）检查是否遗漏变量更新、是否忘记标记不在场角色等。</thinking>",'
    ].join('\n')
  );
  output = output.replace(
    /\s*,?\s*"thinking_post"\s*:\s*"<thinking>[\s\S]*?<\/thinking>"\s*,?\s*\n/,
    '\n'
  );
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

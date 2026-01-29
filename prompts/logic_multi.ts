import { P_COT_LOGIC } from './logic';

const replaceOnce = (base: string, from: string, to: string) => {
  return base.includes(from) ? base.replace(from, to) : base;
};

export const P_COT_LOGIC_MULTI = (() => {
  let output = P_COT_LOGIC;
  output = replaceOnce(
    output,
    '# - 思考输出位置: 仅写入 JSON 字段 "thinking_pre" 与 "thinking_post"，并使用 <thinking>...</thinking> 包裹。',
    '# - 思考输出位置: 仅写入 JSON 字段 "thinking_plan"、"thinking_style"、"thinking_draft"、"thinking_check"、"thinking_canon"、"thinking_vars_pre"、"thinking_vars_other"、"thinking_vars_merge"、"thinking_gap"、"thinking_vars_post"，并使用 <thinking>...</thinking> 包裹。'
  );
  output = replaceOnce(
    output,
    '# - thinking 只包含推理/规划/取舍，不写剧情文本，不写 tavern_commands。',
    '# - thinking_plan / thinking_style / thinking_check / thinking_canon / thinking_vars_pre / thinking_vars_other / thinking_vars_merge / thinking_gap / thinking_vars_post 只包含推理/校验/取舍，不写 tavern_commands。\n# - thinking_draft 允许剧情草稿叙事，但禁止 tavern_commands。'
  );
  output = output.replace(
    /## 输出分段要求[\s\S]*?## 0\./,
    [
      '## 输出分段要求',
      '- 剧情预先思考（thinking_plan）：执行本提示词全部步骤并给出规划。',
      '- 文风思考（thinking_style）：确定本回合的视角、语气、节奏与感官重点。',
      '- 剧情草稿（thinking_draft）：输出剧情草稿（允许叙事文本，不写指令）。',
      '- 剧情合理性校验（thinking_check）：基于草稿与上下文做合理性检查。',
      '- 原著思考（thinking_canon）：检查角色/世界观与原著一致性。',
      '- 变量预思考（thinking_vars_pre）：列出需要变更的变量与理由。',
      '- 其他功能变量是否需要更新思考（thinking_vars_other）：检查 NPC 跟踪/世界消息/神会等是否要更新。',
      '- 变量融入剧情矫正（thinking_vars_merge）：将变量变化融入叙事逻辑并修正草稿。',
      '- 查缺补漏思考（thinking_gap）：检查是否遗漏变量更新、是否忘记设置不在场角色、后台跟踪与任务状态等。',
      '- 正文：输出到 logs。',
      '- 变量矫正思考（thinking_vars_post）：基于 logs 复核 tavern_commands，一致后再输出。',
      '',
      '## 思考内容密度要求',
      '- 每段思考至少包含：已知事实要点、风险/不确定性、取舍理由、预计变量变更清单（含原因）。',
      '- 若涉及 NPC 互动，必须明确标注“哪些 NPC 需要写入记忆”，并准备对应的记忆更新要点。',
      '- 若存在任务状态变化（完成/失败/推进），必须标注其变更理由与对应字段。',
      '- 若触发世界更新时间/后台跟踪推进，必须标注待更新字段与时间依据。',
      '',
      '## 0.'
    ].join('\n')
  );
  return output;
})();

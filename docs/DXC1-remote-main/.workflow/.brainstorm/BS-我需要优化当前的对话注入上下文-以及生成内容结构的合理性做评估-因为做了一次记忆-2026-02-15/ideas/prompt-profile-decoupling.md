# Idea Deep Dive: Prompt 去冲突（Story Narrative Profile）

## 核心概念
将主叙事 Prompt 从“叙事+命令混合协议”改为“叙事专用协议”，彻底剥离命令导向内容。

## 关键改动点
- `utils/aiPrompt.ts`
  - narrative-only 模式下仅拼接 story-safe 模块。
- `prompts/system.ts`
  - 提供 story 版本：强调 `tavern_commands: []`。
- `prompts/logic.ts`
  - story 版本去除“生成 tavern_commands”与变量写表规划条目。

## 风险与缓解
- 风险：历史依赖提示词可能影响叙事风格。
- 缓解：先灰度开关，保留旧模块可回退。

## MVP 验收
1. story prompt 快照不含命令生成导向语句。
2. 输出质量（logs 连贯性）不下降。
3. command_leak_rate 明显下降。

## 建议结论
**优先推进（pursue）**，放在 P0 之后。

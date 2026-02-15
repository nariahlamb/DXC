import { describe, expect, it } from 'vitest';
import { extractServiceCommands, parseAIResponseText } from '../utils/aiJson';

describe('aiJson parsing and extraction', () => {
  it('extracts nested tavern_commands array from mixed malformed text', () => {
    const raw = [
      'thinking: ignore this block',
      '"tavern_commands": [',
      '{"action":"append_log_outline","value":{"回合":1,"事件列表":["A",["B1","B2"]]}}',
      ']',
      'tail text'
    ].join(' ');

    const result = extractServiceCommands(raw);

    expect(result.tavern_commands).toHaveLength(1);
    expect(result.repairNote).toContain('Balanced tavern_commands extraction');
    expect(result.tavern_commands[0]?.value?.事件列表).toEqual(['A', ['B1', 'B2']]);
  });

  it('extracts commands from SSE wrapped payload', () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"{\\"tavern_commands\\":["}}]}',
      'data: {"choices":[{"delta":{"content":"{\\"action\\":\\"append_log_summary\\",\\"value\\":{\\"回合\\":1,\\"摘要\\":\\"ok\\"}}]}"}}]}',
      'data: [DONE]'
    ].join('\n');

    const result = extractServiceCommands(sse);

    expect(result.tavern_commands).toHaveLength(1);
    expect(result.tavern_commands[0]?.action).toBe('append_log_summary');
    expect(result.repairNote).toContain('SSE payload extraction');
  });

  it('extracts commands from responses-style SSE payload', () => {
    const sse = [
      'data: {"type":"response.output_text.delta","delta":"{\\"tavern_commands\\":["}',
      'data: {"type":"response.output_text.delta","delta":"{\\"action\\":\\"append_log_summary\\",\\"value\\":{\\"回合\\":1,\\"摘要\\":\\"ok\\"}}]}"}',
      'data: {"type":"response.completed"}'
    ].join('\n');

    const result = extractServiceCommands(sse);

    expect(result.tavern_commands).toHaveLength(1);
    expect(result.tavern_commands[0]?.action).toBe('append_log_summary');
    expect(result.repairNote).toContain('SSE payload extraction');
  });

  it('repairs trailing commas and missing closing brace', () => {
    const raw = '{"logs":[{"sender":"narrator","text":"ok",}],"tavern_commands":[]';

    const parsed = parseAIResponseText(raw);

    expect(parsed.repaired).toBe(true);
    expect(parsed.error).toBeUndefined();
    expect(parsed.response?.tavern_commands).toEqual([]);
    expect(parsed.repairNote).toContain('已移除尾随逗号');
    expect(parsed.repairNote).toContain('已补齐缺失括号');
  });

  it('repairs unescaped control characters inside string literals', () => {
    const raw = '{"logs":[{"sender":"旁白","text":"第一行\n第二行\t含制表"}],"tavern_commands":[]}';

    const parsed = parseAIResponseText(raw);

    expect(parsed.error).toBeUndefined();
    expect(parsed.response?.logs?.[0]?.text).toContain('第一行');
    expect(parsed.response?.logs?.[0]?.text).toContain('第二行');
    expect(parsed.repairNote).toContain('已转义字符串内控制字符');
  });

  it('parses fenced JSON with thinking fields and unescaped multiline logs text', () => {
    const raw = [
      '```json',
      '{"thinking_pre":"<thinking>计划开始</thinking>","logs":[{"sender":"旁白","text":"清晨的街道',
      '出现了新的脚步声"}],"tavern_commands":[]}',
      '```'
    ].join('\n');

    const parsed = parseAIResponseText(raw);

    expect(parsed.error).toBeUndefined();
    expect(parsed.response?.thinking_pre).toContain('<thinking>');
    expect(parsed.response?.logs?.[0]?.text).toContain('清晨的街道');
  });

  it('parses JSON wrapped by txt fence', () => {
    const raw = [
      '```txt',
      '{"logs":[{"sender":"旁白","text":"段落一。"}],"tavern_commands":[]}',
      '```'
    ].join('\n');

    const parsed = parseAIResponseText(raw);

    expect(parsed.error).toBeUndefined();
    expect(parsed.response?.logs?.[0]?.text).toBe('段落一。');
    expect(parsed.response?.tavern_commands).toEqual([]);
  });

  it('returns empty commands for invalid input', () => {
    const raw = 'plain text without any json payload';

    const result = extractServiceCommands(raw);

    expect(result.tavern_commands).toEqual([]);
    expect(result.rawResponse).toBe(raw);
  });
});

import { describe, expect, it } from 'vitest';
import { sanitizeLogText, splitLogTextIntoParagraphs } from '../../utils/logTextFormat';

describe('logTextFormat', () => {
  it('strips outer txt fence wrapper', () => {
    const raw = '```txt\n第一段内容。\n第二段内容。\n```';
    expect(sanitizeLogText(raw)).toBe('第一段内容。\n第二段内容。');
  });

  it('keeps blank-line paragraph boundaries', () => {
    const raw = '第一段。\n\n第二段。\n\n第三段。';
    expect(splitLogTextIntoParagraphs(raw)).toEqual(['第一段。', '', '第二段。', '', '第三段。']);
  });

  it('decodes escaped line breaks from JSON-style text', () => {
    const raw = '第一段。\\n\\n第二段。\\n第三段。';
    expect(sanitizeLogText(raw)).toBe('第一段。\n\n第二段。\n第三段。');
    expect(splitLogTextIntoParagraphs(raw)).toEqual(['第一段。', '', '第二段。', '第三段。']);
  });

  it('splits long single-line narrative into readable chunks', () => {
    const raw = '主角在港口检查了可疑货箱并记录异常编号。随后他与守卫核对了进出清单，确认有一批货物在夜间被调换。回到据点后他将线索同步给同伴，并计划在下一回合进行仓库复查。'.repeat(2);
    const chunks = splitLogTextIntoParagraphs(raw, { mode: 'narrative' });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toContain('主角在港口检查了可疑货箱');
    expect(chunks.join('')).toContain('计划在下一回合进行仓库复查');
  });

  it('keeps short dialogue intact when there is no explicit newline', () => {
    const raw = '她压低声音说道：“别怕。”你能听见海浪声。她停顿片刻，又补了一句：“跟紧我。”然后继续向前。'.repeat(2);
    expect(splitLogTextIntoParagraphs(raw, { mode: 'dialogue' })).toEqual([sanitizeLogText(raw)]);
  });

  it('soft-splits long dialogue by speaker cues for readability', () => {
    const raw = ('莉亚：我们必须现在出发，不然会错过窗口。'
      + '阿泽：我同意，但先检查补给。'
      + '莉亚：你负责地图，我来盯后方。'
      + '阿泽：收到，三分钟后集合。'
      + '莉亚：别让任何人掉队。'
      + '阿泽：明白。').repeat(3);
    const chunks = splitLogTextIntoParagraphs(raw, { mode: 'dialogue' });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(sanitizeLogText(raw));
    expect(chunks.some((chunk) => chunk.includes('莉亚：'))).toBe(true);
    expect(chunks.some((chunk) => chunk.includes('阿泽：'))).toBe(true);
  });

  it('hard-splits extremely long dialogue to keep an upper bound', () => {
    const raw = 'a'.repeat(1000);
    const chunks = splitLogTextIntoParagraphs(raw, { mode: 'dialogue' });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 240)).toBe(true);
    expect(chunks.join('')).toBe(raw);
  });
});

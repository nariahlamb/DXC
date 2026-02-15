import { describe, expect, it } from 'vitest';
import { normalizeStoryResponseLogs } from '../../utils/logSegmentation';

describe('logSegmentation normalizeStoryResponseLogs', () => {
  it('splits mixed narrative + dialogue into separate logs', () => {
    const logs = normalizeStoryResponseLogs({
      rawLogs: [
        {
          sender: '旁白',
          text: '雨夜的街道很冷。莉亚：我们得快点。阿泽：前面有灯。'
        }
      ],
      knownSpeakers: ['莉亚', '阿泽']
    });

    expect(logs).toEqual([
      { sender: '旁白', text: '雨夜的街道很冷。' },
      { sender: '莉亚', text: '我们得快点。' },
      { sender: '阿泽', text: '前面有灯。' }
    ]);
  });

  it('keeps explicit NPC sender as a single dialogue log', () => {
    const logs = normalizeStoryResponseLogs({
      rawLogs: [
        {
          sender: '莉亚',
          text: '我看向你，轻声说：我们走吧。'
        }
      ],
      knownSpeakers: ['莉亚']
    });

    expect(logs).toEqual([
      { sender: '莉亚', text: '我看向你，轻声说：我们走吧。' }
    ]);
  });

  it('uses narrative fallback and still separates dialogue lines', () => {
    const logs = normalizeStoryResponseLogs({
      narrative: '风吹过空街。\n莉亚：在这边。\n脚步声逐渐靠近。',
      knownSpeakers: ['莉亚']
    });

    expect(logs).toEqual([
      { sender: '旁白', text: '风吹过空街。' },
      { sender: '莉亚', text: '在这边。' },
      { sender: '旁白', text: '脚步声逐渐靠近。' }
    ]);
  });

  it('does not treat metadata cue as character dialogue', () => {
    const logs = normalizeStoryResponseLogs({
      rawLogs: [
        {
          sender: '旁白',
          text: '时间：第1日 08:00，地点：公会大厅。'
        }
      ]
    });

    expect(logs).toEqual([
      { sender: '旁白', text: '时间：第1日 08:00，地点：公会大厅。' }
    ]);
  });
});

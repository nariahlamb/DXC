import { describe, expect, it } from 'vitest';
import { buildFactBoundary, formatFactBoundaryBlock } from '../../utils/memory/factBoundary';

describe('fact boundary projection', () => {
  it('projects known facts with source metadata', () => {
    const boundary = buildFactBoundary(
      [
        {
          回合: 18,
          时间: '第3日 14:30',
          时间跨度: '第3日 14:00-14:30',
          地点: '地下城第7层',
          摘要: 'Bell完成遭遇战',
          纪要: 'Bell击退哥布林并撤离',
          重要对话: 'Bell: 先撤再整备。',
          关键事件: ['遭遇哥布林', '撤离成功'],
          编码索引: 'AM0018'
        }
      ],
      [
        {
          章节: '第一卷',
          标题: '地下城试炼',
          开始回合: 15,
          结束回合: 20,
          时间跨度: '第3日',
          大纲: '完成第7层试炼并确认撤离路线。',
          事件列表: ['遭遇战', '撤离'],
          编码索引: 'AM0018'
        }
      ]
    );

    expect(boundary.knownFacts.length).toBeGreaterThan(0);
    expect(boundary.knownFacts[0].source).toContain('AM0018');
    expect(boundary.unknownSlots).toEqual(['当前关键槽位均有来源，可按已知事实推进。']);

    const block = formatFactBoundaryBlock(boundary);
    expect(block).toContain('[KNOWN_FACTS]');
    expect(block).toContain('[UNKNOWN_SLOTS]');
  });

  it('marks missing fields and index pairing gaps as unknown slots', () => {
    const boundary = buildFactBoundary(
      [
        {
          回合: 19,
          时间: '第3日 16:00',
          摘要: '与商人短暂交流',
          编码索引: 'AM0019'
        }
      ],
      []
    );

    expect(boundary.unknownSlots.some((item) => item.includes('章节大纲缺失'))).toBe(true);
    expect(boundary.unknownSlots.some((item) => item.includes('缺少地点字段'))).toBe(true);
    expect(boundary.unknownSlots.some((item) => item.includes('缺少重要对话字段'))).toBe(true);
    expect(boundary.unknownSlots.some((item) => item.includes('AM0019') && item.includes('缺少日志大纲'))).toBe(true);
  });
});


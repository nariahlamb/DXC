import { describe, expect, it } from 'vitest';
import { buildMemoryIndexProjection } from '../../utils/memory/memoryIndexProjection';
import { formatMemoryRetrievalBlock, retrieveMemoryByQuery } from '../../utils/memory/memoryRetriever';

describe('memory retriever', () => {
  it('retrieves paired AM entry by index and keywords', () => {
    const indexEntries = buildMemoryIndexProjection(
      [
        {
          回合: 12,
          时间: '第3日 18:00',
          时间跨度: '第3日 17:30-18:00',
          地点: '地下城第7层',
          摘要: '遭遇哥布林后撤离',
          纪要: 'Bell在第7层与哥布林交战并安全撤退',
          重要对话: 'Bell: 先离开再整备',
          编码索引: 'AM0012'
        },
        {
          回合: 11,
          时间: '第3日 17:00',
          摘要: '补给整理',
          编码索引: 'AM0011'
        }
      ],
      [
        {
          章节: '第一卷',
          标题: '第7层试炼',
          开始回合: 12,
          结束回合: 12,
          时间跨度: '第3日傍晚',
          大纲: '遭遇战后撤离，确认补给不足',
          事件列表: ['遭遇哥布林', '战术撤离'],
          编码索引: 'AM0012'
        }
      ]
    );

    const hits = retrieveMemoryByQuery(indexEntries, 'AM0012 地下城 哥布林', { topK: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].entry.amIndex).toBe('AM0012');
    expect(hits[0].entry.source).toBe('paired');

    const block = formatMemoryRetrievalBlock({
      query: 'AM0012 地下城 哥布林',
      hits,
      totalCandidates: indexEntries.length
    });
    expect(block).toContain('[记忆索引召回 (Memory Index Retrieval)]');
    expect(block).toContain('AM:AM0012');
  });

  it('applies source filter when retrieving', () => {
    const indexEntries = buildMemoryIndexProjection(
      [
        {
          回合: 20,
          时间: '第4日 10:00',
          地点: '公会大厅',
          摘要: '与公会窗口交涉补贴',
          编码索引: 'AM0020'
        }
      ],
      [
        {
          章节: '第二卷',
          标题: '补给周转',
          开始回合: 20,
          时间跨度: '第4日上午',
          大纲: '围绕眷族资金与补给效率展开',
          事件列表: ['资金盘点', '补给申请'],
          编码索引: 'AM0020'
        },
        {
          章节: '第二卷',
          标题: '远征准备',
          开始回合: 21,
          时间跨度: '第4日中午',
          大纲: '确认远征路线并分配队伍职责',
          事件列表: ['路线确认', '队伍分工']
        }
      ]
    );

    const hits = retrieveMemoryByQuery(indexEntries, '远征 路线', {
      topK: 5,
      sourceFilter: ['outline']
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.entry.source === 'outline')).toBe(true);
  });
});

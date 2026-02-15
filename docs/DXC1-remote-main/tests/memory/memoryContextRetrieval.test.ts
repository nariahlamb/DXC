import { describe, expect, it } from 'vitest';
import type { LogEntry, MemoryConfig, MemorySystem } from '../../types';
import { constructMemoryContext } from '../../utils/aiContext';
import { createNewGameState } from '../../utils/dataMapper';

const baseMemory: MemorySystem = {
  lastLogIndex: 0
};

const baseConfig: MemoryConfig = {
  instantLimit: 10
};

const baseLogs: LogEntry[] = [
  {
    id: 'log-1',
    sender: 'player',
    text: '继续调查第7层的哥布林营地',
    timestamp: Date.now(),
    turnIndex: 12,
    gameTime: '第3日 18:00'
  },
  {
    id: 'log-2',
    sender: 'ai',
    text: '你确认了营地外围的脚印分布。',
    timestamp: Date.now() + 1,
    turnIndex: 12,
    gameTime: '第3日 18:00'
  }
];

describe('constructMemoryContext retrieval integration', () => {
  it('injects TavernDB table retrieval block by default when gameState provided', () => {
    const gameState = createNewGameState('Tester', '男', 'Human') as any;
    gameState.日志摘要 = [
      {
        回合: 12,
        时间: '第3日 18:00',
        时间跨度: '第3日 17:30-18:00',
        地点: '地下城第7层',
        摘要: '遭遇战后撤退整备',
        纪要: 'Bell确认哥布林营地并组织撤退',
        编码索引: 'AM0012'
      }
    ];
    gameState.日志大纲 = [
      {
        章节: '第一卷',
        标题: '第7层试炼',
        开始回合: 12,
        时间跨度: '第3日晚',
        大纲: '侦察哥布林营地并撤离',
        事件列表: ['侦察', '撤离'],
        编码索引: 'AM0012'
      }
    ];

    const context = constructMemoryContext(
      baseMemory,
      baseLogs,
      baseConfig,
      {
        retrievalQuery: 'AM0012 哥布林 第7层',
        enableFactBoundary: false,
        enableMemoryRetrieval: true
      },
      gameState.日志摘要,
      gameState.日志大纲,
      gameState
    );

    expect(context).toContain('[表格记忆召回 (TavernDB Retrieval)]');
    expect(context).toContain('[记忆索引召回 (Memory Index Retrieval)]');
    expect(context).toContain('LOG_Summary#1');
    expect(context).not.toContain('【剧情大纲 (Story Outline)】');
  });

  it('does not fallback to legacy retrieval even when legacy flag is set', () => {
    const gameState = createNewGameState('Tester', '男', 'Human') as any;
    gameState.__tableRows = {
      LOG_Summary: [
        {
          时间跨度: '第3日 17:30-18:00',
          地点: '地下城第7层',
          纪要: 'Bell确认哥布林营地并组织撤退',
          重要对话: '',
          编码索引: 'AM0012'
        }
      ]
    };

    const context = constructMemoryContext(
      baseMemory,
      baseLogs,
      baseConfig,
      {
        retrievalQuery: 'AM0012',
        enableFactBoundary: false,
        enableMemoryRetrieval: true,
        enableIndexRetrieval: false,
        useLegacyMemoryDump: true
      },
      [
        {
          回合: 12,
          时间: '第3日 18:00',
          摘要: '遭遇战后撤退整备',
          编码索引: 'AM0012'
        }
      ],
      [
        {
          章节: '第一卷',
          标题: '第7层试炼',
          开始回合: 12,
          事件列表: ['侦察', '撤离'],
          编码索引: 'AM0012'
        }
      ],
      gameState
    );

    expect(context).toContain('[表格记忆召回 (TavernDB Retrieval)]');
    expect(context).not.toContain('【剧情大纲 (Story Outline)】');
    expect(context).not.toContain('【过往摘要 (Log Summaries)】');
    expect(context).not.toContain('[记忆索引召回 (Memory Index Retrieval)]');
  });

  it('supports index source filter when building memory context', () => {
    const gameState = createNewGameState('Tester', '男', 'Human') as any;
    gameState.日志摘要 = [
      {
        回合: 20,
        时间: '第4日 10:00',
        时间跨度: '第4日 上午',
        地点: '公会大厅',
        摘要: '与公会窗口交涉补给',
        编码索引: 'AM0020'
      }
    ];
    gameState.日志大纲 = [
      {
        章节: '第二卷',
        标题: '补给周转',
        开始回合: 20,
        时间跨度: '第4日 上午',
        大纲: '围绕补给和路线制定行动计划',
        事件列表: ['补给申请', '路线确认']
      }
    ];

    const context = constructMemoryContext(
      baseMemory,
      baseLogs,
      baseConfig,
      {
        retrievalQuery: '路线 补给',
        enableFactBoundary: false,
        enableMemoryRetrieval: true,
        enableTableRetrieval: false,
        indexSourceFilter: ['outline']
      },
      gameState.日志摘要,
      gameState.日志大纲,
      gameState
    );

    expect(context).toContain('[记忆索引召回 (Memory Index Retrieval)]');
    expect(context).toContain('source:outline');
    expect(context).not.toContain('source:paired');
  });
});

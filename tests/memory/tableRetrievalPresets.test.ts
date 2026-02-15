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
    text: '查看论坛里的线索',
    timestamp: Date.now(),
    turnIndex: 3,
    gameTime: '第1日 07:30'
  }
];

describe('table retrieval presets', () => {
  const buildStateWithForumData = () => {
    const gameState = createNewGameState('Tester', '男', 'Human') as any;
    gameState.手机 = {
      ...(gameState.手机 || {}),
      公共帖子: {
        板块: [{ id: 'board_news', 名称: '欧拉丽快报' }],
        帖子: [
          {
            id: 'Forum_001',
            标题: '论坛线索',
            内容: '神秘论坛测试帖，提到南大街与公会动向',
            发布者: '匿名冒险者',
            时间戳: '第1日 07:25',
            板块: '欧拉丽快报',
            点赞数: 12,
            回复: []
          }
        ]
      }
    };
    return gameState;
  };

  it('includes forum rows in phone retrieval mode', () => {
    const gameState = buildStateWithForumData();
    const context = constructMemoryContext(
      baseMemory,
      baseLogs,
      baseConfig,
      {
        retrievalQuery: '论坛 线索 南大街',
        enableFactBoundary: false,
        enableMemoryRetrieval: true,
        retrievalMode: 'phone'
      },
      gameState.日志摘要,
      gameState.日志大纲,
      gameState
    );

    expect(context).toContain('[表格记忆召回 (TavernDB Retrieval)]');
    expect(context).toContain('FORUM_Posts');
  });

  it('filters out forum rows in action retrieval mode', () => {
    const gameState = buildStateWithForumData();
    const context = constructMemoryContext(
      baseMemory,
      baseLogs,
      baseConfig,
      {
        retrievalQuery: '论坛 线索 南大街',
        enableFactBoundary: false,
        enableMemoryRetrieval: true,
        retrievalMode: 'action'
      },
      gameState.日志摘要,
      gameState.日志大纲,
      gameState
    );

    expect(context).toContain('[表格记忆召回 (TavernDB Retrieval)]');
    expect(context).not.toContain('FORUM_Posts');
  });
});

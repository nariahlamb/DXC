import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry, MemoryConfig, MemorySystem } from '../../types';

const {
  projectGameStateToTavernTablesSpy,
  buildTavernTableSearchRowsSpy,
  buildMemoryIndexProjectionSpy
} = vi.hoisted(() => ({
  projectGameStateToTavernTablesSpy: vi.fn(),
  buildTavernTableSearchRowsSpy: vi.fn(),
  buildMemoryIndexProjectionSpy: vi.fn()
}));

vi.mock('../../utils/taverndb/tableProjection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/taverndb/tableProjection')>();
  projectGameStateToTavernTablesSpy.mockImplementation((...args: any[]) => (actual.projectGameStateToTavernTables as any)(...args));
  buildTavernTableSearchRowsSpy.mockImplementation((...args: any[]) => (actual.buildTavernTableSearchRows as any)(...args));
  return {
    ...actual,
    projectGameStateToTavernTables: (...args: any[]) => projectGameStateToTavernTablesSpy(...args),
    buildTavernTableSearchRows: (...args: any[]) => buildTavernTableSearchRowsSpy(...args)
  };
});

vi.mock('../../utils/memory/memoryIndexProjection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/memory/memoryIndexProjection')>();
  buildMemoryIndexProjectionSpy.mockImplementation((...args: any[]) => actual.buildMemoryIndexProjection(...args));
  return {
    ...actual,
    buildMemoryIndexProjection: (...args: any[]) => buildMemoryIndexProjectionSpy(...args)
  };
});

import { constructMemoryContext, markMemoryContextRetrievalDirty } from '../../utils/aiContext';
import { createNewGameState } from '../../utils/dataMapper';

const baseMemory: MemorySystem = { lastLogIndex: 0 };
const baseConfig: MemoryConfig = { instantLimit: 10 };
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

const makeState = () => {
  const state = createNewGameState('Tester', '男', 'Human') as any;
  state.日志摘要 = [
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
  state.日志大纲 = [
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
  return state;
};

describe('constructMemoryContext retrieval cache', () => {
  beforeEach(() => {
    projectGameStateToTavernTablesSpy.mockClear();
    buildTavernTableSearchRowsSpy.mockClear();
    buildMemoryIndexProjectionSpy.mockClear();
    markMemoryContextRetrievalDirty();
  });

  it('reuses projection cache on repeated call with same inputs', () => {
    const gameState = makeState();
    const params = {
      retrievalQuery: 'AM0012 哥布林 第7层',
      enableFactBoundary: false,
      enableMemoryRetrieval: true
    };

    constructMemoryContext(baseMemory, baseLogs, baseConfig, params, gameState.日志摘要, gameState.日志大纲, gameState);
    constructMemoryContext(baseMemory, baseLogs, baseConfig, params, gameState.日志摘要, gameState.日志大纲, gameState);

    expect(projectGameStateToTavernTablesSpy).toHaveBeenCalledTimes(1);
    expect(buildTavernTableSearchRowsSpy).toHaveBeenCalledTimes(1);
    expect(buildMemoryIndexProjectionSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps projection cache when query changes but source data is unchanged', () => {
    const gameState = makeState();

    constructMemoryContext(
      baseMemory,
      baseLogs,
      baseConfig,
      { retrievalQuery: 'AM0012', enableFactBoundary: false, enableMemoryRetrieval: true },
      gameState.日志摘要,
      gameState.日志大纲,
      gameState
    );

    constructMemoryContext(
      baseMemory,
      baseLogs,
      baseConfig,
      { retrievalQuery: '哥布林 撤离', enableFactBoundary: false, enableMemoryRetrieval: true },
      gameState.日志摘要,
      gameState.日志大纲,
      gameState
    );

    expect(projectGameStateToTavernTablesSpy).toHaveBeenCalledTimes(1);
    expect(buildTavernTableSearchRowsSpy).toHaveBeenCalledTimes(1);
    expect(buildMemoryIndexProjectionSpy).toHaveBeenCalledTimes(1);
  });

  it('rebuilds cache after dirty marker update', () => {
    const gameState = makeState();
    const params = {
      retrievalQuery: 'AM0012 哥布林 第7层',
      enableFactBoundary: false,
      enableMemoryRetrieval: true
    };

    constructMemoryContext(baseMemory, baseLogs, baseConfig, params, gameState.日志摘要, gameState.日志大纲, gameState);
    markMemoryContextRetrievalDirty();
    constructMemoryContext(baseMemory, baseLogs, baseConfig, params, gameState.日志摘要, gameState.日志大纲, gameState);

    expect(projectGameStateToTavernTablesSpy).toHaveBeenCalledTimes(2);
    expect(buildTavernTableSearchRowsSpy).toHaveBeenCalledTimes(2);
    expect(buildMemoryIndexProjectionSpy).toHaveBeenCalledTimes(2);
  });
});

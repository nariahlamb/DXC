import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameLogic } from '../../hooks/useGameLogic';
import { createNewGameState } from '../../utils/dataMapper';

vi.mock('../../utils/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/ai')>();
  return {
    ...actual,
    generateDungeonMasterResponse: vi.fn(),
    generatePhoneResponse: vi.fn(),
    generateWorldInfoResponse: vi.fn(),
    generateServiceCommands: vi.fn(),
    dispatchAIRequest: vi.fn()
  };
});

const {
  generateDungeonMasterResponse,
  dispatchAIRequest,
  generateServiceCommands
} = await import('../../utils/ai');

describe('AM recall prelude sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (generateServiceCommands as any).mockResolvedValue({
      tavern_commands: [],
      rawResponse: '{"tavern_commands":[]}'
    });
    (dispatchAIRequest as any).mockResolvedValue(
      JSON.stringify({
        items: [
          {
            编码索引: 'AM14',
            时间跨度: '1000-01-01 07:00—1000-01-01 07:10',
            地点: '欧拉丽-南大街',
            纪要: '目标在街口观察并与路人短暂交流。',
            大纲: '主角完成街口信息收集。',
            来源: 'memory-api',
            thinking_pre: 'should not leak',
            action_options: ['A', 'B'],
            phone_sync_plan: { note: 'no leak' },
            logs: [{ sender: 'x', text: 'no leak' }]
          }
        ]
      })
    );
    (generateDungeonMasterResponse as any).mockResolvedValue({
      logs: [{ sender: '旁白', text: '已根据记忆继续叙事。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
  });

  it('injects fixed AM block and keeps noise fields out of model input', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.日志摘要 = [
      {
        回合: 1,
        时间: '1000-01-01 07:10',
        时间跨度: '1000-01-01 07:00—1000-01-01 07:10',
        地点: '欧拉丽-南大街',
        纪要: '目标在街口观察并与路人短暂交流。',
        编码索引: 'AM0014'
      }
    ];
    state.日志大纲 = [
      {
        章节: '第一章',
        标题: '街口观察',
        开始回合: 1,
        时间跨度: '1000-01-01 07:00—1000-01-01 07:10',
        大纲: '主角完成街口信息收集。',
        事件列表: ['街口观察'],
        编码索引: 'AM0014'
      }
    ];

    const { result } = renderHook(() => useGameLogic(state));

    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: {
              ...prev.aiConfig.services.state,
              apiKey: 'test-memory-key',
              modelId: 'gemini-3-flash-preview'
            }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('请参考 AM14 继续推进', 'ACTION', [], undefined, true);
    });

    expect(generateDungeonMasterResponse).toHaveBeenCalled();
    const modelInput = String((generateDungeonMasterResponse as any).mock.calls[0]?.[0] || '');
    expect(modelInput).toContain('[叙事前固定注入]');
    expect(modelInput).toContain('AM=AM0014');
    expect(modelInput).toContain('[AM召回来源] memory-api');
    expect(modelInput).not.toContain('thinking_pre');
    expect(modelInput).not.toContain('action_options');
    expect(modelInput).not.toContain('phone_sync_plan');
    expect(modelInput).not.toContain('"logs"');
  });
});

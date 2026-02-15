import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameLogic } from '../../hooks/useGameLogic';
import { createNewGameState } from '../../utils/dataMapper';

vi.mock('../../utils/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/ai')>();
  return {
    ...actual,
    generateDungeonMasterResponse: vi.fn()
  };
});

const { generateDungeonMasterResponse } = await import('../../utils/ai');

describe('log pairing guard in command flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps NPC sender when name collides with reserved aliases', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: 'System', text: '我是 NPC，不是系统消息。' }],
      tavern_commands: [],
      rawResponse: '{\"ok\":true}'
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.社交 = [...(state.社交 || []), { 姓名: 'System' }];
    state.日志摘要 = [];
    state.日志大纲 = [];

    const { result } = renderHook(() => useGameLogic(state));

    await act(async () => {
      await result.current.handleAIInteraction('测试输入3', 'ACTION', [], undefined, true);
      await Promise.resolve();
    });

    const npcLog = (result.current.gameState.日志 || []).find((log: any) =>
      String(log?.text || '').includes('我是 NPC，不是系统消息。')
    );
    expect(npcLog).toBeTruthy();
    expect(npcLog.sender).toBe('System');
  });

  it('rolls back when only indexed summary is provided', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '测试叙事' }],
      tavern_commands: [
        {
          action: 'append_log_summary',
          key: 'gameState.日志摘要',
          value: {
            回合: 1,
            时间: '第1日 08:00',
            摘要: '仅写入摘要',
            编码索引: 'AM0001'
          }
        }
      ],
      rawResponse: '{"ok":true}'
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.日志摘要 = [];
    state.日志大纲 = [];

    const { result } = renderHook(() => useGameLogic(state));

    await act(async () => {
      await result.current.handleAIInteraction('测试输入', 'ACTION', [], undefined, true);
      await Promise.resolve();
    });

    const summaries = result.current.gameState.日志摘要 || [];
    const outlines = result.current.gameState.日志大纲 || [];
    expect(summaries.length).toBe(0);
    expect(outlines.length).toBe(0);
    const systemTexts = (result.current.gameState.日志 || []).map((log: any) => String(log?.text || ''));
    expect(systemTexts.some((text: string) => text.includes('日志配对校验失败'))).toBe(true);
    expect(systemTexts.some((text: string) => text.includes('回合事务回滚'))).toBe(true);
    expect(generateDungeonMasterResponse).toHaveBeenCalledTimes(1);
  });

  it('keeps paired summary and outline and auto-assigns AM index', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '测试叙事' }],
      tavern_commands: [
        {
          action: 'append_log_summary',
          key: 'gameState.日志摘要',
          value: {
            回合: 2,
            时间: '第1日 09:00',
            摘要: '摘要与大纲配对写入'
          }
        },
        {
          action: 'append_log_outline',
          key: 'gameState.日志大纲',
          value: {
            章节: '第一卷',
            标题: '配对测试',
            开始回合: 2,
            事件列表: ['配对写入']
          }
        }
      ],
      rawResponse: '{"ok":true}'
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.日志摘要 = [];
    state.日志大纲 = [];

    const { result } = renderHook(() => useGameLogic(state));

    await act(async () => {
      await result.current.handleAIInteraction('测试输入2', 'ACTION', [], undefined, true);
      await Promise.resolve();
    });

    const summaries = result.current.gameState.日志摘要 || [];
    const outlines = result.current.gameState.日志大纲 || [];
    expect(summaries.length).toBe(1);
    expect(outlines.length).toBe(1);
    expect(String(summaries[0].编码索引 || '')).toMatch(/^AM\d{4,}$/);
    expect(outlines[0].编码索引).toBe(summaries[0].编码索引);
  });
});

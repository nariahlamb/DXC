import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameLogic } from '../../hooks/useGameLogic';
import { createNewGameState } from '../../utils/dataMapper';

vi.mock('../../utils/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/ai')>();
  return {
    ...actual,
    generateDungeonMasterResponse: vi.fn(),
    generateServiceCommands: vi.fn()
  };
});

const { generateDungeonMasterResponse, generateServiceCommands } = await import('../../utils/ai');

describe('memory log pair rollback guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (generateServiceCommands as any).mockResolvedValue({
      tavern_commands: [],
      rawResponse: '{"tavern_commands":[]}'
    });
  });

  it('rolls back when only append_log_summary is produced', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '测试叙事' }],
      tavern_commands: [
        {
          action: 'append_log_summary',
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
    });

    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBe(0);
      expect((result.current.gameState.日志大纲 || []).length).toBe(0);
      const texts = (result.current.gameState.日志 || []).map((log: any) => String(log?.text || ''));
      expect(texts.some((text: string) => text.includes('日志配对校验失败'))).toBe(true);
      expect(texts.some((text: string) => text.includes('回合事务回滚'))).toBe(true);
      expect(texts.some((text: string) => text.includes('自动补全'))).toBe(false);
    });
  });

  it('rolls back when only append_log_outline is produced', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '测试叙事2' }],
      tavern_commands: [
        {
          action: 'append_log_outline',
          value: {
            章节: '第一章',
            标题: '仅大纲',
            开始回合: 1,
            大纲: '只有大纲没有摘要',
            事件列表: ['仅大纲'],
            编码索引: 'AM0002'
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
    });

    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBe(0);
      expect((result.current.gameState.日志大纲 || []).length).toBe(0);
      const texts = (result.current.gameState.日志 || []).map((log: any) => String(log?.text || ''));
      expect(texts.some((text: string) => text.includes('日志配对校验失败'))).toBe(true);
      expect(texts.some((text: string) => text.includes('回合事务回滚'))).toBe(true);
      expect(texts.some((text: string) => text.includes('自动补全'))).toBe(false);
    });
  });
});

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

describe('memory boundary guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (generateServiceCommands as any).mockResolvedValue({
      tavern_commands: [],
      rawResponse: '{"tavern_commands":[]}'
    });
  });

  const configureSeparateMemoryMode = (result: any) => {
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
  };

  it('hard-blocks story append_log_* writes and emits MEM_BOUNDARY_001', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '主叙事完成。' }],
      tavern_commands: [
        {
          action: 'append_log_summary',
          value: { 回合: 1, 时间: '第1日 07:00', 摘要: '主AI摘要' }
        },
        {
          action: 'append_log_outline',
          value: { 章节: '第一章', 标题: '主AI标题', 开始回合: 1, 事件列表: ['主AI事件'] }
        }
      ],
      rawResponse: '{"ok":true}'
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const baselineSummaryLen = (state.日志摘要 || []).length;
    const baselineOutlineLen = (state.日志大纲 || []).length;
    const { result } = renderHook(() => useGameLogic(state));
    configureSeparateMemoryMode(result);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect((generateServiceCommands as any).mock.calls.some((args: any[]) => args[0] === 'memory')).toBe(true);
    });
    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBe(baselineSummaryLen);
      expect((result.current.gameState.日志大纲 || []).length).toBe(baselineOutlineLen);
      const summaryTexts = (result.current.gameState.日志摘要 || []).map((row: any) => String(row?.摘要 || ''));
      const outlineTexts = (result.current.gameState.日志大纲 || []).map((row: any) => String(row?.大纲 || ''));
      expect(summaryTexts.some((text: string) => text.includes('主AI摘要'))).toBe(false);
      expect(outlineTexts.some((text: string) => text.includes('主AI标题'))).toBe(false);
    });
  });

  it('removes LOG_* rows from mixed upsert payload while keeping non-log updates', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你抵达公会并完成登记。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          value: [
            {
              sheetId: 'SYS_GlobalState',
              keyField: '当前回合',
              rows: [{ 当前回合: 1, 当前场景: '公会本部', 游戏时间: '第1日 07:10' }]
            },
            {
              sheetId: 'LOG_Summary',
              rows: [{ 回合: 1, 时间: '第1日 07:10', 摘要: '主AI日志摘要' }]
            },
            {
              sheetId: 'LOG_Outline',
              rows: [{ 章节: '第一章', 标题: '主AI日志大纲', 开始回合: 1, 事件列表: ['登记'] }]
            }
          ]
        }
      ],
      rawResponse: '{"ok":true}'
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const baselineSummaryLen = (state.日志摘要 || []).length;
    const baselineOutlineLen = (state.日志大纲 || []).length;
    const { result } = renderHook(() => useGameLogic(state));
    configureSeparateMemoryMode(result);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBe(baselineSummaryLen);
      expect((result.current.gameState.日志大纲 || []).length).toBe(baselineOutlineLen);
      const summaryTexts = (result.current.gameState.日志摘要 || []).map((row: any) => String(row?.摘要 || ''));
      const outlineTexts = (result.current.gameState.日志大纲 || []).map((row: any) => String(row?.大纲 || ''));
      expect(summaryTexts.some((text: string) => text.includes('主AI日志摘要'))).toBe(false);
      expect(outlineTexts.some((text: string) => text.includes('主AI日志大纲'))).toBe(false);
    });
  });
});

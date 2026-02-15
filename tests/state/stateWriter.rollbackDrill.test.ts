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

describe('state writer rollback drill', () => {
  beforeEach(() => {
    (generateDungeonMasterResponse as any).mockReset();
    (generateServiceCommands as any).mockReset();
  });

  it('restores non-cutover write path when writer is disabled', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你回到酒馆。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey === 'state') {
        return {
          tavern_commands: [{
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'SYS_GlobalState',
              keyField: '_global_id',
              rows: [{ _global_id: 'GLOBAL_STATE', 当前场景: '丰饶的女主人', 游戏时间: '第1日 09:10' }]
            }
          }],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            { action: 'append_log_summary', value: { 回合: 1, 时间: '第1日 09:10', 摘要: '回到酒馆。' } },
            { action: 'append_log_outline', value: { 章节: '1', 标题: '酒馆回合', 开始回合: 1, 事件列表: ['回到酒馆'] } }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderHook(() => useGameLogic(state));
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: { ...prev.aiConfig.services.state, apiKey: 'state-key' },
            memory: { ...prev.aiConfig.services.memory, apiKey: 'memory-key' }
          }
        },
        stateVarWriter: {
          enabled: false,
          shadowMode: false,
          cutoverDomains: ['global_state'],
          rejectNonWriterForCutoverDomains: true
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.当前地点).toBe('丰饶的女主人');
      expect(result.current.gameState.游戏时间).toBe('第1日 09:10');
      const sourceNotAllowed = Number((result.current.gameState as any)?.__tableMeta?.conflictStats?.byReason?.source_not_allowed || 0);
      expect(sourceNotAllowed).toBe(0);
    });
  });
});

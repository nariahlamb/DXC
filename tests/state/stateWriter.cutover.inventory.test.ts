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

describe('state writer cutover - inventory', () => {
  beforeEach(() => {
    (generateDungeonMasterResponse as any).mockReset();
    (generateServiceCommands as any).mockReset();
  });

  it('applies inventory writes through writer cutover domains', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在店里买了一瓶药水。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string, input?: string) => {
      if (serviceKey === 'state') {
        const requiredSheets: string[] = (() => {
          try {
            return JSON.parse(String(input || ''))?.填表任务?.requiredSheets || [];
          } catch {
            return [];
          }
        })();
        if (!requiredSheets.includes('ITEM_Inventory')) {
          return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
        }
        return {
          tavern_commands: [{
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'ITEM_Inventory',
              keyField: '物品ID',
              rows: [{ 物品ID: 'itm_potion', 物品名称: '药水', 数量: 1 }]
            }
          }],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            { action: 'append_log_summary', value: { 回合: 1, 时间: '第1日 08:45', 摘要: '购买药水。' } },
            { action: 'append_log_outline', value: { 章节: '1', 标题: '商店采购', 开始回合: 1, 事件列表: ['购买药水'] } }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.背包 = [];
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
          enabled: true,
          shadowMode: false,
          cutoverDomains: ['inventory'],
          rejectNonWriterForCutoverDomains: true
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const bag = Array.isArray(result.current.gameState?.背包) ? result.current.gameState.背包 : [];
      expect(bag.some((item: any) => String(item?.物品ID || item?.id || '') === 'itm_potion')).toBe(true);
      const sourceNotAllowed = Number((result.current.gameState as any)?.__tableMeta?.conflictStats?.byReason?.source_not_allowed || 0);
      expect(sourceNotAllowed).toBe(0);
    });
  });
});

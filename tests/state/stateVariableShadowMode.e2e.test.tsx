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

describe('state variable writer shadow mode e2e', () => {
  beforeEach(() => {
    (generateDungeonMasterResponse as any).mockReset();
    (generateServiceCommands as any).mockReset();
  });

  it('writes shadow metrics for three pilot domains without changing business path ownership', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你整理背包后前往公会大厅。' }],
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
        const commands: any[] = [];
        if (requiredSheets.includes('SYS_GlobalState')) {
          commands.push({
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'SYS_GlobalState',
              keyField: '_global_id',
              rows: [{ _global_id: 'GLOBAL_STATE', 当前场景: '公会大厅', 游戏时间: '第1日 07:35' }]
            }
          });
        }
        if (requiredSheets.includes('CHARACTER_Resources')) {
          commands.push({
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'CHARACTER_Resources',
              keyField: 'CHAR_ID',
              rows: [{ CHAR_ID: 'PLAYER', 法利: 1500 }]
            }
          });
        }
        if (requiredSheets.includes('ITEM_Inventory')) {
          commands.push({
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'ITEM_Inventory',
              keyField: '物品ID',
              rows: [{ 物品ID: 'itm_001', 物品名称: '短剑', 数量: 2 }]
            }
          });
        }
        return { tavern_commands: commands, rawResponse: '{"tavern_commands":[]}' };
      }
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            { action: 'append_log_summary', value: { 回合: 1, 时间: '第1日 07:35', 摘要: '整理背包后前往公会大厅。' } },
            { action: 'append_log_outline', value: { 章节: '1', 标题: '整备', 开始回合: 1, 事件列表: ['整理背包', '前往公会'] } }
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
            state: { ...prev.aiConfig.services.state, apiKey: 'state-key', modelId: 'state-model' },
            memory: { ...prev.aiConfig.services.memory, apiKey: 'memory-key', modelId: 'memory-model' }
          }
        },
        stateVarWriter: {
          ...prev.stateVarWriter,
          enabled: false,
          shadowMode: true
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const shadow = (result.current.gameState as any).__stateVarWriterShadow;
      expect(shadow).toBeDefined();
      expect(Number(shadow?.eventCount || 0)).toBeGreaterThan(0);
      expect(Number(shadow?.commandCount || 0)).toBeGreaterThan(0);
      expect(result.current.gameState.游戏时间).toBe('第1日 07:35');
    });
  });
});

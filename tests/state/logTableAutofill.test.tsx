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

const renderGameLogic = (state: any, serviceOverrides: Record<string, any> = {}) => {
  const hook = renderHook(() => useGameLogic(state));
  act(() => {
    hook.result.current.setSettings((prev: any) => ({
      ...prev,
      aiConfig: {
        ...prev.aiConfig,
        services: {
          ...prev.aiConfig.services,
          state: { ...prev.aiConfig.services.state, apiKey: 'test-state-key', modelId: 'state-model' },
          memory: { ...prev.aiConfig.services.memory, apiKey: 'test-memory-key', modelId: 'memory-model' },
          map: { ...prev.aiConfig.services.map, apiKey: 'test-map-key', modelId: 'map-model' },
          story: { ...prev.aiConfig.services.story, apiKey: 'test-story-key', modelId: 'story-model' },
          ...serviceOverrides
        }
      }
    }));
  });
  return hook;
};

describe('memory service log table fill', () => {
  beforeEach(() => {
    (generateDungeonMasterResponse as any).mockReset();
    (generateServiceCommands as any).mockReset();
  });

  it('fills summary/outline via memory microservice after narrative turn', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在公会大厅确认了下一步目标。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            {
              action: 'append_log_summary',
              value: {
                回合: 1,
                时间: '第1日 07:00',
                摘要: '你在公会大厅确认了下一步目标。'
              }
            },
            {
              action: 'append_log_outline',
              value: {
                章节: '第一章',
                标题: '公会确认',
                开始回合: 1,
                事件列表: ['确认目标']
              }
            }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
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
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });
    await waitFor(() => {
      expect(generateServiceCommands).toHaveBeenCalled();
      expect((generateServiceCommands as any).mock.calls.some((args: any[]) => args[0] === 'memory')).toBe(true);
    });
    const memoryCall = (generateServiceCommands as any).mock.calls.find((args: any[]) => args[0] === 'memory');
    expect(String(memoryCall?.[1] || '')).toContain('"待填回合"');
    expect(String(memoryCall?.[1] || '')).toContain('"mode": "async-batch"');
    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBeGreaterThan(0);
      expect((result.current.gameState.日志大纲 || []).length).toBeGreaterThan(0);
    });

    const summaryIndex = result.current.gameState.日志摘要?.at(-1)?.编码索引;
    const outlineIndex = result.current.gameState.日志大纲?.at(-1)?.编码索引;
    expect(String(summaryIndex || '')).toMatch(/^AM\d{4}$/);
    expect(outlineIndex).toBe(summaryIndex);
  });

  it('injects combat resolution snippets into memory fill payload', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你挥剑逼退了敌人。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey === 'memory') {
        return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.战斗 = {
      是否战斗中: true,
      敌方: [],
      战斗记录: [],
      判定事件: [
        {
          id: 'evt_turn_1',
          回合: 1,
          行动者: 'Tester',
          目标: '哥布林斥候',
          动作: '长剑斩击',
          是否成功: true,
          伤害: 6,
          结果: '命中并造成 6 点伤害',
          标签: ['attack_check']
        }
      ]
    };
    const { result } = renderGameLogic(state);
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
      await result.current.handleAIInteraction('我挥剑反击', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const memoryCalls = (generateServiceCommands as any).mock.calls.filter((args: any[]) => args[0] === 'memory');
      expect(memoryCalls.length).toBeGreaterThan(0);
    });

    const memoryCall = (generateServiceCommands as any).mock.calls.find((args: any[]) => args[0] === 'memory');
    const memoryInput = String(memoryCall?.[1] || '');
    expect(memoryInput).toContain('"本回合战斗事件"');
    expect(memoryInput).toContain('长剑斩击');
    expect(memoryInput).toContain('"伤害": 6');
  });

  it('uses single-request memory fill by default', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在公会门口整理装备。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey !== 'memory') {
        return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
      }
      return {
        tavern_commands: [
          {
            action: 'append_log_summary',
            value: {
              回合: 1,
              时间: '第1日 07:03',
              时间跨度: '1000-01-01 07:00—1000-01-01 07:03',
              地点: '公会门口',
              纪要: '主角在公会门口检查装备与补给，确认行囊状态后准备继续推进。',
              重要对话: '旁白：装备检查完毕。',
              编码索引: 'AM0001'
            }
          },
          {
            action: 'append_log_outline',
            value: {
              章节: '第一章',
              标题: '出发整备',
              开始回合: 1,
              时间跨度: '1000-01-01 07:00—1000-01-01 07:03',
              大纲: '主角完成出发前整备并继续推进。',
              事件列表: ['检查装备', '确认补给', '继续推进'],
              编码索引: 'AM0001'
            }
          }
        ],
        rawResponse: '{"tavern_commands":[]}'
      };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
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
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBeGreaterThan(0);
      expect((result.current.gameState.日志大纲 || []).length).toBeGreaterThan(0);
    });

    const memoryCalls = (generateServiceCommands as any).mock.calls.filter((args: any[]) => args[0] === 'memory');
    expect(memoryCalls.length).toBeGreaterThanOrEqual(1);
    expect(memoryCalls.some((args: any[]) => String(args?.[1] || '').includes('"parallelBySheet": false'))).toBe(true);
    expect(memoryCalls.some((args: any[]) => String(args?.[1] || '').includes('"targetSheet"'))).toBe(false);
  });

  it('can enable parallel-by-sheet memory fill via memoryConfig', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在街口停下观察后继续前进。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string, input?: string) => {
      if (serviceKey !== 'memory') {
        return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
      }
      const isOutline = String(input || '').includes('"targetSheet": "LOG_Outline"');
      const isSummary = String(input || '').includes('"targetSheet": "LOG_Summary"');
      const summaryCommand = {
        action: 'append_log_summary',
        value: {
          回合: 1,
          时间: '第1日 07:08',
          时间跨度: '1000-01-01 07:05—1000-01-01 07:08',
          地点: '欧拉丽南大街',
          纪要: '主角在街口短暂停步观察行人与摊位变化，确认周边动态后继续前进。',
          重要对话: '旁白：周边状况稳定。',
          编码索引: 'AM0001'
        }
      };
      const outlineCommand = {
        action: 'append_log_outline',
        value: {
          章节: '第一章',
          标题: '街口观察',
          开始回合: 1,
          时间跨度: '1000-01-01 07:05—1000-01-01 07:08',
          大纲: '主角结束观察后转向公会方向推进。',
          事件列表: ['观察', '转向公会', '推进'],
          编码索引: 'AM0001'
        }
      };
      const commands = isSummary ? [summaryCommand] : (isOutline ? [outlineCommand] : [summaryCommand, outlineCommand]);
      return {
        tavern_commands: commands,
        rawResponse: '{"tavern_commands":[]}'
      };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        memoryConfig: {
          ...prev.memoryConfig,
          memoryParallelBySheet: true
        },
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
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBeGreaterThan(0);
      expect((result.current.gameState.日志大纲 || []).length).toBeGreaterThan(0);
    });

    const memoryCalls = (generateServiceCommands as any).mock.calls.filter((args: any[]) => args[0] === 'memory');
    expect(memoryCalls.length).toBeGreaterThanOrEqual(2);
    expect(memoryCalls.some((args: any[]) => String(args?.[1] || '').includes('"targetSheet": "LOG_Summary"'))).toBe(true);
    expect(memoryCalls.some((args: any[]) => String(args?.[1] || '').includes('"targetSheet": "LOG_Outline"'))).toBe(true);
  });

  it('accepts array-shaped upsert_sheet_rows from memory service and still writes paired logs', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在街口短暂停留。' }],
      tavern_commands: [],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            {
              action: 'upsert_sheet_rows',
              value: [
                {
                  sheetId: 'LOG_Summary',
                  rows: [
                    {
                      回合: 1,
                      时间: '1000-01-01 07:00',
                      时间跨度: '1000-01-01 06:55—1000-01-01 07:00',
                      地点: '欧拉丽南大街',
                      摘要: '你在街口短暂停留并观察周围。'
                    }
                  ]
                }
              ]
            },
            {
              action: 'upsert_sheet_rows',
              value: [
                {
                  sheetId: 'LOG_Outline',
                  rows: [
                    {
                      章节: '第一章',
                      标题: '街口观察',
                      开始回合: 1,
                      时间跨度: '1000-01-01 06:55—1000-01-01 07:00',
                      大纲: '主角在街口短暂停留并观察周围环境。',
                      事件列表: ['短暂停留', '观察周围']
                    }
                  ]
                }
              ]
            }
          ],
          rawResponse: '{\"tavern_commands\":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
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
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const summaryRows = result.current.gameState.日志摘要 || [];
      const outlineRows = result.current.gameState.日志大纲 || [];
      expect(summaryRows.length).toBeGreaterThan(0);
      expect(outlineRows.length).toBeGreaterThan(0);
      expect(String(summaryRows.at(-1)?.摘要 || '')).toContain('街口短暂停留');
      expect(String(outlineRows.at(-1)?.标题 || '')).toBe('街口观察');
      const summaryIndex = String(summaryRows.at(-1)?.编码索引 || '').trim();
      const outlineIndex = String(outlineRows.at(-1)?.编码索引 || '').trim();
      if (summaryIndex || outlineIndex) {
        expect(summaryIndex).toMatch(/^AM\d{4}$/);
        expect(outlineIndex).toBe(summaryIndex);
      }
    });
  });

  it('accepts snake_case sheet payload aliases from memory service', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在黄昏的街道上记录了今天的见闻。' }],
      tavern_commands: [],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            {
              action: 'upsert_sheet_rows',
              value: {
                sheet_id: 'LOG_Summary',
                key_field: '编码索引',
                rows: [
                  {
                    回合: 1,
                    时间: '1000-01-01 07:40',
                    时间跨度: '1000-01-01 07:30—1000-01-01 07:40',
                    地点: '欧拉丽南大街',
                    纪要: '主角在街道上停留并记录本轮见闻，整理了关键信息。',
                    重要对话: '旁白：记录完成。',
                    编码索引: 'AM0001'
                  }
                ]
              }
            },
            {
              action: 'upsert_sheet_rows',
              value: {
                sheet_id: 'LOG_Outline',
                key_field: '编码索引',
                rows: [
                  {
                    章节: '第一章',
                    标题: '街道记录',
                    开始回合: 1,
                    时间跨度: '1000-01-01 07:30—1000-01-01 07:40',
                    大纲: '主角整理并记录本轮见闻。',
                    事件列表: ['停留观察', '完成记录'],
                    编码索引: 'AM0001'
                  }
                ]
              }
            }
          ],
          rawResponse: '{\"tavern_commands\":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
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
              modelId: 'memory-model'
            }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const summaries = result.current.gameState.日志摘要 || [];
      const outlines = result.current.gameState.日志大纲 || [];
      expect(summaries.length).toBeGreaterThan(0);
      expect(outlines.length).toBeGreaterThan(0);
      expect(String(summaries.at(-1)?.编码索引 || '')).toBe('AM0001');
      expect(String(outlines.at(-1)?.编码索引 || '')).toBe('AM0001');
    });
  });

  it('strips main-ai log table commands when memory service is enabled', async () => {
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
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            {
              action: 'append_log_summary',
              value: {
                回合: 1,
                时间: '第1日 07:00',
                摘要: '记忆AI摘要'
              }
            },
            {
              action: 'append_log_outline',
              value: {
                章节: '第一章',
                标题: '记忆AI标题',
                开始回合: 1,
                事件列表: ['记忆AI事件']
              }
            }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
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
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });
    await waitFor(() => {
      expect((generateServiceCommands as any).mock.calls.some((args: any[]) => args[0] === 'memory')).toBe(true);
    });
    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBeGreaterThan(0);
    });

    const summaryTexts = (result.current.gameState.日志摘要 || []).map((row: any) => String(row?.摘要 || ''));
    expect(summaryTexts.some((text: string) => text.includes('主AI摘要'))).toBe(false);
    expect(summaryTexts.some((text: string) => text.includes('记忆AI摘要'))).toBe(true);
  });

  it.skip('keeps SYS_GlobalState/NPC story table commands when corresponding services are not configured [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你抵达了公会本部，埃伊娜上前接待。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          value: {
            sheetId: 'SYS_GlobalState',
            rows: [{ 当前场景: '公会本部', 游戏时间: '第1日 08:20' }]
          }
        },
        {
          action: 'upsert_npc',
          value: [
            {
              id: 'Char_Eina',
              姓名: '埃伊娜·祖尔',
              当前状态: '在场',
              所在位置: '公会本部'
            }
          ]
        }
      ],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            {
              action: 'append_log_summary',
              value: {
                回合: 1,
                时间: '1000-01-01 08:20',
                时间跨度: '1000-01-01 08:00—1000-01-01 08:20',
                地点: '公会本部',
                摘要: '抵达公会并由埃伊娜接待。'
              }
            },
            {
              action: 'append_log_outline',
              value: {
                章节: '1',
                标题: '公会接待',
                开始回合: 1,
                时间跨度: '1000-01-01 08:00—1000-01-01 08:20',
                大纲: '主角抵达公会并与埃伊娜建立初识。',
                事件列表: ['抵达公会', '埃伊娜接待']
              }
            }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: {
              ...prev.aiConfig.services.state,
              apiKey: '',
              modelId: 'gemini-3-flash-preview'
            }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.当前地点).toBe('公会本部');
      expect((result.current.gameState.社交 || []).some((npc: any) => npc.id === 'Char_Eina')).toBe(true);
    });
  });

  it.skip('rewrites malformed upsert_sheet_rows legacy key payload into SYS_GlobalState update [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你停下脚步聆听街头对话。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.游戏时间',
          value: '第1日 07:05'
        }
      ],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.游戏时间).toBe('第1日 07:05');
    });
  });

  it('drops malformed story upsert_sheet_rows(key=gameState.*) when state service is active and lets state microservice fill', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在南大街停步观察后继续前进。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.游戏时间',
          value: '第1日 07:05'
        }
      ],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey === 'state') {
        return {
          tavern_commands: [
            {
              action: 'upsert_sheet_rows',
              value: {
                sheetId: 'SYS_GlobalState',
                keyField: '当前回合',
                rows: [{ 当前回合: 1, 游戏时间: '第1日 07:12', 当前场景: '欧拉丽南大街' }]
              }
            }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            { action: 'append_log_summary', value: { 回合: 1, 时间: '第1日 07:12', 摘要: '观察后前进。' } },
            { action: 'append_log_outline', value: { 章节: '1', 标题: '观察', 开始回合: 1, 事件列表: ['观察后前进'] } }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: {
              ...prev.aiConfig.services.state,
              apiKey: 'test-state-key',
              modelId: 'state-model'
            }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect((generateServiceCommands as any).mock.calls.some((args: any[]) => args[0] === 'state')).toBe(true);
      expect(result.current.gameState.游戏时间).toBe('第1日 07:12');
    });
  });

  it('uses single fill entry (state+memory only) and does not dispatch social/npcSync/npcBrain services', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在南大街遇到了埃伊娜并短暂交谈。' }],
      tavern_commands: [
        {
          action: 'set',
          key: 'gameState.当前地点',
          value: '欧拉丽南大街'
        }
      ],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string, input?: string) => {
      if (serviceKey === 'state') {
        const requiredSheets = (() => {
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
              keyField: '当前回合',
              rows: [{ 当前回合: 1, 当前场景: '欧拉丽南大街', 游戏时间: '第1日 07:22' }]
            }
          });
        }
        if (requiredSheets.includes('NPC_Registry')) {
          commands.push({
            action: 'upsert_npc',
            value: [
              {
                id: 'Char_Eina',
                姓名: '埃伊娜',
                是否在场: true,
                所在位置: '欧拉丽南大街'
              }
            ]
          });
        }
        return { tavern_commands: commands, rawResponse: '{"tavern_commands":[]}' };
      }
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            { action: 'append_log_summary', value: { 回合: 1, 时间: '第1日 07:22', 摘要: '遇到埃伊娜并交谈。' } },
            { action: 'append_log_outline', value: { 章节: '1', 标题: '南大街相遇', 开始回合: 1, 事件列表: ['相遇', '交谈'] } }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: { ...prev.aiConfig.services.state, apiKey: 'state-key' }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('和埃伊娜打招呼并继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const calls = (generateServiceCommands as any).mock.calls.map((args: any[]) => args[0]);
      expect(calls.includes('state')).toBe(true);
      expect(calls.includes('memory')).toBe(true);
      expect(calls.includes('social')).toBe(false);
      expect(calls.includes('npcSync')).toBe(false);
      expect(calls.includes('npcBrain')).toBe(false);
      expect(result.current.gameState.游戏时间).toBe('第1日 07:22');
      expect((result.current.gameState.社交 || []).some((npc: any) => npc.id === 'Char_Eina')).toBe(true);
    });
  });

  it('accepts snake_case sheet payload aliases from state service for time and npc writes', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在南大街见到了埃伊娜。' }],
      tavern_commands: [],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string, input?: string) => {
      if (serviceKey === 'state') {
        const requiredSheets = (() => {
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
              sheet_id: 'SYS_GlobalState',
              key_field: '当前回合',
              rows: [{ 当前回合: 1, 当前场景: '欧拉丽南大街', 游戏时间: '第1日 07:45' }]
            }
          });
        }
        if (requiredSheets.includes('NPC_Registry')) {
          commands.push({
            action: 'upsert_sheet_rows',
            value: {
              sheet_id: 'NPC_Registry',
              key_field: 'id',
              rows: [
                { id: 'Char_Eina', 姓名: '埃伊娜', 是否在场: true, 所在位置: '欧拉丽南大街' }
              ]
            }
          });
        }
        return { tavern_commands: commands, rawResponse: '{\"tavern_commands\":[]}' };
      }
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            { action: 'append_log_summary', value: { 回合: 1, 时间: '第1日 07:45', 摘要: '在南大街遇见埃伊娜。' } },
            { action: 'append_log_outline', value: { 章节: '1', 标题: '南大街会面', 开始回合: 1, 事件列表: ['会面'] } }
          ],
          rawResponse: '{\"tavern_commands\":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: { ...prev.aiConfig.services.state, apiKey: 'state-key' }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.游戏时间).toBe('第1日 07:45');
      expect((result.current.gameState.社交 || []).some((npc: any) => npc.id === 'Char_Eina')).toBe(true);
      expect((result.current.gameState.日志摘要 || []).length).toBeGreaterThan(0);
      expect((result.current.gameState.日志大纲 || []).length).toBeGreaterThan(0);
    });
  });

  it('expands state required sheets to template scope while excluding log/map-owned sheets', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你整理装备后准备出发。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey === 'state') {
        return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
      }
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            { action: 'append_log_summary', value: { 回合: 1, 时间: '第1日 07:35', 摘要: '整理装备后准备出发。' } },
            { action: 'append_log_outline', value: { 章节: '1', 标题: '整备', 开始回合: 1, 事件列表: ['整理装备', '准备出发'] } }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: { ...prev.aiConfig.services.state, apiKey: 'state-key' }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const stateInputs = (generateServiceCommands as any).mock.calls
        .filter((args: any[]) => args[0] === 'state')
        .map((args: any[]) => {
          try {
            return JSON.parse(String(args[1] || ''));
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      expect(stateInputs.length).toBeGreaterThan(0);
      const requiredSheets = stateInputs.flatMap((payload: any) => payload?.填表任务?.requiredSheets || []);
      expect(requiredSheets.includes('CHARACTER_Registry')).toBe(true);
      expect(requiredSheets.includes('CHARACTER_Attributes')).toBe(true);
      expect(requiredSheets.includes('UI_ActionOptions')).toBe(true);
      expect(requiredSheets.includes('FACTION_Standing')).toBe(true);
      expect(requiredSheets.includes('LOG_Summary')).toBe(false);
      expect(requiredSheets.includes('EXPLORATION_Map_Data')).toBe(false);
      expect(requiredSheets.includes('COMBAT_Map_Visuals')).toBe(false);
      const stateTasks = stateInputs.map((payload: any) => payload?.填表任务 || {});
      expect(stateTasks.some((task: any) => Number(task?.maxConcurrentSheets) === 10)).toBe(true);
      expect(stateTasks.some((task: any) => Number(task?.maxConcurrentBatches) === 5)).toBe(true);
    });
  });

  it('filters log sheet commands from state task and keeps non-log table updates', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你完成观察并继续前进。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string, input?: string) => {
      if (serviceKey === 'state') {
        const requiredSheets = (() => {
          try {
            return JSON.parse(String(input || ''))?.填表任务?.requiredSheets || [];
          } catch {
            return [];
          }
        })();
        if (requiredSheets.includes('SYS_GlobalState')) {
          return {
            tavern_commands: [
              {
                action: 'append_log_summary',
                value: { 回合: 1, 时间: '第1日 07:30', 摘要: 'state误写日志' }
              },
              {
                action: 'upsert_sheet_rows',
                value: {
                  sheetId: 'SYS_GlobalState',
                  keyField: '当前回合',
                  rows: [{ 当前回合: 1, 游戏时间: '第1日 07:30', 当前场景: '欧拉丽南大街' }]
                }
              }
            ],
            rawResponse: '{"tavern_commands":[]}'
          };
        }
        return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
      }
      if (serviceKey === 'memory') {
        return {
          tavern_commands: [
            { action: 'append_log_summary', value: { 回合: 1, 时间: '第1日 07:30', 摘要: 'memory摘要' } },
            { action: 'append_log_outline', value: { 章节: '1', 标题: '继续前进', 开始回合: 1, 事件列表: ['继续前进'] } }
          ],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: { ...prev.aiConfig.services.state, apiKey: 'state-key' }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.游戏时间).toBe('第1日 07:30');
      const summaries = result.current.gameState.日志摘要 || [];
      expect(summaries.some((row: any) => String(row?.摘要 || '').includes('state误写日志'))).toBe(false);
      expect(summaries.some((row: any) => String(row?.摘要 || '').includes('memory摘要'))).toBe(true);
    });
  });

  it.skip('keeps valid legacy updates when a rumor field legacy command cannot be bridged [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你向路边商贩打听了情报。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.游戏时间',
          value: '第1日 07:10'
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.社交',
          value: {
            id: 'Char_Vendor_Dole',
            姓名: '多尔',
            是否在场: true,
            当前位置: '欧拉丽南大街',
            所在位置: '欧拉丽南大街',
            位置详情: '欧拉丽南大街'
          }
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.世界.街头传闻[0].传播度',
          value: 60
        }
      ],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.游戏时间).toBe('第1日 07:10');
      expect((result.current.gameState.社交 || []).some((npc: any) => npc.id === 'Char_Vendor_Dole')).toBe(true);
    });
  });

  it.skip('bridges malformed upsert_sheet_rows legacy key payload for inventory and quest status [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你完成了登记并拿到了卡片。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.背包',
          value: {
            id: 'Itm_GuildCard',
            名称: '公会卡',
            描述: '登记后发放的身份证明卡片。',
            数量: 1,
            类型: '证件'
          }
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.任务[0].状态',
          value: 'completed'
        }
      ],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect((result.current.gameState.背包 || []).some((item: any) => item.id === 'Itm_GuildCard' || item.名称 === '公会卡')).toBe(true);
      expect(result.current.gameState.任务?.[0]?.状态).toBe('completed');
    });
  });

  it.skip('bridges malformed upsert_sheet_rows quest log payload into QUEST_ProgressLog [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '任务进度已记录。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.任务[0].日志',
          value: {
            时间戳: '第1日 07:30',
            内容: '在公会本部完成了基础登记，领取了公会卡。',
            状态: 'completed'
          }
        }
      ],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const logs = result.current.gameState.任务?.[0]?.日志 || [];
      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((entry: any) => String(entry?.内容 || '').includes('完成了基础登记'))).toBe(true);
    });
  });

  it.skip('does not rollback whole batch when legacy economy/phone keys are present and bridges them [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在酒馆完成了交易。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.游戏时间',
          value: '第1日 07:40'
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.当前地点',
          value: '『倦猫』酒馆'
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.世界坐标',
          value: {
            x: 5450,
            y: 5360
          }
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.角色.法利',
          value: 3150
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.背包',
          value: {
            id: 'Itm_FruitWine_01',
            名称: '廉价果酒',
            描述: '欧拉丽平民酒馆常见的低度果酒。',
            数量: 1,
            类型: 'consumable',
            品质: 'Common',
            价值: 50,
            堆叠上限: 10,
            恢复量: 15
          }
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.社交',
          value: {
            id: 'Char_Neil',
            姓名: '尼尔',
            身份: '酒馆老板',
            是否在场: true,
            记忆: [
              {
                内容: '博丽灵梦来店里买了一杯晨间果酒。',
                时间戳: '第1日 07:40'
              }
            ]
          }
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.手机.设备.当前信号',
          value: 2
        }
      ],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.游戏时间).toBe('第1日 07:40');
      expect(result.current.gameState.当前地点).toBe('『倦猫』酒馆');
      expect((result.current.gameState.背包 || []).some((item: any) => item.id === 'Itm_FruitWine_01')).toBe(true);
      expect((result.current.gameState.社交 || []).some((npc: any) => npc.id === 'Char_Neil')).toBe(true);
      expect(Number(result.current.gameState?.角色?.法利 || 0)).toBe(3150);
      expect(Number(result.current.gameState?.世界坐标?.x || 0)).toBe(5450);
      expect(Number(result.current.gameState?.世界坐标?.y || 0)).toBe(5360);
      expect(Number(result.current.gameState?.手机?.设备?.当前信号 || 0)).toBe(2);
    });
  });

  it('reroll replaces prior turn summary/outline instead of accumulating stale rows', async () => {
    (generateDungeonMasterResponse as any)
      .mockResolvedValueOnce({
        logs: [{ sender: '旁白', text: '第一次叙事结果。' }],
        tavern_commands: [],
        rawResponse: '{"ok":true}'
      })
      .mockResolvedValueOnce({
        logs: [{ sender: '旁白', text: '重roll后的叙事结果。' }],
        tavern_commands: [],
        rawResponse: '{"ok":true}'
      });

    let rerolled = false;
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string, input?: string) => {
      if (serviceKey !== 'memory') {
        return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
      }
      const isOutline = String(input || '').includes('"targetSheet": "LOG_Outline"');
      const isSummary = String(input || '').includes('"targetSheet": "LOG_Summary"');
      const label = rerolled ? '重roll后' : '第一次';
      const turn = 1;
      const summaryCommand = {
        action: 'append_log_summary',
        value: {
          回合: turn,
          时间: '第1日 07:00',
          时间跨度: '1000-01-01 07:00—1000-01-01 07:10',
          地点: '欧拉丽南大街',
          纪要: `${label}总结记录，包含足够区分信息。`,
          重要对话: '旁白：测试',
          编码索引: 'AM0001'
        }
      };
      const outlineCommand = {
        action: 'append_log_outline',
        value: {
          章节: '第一章',
          标题: `${label}大纲`,
          开始回合: turn,
          时间跨度: '1000-01-01 07:00—1000-01-01 07:10',
          大纲: `${label}主干事件`,
          事件列表: [`${label}事件`],
          编码索引: 'AM0001'
        }
      };
      const commands = isSummary
        ? [summaryCommand]
        : (isOutline ? [outlineCommand] : [summaryCommand, outlineCommand]);
      return {
        tavern_commands: commands,
        rawResponse: '{"tavern_commands":[]}'
      };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
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
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });
    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBe(1);
      expect((result.current.gameState.日志大纲 || []).length).toBe(1);
      expect(String(result.current.gameState.日志摘要?.[0]?.纪要 || '')).toContain('第一次');
      expect(String(result.current.gameState.日志大纲?.[0]?.大纲 || '')).toContain('第一次');
    });

    await act(async () => {
      rerolled = true;
      result.current.handleReroll();
    });
    await waitFor(() => {
      expect((result.current.gameState.日志摘要 || []).length).toBe(1);
      expect((result.current.gameState.日志大纲 || []).length).toBe(1);
      expect(String(result.current.gameState.日志摘要?.[0]?.纪要 || '')).toContain('重roll后');
      expect(String(result.current.gameState.日志大纲?.[0]?.大纲 || '')).toContain('重roll后');
      expect(String(result.current.gameState.日志摘要?.[0]?.纪要 || '')).not.toContain('第一次');
      expect(String(result.current.gameState.日志大纲?.[0]?.大纲 || '')).not.toContain('第一次');
    });
  });

  it('reroll anchors to last real user input instead of ai logs mislabeled as player', async () => {
    (generateDungeonMasterResponse as any)
      .mockResolvedValueOnce({
        logs: [
          { sender: '旁白', text: '第一段叙事。' },
          { sender: 'player', text: '（AI 误标）上一段落内容' },
          { sender: '旁白', text: '第二段叙事。' }
        ],
        tavern_commands: [],
        rawResponse: '{"ok":true}'
      })
      .mockResolvedValueOnce({
        logs: [{ sender: '旁白', text: '重roll后新叙事。' }],
        tavern_commands: [],
        rawResponse: '{"ok":true}'
      });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{"tavern_commands":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('我的真实输入', 'ACTION', [], undefined, true);
    });
    await waitFor(() => {
      expect(generateDungeonMasterResponse).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      result.current.handleReroll();
    });
    await waitFor(() => {
      expect(generateDungeonMasterResponse).toHaveBeenCalledTimes(2);
    });

    const secondCallInput = (generateDungeonMasterResponse as any).mock.calls[1]?.[0];
    expect(secondCallInput).toBe('我的真实输入');
  });

  it.skip('blocks malformed legacy path-like upsert payload in triad-only runtime [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你喝下果酒并继续向尼尔打听。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.游戏时间',
          value: '第1日 07:45'
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.角色.法利',
          value: -50
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.角色.生存状态.水分',
          value: 5
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.角色.生存状态.饱腹度',
          value: 2
        },
        {
          action: 'upsert_sheet_rows',
          key: 'gameState.社交',
          value: {
            id: 'Char_Neil',
            姓名: '尼尔',
            身份: '酒馆店主',
            是否在场: true
          }
        }
      ],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{"tavern_commands":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.角色.法利 = 3200;
    state.角色.生存状态.水分 = 60;
    state.角色.生存状态.饱腹度 = 70;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.游戏时间).toBe('第1日 07:00');
      expect(Number(result.current.gameState?.角色?.法利 || 0)).toBe(3200);
      expect(Number(result.current.gameState?.角色?.生存状态?.水分 || 0)).toBe(60);
      expect(Number(result.current.gameState?.角色?.生存状态?.饱腹度 || 0)).toBe(70);
      expect((result.current.gameState.社交 || []).some((npc: any) => npc.id === 'Char_Neil')).toBe(false);
      expect((result.current.gameState.日志 || []).some((log: any) => String(log?.text || '').includes('Legacy path 指令已禁用'))).toBe(true);
    });
  });

  it('dedupes memory summary placeholders and keeps only meaningful paired rows', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在南大街观察周围后继续前进。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string, input?: string) => {
      if (serviceKey !== 'memory') {
        return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
      }
      const isOutline = String(input || '').includes('"targetSheet": "LOG_Outline"');
      const isSummary = String(input || '').includes('"targetSheet": "LOG_Summary"');
      const summaryCommands = [
        { action: 'append_log_summary', value: 1 },
        {
          action: 'append_log_summary',
          value: {
            回合: 1,
            时间: '第1日 07:10',
            时间跨度: '1000-01-01 07:10—1000-01-01 07:10',
            地点: '欧拉丽南大街',
            纪要: '博丽灵梦在欧拉丽南大街停步观察周边路人与摊位变化，随后继续向前移动。',
            重要对话: '旁白：路人议论飞行者',
            编码索引: 'AM0001'
          }
        }
      ];
      const outlineCommands = [
        {
          action: 'append_log_outline',
          value: {
            章节: '第一章',
            标题: '街头观察',
            开始回合: 1,
            时间跨度: '1000-01-01 07:10—1000-01-01 07:10',
            大纲: '主角完成街头观察并继续推进。',
            事件列表: ['街头观察', '继续推进'],
            编码索引: 'AM0001'
          }
        }
      ];
      if (isSummary) {
        return {
          tavern_commands: summaryCommands,
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      if (!isOutline) {
        return {
          tavern_commands: [...summaryCommands, ...outlineCommands],
          rawResponse: '{"tavern_commands":[]}'
        };
      }
      return {
        tavern_commands: outlineCommands,
        rawResponse: '{"tavern_commands":[]}'
      };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
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
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const summaries = result.current.gameState.日志摘要 || [];
      const outlines = result.current.gameState.日志大纲 || [];
      expect(summaries.length).toBe(1);
      expect(outlines.length).toBe(1);
      expect(String(summaries[0]?.纪要 || '')).not.toBe('1');
      expect(String(summaries[0]?.编码索引 || '')).toBe('AM0001');
      expect(String(outlines[0]?.编码索引 || '')).toBe('AM0001');
    });
  });

  it('keeps valid paired turns and repairs missing turns without full fallback', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你沿着南大街继续推进并记录关键线索。' }],
      tavern_commands: [],
      rawResponse: '{\"ok\":true}'
    });
    let outlineCallCount = 0;
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string, input?: string) => {
      if (serviceKey !== 'memory') {
        return { tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' };
      }
      const text = String(input || '');
      const isOutline = text.includes('\"targetSheet\": \"LOG_Outline\"') || text.includes('\"targetSheet\":\"LOG_Outline\"');
      const isSummary = text.includes('\"targetSheet\": \"LOG_Summary\"') || text.includes('\"targetSheet\":\"LOG_Summary\"');
      const summaryCommands = [
        {
          action: 'append_log_summary',
          value: {
            回合: 1,
            时间: '第1日 07:10',
            时间跨度: '1000-01-01 07:00—1000-01-01 07:10',
            地点: '欧拉丽南大街',
            纪要: '主角在街区持续观察路人动向、摊位价格和守卫巡逻间隔，并把线索按时间顺序逐条记录，随后对比前后变化确认第一条可验证情报并制定下一步行动路线。主角在街区持续观察路人动向、摊位价格和守卫巡逻间隔，并把线索按时间顺序逐条记录，随后对比前后变化确认第一条可验证情报并制定下一步行动路线。',
            重要对话: '旁白：第一条线索已确认',
            编码索引: 'AM0001'
          }
        },
        {
          action: 'append_log_summary',
          value: {
            回合: 2,
            时间: '第1日 07:20',
            时间跨度: '1000-01-01 07:10—1000-01-01 07:20',
            地点: '欧拉丽南大街',
            纪要: '主角在第二回合将新增情报与既有记录进行交叉比对，补全来源标记、风险提示和行动依赖关系，并把结论同步到阶段目标清单中，确保后续推进时能够直接引用可验证证据。主角在第二回合将新增情报与既有记录进行交叉比对，补全来源标记、风险提示和行动依赖关系，并把结论同步到阶段目标清单中，确保后续推进时能够直接引用可验证证据。',
            重要对话: '旁白：第二条线索已确认',
            编码索引: 'AM0002'
          }
        }
      ];
      const firstOutlineOnly = [
        {
          action: 'append_log_outline',
          value: {
            章节: '第一章',
            标题: '街区线索-其一',
            开始回合: 1,
            时间跨度: '1000-01-01 07:00—1000-01-01 07:10',
            大纲: '主角完成第一轮街区情报确认，形成可执行的后续推进提纲并标注关键证据。',
            事件列表: ['确认线索', '继续推进'],
            编码索引: 'AM0001'
          }
        }
      ];
      const secondOutlineOnly = [
        {
          action: 'append_log_outline',
          value: {
            章节: '第一章',
            标题: '街区线索-其二',
            开始回合: 2,
            时间跨度: '1000-01-01 07:10—1000-01-01 07:20',
            大纲: '主角完成第二轮线索整理并形成阶段汇总，明确下一步的行动顺序与验证点。',
            事件列表: ['整理线索', '阶段汇总'],
            编码索引: 'AM0002'
          }
        }
      ];

      if (isSummary) {
        return { tavern_commands: summaryCommands, rawResponse: '{\"tavern_commands\":[]}' };
      }
      if (isOutline) {
        outlineCallCount += 1;
        return {
          tavern_commands: outlineCallCount === 1 ? firstOutlineOnly : secondOutlineOnly,
          rawResponse: '{\"tavern_commands\":[]}'
        };
      }

      return {
        tavern_commands: [...summaryCommands, ...firstOutlineOnly],
        rawResponse: '{\"tavern_commands\":[]}'
      };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
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
        },
        memoryConfig: {
          ...prev.memoryConfig,
          memoryParallelBySheet: true
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const outlineCalls = (generateServiceCommands as any).mock.calls.filter((args: any[]) => {
        if (args[0] !== 'memory') return false;
        const inputText = String(args[1] || '');
        return inputText.includes('\"targetSheet\": \"LOG_Outline\"') || inputText.includes('\"targetSheet\":\"LOG_Outline\"');
      });
      expect(outlineCalls.length).toBeGreaterThanOrEqual(2);
    });

    const fullFallbackCalls = (generateServiceCommands as any).mock.calls.filter((args: any[]) => {
      if (args[0] !== 'memory') return false;
      const inputText = String(args[1] || '');
      return !inputText.includes('\"targetSheet\": \"LOG_Outline\"')
        && !inputText.includes('\"targetSheet\":\"LOG_Outline\"')
        && !inputText.includes('\"targetSheet\": \"LOG_Summary\"')
        && !inputText.includes('\"targetSheet\":\"LOG_Summary\"');
    });
    expect(fullFallbackCalls.length).toBe(0);
  });

  it.skip('accepts multi-sheet array payload in one upsert_sheet_rows command without breaking primary updates [legacy disabled]', async () => {
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
              rows: [{ 回合: 1, 时间: '第1日 07:10', 摘要: '抵达公会并登记。', 编码索引: 'AM-INVALID' }]
            }
          ]
        }
      ],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{"tavern_commands":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.当前地点).toBe('公会本部');
      expect(result.current.gameState.游戏时间).toBe('第1日 07:10');
    });
  });

  it.skip('ignores malformed upsert_sheet_rows undefined payload without rolling back valid updates [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你短暂停步后继续前进。' }],
      tavern_commands: [
        {
          action: 'upsert_sheet_rows',
          value: {
            sheetId: 'SYS_GlobalState',
            keyField: '当前回合',
            rows: [{ 当前回合: 1, 游戏时间: '第1日 07:15', 当前场景: '欧拉丽南大街' }]
          }
        },
        {
          action: 'upsert_sheet_rows'
        } as any
      ],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{"tavern_commands":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.游戏时间).toBe('第1日 07:15');
      expect(result.current.gameState.当前地点).toBe('欧拉丽南大街');
    });
  });

  it.skip('sanitizes invalid AM index in append_log_summary instead of dropping the command [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你记录了本回合简报。' }],
      tavern_commands: [
        {
          action: 'append_log_summary',
          value: {
            回合: 1,
            时间: '第1日 07:20',
            摘要: '在公会大厅完成登记后查看公告板。',
            编码索引: 'AM-BAD'
          }
        }
      ],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const summaries = result.current.gameState.日志摘要 || [];
      expect(summaries.length).toBeGreaterThan(0);
      expect(String(summaries[0]?.摘要 || '')).toContain('公会大厅');
      expect(String(summaries[0]?.编码索引 || '')).toBe('');
    });
  });

  it('filters phone marker append_log_* commands out of summary/outline tables', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你查看完通讯后继续前进。' }],
      tavern_commands: [
        {
          action: 'append_log_summary',
          value: { 回合: 1, 时间: '第1日 07:28', 摘要: '【手机】与埃伊娜聊天：今天公会见。' }
        },
        {
          action: 'append_log_outline',
          value: { 章节: '第一章', 标题: '手机聊天', 开始回合: 1, 事件列表: ['【手机】与埃伊娜聊天：今天公会见。'] }
        }
      ],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{"tavern_commands":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const summaries = result.current.gameState.日志摘要 || [];
      const outlines = result.current.gameState.日志大纲 || [];
      expect(summaries.length).toBe(0);
      expect(outlines.length).toBe(0);
      expect(summaries.some((row: any) => String(row?.摘要 || '').startsWith('【手机】'))).toBe(false);
      expect(outlines.some((row: any) => String(row?.大纲 || '').startsWith('【手机】'))).toBe(false);
    });
  });

  it('filters state world/forum sheet writes when current turn is not due by interval', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你记录完信息后继续前进。' }],
      tavern_commands: [],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey !== 'state') {
        return { tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' };
      }
      return {
        tavern_commands: [
          {
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'SYS_GlobalState',
              keyField: '当前回合',
              rows: [{ 当前回合: 2, 当前场景: '间隔测试地点', 游戏时间: '第1日 07:22' }]
            }
          },
          {
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'WORLD_News',
              keyField: 'news_id',
              rows: [{ news_id: 'News_TEST_001', 标题: '不应在本回合写入', 时间戳: '第1日 07:22', 来源: 'guild', 重要度: 'normal' }]
            }
          },
          {
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'FORUM_Posts',
              keyField: 'post_id',
              rows: [{ post_id: 'Forum_TEST_001', board_id: 'board_news', board_name: '欧拉丽快报', 标题: '不应在本回合写入', 内容: '测试', 发布者: '系统', 时间戳: '第1日 07:22' }]
            }
          }
        ],
        rawResponse: '{\"tavern_commands\":[]}'
      };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: {
              ...prev.aiConfig.services.state,
              apiKey: 'test-state-key',
              modelId: 'state-model'
            }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.当前地点).toBe('间隔测试地点');
      expect(result.current.gameState.游戏时间).toBe('第1日 07:22');
    });

    const stateCall = (generateServiceCommands as any).mock.calls.find((args: any[]) => args[0] === 'state');
    expect(String(stateCall?.[1] || '')).not.toContain('WORLD_News');
    expect(String(stateCall?.[1] || '')).not.toContain('FORUM_Posts');
    const worldRows = ((result.current.gameState as any).__tableRows?.WORLD_News || []);
    const forumRows = ((result.current.gameState as any).__tableRows?.FORUM_Posts || []);
    expect(worldRows.length).toBe(0);
    expect(forumRows.length).toBe(0);
  });

  it('does not rollback state batch when malformed apply_econ_delta coexists with multi-row CHARACTER_Skills writes', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你在酒馆整理情报后准备继续行动。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey !== 'state') {
        return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
      }
      return {
        tavern_commands: [
          { action: 'apply_econ_delta' },
          {
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'CHARACTER_Skills',
              keyField: 'LINK_ID',
              rows: [
                { LINK_ID: 'LINK_Test_001', CHAR_ID: 'PC_MAIN', SKILL_ID: 'Skill_Test_001', 当前熟练等级: '受训' },
                { LINK_ID: 'LINK_Test_002', CHAR_ID: 'PC_MAIN', SKILL_ID: 'Skill_Test_002', 当前熟练等级: '精通' }
              ]
            }
          },
          {
            action: 'upsert_sheet_rows',
            value: {
              sheetId: 'SYS_GlobalState',
              keyField: '当前回合',
              rows: [{ 当前回合: 1, 当前场景: '丰饶的女主人', 游戏时间: '第1日 07:45' }]
            }
          }
        ],
        rawResponse: '{"tavern_commands":[]}'
      };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: {
              ...prev.aiConfig.services.state,
              apiKey: 'test-state-key',
              modelId: 'state-model'
            }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      expect(result.current.gameState.当前地点).toBe('丰饶的女主人');
      expect(result.current.gameState.游戏时间).toBe('第1日 07:45');
      const skillRows = ((result.current.gameState as any).__tableRows?.CHARACTER_Skills || []);
      expect(skillRows.length).toBeGreaterThanOrEqual(2);
      const systemLogs = (result.current.gameState.日志 || []).filter((log: any) => String(log?.sender || '') === '系统');
      expect(systemLogs.some((log: any) => String(log?.text || '').includes('回合事务阻断'))).toBe(false);
    });
  });

  it('does not trigger sheet version conflict when multiple upsert_npc commands target NPC_Registry in one turn', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你先后与赫斯缇雅和莉莉交谈。' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey !== 'state') {
        return { tavern_commands: [], rawResponse: '{"tavern_commands":[]}' };
      }
      return {
        tavern_commands: [
          {
            action: 'upsert_npc',
            value: [{ id: 'Char_Hestia', 姓名: '赫斯缇雅', 当前状态: '在场' }]
          },
          {
            action: 'upsert_npc',
            value: [{ id: 'Char_Lili', 姓名: '莉莉露卡', 当前状态: '在场' }]
          }
        ],
        rawResponse: '{"tavern_commands":[]}'
      };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);
    act(() => {
      result.current.setSettings((prev: any) => ({
        ...prev,
        aiConfig: {
          ...prev.aiConfig,
          services: {
            ...prev.aiConfig.services,
            state: {
              ...prev.aiConfig.services.state,
              apiKey: 'test-state-key',
              modelId: 'state-model'
            }
          }
        }
      }));
    });

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const social = Array.isArray(result.current.gameState.社交) ? result.current.gameState.社交 : [];
      const names = social.map((item: any) => String(item?.姓名 || ''));
      expect(names).toContain('赫斯缇雅');
      expect(names).toContain('莉莉露卡');
      const systemLogs = (result.current.gameState.日志 || []).filter((log: any) => String(log?.sender || '') === '系统');
      expect(systemLogs.some((log: any) => String(log?.text || '').includes('回合事务阻断'))).toBe(false);
    });
  });

  it('keeps interacted NPC present when state service emits mistaken away patch in same turn', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '赫斯缇雅', text: '今晚就在这里聊聊吧。' }],
      tavern_commands: [],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockImplementation(async (serviceKey: string) => {
      if (serviceKey !== 'state') {
        return { tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' };
      }
      return {
        tavern_commands: [
          {
            action: 'upsert_npc',
            value: [{ id: 'Char_Hestia', 姓名: '赫斯缇雅', 当前状态: '离场', 是否在场: false }]
          }
        ],
        rawResponse: '{\"tavern_commands\":[]}'
      };
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.社交 = [
      {
        id: 'Char_Hestia',
        姓名: '赫斯缇雅',
        是否在场: true,
        当前状态: '在场',
        记忆: [],
        好感度: 50,
        特别关注: false
      }
    ];
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续和赫斯缇雅对话', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const hestia: any = (result.current.gameState.社交 || []).find((npc: any) => npc?.姓名 === '赫斯缇雅');
      expect(hestia).toBeTruthy();
      expect(hestia?.是否在场).toBe(true);
      expect(hestia?.当前状态 ?? '在场').toBe('在场');
    });
  });

  it('parses inline function-style upsert_sheet_rows command strings without missing action/key errors', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你检查了终端并确认主线目标。' }],
      tavern_commands: [
        "upsert_sheet_rows('gameState.手机.设备', [{'电量': '100%', '当前信号': 4, '状态': 'online'}])",
        "upsert_sheet_rows('gameState.任务', [{'任务ID': 'M001', '类别': '主线', '目标': '前往公会本部', '描述': '前往西北方的公会总部进行登记'}])"
      ],
      rawResponse: '{"ok":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{"tavern_commands":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const logs = Array.isArray(result.current.gameState.日志) ? result.current.gameState.日志 : [];
      const hasMissingActionKey = logs.some((entry: any) =>
        String(entry?.text || '').includes('缺少 action/key')
      );
      expect(hasMissingActionKey).toBe(false);
    });
  });

  it.skip('accepts cmd+args shaped commands without missing action/key errors [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你更新了NPC关系并登记角色档案。' }],
      tavern_commands: [
        {
          cmd: 'upsert_npc',
          args: { ID: 'NPC_Misha_Flott', 姓名: '米莎弗洛特', 是否在场: true, 关系状态: '认识', 特别关注: true }
        },
        {
          cmd: 'upsert_sheet_rows',
          args: {
            sheetId: 'CHARACTER_Registry',
            rows: [{ CHAR_ID: 'PC_MAIN', 姓名: 'Tester' }]
          }
        }
      ],
      rawResponse: '{\"ok\":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{\"tavern_commands\":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const logs = Array.isArray(result.current.gameState.日志) ? result.current.gameState.日志 : [];
      const hasMissingActionKey = logs.some((entry: any) =>
        String(entry?.text || '').includes('缺少 action/key')
      );
      expect(hasMissingActionKey).toBe(false);
      const npcs = Array.isArray(result.current.gameState.社交) ? result.current.gameState.社交 : [];
      expect(npcs.some((npc: any) => String(npc?.姓名 || '').includes('米莎'))).toBe(true);
    });
  });

  it.skip('accepts name+args shaped commands without missing action/key errors [legacy disabled]', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '你完成了早餐支付并同步了手机通讯录。' }],
      tavern_commands: [
        {
          name: 'upsert_sheet_rows',
          args: {
            sheetId: 'PHONE_Device',
            rows: [{ device_id: 'Player_Device', status: 'online', battery: '95%', signal: 4, last_seen: '第1日 07:45' }]
          },
          value: {
            sheetId: 'PHONE_Device',
            rows: [{ device_id: 'Player_Device', status: 'online', battery: '95%', signal: 4, last_seen: '第1日 07:45' }]
          }
        },
        {
          name: 'upsert_sheet_rows',
          args: {
            sheetId: 'PHONE_Contacts',
            rows: [{ contact_id: 'Char_Syr', name: '希儿·福罗瓦', bucket: 'recent', recent: 'yes' }]
          },
          value: {
            sheetId: 'PHONE_Contacts',
            rows: [{ contact_id: 'Char_Syr', name: '希儿·福罗瓦', bucket: 'recent', recent: 'yes' }]
          }
        },
        {
          name: 'upsert_sheet_rows',
          args: {
            sheetId: 'PHONE_Threads',
            rows: [{ thread_id: 'Thr_Syr_01', type: 'private', title: '希儿·福罗瓦', members: '博丽灵梦,希儿·福罗瓦', unread: 0 }]
          },
          value: {
            sheetId: 'PHONE_Threads',
            rows: [{ thread_id: 'Thr_Syr_01', type: 'private', title: '希儿·福罗瓦', members: '博丽灵梦,希儿·福罗瓦', unread: 0 }]
          }
        },
        {
          name: 'upsert_sheet_rows',
          args: {
            sheetId: 'PHONE_Messages',
            rows: [{ message_id: 'Msg_Syr_01', thread_id: 'Thr_Syr_01', sender: '希儿·福罗瓦', content: '欢迎下次光临。', timestamp: '第1日 07:45' }]
          },
          value: {
            sheetId: 'PHONE_Messages',
            rows: [{ message_id: 'Msg_Syr_01', thread_id: 'Thr_Syr_01', sender: '希儿·福罗瓦', content: '欢迎下次光临。', timestamp: '第1日 07:45' }]
          }
        },
        {
          name: 'apply_econ_delta',
          args: { target_id: '博丽灵梦', currency_type: '法利', delta: -200, reason: '在丰饶的女主人支付早餐费用' },
          value: { target_id: '博丽灵梦', currency_type: '法利', delta: -200, reason: '在丰饶的女主人支付早餐费用' }
        }
      ],
      rawResponse: '{\\\"ok\\\":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({ tavern_commands: [], rawResponse: '{\\\"tavern_commands\\\":[]}' });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderGameLogic(state);

    await act(async () => {
      await result.current.handleAIInteraction('继续行动', 'ACTION', [], undefined, true);
    });

    await waitFor(() => {
      const logs = Array.isArray(result.current.gameState.日志) ? result.current.gameState.日志 : [];
      const hasMissingActionKey = logs.some((entry: any) =>
        String(entry?.text || '').includes('缺少 action/key')
      );
      expect(hasMissingActionKey).toBe(false);

      const tableRows = (result.current.gameState as any).__tableRows || {};
      expect(Array.isArray(tableRows.PHONE_Device) && tableRows.PHONE_Device.length > 0).toBe(true);
      expect(Array.isArray(tableRows.PHONE_Contacts) && tableRows.PHONE_Contacts.length > 0).toBe(true);
      expect(Array.isArray(tableRows.PHONE_Threads) && tableRows.PHONE_Threads.length > 0).toBe(true);
      expect(Array.isArray(tableRows.PHONE_Messages) && tableRows.PHONE_Messages.length > 0).toBe(true);
    });
  });
});





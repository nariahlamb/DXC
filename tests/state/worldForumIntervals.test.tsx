import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameLogic } from '../../hooks/useGameLogic';
import { createNewGameState } from '../../utils/dataMapper';
import { buildPhoneStateFromTables } from '../../utils/taverndb/phoneTableAdapter';

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
  generatePhoneResponse,
  generateServiceCommands
} = await import('../../utils/ai');

describe('world/forum update interval behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (generateDungeonMasterResponse as any).mockResolvedValue({
      logs: [{ sender: '旁白', text: '测试叙事' }],
      tavern_commands: [],
      rawResponse: '{"ok":true}'
    });
    (generatePhoneResponse as any).mockResolvedValue({
      allowed: true,
      phone_updates: {},
      messages: [],
      tavern_commands: [],
      rawResponse: '{"allowed":true}'
    });
    (generateServiceCommands as any).mockResolvedValue({
      tavern_commands: [],
      rawResponse: '{"tavern_commands":[]}'
    });
  });

  it('schedules next world update turn based on 世界更新间隔回合', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderHook(() => useGameLogic(state));

    act(() => {
      result.current.setGameState((prev: any) => ({
        ...prev,
        回合数: 5,
        系统设置: {
          ...(prev.系统设置 || {}),
          世界更新间隔回合: 2
        },
        世界: {
          ...(prev.世界 || {}),
          下次更新回合: undefined
        }
      }));
    });

    await waitFor(() => {
      expect(result.current.gameState.世界?.下次更新回合).toBe(7);
    });
  });

  it('clears next world update turn when interval is manual(0)', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const { result } = renderHook(() => useGameLogic(state));

    act(() => {
      result.current.setGameState((prev: any) => ({
        ...prev,
        回合数: 8,
        系统设置: {
          ...(prev.系统设置 || {}),
          世界更新间隔回合: 0,
          更新频率: 'manual'
        },
        世界: {
          ...(prev.世界 || {}),
          下次更新回合: 9
        }
      }));
    });

    await waitFor(() => {
      expect(result.current.gameState.世界?.下次更新回合).toBeUndefined();
    });
  });

  it('triggers forum auto generation on interval turn', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
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
              apiKey: 'test-phone-key',
              modelId: 'gemini-3-flash-preview'
            }
          }
        }
      }));
    });

    act(() => {
      result.current.setGameState((prev: any) => ({
        ...prev,
        回合数: 2,
        系统设置: {
          ...(prev.系统设置 || {}),
          世界更新间隔回合: 2
        }
      }));
    });

    await waitFor(() => {
      expect(generatePhoneResponse).toHaveBeenCalled();
    });
  });

  it('accepts forum post aliases from phone_updates (发帖人/发布时间)', async () => {
    (generatePhoneResponse as any).mockResolvedValueOnce({
      allowed: true,
      phone_updates: {
        公共帖子: {
          帖子: [
            {
              板块: '欧拉丽快报',
              标题: '测试帖子',
              发帖人: '公会联络员_埃伊娜',
              内容: '字段别名写入测试',
              发布时间: '07:15',
              回复: [
                { 发帖人: '冒险者甲', 内容: '收到。', 发布时间: '07:16' }
              ]
            }
          ]
        }
      },
      messages: [],
      tavern_commands: [],
      rawResponse: '{"allowed":true}'
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
            state: {
              ...prev.aiConfig.services.state,
              apiKey: 'test-phone-key',
              modelId: 'gemini-3-flash-preview'
            }
          }
        }
      }));
    });

    act(() => {
      result.current.setGameState((prev: any) => ({
        ...prev,
        回合数: 2,
        系统设置: {
          ...(prev.系统设置 || {}),
          世界更新间隔回合: 2
        }
      }));
    });

    await waitFor(() => {
      const phone = buildPhoneStateFromTables(result.current.gameState, {
        allowFallbackWhenEmpty: false,
        preserveLegacySocialFeeds: false
      });
      const post = phone.公共帖子?.帖子?.[0];
      expect(post?.发布者).toBe('公会联络员_埃伊娜');
      expect(post?.时间戳).toBe('07:15');
      expect(post?.回复?.[0]?.发布者).toBe('冒险者甲');
    });
  });
});

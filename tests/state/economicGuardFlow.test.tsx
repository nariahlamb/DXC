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

describe('economic invariant guard in command flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks batch when money becomes negative', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '测试扣款' }],
      tavern_commands: [
        { action: 'apply_econ_delta', value: { account: '角色.法利', delta: -200, reason: '测试扣款' } }
      ],
      rawResponse: '{"ok":true}'
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.角色.法利 = 100;

    const { result } = renderHook(() => useGameLogic(state));
    await act(async () => {
      await result.current.handleAIInteraction('测试扣款输入', 'ACTION', [], undefined, true);
      await Promise.resolve();
    });

    expect(result.current.gameState.角色.法利).toBe(100);
    expect(result.current.gameState.经济流水?.length || 0).toBe(0);
  });

  it('records economic ledger when money change is valid', async () => {
    (generateDungeonMasterResponse as any).mockResolvedValueOnce({
      logs: [{ sender: '旁白', text: '测试奖励' }],
      tavern_commands: [
        { action: 'apply_econ_delta', value: { account: '角色.法利', delta: 120, reason: '测试奖励' } }
      ],
      rawResponse: '{"ok":true}'
    });

    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.角色.法利 = 200;

    const { result } = renderHook(() => useGameLogic(state));
    await act(async () => {
      await result.current.handleAIInteraction('测试奖励输入', 'ACTION', [], undefined, true);
      await Promise.resolve();
    });

    expect(result.current.gameState.角色.法利).toBe(320);
    expect(Array.isArray(result.current.gameState.经济流水)).toBe(true);
    expect(result.current.gameState.经济流水?.length).toBeGreaterThan(0);
    expect(result.current.gameState.经济流水?.[0].delta).toBe(120);
  });
});

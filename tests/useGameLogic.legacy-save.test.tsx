import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameLogic } from '../hooks/useGameLogic';
import { createNewGameState } from '../utils/dataMapper';

const buildLegacyState = () => {
  const state = createNewGameState('Tester', '男', 'Human');
  // 模拟旧存档：删除记忆字段
  delete (state as any).记忆;
  return state as any;
};

describe('useGameLogic legacy save', () => {
  it('does not crash when memory field is missing', () => {
    expect(() => {
      renderHook(() => useGameLogic(buildLegacyState()));
    }).not.toThrow();
  });

  it('auto-saves when turn >= 1', async () => {
    const state = createNewGameState('Tester', '男', 'Human');
    state.回合数 = 1;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    renderHook(() => useGameLogic(state));
    await act(async () => {
      await Promise.resolve();
    });
    expect(setItemSpy).toHaveBeenCalledWith(
      expect.stringContaining('danmachi_save_auto_1'),
      expect.any(String)
    );
    setItemSpy.mockRestore();
  });

  it('auto-saves again when level changes at same turn', async () => {
    const state = createNewGameState('Tester', '男', 'Human');
    state.回合数 = 1;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useGameLogic(state));

    await act(async () => {
      await Promise.resolve();
    });

    const baselineCalls = setItemSpy.mock.calls.length;

    act(() => {
      result.current.setGameState(prev => ({
        ...prev,
        角色: {
          ...prev.角色,
          等级: (prev.角色?.等级 || 0) + 1,
        },
      }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setItemSpy.mock.calls.length).toBeGreaterThan(baselineCalls);
    setItemSpy.mockRestore();
  });

  it('schedules next world update turn from interval setting', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.回合数 = 10;
    state.系统设置 = { ...(state.系统设置 || {}), 世界更新间隔回合: 2 };
    state.世界 = { ...(state.世界 || {}), 下次更新回合: undefined };

    const { result } = renderHook(() => useGameLogic(state));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.gameState.世界?.下次更新回合).toBe(12);
  });

  it('clears world update turn when interval is disabled', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.回合数 = 8;
    state.系统设置 = { ...(state.系统设置 || {}), 世界更新间隔回合: 0 };
    state.世界 = { ...(state.世界 || {}), 下次更新回合: 9 };

    const { result } = renderHook(() => useGameLogic(state));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.gameState.世界?.下次更新回合).toBeUndefined();
  });

  it('dedupes command queue by dedupeKey', () => {
    const state = createNewGameState('Tester', '男', 'Human');
    const { result } = renderHook(() => useGameLogic(state));

    act(() => {
      result.current.addToQueue('cmd-1', undefined, 'dup-key');
      result.current.addToQueue('cmd-2', undefined, 'dup-key');
    });

    expect(result.current.commandQueue).toHaveLength(1);
    expect(result.current.commandQueue[0].text).toBe('cmd-2');
  });
});

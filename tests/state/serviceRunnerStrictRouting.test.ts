import { describe, expect, it, vi } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { executeServiceRequest } from '../../hooks/gameLogic/microservice/serviceRunner';

describe('serviceRunner strict routing', () => {
  it('keeps state output untouched without any fallback injection', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const runStateParallelBySheet = vi.fn().mockResolvedValue({
      tavern_commands: [],
      rawResponse: '{"tavern_commands":[]}'
    });
    const generateServiceCommands = vi.fn();

    const result = await executeServiceRequest({
      serviceKey: 'state',
      input: '{"玩家输入":"测试"}',
      stateSnapshot: state,
      settings: {} as any,
      runMemoryParallelBySheet: vi.fn(),
      runStateParallelBySheet,
      generateServiceCommands
    });

    expect(runStateParallelBySheet).toHaveBeenCalledTimes(1);
    expect(generateServiceCommands).not.toHaveBeenCalled();
    expect(result.tavern_commands).toEqual([]);
    expect(String(result.repairNote || '')).toContain('econ-fallback');
  });

  it('routes map only to map generator and memory only to memory runner', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const runMemoryParallelBySheet = vi.fn().mockResolvedValue({
      tavern_commands: [{ action: 'append_log_summary', value: { 回合: 1, 摘要: 'ok' } }],
      rawResponse: '{"ok":1}'
    });
    const runStateParallelBySheet = vi.fn().mockResolvedValue({
      tavern_commands: [{ action: 'upsert_sheet_rows', value: { sheetId: 'SYS_GlobalState', rows: [] } }],
      rawResponse: '{"ok":1}'
    });
    const generateServiceCommands = vi.fn().mockResolvedValue({
      tavern_commands: [{ action: 'upsert_exploration_map', value: { locationName: '欧拉丽' } }],
      rawResponse: '{"ok":1}'
    });

    await executeServiceRequest({
      serviceKey: 'memory',
      input: '{}',
      stateSnapshot: state,
      settings: {} as any,
      runMemoryParallelBySheet,
      runStateParallelBySheet,
      generateServiceCommands
    });
    await executeServiceRequest({
      serviceKey: 'map',
      input: '{}',
      stateSnapshot: state,
      settings: {} as any,
      runMemoryParallelBySheet,
      runStateParallelBySheet,
      generateServiceCommands
    });

    expect(runMemoryParallelBySheet).toHaveBeenCalledTimes(1);
    expect(generateServiceCommands).toHaveBeenCalledWith('map', '{}', state, expect.anything(), undefined);
    expect(runStateParallelBySheet).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { executeServiceRequest } from '../../hooks/gameLogic/microservice/serviceRunner';

describe('serviceRunner economy fallback', () => {
  it('injects apply_econ_delta when state service misses narrative payment', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const input = JSON.stringify({
      玩家输入: '吃早餐',
      叙事: [
        { sender: '矮人摊主', text: '两个一共 60 法利。' },
        { sender: '旁白', text: '她摸出硬币拍在柜台上。' }
      ],
      填表任务: {
        requiredSheets: ['SYS_GlobalState', 'ECON_Ledger']
      }
    });

    const runStateParallelBySheet = vi.fn().mockResolvedValue({
      tavern_commands: [],
      rawResponse: '{"tavern_commands":[]}'
    });
    const result = await executeServiceRequest({
      serviceKey: 'state',
      input,
      stateSnapshot: state,
      settings: {} as any,
      runMemoryParallelBySheet: vi.fn(),
      runStateParallelBySheet,
      generateServiceCommands: vi.fn()
    });

    expect(runStateParallelBySheet).toHaveBeenCalledTimes(1);
    expect(result.tavern_commands.length).toBe(1);
    expect(result.tavern_commands[0].action).toBe('apply_econ_delta');
    expect(Number((result.tavern_commands[0] as any)?.value?.delta)).toBe(-60);
    expect(String(result.repairNote || '')).toContain('econ-fallback');
  });

  it('injects apply_econ_delta for chinese numeral price text', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const input = JSON.stringify({
      玩家输入: '结账离开',
      叙事: [
        { sender: '店员', text: '一共三十法利。' },
        { sender: '旁白', text: '她把硬币放在柜台上，准备离开。' }
      ],
      填表任务: {
        requiredSheets: ['SYS_GlobalState', 'ECON_Ledger']
      }
    });

    const result = await executeServiceRequest({
      serviceKey: 'state',
      input,
      stateSnapshot: state,
      settings: {} as any,
      runMemoryParallelBySheet: vi.fn(),
      runStateParallelBySheet: vi.fn().mockResolvedValue({
        tavern_commands: [],
        rawResponse: '{"tavern_commands":[]}'
      }),
      generateServiceCommands: vi.fn()
    });

    expect(result.tavern_commands.length).toBe(1);
    expect(result.tavern_commands[0].action).toBe('apply_econ_delta');
    expect(Number((result.tavern_commands[0] as any)?.value?.delta)).toBe(-30);
  });

  it('reports skip reason for non-structured input and keeps commands unchanged', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const result = await executeServiceRequest({
      serviceKey: 'state',
      input: 'plain text only',
      stateSnapshot: state,
      settings: {} as any,
      runMemoryParallelBySheet: vi.fn(),
      runStateParallelBySheet: vi.fn().mockResolvedValue({
        tavern_commands: [],
        rawResponse: 'plain'
      }),
      generateServiceCommands: vi.fn()
    });

    expect(result.tavern_commands).toHaveLength(0);
    expect(String(result.repairNote || '')).toContain('econ-fallback(non-structured-input');
  });

  it('blocks fallback injection when strict allowlist forbids CHARACTER_Resources.法利', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const input = JSON.stringify({
      玩家输入: '支付早餐',
      叙事: [{ sender: '旁白', text: '她支付了 40 法利。' }],
      填表任务: { requiredSheets: ['ECON_Ledger'] }
    });
    const result = await executeServiceRequest({
      serviceKey: 'state',
      input,
      stateSnapshot: state,
      settings: {
        stateVarWriter: {
          governance: {
            domainScope: {
              strictAllowlist: true,
              allowlist: {
                character_resources: {
                  CHARACTER_Resources: ['HP', 'MP']
                }
              }
            }
          }
        }
      } as any,
      runMemoryParallelBySheet: vi.fn(),
      runStateParallelBySheet: vi.fn().mockResolvedValue({
        tavern_commands: [],
        rawResponse: '{"tavern_commands":[]}'
      }),
      generateServiceCommands: vi.fn()
    });
    expect(result.tavern_commands).toHaveLength(0);
    expect(String(result.repairNote || '')).toContain('econ-fallback(out-of-scope');
  });
});

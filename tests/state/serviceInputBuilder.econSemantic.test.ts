import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { createServiceInputBuilder } from '../../hooks/gameLogic/microservice/inputBuilder';

describe('service input builder economy semantic anchor', () => {
  it('injects 经济语义锚点 for state service when narrative contains checkout amount', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;
    state.角色.法利 = 120;

    const buildInput = createServiceInputBuilder({
      settings: {} as any,
      isMemoryParallelBySheetEnabled: () => false,
      resolveStateRequiredSheets: () => ['SYS_GlobalState', 'ECON_Ledger'],
      buildStateSheetGuide: () => [],
      stateFillBatchSize: 4,
      stateFillMaxConcurrentBatches: 2
    });

    const input = buildInput('state', state, {
      playerInput: '结账离开',
      logs: [
        { sender: '博丽灵梦', text: '多谢款待。那个希儿是吧？结账。' },
        { sender: '希儿福罗瓦', text: '一共是30法利。面包不算在账单里。' }
      ],
      appliedCommands: []
    });

    const payload = JSON.parse(String(input || '{}'));
    const anchor = payload.经济语义锚点;
    expect(anchor).toBeTruthy();
    expect(anchor.当前法利).toBe(120);
    expect(Array.isArray(anchor.交易线索)).toBe(true);
    const clue = (anchor.交易线索 || []).find((item: any) => Number(item?.amount) === 30);
    expect(clue).toBeTruthy();
    expect(clue.direction).toBe('expense');
    expect(Number(clue.deltaHint)).toBe(-30);
  });

  it('marks semantic anchor status as ambiguous when trade direction cannot be inferred', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;

    const buildInput = createServiceInputBuilder({
      settings: {
        stateVarWriter: {
          governance: {
            turnScope: {
              crossTurnSoftWarning: {
                enabled: true,
                threshold: 1,
                sampling: 1,
                nonBlocking: true,
                escalation: { enabled: false, threshold: 3, action: 'warn' }
              }
            },
            domainScope: {
              strictAllowlist: true,
              allowlist: {
                global_state: {
                  SYS_GlobalState: ['当前场景']
                },
                economy_ledger: {
                  ECON_Ledger: ['delta']
                }
              },
              invalidConfigFallbackStrategy: 'use_default_allowlist'
            },
            semanticScope: {
              anchors: ['economy'],
              missingAnchorPolicy: 'warn',
              ambiguousAnchorPolicy: 'warn'
            }
          }
        }
      } as any,
      isMemoryParallelBySheetEnabled: () => false,
      resolveStateRequiredSheets: () => ['SYS_GlobalState', 'ECON_Ledger'],
      buildStateSheetGuide: () => [],
      stateFillBatchSize: 4,
      stateFillMaxConcurrentBatches: 2
    });

    const input = buildInput('state', state, {
      playerInput: '发生了一笔30法利交易',
      logs: [
        { sender: '旁白', text: '账本里记下了30法利。' }
      ],
      appliedCommands: []
    });

    const payload = JSON.parse(String(input || '{}'));
    expect(payload.经济语义锚点).toBeTruthy();
    expect(payload.治理契约?.semanticScope?.context?.economyAnchorStatus).toBe('ambiguous');
  });

  it('marks semantic anchor status as missing when no amount clue exists', () => {
    const state = createNewGameState('博丽灵梦', '女', 'Human') as any;

    const buildInput = createServiceInputBuilder({
      settings: {
        stateVarWriter: {
          governance: {
            turnScope: {
              crossTurnSoftWarning: {
                enabled: true,
                threshold: 1,
                sampling: 1,
                nonBlocking: true,
                escalation: { enabled: false, threshold: 3, action: 'warn' }
              }
            },
            domainScope: {
              strictAllowlist: true,
              allowlist: {
                global_state: {
                  SYS_GlobalState: ['当前场景']
                }
              },
              invalidConfigFallbackStrategy: 'use_default_allowlist'
            },
            semanticScope: {
              anchors: ['economy'],
              missingAnchorPolicy: 'warn',
              ambiguousAnchorPolicy: 'warn'
            }
          }
        }
      } as any,
      isMemoryParallelBySheetEnabled: () => false,
      resolveStateRequiredSheets: () => ['SYS_GlobalState'],
      buildStateSheetGuide: () => [],
      stateFillBatchSize: 4,
      stateFillMaxConcurrentBatches: 2
    });

    const input = buildInput('state', state, {
      playerInput: '继续探索',
      logs: [
        { sender: '旁白', text: '她离开酒馆继续前进。' }
      ],
      appliedCommands: []
    });

    const payload = JSON.parse(String(input || '{}'));
    expect(payload.经济语义锚点).toBeUndefined();
    expect(payload.治理契约?.semanticScope?.context?.economyAnchorStatus).toBe('missing');
  });
});

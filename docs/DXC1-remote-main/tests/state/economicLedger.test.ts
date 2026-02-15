import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { appendEconomicLedgerEntries, collectEconomicLedgerEntries } from '../../utils/state/economicLedger';

describe('economic ledger', () => {
  it('collects delta entries for money changes', () => {
    const before = createNewGameState('Tester', '男', 'Human') as any;
    before.角色.法利 = 100;
    before.眷族.资金 = 200;

    const after = structuredClone(before);
    after.角色.法利 = 150;
    after.眷族.资金 = 120;

    const entries = collectEconomicLedgerEntries(
      before,
      after,
      [
        { action: 'add', key: 'gameState.角色.法利', value: 50 } as any,
        { action: 'add', key: 'gameState.眷族.资金', value: -80 } as any
      ],
      5,
      '第1日 10:00'
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].delta).toBe(50);
    expect(entries[1].delta).toBe(-80);
    expect(entries.every((entry) => entry.commandRef)).toBe(true);
  });

  it('appends and trims ledger entries', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const patched = appendEconomicLedgerEntries(
      state,
      [
        {
          id: 'E1',
          turn: 1,
          timestamp: '第1日 07:00',
          account: '角色.法利',
          before: 100,
          delta: -20,
          after: 80,
          reason: 'test'
        },
        {
          id: 'E2',
          turn: 2,
          timestamp: '第1日 08:00',
          account: '角色.法利',
          before: 80,
          delta: 10,
          after: 90,
          reason: 'test'
        }
      ],
      1
    );

    expect(patched.经济流水).toHaveLength(1);
    expect(patched.经济流水?.[0].id).toBe('E2');
  });
});


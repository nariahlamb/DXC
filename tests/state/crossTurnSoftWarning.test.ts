import { describe, expect, it } from 'vitest';
import type { TavernCommand } from '../../types';
import { evaluateCrossTurnSoftWarning } from '../../utils/state/crossTurnSoftWarning';

describe('cross turn soft warning', () => {
  it('emits warning signals for cross-turn commands without blocking', () => {
    const commands: TavernCommand[] = [
      { action: 'upsert_sheet_rows', turnId: 6, value: { sheetId: 'SYS_GlobalState', rows: [{ _global_id: 'GLOBAL_STATE' }] } } as any,
      { action: 'upsert_sheet_rows', turnId: 7, value: { sheetId: 'ITEM_Inventory', rows: [{ 物品ID: 'itm_1' }] } } as any
    ];
    const result = evaluateCrossTurnSoftWarning(commands, 8, {
      enabled: true,
      threshold: 1,
      sampling: 1
    });
    expect(result.count).toBe(2);
    expect(result.samples.length).toBeGreaterThan(0);
  });

  it('respects threshold and sampling configuration', () => {
    const commands: TavernCommand[] = [
      { action: 'upsert_sheet_rows', turnId: 8, value: { sheetId: 'SYS_GlobalState', rows: [{ _global_id: 'GLOBAL_STATE' }] } } as any,
      { action: 'upsert_sheet_rows', turnId: 7, value: { sheetId: 'SYS_GlobalState', rows: [{ _global_id: 'GLOBAL_STATE' }] } } as any,
      { action: 'upsert_sheet_rows', turnId: 5, value: { sheetId: 'SYS_GlobalState', rows: [{ _global_id: 'GLOBAL_STATE' }] } } as any
    ];
    const result = evaluateCrossTurnSoftWarning(commands, 8, {
      enabled: true,
      threshold: 2,
      sampling: 2
    });
    expect(result.threshold).toBe(2);
    expect(result.sampling).toBe(2);
    expect(result.count).toBeLessThanOrEqual(1);
  });
});

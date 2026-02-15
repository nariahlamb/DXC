import { describe, expect, it } from 'vitest';
import { diffStateVariableSnapshots, evaluateStateVariableReplayGate } from '../../utils/taverndb/stateVariableDiff';

describe('state variable diff', () => {
  it('returns matched=true when pilot sheets are identical', () => {
    const baseline = {
      SYS_GlobalState: {
        keyField: '_global_id',
        rows: [{ _global_id: 'GLOBAL_STATE', 当前场景: '公会大厅', 游戏时间: '第1日 07:10' }]
      },
      CHARACTER_Resources: {
        keyField: 'CHAR_ID',
        rows: [{ CHAR_ID: 'PLAYER', 法利: 1200 }]
      },
      ITEM_Inventory: {
        keyField: '物品ID',
        rows: [{ 物品ID: 'itm_001', 物品名称: '短剑', 数量: 1 }]
      }
    };

    const result = diffStateVariableSnapshots(baseline, structuredClone(baseline));
    expect(result.matched).toBe(true);
    expect(result.totals.changedCells).toBe(0);
    expect(result.totals.missingInReplay).toBe(0);
    expect(result.totals.missingInBaseline).toBe(0);
    expect(result.noiseTotals.duplicateKeyRows).toBe(0);
  });

  it('reports missing rows and changed cells', () => {
    const baseline = {
      SYS_GlobalState: {
        keyField: '_global_id',
        rows: [{ _global_id: 'GLOBAL_STATE', 当前场景: '公会大厅', 游戏时间: '第1日 07:10' }]
      },
      CHARACTER_Resources: {
        keyField: 'CHAR_ID',
        rows: [{ CHAR_ID: 'PLAYER', 法利: 1200 }]
      },
      ITEM_Inventory: {
        keyField: '物品ID',
        rows: [{ 物品ID: 'itm_001', 物品名称: '短剑', 数量: 1 }]
      }
    };
    const replay = {
      SYS_GlobalState: {
        keyField: '_global_id',
        rows: [{ _global_id: 'GLOBAL_STATE', 当前场景: '巴别塔', 游戏时间: '第1日 07:10' }]
      },
      CHARACTER_Resources: {
        keyField: 'CHAR_ID',
        rows: []
      },
      ITEM_Inventory: {
        keyField: '物品ID',
        rows: [{ 物品ID: 'itm_001', 物品名称: '短剑', 数量: 3 }]
      }
    };

    const result = diffStateVariableSnapshots(baseline, replay);
    expect(result.matched).toBe(false);
    expect(result.totals.missingInReplay).toBe(1);
    expect(result.totals.changedRows).toBeGreaterThanOrEqual(2);
    expect(result.totals.changedCells).toBeGreaterThanOrEqual(2);
  });

  it('reports noise diagnostics for missing key/duplicate key and row order changes', () => {
    const baseline = {
      ITEM_Inventory: {
        keyField: '物品ID',
        rows: [
          { 物品ID: 'itm_1', 数量: 1 },
          { 物品ID: '', 数量: 2 },
          { 物品ID: 'itm_dup', 数量: 3 },
          { 物品ID: 'itm_dup', 数量: 4 }
        ]
      }
    };
    const replay = {
      ITEM_Inventory: {
        keyField: '物品ID',
        rows: [
          { 物品ID: 'itm_dup', 数量: 3 },
          { 物品ID: 'itm_1', 数量: 1 },
          { 数量: 9 }
        ]
      }
    };
    const result = diffStateVariableSnapshots(baseline as any, replay as any);
    const sheet = result.sheetSummaries.find((item) => item.sheetId === 'ITEM_Inventory');
    expect(sheet).toBeTruthy();
    expect(sheet?.noise.missingKeyFieldRowsBaseline).toBe(1);
    expect(sheet?.noise.duplicateKeyRowsBaseline).toBe(1);
    expect(sheet?.noise.rowOrderChanged).toBe(true);
    expect(result.noiseTotals.missingKeyFieldRows).toBeGreaterThanOrEqual(2);
    expect(result.noiseTotals.duplicateKeyRows).toBeGreaterThanOrEqual(1);
    expect(result.noiseTotals.rowOrderChanges).toBeGreaterThanOrEqual(1);
  });

  it('evaluates replay gate status from diff totals and invalid rows', () => {
    const diff = diffStateVariableSnapshots({
      SYS_GlobalState: {
        keyField: '_global_id',
        rows: [{ _global_id: 'GLOBAL_STATE', 当前场景: 'A' }]
      }
    } as any, {
      SYS_GlobalState: {
        keyField: '_global_id',
        rows: [{ _global_id: 'GLOBAL_STATE', 当前场景: 'B' }]
      }
    } as any);
    const gate = evaluateStateVariableReplayGate({
      diff,
      invalidRows: 2
    });
    expect(gate.status).toBe('warn');
    expect(gate.reasons.length).toBeGreaterThan(0);
  });

  it('treats object field-order differences as equal via stable stringify', () => {
    const baseline = {
      SYS_GlobalState: {
        keyField: '_global_id',
        rows: [{ _global_id: 'GLOBAL_STATE', 扩展: { b: 2, a: 1 } }]
      }
    };
    const replay = {
      SYS_GlobalState: {
        keyField: '_global_id',
        rows: [{ _global_id: 'GLOBAL_STATE', 扩展: { a: 1, b: 2 } }]
      }
    };
    const result = diffStateVariableSnapshots(baseline as any, replay as any);
    expect(result.matched).toBe(true);
    expect(result.totals.changedCells).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import type { TavernDBProjectedTable, TavernDBSheetPatch } from '../../types/taverndb';
import { TableStore } from '../../utils/taverndb/tableStore';

describe('TableStore', () => {
  it('supports upsert/select/getById', () => {
    const store = new TableStore();

    store.upsert('NPC_Registry', { NPC_ID: 'NPC_001', 姓名: '赫斯缇雅' });
    store.upsert('NPC_Registry', { NPC_ID: 'NPC_001', 姓名: '赫斯缇雅', 当前状态: '在场' });

    const rows = store.select('NPC_Registry');
    expect(rows).toHaveLength(1);
    expect(rows[0].姓名).toBe('赫斯缇雅');
    expect(rows[0].当前状态).toBe('在场');

    const row = store.getById('NPC_Registry', 'NPC_001');
    expect(row?.NPC_ID).toBe('NPC_001');
  });

  it('supports delete by row id', () => {
    const store = new TableStore();
    store.upsert('ECON_Ledger', { ledger_id: 'ECO_1', delta: 10 });
    store.upsert('ECON_Ledger', { ledger_id: 'ECO_2', delta: -5 });

    expect(store.delete('ECON_Ledger', 'ECO_1')).toBe(true);
    expect(store.delete('ECON_Ledger', 'ECO_404')).toBe(false);
    expect(store.select('ECON_Ledger')).toHaveLength(1);
    expect(store.select('ECON_Ledger')[0].ledger_id).toBe('ECO_2');
  });

  it('applies sheet patches in order', () => {
    const store = new TableStore();
    const patches: TavernDBSheetPatch[] = [
      {
        sheetId: 'LOG_Summary',
        operation: 'upsert',
        rowId: 'AM0001',
        row: { 编码索引: 'AM0001', 纪要: '进入地下城' }
      },
      {
        sheetId: 'LOG_Summary',
        operation: 'upsert',
        rowId: 'AM0002',
        row: { 编码索引: 'AM0002', 纪要: '撤离据点' }
      },
      {
        sheetId: 'LOG_Summary',
        operation: 'delete',
        rowId: 'AM0001'
      }
    ];

    store.applyPatches(patches);
    const rows = store.select('LOG_Summary');
    expect(rows).toHaveLength(1);
    expect(rows[0].编码索引).toBe('AM0002');
  });

  it('builds store from projected tables', () => {
    const tables: TavernDBProjectedTable[] = [
      {
        id: 'ECON_Ledger',
        label: '经济流水',
        columns: ['ledger_id', 'delta'],
        rows: [
          { ledger_id: 'E1', delta: 20 },
          { ledger_id: 'E2', delta: -10 }
        ]
      }
    ];

    const store = TableStore.fromProjectedTables(tables);
    expect(store.getById('ECON_Ledger', 'E1')?.delta).toBe(20);
    expect(store.select('ECON_Ledger')).toHaveLength(2);
  });

  it('rejects patch when expected sheet version mismatches', () => {
    const store = TableStore.fromRuntimeMeta({
      sheetVersions: {
        LOG_Summary: 3
      }
    });

    const report = store.applyPatchesWithReport([
      {
        sheetId: 'LOG_Summary',
        operation: 'upsert',
        rowId: 'AM0001',
        row: { 编码索引: 'AM0001', 摘要: '版本冲突' },
        expectedSheetVersion: 2
      }
    ]);

    expect(report.applied).toBe(0);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0].reason).toBe('sheet_version_conflict');
  });

  it('blocks row update when row lock owner differs', () => {
    const store = new TableStore();
    store.lockRow({
      sheetId: 'LOG_Summary',
      rowId: 'AM0002',
      owner: 'am-special'
    });

    const blocked = store.applyPatchesWithReport([
      {
        sheetId: 'LOG_Summary',
        operation: 'upsert',
        rowId: 'AM0002',
        row: { 编码索引: 'AM0002', 摘要: 'should block' },
        lockOwner: 'memory'
      }
    ]);
    expect(blocked.applied).toBe(0);
    expect(blocked.conflicts[0].reason).toBe('row_locked');

    const allowed = store.applyPatchesWithReport([
      {
        sheetId: 'LOG_Summary',
        operation: 'upsert',
        rowId: 'AM0002',
        row: { 编码索引: 'AM0002', 摘要: 'allowed' },
        lockOwner: 'am-special'
      }
    ]);
    expect(allowed.applied).toBe(1);
    expect(allowed.conflicts).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { handleUpsertSheetRows } from '../../hooks/gameLogic/extendedCommands';
import { projectGameStateToTavernTables } from '../../utils/taverndb/tableProjection';

describe('state variable audit tables', () => {
  it('supports upsert and projection for SYS_StateVarEventLog/SYS_StateVarApplyLog', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;

    const eventResult = handleUpsertSheetRows(state, {
      sheetId: 'SYS_StateVarEventLog',
      keyField: 'event_id',
      rows: [
        {
          event_id: 'evt_001',
          turn_id: '12',
          source: 'runtime:state-variable-bridge',
          domain: 'global_state',
          entity_id: 'GLOBAL',
          path: 'sheet.SYS_GlobalState.GLOBAL',
          op: 'upsert',
          idempotency_key: '12::runtime:state-variable-bridge::global_state::GLOBAL',
          expected_version: 1,
          payload: '{"当前场景":"公会本部"}',
          created_at: Date.now()
        }
      ]
    });
    const applyResult = handleUpsertSheetRows(state, {
      sheetId: 'SYS_StateVarApplyLog',
      keyField: 'apply_id',
      rows: [
        {
          apply_id: 'apply_001',
          event_id: 'evt_001',
          tx_id: 'tx_001',
          sheet_id: 'SYS_GlobalState',
          row_id: 'GLOBAL',
          result: 'applied',
          conflict_reason: '',
          retry_count: 0,
          latency_ms: 18,
          applied_at: Date.now()
        }
      ]
    });

    expect(eventResult.success).toBe(true);
    expect(applyResult.success).toBe(true);

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: false });
    const eventLogTable = tables.find((table) => table.id === 'SYS_StateVarEventLog');
    const applyLogTable = tables.find((table) => table.id === 'SYS_StateVarApplyLog');

    expect(eventLogTable).toBeDefined();
    expect(applyLogTable).toBeDefined();
    expect(eventLogTable?.rows.length).toBe(1);
    expect(applyLogTable?.rows.length).toBe(1);
    expect(eventLogTable?.rows[0]?.event_id).toBe('evt_001');
    expect(applyLogTable?.rows[0]?.apply_id).toBe('apply_001');
  });
});

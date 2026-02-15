import { describe, expect, it } from 'vitest';
import type { TavernCommand } from '../../types';
import { applyTurnTransaction } from '../../utils/taverndb/turnTransaction';

describe('state writer conflict injection', () => {
  it('rejects non-writer source on cutover sheets and records source_not_allowed', () => {
    const baseState: any = { 回合数: 1, 日志: [] };
    const commands: TavernCommand[] = [
      { action: 'upsert_sheet_rows', source: 'ms:state' } as TavernCommand
    ];

    const result = applyTurnTransaction(
      baseState,
      commands,
      (state) => ({
        newState: { ...state },
        logs: [],
        sheetPatches: [
          {
            sheetId: 'SYS_GlobalState',
            operation: 'upsert',
            rowId: 'GLOBAL_STATE',
            row: { _global_id: 'GLOBAL_STATE', 当前场景: '公会大厅' },
            source: 'ms:state'
          }
        ] as any
      }),
      {
        forceAtomic: true,
        sourceOwnershipRules: {
          protectedSheets: ['SYS_GlobalState'],
          allowedSourcePrefixes: ['ms:state-writer']
        }
      }
    );

    expect(result.rolledBack).toBe(true);
    expect(result.hasError).toBe(true);
    expect(Number((result.newState as any)?.__tableMeta?.conflictStats?.byReason?.source_not_allowed || 0)).toBeGreaterThan(0);
  });

  it('keeps writer-source path but blocks stale row version conflicts', () => {
    const baseState: any = {
      回合数: 1,
      日志: [],
      __tableMeta: {
        rowVersions: {
          'SYS_GlobalState::GLOBAL_STATE': 5
        }
      }
    };
    const commands: TavernCommand[] = [
      { action: 'upsert_sheet_rows', source: 'ms:state-writer' } as TavernCommand
    ];

    const result = applyTurnTransaction(
      baseState,
      commands,
      (state) => ({
        newState: { ...state },
        logs: [],
        sheetPatches: [
          {
            sheetId: 'SYS_GlobalState',
            operation: 'upsert',
            rowId: 'GLOBAL_STATE',
            row: { _global_id: 'GLOBAL_STATE', 当前场景: '巴别塔' },
            source: 'ms:state-writer',
            expectedRowVersion: 2
          }
        ] as any
      }),
      {
        forceAtomic: true,
        sourceOwnershipRules: {
          protectedSheets: ['SYS_GlobalState'],
          allowedSourcePrefixes: ['ms:state-writer']
        }
      }
    );

    expect(result.rolledBack).toBe(true);
    expect(result.hasError).toBe(true);
    expect(Number((result.newState as any)?.__tableMeta?.conflictStats?.byReason?.row_version_conflict || 0)).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import type { TavernCommand } from '../../types';
import { applyTurnTransaction } from '../../utils/taverndb/turnTransaction';

describe('state writer cutover - character resources', () => {
  it('allows writer source for CHARACTER_Resources when cutover is enabled', () => {
    const baseState: any = {
      回合数: 2,
      日志: [],
      __tableMeta: {
        sheetVersions: {
          CHARACTER_Resources: 1
        },
        rowVersions: {
          'CHARACTER_Resources::PLAYER': 1
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
            sheetId: 'CHARACTER_Resources',
            operation: 'upsert',
            rowId: 'PLAYER',
            row: { CHAR_ID: 'PLAYER', 法利: 1888 },
            source: 'ms:state-writer'
          }
        ] as any
      }),
      {
        forceAtomic: true,
        sourceOwnershipRules: {
          protectedSheets: ['CHARACTER_Resources'],
          allowedSourcePrefixes: ['ms:state-writer']
        }
      }
    );

    expect(result.rolledBack).toBe(false);
    expect(result.hasError).toBeFalsy();
    expect(result.appliedPatches).toBe(1);
    expect(Number((result.newState as any)?.__tableMeta?.conflictStats?.byReason?.source_not_allowed || 0)).toBe(0);
  });
});

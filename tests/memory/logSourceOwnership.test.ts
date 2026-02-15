import { describe, expect, it } from 'vitest';
import { applyTurnTransaction } from '../../utils/taverndb/turnTransaction';
import { TavernCommand } from '../../types';

describe('LOG sheet source ownership', () => {
  it('blocks non-ms:memory patches for LOG sheets', () => {
    const initialState: any = {
      __tableMeta: {
        sheetVersions: {
          LOG_Summary: 1
        }
      }
    };
    const commands: TavernCommand[] = [
      { action: 'upsert_sheet_rows', value: {} }
    ];

    const result = applyTurnTransaction(initialState, commands, () => ({
      newState: { changed: true },
      hasError: false,
      logs: [],
      sheetPatches: [
        {
          sheetId: 'LOG_Summary',
          operation: 'upsert',
          rowId: 'AM0009',
          row: { 编码索引: 'AM0009', 摘要: '非法来源写入' },
          source: 'story'
        }
      ]
    }));

    expect(result.rolledBack).toBe(true);
    expect(result.hasError).toBe(true);
    expect(result.logs.some((log) => String(log.text).includes('source_not_allowed'))).toBe(true);
    expect((result.newState as any)?.__tableMeta?.conflictStats?.byReason?.source_not_allowed).toBeGreaterThanOrEqual(1);
  });

  it('allows ms:memory patches for LOG sheets', () => {
    const initialState: any = {
      __tableMeta: {
        sheetVersions: {
          LOG_Summary: 1
        }
      }
    };
    const commands: TavernCommand[] = [
      { action: 'upsert_sheet_rows', value: {} },
      { action: 'upsert_sheet_rows', value: {} }
    ];

    const result = applyTurnTransaction(initialState, commands, () => ({
      newState: { changed: true },
      hasError: false,
      logs: [],
      sheetPatches: [
        {
          sheetId: 'LOG_Summary',
          operation: 'upsert',
          rowId: 'AM0010',
          row: { 编码索引: 'AM0010', 摘要: 'memory写入' },
          source: 'ms:memory'
        }
      ]
    }), { forceAtomic: true });

    expect(result.rolledBack).toBe(false);
    expect((result.newState as any)?.__tableMeta?.sheetVersions?.LOG_Summary).toBe(2);
    expect(result.logs.some((log) => String(log.text).includes('提交成功'))).toBe(true);
  });
});

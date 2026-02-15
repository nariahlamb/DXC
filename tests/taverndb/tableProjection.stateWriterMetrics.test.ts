import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { projectGameStateToTavernTables } from '../../utils/taverndb/tableProjection';

describe('table projection state writer metrics', () => {
  it('projects writer shadow/queue/failure metrics into SYS_ValidationIssue', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.回合数 = 12;
    state.游戏时间 = '第2日 15:30';
    state.__stateVarWriterShadow = {
      eventCount: 6,
      skippedCount: 2,
      commandCount: 4,
      auditCommandCount: 2,
      updatedAt: Date.now()
    };
    state.__stateVarWriter = {
      metrics: {
        backlog: 3,
        retryCount: 1,
        skipByReason: {
          duplicate_idempotency: 2,
          stale_event: 1,
          invalid_event: 0,
          no_command: 0
        },
        failedByDomain: {
          inventory: 2,
          character_resources: 1
        }
      }
    };
    state.__tableMeta = {
      conflictStats: {
        total: 5,
        byReason: {
          idempotency_conflict: 2,
          stale_event: 1
        }
      }
    };
    state.__stateVarDiagnostics = {
      lastStateRun: {
        rollbackReason: 'sheet_version_conflict',
        writerSkipped: 3,
        fallback: 'applied'
      },
      replay: {
        invalidRows: 2,
        totals: {
          missingInReplay: 1,
          missingInBaseline: 0,
          changedRows: 1,
          changedCells: 2
        },
        noiseTotals: {
          missingKeyFieldRows: 1,
          duplicateKeyRows: 1,
          rowOrderChanges: 0
        },
        gate: {
          status: 'warn',
          thresholds: {
            invalidRowsWarn: 1,
            invalidRowsError: 3
          }
        }
      }
    };

    const tables = projectGameStateToTavernTables(state, { includeEmptySheets: true });
    const issueTable = tables.find((table) => table.id === 'SYS_ValidationIssue');
    expect(issueTable).toBeDefined();

    const rows = issueTable?.rows || [];
    const shadowMetric = rows.find((row: any) => row.issue_id === 'METRIC_STATE_WRITER_SHADOW');
    const queueMetric = rows.find((row: any) => row.issue_id === 'METRIC_STATE_WRITER_QUEUE');
    const failureMetric = rows.find((row: any) => row.issue_id === 'METRIC_STATE_WRITER_FAILURE_DIST');
    const outcomeMetric = rows.find((row: any) => row.issue_id === 'METRIC_STATE_RUN_OUTCOME');
    const replayGateMetric = rows.find((row: any) => row.issue_id === 'METRIC_STATE_REPLAY_GATE');

    expect(String(shadowMetric?.message || '')).toContain('events=6');
    expect(String(shadowMetric?.message || '')).toContain('skipped=2');
    expect(String(queueMetric?.message || '')).toContain('backlog=3');
    expect(String(queueMetric?.message || '')).toContain('retry=1');
    expect(String(failureMetric?.message || '')).toContain('inventory:2');
    expect(String(failureMetric?.message || '')).toContain('idempotency_conflict=2');
    expect(String(failureMetric?.message || '')).toContain('stale_event=1');
    expect(String(failureMetric?.message || '')).toContain('skip(dup=2');
    expect(String(outcomeMetric?.message || '')).toContain('rollback=sheet_version_conflict');
    expect(String(replayGateMetric?.message || '')).toContain('status=warn');
  });
});

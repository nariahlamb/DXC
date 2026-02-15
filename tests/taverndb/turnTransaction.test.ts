import { describe, expect, it } from 'vitest';
import { applyTurnTransaction } from '../../utils/taverndb/turnTransaction';
import { TavernCommand } from '../../types';

describe('turn transaction', () => {
  it('rolls back when transactional command batch has errors', () => {
    const initialState = { hp: 10, mode: 'combat' };
    const commands: TavernCommand[] = [
      { action: 'set_action_economy', value: { 回合: 3, 资源: [] } },
      { action: 'resolve_attack_check', value: { 行动者: 'A' } }
    ];

    const result = applyTurnTransaction(initialState, commands, () => ({
      newState: { hp: 0, mode: 'combat' },
      hasError: true,
      logs: [
        {
          id: 'sys-1',
          sender: '系统',
          text: '指令验证失败 [resolve_attack_check]: invalid payload',
          timestamp: Date.now(),
          type: 'system'
        }
      ]
    }));

    expect(result.rolledBack).toBe(true);
    expect((result.newState as any).hp).toBe(initialState.hp);
    expect((result.newState as any).mode).toBe(initialState.mode);
    expect(result.logs.some((log) => String(log.text).includes('回合事务回滚'))).toBe(true);
    expect(Array.isArray((result.newState as any)?.__tableMeta?.txJournal)).toBe(true);
    const journal = (result.newState as any)?.__tableMeta?.txJournal || [];
    expect(journal[journal.length - 1]?.reason).toBe('apply_error');
  });

  it('keeps non-transactional command result even when command has errors', () => {
    const initialState = { location: 'A' };
    const commands: TavernCommand[] = [
      { action: 'set', key: 'gameState.当前地点', value: 'B' }
    ];

    const result = applyTurnTransaction(initialState, commands, () => ({
      newState: { location: 'B' },
      hasError: true,
      logs: [
        {
          id: 'sys-2',
          sender: '系统',
          text: '路径更新失败',
          timestamp: Date.now(),
          type: 'system'
        }
      ]
    }));

    expect(result.rolledBack).toBe(false);
    expect(result.newState).toEqual({ location: 'B' });
  });

  it('rolls back when transaction marker is provided', () => {
    const initialState = { turn: 2, stamina: 10 };
    const commands = [
      { action: 'set', key: 'gameState.角色.体力', value: 5, transactionId: 'turn-2' },
      { action: 'set', key: 'gameState.角色.精神力', value: 0, transactionId: 'turn-2' }
    ] as TavernCommand[];

    const result = applyTurnTransaction(initialState, commands, () => ({
      newState: { turn: 2, stamina: 5 },
      hasError: true,
      logs: []
    }));

    expect(result.rolledBack).toBe(true);
    expect((result.newState as any).turn).toBe(initialState.turn);
    expect((result.newState as any).stamina).toBe(initialState.stamina);
    expect(Array.isArray((result.newState as any)?.__tableMeta?.txJournal)).toBe(true);
  });

  it('rolls back when optimistic sheet version check fails', () => {
    const initialState: any = {
      hp: 10,
      __tableMeta: {
        sheetVersions: {
          LOG_Summary: 5
        }
      }
    };
    const commands: TavernCommand[] = [
      { action: 'set_action_economy', value: { 回合: 3, 资源: [] } },
      { action: 'resolve_attack_check', value: { 行动者: 'A' } }
    ];

    const result = applyTurnTransaction(initialState, commands, () => ({
      newState: { hp: 9 },
      hasError: false,
      logs: [],
      sheetPatches: [
        {
          sheetId: 'LOG_Summary',
          operation: 'upsert',
          rowId: 'AM0009',
          row: { 编码索引: 'AM0009', 摘要: 'conflict' },
          expectedSheetVersion: 4,
          source: 'ms:memory'
        }
      ]
    }));

    expect(result.rolledBack).toBe(true);
    expect(result.hasError).toBe(true);
    expect(result.logs.some((log) => String(log.text).includes('并发冲突'))).toBe(true);
    expect((result.newState as any)?.__tableMeta?.conflictStats?.total).toBeGreaterThanOrEqual(1);
    const journal = (result.newState as any)?.__tableMeta?.txJournal || [];
    expect(journal[journal.length - 1]?.reason).toBe('sheet_version_conflict');
  });

  it('updates runtime table meta on successful patch commit', () => {
    const initialState: any = {
      hp: 10,
      __tableMeta: {
        sheetVersions: {
          LOG_Summary: 1
        }
      }
    };
    const commands: TavernCommand[] = [
      { action: 'set_action_economy', value: { 回合: 3, 资源: [] } },
      { action: 'resolve_attack_check', value: { 行动者: 'A' } }
    ];

    const result = applyTurnTransaction(initialState, commands, () => ({
      newState: { hp: 9 },
      hasError: false,
      logs: [],
      sheetPatches: [
        {
          sheetId: 'LOG_Summary',
          operation: 'upsert',
          rowId: 'AM0010',
          row: { 编码索引: 'AM0010', 摘要: 'ok' },
          expectedSheetVersion: 1,
          source: 'ms:memory'
        }
      ]
    }));

    expect(result.rolledBack).toBe(false);
    expect((result.newState as any)?.__tableMeta?.sheetVersions?.LOG_Summary).toBe(2);
    const txJournal = (result.newState as any)?.__tableMeta?.txJournal || [];
    expect(txJournal.length).toBeGreaterThan(0);
    expect(txJournal[txJournal.length - 1]?.status).toBe('committed');
  });

  it('maps source ownership block to source_not_allowed rollback reason', () => {
    const initialState: any = {
      __tableMeta: {
        sheetVersions: {
          LOG_Summary: 1
        }
      }
    };
    const commands: TavernCommand[] = [
      { action: 'set_action_economy', value: { 回合: 3, 资源: [] } },
      { action: 'resolve_attack_check', value: { 行动者: 'A' } }
    ];
    const result = applyTurnTransaction(initialState, commands, () => ({
      newState: {},
      hasError: false,
      logs: [],
      sheetPatches: [
        {
          sheetId: 'LOG_Summary',
          operation: 'upsert',
          rowId: 'AM0011',
          row: { 编码索引: 'AM0011', 摘要: 'blocked' },
          expectedSheetVersion: 1,
          source: 'ms:state'
        }
      ]
    }));
    expect(result.rolledBack).toBe(true);
    const journal = (result.newState as any)?.__tableMeta?.txJournal || [];
    expect(journal[journal.length - 1]?.reason).toBe('source_not_allowed');
  });
});

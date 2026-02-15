import { describe, expect, it } from 'vitest';
import type { TavernCommand } from '../../types';
import { buildStateVariableEventsFromCommands } from '../../utils/taverndb/stateVariableBridge';

describe('state variable bridge', () => {
  it('builds events from legacy path commands', () => {
    const commands: TavernCommand[] = [
      { action: 'set', key: 'gameState.当前场景', value: '公会大厅' },
      { action: 'add', key: 'gameState.角色.法利', value: -50 },
      { action: 'push', key: 'gameState.背包', value: { 物品ID: 'itm_001', 物品名称: '药水' } },
      { action: 'delete', key: 'gameState.LOG_Summary[0]' }
    ];

    const events = buildStateVariableEventsFromCommands(commands, {
      turnId: '21',
      source: 'runtime:test'
    });

    expect(events).toHaveLength(3);
    expect(events.map((item) => item.op)).toEqual(['set', 'add', 'push']);
    expect(events.map((item) => item.domain)).toEqual(['global_state', 'character_resources', 'inventory']);
  });

  it('builds upsert events only for pilot sheets', () => {
    const commands: TavernCommand[] = [
      {
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'SYS_GlobalState',
          rows: [{ id: 'GLOBAL', 当前场景: '巴别塔' }]
        }
      },
      {
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'LOG_Summary',
          rows: [{ 编码索引: 'AM0001', 纪要: 'memory' }]
        }
      },
      {
        action: 'upsert_sheet_rows',
        value: {
          sheetId: 'ITEM_Inventory',
          rows: [{ 物品ID: 'itm_002', 物品名称: '短剑' }]
        }
      }
    ];

    const events = buildStateVariableEventsFromCommands(commands, {
      turnId: '33',
      source: 'runtime:test',
      includeSheets: ['SYS_GlobalState', 'CHARACTER_Resources', 'ITEM_Inventory']
    });

    expect(events).toHaveLength(2);
    expect(events.every((event) => event.op === 'upsert')).toBe(true);
    expect(events.every((event) => event.path.startsWith('sheet.'))).toBe(true);
    expect(events.some((event) => event.path.includes('LOG_Summary'))).toBe(false);
  });

  it('only maps expectedRowVersion to expected_version', () => {
    const commands: TavernCommand[] = [
      {
        action: 'upsert_sheet_rows',
        expectedSheetVersion: 9,
        value: {
          sheetId: 'SYS_GlobalState',
          rows: [{ _global_id: 'GLOBAL_STATE', 当前场景: '公会大厅' }]
        }
      },
      {
        action: 'upsert_sheet_rows',
        expectedRowVersion: 3,
        value: {
          sheetId: 'ITEM_Inventory',
          rows: [{ 物品ID: 'itm_2001', 物品名称: '治疗药' }]
        }
      }
    ];

    const events = buildStateVariableEventsFromCommands(commands, {
      turnId: '34',
      source: 'runtime:test',
      includeSheets: ['SYS_GlobalState', 'ITEM_Inventory']
    });

    expect(events).toHaveLength(2);
    expect(events[0]?.expected_version).toBeUndefined();
    expect(events[1]?.expected_version).toBe(3);
  });
});

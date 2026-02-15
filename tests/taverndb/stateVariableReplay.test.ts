import { describe, expect, it } from 'vitest';
import type { TavernCommand } from '../../types';
import { createNewGameState } from '../../utils/dataMapper';
import { buildStateVariableEventsFromCommands } from '../../utils/taverndb/stateVariableBridge';
import { diffStateVariableSnapshots } from '../../utils/taverndb/stateVariableDiff';
import {
  createStateVariableEventLogRows,
  replayStateVariableEventLogFromState,
  replayStateVariableEventsToSnapshot
} from '../../utils/taverndb/stateVariableReplay';

const createReplayBaseState = () => {
  const state = createNewGameState('Tester', '男', 'Human') as any;
  state.当前地点 = '酒馆';
  state.游戏时间 = '第1日 08:00';
  state.角色 = { ...(state.角色 || {}), 法利: 100 };
  state.__tableRows = {
    ...(state.__tableRows || {}),
    SYS_GlobalState: [{
      _global_id: 'GLOBAL_STATE',
      当前场景: '酒馆',
      游戏时间: '第1日 08:00'
    }],
    CHARACTER_Resources: [{
      CHAR_ID: 'PLAYER',
      法利: 100
    }],
    ITEM_Inventory: [{
      物品ID: 'itm_old',
      物品名称: '旧药水',
      数量: 1
    }]
  };
  return state;
};

describe('state variable replay', () => {
  it('replays state variable events into pilot sheet snapshots', () => {
    const baseState = createReplayBaseState();
    const commands: TavernCommand[] = [
      { action: 'set', key: 'gameState.当前场景', value: '公会大厅' },
      { action: 'add', key: 'gameState.角色.法利', value: 50 },
      { action: 'push', key: 'gameState.背包', value: { 物品ID: 'itm_new', 物品名称: '短剑', 数量: 1 } }
    ];
    const events = buildStateVariableEventsFromCommands(commands, {
      turnId: '12',
      source: 'runtime:test-replay'
    });

    const replayed = replayStateVariableEventsToSnapshot(baseState, events);
    const globalRows = replayed.snapshot.SYS_GlobalState?.rows || [];
    const resourceRows = replayed.snapshot.CHARACTER_Resources?.rows || [];
    const inventoryRows = replayed.snapshot.ITEM_Inventory?.rows || [];

    expect(replayed.acceptedEvents).toBe(3);
    expect(replayed.skippedEvents).toBe(0);
    expect(globalRows.some((row) => String(row.当前场景 || '') === '公会大厅')).toBe(true);
    expect(resourceRows.some((row) => Number(row.法利) === 150)).toBe(true);
    expect(inventoryRows.some((row) => String(row.物品ID || '') === 'itm_new')).toBe(true);
  });

  it('replays from SYS_StateVarEventLog rows and reports invalid records', () => {
    const baseState = createReplayBaseState();
    const commands: TavernCommand[] = [
      { action: 'set', key: 'gameState.当前场景', value: '巴别塔' },
      { action: 'push', key: 'gameState.背包', value: { 物品ID: 'itm_rp', 物品名称: '回放道具', 数量: 2 } }
    ];
    const events = buildStateVariableEventsFromCommands(commands, {
      turnId: '18',
      source: 'runtime:test-event-log'
    });
    const directReplay = replayStateVariableEventsToSnapshot(baseState, events);

    const logState = structuredClone(baseState) as any;
    logState.__tableRows = {
      ...(logState.__tableRows || {}),
      SYS_StateVarEventLog: [
        ...createStateVariableEventLogRows(events),
        { event_id: 'bad_row', domain: '', payload: '{not-json' }
      ]
    };

    const replayedFromLog = replayStateVariableEventLogFromState(baseState, logState);
    const diff = diffStateVariableSnapshots(directReplay.snapshot, replayedFromLog.snapshot);

    expect(replayedFromLog.invalidEventLogRows).toBe(1);
    expect(replayedFromLog.invalidEventLogRowsByReason.missing_required).toBe(1);
    expect(replayedFromLog.acceptedEvents).toBe(events.length);
    expect(diff.matched).toBe(true);
  });

  it('supports delete event replay on inventory rows', () => {
    const baseState = createReplayBaseState();
    const commands: TavernCommand[] = [
      { action: 'delete', key: 'gameState.背包[0]', value: { 物品ID: 'itm_old' } }
    ];
    const events = buildStateVariableEventsFromCommands(commands, {
      turnId: '30',
      source: 'runtime:test-delete'
    });
    const replayed = replayStateVariableEventsToSnapshot(baseState, events);
    const inventoryRows = replayed.snapshot.ITEM_Inventory?.rows || [];
    expect(replayed.acceptedEvents).toBe(1);
    expect(inventoryRows.some((row) => String((row as any).物品ID || '') === 'itm_old')).toBe(false);
  });
});

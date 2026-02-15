import { describe, expect, it } from 'vitest';
import type { TavernCommand } from '../../types';
import { createNewGameState } from '../../utils/dataMapper';
import { buildStateVariableEventsFromCommands } from '../../utils/taverndb/stateVariableBridge';
import { createStateVariableEventLogRows, replayStateVariableEventLogFromState, replayStateVariableEventsToSnapshot } from '../../utils/taverndb/stateVariableReplay';
import { diffStateVariableSnapshots } from '../../utils/taverndb/stateVariableDiff';

const createBaseState = () => {
  const state = createNewGameState('Tester', '男', 'Human') as any;
  state.当前地点 = '欧拉丽';
  state.游戏时间 = '第2日 09:00';
  state.角色 = { ...(state.角色 || {}), 法利: 80 };
  state.__tableRows = {
    ...(state.__tableRows || {}),
    SYS_GlobalState: [{
      _global_id: 'GLOBAL_STATE',
      当前场景: '欧拉丽',
      游戏时间: '第2日 09:00'
    }],
    CHARACTER_Resources: [{
      CHAR_ID: 'PLAYER',
      法利: 80
    }],
    ITEM_Inventory: [{
      物品ID: 'itm_seed',
      物品名称: '种子道具',
      数量: 1
    }]
  };
  return state;
};

describe('state replay consistency', () => {
  it('keeps same-turn snapshot consistent after event-log replay', () => {
    const baseState = createBaseState();
    const commands: TavernCommand[] = [
      { action: 'set', key: 'gameState.当前场景', value: '公会本部' },
      { action: 'add', key: 'gameState.角色.法利', value: 20 },
      { action: 'push', key: 'gameState.背包', value: { 物品ID: 'itm_consistency', 物品名称: '一致性徽章', 数量: 1 } }
    ];
    const events = buildStateVariableEventsFromCommands(commands, {
      turnId: '27',
      source: 'runtime:consistency'
    });

    const firstReplay = replayStateVariableEventsToSnapshot(baseState, events);
    const stateWithEventLog = structuredClone(baseState) as any;
    stateWithEventLog.__tableRows = {
      ...(stateWithEventLog.__tableRows || {}),
      SYS_GlobalState: firstReplay.snapshot.SYS_GlobalState?.rows || [],
      CHARACTER_Resources: firstReplay.snapshot.CHARACTER_Resources?.rows || [],
      ITEM_Inventory: firstReplay.snapshot.ITEM_Inventory?.rows || [],
      SYS_StateVarEventLog: createStateVariableEventLogRows(events)
    };

    const replayedFromLog = replayStateVariableEventLogFromState(baseState, stateWithEventLog);
    const diff = diffStateVariableSnapshots(firstReplay.snapshot, replayedFromLog.snapshot);

    expect(replayedFromLog.invalidEventLogRows).toBe(0);
    expect(diff.matched).toBe(true);
    expect(diff.totals.changedCells).toBe(0);
  });
});

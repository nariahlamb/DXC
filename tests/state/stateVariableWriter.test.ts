import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { buildWriterCommandsFromEvent, consumeStateVariableEvents } from '../../hooks/gameLogic/microservice/stateVariableWriter';
import type { StateVariableEvent } from '../../utils/taverndb/stateVariableEvent';

const buildEvent = (partial: Partial<StateVariableEvent>): StateVariableEvent => ({
  event_id: String(partial.event_id || 'evt_1'),
  turn_id: String(partial.turn_id || '1'),
  source: String(partial.source || 'ms:state'),
  domain: String(partial.domain || 'global_state'),
  entity_id: String(partial.entity_id || 'GLOBAL'),
  path: String(partial.path || 'gameState.当前场景'),
  op: partial.op || 'set',
  value: partial.value,
  expected_version: partial.expected_version,
  idempotency_key: String(partial.idempotency_key || `k:${partial.event_id || 'evt_1'}`),
  created_at: Number(partial.created_at || Date.now())
});

describe('state variable writer', () => {
  it('maps set/add/push/delete into table commands', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.角色.法利 = 100;
    state.背包 = [{ id: 'itm_001', 物品ID: 'itm_001', 物品名称: '苹果', 数量: 2 }];

    const setCommand = buildWriterCommandsFromEvent(buildEvent({
      event_id: 'evt_set',
      domain: 'global_state',
      entity_id: 'GLOBAL',
      path: 'gameState.当前场景',
      op: 'set',
      value: '公会本部'
    }), state);
    const addCommand = buildWriterCommandsFromEvent(buildEvent({
      event_id: 'evt_add',
      domain: 'character_resources',
      entity_id: 'PLAYER',
      path: 'gameState.角色.法利',
      op: 'add',
      value: 30
    }), state);
    const pushCommand = buildWriterCommandsFromEvent(buildEvent({
      event_id: 'evt_push',
      domain: 'inventory',
      entity_id: 'INVENTORY',
      path: 'gameState.背包',
      op: 'push',
      value: { 物品ID: 'itm_002', 物品名称: '短剑', 数量: 1 }
    }), state);
    const deleteCommand = buildWriterCommandsFromEvent(buildEvent({
      event_id: 'evt_del',
      domain: 'inventory',
      entity_id: 'INVENTORY',
      path: 'gameState.背包[0]',
      op: 'delete',
      value: { 物品ID: 'itm_001' }
    }), state);
    const upsertGlobalCommand = buildWriterCommandsFromEvent(buildEvent({
      event_id: 'evt_upsert_g',
      domain: 'global_state',
      entity_id: 'GLOBAL_STATE',
      path: 'sheet.SYS_GlobalState.GLOBAL_STATE',
      op: 'upsert',
      value: { _global_id: 'GLOBAL_STATE', 游戏时间: '第1日 09:00' }
    }), state);
    const upsertResourceCommand = buildWriterCommandsFromEvent(buildEvent({
      event_id: 'evt_upsert_c',
      domain: 'character_resources',
      entity_id: 'PLAYER',
      path: 'sheet.CHARACTER_Resources.PLAYER',
      op: 'upsert',
      value: { CHAR_ID: 'PLAYER', 法利: 1666 }
    }), state);

    expect(setCommand[0]?.action).toBe('upsert_sheet_rows');
    expect((setCommand[0] as any)?.value?.sheetId).toBe('SYS_GlobalState');
    expect((addCommand[0] as any)?.value?.rows?.[0]?.法利).toBe(130);
    expect((pushCommand[0] as any)?.value?.sheetId).toBe('ITEM_Inventory');
    expect(deleteCommand[0]?.action).toBe('delete_sheet_rows');
    expect((upsertGlobalCommand[0] as any)?.value?.rows?.[0]?.游戏时间).toBe('第1日 09:00');
    expect((upsertResourceCommand[0] as any)?.value?.rows?.[0]?.法利).toBe(1666);
  });

  it('normalizes inventory quality aliases in writer commands', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const commands = buildWriterCommandsFromEvent(buildEvent({
      event_id: 'evt_quality_alias',
      domain: 'inventory',
      entity_id: 'INVENTORY',
      path: 'gameState.背包',
      op: 'push',
      value: {
        物品ID: 'itm_quality_alias',
        物品名称: '高阶灵药',
        数量: 1,
        品质: 'UR'
      }
    }), state);

    expect(commands[0]?.action).toBe('upsert_sheet_rows');
    expect((commands[0] as any)?.value?.sheetId).toBe('ITEM_Inventory');
    expect((commands[0] as any)?.value?.rows?.[0]?.品质).toBe('神话');
    expect((commands[0] as any)?.value?.rows?.[0]?.稀有度).toBe('神话');
  });

  it('deduplicates by idempotency key in consume flow', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const events = [
      buildEvent({
        event_id: 'evt_1',
        domain: 'global_state',
        path: 'gameState.当前场景',
        idempotency_key: 'same-key',
        value: '巴别塔'
      }),
      buildEvent({
        event_id: 'evt_2',
        domain: 'global_state',
        path: 'gameState.当前场景',
        idempotency_key: 'same-key',
        value: '公会大厅'
      })
    ];

    const consumed = consumeStateVariableEvents({
      stateSnapshot: state,
      events,
      shadowMode: true
    });

    expect(consumed.acceptedEvents).toHaveLength(1);
    expect(consumed.skippedEvents.some((item) => item.reason === 'duplicate_idempotency')).toBe(true);
    expect(consumed.commands).toHaveLength(1);
    expect(consumed.auditCommands).toHaveLength(2);
    expect((consumed.newState as any)?.__tableMeta?.conflictStats?.byReason?.idempotency_conflict).toBe(1);
    expect((consumed.newState as any)?.__stateVarWriter?.metrics?.acceptedCount).toBe(1);
    expect((consumed.newState as any)?.__stateVarWriter?.metrics?.skippedCount).toBe(1);
    expect((consumed.newState as any)?.__stateVarWriter?.metrics?.skipByReason?.duplicate_idempotency).toBe(1);
    expect((consumed.newState as any)?.__stateVarWriter?.metrics?.failedByDomain?.global_state).toBe(1);
  });

  it('rejects stale event by expected version and records stale_event stats', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.__tableMeta = {
      rowVersions: {
        'CHARACTER_Resources::PLAYER': 3
      }
    };
    const staleEvent = buildEvent({
      event_id: 'evt_stale',
      domain: 'character_resources',
      entity_id: 'PLAYER',
      path: 'gameState.角色.法利',
      op: 'set',
      value: 999,
      expected_version: 1,
      idempotency_key: 'stale-key'
    });

    const consumed = consumeStateVariableEvents({
      stateSnapshot: state,
      events: [staleEvent],
      shadowMode: true
    });

    expect(consumed.acceptedEvents).toHaveLength(0);
    expect(consumed.skippedEvents[0]?.reason).toBe('stale_event');
    expect(consumed.commands).toHaveLength(0);
    expect((consumed.newState as any)?.__tableMeta?.conflictStats?.byReason?.stale_event).toBe(1);
    expect((consumed.newState as any)?.__stateVarWriter?.metrics?.skipByReason?.stale_event).toBe(1);
    expect((consumed.newState as any)?.__stateVarWriter?.metrics?.failedByDomain?.character_resources).toBe(1);
  });

  it('records invalid_event and no_command skip reasons in metrics', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const noCommandEvent = buildEvent({
      event_id: 'evt_no_cmd',
      domain: 'unsupported_domain',
      path: 'gameState.不存在字段',
      op: 'upsert',
      value: { foo: 'bar' },
      idempotency_key: 'evt_no_cmd_key'
    });
    const consumed = consumeStateVariableEvents({
      stateSnapshot: state,
      events: [null as any, noCommandEvent],
      shadowMode: true
    });
    expect(consumed.acceptedEvents).toHaveLength(0);
    expect(consumed.skippedEvents).toHaveLength(2);
    expect(consumed.skippedEvents.some((item) => item.reason === 'invalid_event')).toBe(true);
    expect(consumed.skippedEvents.some((item) => item.reason === 'no_command')).toBe(true);
    expect((consumed.newState as any)?.__stateVarWriter?.metrics?.skipByReason?.invalid_event).toBe(1);
    expect((consumed.newState as any)?.__stateVarWriter?.metrics?.skipByReason?.no_command).toBe(1);
  });
});

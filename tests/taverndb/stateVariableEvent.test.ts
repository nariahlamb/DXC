import { describe, expect, it } from 'vitest';
import {
  createStateVariableEvent,
  createStateVariableEventBatchEnvelope,
  normalizeStateVariableEvent,
  validateStateVariableEvent
} from '../../utils/taverndb/stateVariableEvent';

describe('state variable event', () => {
  it('creates normalized event with generated idempotency key', () => {
    const event = createStateVariableEvent({
      turn_id: '12',
      source: 'ms:state',
      domain: 'global_state',
      entity_id: 'GLOBAL',
      path: 'sheet.SYS_GlobalState.GLOBAL',
      op: 'upsert',
      value: { 当前场景: '公会本部' }
    });

    expect(event.event_id).toContain('sve_');
    expect(event.idempotency_key).toContain('12::ms:state::global_state::GLOBAL');
    expect(event.created_at).toBeGreaterThan(0);
    expect(validateStateVariableEvent(event).success).toBe(true);
  });

  it('rejects invalid op by schema', () => {
    const parsed = validateStateVariableEvent({
      event_id: 'evt_1',
      turn_id: '2',
      source: 'ms:state',
      domain: 'global_state',
      entity_id: 'GLOBAL',
      path: 'sheet.SYS_GlobalState.GLOBAL',
      op: 'merge',
      idempotency_key: 'k',
      created_at: Date.now()
    });

    expect(parsed.success).toBe(false);
  });

  it('normalizes partial object and creates batch envelope', () => {
    const normalized = normalizeStateVariableEvent({
      turn_id: ' 5 ',
      source: 'runtime',
      domain: 'inventory',
      entity_id: ' ITM_001 ',
      path: ' sheet.ITEM_Inventory.ITM_001 ',
      op: 'set',
      value: { 数量: 2 }
    });
    const envelope = createStateVariableEventBatchEnvelope([normalized], {
      turn_id: '5',
      source: 'runtime',
      batch_id: 'batch_5'
    });

    expect(normalized.entity_id).toBe('ITM_001');
    expect(normalized.path).toBe('sheet.ITEM_Inventory.ITM_001');
    expect(envelope.events).toHaveLength(1);
    expect(envelope.batch_id).toBe('batch_5');
  });
});

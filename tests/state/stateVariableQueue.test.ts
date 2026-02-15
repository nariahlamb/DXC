import { describe, expect, it } from 'vitest';
import { createStateVariableQueue } from '../../hooks/gameLogic/microservice/stateVariableQueue';
import type { StateVariableEvent } from '../../utils/taverndb/stateVariableEvent';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const makeEvent = (eventId: string, domain: string, entityId: string): StateVariableEvent => ({
  event_id: eventId,
  turn_id: '1',
  source: 'ms:state',
  domain,
  entity_id: entityId,
  path: `sheet.${domain}.${entityId}`,
  op: 'upsert',
  value: { id: entityId },
  idempotency_key: `k:${eventId}`,
  created_at: Date.now()
});

describe('state variable queue', () => {
  it('keeps FIFO order in same partition and allows cross-partition overlap', async () => {
    const queue = createStateVariableQueue();
    const events = [
      makeEvent('A1', 'global_state', 'GLOBAL'),
      makeEvent('B1', 'inventory', 'ITM_001'),
      makeEvent('A2', 'global_state', 'GLOBAL'),
      makeEvent('B2', 'inventory', 'ITM_001')
    ];
    const traces: string[] = [];

    await queue.enqueueBatch(events, async (event) => {
      traces.push(`start:${event.event_id}`);
      if (event.event_id === 'A1') await sleep(30);
      if (event.event_id === 'B1') await sleep(5);
      traces.push(`end:${event.event_id}`);
      return event.event_id;
    });

    expect(traces.indexOf('start:A2')).toBeGreaterThan(traces.indexOf('end:A1'));
    expect(traces.indexOf('start:B2')).toBeGreaterThan(traces.indexOf('end:B1'));
    expect(traces.indexOf('start:B1')).toBeLessThan(traces.indexOf('end:A1'));
    expect(queue.getPendingPartitions()).toBe(0);
  });
});

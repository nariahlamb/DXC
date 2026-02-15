import { describe, expect, it } from 'vitest';
import { createMicroserviceQueue } from '../utils/microserviceQueue';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('microserviceQueue', () => {
  it('runs higher priority first and keeps FIFO for same priority', async () => {
    const queue = createMicroserviceQueue();
    const order: string[] = [];

    queue.enqueue(() => { order.push('p5-a'); }, { priority: 5 });
    queue.enqueue(() => { order.push('p1'); }, { priority: 1 });
    queue.enqueue(() => { order.push('p5-b'); }, { priority: 5 });

    await queue.drain();

    expect(order).toEqual(['p1', 'p5-a', 'p5-b']);
  });

  it('allows another lane to run while slow memory task is pending', async () => {
    const queue = createMicroserviceQueue({
      maxConcurrent: 2,
      laneConcurrency: { default: 1, memory: 1, state: 1 }
    });
    const events: string[] = [];

    let releaseMemory: (() => void) | null = null;
    const memoryGate = new Promise<void>((resolve) => {
      releaseMemory = resolve;
    });
    let resolveState: (() => void) | null = null;
    const stateDone = new Promise<void>((resolve) => {
      resolveState = resolve;
    });

    queue.enqueue(async () => {
      events.push('memory-start');
      await memoryGate;
      events.push('memory-end');
    }, { priority: 1, lane: 'memory' });

    queue.enqueue(async () => {
      events.push('state-run');
      resolveState?.();
    }, { priority: 7, lane: 'state' });

    await stateDone;
    expect(events).toContain('state-run');
    expect(events).not.toContain('memory-end');

    releaseMemory?.();
    await queue.drain();

    expect(events.indexOf('memory-start')).toBeLessThan(events.indexOf('state-run'));
    expect(events[events.length - 1]).toBe('memory-end');
  });

  it('serializes tasks within the same lane even with multiple workers', async () => {
    const queue = createMicroserviceQueue({
      maxConcurrent: 2,
      laneConcurrency: { default: 1, memory: 1 }
    });
    const events: string[] = [];

    let releaseFirst: (() => void) | null = null;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    queue.enqueue(async () => {
      events.push('first-start');
      await firstGate;
      events.push('first-end');
    }, { priority: 1, lane: 'memory' });

    queue.enqueue(async () => {
      events.push('second-run');
    }, { priority: 1, lane: 'memory' });

    await wait(0);
    expect(events).toEqual(['first-start']);

    releaseFirst?.();
    await queue.drain();

    expect(events).toEqual(['first-start', 'first-end', 'second-run']);
  });

  it('drain waits for completion and task errors do not break subsequent tasks', async () => {
    const queue = createMicroserviceQueue();
    const events: string[] = [];

    queue.enqueue(async () => {
      events.push('slow-start');
      await wait(10);
      events.push('slow-end');
    }, { priority: 2 });

    queue.enqueue(() => {
      throw new Error('boom');
    }, { priority: 3 });

    queue.enqueue(() => {
      events.push('after-error');
    }, { priority: 4 });

    await queue.drain();

    expect(events).toEqual(['slow-start', 'slow-end', 'after-error']);
  });
});

import type { StateVariableEvent } from '../../../utils/taverndb/stateVariableEvent';

export type StateVariableQueueConsumer<T = unknown> = (event: StateVariableEvent) => Promise<T> | T;

export type StateVariableQueueOptions = {
  resolvePartitionKey?: (event: StateVariableEvent) => string;
};

const defaultPartitionKey = (event: StateVariableEvent): string => {
  return `${String(event.domain || 'unknown')}::${String(event.entity_id || 'entity')}`;
};

export class StateVariableQueue {
  private readonly resolvePartitionKey: (event: StateVariableEvent) => string;

  private readonly partitionTails = new Map<string, Promise<void>>();

  constructor(options: StateVariableQueueOptions = {}) {
    this.resolvePartitionKey = options.resolvePartitionKey || defaultPartitionKey;
  }

  enqueue<T>(event: StateVariableEvent, consumer: StateVariableQueueConsumer<T>): Promise<T> {
    const partitionKey = this.resolvePartitionKey(event);
    const previous = this.partitionTails.get(partitionKey) || Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => Promise.resolve(consumer(event)));
    const tail = current.then(
      () => undefined,
      () => undefined
    );
    this.partitionTails.set(partitionKey, tail);
    void tail.finally(() => {
      if (this.partitionTails.get(partitionKey) === tail) {
        this.partitionTails.delete(partitionKey);
      }
    });
    return current;
  }

  async enqueueBatch<T>(events: StateVariableEvent[], consumer: StateVariableQueueConsumer<T>): Promise<T[]> {
    const list = Array.isArray(events) ? events : [];
    const tasks = list.map((event) => this.enqueue(event, consumer));
    return Promise.all(tasks);
  }

  getPendingPartitions(): number {
    return this.partitionTails.size;
  }
}

export const createStateVariableQueue = (options: StateVariableQueueOptions = {}) => {
  return new StateVariableQueue(options);
};

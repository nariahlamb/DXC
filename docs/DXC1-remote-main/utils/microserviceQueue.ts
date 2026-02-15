export type MicroserviceTask<T = unknown> = () => Promise<T> | T;

export type MicroserviceTaskOptions = {
  priority?: number;
  lane?: string;
};

export type MicroserviceQueueOptions = {
  maxConcurrent?: number;
  laneConcurrency?: Record<string, number>;
};

type QueueItem = {
  task: MicroserviceTask;
  priority: number;
  lane: string;
  seq: number;
};

const normalizeConcurrency = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.floor(parsed));
};

export const createMicroserviceQueue = (options: MicroserviceQueueOptions = {}) => {
  const tasks: QueueItem[] = [];
  const laneRunning = new Map<string, number>();
  let runningWorkers = 0;
  let scheduled = false;
  let seq = 0;
  const drainWaiters: Array<() => void> = [];
  const maxConcurrent = normalizeConcurrency(options.maxConcurrent, 1);
  const laneConcurrency = options.laneConcurrency || {};

  const shouldDebug = () => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('dxc_debug_ms') === '1';
    } catch {
      return false;
    }
  };

  const snapshot = () => ({
    queued: tasks.length,
    runningWorkers,
    scheduled,
    seq
  });

  const emitDebug = (event: string, data?: any) => {
    if (!shouldDebug()) return;
    if (typeof window !== 'undefined') {
      const w = window as any;
      if (!Array.isArray(w.__DXC_MSQ_LOG)) w.__DXC_MSQ_LOG = [];
      w.__DXC_MSQ_LOG.push({ ts: Date.now(), event, data });
      w.__DXC_MSQ_STATE = snapshot();
    }
    console.warn('[DXC][MSQ]', event, data);
  };

  const pickNextIndex = () => {
    if (tasks.length === 0) return -1;
    const resolveLaneLimit = (lane: string) => {
      const exact = laneConcurrency[lane];
      if (typeof exact === 'number') return normalizeConcurrency(exact, maxConcurrent);
      const fallback = laneConcurrency.default;
      if (typeof fallback === 'number') return normalizeConcurrency(fallback, maxConcurrent);
      return maxConcurrent;
    };
    const canRunLane = (lane: string) => {
      const active = laneRunning.get(lane) || 0;
      return active < resolveLaneLimit(lane);
    };

    let bestIndex = -1;
    let best: QueueItem | null = null;
    for (let i = 0; i < tasks.length; i += 1) {
      const current = tasks[i];
      if (!canRunLane(current.lane)) continue;
      if (!best || current.priority < best.priority) {
        best = current;
        bestIndex = i;
        continue;
      }
      if (best && current.priority === best.priority && current.seq < best.seq) {
        best = current;
        bestIndex = i;
      }
    }
    return bestIndex;
  };

  const flushDrainWaiters = () => {
    if (tasks.length > 0 || runningWorkers > 0 || scheduled) return;
    while (drainWaiters.length > 0) {
      const resolve = drainWaiters.shift();
      resolve?.();
    }
  };

  const runTask = (item: QueueItem) => {
    runningWorkers += 1;
    laneRunning.set(item.lane, (laneRunning.get(item.lane) || 0) + 1);
    emitDebug('task-start', { priority: item.priority, seq: item.seq, lane: item.lane, queued: tasks.length, runningWorkers });
    Promise.resolve()
      .then(() => item.task())
      .then(() => {
        emitDebug('task-end', { priority: item.priority, seq: item.seq, lane: item.lane, queued: tasks.length, runningWorkers });
      })
      .catch((e) => {
        console.error('Microservice task failed', e);
        emitDebug('task-error', e instanceof Error ? e.message : 'unknown error');
      })
      .finally(() => {
        runningWorkers = Math.max(0, runningWorkers - 1);
        const active = Math.max(0, (laneRunning.get(item.lane) || 0) - 1);
        if (active > 0) laneRunning.set(item.lane, active);
        else laneRunning.delete(item.lane);
        scheduleRun();
        flushDrainWaiters();
      });
  };

  const runAvailable = () => {
    while (runningWorkers < maxConcurrent) {
      const index = pickNextIndex();
      if (index < 0) break;
      const next = tasks.splice(index, 1)[0];
      runTask(next);
    }
    flushDrainWaiters();
  };

  const scheduleRun = () => {
    if (!scheduled) {
      scheduled = true;
      Promise.resolve().then(() => {
        scheduled = false;
        emitDebug('run', snapshot());
        runAvailable();
      });
    }
  };

  const enqueue = <T>(task: MicroserviceTask<T>, taskOptions: MicroserviceTaskOptions = {}) => {
    const priority = Number.isFinite(taskOptions.priority) ? (taskOptions.priority as number) : 5;
    const lane = (typeof taskOptions.lane === 'string' && taskOptions.lane.trim()) ? taskOptions.lane.trim() : 'default';
    tasks.push({ task: task as MicroserviceTask, priority, lane, seq });
    seq += 1;
    emitDebug('enqueue', { priority, lane, seq: seq - 1, queued: tasks.length });
    scheduleRun();
  };

  const drain = async () => {
    if (tasks.length === 0 && runningWorkers === 0 && !scheduled) return;
    await new Promise<void>((resolve) => {
      drainWaiters.push(resolve);
      scheduleRun();
    });
  };

  return { enqueue, drain };
};

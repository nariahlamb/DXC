import { Task, LogEntry } from '../../types';

export const matchTaskRelatedLogs = (taskKeyword: string, logs: LogEntry[] = []) => {
  const keyword = String(taskKeyword || '').trim();
  if (!keyword) return [];
  return logs.filter((log) => String(log?.text || '').includes(keyword));
};

export const collectTaskRelatedLogs = (task: Task | null | undefined, logs: LogEntry[] = []) => {
  if (!task) return [];
  const byId = matchTaskRelatedLogs(task.id, logs);
  const byTitle = matchTaskRelatedLogs(task.标题, logs);
  const map = new Map<string, LogEntry>();
  [...byId, ...byTitle].forEach((log) => {
    map.set(log.id, log);
  });
  return Array.from(map.values());
};

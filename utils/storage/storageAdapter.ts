import type { AppSettings, SaveSlot } from '../../types';
import { indexedDbStore, IdbStoreName } from './indexedDbStore';
import { localStore } from './localStore';

export type StorageSource = 'idb' | 'local';

export interface ManagedStorageItem {
  key: string;
  value: string;
  source: StorageSource;
}

const SETTINGS_KEY = 'danmachi_settings';
const GLOBAL_SETTINGS_KEY = 'danmachi_system_settings_global';
export const GITHUB_TOKEN_KEY = 'danmachi_github_token';
export const GIST_BACKUP_ID_KEY = 'danmachi_gist_backup_id';
const DEBUG_AUTO_SAVE_KEY = 'danmachi_save_auto_debug';

const MANAGED_PREFIXES = ['danmachi_', 'phantom_'];
const SAVE_KEY_PATTERN = /^danmachi_save_(auto|manual)_/;

let backend: StorageSource | null = null;

const isManagedKey = (key: string): boolean => MANAGED_PREFIXES.some(prefix => key.startsWith(prefix));

export const resolveStoreNameByKey = (key: string): IdbStoreName => {
  if (SAVE_KEY_PATTERN.test(key)) return 'saves';
  if (key === SETTINGS_KEY || key === GLOBAL_SETTINGS_KEY) return 'settings';
  if (key.includes('memory')) return 'memory';
  if (key.includes('map_snapshot')) return 'mapSnapshots';
  if (key === GITHUB_TOKEN_KEY || key === GIST_BACKUP_ID_KEY) return 'settings';
  return 'cache';
};

const ensureBackend = async (): Promise<StorageSource> => {
  if (backend) return backend;
  const ready = await indexedDbStore.isReady();
  backend = ready ? 'idb' : 'local';
  return backend;
};

const readRaw = async (key: string): Promise<string | null> => {
  const mode = await ensureBackend();
  if (mode === 'idb') {
    const fromIdb = await indexedDbStore.getItem(resolveStoreNameByKey(key), key);
    if (fromIdb !== null) return fromIdb;
  }
  return localStore.getItem(key);
};

const writeRaw = async (key: string, value: string): Promise<void> => {
  const mode = await ensureBackend();
  if (mode === 'idb') {
    const ok = await indexedDbStore.setItem(resolveStoreNameByKey(key), key, value);
    if (ok) return;
  }
  localStore.setItem(key, value);
};

export const getSaveStorageKey = (slotId: number | string): string => {
  if (String(slotId).startsWith('auto')) {
    return `danmachi_save_${slotId}`;
  }
  return `danmachi_save_manual_${slotId}`;
};

export const setManagedJson = async (key: string, value: unknown): Promise<void> => {
  await writeRaw(key, JSON.stringify(value));
};

export const getManagedJson = async <T>(key: string): Promise<T | null> => {
  const raw = await readRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[storageAdapter] parse failed: ${key}`, error);
    return null;
  }
};

export const removeManagedKey = async (key: string): Promise<void> => {
  await indexedDbStore.removeItem(resolveStoreNameByKey(key), key);
  localStore.removeItem(key);
};

export const saveSettingsToStorage = async (settings: AppSettings): Promise<void> => {
  await setManagedJson(SETTINGS_KEY, settings);
};

export const loadSettingsFromStorage = async <T extends AppSettings>(): Promise<T | null> => {
  return getManagedJson<T>(SETTINGS_KEY);
};

export const loadGlobalSystemSettings = async <T = Record<string, any>>(): Promise<T | null> => {
  return getManagedJson<T>(GLOBAL_SETTINGS_KEY);
};

export const saveGlobalSystemSettings = async (settings: Record<string, any>): Promise<void> => {
  await setManagedJson(GLOBAL_SETTINGS_KEY, settings);
};

export const saveSlotToStorage = async (slotKey: string, save: SaveSlot): Promise<void> => {
  await setManagedJson(slotKey, save);
};

export const loadSlotFromStorage = async (slotId: number | string): Promise<SaveSlot | null> => {
  const key = getSaveStorageKey(slotId);
  const parsed = await getManagedJson<SaveSlot>(key);
  if (parsed?.data) return parsed;
  const raw = await getManagedJson<any>(key);
  if (!raw) return null;
  return {
    id: slotId,
    type: String(slotId).startsWith('auto') ? 'AUTO' : 'MANUAL',
    timestamp: raw.timestamp || Date.now(),
    summary: raw.summary || '',
    data: raw.data ? raw.data : raw,
    version: raw.version
  };
};

export const listManagedStorageItems = async (): Promise<ManagedStorageItem[]> => {
  const merged = new Map<string, ManagedStorageItem>();

  localStore.entries().forEach(entry => {
    if (!isManagedKey(entry.key)) return;
    merged.set(entry.key, {
      key: entry.key,
      value: entry.value,
      source: 'local'
    });
  });

  const mode = await ensureBackend();
  if (mode === 'idb') {
    const stores: IdbStoreName[] = ['saves', 'settings', 'memory', 'mapSnapshots', 'cache'];
    for (const storeName of stores) {
      const entries = await indexedDbStore.getAll(storeName);
      entries.forEach((entry) => {
        if (!isManagedKey(entry.key)) return;
        merged.set(entry.key, {
          key: entry.key,
          value: entry.value,
          source: 'idb'
        });
      });
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.key.localeCompare(b.key));
};

export const clearManagedKeys = async (matcher: (key: string) => boolean): Promise<string[]> => {
  const entries = await listManagedStorageItems();
  const targets = entries.map(item => item.key).filter(key => matcher(key));
  await Promise.all(targets.map(key => removeManagedKey(key)));
  return targets;
};

export const loadAllSaveSlots = async (): Promise<{ manual: SaveSlot[]; auto: SaveSlot[] }> => {
  const manual: SaveSlot[] = [];
  const auto: SaveSlot[] = [];

  for (let slot = 1; slot <= 3; slot += 1) {
    const manualKey = `danmachi_save_manual_${slot}`;
    const autoKey = `danmachi_save_auto_${slot}`;

    const manualSave = await getManagedJson<any>(manualKey);
    if (manualSave) {
      manual.push({
        id: slot,
        type: 'MANUAL',
        timestamp: manualSave.timestamp || 0,
        summary: manualSave.summary || '',
        data: manualSave.data ? manualSave.data : manualSave,
        version: manualSave.version
      });
    }

    const autoSave = await getManagedJson<any>(autoKey);
    if (autoSave) {
      auto.push({
        id: `auto_${slot}`,
        type: 'AUTO',
        timestamp: autoSave.timestamp || 0,
        summary: autoSave.summary || '',
        data: autoSave.data ? autoSave.data : autoSave,
        version: autoSave.version
      });
    }
  }

  const debugAutoSave = await getManagedJson<any>(DEBUG_AUTO_SAVE_KEY);
  if (debugAutoSave) {
    auto.push({
      id: 'auto_debug',
      type: 'AUTO',
      timestamp: debugAutoSave.timestamp || 0,
      summary: debugAutoSave.summary || 'DEBUG AUTO',
      data: debugAutoSave.data ? debugAutoSave.data : debugAutoSave,
      version: debugAutoSave.version
    });
  }

  auto.sort((a, b) => b.timestamp - a.timestamp);
  return { manual, auto };
};

export const getLatestSaveSlot = async (): Promise<SaveSlot | null> => {
  const { manual, auto } = await loadAllSaveSlots();
  const candidates = [...manual, ...auto];
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.timestamp - a.timestamp);
  return candidates[0];
};

export const getStorageBackend = async (): Promise<StorageSource> => ensureBackend();

export const saveGithubToken = async (token: string): Promise<void> => {
  await setManagedJson(GITHUB_TOKEN_KEY, token);
};

export const loadGithubToken = async (): Promise<string | null> => {
  return getManagedJson<string>(GITHUB_TOKEN_KEY);
};

export const saveGistId = async (id: string): Promise<void> => {
  await setManagedJson(GIST_BACKUP_ID_KEY, id);
};

export const loadGistId = async (): Promise<string | null> => {
  return getManagedJson<string>(GIST_BACKUP_ID_KEY);
};

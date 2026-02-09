import { SaveSlot } from '../types';

const DB_NAME = 'danmachi_storage';
const DB_VERSION = 1;
const SAVE_STORE = 'saves';

interface SaveRecord extends SaveSlot {
  slotKey: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const toSlotKey = (slotId: number | string, type?: SaveSlot['type']) => {
  const text = String(slotId);
  if (text.startsWith('auto')) {
    const normalized = text.replace(/^auto[_-]?/, '');
    return `auto_${normalized}`;
  }
  if (type === 'AUTO') return `auto_${text}`;
  return `manual_${text}`;
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });

const txDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });

const getDb = async () => {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SAVE_STORE)) {
          db.createObjectStore(SAVE_STORE, { keyPath: 'slotKey' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });
  }
  return dbPromise;
};

export const putSaveSlot = async (slot: SaveSlot) => {
  const db = await getDb();
  const tx = db.transaction(SAVE_STORE, 'readwrite');
  const store = tx.objectStore(SAVE_STORE);
  const record: SaveRecord = {
    ...slot,
    slotKey: toSlotKey(slot.id, slot.type)
  };
  store.put(record);
  await txDone(tx);
};

export const getSaveSlot = async (slotId: number | string) => {
  const db = await getDb();
  const tx = db.transaction(SAVE_STORE, 'readonly');
  const store = tx.objectStore(SAVE_STORE);
  const slotKey = toSlotKey(slotId);
  const result = await requestToPromise(store.get(slotKey));
  await txDone(tx);
  if (!result) return null;
  const { slotKey: _ignore, ...slot } = result as SaveRecord;
  return slot as SaveSlot;
};

export const getAllSaveSlots = async (): Promise<SaveSlot[]> => {
  const db = await getDb();
  const tx = db.transaction(SAVE_STORE, 'readonly');
  const store = tx.objectStore(SAVE_STORE);
  const records = (await requestToPromise(store.getAll())) as SaveRecord[];
  await txDone(tx);
  return records.map(record => {
    const { slotKey: _ignore, ...slot } = record;
    return slot;
  });
};

export const clearAllSaveSlots = async () => {
  const db = await getDb();
  const tx = db.transaction(SAVE_STORE, 'readwrite');
  tx.objectStore(SAVE_STORE).clear();
  await txDone(tx);
};

export const estimateSaveStorageBytes = async () => {
  const slots = await getAllSaveSlots();
  return slots.reduce((acc, slot) => acc + new Blob([JSON.stringify(slot)]).size, 0);
};

export const migrateLegacyLocalStorageSaves = async () => {
  const legacy: SaveSlot[] = [];
  for (let i = 1; i <= 3; i++) {
    const manualRaw = localStorage.getItem(`danmachi_save_manual_${i}`);
    if (manualRaw) {
      try {
        const parsed = JSON.parse(manualRaw);
        legacy.push({
          id: i,
          type: 'MANUAL',
          timestamp: parsed.timestamp,
          summary: parsed.summary,
          data: parsed.data || parsed,
          version: parsed.version || '3.0'
        });
      } catch {
        // ignore invalid legacy save
      }
    }
    const autoRaw = localStorage.getItem(`danmachi_save_auto_${i}`);
    if (autoRaw) {
      try {
        const parsed = JSON.parse(autoRaw);
        legacy.push({
          id: `auto_${i}`,
          type: 'AUTO',
          timestamp: parsed.timestamp,
          summary: parsed.summary,
          data: parsed.data || parsed,
          version: parsed.version || '3.0'
        });
      } catch {
        // ignore invalid legacy save
      }
    }
  }
  for (const slot of legacy) {
    await putSaveSlot(slot);
  }
  for (let i = 1; i <= 3; i++) {
    localStorage.removeItem(`danmachi_save_manual_${i}`);
    localStorage.removeItem(`danmachi_save_auto_${i}`);
  }
};

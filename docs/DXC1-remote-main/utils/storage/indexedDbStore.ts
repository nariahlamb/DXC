export type IdbStoreName = 'saves' | 'settings' | 'memory' | 'mapSnapshots' | 'cache';

interface IdbRecord {
  key: string;
  value: string;
  updatedAt: number;
}

const DB_NAME = 'dxc_storage';
const DB_VERSION = 1;
const STORE_NAMES: IdbStoreName[] = ['saves', 'settings', 'memory', 'mapSnapshots', 'cache'];

let dbPromise: Promise<IDBDatabase | null> | null = null;

const canUseIndexedDB = (): boolean => {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
};

const openDb = (): Promise<IDBDatabase | null> => {
  if (!canUseIndexedDB()) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        STORE_NAMES.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'key' });
          }
        });
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[indexedDbStore] open failed', request.error);
        resolve(null);
      };
    });
  }

  return dbPromise;
};

const runTransaction = async <T>(
  storeName: IdbStoreName,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T | null> => {
  const db = await openDb();
  if (!db) return null;

  return new Promise<T>((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      action(store, resolve, reject);
      tx.onerror = () => reject(tx.error);
    } catch (error) {
      reject(error);
    }
  }).catch((error) => {
    console.warn(`[indexedDbStore] transaction failed (${storeName})`, error);
    return null;
  });
};

export const indexedDbStore = {
  async isReady(): Promise<boolean> {
    const db = await openDb();
    return !!db;
  },

  async getItem(storeName: IdbStoreName, key: string): Promise<string | null> {
    const result = await runTransaction<IdbRecord | undefined>(storeName, 'readonly', (store, resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as IdbRecord | undefined);
      request.onerror = () => reject(request.error);
    });
    return result?.value ?? null;
  },

  async setItem(storeName: IdbStoreName, key: string, value: string): Promise<boolean> {
    const result = await runTransaction<boolean>(storeName, 'readwrite', (store, resolve, reject) => {
      const request = store.put({ key, value, updatedAt: Date.now() } as IdbRecord);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
    return !!result;
  },

  async removeItem(storeName: IdbStoreName, key: string): Promise<boolean> {
    const result = await runTransaction<boolean>(storeName, 'readwrite', (store, resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
    return !!result;
  },

  async getAll(storeName: IdbStoreName): Promise<IdbRecord[]> {
    const result = await runTransaction<IdbRecord[]>(storeName, 'readonly', (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result || []) as IdbRecord[]);
      request.onerror = () => reject(request.error);
    });
    return result || [];
  }
};

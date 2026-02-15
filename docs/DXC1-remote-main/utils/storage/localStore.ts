export interface LocalStoreEntry {
  key: string;
  value: string;
}

const canUseLocalStorage = (): boolean => {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
};

export const localStore = {
  getItem(key: string): string | null {
    if (!canUseLocalStorage()) return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn('[localStore] getItem failed', error);
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (!canUseLocalStorage()) return;
    window.localStorage.setItem(key, value);
  },

  removeItem(key: string): void {
    if (!canUseLocalStorage()) return;
    window.localStorage.removeItem(key);
  },

  keys(): string[] {
    if (!canUseLocalStorage()) return [];
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key) keys.push(key);
    }
    return keys;
  },

  entries(): LocalStoreEntry[] {
    return this.keys().map((key) => ({
      key,
      value: this.getItem(key) || ''
    }));
  }
};

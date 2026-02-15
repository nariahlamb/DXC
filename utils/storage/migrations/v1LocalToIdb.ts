import { indexedDbStore } from '../indexedDbStore';
import { localStore } from '../localStore';
import { resolveStoreNameByKey } from '../storageAdapter';

const MIGRATION_KEY = 'danmachi_storage_migration_v1';
const MANAGED_PREFIXES = ['danmachi_', 'phantom_'];

const isManagedKey = (key: string): boolean => {
  return MANAGED_PREFIXES.some(prefix => key.startsWith(prefix));
};

export interface MigrationResult {
  ran: boolean;
  migrated: number;
  skipped: number;
  failed: number;
}

export const migrateLocalToIndexedDbV1 = async (): Promise<MigrationResult> => {
  const ready = await indexedDbStore.isReady();
  if (!ready) {
    return { ran: false, migrated: 0, skipped: 0, failed: 0 };
  }

  const existed = await indexedDbStore.getItem('settings', MIGRATION_KEY);
  if (existed) {
    return { ran: false, migrated: 0, skipped: 0, failed: 0 };
  }

  const keys = localStore.keys().filter(key => isManagedKey(key));
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of keys) {
    if (key === MIGRATION_KEY) {
      skipped += 1;
      continue;
    }

    const value = localStore.getItem(key);
    if (value === null) {
      skipped += 1;
      continue;
    }

    const storeName = resolveStoreNameByKey(key);
    const ok = await indexedDbStore.setItem(storeName, key, value);
    if (ok) {
      migrated += 1;
    } else {
      failed += 1;
    }
  }

  const stamp = JSON.stringify({
    version: 1,
    migratedAt: new Date().toISOString(),
    migrated,
    skipped,
    failed
  });

  await indexedDbStore.setItem('settings', MIGRATION_KEY, stamp);
  localStore.setItem(MIGRATION_KEY, stamp);

  return { ran: true, migrated, skipped, failed };
};

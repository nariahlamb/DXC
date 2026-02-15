import { describe, expect, it } from 'vitest';
import { migrateSettings } from '../../hooks/useAppSettings';

describe('useAppSettings readability migration', () => {
  it('migrates legacy settings with readability defaults', () => {
    const legacy = { fontSize: 'medium' } as any;
    const migrated = migrateSettings(legacy);

    expect(migrated.readability?.lineHeight).toBeDefined();
    expect(migrated.readability?.contrastMode).toBeDefined();
    expect(migrated.readability?.infoDensity).toBeDefined();
  });
});

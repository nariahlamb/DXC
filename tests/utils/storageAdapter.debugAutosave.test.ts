import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/storage/indexedDbStore', () => ({
  indexedDbStore: {
    isReady: vi.fn(async () => false),
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => true),
    removeItem: vi.fn(async () => true),
    getAll: vi.fn(async () => []),
  },
}));

describe('storageAdapter debug autosave', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('includes auto_debug in loadAllSaveSlots and participates in latest selection', async () => {
    const dummyState: any = { 角色: { 等级: 1 }, 当前地点: 'Test' };

    localStorage.setItem(
      'danmachi_save_auto_1',
      JSON.stringify({ timestamp: 100, summary: 'AUTO 1', data: dummyState, version: '3.0' })
    );
    localStorage.setItem(
      'danmachi_save_auto_debug',
      JSON.stringify({ timestamp: 200, summary: 'DEBUG AUTO', data: dummyState, version: '3.0' })
    );

    const mod = await import('../../utils/storage/storageAdapter');
    const slots = await mod.loadAllSaveSlots();

    expect(slots.auto.some((slot: any) => slot.id === 'auto_debug')).toBe(true);

    const latest = await mod.getLatestSaveSlot();
    expect(latest?.id).toBe('auto_debug');
  });
});


import { describe, expect, it } from 'vitest';
import {
  filterOutPlayerContacts,
  isContactNearby,
  isContactPresent,
  resolveContactDisplayName
} from '../../utils/social/contactPresence';

describe('contactPresence utilities', () => {
  it('returns true when 是否在场 is true', () => {
    expect(isContactPresent({ 是否在场: true, 当前状态: '离场' })).toBe(true);
  });

  it('returns false when 是否在场 is false', () => {
    expect(isContactPresent({ 是否在场: false, 当前状态: '在场' })).toBe(false);
  });

  it('returns true for 当前状态=在场 when boolean is missing', () => {
    expect(isContactPresent({ 当前状态: '在场' })).toBe(true);
  });

  it('returns false for 当前状态=离场', () => {
    expect(isContactPresent({ 当前状态: '离场' })).toBe(false);
  });

  it('returns false for 当前状态=死亡 or 失踪', () => {
    expect(isContactPresent({ 当前状态: '死亡' })).toBe(false);
    expect(isContactPresent({ 当前状态: '失踪' })).toBe(false);
  });

  it('returns false for empty/unknown status', () => {
    expect(isContactPresent({ 当前状态: '' })).toBe(false);
    expect(isContactPresent({ 当前状态: '未知' })).toBe(false);
  });

  it('isContactNearby reuses same result', () => {
    expect(isContactNearby({ 当前状态: '在场' })).toBe(true);
    expect(isContactNearby({ 当前状态: '离场' })).toBe(false);
  });

  it('prefers human readable contact name over generated npc code', () => {
    expect(resolveContactDisplayName({ id: 'NPC_Hestia', 姓名: '赫斯缇雅' } as any)).toBe('赫斯缇雅');
    expect(resolveContactDisplayName({ id: 'NPC_Hestia', 姓名: 'NPC_Hestia' } as any)).toBe('Hestia');
    expect(resolveContactDisplayName({ id: 'NPC_Hestia', 姓名: '人群中传来刻意压低的窃窃私语' } as any)).toBe('Hestia');
  });

  it('dedupes generated and localized records into one contact and keeps flags', () => {
    const contacts = filterOutPlayerContacts([
      { id: 'NPC_Hestia', 姓名: 'NPC_Hestia', 特别关注: true, 当前状态: '离场' },
      { id: 'NPC_Hestia', 姓名: '赫斯缇雅', 特别关注: false, 当前状态: '在场' }
    ] as any, '玩家');

    expect(contacts).toHaveLength(1);
    expect(contacts[0].姓名).toBe('赫斯缇雅');
    expect(contacts[0].特别关注).toBe(true);
    expect(contacts[0].当前状态).toBe('在场');
  });

  it('filters out narrative sentence contacts', () => {
    const contacts = filterOutPlayerContacts([
      { id: 'NPC_Hestia', 姓名: '赫斯缇雅', 当前状态: '在场' },
      { id: '人群中传来刻意压低的窃窃私语', 姓名: '人群中传来刻意压低的窃窃私语', 当前状态: '在场' }
    ] as any, '玩家');

    expect(contacts).toHaveLength(1);
    expect(contacts[0].姓名).toBe('赫斯缇雅');
  });
});

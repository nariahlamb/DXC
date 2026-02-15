import { describe, expect, it } from 'vitest';
import { isContactNearby, isContactPresent } from '../../utils/social/contactPresence';

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
});

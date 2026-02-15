import { describe, expect, it } from 'vitest';
import { formatSkillCost } from '../../utils/skillFormat';

describe('formatSkillCost', () => {
  it('formats number input', () => {
    expect(formatSkillCost(12)).toBe('12');
  });

  it('formats string input', () => {
    expect(formatSkillCost('  MP 8  ')).toBe('MP 8');
  });

  it('formats object input with normalized labels', () => {
    expect(formatSkillCost({ 精神: 10, 体力: 3 })).toBe('MP 10 · HP 3');
    expect(formatSkillCost({ 代价: '燃烧咏唱' })).toBe('代价: 燃烧咏唱');
  });

  it('returns null for empty values', () => {
    expect(formatSkillCost('   ')).toBeNull();
    expect(formatSkillCost(null)).toBeNull();
    expect(formatSkillCost(undefined)).toBeNull();
    expect(formatSkillCost({})).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  isMemoryOutlineTextValid,
  isMemorySummaryTextValid,
  isNumericPlaceholderText,
  validateOutlineLength,
  validateSummaryLength
} from '../../utils/memory/memoryTextPolicy';

const repeat = (char: string, length: number) => new Array(length).fill(char).join('');

describe('memory text policy', () => {
  it('validates summary length in 180-240 range', () => {
    expect(validateSummaryLength(repeat('测', 180)).valid).toBe(true);
    expect(validateSummaryLength(repeat('测', 220)).valid).toBe(true);
    expect(validateSummaryLength(repeat('测', 240)).valid).toBe(true);
    expect(validateSummaryLength(repeat('测', 179)).valid).toBe(false);
    expect(validateSummaryLength(repeat('测', 241)).valid).toBe(false);
  });

  it('validates outline length in 40-120 range', () => {
    expect(validateOutlineLength(repeat('纲', 40)).valid).toBe(true);
    expect(validateOutlineLength(repeat('纲', 90)).valid).toBe(true);
    expect(validateOutlineLength(repeat('纲', 120)).valid).toBe(true);
    expect(validateOutlineLength(repeat('纲', 39)).valid).toBe(false);
    expect(validateOutlineLength(repeat('纲', 121)).valid).toBe(false);
  });

  it('rejects numeric placeholder text', () => {
    expect(isNumericPlaceholderText('123456')).toBe(true);
    expect(isNumericPlaceholderText(' 0009 ')).toBe(true);
    expect(isNumericPlaceholderText('12abc')).toBe(false);
  });

  it('exposes summary/outline validity helpers', () => {
    expect(isMemorySummaryTextValid(repeat('记', 200))).toBe(true);
    expect(isMemorySummaryTextValid('12345')).toBe(false);
    expect(isMemoryOutlineTextValid(repeat('纲', 60))).toBe(true);
    expect(isMemoryOutlineTextValid('9999')).toBe(false);
  });
});

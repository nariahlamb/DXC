import { describe, expect, it } from 'vitest';
import { replaceUserPlaceholders, replaceUserPlaceholdersDeep, resolvePlayerName } from '../utils/userPlaceholder';

describe('user placeholder utils', () => {
  it('resolves empty player name to 玩家', () => {
    expect(resolvePlayerName('')).toBe('玩家');
    expect(resolvePlayerName(undefined)).toBe('玩家');
  });

  it('replaces {{user}} and {{player}} in string', () => {
    const text = '你好，{{user}}。{{player}}已进入欧拉丽。';
    expect(replaceUserPlaceholders(text, '博丽灵梦')).toBe('你好，博丽灵梦。博丽灵梦已进入欧拉丽。');
  });

  it('replaces placeholders in nested object payload', () => {
    const payload = {
      a: '{{user}}',
      b: [{ content: '欢迎 {{player}}' }],
      c: { deep: '<玩家>' }
    };
    expect(replaceUserPlaceholdersDeep(payload, '博丽灵梦')).toEqual({
      a: '博丽灵梦',
      b: [{ content: '欢迎 博丽灵梦' }],
      c: { deep: '博丽灵梦' }
    });
  });
});

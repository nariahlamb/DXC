import { describe, expect, it } from 'vitest';
import { assemblePhonePrompt } from '../utils/aiPrompt';

describe('assemblePhonePrompt placeholder replacement', () => {
  it('replaces {{user}} placeholders with player name', () => {
    const gameState = {
      角色: { 姓名: '博丽灵梦' },
      手机: {},
      社交: [],
      记忆: {},
      剧情: {},
      世界: {}
    } as any;
    const settings = {
      promptModules: [],
      contextConfig: { modules: [] }
    } as any;

    const prompt = assemblePhonePrompt('测试输入', gameState, settings);
    expect(prompt).not.toContain('{{user}}');
    expect(prompt).not.toContain('{{player}}');
  });
});

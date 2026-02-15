import { describe, it, expect } from 'vitest';
import { buildServicePrompt } from '../utils/aiServices';

describe('social service prompt', () => {
  it('includes NPC memory guidance for first-person natural language', () => {
    const settings = { promptModules: [] } as any;
    const gameState = {
      当前日期: '2026-02-08',
      游戏时间: '第1日 12:00',
      当前地点: '赫斯缇雅眷族总部',
      当前楼层: 1,
      世界坐标: { x: 0, y: 0 },
      社交: [],
      任务: [],
      剧情: {},
      世界: {},
      地图: {}
    } as any;

    const prompt = buildServicePrompt('social', 'input', gameState, settings);
    expect(prompt).toContain('NPC 记忆写入法则');
    expect(prompt).toContain('第一人称');
    expect(prompt).toContain('2-3');
  });

  it('replaces {{user}} placeholder with current player name', () => {
    const settings = { promptModules: [] } as any;
    const gameState = {
      当前日期: '2026-02-08',
      游戏时间: '第1日 12:00',
      当前地点: '赫斯缇雅眷族总部',
      当前楼层: 1,
      世界坐标: { x: 0, y: 0 },
      角色: { 姓名: '博丽灵梦' },
      社交: [],
      任务: [],
      剧情: {},
      世界: {},
      地图: {}
    } as any;

    const prompt = buildServicePrompt('social', 'input', gameState, settings);
    expect(prompt).toContain('博丽灵梦');
    expect(prompt).not.toContain('{{user}}');
  });
});

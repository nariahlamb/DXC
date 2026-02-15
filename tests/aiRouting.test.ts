import { describe, expect, it } from 'vitest';
import { filterStoryCommands, getAiRoutingProfile, shouldUseNarrativeOnlyPipeline, validateAiSettings } from '../utils/aiRouting';
import { buildServicePrompt } from '../utils/aiServices';

const makeSettings = (stateApiKey: string) => ({
  aiConfig: {
    services: {
      story: { provider: 'openai', baseUrl: '', apiKey: 'story', modelId: 'm' },
      map: { provider: 'openai', baseUrl: '', apiKey: 'map', modelId: 'm' },
      state: { provider: 'openai', baseUrl: '', apiKey: stateApiKey, modelId: 'm' }
    }
  },
  promptModules: [],
  memoryConfig: { instantLimit: 0 },
  contextConfig: { modules: [] },
  writingConfig: {
    enableWordCountRequirement: false,
    requiredWordCount: 0,
    enableNarrativePerspective: false,
    narrativePerspective: 'third'
  }
});

describe('getAiRoutingProfile', () => {
  it('always runs in triad microservice mode', () => {
    const profile = getAiRoutingProfile(makeSettings('state-key') as any);
    expect(profile.isMicroserviceMode).toBe(true);
    expect(profile.storyOnlyNarrative).toBe(true);
    expect(profile.stateServiceEnabled).toBe(true);
  });

  it('marks state service unavailable when state key is empty', () => {
    const profile = getAiRoutingProfile(makeSettings('') as any);
    expect(profile.isMicroserviceMode).toBe(true);
    expect(profile.storyOnlyNarrative).toBe(true);
    expect(profile.stateServiceEnabled).toBe(false);
  });
});

describe('validateAiSettings', () => {
  it('requires state service config for triad narrative-only pipeline', () => {
    const errors = validateAiSettings(makeSettings('') as any);
    expect(errors).toContain('state');
  });
});

describe('narrative-only routing helpers', () => {
  it('always keeps story in narrative-only pipeline', () => {
    expect(shouldUseNarrativeOnlyPipeline(makeSettings('state-key') as any, true)).toBe(true);
    expect(shouldUseNarrativeOnlyPipeline(makeSettings('') as any, false)).toBe(true);
  });

  it('forces story commands to empty set in narrative-only pipeline', () => {
    const commands = [
      { action: 'set', key: 'gameState.当前地点', value: '公会大厅' },
      { action: 'push', key: 'gameState.社交', value: { id: 'Char_Hestia', 姓名: '赫斯缇雅' } },
      { action: 'set', key: 'gameState.社交[0].是否在场', value: true },
      { action: 'set', key: 'gameState.社交[0].位置详情', value: '欧拉丽南大街' },
      { action: 'set', key: 'gameState.社交[0].好感度', value: 10 },
      { action: 'push', key: 'gameState.手机.公共帖子.帖子', value: { id: 'Forum_001', 标题: '测试', 内容: '测试内容', 发布者: 'Tester' } },
      { action: 'push', key: 'gameState.手机.朋友圈.帖子', value: { id: 'Moment_001', 发布者: 'Tester', 内容: '测试动态' } },
      { action: 'set', key: 'gameState.背包[0].数量', value: 2 },
      { action: 'upsert_npc', key: 'gameState.社交', value: [{ id: 'Char_Ais', 姓名: '艾丝' }] },
      { action: 'upsert_sheet_rows', value: { sheetId: 'NPC_Registry', rows: [{ id: 'Char_Lili', 姓名: '莉莉' }] } },
      { action: 'upsert_sheet_rows', value: { sheetId: 'FORUM_Posts', rows: [{ post_id: 'Forum_002', 标题: '公告', 内容: '内容', 发布者: '系统' }] } }
    ] as any;

    expect(filterStoryCommands(commands, true)).toEqual([]);
    expect(filterStoryCommands(commands, false)).toEqual(commands);
  });
});

describe('state service prompt', () => {
  it('includes state role rules', () => {
    const prompt = buildServicePrompt(
      'state',
      '[input]',
      { 当前日期: 'x' } as any,
      { promptModules: [] } as any
    );
    expect(prompt).toContain('地点/时间');
    expect(prompt).toContain('经济变化');
    expect(prompt).toContain('SYS_GlobalState');
    expect(prompt).toContain('rows.length=1');
  });
});

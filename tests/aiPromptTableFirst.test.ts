import { describe, expect, it } from 'vitest';
import { assembleFullPrompt } from '../utils/aiPrompt';

describe('assembleFullPrompt table-first sanitize', () => {
  it('sanitizes legacy gameState path command examples', () => {
    const settings = {
      promptModules: [
        {
          id: 'sys_legacy_sample',
          name: 'Legacy Sample',
          group: '系统设定',
          usage: 'CORE',
          isActive: true,
          order: 1,
          content: '示例：`set gameState.当前地点 "公会"`'
        }
      ],
      contextConfig: {
        modules: [
          {
            id: 'system_prompts',
            type: 'SYSTEM_PROMPTS',
            name: 'system',
            enabled: true,
            order: 1,
            params: {}
          },
          {
            id: 'user_input',
            type: 'USER_INPUT',
            name: 'input',
            enabled: true,
            order: 2,
            params: {}
          }
        ]
      },
      aiConfig: {},
      writingConfig: {
        enableWordCountRequirement: false,
        requiredWordCount: 0,
        enableNarrativePerspective: false,
        narrativePerspective: 'third'
      },
      enableActionOptions: false
    } as any;

    const gameState = {
      回合数: 1,
      游戏难度: 'normal',
      当前楼层: 0,
      地图: { surfaceLocations: [] },
      角色: { 姓名: 'Tester' },
      当前日期: '2026-02-12',
      游戏时间: '第1日 07:00'
    } as any;

    const prompt = assembleFullPrompt('test input', gameState, settings);

    expect(prompt).not.toContain('set gameState.');
    expect(prompt).toContain('upsert_sheet_rows(...)');
  });

  it('sanitizes add/push/delete variants and legacy action field in prompt text', () => {
    const settings = {
      promptModules: [
        {
          id: 'sys_legacy_variants',
          name: 'Legacy Variants',
          group: '系统设定',
          usage: 'CORE',
          isActive: true,
          order: 1,
          content: [
            '示例1：`push gameState.世界.街头传闻 {...}`',
            '示例2：`add gameState.角色.法利 100`',
            '示例3：`delete gameState.世界.街头传闻[0]`',
            '示例4：{\"action\":\"set\",\"key\":\"gameState.当前地点\",\"value\":\"公会\"}'
          ].join('\n')
        }
      ],
      contextConfig: {
        modules: [
          { id: 'system_prompts', type: 'SYSTEM_PROMPTS', name: 'system', enabled: true, order: 1, params: {} },
          { id: 'user_input', type: 'USER_INPUT', name: 'input', enabled: true, order: 2, params: {} }
        ]
      },
      aiConfig: {},
      writingConfig: {
        enableWordCountRequirement: false,
        requiredWordCount: 0,
        enableNarrativePerspective: false,
        narrativePerspective: 'third'
      },
      enableActionOptions: false
    } as any;

    const gameState = {
      回合数: 1,
      游戏难度: 'normal',
      当前楼层: 0,
      地图: { surfaceLocations: [] },
      角色: { 姓名: 'Tester' },
      当前日期: '2026-02-12',
      游戏时间: '第1日 07:00'
    } as any;

    const prompt = assembleFullPrompt('test input', gameState, settings);

    expect(prompt).not.toContain('push gameState.');
    expect(prompt).not.toContain('add gameState.');
    expect(prompt).not.toContain('delete gameState.');
    expect(prompt).not.toContain('"action":"set"');
    expect(prompt).toContain('"action": "upsert_sheet_rows"');
  });

  it('keeps narrative style/context lines and extra requirement prompt in narrative-only mode', () => {
    const settings = {
      promptModules: [
        {
          id: 'sys_style_anchor',
          name: 'Style Anchor',
          group: '系统设定',
          usage: 'CORE',
          isActive: true,
          order: 1,
          content: '叙事风格锚点：回顾 LOG_Outline 只用于理解节奏，不要输出命令。'
        }
      ],
      contextConfig: {
        modules: [
          { id: 'system_prompts', type: 'SYSTEM_PROMPTS', name: 'system', enabled: true, order: 1, params: {} },
          { id: 'user_input', type: 'USER_INPUT', name: 'input', enabled: true, order: 2, params: {} }
        ]
      },
      aiConfig: {
        services: {
          state: { apiKey: 'state-key' }
        }
      },
      writingConfig: {
        enableWordCountRequirement: false,
        requiredWordCount: 0,
        enableNarrativePerspective: false,
        narrativePerspective: 'third',
        extraRequirementPrompt: '请保持自然分段，每段之间留空行。'
      },
      enableActionOptions: false
    } as any;

    const gameState = {
      回合数: 1,
      游戏难度: 'normal',
      当前楼层: 0,
      地图: { surfaceLocations: [] },
      角色: { 姓名: 'Tester' },
      当前日期: '2026-02-12',
      游戏时间: '第1日 07:00'
    } as any;

    const prompt = assembleFullPrompt('test input', gameState, settings);

    expect(prompt).toContain('LOG_Outline');
    expect(prompt).toContain('[额外要求提示词]');
    expect(prompt).toContain('请保持自然分段，每段之间留空行。');
  });

  it('strips command-oriented directives in narrative-only mode while keeping narrative anchors', () => {
    const settings = {
      promptModules: [
        {
          id: 'sys_mixed_directive',
          name: 'Mixed',
          group: '系统设定',
          usage: 'CORE',
          isActive: true,
          order: 1,
          content: [
            '叙事锚点：保持场景连续性。',
            '必须输出 tavern_commands 并使用 upsert_sheet_rows(SYS_GlobalState)。',
            '动作白名单：upsert_sheet_rows/delete_sheet_rows。'
          ].join('\n')
        }
      ],
      contextConfig: {
        modules: [
          { id: 'system_prompts', type: 'SYSTEM_PROMPTS', name: 'system', enabled: true, order: 1, params: {} },
          { id: 'user_input', type: 'USER_INPUT', name: 'input', enabled: true, order: 2, params: {} }
        ]
      },
      aiConfig: {
        services: {
          state: { apiKey: 'state-key' }
        }
      },
      writingConfig: {
        enableWordCountRequirement: false,
        requiredWordCount: 0,
        enableNarrativePerspective: false,
        narrativePerspective: 'third'
      },
      enableActionOptions: false
    } as any;

    const gameState = {
      回合数: 1,
      游戏难度: 'normal',
      当前楼层: 0,
      地图: { surfaceLocations: [] },
      角色: { 姓名: 'Tester' },
      当前日期: '2026-02-12',
      游戏时间: '第1日 07:00'
    } as any;

    const prompt = assembleFullPrompt('test input', gameState, settings);

    expect(prompt).toContain('叙事锚点：保持场景连续性。');
    expect(prompt).not.toContain('upsert_sheet_rows(SYS_GlobalState)');
    expect(prompt).not.toContain('动作白名单');
    expect(prompt).toContain('"tavern_commands": []');
  });
});

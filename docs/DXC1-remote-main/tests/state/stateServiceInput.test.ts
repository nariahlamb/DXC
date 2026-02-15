import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { buildStateServiceInputPayload } from '../../utils/state/stateServiceInput';

describe('buildStateServiceInputPayload', () => {
  it('keeps only whitelisted core fields and drops oversized extras', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.角色 = {
      ...state.角色,
      姓名: 'Tester',
      等级: 3,
      生命值: 80,
      最大生命值: 100,
      超长背景: 'x'.repeat(600)
    };
    state.任务 = [
      {
        id: 'TSK-1',
        标题: '长期侦察计划',
        状态: 'active',
        目标: '调查地下城第7层营地',
        内部追踪日志: ['a', 'b', 'c']
      }
    ];
    state.背包 = [
      {
        id: 'ITM-1',
        名称: '治疗药剂',
        数量: 3,
        描述: '可在战斗中恢复生命值',
        详细来源: { from: 'quest', issuer: 'guild' }
      }
    ];
    state.战斗 = {
      是否战斗中: true,
      回合: 2,
      阶段: '行动',
      内部日志: Array.from({ length: 10 }, (_, i) => `log-${i}`),
      敌人: [{ id: 'E-1', 名称: '哥布林', 生命值: 12, 最大生命值: 20, 状态: 'alive', 行为树: { depth: 3 } }]
    };

    const payload = buildStateServiceInputPayload({
      state,
      socialBrief: [{ 姓名: '艾丝', 好感度: 80, 内部计划: 'secret' }],
      requiredSheets: ['WORLD_News'],
      stateSheetGuide: [{ sheetId: 'WORLD_News', label: '新闻' }],
      maxConcurrentSheets: 10,
      maxConcurrentBatches: 5
    }) as any;

    expect(payload.角色.姓名).toBe('Tester');
    expect(payload.角色.超长背景).toBeUndefined();
    expect(payload.社交[0].内部计划).toBeUndefined();
    expect(payload.任务[0].内部追踪日志).toBeUndefined();
    expect(payload.背包[0].详细来源).toBeUndefined();
    expect(payload.战斗.内部日志).toBeUndefined();
    expect(payload.战斗.敌人[0].行为树).toBeUndefined();
  });

  it('applies row limits for social/tasks/inventory lists', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.任务 = Array.from({ length: 60 }, (_, i) => ({ id: `T-${i}`, 标题: `任务-${i}`, 状态: 'active' }));
    state.背包 = Array.from({ length: 90 }, (_, i) => ({ id: `I-${i}`, 名称: `道具-${i}`, 数量: i + 1 }));

    const socialBrief = Array.from({ length: 40 }, (_, i) => ({ 姓名: `NPC-${i}`, 好感度: i }));
    const payload = buildStateServiceInputPayload({
      state,
      socialBrief,
      requiredSheets: ['WORLD_News'],
      stateSheetGuide: [{ sheetId: 'WORLD_News', label: '新闻' }],
      maxConcurrentSheets: 10,
      maxConcurrentBatches: 5
    }) as any;

    expect(payload.社交).toHaveLength(24);
    expect(payload.任务).toHaveLength(24);
    expect(payload.背包).toHaveLength(40);
    expect(payload.任务[0].id).toBe('T-36');
    expect(payload.背包[0].id).toBe('I-50');
  });

  it('keeps sheet guide and fill-task metadata', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const requiredSheets = ['WORLD_News', 'WORLD_Rumors'];
    const stateSheetGuide = [
      { sheetId: 'WORLD_News', label: '新闻' },
      { sheetId: 'WORLD_Rumors', label: '传闻' }
    ];

    const payload = buildStateServiceInputPayload({
      state,
      socialBrief: [],
      requiredSheets,
      stateSheetGuide,
      maxConcurrentSheets: 10,
      maxConcurrentBatches: 5
    }) as any;

    expect(payload.表结构约束.source).toBe('sheetRegistry');
    expect(payload.表结构约束.sheets).toEqual(stateSheetGuide);
    expect(payload.填表任务.requiredSheets).toEqual(requiredSheets);
    expect(payload.填表任务.maxConcurrentSheets).toBe(10);
    expect(payload.填表任务.maxConcurrentBatches).toBe(5);
  });
});

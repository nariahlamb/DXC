import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { applyNpcPresenceConvergence } from '../../utils/social/npcPresenceConvergence';

describe('npc presence convergence', () => {
  it('marks non-party present npc as absent after stale rounds without appearance', () => {
    const prev = createNewGameState('Tester', '男', 'Human') as any;
    prev.回合数 = 5;
    prev.社交 = [
      {
        id: 'Char_DwarfVendor',
        姓名: '矮人摊贩',
        种族: '矮人',
        眷族: '无',
        身份: '平民',
        好感度: 10,
        关系状态: '普通',
        已交换联系方式: false,
        特别关注: false,
        等级: 1,
        记忆: [],
        是否在场: true,
        当前状态: '在场',
        最后出现回合: 2
      }
    ];

    const next = { ...prev, 社交: [...prev.社交] };
    const result = applyNpcPresenceConvergence({
      prevState: prev,
      nextState: next,
      currentTurn: 5,
      logs: [{ sender: '旁白', text: '主角整理物品。' }],
      interactionNpcIndices: []
    }) as any;

    expect(result.社交[0].是否在场).toBe(false);
    expect(result.社交[0].当前状态).toBe('离场');
  });

  it('restores present when npc appears as dialogue sender again', () => {
    const prev = createNewGameState('Tester', '男', 'Human') as any;
    prev.回合数 = 6;
    prev.社交 = [
      {
        id: 'Char_DwarfVendor',
        姓名: '矮人摊贩',
        种族: '矮人',
        眷族: '无',
        身份: '平民',
        好感度: 10,
        关系状态: '普通',
        已交换联系方式: false,
        特别关注: false,
        等级: 1,
        记忆: [],
        是否在场: false,
        当前状态: '离场',
        最后出现回合: 2
      }
    ];

    const next = { ...prev, 社交: [...prev.社交] };
    const result = applyNpcPresenceConvergence({
      prevState: prev,
      nextState: next,
      currentTurn: 6,
      logs: [{ sender: '矮人摊贩', text: '今天也来看看货？' }],
      interactionNpcIndices: []
    }) as any;

    expect(result.社交[0].是否在场).toBe(true);
    expect(result.社交[0].当前状态).toBe('在场');
    expect(result.社交[0].最后出现回合).toBe(6);
  });
});

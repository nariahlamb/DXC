import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { validateStateInvariants } from '../../utils/state/invariants';

describe('state invariants', () => {
  it('returns no issue for valid baseline state', () => {
    const state = createNewGameState('Tester', '男', 'Human');
    state.角色.法利 = 500;
    state.眷族.资金 = 1000;
    state.角色.生命值 = 100;
    state.角色.最大生命值 = 100;
    state.角色.精神力 = 80;
    state.角色.最大精神力 = 100;
    state.角色.体力 = 70;
    state.角色.最大体力 = 100;
    state.社交 = [{ ...state.社交[0], 好感度: 30 }];

    const issues = validateStateInvariants(state as any);
    expect(issues).toHaveLength(0);
  });

  it('detects money/resource/affinity violations', () => {
    const state = createNewGameState('Tester', '男', 'Human');
    state.角色.法利 = -5;
    state.眷族.资金 = -1;
    state.角色.生命值 = 150;
    state.角色.最大生命值 = 100;
    state.角色.精神力 = -3;
    state.角色.最大精神力 = 100;
    state.角色.体力 = 140;
    state.角色.最大体力 = 90;
    state.社交 = [{ ...state.社交[0], 好感度: 150 }];

    const issues = validateStateInvariants(state as any);
    expect(issues.some((issue) => issue.path === '角色.法利')).toBe(true);
    expect(issues.some((issue) => issue.path === '眷族.资金')).toBe(true);
    expect(issues.some((issue) => issue.path === '角色.精神力')).toBe(true);
    expect(issues.some((issue) => issue.path.includes('社交[0].好感度'))).toBe(true);
  });
});

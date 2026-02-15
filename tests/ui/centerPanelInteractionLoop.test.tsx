import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CenterPanel } from '../../components/game/CenterPanel';
import { createNewGameState } from '../../utils/dataMapper';

describe('center panel interaction loop', () => {
  it('renders primary action group and supports prefill + one-click send', async () => {
    const state = createNewGameState('Tester', '男', 'Human');

    render(
      <CenterPanel
        logs={state.日志}
        combatState={{ ...state.战斗, 是否战斗中: false }}
        playerStats={state.角色}
        skills={state.角色.技能}
        magic={state.角色.魔法}
        inventory={state.背包}
        confidants={state.社交}
        onSendMessage={vi.fn()}
        onPlayerAction={vi.fn()}
        actionOptions={['观察环境', '查看地图', '检查背包', '追踪脚印', '询问路人', '休整']}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: '主行动: 观察环境' }));
    expect(screen.getByRole('button', { name: '一键发送主行动' })).toBeInTheDocument();
  });
});

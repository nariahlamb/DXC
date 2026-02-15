import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CenterPanel } from '../../components/game/CenterPanel';
import { createNewGameState } from '../../utils/dataMapper';

describe('task log linking timeline', () => {
  it('shows related logs after selecting a task', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.任务 = [
      {
        id: 'task-guild',
        标题: '前往公会本部',
        描述: '去公会领取委托',
        状态: 'active',
        奖励: '100 法利',
        评级: 'E'
      }
    ];
    const logs = [
      { id: 'log-1', sender: 'narrative', text: '你收到任务：前往公会本部。', timestamp: Date.now(), turnIndex: 1 }
    ];

    render(
      <CenterPanel
        logs={logs}
        combatState={{ ...state.战斗, 是否战斗中: false }}
        playerStats={state.角色}
        skills={state.角色.技能}
        magic={state.角色.魔法}
        inventory={state.背包}
        confidants={state.社交}
        tasks={state.任务}
        onSendMessage={vi.fn()}
        onPlayerAction={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: '任务: 前往公会本部' }));
    expect(screen.getByText('相关日志')).toBeInTheDocument();
  });
});

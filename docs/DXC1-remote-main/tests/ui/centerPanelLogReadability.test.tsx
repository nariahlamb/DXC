import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CenterPanel } from '../../components/game/CenterPanel';
import { createNewGameState } from '../../utils/dataMapper';

describe('center panel log readability controls', () => {
  it('adds current-turn filter and key-log jump controls', async () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const now = Date.now();
    const logs = [
      { id: 'log-1', sender: 'narrative', text: '第一回合事件', timestamp: now, turnIndex: 1 },
      { id: 'log-2', sender: '艾丝', text: '第二回合关键事件', timestamp: now + 1, turnIndex: 2 },
      { id: 'log-3', sender: 'player', text: '继续推进', timestamp: now + 2, turnIndex: 2 }
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
        onSendMessage={vi.fn()}
        onPlayerAction={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: '仅看当前回合' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '仅看当前回合' }));
    expect(screen.getByRole('button', { name: '跳到最新关键日志' })).toBeInTheDocument();
  });
});

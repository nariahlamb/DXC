import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CenterPanel } from '../../components/game/CenterPanel';
import { createNewGameState } from '../../utils/dataMapper';

describe('center panel non-combat action options', () => {
  it('shows quick action options in non-combat state and reuses select callback', () => {
    const state = createNewGameState('Tester', '男', 'Human');
    const onActionOptionSelect = vi.fn();

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
        actionOptions={['侦察周边', '查看公告']}
        onActionOptionSelect={onActionOptionSelect}
      />
    );

    const option = screen.getByRole('button', { name: /侦察周边/i });
    expect(option).toBeInTheDocument();

    fireEvent.click(option);
    expect(onActionOptionSelect).toHaveBeenCalledWith('侦察周边');
  });

  it('preserves blank line semantics and judge highlight inside NPC dialogue', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const logs = [
      {
        id: 'npc-1',
        sender: '艾丝',
        text: '【判定】力量检定 1d20=20\n\n成功。',
        timestamp: Date.now(),
        turnIndex: 0
      }
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
        actionOptions={[]}
        onActionOptionSelect={vi.fn()}
      />
    );

    const npcBubble = screen.getByText('艾丝').closest('.bubble-dialogue');
    expect(npcBubble).toBeTruthy();

    const judgeLine = screen.getByText('【判定】力量检定 1d20=20');
    expect(judgeLine.closest('div')).toHaveClass('bg-blue-950/40');

    // 空行应产生占位节点，避免“停顿”语义被吞掉。
    expect(npcBubble?.querySelector('.h-4')).toBeTruthy();
    expect(screen.getByText('成功。')).toBeInTheDocument();
  });

  it('routes sender classification to unique branches and protects NPC collision', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    const now = Date.now();
    const logs = [
      { id: 'sys-1', sender: 'system', text: '系统消息', timestamp: now, turnIndex: 0 },
      { id: 'nar-1', sender: 'narrative', text: '旁白叙事', timestamp: now + 1, turnIndex: 0 },
      { id: 'pl-1', sender: 'player', text: '玩家发言', timestamp: now + 2, turnIndex: 0 },
      { id: 'npc-collision', sender: 'System', text: '我是 NPC，不是系统。', timestamp: now + 3, turnIndex: 0 },
      { id: 'npc-empty', sender: '', text: '无 sender 也应按 NPC 渲染。', timestamp: now + 4, turnIndex: 0 }
    ];
    const confidants = [...(state.社交 || []), { 姓名: 'System' }];

    render(
      <CenterPanel
        logs={logs as any}
        combatState={{ ...state.战斗, 是否战斗中: false }}
        playerStats={state.角色}
        skills={state.角色.技能}
        magic={state.角色.魔法}
        inventory={state.背包}
        confidants={confidants as any}
        onSendMessage={vi.fn()}
        onPlayerAction={vi.fn()}
        actionOptions={[]}
        onActionOptionSelect={vi.fn()}
      />
    );

    expect(screen.getByText('系统消息').closest('.bubble-system')).toBeTruthy();
    expect(screen.getByText('旁白叙事').closest('.narrative-container')).toBeTruthy();
    expect(screen.getByText('YOU')).toBeInTheDocument();
    expect(screen.getByText('玩家发言')).toBeInTheDocument();

    const npcCollisionLabel = screen.getByText('System');
    expect(npcCollisionLabel.closest('.bubble-dialogue')).toBeTruthy();
    expect(screen.getByText('我是 NPC，不是系统。')).toBeInTheDocument();

    const unknownLabel = screen.getByText('未知');
    expect(unknownLabel.closest('.bubble-dialogue')).toBeTruthy();
    expect(screen.getByText('无 sender 也应按 NPC 渲染。')).toBeInTheDocument();
  });
});

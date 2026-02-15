import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DailyDashboardModal } from '../../components/game/modals/DailyDashboardModal';
import { createNewGameState } from '../../utils/dataMapper';

describe('daily dashboard panels', () => {
  it('renders all four dashboard panels and supports quick links', () => {
    const gameState = createNewGameState('Tester', '男', 'Human');

    gameState.任务 = [
      {
        id: 'T1',
        标题: '进行中的任务',
        描述: '描述',
        状态: 'active',
        奖励: '奖励',
        评级: 'E'
      },
      {
        id: 'T2',
        标题: '完成的任务',
        描述: '描述',
        状态: 'completed',
        奖励: '奖励',
        评级: 'E'
      }
    ];

    if (gameState.社交[0]) {
      gameState.社交[0].是否在场 = true;
      gameState.社交[0].特别关注 = true;
    }

    const onOpenTasks = vi.fn();
    const onOpenSocial = vi.fn();

    render(
      <DailyDashboardModal
        isOpen={true}
        onClose={vi.fn()}
        gameState={gameState}
        onOpenTasks={onOpenTasks}
        onOpenSocial={onOpenSocial}
      />
    );

    expect(screen.getByRole('heading', { name: '全局状态' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '任务概览' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'NPC 动态' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '资源速览' })).toBeInTheDocument();

    expect(screen.getByText('进行中的任务')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看任务' }));
    fireEvent.click(screen.getByRole('button', { name: '查看社交' }));

    expect(onOpenTasks).toHaveBeenCalledTimes(1);
    expect(onOpenSocial).toHaveBeenCalledTimes(1);
  });
});

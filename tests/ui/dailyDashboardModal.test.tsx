import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopNav } from '../../components/game/TopNav';
import { createNewGameState } from '../../utils/dataMapper';

describe('daily dashboard modal', () => {
  it('does not render top-nav dashboard entry button', () => {
    const gameState = createNewGameState('Tester', '男', 'Human');
    render(
      <TopNav
        time={gameState.游戏时间}
        location={gameState.当前地点}
        floor={gameState.当前楼层}
        weather={gameState.天气}
        coords={gameState.世界坐标}
      />
    );

    expect(screen.queryByRole('button', { name: /仪表盘/i })).not.toBeInTheDocument();
  });
});

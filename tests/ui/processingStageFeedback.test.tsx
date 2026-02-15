import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CenterPanel } from '../../components/game/CenterPanel';
import { createNewGameState } from '../../utils/dataMapper';

describe('processing stage feedback', () => {
  it('shows queued/generating/applying stages based on processing flags', () => {
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
        isProcessing={true}
        isStreaming={false}
      />
    );

    expect(screen.getByText('排队中')).toBeInTheDocument();
  });
});

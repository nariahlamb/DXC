import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryModal } from '../../components/game/modals/MemoryModal';
import { createNewGameState } from '../../utils/dataMapper';

const createStateWithAmRow = () => {
  const state = createNewGameState('Tester', '男', 'Human') as any;
  state.__tableRows = {
    LOG_Summary: [
      { 编码索引: 'AM0001', 回合: 1, 时间: '第1日 07:00', 摘要: '测试摘要' }
    ],
    LOG_Outline: [
      { 编码索引: 'AM0001', 章节: 1, 标题: '测试章节' }
    ]
  };
  state.__tableMeta = {
    rowLocks: [],
    cellLocks: []
  };
  return state;
};

const MemoryModalHarness: React.FC = () => {
  const [gameState, setGameState] = useState(createStateWithAmRow);
  return (
    <MemoryModal
      isOpen
      onClose={() => undefined}
      gameState={gameState}
      onUpdateGameState={setGameState}
      embedded
    />
  );
};

describe('memory modal lock controls', () => {
  it('toggles row lock via interactive controls', () => {
    render(<MemoryModalHarness />);

    fireEvent.click(screen.getByRole('button', { name: '锁定行' }));
    expect(screen.getByText(/locks: R1\/C0/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '解除行锁' }));
    expect(screen.getByText(/locks: R0\/C0/i)).toBeInTheDocument();
  });
});

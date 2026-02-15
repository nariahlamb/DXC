import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryModal } from '../../components/game/modals/MemoryModal';
import { createNewGameState } from '../../utils/dataMapper';

const createStateWithQuestRow = () => {
  const state = createNewGameState('Tester', '男', 'Human') as any;
  state.__tableRows = {
    QUEST_Active: [
      {
        任务ID: 'Q001',
        任务名称: '旧任务名',
        类型: '主线',
        发布者: '公会',
        目标描述: '旧描述',
        当前进度: '',
        状态: '进行中',
        时限: '无限制',
        奖励: '100法利'
      }
    ]
  };
  return state;
};

const MemoryModalHarness: React.FC = () => {
  const [gameState, setGameState] = useState(createStateWithQuestRow);
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

describe('memory modal row edit', () => {
  it('edits selected row and writes back via table upsert', () => {
    render(<MemoryModalHarness />);

    fireEvent.click(screen.getByText(/QUEST_Active/).closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: '编辑行' }));

    const nameLabel = screen.getAllByText('任务名称').at(-1);
    const nameField = nameLabel?.parentElement?.querySelector('textarea') as HTMLTextAreaElement;
    expect(nameField).toBeTruthy();
    fireEvent.change(nameField, { target: { value: '新任务名' } });

    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getAllByText('新任务名').length).toBeGreaterThan(0);
  });
});

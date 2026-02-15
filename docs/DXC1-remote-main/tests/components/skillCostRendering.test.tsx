import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CharacterView } from '../../components/game/views/CharacterView';
import { SkillsContent } from '../../components/game/character/SkillsContent';
import { createNewGameState } from '../../utils/dataMapper';

describe('skill cost rendering consistency', () => {
  it('renders shared cost format in CharacterView skills and magic tabs', () => {
    const state = createNewGameState('Tester', '男', 'Human');
    state.角色.技能 = [
      {
        id: 'skill-1',
        名称: '火焰斩',
        类别: '主动',
        消耗: { 精神: 12, 体力: 3 },
      },
    ];
    state.角色.魔法 = [
      {
        id: 'magic-1',
        名称: '微光术',
        咏唱: '光辉应答',
        类别: '支援',
        消耗: { 精神: 8 },
      },
    ];

    render(<CharacterView player={state.角色} inventory={[]} onUnequipItem={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
    expect(screen.getByText('MP 12 · HP 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Magic' }));
    expect(screen.getByText('MP 8')).toBeInTheDocument();
  });

  it('renders shared cost format in SkillsContent list and details', () => {
    render(
      <SkillsContent
        skills={[
          {
            id: 'skill-2',
            名称: '护盾术',
            类别: '支援',
            消耗: { 精神: 6, 体力: 2 },
            描述: '提高防御',
          },
        ]}
        magic={[
          {
            id: 'magic-2',
            名称: '冰锥',
            咏唱: '寒霜降临',
            类别: '攻击',
            消耗: { 精神: 9 },
            描述: '单体法术',
          },
        ]}
      />
    );

    expect(screen.getByText('MP 6 · HP 2')).toBeInTheDocument();
    expect(screen.getByText('消耗：MP 6 · HP 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /魔法/i }));
    expect(screen.getByText('消耗：MP 9')).toBeInTheDocument();
  });
});

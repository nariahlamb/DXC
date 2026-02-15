import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsModal } from '../../components/game/modals/SettingsModal';
import { DEFAULT_SETTINGS } from '../../hooks/useGameLogic';
import { createNewGameState } from '../../utils/dataMapper';

const createProps = (overrides: Partial<React.ComponentProps<typeof SettingsModal>> = {}): React.ComponentProps<typeof SettingsModal> => ({
  isOpen: true,
  onClose: vi.fn(),
  settings: structuredClone(DEFAULT_SETTINGS),
  avatarUrl: '',
  onSaveSettings: vi.fn(),
  onSaveGame: vi.fn(),
  onLoadGame: vi.fn(),
  onUpdateAvatar: vi.fn(),
  onExitGame: vi.fn(),
  gameState: createNewGameState('Tester', '男', 'Human'),
  onUpdateGameState: vi.fn(),
  initialView: 'DATA',
  ...overrides,
});

describe('home settings save action guard', () => {
  it('disables save buttons when canSaveGame is false', () => {
    const onSaveGame = vi.fn();
    render(<SettingsModal {...createProps({ canSaveGame: false, onSaveGame })} />);

    expect(screen.getByText('当前场景不支持手动存档')).toBeInTheDocument();
    const saveButtons = screen.getAllByRole('button', { name: '保存' });
    expect(saveButtons.length).toBeGreaterThan(0);
    saveButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });

    fireEvent.click(saveButtons[0]);
    expect(onSaveGame).not.toHaveBeenCalled();
  });

  it('keeps save buttons enabled by default', () => {
    const onSaveGame = vi.fn();
    render(<SettingsModal {...createProps({ onSaveGame })} />);

    const saveButton = screen.getAllByRole('button', { name: '保存' })[0];
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);
    expect(onSaveGame).toHaveBeenCalledWith(1);
  });

  it('hides disabled hint when canSaveGame is true', () => {
    render(<SettingsModal {...createProps({ canSaveGame: true })} />);

    expect(screen.queryByText('当前场景不支持手动存档')).not.toBeInTheDocument();
  });
});

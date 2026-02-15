import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  initialView: 'VISUALS',
  ...overrides,
});

describe('Home settings avatar guard', () => {
  it('does not render an empty avatar image src when avatar url is blank', () => {
    render(<SettingsModal {...createProps({ avatarUrl: '   ' })} />);

    expect(screen.getByText('未设置头像')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Avatar' })).not.toBeInTheDocument();
    expect(document.querySelector('img[src=""]')).toBeNull();
  });

  it('renders avatar image when avatar url is valid', () => {
    const avatarUrl = 'https://example.com/avatar.png';
    render(<SettingsModal {...createProps({ avatarUrl })} />);

    const avatar = screen.getByRole('img', { name: 'Avatar' });
    expect(avatar).toHaveAttribute('src', avatarUrl);
  });
});

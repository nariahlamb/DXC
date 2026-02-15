import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsModal } from '../../components/game/modals/SettingsModal';
import { DEFAULT_SETTINGS } from '../../hooks/useAppSettings';
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

describe('readability settings render', () => {
  it('renders readability controls in visuals view', () => {
    render(<SettingsModal {...createProps()} />);

    expect(screen.getByText('行高')).toBeInTheDocument();
    expect(screen.getByText('对比度模式')).toBeInTheDocument();
    expect(screen.getByText('信息密度')).toBeInTheDocument();
  });
});

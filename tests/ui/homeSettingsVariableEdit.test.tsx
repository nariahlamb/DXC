import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Home } from '../../components/Home';
import { createNewGameState } from '../../utils/dataMapper';

const { getLatestSaveSlotMock } = vi.hoisted(() => ({
  getLatestSaveSlotMock: vi.fn(),
}));

vi.mock('../../components/home/MagicCircleBackground', () => ({
  MagicCircleBackground: () => <div data-testid="mock-bg" />,
}));

vi.mock('../../components/home/GameTitle', () => ({
  GameTitle: () => <div data-testid="mock-title">Title</div>,
}));

vi.mock('../../components/game/modals/SettingsModal', () => ({
  SettingsModal: ({ isOpen, gameState, onUpdateGameState }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="settings-modal">
        <span data-testid="preview-name">{gameState?.角色?.姓名 ?? ''}</span>
        <button
          onClick={() =>
            onUpdateGameState({
              ...gameState,
              角色: {
                ...gameState?.角色,
                姓名: 'Edited Preview',
              },
            })
          }
        >
          应用修改
        </button>
      </div>
    );
  },
}));

vi.mock('../../utils/storage/storageAdapter', async () => {
  const actual = await vi.importActual('../../utils/storage/storageAdapter');
  return {
    ...actual,
    getLatestSaveSlot: getLatestSaveSlotMock,
    getSaveStorageKey: vi.fn(() => 'danmachi_save_manual_1'),
    getManagedJson: vi.fn(async () => null),
    loadAllSaveSlots: vi.fn(async () => ({ manual: [], auto: [] })),
  };
});

vi.mock('../../utils/storage/migrations/v1LocalToIdb', () => ({
  migrateLocalToIndexedDbV1: vi.fn(async () => {}),
}));

describe('Home settings variable edit guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call onStart when applying settings variable edits', async () => {
    const onStart = vi.fn();
    render(<Home onStart={onStart} onNewGame={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '系统设置' }));
    await screen.findByTestId('settings-modal');

    expect(screen.getByTestId('preview-name')).toHaveTextContent('Preview');

    fireEvent.click(screen.getByRole('button', { name: '应用修改' }));

    await waitFor(() => {
      expect(screen.getByTestId('preview-name')).toHaveTextContent('Edited Preview');
    });
    expect(onStart).not.toHaveBeenCalled();
  });

  it('calls onStart when continue adventure has latest save', async () => {
    const onStart = vi.fn();
    const savedState = createNewGameState('Continue Player', '男', 'Human');
    getLatestSaveSlotMock.mockResolvedValue({ id: 1, data: savedState });

    render(<Home onStart={onStart} onNewGame={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '继续冒险' }));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
      expect(onStart).toHaveBeenCalledWith(savedState);
    });
  });
});

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SettingsModal } from '../../components/game/modals/SettingsModal';
import { DEFAULT_SETTINGS } from '../../hooks/useAppSettings';
import { createNewGameState } from '../../utils/dataMapper';

const buildSettings = () => ({
  ...structuredClone(DEFAULT_SETTINGS),
  backgroundImage: 'data:image/png;base64,AAA'
});

const Harness = ({ onSaveSettings }: { onSaveSettings: (next: any) => void }) => {
  const [isOpen, setIsOpen] = React.useState(true);
  return (
    <SettingsModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      settings={buildSettings()}
      avatarUrl=""
      onSaveSettings={onSaveSettings}
      onSaveGame={vi.fn()}
      onLoadGame={vi.fn()}
      onUpdateAvatar={vi.fn()}
      onExitGame={vi.fn()}
      gameState={createNewGameState('Tester', '男', 'Human')}
      onUpdateGameState={vi.fn()}
      initialView="VISUALS"
    />
  );
};

describe('settings background persistence', () => {
  it('flushes background changes immediately when closing modal', async () => {
    const onSaveSettings = vi.fn();
    render(<Harness onSaveSettings={onSaveSettings} />);

    fireEvent.click(screen.getByRole('button', { name: '恢复默认' }));
    fireEvent.click(screen.getByLabelText('Close modal'));

    await waitFor(() => {
      expect(onSaveSettings).toHaveBeenCalled();
      expect(onSaveSettings.mock.calls.some(([next]) => next?.backgroundImage === '')).toBe(true);
    });
  });
});

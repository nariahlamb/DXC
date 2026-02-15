import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';
import { DEFAULT_SETTINGS } from '../../../hooks/useGameLogic';
import { createNewGameState } from '../../../utils/dataMapper';

const createProps = (overrides: Partial<React.ComponentProps<typeof SettingsModal>> = {}): React.ComponentProps<typeof SettingsModal> => {
  const gameState = createNewGameState('Tester', '男', 'Human');
  return {
    isOpen: true,
    onClose: vi.fn(),
    settings: structuredClone(DEFAULT_SETTINGS),
    avatarUrl: 'https://example.com/avatar.png',
    onSaveSettings: vi.fn(),
    onSaveGame: vi.fn(),
    onLoadGame: vi.fn(),
    onUpdateAvatar: vi.fn(),
    onExitGame: vi.fn(),
    gameState,
    onUpdateGameState: vi.fn(),
    initialView: 'VISUALS',
    ...overrides,
  };
};

describe('SettingsModal', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders storage view without crashing on edge storage payloads', async () => {
    localStorage.setItem('danmachi_settings', JSON.stringify({ fontSize: 'medium' }));
    localStorage.setItem(
      'danmachi_save_auto_1',
      JSON.stringify({ timestamp: Date.now(), summary: 'Auto', data: { 角色: { 姓名: 'Tester', 等级: 1 } } })
    );

    render(<SettingsModal {...createProps({ initialView: 'STORAGE' })} />);

    await waitFor(() => {
      expect(screen.getAllByText('存储维护').length).toBeGreaterThan(0);
      expect(screen.getByText('存档数据')).toBeInTheDocument();
    });

    expect(
      warnSpy.mock.calls.some((call) => String(call[0] || '').includes('scan settings parse failed'))
    ).toBe(false);
  });

  it('auto-saves settings after visual change with debounce', () => {
    vi.useFakeTimers();
    const onSaveSettings = vi.fn();

    render(<SettingsModal {...createProps({ initialView: 'VISUALS', onSaveSettings })} />);

    expect(onSaveSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /small/i }));

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(onSaveSettings).toHaveBeenCalledTimes(1);
  });

  it('shows alert when importing invalid save json', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    class MockFileReader {
      onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
      readAsText() {
        if (this.onload) {
          const event = { target: { result: '{bad-json' } } as unknown as ProgressEvent<FileReader>;
          this.onload(event);
        }
      }
    }

    vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader);

    render(<SettingsModal {...createProps({ initialView: 'DATA' })} />);
    const fileInput = document.body.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['x'], 'save.json', { type: 'application/json' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(alertSpy).toHaveBeenCalled();
    expect(String(alertSpy.mock.calls[0][0])).toContain('导入失败');
    expect(
      errorSpy.mock.calls.some((call) => String(call[0] || '').includes('Import Error'))
    ).toBe(true);
  });

  it('renders memory retrieval controls in AI context view', () => {
    render(<SettingsModal {...createProps({ initialView: 'AI_CONTEXT' })} />);

    fireEvent.click(screen.getByText('记忆流'));

    expect(screen.getByText('记忆召回配置')).toBeInTheDocument();
    expect(screen.getByText('召回模式')).toBeInTheDocument();
    expect(screen.getByText('表格过滤（逗号分隔 sheetId）')).toBeInTheDocument();
    expect(screen.getByText('索引来源过滤')).toBeInTheDocument();
  });
});

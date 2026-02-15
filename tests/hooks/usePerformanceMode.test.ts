import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { detectPerformanceMode, usePerformanceMode } from '../../hooks/usePerformanceMode';

const VALID_MODES = ['full', 'medium', 'minimal'] as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('usePerformanceMode guards', () => {
  it('returns valid mode when navigator is unavailable', () => {
    vi.stubGlobal('navigator', undefined);

    const mode = detectPerformanceMode();
    expect(VALID_MODES).toContain(mode);
  });

  it('does not throw when rendered in no-window runtime', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('navigator', undefined);

    const Probe = () => {
      const { performanceMode } = usePerformanceMode();
      return React.createElement('span', null, performanceMode);
    };

    expect(() => renderToString(React.createElement(Probe))).not.toThrow();
    expect(renderToString(React.createElement(Probe))).toContain('medium');
  });

  it('keeps hook usable when localStorage read/write/remove throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('read blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('write blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('remove blocked');
    });

    const { result } = renderHook(() => usePerformanceMode());
    expect(VALID_MODES).toContain(result.current.performanceMode);

    expect(() => {
      act(() => result.current.updatePerformanceMode('full'));
    }).not.toThrow();

    expect(() => {
      act(() => result.current.resetToAutoDetect());
    }).not.toThrow();

    expect(warnSpy).toHaveBeenCalled();
    expect(VALID_MODES).toContain(result.current.performanceMode);
  });
});

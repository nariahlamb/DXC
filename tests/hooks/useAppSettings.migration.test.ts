import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAppSettings } from '../../hooks/useAppSettings';

vi.mock('../../utils/storage/storageAdapter', () => {
  return {
    loadSettingsFromStorage: vi.fn(),
    saveSettingsToStorage: vi.fn(async () => {})
  };
});

const getStorageMocks = async () => {
  const mod = await import('../../utils/storage/storageAdapter');
  return mod as unknown as {
    loadSettingsFromStorage: ReturnType<typeof vi.fn>;
    saveSettingsToStorage: ReturnType<typeof vi.fn>;
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAppSettings legacy unified migration', () => {
  it('migrates aiConfig.unified into triad services when triad keys are empty', async () => {
    const { loadSettingsFromStorage } = await getStorageMocks();
    loadSettingsFromStorage.mockResolvedValueOnce({
      aiConfig: {
        unified: {
          provider: 'custom',
          baseUrl: 'http://127.0.0.1:8000/v1',
          apiKey: 'k',
          modelId: 'm',
          forceJsonOutput: false
        },
        services: {
          story: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
          state: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
          map: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false }
        }
      },
      promptModules: []
    });

    const { result } = renderHook(() => useAppSettings());

    await waitFor(() => {
      expect(result.current.settings.aiConfig.services.story.apiKey).toBe('k');
    });

    expect(result.current.settings.aiConfig.services.story.provider).toBe('custom');
    expect(result.current.settings.aiConfig.services.story.baseUrl).toBe('http://127.0.0.1:8000/v1');
    expect(result.current.settings.aiConfig.services.story.modelId).toBe('m');

    expect(result.current.settings.aiConfig.services.state.apiKey).toBe('k');
    expect(result.current.settings.aiConfig.services.map.apiKey).toBe('k');
  });

  it('keeps explicit triad service apiKey when it is set', async () => {
    const { loadSettingsFromStorage } = await getStorageMocks();
    loadSettingsFromStorage.mockResolvedValueOnce({
      aiConfig: {
        unified: {
          provider: 'custom',
          baseUrl: 'http://127.0.0.1:8000/v1',
          apiKey: 'unified-k',
          modelId: 'm',
          forceJsonOutput: false
        },
        services: {
          story: { provider: 'openai', baseUrl: 'https://api.example/v1', apiKey: 'story-k', modelId: 's', forceJsonOutput: false },
          state: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
          map: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false }
        }
      },
      promptModules: []
    });

    const { result } = renderHook(() => useAppSettings());

    await waitFor(() => {
      expect(result.current.settings.aiConfig.services.story.apiKey).toBe('story-k');
    });

    expect(result.current.settings.aiConfig.services.story.provider).toBe('openai');
    expect(result.current.settings.aiConfig.services.story.baseUrl).toBe('https://api.example/v1');
    // state/map should still inherit unified because they are empty.
    expect(result.current.settings.aiConfig.services.state.apiKey).toBe('unified-k');
    expect(result.current.settings.aiConfig.services.map.apiKey).toBe('unified-k');
  });

  it('does not fallback memory service to state service config', async () => {
    const { loadSettingsFromStorage } = await getStorageMocks();
    loadSettingsFromStorage.mockResolvedValueOnce({
      aiConfig: {
        services: {
          story: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
          memory: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
          map: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
          state: { provider: 'custom', baseUrl: 'http://127.0.0.1:8000/v1', apiKey: 'state-k', modelId: 'state-m', forceJsonOutput: false }
        }
      },
      promptModules: []
    });

    const { result } = renderHook(() => useAppSettings());

    await waitFor(() => {
      expect(result.current.settings.aiConfig.services.state.apiKey).toBe('state-k');
    });

    expect(result.current.settings.aiConfig.services.memory.apiKey).toBe('');
    expect(result.current.settings.aiConfig.services.memory.baseUrl).toBe('');
    expect(result.current.settings.aiConfig.services.memory.modelId).toBe('');
  });

  it('normalizes governance allowlist and soft-warning strategy', async () => {
    const { loadSettingsFromStorage } = await getStorageMocks();
    loadSettingsFromStorage.mockResolvedValueOnce({
      stateVarWriter: {
        governance: {
          turnScope: {
            crossTurnSoftWarning: {
              enabled: true,
              threshold: 2,
              sampling: 1.5,
              nonBlocking: true,
              escalation: {
                enabled: true,
                threshold: 0,
                action: 'block'
              }
            }
          },
          domainScope: {
            strictAllowlist: true,
            invalidConfigFallbackStrategy: 'use_default_allowlist',
            allowlist: {
              invalid_domain: {
                SYS_GlobalState: ['当前场景']
              }
            }
          },
          semanticScope: {
            anchors: ['economy', 'economy', ''],
            missingAnchorPolicy: 'warn',
            ambiguousAnchorPolicy: 'ignore'
          }
        }
      },
      promptModules: []
    });

    const { result } = renderHook(() => useAppSettings());

    await waitFor(() => {
      expect(result.current.settings.stateVarWriter.governance.turnScope.crossTurnSoftWarning.threshold).toBe(2);
    });

    expect(result.current.settings.stateVarWriter.governance.turnScope.crossTurnSoftWarning.sampling).toBe(1);
    expect(result.current.settings.stateVarWriter.governance.turnScope.crossTurnSoftWarning.escalation.threshold).toBe(3);
    expect(result.current.settings.stateVarWriter.governance.turnScope.crossTurnSoftWarning.escalation.action).toBe('block');
    expect(result.current.settings.stateVarWriter.governance.semanticScope.anchors).toEqual(['economy']);
    expect(result.current.settings.stateVarWriter.governance.semanticScope.ambiguousAnchorPolicy).toBe('ignore');
    expect(result.current.settings.stateVarWriter.governance.domainScope.allowlist.invalid_domain).toBeUndefined();
    expect(Object.keys(result.current.settings.stateVarWriter.governance.domainScope.allowlist).length).toBeGreaterThan(1);
  });
});


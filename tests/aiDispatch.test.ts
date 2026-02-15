import { describe, expect, it, vi } from 'vitest';
import { __aiDispatchTestHooks, dispatchAIRequest, resolveServiceConfig } from '../utils/aiDispatch';

const makeSettings = (stateApiKey = 'state-key', memoryApiKey = 'memory-key') => ({
  aiConfig: {
    services: {
      story: { provider: 'openai', baseUrl: 'https://story', apiKey: 'story-key', modelId: 'story-model' },
      memory: { provider: 'openai', baseUrl: 'https://memory', apiKey: memoryApiKey, modelId: 'memory-model' },
      map: { provider: 'openai', baseUrl: 'https://map', apiKey: 'map-key', modelId: 'map-model' },
      state: { provider: 'openai', baseUrl: 'https://state', apiKey: stateApiKey, modelId: 'state-model' }
    }
  }
});

describe('resolveServiceConfig core routing', () => {
  it('routes non core services to state endpoint', () => {
    const settings = makeSettings() as any;
    const keys = ['state', 'social', 'world', 'npcSync', 'npcBrain', 'phone', 'unknown'] as const;
    keys.forEach((key) => {
      const cfg = resolveServiceConfig(settings, key, { strictService: true });
      expect(cfg.apiKey).toBe('state-key');
      expect(cfg.modelId).toBe('state-model');
    });
  });

  it('keeps story/memory/map routing independent', () => {
    const settings = makeSettings() as any;
    expect(resolveServiceConfig(settings, 'story', { strictService: true }).apiKey).toBe('story-key');
    expect(resolveServiceConfig(settings, 'memory', { strictService: true }).apiKey).toBe('memory-key');
    expect(resolveServiceConfig(settings, 'map', { strictService: true }).apiKey).toBe('map-key');
  });

  it('memory endpoint missing key does not fallback to state key', () => {
    const settings = makeSettings('state-key', '') as any;
    const cfg = resolveServiceConfig(settings, 'memory', { strictService: true });
    expect(cfg.apiKey).toBe('');
    expect(cfg.modelId).toBe('memory-model');
  });

  it('strict mode keeps empty state apiKey without fallback', () => {
    const cfg = resolveServiceConfig(makeSettings('') as any, 'state', { strictService: true });
    expect(cfg.apiKey).toBe('');
    expect(cfg.modelId).toBe('state-model');
  });
});

describe('createThrottledEmitter delta mode', () => {
  it('emits incremental text instead of full snapshot', () => {
    const chunks: string[] = [];
    const emitter = __aiDispatchTestHooks.createThrottledEmitter(
      (chunk) => chunks.push(chunk),
      { intervalMs: 0, minChars: 1 }
    );

    emitter.emit('你');
    emitter.emit('你好');
    emitter.emit('你好，世');
    emitter.flush('你好，世界');

    expect(chunks).toEqual(['你', '好', '，世', '界']);
  });

  it('flushes pending text once when below threshold', () => {
    const chunks: string[] = [];
    const emitter = __aiDispatchTestHooks.createThrottledEmitter(
      (chunk) => chunks.push(chunk),
      { intervalMs: Number.MAX_SAFE_INTEGER, minChars: 1000 }
    );

    emitter.emit('abc');
    emitter.emit('abcdef');
    expect(chunks).toEqual([]);

    emitter.flush('abcdef');
    expect(chunks).toEqual(['abcdef']);
  });
});

describe('openai-compatible payload extraction', () => {
  it('extracts text from responses-style non-stream payload', () => {
    const payload = {
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: '{"logs":[' },
            { type: 'output_text', text: '{"sender":"旁白","text":"ok"}],"tavern_commands":[]}' }
          ]
        }
      ]
    } as any;
    const text = __aiDispatchTestHooks.extractTextFromResponsePayload(payload);
    expect(text).toContain('"logs"');
    expect(text).toContain('"tavern_commands"');
  });

  it('extracts text from responses-style SSE delta payload', () => {
    const chunk = __aiDispatchTestHooks.extractTextFromSsePayload(
      '{"type":"response.output_text.delta","delta":"{\\"logs\\":[{\\"sender\\":\\"旁白\\",\\"text\\":\\"ok\\"}],\\"tavern_commands\\":[] }"}'
    );
    expect(chunk.kind).toBe('delta');
    expect(chunk.text).toContain('"logs"');
  });

  it('extracts text from array-shaped message content payload', () => {
    const payload = {
      choices: [
        {
          message: {
            content: [
              { type: 'output_text', text: '{"logs":[{"sender":"旁白","text":"A"}' },
              { type: 'output_text', text: '],"tavern_commands":[]}' }
            ]
          }
        }
      ]
    } as any;
    const text = __aiDispatchTestHooks.extractTextFromResponsePayload(payload);
    expect(text).toContain('"logs"');
    expect(text).toContain('"tavern_commands"');
  });

  it('extracts text from generic delta content shape in SSE payload', () => {
    const chunk = __aiDispatchTestHooks.extractTextFromSsePayload(
      '{"delta":{"content":[{"type":"output_text","text":"{\\"logs\\":[{\\"sender\\":\\"旁白\\",\\"text\\":\\"ok\\"}],\\"tavern_commands\\":[] }"}]}}'
    );
    expect(chunk.kind).toBe('delta');
    expect(chunk.text).toContain('"logs"');
  });
});

describe('custom endpoint fallback compatibility', () => {
  it('fails fast when custom baseUrl is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as any);

    await expect(
      dispatchAIRequest(
        { provider: 'custom', baseUrl: '', apiKey: 'k', modelId: 'm' } as any,
        'system',
        'user',
        undefined,
        { responseFormat: 'json', timeoutMs: 30000 }
      )
    ).rejects.toThrow(/requires a non-empty Base URL/i);

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('falls back to /responses when /chat/completions is unsupported', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'not found'
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: '{"logs":[{"sender":"旁白","text":"fallback ok"}],"tavern_commands":[]}' }]
            }
          ]
        })
      });
    vi.stubGlobal('fetch', fetchMock as any);

    const result = await dispatchAIRequest(
      { provider: 'custom', baseUrl: 'https://gateway.example/v1', apiKey: 'k', modelId: 'm' } as any,
      'system',
      'user',
      undefined,
      { responseFormat: 'json', timeoutMs: 30000 }
    );

    expect(result).toContain('"tavern_commands"');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0] || '')).toContain('/chat/completions');
    expect(String(fetchMock.mock.calls[1]?.[0] || '')).toContain('/responses');
    vi.unstubAllGlobals();
  });
});

describe('dispatchAIRequest timeout and abort', () => {
  it('times out openai request when timeoutMs is reached', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      signal?.addEventListener('abort', () => {
        const err = new Error('aborted by timeout');
        (err as any).name = 'AbortError';
        reject(err);
      }, { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock as any);

    const request = dispatchAIRequest(
      { provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'k', modelId: 'gpt-4o-mini' } as any,
      'system',
      'user',
      undefined,
      { responseFormat: 'json', timeoutMs: 50 }
    );
    const rejection = expect(request).rejects.toThrow(/Request Timeout \(50ms\)/i);

    await vi.advanceTimersByTimeAsync(80);
    await rejection;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('maps external abort to standardized aborted error', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      signal?.addEventListener('abort', () => {
        const err = new Error('aborted by user');
        (err as any).name = 'AbortError';
        reject(err);
      }, { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock as any);
    const controller = new AbortController();

    const request = dispatchAIRequest(
      { provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'k', modelId: 'gpt-4o-mini' } as any,
      'system',
      'user',
      undefined,
      { responseFormat: 'json', signal: controller.signal, timeoutMs: 2000 }
    );
    controller.abort();

    await expect(request).rejects.toThrow(/Request Aborted/i);
    vi.unstubAllGlobals();
  });
});

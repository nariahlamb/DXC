import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dispatchAIRequestMock,
  resolveServiceConfigMock,
  resolveRequestTimeoutMsMock,
  extractServiceCommandsMock
} = vi.hoisted(() => ({
  dispatchAIRequestMock: vi.fn(),
  resolveServiceConfigMock: vi.fn(),
  resolveRequestTimeoutMsMock: vi.fn(() => 45000),
  extractServiceCommandsMock: vi.fn()
}));

vi.mock('../utils/aiDispatch', () => ({
  dispatchAIRequest: dispatchAIRequestMock,
  resolveServiceConfig: resolveServiceConfigMock,
  resolveRequestTimeoutMs: resolveRequestTimeoutMsMock
}));

vi.mock('../utils/aiJson', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/aiJson')>();
  return {
    ...actual,
    extractServiceCommands: (...args: any[]) => extractServiceCommandsMock(...args)
  };
});

import { generateServiceCommands } from '../utils/aiServices';

const makeSettings = () => ({
  promptModules: [],
  aiConfig: {
    services: {
      story: { provider: 'openai', baseUrl: 'https://story', apiKey: 'story', modelId: 'story' },
      map: { provider: 'openai', baseUrl: 'https://map', apiKey: 'map', modelId: 'map' },
      state: { provider: 'openai', baseUrl: 'https://s', apiKey: 's', modelId: 's' }
    }
  }
});

const makeState = () =>
  ({
    角色: { 姓名: 'Tester' },
    社交: [],
    任务: [],
    剧情: {},
    背包: [],
    世界: {},
    记忆: { lastLogIndex: 0 },
    日志: [],
    日志摘要: [],
    日志大纲: []
  }) as any;

describe('generateServiceCommands service retry', () => {
  beforeEach(() => {
    dispatchAIRequestMock.mockReset();
    resolveServiceConfigMock.mockReset();
    resolveRequestTimeoutMsMock.mockReset();
    extractServiceCommandsMock.mockReset();
    resolveRequestTimeoutMsMock.mockReturnValue(45000);
    resolveServiceConfigMock.mockReturnValue({
      provider: 'openai',
      baseUrl: 'https://api.test',
      apiKey: 'key',
      modelId: 'model'
    });
  });

  it('retries memory service up to success', async () => {
    dispatchAIRequestMock
      .mockRejectedValueOnce(new Error('API Error 429: rate limit'))
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce('{"tavern_commands":[{"action":"append_log_summary","value":{"回合":1,"时间":"1000-01-01 07:00","摘要":"ok"}}]}');
    extractServiceCommandsMock.mockReturnValue({
      tavern_commands: [{ action: 'append_log_summary', value: { 回合: 1, 时间: '1000-01-01 07:00', 摘要: 'ok' } }],
      rawResponse: '{"tavern_commands":[]}'
    });

    const result = await generateServiceCommands('memory', '{"foo":"bar"}', makeState(), makeSettings() as any);

    expect(dispatchAIRequestMock).toHaveBeenCalledTimes(3);
    expect(result.tavern_commands.length).toBe(1);
  });

  it('retries state service up to success', async () => {
    dispatchAIRequestMock
      .mockRejectedValueOnce(new Error('API Error 500: fail'))
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce('{"tavern_commands":[{"action":"upsert_sheet_rows","value":{"sheetId":"SYS_GlobalState","rows":[]}}]}');
    extractServiceCommandsMock.mockReturnValue({
      tavern_commands: [{ action: 'upsert_sheet_rows', value: { sheetId: 'SYS_GlobalState', rows: [] } }],
      rawResponse: '{"tavern_commands":[]}'
    });

    const result = await generateServiceCommands('state', '{"foo":"bar"}', makeState(), makeSettings() as any);

    expect(dispatchAIRequestMock).toHaveBeenCalledTimes(3);
    expect(result.tavern_commands.length).toBe(1);
  });
});

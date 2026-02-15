import { describe, expect, it } from 'vitest';
import { handleAppendLogOutline, handleAppendLogSummary } from '../../hooks/gameLogic/extendedCommands';
import type { TavernCommand } from '../../types';
import { assignAmIndexesForLogCommands, collectIndexedLogPairingIssues, normalizeAmIndex } from '../../utils/memory/amIndex';

describe('AM index utilities', () => {
  it('normalizes valid AM indexes', () => {
    expect(normalizeAmIndex('am12')).toBe('AM0012');
    expect(normalizeAmIndex('AM0007')).toBe('AM0007');
    expect(normalizeAmIndex('')).toBeNull();
    expect(normalizeAmIndex('A0012')).toBeNull();
  });

  it('assigns generated AM index to paired summary/outline commands', () => {
    const commands: TavernCommand[] = [
      {
        action: 'append_log_summary',
        value: { 回合: 10, 时间: '第2日 08:00', 摘要: '进入地下城' }
      },
      {
        action: 'append_log_outline',
        value: { 章节: '第一卷', 标题: '初入迷宫', 开始回合: 10, 事件列表: ['进入地下城'] }
      }
    ];

    const normalized = assignAmIndexesForLogCommands(commands, {
      日志摘要: [{ 编码索引: 'AM0003' }] as any,
      日志大纲: [] as any
    });

    const summaryValue = (normalized[0] as any).value;
    const outlineValue = (normalized[1] as any).value;
    expect(summaryValue.编码索引).toBe('AM0004');
    expect(outlineValue.编码索引).toBe('AM0004');
  });

  it('allocates sequential AM index when provided index jumps ahead', () => {
    const commands: TavernCommand[] = [
      {
        action: 'append_log_summary',
        value: { 回合: 11, 时间: '第2日 09:00', 摘要: '遇见商人', 编码索引: 'am0100' }
      },
      {
        action: 'append_log_outline',
        value: { 章节: '第一卷', 标题: '街区事件', 开始回合: 11, 事件列表: ['遇见商人'] }
      }
    ];

    const normalized = assignAmIndexesForLogCommands(commands, {
      日志摘要: [] as any,
      日志大纲: [] as any
    });

    const summaryValue = (normalized[0] as any).value;
    const outlineValue = (normalized[1] as any).value;
    expect(summaryValue.编码索引).toBe('AM0001');
    expect(outlineValue.编码索引).toBe('AM0001');
  });

  it('keeps provided AM index only when it exactly matches next sequential index', () => {
    const commands: TavernCommand[] = [
      {
        action: 'append_log_summary',
        value: { 回合: 12, 时间: '第2日 09:30', 摘要: '继续推进', 编码索引: 'am0100' }
      },
      {
        action: 'append_log_outline',
        value: { 章节: '第一卷', 标题: '推进', 开始回合: 12, 事件列表: ['继续推进'] }
      }
    ];

    const normalized = assignAmIndexesForLogCommands(commands, {
      日志摘要: [{ 编码索引: 'AM0099' }] as any,
      日志大纲: [] as any
    });

    const summaryValue = (normalized[0] as any).value;
    const outlineValue = (normalized[1] as any).value;
    expect(summaryValue.编码索引).toBe('AM0100');
    expect(outlineValue.编码索引).toBe('AM0100');
  });

  it('reports indexed pairing mismatches', () => {
    const issues = collectIndexedLogPairingIssues({
      日志摘要: [{ 编码索引: 'AM0001' }, { 编码索引: 'AM0002' }] as any,
      日志大纲: [{ 编码索引: 'AM0002' }, { 编码索引: 'AM0003' }] as any
    });

    expect(issues.missingOutline).toEqual(['AM0001']);
    expect(issues.missingSummary).toEqual(['AM0003']);
  });
});

describe('append log handlers', () => {
  it('normalizes AM index to uppercase when appending summary/outline', () => {
    const state: any = {};

    const summaryResult = handleAppendLogSummary(state, {
      回合: 12,
      时间: '第2日 10:00',
      摘要: '触发支线',
      编码索引: 'am0015'
    });
    expect(summaryResult.success).toBe(true);
    expect(state.日志摘要[0].编码索引).toBe('AM0015');

    const outlineResult = handleAppendLogOutline(state, {
      章节: '第一卷',
      标题: '支线开启',
      开始回合: 12,
      事件列表: ['触发支线'],
      编码索引: 'am0015'
    });
    expect(outlineResult.success).toBe(true);
    expect(state.日志大纲[0].编码索引).toBe('AM0015');
  });

  it('sanitizes malformed AM index on summary payload', () => {
    const state: any = {};
    const result = handleAppendLogSummary(state, {
      回合: 13,
      时间: '第2日 11:00',
      摘要: '异常输入',
      编码索引: 'INVALID'
    });
    expect(result.success).toBe(true);
    expect(String(state.日志摘要?.[0]?.编码索引 || '')).toBe('');
  });
});

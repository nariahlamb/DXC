import { describe, it, expect } from 'vitest';
import { getProcessingStageLabel, resolveProcessingStage } from '../utils/ui/processingStage';

describe('smoke', () => {
  it('vitest is wired', () => {
    expect(1).toBe(1);
  });

  it('ui baseline metrics defaults are numeric', () => {
    const baseline = {
      actionLatencyMs: 0,
      logsReadabilityScore: 0,
      crossEndConsistencyScore: 0
    };

    expect(typeof baseline.actionLatencyMs).toBe('number');
    expect(typeof baseline.logsReadabilityScore).toBe('number');
    expect(typeof baseline.crossEndConsistencyScore).toBe('number');
  });

  it('processing stage mapping stays stable', () => {
    expect(getProcessingStageLabel(resolveProcessingStage({
      isProcessing: true,
      isStreaming: false,
      isPhoneProcessing: false
    }))).toBe('排队中');

    expect(getProcessingStageLabel(resolveProcessingStage({
      isProcessing: true,
      isStreaming: true,
      isPhoneProcessing: false
    }))).toBe('生成中');

    expect(getProcessingStageLabel(resolveProcessingStage({
      isProcessing: true,
      isStreaming: false,
      isPhoneProcessing: true
    }))).toBe('应用中');
  });
});

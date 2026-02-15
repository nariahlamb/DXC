import { describe, expect, it } from 'vitest';
import { migrateSettings } from '../../hooks/useAppSettings';
import { resolveMotionLevel } from '../../hooks/usePerformanceMode';
import { collectTaskRelatedLogs } from '../../utils/ui/logTaskLinking';
import { getNavigationPriority } from '../../utils/ui/navigationPriority';
import { getProcessingStageLabel, resolveProcessingStage } from '../../utils/ui/processingStage';

describe('ui upgrade regression suite', () => {
  it('passes full UX regression gates', () => {
    const logs = [
      { id: 'log-1', text: '任务 task-1 已更新' },
      { id: 'log-2', text: '你接到任务：清理下水道' }
    ] as any[];
    const task = { id: 'task-1', 标题: '清理下水道' } as any;
    const relatedLogs = collectTaskRelatedLogs(task, logs as any);

    const navOrder = getNavigationPriority({
      unreadPhoneCount: 2,
      activeTaskCount: 1,
      hasUrgentNews: true
    });

    const migratedSettings = migrateSettings({
      fontSize: 'large',
      readability: { lineHeight: 'relaxed' }
    });

    const queuedLabel = getProcessingStageLabel(resolveProcessingStage({
      isProcessing: true,
      isStreaming: false,
      isPhoneProcessing: false
    }));
    const generatingLabel = getProcessingStageLabel(resolveProcessingStage({
      isProcessing: true,
      isStreaming: true,
      isPhoneProcessing: false
    }));
    const applyingLabel = getProcessingStageLabel(resolveProcessingStage({
      isProcessing: true,
      isStreaming: false,
      isPhoneProcessing: true
    }));

    const gates = {
      logReadability: relatedLogs.length === 2,
      actionLoop: queuedLabel === '排队中' && generatingLabel === '生成中' && applyingLabel === '应用中',
      crossEndPriority: navOrder[0] === 'PHONE' && navOrder[1] === 'TASKS',
      accessibilitySettings: migratedSettings.readability.lineHeight === 'relaxed'
        && migratedSettings.readability.contrastMode === 'default'
        && migratedSettings.readability.infoDensity === 'balanced',
      motionBudget: resolveMotionLevel({ fps: 24, userPreference: 'auto' }) === 'minimal'
    };

    expect(Object.values(gates).every(Boolean)).toBe(true);
  });
});

export type ProcessingStage = 'idle' | 'queued' | 'generating' | 'applying';

export interface ProcessingStageFlags {
  isProcessing: boolean;
  isStreaming: boolean;
  isPhoneProcessing: boolean;
}

export const PROCESSING_STAGE_LABELS: Record<Exclude<ProcessingStage, 'idle'>, string> = {
  queued: '排队中',
  generating: '生成中',
  applying: '应用中'
};

export function resolveProcessingStage(flags: ProcessingStageFlags): ProcessingStage {
  if (!flags.isProcessing) return 'idle';
  if (flags.isStreaming) return 'generating';
  return flags.isPhoneProcessing ? 'applying' : 'queued';
}

export function getProcessingStageLabel(stage: ProcessingStage): string {
  if (stage === 'idle') return '';
  return PROCESSING_STAGE_LABELS[stage];
}

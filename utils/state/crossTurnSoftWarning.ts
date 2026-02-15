import type { TavernCommand } from '../../types';

export type CrossTurnSoftWarningConfig = {
  enabled?: boolean;
  threshold?: number;
  sampling?: number;
};

export type CrossTurnSoftWarningResult = {
  count: number;
  threshold: number;
  sampling: number;
  samples: string[];
};

const parseCommandTurn = (cmd: TavernCommand): number | null => {
  const candidates = [
    (cmd as any)?.turn_id,
    (cmd as any)?.turnId,
    (cmd as any)?.turn,
    (cmd as any)?.回合,
    (cmd as any)?.value?.turn_id,
    (cmd as any)?.value?.turnId,
    (cmd as any)?.value?.turn,
    (cmd as any)?.value?.回合
  ];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return null;
};

export const evaluateCrossTurnSoftWarning = (
  commands: TavernCommand[],
  currentTurn: number,
  config: CrossTurnSoftWarningConfig | undefined,
  maxSamples: number = 3
): CrossTurnSoftWarningResult => {
  const safeCommands = Array.isArray(commands) ? commands : [];
  const threshold = Math.max(1, Math.floor(Number(config?.threshold || 1)));
  const sampling = Math.max(1, Math.floor(Number(config?.sampling || 1)));
  if (config?.enabled === false || safeCommands.length === 0) {
    return { count: 0, threshold, sampling, samples: [] };
  }
  let count = 0;
  const samples: string[] = [];
  const safeCurrentTurn = Math.max(1, Math.floor(Number(currentTurn || 0)));
  safeCommands.forEach((cmd, index) => {
    const cmdTurn = parseCommandTurn(cmd);
    if (cmdTurn === null || cmdTurn === safeCurrentTurn) return;
    if (Math.abs(cmdTurn - safeCurrentTurn) < threshold) return;
    if (sampling > 1 && ((safeCurrentTurn + index + cmdTurn) % sampling !== 0)) return;
    count += 1;
    if (samples.length < maxSamples) {
      samples.push(`${cmdTurn}:${String((cmd as any)?.action || (cmd as any)?.type || 'unknown')}`);
    }
  });
  return { count, threshold, sampling, samples };
};

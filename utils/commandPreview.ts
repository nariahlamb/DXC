import type { CommandItem } from '../hooks/gameLogic/commandQueue';

export const buildPreviewCommands = (
  isProcessing: boolean,
  pendingCommands: CommandItem[],
  commandQueue: CommandItem[],
): CommandItem[] => {
  if (!isProcessing) return commandQueue;
  if (pendingCommands.length === 0) return commandQueue;
  if (commandQueue.length === 0) return pendingCommands;
  return [...pendingCommands, ...commandQueue];
};

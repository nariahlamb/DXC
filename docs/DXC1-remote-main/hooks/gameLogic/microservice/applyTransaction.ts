import type { GameState, TavernCommand } from '../../../types';
import { applyTurnTransaction } from '../../../utils/taverndb/turnTransaction';

export type ProcessTavernCommandsFn = (
  state: GameState,
  commands: TavernCommand[]
) => {
  newState: GameState;
  logs: any[];
  hasError: boolean;
  sheetPatches?: any[];
};

export const createApplyCommandsWithTurnTransaction = (
  processTavernCommands: ProcessTavernCommandsFn
) => {
  return (state: GameState, commands: TavernCommand[]) => {
    return applyTurnTransaction(state, commands, processTavernCommands, { forceAtomic: true });
  };
};

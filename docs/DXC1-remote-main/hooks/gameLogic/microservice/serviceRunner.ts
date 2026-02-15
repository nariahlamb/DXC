import type { AppSettings, GameState, TavernCommand } from '../../../types';

export type ServiceRunResult = {
  tavern_commands: TavernCommand[];
  rawResponse: string;
  repairNote?: string;
};

export type ExecuteServiceRequestParams = {
  serviceKey: string;
  input: string;
  stateSnapshot: GameState;
  settings: AppSettings;
  signal?: AbortSignal | null;
  runMemoryParallelBySheet: (input: string, stateSnapshot: GameState, signal?: AbortSignal | null) => Promise<ServiceRunResult>;
  runStateParallelBySheet: (input: string, stateSnapshot: GameState) => Promise<ServiceRunResult>;
  generateServiceCommands: (
    serviceKey: string,
    input: string,
    stateSnapshot: GameState,
    settings: AppSettings,
    signal?: AbortSignal | null
  ) => Promise<ServiceRunResult>;
};

export const executeServiceRequest = async (params: ExecuteServiceRequestParams): Promise<ServiceRunResult> => {
  const {
    serviceKey,
    input,
    stateSnapshot,
    settings,
    signal,
    runMemoryParallelBySheet,
    runStateParallelBySheet,
    generateServiceCommands
  } = params;
  const normalizedServiceKey = serviceKey === 'memory' || serviceKey === 'map' ? serviceKey : 'state';

  if (normalizedServiceKey === 'memory') {
    return runMemoryParallelBySheet(input, stateSnapshot, signal);
  }

  if (normalizedServiceKey === 'state') {
    return runStateParallelBySheet(input, stateSnapshot);
  }

  return generateServiceCommands('map', input, stateSnapshot, settings, signal);
};

import type { AppSettings, GameState, TavernCommand } from '../../../types';
import { applyNarrativeEconomicFallback } from '../../../utils/state/econNarrativeFallback';

export type StateFallbackOutcome = {
  evaluated: boolean;
  applied: boolean;
  reasonClass: string;
  delta?: number;
  marker?: string;
};

export type ServiceRunResult = {
  tavern_commands: TavernCommand[];
  rawResponse: string;
  repairNote?: string;
  fallbackOutcome?: StateFallbackOutcome;
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
    const result = await runStateParallelBySheet(input, stateSnapshot);
    const baseCommands = Array.isArray(result.tavern_commands) ? result.tavern_commands : [];
    const governance = settings?.stateVarWriter?.governance;
    const fallback = applyNarrativeEconomicFallback(input, baseCommands, {
      strictAllowlist: governance?.domainScope?.strictAllowlist !== false,
      allowlist: governance?.domainScope?.allowlist
    });
    const fallbackNote = `econ-fallback(${fallback.reasonClass}${typeof fallback.delta === 'number' ? `,delta=${fallback.delta}` : ''})`;
    if (!fallback.applied) {
      return {
        ...result,
        tavern_commands: baseCommands,
        repairNote: result.repairNote ? `${result.repairNote} | ${fallbackNote}` : fallbackNote,
        fallbackOutcome: {
          evaluated: true,
          applied: false,
          reasonClass: fallback.reasonClass,
          delta: fallback.delta,
          marker: fallback.marker
        }
      };
    }
    return {
      ...result,
      tavern_commands: fallback.commands,
      repairNote: result.repairNote
        ? `${result.repairNote} | ${fallback.marker || fallbackNote}`
        : (fallback.marker || fallbackNote),
      fallbackOutcome: {
        evaluated: true,
        applied: true,
        reasonClass: fallback.reasonClass,
        delta: fallback.delta,
        marker: fallback.marker
      }
    };
  }

  return generateServiceCommands('map', input, stateSnapshot, settings, signal);
};

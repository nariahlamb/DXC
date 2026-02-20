import type { AppSettings, GameState, TavernCommand } from '../../../types';
import { applyNarrativeEconomicFallback } from '../../../utils/state/econNarrativeFallback';
import { applyNarrativeNpcFallback } from '../../../utils/state/npcNarrativeFallback';

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

    const econFallback = applyNarrativeEconomicFallback(input, baseCommands, {
      strictAllowlist: governance?.domainScope?.strictAllowlist !== false,
      allowlist: governance?.domainScope?.allowlist
    });
    const econFallbackNote = `econ-fallback(${econFallback.reasonClass}${typeof econFallback.delta === 'number' ? `,delta=${econFallback.delta}` : ''})`;

    const npcFallback = applyNarrativeNpcFallback(input, econFallback.commands, stateSnapshot, {
      strictAllowlist: governance?.domainScope?.strictAllowlist !== false,
      allowlist: governance?.domainScope?.allowlist
    });
    const npcFallbackNote = `npc-fallback(${npcFallback.reasonClass})`;

    const fallbackNoteParts = [
      result.repairNote,
      econFallback.marker || econFallbackNote,
      npcFallback.marker || npcFallbackNote
    ].filter(Boolean);

    return {
      ...result,
      tavern_commands: npcFallback.commands,
      repairNote: fallbackNoteParts.join(' | '),
      fallbackOutcome: {
        evaluated: true,
        applied: Boolean(econFallback.applied || npcFallback.applied),
        reasonClass: `econ:${econFallback.reasonClass};npc:${npcFallback.reasonClass}`,
        delta: econFallback.delta,
        marker: [econFallback.marker, npcFallback.marker].filter(Boolean).join(' | ') || undefined
      }
    };
  }

  return generateServiceCommands('map', input, stateSnapshot, settings, signal);
};

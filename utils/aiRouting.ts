import type { AppSettings, TavernCommand } from '../types';

export type AiRoutingProfile = {
  isMicroserviceMode: boolean;
  storyOnlyNarrative: boolean;
  stateServiceEnabled: boolean;
};

export const getAiRoutingProfile = (settings: AppSettings): AiRoutingProfile => {
  const stateApiKey = String(settings.aiConfig?.services?.state?.apiKey || '').trim();
  const stateServiceEnabled = !!stateApiKey;
  return {
    isMicroserviceMode: true,
    storyOnlyNarrative: true,
    stateServiceEnabled
  };
};

export const shouldUseNarrativeOnlyPipeline = (
  settings: AppSettings,
  isStateServiceConfigured: boolean
) => {
  const profile = getAiRoutingProfile(settings);
  if (profile.storyOnlyNarrative) return true;
  return profile.stateServiceEnabled && isStateServiceConfigured;
};

export const filterStoryCommands = (
  commands: TavernCommand[],
  useNarrativeOnlyPipeline: boolean
): TavernCommand[] => {
  if (!useNarrativeOnlyPipeline) return commands;
  // Story model is narrative-only in triad pipeline.
  // All business/state mutations must be produced by state/memory/map services.
  return [];
};

export const validateAiSettings = (settings: AppSettings) => {
  const errors: string[] = [];
  const profile = getAiRoutingProfile(settings);
  if (profile.storyOnlyNarrative && !profile.stateServiceEnabled) errors.push('state');
  return errors;
};

import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { AppSettings, ContextModuleConfig, GameState } from '../../types';
import { Difficulty } from '../../types/enums';
import { DEFAULT_PROMPT_MODULES } from '../../utils/ai';
import { loadSettingsFromStorage, saveSettingsToStorage } from '../../utils/storage/storageAdapter';

const mergePromptModules = (
    savedModules: any[],
    defaults: typeof DEFAULT_PROMPT_MODULES = DEFAULT_PROMPT_MODULES
): ContextModuleConfig[] => {
    const renameMap: Record<string, string> = {
        'Easy Mode': '难度-轻松',
        'Normal Mode': '难度-普通',
        'Hard Mode': '难度-困难',
        'Hell Mode': '难度-地狱',
        'Physiology Easy': '生理-轻松',
        'Physiology Normal': '生理-普通',
        'Physiology Hard': '生理-困难',
        'Physiology Hell': '生理-地狱'
    };

    const savedMap = new Map(savedModules.map((m: any) => [m.id, m]));
    const mergedDefaults = defaults.map(def => {
        const saved = savedMap.get(def.id);
        if (!saved) return def;
        const renamed = renameMap[saved.name] ? def.name : saved.name;
        return { ...def, ...saved, name: renamed } as ContextModuleConfig;
    });

    const defaultIds = new Set(defaults.map(m => m.id));
    const extraModules = savedModules.filter((m: any) => !defaultIds.has(m.id) && m.id !== 'world_if');
    return [...mergedDefaults, ...extraModules];
};

const normalizeTriadAiConfig = (rawAiConfig: any, defaults: AppSettings['aiConfig']) => {
    const rawServices = rawAiConfig?.services || {};
    const storyService = rawServices.story || defaults.services.story;
    const mapService = rawServices.map || defaults.services.map;
    const stateService = rawServices.state || defaults.services.state;
    const memoryService = rawServices.memory || rawServices.state || defaults.services.memory || defaults.services.state;

    return {
        ...defaults,
        requestTimeoutMs: Number.isFinite(rawAiConfig?.requestTimeoutMs)
            ? Number(rawAiConfig.requestTimeoutMs)
            : defaults.requestTimeoutMs,
        serviceRequestTimeoutMs: {
            ...defaults.serviceRequestTimeoutMs,
            ...(rawAiConfig?.serviceRequestTimeoutMs || {})
        },
        nativeThinkingChain: rawAiConfig?.nativeThinkingChain ?? defaults.nativeThinkingChain,
        multiStageThinking: rawAiConfig?.multiStageThinking ?? defaults.multiStageThinking,
        services: {
            story: storyService,
            memory: memoryService,
            state: stateService,
            map: mapService
        }
    };
};

const mergeAiConfig = (parsed: any, defaultSettings: AppSettings) => {
    return normalizeTriadAiConfig(parsed?.aiConfig, defaultSettings.aiConfig);
};

export interface UseSettingsManagerOptions {
    defaultSettings: AppSettings;
    defaultPromptModules?: typeof DEFAULT_PROMPT_MODULES;
    gameState: GameState;
}

export interface SettingsManagerReturn {
    settings: AppSettings;
    setSettings: Dispatch<SetStateAction<AppSettings>>;
    saveSettings: (newSettings: AppSettings) => void;
}

export const useSettingsManager = ({ defaultSettings, defaultPromptModules = DEFAULT_PROMPT_MODULES, gameState }: UseSettingsManagerOptions): SettingsManagerReturn => {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);

    useEffect(() => {
        loadSettingsFromStorage<any>()
            .then((parsed) => {
                if (!parsed) return;
                const savedModules = Array.isArray(parsed.promptModules) ? parsed.promptModules : [];
                const mergedPromptModules = mergePromptModules(savedModules, defaultPromptModules);
                const mergedAiConfig = mergeAiConfig(parsed, defaultSettings);
                setSettings({
                    ...defaultSettings,
                    ...parsed,
                    promptModules: mergedPromptModules,
                    aiConfig: mergedAiConfig,
                    memoryConfig: parsed.memoryConfig || defaultSettings.memoryConfig
                });
            })
            .catch((error) => {
                console.warn('Settings corrupted', error);
            });
    }, [defaultSettings, defaultPromptModules]);

    useEffect(() => {
        if (!gameState.游戏难度) return;
        setSettings(prev => {
            const currentDiff = gameState.游戏难度 || Difficulty.NORMAL;
            let hasChanged = false;
            const newPromptModules = prev.promptModules.map(mod => {
                let shouldBeActive = mod.isActive;
                if (mod.group === '难度系统') {
                    if (currentDiff === Difficulty.EASY && mod.id === 'diff_easy') shouldBeActive = true;
                    else if (currentDiff === Difficulty.NORMAL && mod.id === 'diff_normal') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HARD && mod.id === 'diff_hard') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HELL && mod.id === 'diff_hell') shouldBeActive = true;
                    else shouldBeActive = false;
                }
                if (mod.group === '生理系统') {
                    if (currentDiff === Difficulty.EASY && mod.id === 'phys_easy') shouldBeActive = true;
                    else if (currentDiff === Difficulty.NORMAL && mod.id === 'phys_normal') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HARD && mod.id === 'phys_hard') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HELL && mod.id === 'phys_hell') shouldBeActive = true;
                    else shouldBeActive = false;
                }
                if (mod.group === '判定系统') {
                    if (currentDiff === Difficulty.EASY && mod.id === 'judge_easy') shouldBeActive = true;
                    else if (currentDiff === Difficulty.NORMAL && mod.id === 'judge_normal') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HARD && mod.id === 'judge_hard') shouldBeActive = true;
                    else if (currentDiff === Difficulty.HELL && mod.id === 'judge_hell') shouldBeActive = true;
                    else shouldBeActive = false;
                }
                if (shouldBeActive !== mod.isActive) {
                    hasChanged = true;
                    return { ...mod, isActive: shouldBeActive };
                }
                return mod;
            });
            if (hasChanged) return { ...prev, promptModules: newPromptModules };
            return prev;
        });
    }, [gameState.游戏难度]);

    const saveSettings = (newSettings: AppSettings) => {
        const normalizedSettings: AppSettings = {
            ...newSettings,
            aiConfig: normalizeTriadAiConfig(newSettings.aiConfig, defaultSettings.aiConfig)
        };
        setSettings(normalizedSettings);
        saveSettingsToStorage(normalizedSettings).catch((error) => {
            console.warn('saveSettings failed', error);
        });
    };

    return { settings, setSettings, saveSettings };
};

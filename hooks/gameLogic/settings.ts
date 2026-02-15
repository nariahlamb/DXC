import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { AppSettings, ContextModuleConfig, GameState } from '../../types';
import { Difficulty } from '../../types/enums';
import { DEFAULT_PROMPT_MODULES } from '../../utils/ai';
import { loadSettingsFromStorage, saveSettingsToStorage } from '../../utils/storage/storageAdapter';
import { normalizeStateVariableAllowlist } from '../../utils/taverndb/sheetRegistry';

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

const normalizeStateVarWriterSettings = (
    raw: any,
    defaults: AppSettings['stateVarWriter']
): AppSettings['stateVarWriter'] => {
    const defaultGovernance = defaults.governance || {
        turnScope: {
            crossTurnSoftWarning: {
                enabled: true,
                threshold: 1,
                sampling: 1,
                nonBlocking: true,
                escalation: {
                    enabled: false,
                    threshold: 3,
                    action: 'warn'
                }
            }
        },
        domainScope: {
            strictAllowlist: true,
            allowlist: normalizeStateVariableAllowlist(undefined).allowlist,
            invalidConfigFallbackStrategy: 'use_default_allowlist' as const
        },
        semanticScope: {
            anchors: ['economy'],
            missingAnchorPolicy: 'warn' as const,
            ambiguousAnchorPolicy: 'warn' as const
        }
    };
    const normalizeCrossTurnSoftWarning = (
        rawTurnScope: any,
        defaultTurnScope: AppSettings['stateVarWriter']['governance']['turnScope']['crossTurnSoftWarning']
    ): AppSettings['stateVarWriter']['governance']['turnScope']['crossTurnSoftWarning'] => {
        const rawThreshold = Number(rawTurnScope?.threshold);
        const rawSampling = Number(rawTurnScope?.sampling);
        const rawEscalationThreshold = Number(rawTurnScope?.escalation?.threshold);
        const escalationAction = rawTurnScope?.escalation?.action === 'block' ? 'block' : 'warn';
        return {
            enabled: rawTurnScope?.enabled !== false,
            threshold: Number.isFinite(rawThreshold) && rawThreshold >= 0
                ? Math.floor(rawThreshold)
                : defaultTurnScope.threshold,
            sampling: Number.isFinite(rawSampling)
                ? Math.min(1, Math.max(0, rawSampling))
                : defaultTurnScope.sampling,
            nonBlocking: rawTurnScope?.nonBlocking !== false,
            escalation: {
                enabled: rawTurnScope?.escalation?.enabled === true,
                threshold: Number.isFinite(rawEscalationThreshold) && rawEscalationThreshold > 0
                    ? Math.floor(rawEscalationThreshold)
                    : defaultTurnScope.escalation.threshold,
                action: escalationAction
            }
        };
    };

    const normalizeGovernance = (
        rawGovernance: any,
        defaultGovernance: AppSettings['stateVarWriter']['governance']
    ): AppSettings['stateVarWriter']['governance'] => {
        const fallbackStrategy = rawGovernance?.domainScope?.invalidConfigFallbackStrategy === 'merge_with_default_allowlist'
            ? 'merge_with_default_allowlist'
            : defaultGovernance.domainScope.invalidConfigFallbackStrategy;
        const normalizedAllowlist = normalizeStateVariableAllowlist(
            rawGovernance?.domainScope?.allowlist,
            fallbackStrategy
        );
        const anchors = Array.isArray(rawGovernance?.semanticScope?.anchors)
            ? rawGovernance.semanticScope.anchors
                .map((item: unknown) => String(item ?? '').trim())
                .filter((item: string) => item.length > 0)
            : defaultGovernance.semanticScope.anchors;
        return {
            turnScope: {
                crossTurnSoftWarning: normalizeCrossTurnSoftWarning(
                    rawGovernance?.turnScope?.crossTurnSoftWarning,
                    defaultGovernance.turnScope.crossTurnSoftWarning
                )
            },
            domainScope: {
                strictAllowlist: rawGovernance?.domainScope?.strictAllowlist !== false,
                allowlist: normalizedAllowlist.allowlist,
                invalidConfigFallbackStrategy: fallbackStrategy
            },
            semanticScope: {
                anchors: Array.from(new Set(anchors)),
                missingAnchorPolicy: rawGovernance?.semanticScope?.missingAnchorPolicy === 'ignore' ? 'ignore' : 'warn',
                ambiguousAnchorPolicy: rawGovernance?.semanticScope?.ambiguousAnchorPolicy === 'ignore' ? 'ignore' : 'warn'
            }
        };
    };

    const cutoverDomains = Array.isArray(raw?.cutoverDomains)
        ? raw.cutoverDomains
            .map((item: unknown) => String(item ?? '').trim())
            .filter((item: string) => item.length > 0)
        : defaults.cutoverDomains;
    return {
        enabled: raw?.enabled === true,
        shadowMode: raw?.shadowMode === true,
        cutoverDomains: Array.from(new Set(cutoverDomains)),
        rejectNonWriterForCutoverDomains: raw?.rejectNonWriterForCutoverDomains === true,
        governance: normalizeGovernance(raw?.governance, defaultGovernance)
    };
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
                    memoryConfig: parsed.memoryConfig || defaultSettings.memoryConfig,
                    stateVarWriter: normalizeStateVarWriterSettings(parsed?.stateVarWriter, defaultSettings.stateVarWriter)
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
            aiConfig: normalizeTriadAiConfig(newSettings.aiConfig, defaultSettings.aiConfig),
            stateVarWriter: normalizeStateVarWriterSettings(newSettings.stateVarWriter, defaultSettings.stateVarWriter)
        };
        setSettings(normalizedSettings);
        saveSettingsToStorage(normalizedSettings).catch((error) => {
            console.warn('saveSettings failed', error);
        });
    };

    return { settings, setSettings, saveSettings };
};

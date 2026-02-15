
import { useState, useEffect } from 'react';
import { AppSettings, ContextConfig, ContextModuleConfig } from '../types';
import { DEFAULT_PROMPT_MODULES, DEFAULT_MEMORY_CONFIG } from '../utils/ai';
import { loadSettingsFromStorage, saveSettingsToStorage } from '../utils/storage/storageAdapter';

const DEFAULT_CONTEXT_MODULES: ContextModuleConfig[] = [
    { id: 'm_sys', type: 'SYSTEM_PROMPTS', name: '系统核心设定', enabled: true, order: 0, params: {} },
    { id: 'm_player', type: 'PLAYER_DATA', name: '玩家数据', enabled: true, order: 1, params: {} },
    { id: 'm_map', type: 'MAP_CONTEXT', name: '地图环境', enabled: true, order: 2, params: { detailLevel: 'medium', alwaysIncludeDungeon: true } },
    { id: 'm_social', type: 'SOCIAL_CONTEXT', name: '周边NPC', enabled: true, order: 3, params: { includeAttributes: ['appearance', 'status'], presentMemoryLimit: 30, absentMemoryLimit: 6, specialPresentMemoryLimit: 30, specialAbsentMemoryLimit: 12 } },
    { id: 'm_familia', type: 'FAMILIA_CONTEXT', name: '眷族信息', enabled: true, order: 4, params: {} },
    { id: 'm_inv', type: 'INVENTORY_CONTEXT', name: '背包/公共战利品', enabled: true, order: 5, params: { detailLevel: 'medium' } },
    {
      id: 'm_phone',
      type: 'PHONE_CONTEXT',
      name: '手机/消息',
      enabled: true,
      order: 6,
      params: {
        perThreadLimit: 10,
        includeMoments: true,
        momentLimit: 6,
        includePublicPosts: true,
        forumLimit: 6,
        excludeThreadTitles: ['公会导航服务', '健康统计助手', '健康服务助手']
      }
    },
    { id: 'm_combat', type: 'COMBAT_CONTEXT', name: '战斗数据', enabled: true, order: 7, params: {} },
    { id: 'm_task', type: 'TASK_CONTEXT', name: '任务列表', enabled: true, order: 8, params: {} },
    { id: 'm_world', type: 'WORLD_CONTEXT', name: '世界动态', enabled: true, order: 9, params: {} },
    { id: 'm_story', type: 'STORY_CONTEXT', name: '剧情进度', enabled: true, order: 10, params: {} },
    {
      id: 'm_mem',
      type: 'MEMORY_CONTEXT',
      name: '记忆流',
      enabled: true,
      order: 11,
      params: {
        aiOnlyContext: true,
        includePrecedingUser: true,
        contextLayerLimit: 12,
        retrievalMode: 'narrative',
        retrievalTopK: 8,
        enableMemoryRetrieval: true,
        enableTableRetrieval: true,
        enableIndexRetrieval: true,
        enableFactBoundary: true,
        indexRetrievalTopK: 6,
        indexSummaryWindow: 16,
        indexOutlineWindow: 12,
        indexSourceFilter: ['paired', 'summary', 'outline']
      }
    },
    { id: 'm_hist', type: 'COMMAND_HISTORY', name: '指令历史', enabled: true, order: 12, params: {} },
    { id: 'm_input', type: 'USER_INPUT', name: '玩家输入', enabled: true, order: 13, params: {} },
];

const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
    modules: DEFAULT_CONTEXT_MODULES
};

export const DEFAULT_READABILITY_SETTINGS: AppSettings['readability'] = {
    lineHeight: 'normal',
    contrastMode: 'default',
    infoDensity: 'balanced'
};

const normalizeTriadAiConfig = (rawAiConfig: any, defaults: AppSettings['aiConfig']) => {
    const rawServices = rawAiConfig?.services || {};
    // 兼容旧版存档：旧版支持 unified 模式，用户可能只配置了 rawAiConfig.unified，
    // 而 story/state/map 仍为空，导致当前 triad-only 路由读不到有效 API 配置。
    const legacyUnified = rawAiConfig?.unified || null;

    const pickNonEmptyString = (primary: any, secondary: any, fallback: string) => {
        const p = typeof primary === 'string' ? primary.trim() : '';
        if (p) return p;
        const s = typeof secondary === 'string' ? secondary.trim() : '';
        if (s) return s;
        return fallback;
    };

    const pickProvider = (primary: any, secondary: any, fallback: any) => {
        const allowed = new Set(['gemini', 'openai', 'deepseek', 'custom']);
        if (allowed.has(primary)) return primary;
        if (allowed.has(secondary)) return secondary;
        return fallback;
    };

    const normalizeEndpoint = (serviceCandidate: any, unifiedCandidate: any, fallback: any) => {
        const hasServiceMaterial = [serviceCandidate?.apiKey, serviceCandidate?.baseUrl, serviceCandidate?.modelId]
            .some((v) => typeof v === 'string' && v.trim().length > 0);
        return {
            provider: pickProvider(
                hasServiceMaterial ? serviceCandidate?.provider : undefined,
                unifiedCandidate?.provider,
                fallback.provider
            ),
            baseUrl: pickNonEmptyString(serviceCandidate?.baseUrl, unifiedCandidate?.baseUrl, fallback.baseUrl),
            apiKey: pickNonEmptyString(serviceCandidate?.apiKey, unifiedCandidate?.apiKey, fallback.apiKey),
            modelId: pickNonEmptyString(serviceCandidate?.modelId, unifiedCandidate?.modelId, fallback.modelId),
            forceJsonOutput: typeof serviceCandidate?.forceJsonOutput === 'boolean'
                ? serviceCandidate.forceJsonOutput
                : (typeof unifiedCandidate?.forceJsonOutput === 'boolean' ? unifiedCandidate.forceJsonOutput : fallback.forceJsonOutput)
        };
    };

    const storyService = normalizeEndpoint(rawServices.story, legacyUnified, defaults.services.story);
    const mapService = normalizeEndpoint(rawServices.map, legacyUnified, defaults.services.map);
    const stateService = normalizeEndpoint(rawServices.state, legacyUnified, defaults.services.state);
    const memoryFallback = rawServices.memory ?? legacyUnified ?? rawServices.state ?? rawServices.story ?? rawServices.map ?? null;
    const memoryService = normalizeEndpoint(rawServices.memory, memoryFallback, stateService);

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

export const DEFAULT_SETTINGS: AppSettings = {
    backgroundImage: '',
    fontSize: 'medium',
    readability: DEFAULT_READABILITY_SETTINGS,
    enableActionOptions: true,
    enableStreaming: true,
    enableCombatUI: true,
    chatLogLimit: 10,
    apiProtectionEnabled: false,
    promptModules: DEFAULT_PROMPT_MODULES,
    aiConfig: {
        nativeThinkingChain: true,
        requestTimeoutMs: 45000,
        serviceRequestTimeoutMs: {
            story: 45000,
            memory: 20000,
            map: 45000,
            state: 30000
        },
        services: {
            story: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
            memory: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
            map: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
            state: { provider: 'gemini', baseUrl: '', apiKey: '', modelId: '', forceJsonOutput: false },
        },
        multiStageThinking: false
    },
    memoryConfig: DEFAULT_MEMORY_CONFIG,
    contextConfig: DEFAULT_CONTEXT_CONFIG,
    writingConfig: {
        enableWordCountRequirement: false,
        requiredWordCount: 800,
        enableNarrativePerspective: true,
        narrativePerspective: 'third',
    }
};

const normalizeReadability = (
    rawReadability: any,
    defaults: AppSettings['readability'] = DEFAULT_READABILITY_SETTINGS
): AppSettings['readability'] => {
    const lineHeight = ['compact', 'normal', 'relaxed'].includes(rawReadability?.lineHeight)
        ? rawReadability.lineHeight
        : defaults.lineHeight;
    const contrastMode = ['default', 'high'].includes(rawReadability?.contrastMode)
        ? rawReadability.contrastMode
        : defaults.contrastMode;
    const infoDensity = ['compact', 'balanced', 'comfortable'].includes(rawReadability?.infoDensity)
        ? rawReadability.infoDensity
        : defaults.infoDensity;
    return { lineHeight, contrastMode, infoDensity };
};

const migratePromptModules = (parsed: any) => {
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
    const savedModules = Array.isArray(parsed?.promptModules) ? parsed.promptModules : [];
    const savedMap = new Map(savedModules.map((m: any) => [m.id, m]));
    const mergedDefaults = DEFAULT_PROMPT_MODULES.map(def => {
        const saved = savedMap.get(def.id);
        if (!saved || typeof saved !== 'object' || typeof (saved as any).name !== 'string') return def;
        const renamed = renameMap[(saved as any).name] ? def.name : (saved as any).name;
        return { ...def, ...(saved as Record<string, unknown>), name: renamed };
    });
    const defaultIds = new Set(DEFAULT_PROMPT_MODULES.map(m => m.id));
    const extraModules = savedModules.filter((m: any) => !defaultIds.has(m.id) && m.id !== 'world_if');
    return [...mergedDefaults, ...extraModules];
};

const migrateContextConfig = (rawContextConfig: any): ContextConfig => {
    if (!rawContextConfig || Array.isArray(rawContextConfig.order)) {
        return DEFAULT_CONTEXT_CONFIG;
    }
    const mergedModules = DEFAULT_CONTEXT_CONFIG.modules.map(defMod => {
        const savedMod = rawContextConfig.modules?.find((m: any) => m.id === defMod.id);
        return savedMod
            ? { ...defMod, ...savedMod, params: { ...(defMod.params || {}), ...(savedMod.params || {}) } }
            : defMod;
    });
    return { modules: mergedModules };
};

export const migrateSettings = (parsed: any): AppSettings => {
    const mergedAiConfig = normalizeTriadAiConfig(parsed?.aiConfig, DEFAULT_SETTINGS.aiConfig);
    return {
        ...DEFAULT_SETTINGS,
        ...(parsed || {}),
        readability: normalizeReadability(parsed?.readability, DEFAULT_SETTINGS.readability),
        promptModules: migratePromptModules(parsed),
        contextConfig: migrateContextConfig(parsed?.contextConfig),
        aiConfig: mergedAiConfig
    };
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
      loadSettingsFromStorage<any>()
          .then((parsed) => {
              if (!parsed) return;
              setSettings(migrateSettings(parsed));
          })
          .catch((error) => {
              console.error('Failed to load settings', error);
          });
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
      const normalizedSettings = migrateSettings(newSettings);
      setSettings(normalizedSettings);
      saveSettingsToStorage(normalizedSettings).catch((error) => {
          console.error('Failed to save settings', error);
      });
  };

  return { settings, saveSettings };
};

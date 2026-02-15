import React, { useState } from 'react';
import type { AIEndpointConfig, AppSettings, GlobalAISettings } from '../../../../../types';
import { AIConfigForm } from '../ui/AIConfigForm';

type AIServiceKey = 'story' | 'memory' | 'state' | 'map';

const SERVICE_TAB_LABELS: Record<AIServiceKey, string> = {
  story: '主叙事',
  memory: '记忆填表',
  state: '填表服务',
  map: '地图生成'
};

const normalizeTriadAiConfig = (aiConfig: GlobalAISettings): GlobalAISettings => {
  const storyService = aiConfig.services?.story;
  const memoryService = aiConfig.services?.memory;
  const mapService = aiConfig.services?.map;
  const stateService = aiConfig.services?.state;

  return {
    ...aiConfig,
    services: {
      story: storyService || stateService || memoryService || mapService,
      memory: memoryService || stateService || storyService || mapService,
      state: stateService || memoryService || storyService || mapService,
      map: mapService || stateService || memoryService || storyService
    }
  };
};

type AIServicesViewProps = {
  formData: AppSettings;
  setFormData: React.Dispatch<React.SetStateAction<AppSettings>>;
  onSave?: (nextAiConfig: GlobalAISettings) => void;
};

export const AIServicesView: React.FC<AIServicesViewProps> = ({ formData, setFormData, onSave }) => {
  const [activeService, setActiveService] = useState<AIServiceKey>('story');
  const aiConfig = normalizeTriadAiConfig(formData.aiConfig);

  const updateConfig = (next: GlobalAISettings) => {
    const normalized = normalizeTriadAiConfig(next);
    setFormData(prev => ({ ...prev, aiConfig: normalized }));
    onSave?.(normalized);
  };

  const updateService = (key: AIServiceKey, nextConfig: AIEndpointConfig) => {
    updateConfig({
      ...aiConfig,
      services: {
        ...aiConfig.services,
        [key]: nextConfig
      }
    });
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300 relative">
      <div className="flex flex-col h-full gap-3 overflow-hidden">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-[10px] text-zinc-400 leading-relaxed">
          当前使用 4 路 AI：主叙事（story）/ 记忆填表（memory）/ 填表服务（state）/ 地图生成（map）。
          职责分工：story 仅叙事与选项，memory 仅 LOG 表写入，state 负责其余业务表，map 仅地图。
        </div>

        <div className="flex-1 bg-zinc-900 rounded-3xl border border-white/5 overflow-y-auto custom-scrollbar shadow-inner p-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-4">
          <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 mb-4">
            {(Object.keys(SERVICE_TAB_LABELS) as AIServiceKey[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveService(tab)}
                className={`px-3 py-1 text-[10px] font-medium rounded-full whitespace-nowrap transition-colors border ${activeService === tab ? 'bg-red-500 text-white border-red-500' : 'bg-transparent text-zinc-500 border-zinc-700'}`}
              >
                {SERVICE_TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <AIConfigForm
            label={SERVICE_TAB_LABELS[activeService]}
            config={aiConfig.services?.[activeService] || aiConfig.services.state}
            onChange={(next) => updateService(activeService, next)}
          />
        </div>
      </div>
    </div>
  );
};

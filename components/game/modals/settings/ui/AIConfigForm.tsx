import React, { useState } from 'react';
import { RefreshCw, List, X } from 'lucide-react';
import type { AIEndpointConfig, AIProvider } from '../../../../../types';

interface AIConfigFormProps {
  config: AIEndpointConfig;
  onChange: (c: AIEndpointConfig) => void;
  label?: string;
}

type ProviderOption = {
  id: AIProvider;
  label: string;
  baseUrl: string;
};

const PROVIDERS: ProviderOption[] = [
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com' },
  { id: 'openai', label: 'OpenAI / Compatible', baseUrl: 'https://api.openai.com/v1' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'custom', label: '自定义', baseUrl: '' }
];

export const AIConfigForm: React.FC<AIConfigFormProps> = ({ config, onChange, label }) => {
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [showModelList, setShowModelList] = useState(false);

  const handleProviderChange = (option: ProviderOption) => {
    onChange({
      ...config,
      provider: option.id,
      baseUrl: option.baseUrl || config.baseUrl
    });
  };

  const handleFetchModels = async () => {
    if (!config.apiKey) {
      alert('请先输入 API 密钥');
      return;
    }
    if (!config.baseUrl && config.provider !== 'gemini') {
      alert('请先输入 Base URL');
      return;
    }
    setIsFetchingModels(true);
    setFetchedModels([]);
    try {
      let models: string[] = [];
      if (config.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.models) {
          models = data.models.map((m: any) => m.name.replace('models/', ''));
        } else if (data.error) {
          throw new Error(data.error.message);
        }
      } else {
        const url = `${config.baseUrl.replace(/\/$/, '')}/models`;
        try {
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${config.apiKey}` }
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`服务器返回 ${res.status}: ${errText}`);
          }

          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            models = data.data.map((m: any) => m.id);
          } else if (Array.isArray(data)) {
            models = data.map((m: any) => m.id);
          }
        } catch (e: any) {
          console.info('直连失败，尝试代理...', e.message);
          try {
            const proxyUrl = `/api/proxy?targetUrl=${encodeURIComponent(url)}`;
            const res = await fetch(proxyUrl, {
              headers: { Authorization: `Bearer ${config.apiKey}` }
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(`代理服务器返回 ${res.status}: ${errText}`);
            }

            const data = await res.json();
            if (data.data && Array.isArray(data.data)) {
              models = data.data.map((m: any) => m.id);
            } else if (Array.isArray(data)) {
              models = data.map((m: any) => m.id);
            } else {
              throw new Error('代理返回格式无效');
            }
          } catch (proxyError: any) {
            let errorMsg = proxyError.message;
            if (proxyError.message === 'Failed to fetch' || e.message === 'Failed to fetch') {
              errorMsg = `无法连接到服务器（网络/CORS 错误）。\n\n常见原因：\n1. Vercel 部署（HTTPS）无法访问 HTTP 接口（混合内容）。请使用 HTTPS 或本地代理。\n2. 目标服务器未允许跨域（CORS）。请检查 API 提供商设置。\n3. URL 填写错误。`;
            }
            throw new Error(errorMsg);
          }
        }
      }

      setFetchedModels(models.sort());
      setShowModelList(true);
    } catch (e: any) {
      alert(`获取模型列表失败: ${e.message}`);
    } finally {
      setIsFetchingModels(false);
    }
  };

  return (
    <div className="space-y-6 pt-2">
      {label && (
        <h4 className="font-display uppercase text-lg text-slate-200 border-l-4 border-red-600 pl-3 mb-4">
          {label}
        </h4>
      )}

      <div>
        <label className="block text-xs font-bold uppercase mb-2 text-slate-500">服务提供商</label>
        <div className="flex flex-col md:flex-row gap-2">
          {PROVIDERS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleProviderChange(option)}
              className={`flex-1 px-4 py-3 text-sm font-bold uppercase border transition-all ${
                config.provider === option.id
                  ? 'bg-red-900/30 border-red-600 text-red-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase mb-1 text-slate-500">基础链接</label>
        <div className="bg-slate-900/50 border-b-2 border-slate-700 focus-within:border-red-500 transition-colors px-3 py-2 flex items-center">
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
            className="w-full bg-transparent text-slate-200 font-mono text-sm outline-none placeholder-slate-700"
            placeholder="https://..."
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase mb-1 text-slate-500">API 密钥</label>
        <div className="bg-slate-900/50 border-b-2 border-slate-700 focus-within:border-red-500 transition-colors px-3 py-2 flex items-center">
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
            className="w-full bg-transparent text-slate-200 font-mono text-sm outline-none placeholder-slate-700"
            placeholder="sk-..."
          />
        </div>
      </div>

      <div className="relative">
        <label className="block text-xs font-bold uppercase mb-1 text-slate-500">模型 ID</label>
        <div className="bg-slate-900/50 border-b-2 border-slate-700 focus-within:border-red-500 transition-colors px-3 py-2 flex items-center gap-2">
          <input
            type="text"
            value={config.modelId}
            onChange={(e) => onChange({ ...config, modelId: e.target.value })}
            className="flex-1 bg-transparent text-slate-200 font-mono text-sm outline-none placeholder-slate-700 font-bold"
            placeholder="模型 ID"
          />
          <button
            onClick={handleFetchModels}
            disabled={isFetchingModels}
            className="text-slate-400 hover:text-white transition-colors disabled:opacity-30 p-1"
            title="获取模型列表"
          >
            {isFetchingModels ? <RefreshCw className="animate-spin" size={18} /> : <List size={18} />}
          </button>
        </div>

        {showModelList && fetchedModels.length > 0 && (
          <div className="fixed md:absolute inset-0 md:inset-auto md:top-full md:right-0 md:w-80 md:mt-2 z-[60] flex flex-col justify-end md:block">
            <div className="absolute inset-0 bg-black/80 md:hidden" onClick={() => setShowModelList(false)} />

            <div className="relative bg-slate-900 border border-slate-700 md:shadow-2xl max-h-[60vh] md:max-h-80 flex flex-col animate-in slide-in-from-bottom-10 md:slide-in-from-top-2 rounded-t-xl md:rounded-none">
              <div className="flex justify-between items-center bg-black/50 text-slate-300 p-3 border-b border-slate-700 shrink-0">
                <span className="text-xs font-bold uppercase">可用模型</span>
                <button onClick={() => setShowModelList(false)} className="p-1 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto custom-scrollbar p-1">
                {fetchedModels.map((model) => (
                  <button
                    key={model}
                    onClick={() => {
                      onChange({ ...config, modelId: model });
                      setShowModelList(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm font-mono border-b border-slate-800 last:border-0 hover:bg-slate-800 transition-colors truncate ${
                      config.modelId === model ? 'text-red-400 font-bold bg-slate-800/50' : 'text-slate-400'
                    }`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-bold uppercase">强制 JSON 输出</span>
        </div>
        <button
          onClick={() => onChange({ ...config, forceJsonOutput: !config.forceJsonOutput })}
          className={`w-10 h-5 rounded-full transition-all relative ${config.forceJsonOutput ? 'bg-red-600/80' : 'bg-slate-700'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${config.forceJsonOutput ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );
};

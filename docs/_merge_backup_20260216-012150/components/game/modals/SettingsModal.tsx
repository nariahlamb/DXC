import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Settings as SettingsIcon, Save, ArrowLeft, HardDrive, Eye, Cpu, 
  User, Brain, LayoutList, FileJson, List, Server, AlertTriangle, Check, 
  FileUp, FileDown, Shield, Activity, History, Folder, RefreshCw, Trash2, 
  ToggleLeft, ToggleRight, Type, Sword, MousePointer2, Edit2, Plus, Clock 
} from 'lucide-react';
import { AppSettings, GameState, SaveSlot, PromptModule, PromptUsage } from '../../../types';
import { DEFAULT_PROMPT_MODULES } from '../../../utils/ai';
import { DEFAULT_SETTINGS } from '../../../hooks/useAppSettings';
import { GAME_SCHEMA_DOCS } from './schemaDocs';
import { BaseModal } from '../../ui/base/BaseModal';
import { BaseButton } from '../../ui/base/BaseButton';
import { clearManagedKeys, getStorageBackend, listManagedStorageItems, loadAllSaveSlots, removeManagedKey, saveSettingsToStorage } from '../../../utils/storage/storageAdapter';

// Sub-components
import { SettingsAIServices } from './settings/SettingsAIServices';
import { SettingsContext } from './settings/SettingsContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  avatarUrl: string;
  onSaveSettings: (newSettings: AppSettings) => void;
  onSaveGame: (slotId?: number | string) => void;
  canSaveGame?: boolean;
  onLoadGame: (slotId: number | string) => void;
  onUpdateAvatar: (url: string) => void;
  onExitGame: () => void;
  gameState: GameState;
  onUpdateGameState: (newState: GameState) => void;
  initialView?: SettingsView;
}

type SettingsView = 'MAIN' | 'PROMPTS' | 'VISUALS' | 'DATA' | 'AI_SERVICES' | 'VARIABLES' | 'MEMORY' | 'SCHEMA' | 'AI_CONTEXT' | 'STORAGE' | 'FULL_LOGS' | 'LIBRARY';

/**
 * Auto-save hook with debounce
 */
const useAutoSave = (data: AppSettings, onSave: (data: AppSettings) => void, delay = 1000) => {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef(false);
    const latestDataRef = useRef(data);
    const onSaveRef = useRef(onSave);

    useEffect(() => {
        latestDataRef.current = data;
    }, [data]);

    useEffect(() => {
        onSaveRef.current = onSave;
    }, [onSave]);

    const flushPending = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (pendingRef.current) {
            onSaveRef.current(latestDataRef.current);
            pendingRef.current = false;
        }
    }, []);

    useEffect(() => {
        return () => {
            flushPending();
        };
    }, [flushPending]);

    const markDirty = useCallback(() => {
        pendingRef.current = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onSaveRef.current(latestDataRef.current);
            pendingRef.current = false;
            timeoutRef.current = null;
        }, delay);
    }, [delay]);

    return { markDirty, flushPending };
};

const normalizeImageSrc = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const normalized = value.trim();
    if (!normalized) return '';
    const lower = normalized.toLowerCase();
    if (lower.startsWith('javascript:')) return '';
    if (
        lower.startsWith('data:image/') ||
        lower.startsWith('blob:') ||
        lower.startsWith('http://') ||
        lower.startsWith('https://') ||
        normalized.startsWith('/')
    ) {
        return normalized;
    }
    return '';
};

const SettingsTab: React.FC<{
    icon: React.ReactNode;
    label: string;
    active: boolean;
    onClick: () => void;
    danger?: boolean;
}> = ({ icon, label, active, onClick, danger }) => (
    <button
        onClick={onClick}
        className={`
            w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg group
            ${active 
                ? 'bg-surface-floating text-content-primary shadow-lg ring-1 ring-white/10' 
                : 'text-content-secondary hover:bg-surface-glass hover:text-content-primary'
            }
            ${danger && !active ? 'text-red-400/80 hover:text-red-400 hover:bg-red-900/20' : ''}
            ${danger && active ? 'bg-red-900/40 text-red-200 ring-red-500/30' : ''}
        `}
    >
        <span className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
            {icon}
        </span>
        <span className="tracking-wide">{label}</span>
        {active && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-blue shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
        )}
    </button>
);

const SettingsFullLogsView = ({ gameState }: { gameState: GameState }) => {
    const [logSearch, setLogSearch] = useState('');
    const deferredLogSearch = React.useDeferredValue(logSearch);
    
    const keyword = deferredLogSearch.trim().toLowerCase();
    const visibleLogs = React.useMemo(() => {
        if (!keyword) return gameState.日志;
        return gameState.日志.filter(log => `${log.sender} ${log.text}`.toLowerCase().includes(keyword));
    }, [keyword, gameState.日志]);

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-300">
            <SectionHeader title="完整对话流" icon={<List />} description="查看和搜索历史对话记录" />

            <div className="mb-4">
                <div className="relative">
                    <input
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        placeholder="搜索：角色名 / 关键词..."
                        className="w-full bg-black/20 border border-white/10 px-4 py-3 pl-10 text-sm font-mono outline-none focus:border-accent-blue/50 rounded-lg text-content-primary placeholder:text-content-muted transition-colors shadow-sm"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted">
                        <Eye size={16} />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-base/30 border border-white/5 rounded-xl p-4">
                <div className="space-y-3">
                    {visibleLogs.length > 0 ? visibleLogs.map((log, idx) => (
                        <div key={`${log.id || 'log'}-${idx}`} className="bg-surface-overlay border border-white/5 p-4 rounded-lg hover:border-white/10 transition-colors">
                            <div className="flex justify-between items-center text-[10px] text-content-muted uppercase font-mono mb-2 tracking-wider">
                                <span className="font-bold text-accent-blue">{log.sender || 'Unknown'}</span>
                                <span>{log.gameTime || (log.turnIndex !== undefined ? `Turn ${log.turnIndex}` : 'No Time')}</span>
                            </div>
                            <div className="text-sm text-content-secondary whitespace-pre-wrap leading-relaxed font-serif">
                                {log.text}
                            </div>
                        </div>
                    )) : (
                        <div className="flex flex-col items-center justify-center py-12 text-content-muted opacity-50">
                            <List size={32} className="mb-2 stroke-1" />
                            <span className="text-xs uppercase tracking-widest">暂无记录</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  avatarUrl,
  onSaveSettings,
  onSaveGame,
  canSaveGame = true,
  onLoadGame,
  onUpdateAvatar,
  onExitGame,
  gameState,
  onUpdateGameState,
  initialView
}) => {
  const [currentView, setCurrentView] = useState<SettingsView>(initialView || 'VISUALS'); // Default to Visuals for better UX
  const [showSidebar, setShowSidebar] = useState(true);
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [avatarPreview, setAvatarPreview] = useState(() => normalizeImageSrc(avatarUrl));
  const wasOpenRef = useRef(false);

  // Prompt Manager States
  const [activePromptModuleId, setActivePromptModuleId] = useState<string | null>(null);

  // Variable Editor State
  const [variableCategory, setVariableCategory] = useState<string>('角色');
  const [jsonEditText, setJsonEditText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Save & Storage
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [autoSlots, setAutoSlots] = useState<SaveSlot[]>([]);
  const [storageItems, setStorageItems] = useState<{key: string, size: number, label: string, type: string, details?: string[]}[]>([]);
  const [storageSummary, setStorageSummary] = useState<{ total: number; cache: number; saves: number; settings: number; api: number }>({
      total: 0, cache: 0, saves: 0, settings: 0, api: 0
  });
  const [storageBackend, setStorageBackend] = useState<'idb' | 'local'>('local');
  const [contextStats, setContextStats] = useState<{ tokens: number; chars: number; bytes: number }>({
      tokens: 0, chars: 0, bytes: 0
  });
  const [libraryMode, setLibraryMode] = useState<'UI' | 'JSON'>('UI');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptFileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save
  const { markDirty, flushPending } = useAutoSave(formData, onSaveSettings);
  const handleModalClose = useCallback(() => {
      flushPending();
      onClose();
  }, [flushPending, onClose]);

  // Init Data
  useEffect(() => {
      if (isOpen && !wasOpenRef.current) {
          setFormData(settings);
          setAvatarPreview(normalizeImageSrc(avatarUrl));
          // Map 'MAIN' to 'VISUALS' since there's no 'MAIN' content view
          const resolvedView = (initialView && initialView !== 'MAIN') ? initialView : 'VISUALS';
          setCurrentView(resolvedView);
          loadSaveSlots();
          // If a specific view was requested (not MAIN/default), skip sidebar on mobile
          if (initialView && initialView !== 'MAIN') {
              setShowSidebar(false);
          } else {
              setShowSidebar(true);
          }
      }

      wasOpenRef.current = isOpen;
  }, [isOpen, settings, avatarUrl, initialView]);

  const loadSaveSlots = async () => {
      const slots = await loadAllSaveSlots();
      setSaveSlots(slots.manual);
      setAutoSlots(slots.auto);
  };

  const scanStorage = async () => {
      const entries = await listManagedStorageItems();
      const currentBackend = await getStorageBackend();
      setStorageBackend(currentBackend);

      const items: {key: string, size: number, label: string, type: string, details?: string[]}[] = [];
      const summary = { total: 0, cache: 0, saves: 0, settings: 0, api: 0 };

      entries.forEach(({ key, value, source }) => {
          const size = new Blob([value || '']).size;
          let label = key;
          let type = 'CACHE';
          const details: string[] = [`后端: ${source.toUpperCase()}`];

          if (key === 'danmachi_settings') {
              label = '系统设置 (Settings)';
              type = 'SETTINGS';
              try {
                  const parsed = JSON.parse(value);
                  const prompts = Array.isArray(parsed.promptModules) ? parsed.promptModules : [];
                  const active = prompts.filter((m: any) => m && m.isActive).length;
                  const contextMods = Array.isArray(parsed.contextConfig?.modules) ? parsed.contextConfig.modules.length : 0;
                  const apiSize = new Blob([JSON.stringify(parsed.aiConfig || {})]).size;
                  details.push('提示词模块: ' + prompts.length + ' (启用 ' + active + ')');
                  details.push('上下文模块: ' + contextMods);
                  details.push('背景: ' + (parsed.backgroundImage ? '已保存' : '未保存'));
                  details.push('API设置: ' + formatBytes(apiSize));
                  summary.api += apiSize;
              } catch (error) {
                  console.warn('scan settings parse failed', error);
              }
          } else if (key.includes('save_auto')) {
              label = `自动存档 (Auto Save ${key.split('_').pop()})`;
              type = 'SAVE_AUTO';
          } else if (key.includes('save_manual')) {
              label = `手动存档 (Manual Save ${key.split('_').pop()})`;
              type = 'SAVE_MANUAL';
          }

          if (type === 'SAVE_AUTO' || type === 'SAVE_MANUAL') {
              try {
                  const parsed = JSON.parse(value);
                  const state = parsed?.data || parsed;
                  const avatar = state?.角色?.头像;
                  const name = state?.角色?.姓名;
                  const level = state?.角色?.等级;
                  if (name) details.push('角色: ' + name);
                  if (level !== undefined) details.push('等级: ' + level);
                  details.push('头像: ' + (avatar ? '已保存' : '无'));
              } catch (error) {
                  console.warn('scan save parse failed', error);
              }
          }

          items.push({ key, size, label, type, details: details.length > 0 ? details : undefined });
          summary.total += size;
          if (type === 'CACHE') summary.cache += size;
          if (type === 'SETTINGS') summary.settings += size;
          if (type === 'SAVE_AUTO' || type === 'SAVE_MANUAL') summary.saves += size;
      });

      items.sort((a, b) => a.type.localeCompare(b.type) || a.key.localeCompare(b.key));
      setStorageItems(items);
      setStorageSummary(summary);
  };

  useEffect(() => {
      if (currentView === 'STORAGE') {
          scanStorage().catch((error) => console.warn('scanStorage failed', error));
          refreshContextStats();
      }
  }, [currentView]);

  useEffect(() => {
      if (currentView === 'VARIABLES' && gameState) {
          const data = (gameState as any)[variableCategory];
          setJsonEditText(JSON.stringify(data, null, 4));
          setJsonError(null);
      }
  }, [variableCategory, currentView, gameState]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'bg') => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const result = reader.result as string;
              if (type === 'avatar') {
                  const safeAvatar = normalizeImageSrc(result);
                  setAvatarPreview(safeAvatar);
                  onUpdateAvatar(safeAvatar);
              } else {
                  setFormData(prev => ({...prev, backgroundImage: result}));
                  markDirty();
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleExportSave = () => {
      const exportData = {
          id: 'export',
          type: 'EXPORT',
          timestamp: Date.now(),
          summary: `Export: ${gameState.角色?.姓名 || 'Player'} - Lv.${gameState.角色?.等级 || '1'}`,
          data: gameState,
          version: '3.0'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `danmachi_save_${gameState.角色?.姓名 || 'player'}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportSave = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const content = ev.target?.result as string;
              let parsed;
              try {
                  parsed = JSON.parse(content);
              } catch (jsonErr) {
                  throw new Error("文件格式错误 (Invalid JSON)");
              }

              let stateToLoad = parsed.data ? parsed.data : parsed;

              if (stateToLoad.character && !stateToLoad.角色) stateToLoad.角色 = stateToLoad.character;
              if (stateToLoad.inventory && !stateToLoad.背包) stateToLoad.背包 = stateToLoad.inventory;
              if (stateToLoad.worldMap && !stateToLoad.地图) stateToLoad.地图 = stateToLoad.worldMap;
              if (stateToLoad.logs && !stateToLoad.日志) stateToLoad.日志 = stateToLoad.logs;

              const missingFields = [];
              if (!stateToLoad.角色) missingFields.push("角色 (Character)");
              if (!stateToLoad.地图) missingFields.push("地图 (Map)");

              if (missingFields.length > 0) {
                  throw new Error(`存档数据不完整，缺失核心字段:\n${missingFields.join(', ')}`);
              }

              const summary = parsed.summary || stateToLoad.角色?.姓名 || 'Unknown Save';
              const timeStr = parsed.timestamp ? new Date(parsed.timestamp).toLocaleString() : 'Unknown Time';

              if (window.confirm(`确认导入存档？\n\n信息: ${summary}\n时间: ${timeStr}\n\n警告：这将覆盖当前的未保存进度！`)) {
                  onUpdateGameState(stateToLoad);
                  alert("存档导入成功！");
                  handleModalClose();
              }
          } catch(err: any) {
              console.error("Import Error:", err);
              alert("导入失败: " + err.message);
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const normalizePromptModules = (modules: PromptModule[]) => {
      return modules.map((m, idx) => ({
          id: m.id || `import_${idx}`,
          name: m.name || `未命名模块_${idx + 1}`,
          group: m.group || '未分组',
          usage: (['CORE', 'START'] as PromptUsage[]).includes(m.usage as PromptUsage) ? m.usage : 'CORE',
          isActive: typeof m.isActive === 'boolean' ? m.isActive : true,
          content: typeof m.content === 'string' ? m.content : '',
          order: typeof m.order === 'number' ? m.order : 100
      }));
  };

  const handleExportPrompts = () => {
      const exportData = {
          version: '3.1',
          exportedAt: Date.now(),
          promptModules: formData.promptModules
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `danmachi_prompts_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportPrompts = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const content = ev.target?.result as string;
              const parsed = JSON.parse(content);
              const rawModules = Array.isArray(parsed) ? parsed : parsed.promptModules;
              if (!Array.isArray(rawModules)) throw new Error("提示词文件格式错误：未找到 promptModules");
              const normalized = normalizePromptModules(rawModules);
              if (!window.confirm(`确认导入提示词？\n将覆盖当前提示词模块 (${normalized.length} 条)。`)) return;
              setFormData({ ...formData, promptModules: normalized });
              setActivePromptModuleId(null);
              markDirty();
              alert("提示词导入成功！");
          } catch (err: any) {
              alert("提示词导入失败: " + err.message);
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const formatBytes = (bytes: number, decimals = 2) => {
      if (!+bytes) return '0 B';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const estimateTokens = (text: string) => {
      if (!text) return 0;
      const compact = text.replace(/\s+/g, ' ').trim();
      if (!compact) return 0;
      const cjkCount = (compact.match(/[\u4E00-\u9FFF]/g) || []).length;
      const nonCjk = compact.length - cjkCount;
      return Math.ceil(cjkCount + nonCjk / 4);
  };

  const buildSettingsWithApi = (apiConfig: any | null) => {
      const base = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings;
      if (!apiConfig) return { ...base, apiProtectionEnabled: formData.apiProtectionEnabled };
      return { ...base, aiConfig: apiConfig, apiProtectionEnabled: formData.apiProtectionEnabled };
  };

  const cloneDefaultPrompts = () => DEFAULT_PROMPT_MODULES.map(m => ({ ...m }));

  const refreshContextStats = () => {
      try {
          const { assembleFullPrompt } = require('../../../utils/ai');
          const prompt = assembleFullPrompt("（用户输入预览）", gameState, formData);
          setContextStats({
              chars: prompt.length,
              bytes: new Blob([prompt]).size,
              tokens: estimateTokens(prompt)
          });
      } catch (e) {
          setContextStats({ chars: 0, bytes: 0, tokens: 0 });
      }
  };

  const deleteStorageItem = async (key: string) => {
      if (!confirm(`确定要删除 ${key} 吗？此操作无法撤销。`)) return;
      await removeManagedKey(key);
      await scanStorage();
  };

  const clearCache = async () => {
      if (!confirm('确定要清除缓存吗？这将删除除存档与设置以外的临时数据。')) return;
      await clearManagedKeys((key) => {
          const isSave = key.includes('save_auto') || key.includes('save_manual');
          const isSettings = key === 'danmachi_settings';
          return (key.startsWith('danmachi_') || key.startsWith('phantom_')) && !isSave && !isSettings;
      });
      await scanStorage();
  };

  const clearSaves = async () => {
      if (!confirm('确定要清除所有存档吗？此操作不可撤销。')) return;
      await clearManagedKeys((key) => key.includes('save_auto') || key.includes('save_manual'));
      await loadSaveSlots();
      await scanStorage();
  };

  const restoreDefaultPrompts = () => {
      if (!confirm("确认恢复默认提示词？这将覆盖当前提示词模块配置。")) return;
      const next = { ...formData, promptModules: cloneDefaultPrompts() };
      setFormData(next);
      onSaveSettings(next);
      alert("提示词已恢复为默认配置。");
  };

  const restoreDefaultSettings = () => {
      if (!confirm("确认恢复默认设置？这将重置界面与上下文配置。")) return;
      const preservedApi = formData.apiProtectionEnabled ? formData.aiConfig : null;
      const next = preservedApi ? buildSettingsWithApi(preservedApi) : buildSettingsWithApi(null);
      setFormData(next);
      onSaveSettings(next);
      alert("设置已恢复为默认配置。");
  };

  const factoryReset = async () => {
      if (!confirm('⚠️ 危险操作：恢复出厂设置\n\n这将清除所有存档、设置和缓存数据，游戏将重置为初始状态。\n\n确定要继续吗？')) {
          return;
      }

      const keepApi = !!formData.apiProtectionEnabled;
      const preservedApi = keepApi ? formData.aiConfig : null;
      await clearManagedKeys((key) => key.startsWith('danmachi_') || key.startsWith('phantom_'));
      if (keepApi && preservedApi) {
          const next = buildSettingsWithApi(preservedApi);
          await saveSettingsToStorage(next);
      }
      alert('数据已清除。页面将刷新。');
      window.location.reload();
  };

  // --- View Renderers (Polished) ---

  const renderStorageView = () => (
      <div className="space-y-6 animate-in fade-in duration-300">
          <SectionHeader title="存储维护" icon={<Server />} description="管理本地缓存与数据占用" />
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard label="总占用" value={formatBytes(storageSummary.total)} />
              <StatCard label="存档数据" value={formatBytes(storageSummary.saves)} />
              <StatCard label="系统设置" value={formatBytes(storageSummary.settings)} />
              <StatCard label="临时缓存" value={formatBytes(storageSummary.cache)} />
              <StatCard label="API 配置" value={formatBytes(storageSummary.api)} />
              <StatCard label="存储后端" value={storageBackend.toUpperCase()} />
              <StatCard label="上下文估算" value={`${contextStats.tokens} tokens`} sub={`${formatBytes(contextStats.bytes)}`} />
          </div>

          <div className="bg-surface-overlay border border-white/5 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-content-primary font-bold text-sm">
                      <Folder size={16} /> 快速维护
                  </div>
              </div>
              <div className="flex flex-wrap gap-3">
                  <BaseButton size="sm" variant="ghost" onClick={clearCache}>清除缓存</BaseButton>
                  <BaseButton size="sm" variant="ghost" onClick={clearSaves}>清除存档</BaseButton>
                  <BaseButton size="sm" variant="ghost" onClick={restoreDefaultPrompts}>重置提示词</BaseButton>
                  <BaseButton size="sm" variant="ghost" onClick={restoreDefaultSettings}>重置设置</BaseButton>
              </div>
          </div>

          <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-6">
              <h4 className="font-bold text-red-400 uppercase flex items-center gap-2 mb-2 text-sm"><AlertTriangle size={16} /> 危险区域</h4>
              <p className="text-xs text-red-300/60 mb-4">恢复出厂设置将清除所有数据。操作不可逆。</p>
              <BaseButton variant="danger" onClick={factoryReset} leftIcon={<RefreshCw size={14} />}>
                  恢复出厂设置
              </BaseButton>
          </div>
      </div>
  );

  const renderVisualsView = () => (
      <div className="space-y-6 animate-in fade-in duration-300 pb-10">
          {(() => {
              const readability = formData.readability || DEFAULT_SETTINGS.readability;
              return (
                  <>
          <SectionHeader title="视觉与交互" icon={<Eye />} description="自定义游戏界面的显示效果" />

          {/* Core Visual Settings */}
          <div className="bg-surface-overlay border border-white/5 rounded-xl p-6 space-y-6">
              <SettingToggle
                  label="消息流式传输 (Streaming)"
                  desc="开启后，AI 回复将以打字机效果逐字显示"
                  active={formData.enableStreaming}
                  onToggle={() => {
                      setFormData(prev => ({...prev, enableStreaming: !prev.enableStreaming}));
                      markDirty();
                  }}
              />
              <SettingToggle
                  label="图形化战斗界面"
                  desc="遭遇战斗时显示可视化状态面板；此处决定默认状态，顶部按钮可临时切换"
                  active={formData.enableCombatUI}
                  onToggle={() => {
                      setFormData(prev => ({...prev, enableCombatUI: !prev.enableCombatUI}));
                      markDirty();
                  }}
              />
              <SettingToggle
                  label="智能行动推荐"
                  desc="在回复末尾提供 3-5 个具体的行动建议"
                  active={formData.enableActionOptions}
                  onToggle={() => {
                      setFormData(prev => ({...prev, enableActionOptions: !prev.enableActionOptions}));
                      markDirty();
                  }}
              />
              <SettingToggle
                  label="启用字数约束"
                  desc="强制 AI 输出指定长度以上的正文"
                  active={formData.writingConfig?.enableWordCountRequirement ?? false}
                  onToggle={() => {
                      const current = formData.writingConfig || DEFAULT_SETTINGS.writingConfig;
                      setFormData(prev => ({
                          ...prev,
                          writingConfig: {
                              ...current,
                              enableWordCountRequirement: !current.enableWordCountRequirement
                          }
                      }));
                      markDirty();
                  }}
              />
              {(formData.writingConfig?.enableWordCountRequirement ?? false) && (
                  <SettingInput
                      label="最小字数要求"
                      desc="确保生成的正文内容足够详实（不含思考内容）"
                      value={formData.writingConfig?.requiredWordCount || 800}
                      onChange={(val) => {
                           const current = formData.writingConfig || DEFAULT_SETTINGS.writingConfig;
                           setFormData(prev => ({
                              ...prev,
                              writingConfig: {
                                  ...current,
                                  requiredWordCount: val
                              }
                           }));
                           markDirty();
                      }}
                      min={100}
                      max={5000}
                      suffix="字"
                  />
              )}
          </div>

          <div className="bg-surface-overlay border border-white/5 rounded-xl p-6">
              <h4 className="font-bold text-content-secondary uppercase text-xs mb-4 flex items-center gap-2">
                  <Type size={14} /> 字体设置
              </h4>
              <div className="flex gap-3">
                  {['small', 'medium', 'large'].map((size) => (
                      <button
                          key={size}
                          onClick={() => {
                              setFormData(prev => ({...prev, fontSize: size as any}));
                              markDirty();
                          }}
                          className={`flex-1 py-3 border text-xs font-bold uppercase tracking-wider rounded-lg transition-all
                              ${formData.fontSize === size
                                  ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/50 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                                  : 'bg-transparent text-content-muted border-white/5 hover:border-white/20'
                              }
                          `}
                      >
                          {size}
                      </button>
                  ))}
              </div>
          </div>

          <div className="bg-surface-overlay border border-white/5 rounded-xl p-6 space-y-5">
              <h4 className="font-bold text-content-secondary uppercase text-xs flex items-center gap-2">
                  <Eye size={14} /> 阅读体验
              </h4>

              <div>
                  <div className="text-xs text-content-secondary mb-2">行高</div>
                  <div className="flex gap-2">
                      {[
                          { key: 'compact', label: '紧凑' },
                          { key: 'normal', label: '标准' },
                          { key: 'relaxed', label: '宽松' }
                      ].map((item) => (
                          <button
                              key={item.key}
                              type="button"
                              onClick={() => {
                                  setFormData(prev => ({
                                      ...prev,
                                      readability: { ...(prev.readability || DEFAULT_SETTINGS.readability), lineHeight: item.key as any }
                                  }));
                                  markDirty();
                              }}
                              className={`flex-1 py-2 border rounded text-xs transition-colors ${
                                  readability.lineHeight === item.key
                                      ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/50'
                                      : 'bg-transparent text-content-muted border-white/10 hover:border-white/30'
                              }`}
                          >
                              {item.label}
                          </button>
                      ))}
                  </div>
              </div>

              <div>
                  <div className="text-xs text-content-secondary mb-2">对比度模式</div>
                  <div className="flex gap-2">
                      {[
                          { key: 'default', label: '默认' },
                          { key: 'high', label: '高对比' }
                      ].map((item) => (
                          <button
                              key={item.key}
                              type="button"
                              onClick={() => {
                                  setFormData(prev => ({
                                      ...prev,
                                      readability: { ...(prev.readability || DEFAULT_SETTINGS.readability), contrastMode: item.key as any }
                                  }));
                                  markDirty();
                              }}
                              className={`flex-1 py-2 border rounded text-xs transition-colors ${
                                  readability.contrastMode === item.key
                                      ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/50'
                                      : 'bg-transparent text-content-muted border-white/10 hover:border-white/30'
                              }`}
                          >
                              {item.label}
                          </button>
                      ))}
                  </div>
              </div>

              <div>
                  <div className="text-xs text-content-secondary mb-2">信息密度</div>
                  <div className="flex gap-2">
                      {[
                          { key: 'compact', label: '高密度' },
                          { key: 'balanced', label: '均衡' },
                          { key: 'comfortable', label: '舒适' }
                      ].map((item) => (
                          <button
                              key={item.key}
                              type="button"
                              onClick={() => {
                                  setFormData(prev => ({
                                      ...prev,
                                      readability: { ...(prev.readability || DEFAULT_SETTINGS.readability), infoDensity: item.key as any }
                                  }));
                                  markDirty();
                              }}
                              className={`flex-1 py-2 border rounded text-xs transition-colors ${
                                  readability.infoDensity === item.key
                                      ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/50'
                                      : 'bg-transparent text-content-muted border-white/10 hover:border-white/30'
                              }`}
                          >
                              {item.label}
                          </button>
                      ))}
                  </div>
              </div>
          </div>

          {/* Avatar & BG */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-overlay border border-white/5 rounded-xl p-6 flex flex-col items-center">
                  <h4 className="font-bold text-content-secondary uppercase text-xs mb-4">玩家头像</h4>
                  <div className="w-32 h-32 rounded-full border-2 border-white/10 mb-4 overflow-hidden relative group shadow-lg">
                      {avatarPreview ? (
                          <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center bg-surface-base text-content-muted text-xs uppercase">
                              未设置头像
                          </div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                          <span className="text-white font-medium text-xs uppercase"><Edit2 size={16}/></span>
                      </div>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'avatar')} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
              </div>

              <div className="bg-surface-overlay border border-white/5 rounded-xl p-6 flex flex-col items-center">
                  <h4 className="font-bold text-content-secondary uppercase text-xs mb-4">自定义背景</h4>
                  <div className="w-full h-32 rounded-lg border-2 border-white/10 mb-4 overflow-hidden relative group shadow-lg bg-surface-base">
                      {formData.backgroundImage ? (
                          <img src={formData.backgroundImage} alt="BG" className="w-full h-full object-cover" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-content-muted text-xs uppercase">默认背景</div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                          <span className="text-white font-medium text-xs uppercase">更换图片</span>
                      </div>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'bg')} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  {formData.backgroundImage && (
                      <BaseButton size="sm" variant="ghost" onClick={() => { setFormData(prev => ({...prev, backgroundImage: ''})); markDirty(); }}>
                          恢复默认
                      </BaseButton>
                  )}
              </div>
          </div>
                  </>
              );
          })()}
      </div>
  );

  const renderDataView = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
        <SectionHeader title="存档管理" icon={<HardDrive />} description="管理你的游戏进度" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
                 <div className="flex items-center gap-2 text-xs font-bold text-content-secondary uppercase tracking-wider mb-2">
                    <Clock size={12} /> 自动存档
                 </div>
                 {autoSlots.length > 0 ? autoSlots.map(slot => (
                     <div key={slot.id} className="group bg-surface-overlay border border-white/5 p-3 rounded-lg hover:border-accent-blue/30 transition-all cursor-pointer relative overflow-hidden" onClick={() => { onLoadGame(slot.id); handleModalClose(); }}>
                         <div className="flex justify-between items-start relative z-10">
                            <div>
                                <div className="font-bold text-content-primary text-sm">{slot.summary}</div>
                                <div className="text-xs text-content-muted mt-1">{new Date(slot.timestamp).toLocaleString()}</div>
                            </div>
                            <span className="text-xs font-mono text-accent-blue opacity-0 group-hover:opacity-100 transition-opacity">LOAD</span>
                         </div>
                         <div className="absolute inset-0 bg-gradient-to-r from-accent-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                     </div>
                 )) : <div className="text-content-muted text-xs italic p-4 border border-white/5 rounded-lg text-center">暂无自动存档</div>}
            </div>

            <div className="space-y-3">
                 <div className="flex items-center gap-2 text-xs font-bold text-content-secondary uppercase tracking-wider mb-2">
                    <Save size={12} /> 手动存档
                 </div>
                 {!canSaveGame && (
                     <div className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                         当前场景不支持手动存档
                     </div>
                 )}
                 {[1, 2, 3].map(id => {
                     const slot = saveSlots.find(s => s.id === id);
                     return (
                         <div key={id} className="bg-surface-overlay border border-white/5 p-3 rounded-lg flex items-center gap-4">
                             <div className="w-8 h-8 flex items-center justify-center bg-black/40 rounded font-display font-bold text-content-muted border border-white/5">
                                 {id}
                             </div>
                             <div className="flex-1 min-w-0">
                                 {slot ? (
                                     <>
                                        <div className="font-bold text-content-primary text-sm truncate">{slot.summary}</div>
                                        <div className="text-xs text-content-muted">{new Date(slot.timestamp).toLocaleString()}</div>
                                     </>
                                 ) : (
                                     <div className="text-content-muted text-xs italic">空槽位</div>
                                 )}
                             </div>
                             <div className="flex gap-2">
                                 <button
                                     disabled={!canSaveGame}
                                     onClick={() => {
                                         if (!canSaveGame) return;
                                         onSaveGame(id);
                                         loadSaveSlots();
                                     }}
                                     className={`px-3 py-1.5 text-xs font-bold uppercase rounded border transition-colors ${
                                         canSaveGame
                                             ? 'bg-white/5 hover:bg-accent-green/20 text-content-secondary hover:text-accent-green border-white/5'
                                             : 'bg-white/5 text-content-muted border-white/5 opacity-50 cursor-not-allowed'
                                     }`}
                                 >
                                     保存
                                 </button>
                                 {slot && (
                                     <button onClick={() => { onLoadGame(id); handleModalClose(); }} className="px-3 py-1.5 text-xs font-bold uppercase bg-white/5 hover:bg-accent-blue/20 text-content-secondary hover:text-accent-blue rounded border border-white/5 transition-colors">
                                         读取
                                     </button>
                                 )}
                             </div>
                         </div>
                     );
                 })}
            </div>
        </div>

        <div className="pt-6 border-t border-white/5 mt-4">
            <h4 className="font-bold text-xs uppercase text-content-muted mb-4 flex items-center gap-2">
                <FileJson size={14} /> 备份与迁移
            </h4>
            <div className="flex gap-4">
                <button onClick={handleExportSave} className="flex-1 p-6 border border-dashed border-white/10 hover:border-white/30 hover:bg-surface-overlay rounded-xl transition-all group text-center">
                    <FileDown className="mx-auto mb-3 text-content-muted group-hover:text-content-primary" size={24} />
                    <div className="font-bold text-sm text-content-primary mb-1">导出存档</div>
                    <div className="text-xs text-content-muted">下载 .json 文件</div>
                </button>
                <div onClick={() => fileInputRef.current?.click()} className="flex-1 p-6 border border-dashed border-white/10 hover:border-accent-blue/30 hover:bg-accent-blue/5 rounded-xl transition-all group text-center cursor-pointer">
                    <FileUp className="mx-auto mb-3 text-content-muted group-hover:text-accent-blue" size={24} />
                    <div className="font-bold text-sm text-content-primary mb-1">导入存档</div>
                    <div className="text-xs text-content-muted">读取 .json 文件</div>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportSave}/>
                </div>
            </div>
        </div>
    </div>
  );

  const renderPromptsView = () => {
      const groups: Record<string, PromptModule[]> = {};
      formData.promptModules.forEach(m => {
          if (!groups[m.group]) groups[m.group] = [];
          groups[m.group].push(m);
      });

      const handleAddModule = () => {
          const newId = `custom_${Date.now()}`;
          const newModule: PromptModule = {
              id: newId, name: '新模块', group: '自定义', usage: 'CORE', isActive: true, content: '请输入提示词内容...', order: 100
          };
          setFormData({ ...formData, promptModules: [...formData.promptModules, newModule] });
          setActivePromptModuleId(newId);
          markDirty();
      };

      const handleDeleteModule = (id: string) => {
          if (confirm("确定要删除此模块吗？")) {
              const newModules = formData.promptModules.filter(m => m.id !== id);
              setFormData({ ...formData, promptModules: newModules });
              if (activePromptModuleId === id) setActivePromptModuleId(null);
              markDirty();
          }
      };

      return (
          <div className="flex flex-col md:flex-row h-full animate-in fade-in duration-300 overflow-hidden bg-surface-base/30 border border-white/5 rounded-xl">
              <div className="w-full md:w-1/3 border-r border-white/5 bg-surface-overlay overflow-y-auto custom-scrollbar flex flex-col">
                  <div className="p-4 border-b border-white/5 flex justify-between items-center sticky top-0 bg-surface-overlay z-10">
                      <h4 className="font-bold uppercase text-content-primary text-xs flex items-center gap-2">
                          <User size={14} /> 提示词模块
                      </h4>
                      <div className="flex items-center gap-1">
                          <button onClick={handleExportPrompts} className="p-1.5 hover:bg-white/10 rounded text-content-muted hover:text-content-primary transition-colors" title="导出"><FileDown size={14}/></button>
                          <button onClick={() => promptFileInputRef.current?.click()} className="p-1.5 hover:bg-white/10 rounded text-content-muted hover:text-content-primary transition-colors" title="导入"><FileUp size={14}/></button>
                          <button onClick={handleAddModule} className="p-1.5 hover:bg-accent-blue/20 rounded text-accent-blue hover:text-white transition-colors" title="新增"><Plus size={16}/></button>
                      </div>
                  </div>
                  <input type="file" ref={promptFileInputRef} className="hidden" accept=".json" onChange={handleImportPrompts} />
                  <div className="flex-1 p-2 space-y-4">
                      {Object.entries(groups).map(([groupName, mods]) => (
                          <div key={groupName} className="space-y-1">
                              <div className="px-3 py-1 text-[10px] font-bold text-content-muted uppercase tracking-wider bg-white/5 rounded-md mx-1">{groupName}</div>
                              {mods.sort((a,b) => a.order - b.order).map(mod => (
                                  <div
                                      key={mod.id}
                                      onClick={() => setActivePromptModuleId(mod.id)}
                                      className={`p-3 mx-1 rounded-lg cursor-pointer transition-all text-xs flex justify-between items-center group border
                                          ${activePromptModuleId === mod.id
                                              ? 'bg-accent-blue/10 border-accent-blue/40 shadow-sm'
                                              : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'
                                          }
                                      `}
                                  >
                                      <div>
                                          <div className={`font-bold mb-0.5 ${activePromptModuleId === mod.id ? 'text-accent-blue' : 'text-content-primary'}`}>{mod.name}</div>
                                          <div className="text-[10px] text-content-muted font-mono bg-black/20 px-1.5 py-0.5 rounded inline-block">{mod.usage}</div>
                                      </div>
                                      <button
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              const newModules = formData.promptModules.map(m =>
                                                  m.id === mod.id ? { ...m, isActive: !m.isActive } : m
                                              );
                                              setFormData({ ...formData, promptModules: newModules });
                                              markDirty();
                                          }}
                                          className={`transition-colors ${mod.isActive ? 'text-accent-green' : 'text-content-muted hover:text-content-secondary'}`}
                                      >
                                          {mod.isActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                      </button>
                                  </div>
                              ))}
                          </div>
                      ))}
                  </div>
              </div>

              <div className="flex-1 bg-surface-base/50 flex flex-col h-full overflow-hidden relative">
                  {activePromptModuleId ? (() => {
                      const activeMod = formData.promptModules.find(m => m.id === activePromptModuleId);
                      if (!activeMod) return null;

                      const updateField = (key: keyof PromptModule, val: any) => {
                          const newModules = formData.promptModules.map(m =>
                              m.id === activeMod.id ? { ...m, [key]: val } : m
                          );
                          setFormData({ ...formData, promptModules: newModules });
                          markDirty();
                      };

                      return (
                          <>
                              <div className="p-4 border-b border-white/5 bg-surface-overlay/50 space-y-4">
                                  <div className="flex justify-between items-center">
                                      <span className="text-[10px] text-content-muted font-mono bg-black/30 px-2 py-1 rounded">ID: {activeMod.id}</span>
                                      <button onClick={() => handleDeleteModule(activeMod.id)} className="text-red-400 hover:bg-red-900/20 hover:text-red-300 p-1.5 rounded transition-colors"><Trash2 size={16}/></button>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                          <label className="block text-[10px] uppercase font-bold text-content-muted">Name</label>
                                          <input
                                              type="text"
                                              value={activeMod.name}
                                              onChange={(e) => updateField('name', e.target.value)}
                                              className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-content-primary focus:border-accent-blue/50 outline-none transition-colors"
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="block text-[10px] uppercase font-bold text-content-muted">Group</label>
                                          <input
                                              type="text"
                                              value={activeMod.group}
                                              onChange={(e) => updateField('group', e.target.value)}
                                              className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-content-primary focus:border-accent-blue/50 outline-none transition-colors"
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="block text-[10px] uppercase font-bold text-content-muted">Order</label>
                                          <input
                                              type="number"
                                              value={activeMod.order}
                                              onChange={(e) => updateField('order', parseInt(e.target.value))}
                                              className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-content-primary focus:border-accent-blue/50 outline-none transition-colors"
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="block text-[10px] uppercase font-bold text-content-muted">Usage</label>
                                          <select
                                              value={activeMod.usage}
                                              onChange={(e) => updateField('usage', e.target.value as PromptUsage)}
                                              className="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-content-primary focus:border-accent-blue/50 outline-none transition-colors appearance-none"
                                          >
                                              <option value="CORE">CORE</option>
                                              <option value="START">START</option>
                                          </select>
                                      </div>
                                  </div>
                              </div>
                              <div className="flex-1 relative">
                                  <textarea
                                      className="w-full h-full p-6 bg-transparent text-emerald-300 font-mono text-xs outline-none resize-none custom-scrollbar leading-relaxed"
                                      value={activeMod.content}
                                      onChange={(e) => updateField('content', e.target.value)}
                                      spellCheck={false}
                                      placeholder="// 输入提示词逻辑..."
                                  />
                              </div>
                          </>
                      );
                  })() : (
                      <div className="flex flex-col items-center justify-center h-full text-content-muted opacity-50">
                          <Edit2 size={48} className="mb-4 stroke-1" />
                          <p className="text-xs font-bold uppercase tracking-widest">Select a module to edit</p>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderMemoryView = () => (
      <div className="space-y-6 animate-in fade-in duration-300">
          <SectionHeader title="记忆系统配置" icon={<History />} description="调整表格记忆检索与填表参数" />
          
          <div className="bg-surface-overlay border border-white/5 rounded-xl p-6 space-y-6">
              <div className="p-4 bg-accent-blue/10 border border-accent-blue/20 rounded-lg text-sm text-accent-blue flex gap-3 items-start">
                  <Activity size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">系统提示</span>
                    记忆模块已切换为表格系统（LOG_Summary / LOG_Outline）。此处仅保留表格相关参数。
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-1 md:col-span-2 space-y-2">
                      <div className="flex justify-between items-center">
                          <label className="text-xs font-bold uppercase text-content-secondary">即时记忆容量 (Instant Limit)</label>
                          <span className="font-mono font-bold text-accent-blue">{formData.memoryConfig?.instantLimit || 10}</span>
                      </div>
                      <input 
                        type="range" 
                        min="4" 
                        max="50" 
                        value={formData.memoryConfig?.instantLimit || 10} 
                        onChange={(e) => {
                            setFormData({...formData, memoryConfig: { ...formData.memoryConfig, instantLimit: parseInt(e.target.value) }});
                            markDirty();
                        }} 
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent-blue" 
                      />
                      <p className="text-[10px] text-content-muted">控制即时上下文窗口大小；长期记忆统一从表格检索，不再使用短/中/长期数组。</p>
                  </div>
              </div>
          </div>
      </div>
  );

  const renderVariablesView = () => (
        <div className="h-full flex flex-col animate-in fade-in duration-300">
            <SectionHeader title="变量调试" icon={<FileJson />} description="直接编辑当前游戏状态数据 (开发者模式)" />
            
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <select
                        value={variableCategory}
                        onChange={(val) => setVariableCategory((val.target as HTMLSelectElement).value)}
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-sm text-content-primary font-mono appearance-none cursor-pointer hover:border-white/20 transition-colors"
                    >
                        <option value="角色">角色 (Character)</option>
                        <option value="背包">背包 (Inventory)</option>
                        <option value="世界">世界 (World)</option>
                        <option value="社交">社交 (Social)</option>
                        <option value="任务">任务 (Tasks)</option>
                        <option value="剧情">剧情 (Story)</option>
                        <option value="眷族">眷族 (Familia)</option>
                        <option value="战斗">战斗 (Combat)</option>
                        <option value="战利品">战利品仓库</option>
                        <option value="公共战利品">公共战利品</option>
                        <option value="手机">手机 (Phone)</option>
                        <option value="记忆">记忆 (Memory)</option>
                        <option value="地图">地图 (Map)</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none">
                        <Folder size={14} />
                    </div>
                </div>
                
                <BaseButton
                    variant="solid"
                    onClick={() => {
                        try {
                            const parsed = JSON.parse(jsonEditText);
                            onUpdateGameState({ ...gameState, [variableCategory]: parsed });
                            setJsonError(null);
                            alert("变量已更新");
                        } catch (e: any) {
                            setJsonError(e.message);
                        }
                    }}
                    leftIcon={<Save size={16} />}
                >
                    应用修改
                </BaseButton>
            </div>

            <div className="flex-1 border border-white/10 bg-[#0d1117] rounded-xl relative overflow-hidden shadow-inner">
                <textarea 
                    value={jsonEditText} 
                    onChange={(e) => setJsonEditText(e.target.value)} 
                    className="w-full h-full bg-transparent text-emerald-400 font-mono text-xs p-4 outline-none resize-none custom-scrollbar leading-relaxed" 
                    spellCheck="false" 
                />
                {jsonError && (
                    <div className="absolute bottom-0 left-0 w-full bg-red-900/90 backdrop-blur text-white p-3 text-xs font-mono border-t border-red-500/50 flex items-center gap-2">
                        <AlertTriangle size={14} /> ERROR: {jsonError}
                    </div>
                )}
            </div>
        </div>
  );

  const renderSchemaView = () => (
      <div className="h-full flex flex-col animate-in fade-in duration-300">
          <SectionHeader title="数据结构参考" icon={<LayoutList />} description="游戏核心数据模型的结构定义" />
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-6">
              {GAME_SCHEMA_DOCS.map((doc, index) => (
                  <div key={index} className="bg-surface-overlay border border-white/5 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-surface-base/50 px-4 py-3 border-b border-white/5 flex justify-between items-center">
                          <h3 className="font-bold text-sm text-content-primary uppercase tracking-wider">{doc.title}</h3>
                          <code className="hidden md:block text-[10px] bg-black/20 text-content-muted px-2 py-1 rounded font-mono border border-white/5">{doc.path}</code>
                      </div>
                      <div className="p-4">
                          <p className="text-xs text-content-secondary mb-3 italic pl-3 border-l-2 border-accent-blue/30">{doc.desc}</p>
                          <div className="bg-[#0d1117] p-4 rounded-lg overflow-x-auto border border-white/5 shadow-inner">
                              <pre className="text-[10px] font-mono text-blue-300 leading-relaxed">
                                  {JSON.stringify(doc.structure, null, 2)}
                                  {doc.itemStructure && `\n\n[Array Item Structure]:\n${JSON.stringify(doc.itemStructure, null, 2)}`}
                              </pre>
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      </div>
  );



  const renderLibraryView = () => {
      const mapData = gameState.地图;
      const macro = mapData?.macroLocations || [];
      const mid = mapData?.midLocations || [];
      const dungeonStructure = mapData?.dungeonStructure || [];
      const dungeonNodes = (mapData?.surfaceLocations || []).filter((l: any) => (l.floor || 0) > 0);
      const renderableMidCount = mid.filter((item: any) => !!item?.mapStructure).length;
      
      return (
          <div className="h-full flex flex-col animate-in fade-in duration-300">
              <SectionHeader title="资料库" icon={<FileJson />} description="游戏内静态数据索引" />
              
              <div className="flex items-center gap-3 mb-6 bg-surface-overlay p-1.5 rounded-lg w-fit border border-white/5">
                  <button
                      onClick={() => setLibraryMode('UI')}
                      className={`px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${libraryMode === 'UI' ? 'bg-white/10 text-content-primary shadow-sm' : 'text-content-muted hover:text-content-secondary'}`}
                  >
                      UI 视图
                  </button>
                  <button
                      onClick={() => setLibraryMode('JSON')}
                      className={`px-4 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${libraryMode === 'JSON' ? 'bg-white/10 text-content-primary shadow-sm' : 'text-content-muted hover:text-content-secondary'}`}
                  >
                      JSON 结构
                  </button>
              </div>

              {libraryMode === 'JSON' ? (
                  <div className="flex-1 bg-[#0d1117] border border-white/10 p-4 rounded-xl overflow-auto custom-scrollbar shadow-inner">
                      <pre className="text-[10px] text-blue-300 font-mono whitespace-pre-wrap leading-relaxed">
                          {JSON.stringify({ 地图: mapData }, null, 2)}
                      </pre>
                  </div>
              ) : (
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <StatCard label="大地图区域" value={String(macro.length)} />
                          <StatCard label="中型地点" value={String(mid.length)} />
                          <StatCard label="局部地图" value={String(renderableMidCount)} />
                          <StatCard label="地下城层数" value={String(dungeonStructure.length)} />
                      </div>

                      <div className="bg-surface-overlay border border-white/5 p-4 rounded-xl space-y-2 text-xs text-content-secondary">
                          <div className="font-bold text-content-primary uppercase tracking-wider mb-2 text-[10px]">Context Injection Rules</div>
                          <ul className="space-y-1 list-disc list-inside opacity-80">
                              <li>大地图/中地点：常驻上下文 (Name, Coords, Desc).</li>
                              <li>中地点局部结构：进入对应区域时注入 (MapStructure/Layout).</li>
                              <li>地下城：仅在对应楼层时注入结构信息.</li>
                          </ul>
                      </div>

                      <div className="grid grid-cols-1 gap-6">
                          <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase text-content-muted tracking-widest pl-1">World Hierarchy</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Macro */}
                                  <div className="bg-surface-overlay border border-white/5 rounded-xl p-4">
                                      <div className="text-[10px] font-bold uppercase text-accent-gold mb-3 border-b border-white/5 pb-2">Macro Locations</div>
                                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                          {macro.map(item => (
                                              <div key={item.id} className="p-2 bg-surface-base/50 rounded border border-white/5">
                                                  <div className="font-bold text-content-primary text-xs">{item.name}</div>
                                                  <div className="text-[10px] text-content-muted mt-0.5">{item.description}</div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                                  
                                  {/* Mid */}
                                  <div className="bg-surface-overlay border border-white/5 rounded-xl p-4">
                                      <div className="text-[10px] font-bold uppercase text-accent-blue mb-3 border-b border-white/5 pb-2">Mid Locations</div>
                                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                          {mid.map(item => (
                                              <div key={item.id} className="p-2 bg-surface-base/50 rounded border border-white/5">
                                                  <div className="font-bold text-content-primary text-xs">{item.name}</div>
                                                  <div className="text-[10px] text-content-muted mt-0.5">Parent: {item.parentId}</div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  };

  return (
    <BaseModal 
        isOpen={isOpen} 
        onClose={handleModalClose} 
        title="系统配置 SYSTEM_CONFIG" 
        size="xl"
        className="h-[85vh] flex flex-col"
    >
        <div className="flex h-full min-h-0">
            {/* Sidebar */}
            <div className={`
                md:w-64 md:flex-shrink-0 md:border-r md:block border-white/5 bg-surface-base/50 p-4 space-y-2 overflow-y-auto custom-scrollbar
                ${showSidebar ? 'w-full block' : 'hidden'}
            `}>
                <div className="text-xs font-bold text-content-muted uppercase tracking-widest px-4 py-2 mt-2 mb-1">Core Modules</div>
                <SettingsTab icon={<Cpu size={18}/>} label="AI 服务终端" active={currentView === 'AI_SERVICES'} onClick={() => { setCurrentView('AI_SERVICES'); setShowSidebar(false); }} />
                <SettingsTab icon={<Eye size={18}/>} label="视觉与交互" active={currentView === 'VISUALS'} onClick={() => { setCurrentView('VISUALS'); setShowSidebar(false); }} />

                <div className="text-xs font-bold text-content-muted uppercase tracking-widest px-4 py-2 mt-6 mb-1">Advanced</div>
                <SettingsTab icon={<User size={18}/>} label="提示词工程" active={currentView === 'PROMPTS'} onClick={() => { setCurrentView('PROMPTS'); setShowSidebar(false); }} />
                <SettingsTab icon={<LayoutList size={18}/>} label="上下文组装" active={currentView === 'AI_CONTEXT'} onClick={() => { setCurrentView('AI_CONTEXT'); setShowSidebar(false); }} />
                <SettingsTab icon={<History size={18}/>} label="记忆系统配置" active={currentView === 'MEMORY'} onClick={() => { setCurrentView('MEMORY'); setShowSidebar(false); }} />

                <div className="text-xs font-bold text-content-muted uppercase tracking-widest px-4 py-2 mt-6 mb-1">Developer</div>
                <SettingsTab icon={<FileJson size={18}/>} label="变量调试" active={currentView === 'VARIABLES'} onClick={() => { setCurrentView('VARIABLES'); setShowSidebar(false); }} />
                <SettingsTab icon={<FileJson size={18}/>} label="数据结构" active={currentView === 'SCHEMA'} onClick={() => { setCurrentView('SCHEMA'); setShowSidebar(false); }} />
                <SettingsTab icon={<FileJson size={18}/>} label="资料库" active={currentView === 'LIBRARY'} onClick={() => { setCurrentView('LIBRARY'); setShowSidebar(false); }} />
                <SettingsTab icon={<List size={18}/>} label="完整日志" active={currentView === 'FULL_LOGS'} onClick={() => { setCurrentView('FULL_LOGS'); setShowSidebar(false); }} />
                <SettingsTab icon={<Server size={18}/>} label="存储维护" active={currentView === 'STORAGE'} onClick={() => { setCurrentView('STORAGE'); setShowSidebar(false); }} />

                <div className="mt-8 pt-4 border-t border-white/5">
                    <SettingsTab icon={<X size={18}/>} label="退出游戏" active={false} danger onClick={() => {
                        if (confirm("返回标题将结束当前游戏进度，未保存的内容将丢失。确定继续？")) {
                            onExitGame();
                        }
                    }} />
                </div>
            </div>

            {/* Content Panel */}
            <div className={`
                md:flex-1 md:flex bg-surface-glass overflow-hidden flex-col
                ${!showSidebar ? 'flex-1 flex' : 'hidden'}
            `}>
                {/* Mobile Back Button */}
                <div className="md:hidden p-2 border-b border-white/5 bg-surface-base/50">
                    <button
                        onClick={() => setShowSidebar(true)}
                        className="flex items-center gap-2 text-content-secondary hover:text-content-primary px-2 py-2 w-full active:scale-95 transition-transform"
                    >
                         <ArrowLeft size={18} />
                         <span className="text-sm font-bold uppercase">返回菜单</span>
                    </button>
                </div>
                {/* Document-style Views (Parent handles scrolling) */}
                {['VISUALS', 'STORAGE', 'DATA', 'AI_SERVICES', 'AI_CONTEXT', 'MEMORY'].includes(currentView) && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
                        {currentView === 'VISUALS' && renderVisualsView()}
                        {currentView === 'STORAGE' && renderStorageView()}
                        {currentView === 'DATA' && renderDataView()}
                        {currentView === 'MEMORY' && renderMemoryView()}
                        {currentView === 'AI_SERVICES' && (
                            <div className="animate-in fade-in">
                                <SettingsAIServices
                                    formData={formData}
                                    setFormData={(next) => {
                                        setFormData(prev => typeof next === 'function' ? next(prev) : next);
                                        markDirty();
                                    }}
                                    onSave={(newAiConfig) => {
                                        const next = { ...formData, aiConfig: newAiConfig };
                                        setFormData(next);
                                        markDirty();
                                    }}
                                />
                            </div>
                        )}
                        {currentView === 'AI_CONTEXT' && (
                            <div className="animate-in fade-in">
                                <SettingsContext
                                    settings={formData}
                                    onUpdate={(newSettings) => {
                                        setFormData(newSettings);
                                        markDirty();
                                    }}
                                    gameState={gameState}
                                    onUpdateGameState={onUpdateGameState}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* App-style Views (Views handle their own scrolling, fill container) */}
                {['PROMPTS', 'VARIABLES', 'SCHEMA', 'FULL_LOGS', 'LIBRARY'].includes(currentView) && (
                    <div className="flex-1 flex flex-col h-full min-h-0 p-4 md:p-6 overflow-hidden">
                        {currentView === 'PROMPTS' && renderPromptsView()}
                        {currentView === 'VARIABLES' && renderVariablesView()}
                        {currentView === 'SCHEMA' && renderSchemaView()}
                        {currentView === 'FULL_LOGS' && <SettingsFullLogsView gameState={gameState} />}
                        {currentView === 'LIBRARY' && renderLibraryView()}
                    </div>
                )}
            </div>
        </div>
    </BaseModal>
  );
};

// Helper Components for Polished UI
const SectionHeader = ({ title, icon, description }: { title: string, icon: React.ReactNode, description?: string }) => (
    <div className="flex items-start gap-4 pb-6 border-b border-white/5 mb-6">
        <div className="p-3 bg-surface-floating rounded-xl text-accent-gold shadow-lg shadow-black/20">
            {icon}
        </div>
        <div>
            <h3 className="text-2xl font-display font-bold text-content-primary uppercase tracking-wide">{title}</h3>
            {description && <p className="text-content-secondary text-sm mt-1">{description}</p>}
        </div>
    </div>
);

const SettingToggle = ({ label, desc, active, onToggle }: { label: string, desc: string, active: boolean, onToggle: () => void }) => (
    <div className="flex items-center justify-between p-4 bg-surface-base/30 border border-white/5 rounded-lg hover:border-white/10 transition-colors">
        <div>
            <div className="font-bold text-sm text-content-primary">{label}</div>
            <div className="text-xs text-content-muted mt-0.5">{desc}</div>
        </div>
        <button
            onClick={onToggle}
            className={`text-2xl transition-all duration-300 ${active ? 'text-accent-green scale-110' : 'text-content-muted'}`}
        >
            {active ? <ToggleRight size={36}/> : <ToggleLeft size={36}/>}
        </button>
    </div>
);

const SettingInput = ({ label, desc, value, onChange, min, max, suffix }: { label: string, desc: string, value: number, onChange: (val: number) => void, min?: number, max?: number, suffix?: string }) => (
    <div className="flex items-center justify-between p-4 bg-surface-base/30 border border-white/5 rounded-lg hover:border-white/10 transition-colors">
        <div className="flex-1 pr-4">
            <div className="font-bold text-sm text-content-primary">{label}</div>
            <div className="text-xs text-content-muted mt-0.5">{desc}</div>
        </div>
        <div className="flex items-center gap-2">
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                min={min}
                max={max}
                className="w-20 bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-content-primary focus:border-accent-blue/50 outline-none transition-colors text-right font-mono"
            />
            {suffix && <span className="text-xs text-content-muted">{suffix}</span>}
        </div>
    </div>
);

const StatCard = ({ label, value, sub }: { label: string, value: string, sub?: string }) => (
    <div className="bg-surface-base/40 border border-white/5 p-4 rounded-lg">
        <div className="text-[10px] font-bold uppercase text-content-muted mb-1">{label}</div>
        <div className="text-lg font-mono font-bold text-content-primary">{value}</div>
        {sub && <div className="text-[10px] text-content-secondary mt-1">{sub}</div>}
    </div>
);

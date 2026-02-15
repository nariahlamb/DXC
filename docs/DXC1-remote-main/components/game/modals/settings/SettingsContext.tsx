import React, { useState } from 'react';
import { LayoutList, ArrowUp, ArrowDown, Settings, Code, Eye, EyeOff, Settings2, Maximize2, Minimize2, Swords, Star, Radio, Check, Zap, Globe } from 'lucide-react';
import { AppSettings, ContextModuleConfig, GameState, Confidant } from '../../../../types';
import { assembleFullPrompt, generateSingleModuleContext } from '../../../../utils/ai';

interface SettingsContextProps {
    settings: AppSettings;
    onUpdate: (newSettings: AppSettings) => void;
    gameState: GameState;
    onUpdateGameState: (gs: GameState) => void;
}

export const SettingsContext: React.FC<SettingsContextProps> = ({ settings, onUpdate, gameState, onUpdateGameState }) => {
    const modules = settings.contextConfig?.modules || [];
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<'FULL' | 'MODULE'>('FULL');
    const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);

    const handleUpdateModule = (id: string, updates: Partial<ContextModuleConfig>) => {
        let newModules = modules.map(m => m.id === id ? { ...m, ...updates } : m);
        onUpdate({ ...settings, contextConfig: { ...settings.contextConfig, modules: newModules } });
    };

    const handleUpdateParams = (id: string, paramKey: string, value: any) => {
        const target = modules.find(m => m.id === id);
        if (!target) return;
        handleUpdateModule(id, { params: { ...target.params, [paramKey]: value } });
    };

    const moveModule = (index: number, direction: 'up' | 'down') => {
        const newModules = [...modules];
        if (direction === 'up' && index > 0) {
            [newModules[index - 1], newModules[index]] = [newModules[index], newModules[index - 1]];
            newModules.forEach((m, i) => m.order = i);
            onUpdate({ ...settings, contextConfig: { ...settings.contextConfig, modules: newModules } });
        } else if (direction === 'down' && index < newModules.length - 1) {
            [newModules[index + 1], newModules[index]] = [newModules[index], newModules[index + 1]];
            newModules.forEach((m, i) => m.order = i);
            onUpdate({ ...settings, contextConfig: { ...settings.contextConfig, modules: newModules } });
        }
    };

    const toggleNPCProp = (npcId: string, prop: keyof Confidant) => {
        const newConfidants = gameState.社交.map(c => {
            if (c.id === npcId) {
                return { ...c, [prop]: !c[prop] };
            }
            return c;
        });
        onUpdateGameState({ ...gameState, 社交: newConfidants });
    };

    const togglePhoneTarget = (name: string) => {
        if (!activeModule) return;
        const allNames = gameState.社交.map(c => c.姓名);
        const current = Array.isArray(activeModule.params.targets) && activeModule.params.targets.length > 0
            ? activeModule.params.targets
            : allNames;
        const next = current.includes(name) ? current.filter((n: string) => n !== name) : [...current, name];
        const normalized = next.length === allNames.length ? [] : next;
        handleUpdateParams(activeModule.id, 'targets', normalized);
    };

    const updatePhoneTargetLimit = (name: string, value: number) => {
        if (!activeModule) return;
        const current = activeModule.params.targetLimits || {};
        const next = { ...current };
        if (!value || value < 0) delete next[name];
        else next[name] = value;
        handleUpdateParams(activeModule.id, 'targetLimits', next);
    };

    const getPreviewText = () => {
        if (previewMode === 'MODULE' && selectedModuleId) {
            const mod = modules.find(m => m.id === selectedModuleId);
            if (mod) return generateSingleModuleContext(mod, gameState, settings);
            return "(Module not found)";
        }
        return assembleFullPrompt("（用户输入预览）", gameState, settings);
    };

    const previewText = getPreviewText();
    const sortedModules = [...modules].sort((a,b) => a.order - b.order);
    const activeModule = selectedModuleId ? modules.find(m => m.id === selectedModuleId) : null;

    return (
        <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300 gap-3 overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-zinc-700/50 shrink-0">
                <LayoutList className="text-indigo-400" size={20} />
                <h3 className="text-xl font-display uppercase text-zinc-300">上下文模块管理</h3>
                <div className="ml-auto text-[10px] text-zinc-500 font-mono">
                    {modules.length} 模块
                </div>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-3 overflow-hidden relative">
                {/* Left Sidebar: Module List */}
                <div className={`md:w-1/3 border-r border-zinc-700/50 bg-zinc-800/40 flex flex-col transition-all duration-300 ${isPreviewExpanded ? 'w-0 opacity-0 pointer-events-none md:w-0' : 'w-full'}`}>
                    <div className="p-2 bg-zinc-900/60 border-b border-zinc-700/50">
                        <div className="flex items-center gap-2">
                            <Zap size={12} className="text-zinc-500" />
                            <span className="text-[10px] font-bold uppercase text-zinc-400">模块顺序</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                        {sortedModules.map((mod, index) => (
                            <div
                                key={mod.id}
                                onClick={() => setSelectedModuleId(mod.id)}
                                className={`border rounded-lg p-2.5 cursor-pointer flex items-center gap-2 group transition-all
                                    ${selectedModuleId === mod.id
                                        ? 'bg-indigo-600/20 border-indigo-500/50'
                                        : 'bg-zinc-800/60 border-zinc-700/50 hover:border-zinc-500'
                                    }
                                    ${!mod.enabled ? 'opacity-50' : ''}
                                `}
                            >
                                <div className="flex flex-col gap-1 mr-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => moveModule(index, 'up')}
                                        disabled={index === 0}
                                        className="hover:text-indigo-400 disabled:opacity-10 text-zinc-500 p-0.5"
                                    >
                                        <ArrowUp size={10}/>
                                    </button>
                                    <button
                                        onClick={() => moveModule(index, 'down')}
                                        disabled={index === modules.length - 1}
                                        className="hover:text-indigo-400 disabled:opacity-10 text-zinc-500 p-0.5"
                                    >
                                        <ArrowDown size={10}/>
                                    </button>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className={`font-bold text-xs truncate ${selectedModuleId === mod.id ? 'text-indigo-300' : 'text-zinc-200'}`}>
                                        {mod.name}
                                    </div>
                                    <div className="text-[9px] text-zinc-500 font-mono">{mod.type}</div>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUpdateModule(mod.id, { enabled: !mod.enabled });
                                    }}
                                    className={`rounded-full p-0.5 transition-colors ${mod.enabled ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}
                                >
                                    <Check size={14}/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Area: Config & Preview */}
                <div className={`flex-1 flex flex-col bg-zinc-800/40 overflow-hidden transition-all duration-300 ${isPreviewExpanded ? 'w-full' : ''}`}>
                    {/* Module Configuration */}
                    {!isPreviewExpanded && (
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-zinc-800/30">
                            {activeModule ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-zinc-700/50">
                                        <Settings2 size={16} className="text-zinc-400"/>
                                        <h4 className="text-sm font-bold text-zinc-300">配置: {activeModule.name}</h4>
                                        <span className="ml-auto text-[10px] font-mono text-zinc-500">{activeModule.type}</span>
                                    </div>

                                    {/* Module Type Config */}
                                    {activeModule.type === 'SOCIAL_CONTEXT' && (
                                        <div className="space-y-3">
                                            <div className="text-[10px] font-bold uppercase text-zinc-500 mb-2 flex items-center gap-1">
                                                <Star size={10} /> 记忆条数配置
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <MemoryInput
                                                    label="特别关注(在场)"
                                                    value={activeModule.params.specialPresentMemoryLimit ?? activeModule.params.specialMemoryLimit ?? 30}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'specialPresentMemoryLimit', v)}
                                                />
                                                <MemoryInput
                                                    label="在场普通"
                                                    value={activeModule.params.presentMemoryLimit ?? activeModule.params.normalMemoryLimit ?? 30}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'presentMemoryLimit', v)}
                                                />
                                                <MemoryInput
                                                    label="特别关注(离场)"
                                                    value={activeModule.params.specialAbsentMemoryLimit ?? 12}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'specialAbsentMemoryLimit', v)}
                                                />
                                                <MemoryInput
                                                    label="离场普通"
                                                    value={activeModule.params.absentMemoryLimit ?? 6}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'absentMemoryLimit', v)}
                                                />
                                            </div>

                                            <NPCTable gameState={gameState} toggleNPCProp={toggleNPCProp} />
                                        </div>
                                    )}

                                    {activeModule.type === 'PHONE_CONTEXT' && (
                                        <div className="space-y-3">
                                            <div className="text-[10px] font-bold uppercase text-zinc-500 mb-2 flex items-center gap-1">
                                                <Eye size={10} /> 手机内容配置
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <MemoryInput
                                                    label="对话条数"
                                                    value={activeModule.params.perThreadLimit ?? activeModule.params.perTargetLimit ?? activeModule.params.messageLimit ?? 10}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'perThreadLimit', v)}
                                                />
                                                <MemoryInput
                                                    label="朋友圈"
                                                    value={activeModule.params.momentLimit ?? 6}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'momentLimit', v)}
                                                />
                                                <MemoryInput
                                                    label="论坛条数"
                                                    value={activeModule.params.forumLimit ?? 6}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'forumLimit', v)}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-2">
                                                <ToggleRow
                                                    label="包含朋友圈"
                                                    desc="仅发送聊天对话"
                                                    value={activeModule.params.includeMoments !== false}
                                                    onToggle={() => handleUpdateParams(activeModule.id, 'includeMoments', !(activeModule.params.includeMoments !== false))}
                                                />
                                                <ToggleRow
                                                    label="包含公共论坛"
                                                    desc="不发送公共帖子"
                                                    value={activeModule.params.includePublicPosts !== false}
                                                    onToggle={() => handleUpdateParams(activeModule.id, 'includePublicPosts', !(activeModule.params.includePublicPosts !== false))}
                                                />
                                            </div>

                                            <PhoneTargetTable gameState={gameState} activeModule={activeModule} togglePhoneTarget={togglePhoneTarget} updatePhoneTargetLimit={updatePhoneTargetLimit} updateParams={handleUpdateParams} />
                                        </div>
                                    )}

                                    {activeModule.type === 'MAP_CONTEXT' && (
                                        <div className="space-y-3">
                                            <ToggleRow
                                                label="地下层地图常驻"
                                                desc="触发词出现时发送"
                                                value={activeModule.params.alwaysIncludeDungeon}
                                                onToggle={() => handleUpdateParams(activeModule.id, 'alwaysIncludeDungeon', !activeModule.params.alwaysIncludeDungeon)}
                                            />
                                            <div className="pt-2">
                                                <label className="block text-[10px] uppercase font-bold mb-1 text-zinc-500">触发关键词 (逗号分隔)</label>
                                                <input
                                                    type="text"
                                                    value={Array.isArray(activeModule.params.triggerKeywords) ? activeModule.params.triggerKeywords.join(',') : ''}
                                                    onChange={(e) => handleUpdateParams(activeModule.id, 'triggerKeywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                                    className="w-full bg-zinc-900/60 border border-zinc-600/50 rounded p-2 text-xs text-zinc-300 outline-none focus:border-zinc-400"
                                                    placeholder="前往,地图,地形"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {activeModule.type === 'MEMORY_CONTEXT' && (
                                        <div className="space-y-3">
                                            <div className="text-[10px] font-bold uppercase text-zinc-500 mb-2 flex items-center gap-1">
                                                <Globe size={10} /> 记忆召回配置
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <ToggleRow
                                                    label="启用表格召回"
                                                    desc="关闭后仅保留索引召回"
                                                    value={activeModule.params.enableTableRetrieval !== false}
                                                    onToggle={() => handleUpdateParams(
                                                        activeModule.id,
                                                        'enableTableRetrieval',
                                                        !(activeModule.params.enableTableRetrieval !== false)
                                                    )}
                                                />
                                                <ToggleRow
                                                    label="启用索引召回"
                                                    desc="关闭后仅保留表格召回"
                                                    value={activeModule.params.enableIndexRetrieval !== false}
                                                    onToggle={() => handleUpdateParams(
                                                        activeModule.id,
                                                        'enableIndexRetrieval',
                                                        !(activeModule.params.enableIndexRetrieval !== false)
                                                    )}
                                                />
                                                <ToggleRow
                                                    label="启用事实边界"
                                                    desc="输出 KNOWN/UNKNOWN 边界"
                                                    value={activeModule.params.enableFactBoundary !== false}
                                                    onToggle={() => handleUpdateParams(
                                                        activeModule.id,
                                                        'enableFactBoundary',
                                                        !(activeModule.params.enableFactBoundary !== false)
                                                    )}
                                                />
                                                <ToggleRow
                                                    label="启用记忆召回"
                                                    desc="总开关（关闭则退化为近期日志）"
                                                    value={activeModule.params.enableMemoryRetrieval !== false}
                                                    onToggle={() => handleUpdateParams(
                                                        activeModule.id,
                                                        'enableMemoryRetrieval',
                                                        !(activeModule.params.enableMemoryRetrieval !== false)
                                                    )}
                                                />
                                            </div>

                                            <div className="pt-2 space-y-2">
                                                <label className="block text-[10px] uppercase font-bold mb-1 text-zinc-500">召回模式</label>
                                                <select
                                                    value={String(activeModule.params.retrievalMode || 'narrative')}
                                                    onChange={(e) => handleUpdateParams(activeModule.id, 'retrievalMode', e.target.value)}
                                                    className="w-full bg-zinc-900/60 border border-zinc-600/50 rounded p-2 text-xs text-zinc-300 outline-none focus:border-zinc-400"
                                                >
                                                    <option value="narrative">narrative（剧情）</option>
                                                    <option value="action">action（行动）</option>
                                                    <option value="phone">phone（手机）</option>
                                                    <option value="custom">custom（自定义）</option>
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <MemoryInput
                                                    label="表格召回 TopK"
                                                    value={activeModule.params.retrievalTopK ?? 8}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'retrievalTopK', v)}
                                                />
                                                <MemoryInput
                                                    label="索引召回 TopK"
                                                    value={activeModule.params.indexRetrievalTopK ?? activeModule.params.retrievalTopK ?? 6}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'indexRetrievalTopK', v)}
                                                />
                                                <MemoryInput
                                                    label="索引摘要窗口"
                                                    value={activeModule.params.indexSummaryWindow ?? 16}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'indexSummaryWindow', v)}
                                                />
                                                <MemoryInput
                                                    label="索引大纲窗口"
                                                    value={activeModule.params.indexOutlineWindow ?? 12}
                                                    onChange={(v) => handleUpdateParams(activeModule.id, 'indexOutlineWindow', v)}
                                                />
                                            </div>

                                            <div className="pt-2">
                                                <label className="block text-[10px] uppercase font-bold mb-1 text-zinc-500">表格过滤（逗号分隔 sheetId）</label>
                                                <input
                                                    type="text"
                                                    value={Array.isArray(activeModule.params.retrievalSheetFilter) ? activeModule.params.retrievalSheetFilter.join(',') : ''}
                                                    onChange={(e) => handleUpdateParams(
                                                        activeModule.id,
                                                        'retrievalSheetFilter',
                                                        e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                                    )}
                                                    className="w-full bg-zinc-900/60 border border-zinc-600/50 rounded p-2 text-xs text-zinc-300 outline-none focus:border-zinc-400"
                                                    placeholder="LOG_Summary,LOG_Outline,NPC_Registry"
                                                />
                                            </div>

                                            <div className="pt-2">
                                                <label className="block text-[10px] uppercase font-bold mb-1 text-zinc-500">索引来源过滤</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {(['paired', 'summary', 'outline'] as const).map((source) => {
                                                        const current = Array.isArray(activeModule.params.indexSourceFilter)
                                                            ? activeModule.params.indexSourceFilter
                                                            : [];
                                                        const enabled = current.includes(source);
                                                        return (
                                                            <button
                                                                key={source}
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = enabled
                                                                        ? current.filter((item: string) => item !== source)
                                                                        : [...current, source];
                                                                    handleUpdateParams(activeModule.id, 'indexSourceFilter', next);
                                                                }}
                                                                className={`px-2 py-1 rounded border text-[10px] uppercase transition-colors ${
                                                                    enabled
                                                                        ? 'border-emerald-500/60 text-emerald-300 bg-emerald-900/20'
                                                                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                                                                }`}
                                                            >
                                                                {source}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="text-[9px] text-zinc-600 mt-1">全不选 = 使用模式默认来源</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Generic params */}
                                    {!['SOCIAL_CONTEXT', 'PHONE_CONTEXT', 'MAP_CONTEXT', 'MEMORY_CONTEXT'].includes(activeModule.type) && (
                                        <div className="text-[10px] text-zinc-500 italic p-3 bg-zinc-900/30 rounded-lg">
                                            此模块无额外配置项
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                                    <Settings size={40} className="mb-3 opacity-20" />
                                    <p className="text-xs uppercase font-bold tracking-wider">选择模块进行配置</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview Area */}
                    <div className={`${isPreviewExpanded ? 'flex-1 h-full' : 'h-48'} bg-zinc-950/80 border-t border-zinc-700/50 flex flex-col transition-all duration-300 relative`}>
                        <div className="flex justify-between items-center p-2 bg-zinc-900 text-zinc-400 text-[10px] font-bold uppercase tracking-wider shrink-0 border-b border-zinc-800">
                            <span className="flex items-center gap-2"><Code size={10} /> 输出预览</span>
                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={() => setPreviewMode('MODULE')}
                                    className={`transition-colors ${previewMode === 'MODULE' ? 'text-indigo-400' : 'hover:text-white'}`}
                                >
                                    仅模块
                                </button>
                                <span className="text-zinc-700">|</span>
                                <button
                                    onClick={() => setPreviewMode('FULL')}
                                    className={`transition-colors ${previewMode === 'FULL' ? 'text-emerald-400' : 'hover:text-white'}`}
                                >
                                    完整上下文
                                </button>
                                <div className="w-px h-3 bg-zinc-800 mx-1" />
                                <button
                                    onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                                    className="hover:text-white text-zinc-400 flex items-center gap-1"
                                >
                                    {isPreviewExpanded ? (
                                        <div className="flex items-center gap-1 bg-zinc-800 px-2 py-0.5 rounded"><Minimize2 size={10}/> 退出全屏</div>
                                    ) : (
                                        <div className="flex items-center gap-1"><Maximize2 size={10}/> 展开</div>
                                    )}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            <textarea
                                readOnly
                                value={previewText}
                                className="w-full h-full bg-transparent text-emerald-400/80 font-mono text-[10px] p-3 resize-none outline-none leading-relaxed whitespace-pre-wrap"
                            />
                        </div>
                        <div className="text-[9px] text-zinc-600 px-2 py-1 border-t border-zinc-800/50">
                            预览长度: {previewText.length} 字符
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Components
const MemoryInput = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-lg p-2">
        <label className="block text-[10px] text-zinc-500 mb-1">{label}</label>
        <input
            type="number"
            min="0"
            max="100"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            className="w-full bg-transparent text-zinc-200 text-sm font-mono outline-none"
        />
    </div>
);

const ToggleRow = ({ label, desc, value, onToggle }: { label: string; desc: string; value: boolean; onToggle: () => void }) => (
    <div className="bg-zinc-900/60 border border-zinc-700/50 rounded-lg p-2 flex items-center justify-between">
        <div>
            <div className="text-xs font-medium text-zinc-300">{label}</div>
            <div className="text-[9px] text-zinc-500">{desc}</div>
        </div>
        <button
            onClick={onToggle}
            className={`w-8 h-4 rounded-full transition-all relative ${value ? 'bg-blue-600/80' : 'bg-zinc-700'}`}
        >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${value ? 'left-4' : 'left-0.5'}`} />
        </button>
    </div>
);

const NPCTable = ({ gameState, toggleNPCProp }: { gameState: GameState; toggleNPCProp: (id: string, prop: keyof Confidant) => void }) => (
    <div className="border border-zinc-700/50 rounded-lg overflow-hidden bg-zinc-900/40">
        <div className="bg-zinc-800/60 px-2.5 py-2 border-b border-zinc-700/50 flex justify-between items-center">
            <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                <Star size={10} /> NPC 状态覆写
            </span>
            <span className="text-[9px] text-zinc-600">共 {gameState.社交.length} 人</span>
        </div>
        <div className="max-h-48 overflow-y-auto custom-scrollbar">
            <div className="divide-y divide-zinc-700/50">
                {gameState.社交.map(c => (
                    <div key={c.id} className="p-2 hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-zinc-300 w-20 truncate">{c.姓名}</span>
                            <div className="flex gap-1.5 ml-auto">
                                <IconBtn
                                    active={c.是否在场}
                                    icon={<Eye size={14}/>}
                                    title="在场"
                                    onClick={() => toggleNPCProp(c.id, '是否在场')}
                                    activeColor="text-emerald-400"
                                />
                                <IconBtn
                                    active={c.特别关注}
                                    icon={<Star size={14} fill={c.特别关注 ? 'currentColor' : 'none'}/>}
                                    title="关注"
                                    onClick={() => toggleNPCProp(c.id, '特别关注')}
                                    activeColor="text-yellow-400"
                                />
                                <IconBtn
                                    active={c.是否队友}
                                    icon={<Swords size={14}/>}
                                    title="队友"
                                    onClick={() => toggleNPCProp(c.id, '是否队友')}
                                    activeColor="text-indigo-400"
                                />
                                <IconBtn
                                    active={c.强制包含上下文}
                                    icon={<Radio size={14}/>}
                                    title="强制上下文"
                                    onClick={() => toggleNPCProp(c.id, '强制包含上下文')}
                                    activeColor="text-blue-400"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const PhoneTargetTable = ({ gameState, activeModule, togglePhoneTarget, updatePhoneTargetLimit, updateParams }: {
    gameState: GameState;
    activeModule: ContextModuleConfig;
    togglePhoneTarget: (name: string) => void;
    updatePhoneTargetLimit: (name: string, value: number) => void;
    updateParams: (id: string, paramKey: string, value: any) => void;
}) => {
    const allNames = gameState.社交.map(c => c.姓名);
    const hasFilter = Array.isArray(activeModule.params.targets) && activeModule.params.targets.length > 0;
    const filterActive = hasFilter;

    return (
        <div className="border border-zinc-700/50 rounded-lg overflow-hidden bg-zinc-900/40">
            <div className="bg-zinc-800/60 px-2.5 py-2 border-b border-zinc-700/50 flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1">
                    <Eye size={10} /> 对话角色筛选
                </span>
                <button
                    onClick={() => {
                        const newTargets = filterActive ? [] : allNames;
                        updateParams(activeModule.id, 'targets', newTargets);
                    }}
                    className="text-[9px] text-zinc-400 hover:text-white underline"
                >
                    {filterActive ? '重置为全部' : '清空选择'}
                </button>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                <div className="divide-y divide-zinc-700/50">
                    {gameState.社交.map(c => {
                        const isEnabled = hasFilter
                            ? activeModule.params.targets.includes(c.姓名)
                            : true;
                        const limitVal = activeModule.params.targetLimits?.[c.姓名] ?? '';

                        return (
                            <div key={c.id} className="p-2 hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-zinc-300 w-20 truncate">{c.姓名}</span>
                                    <button
                                        onClick={() => togglePhoneTarget(c.姓名)}
                                        className={`ml-auto p-1 rounded transition-colors ${isEnabled ? 'bg-emerald-600/20 text-emerald-400' : 'bg-zinc-700 text-zinc-500'}`}
                                    >
                                        {isEnabled ? <Eye size={14}/> : <EyeOff size={14}/>}
                                    </button>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={limitVal}
                                        onChange={(e) => updatePhoneTargetLimit(c.姓名, parseInt(e.target.value))}
                                        placeholder={String(activeModule.params.perThreadLimit ?? activeModule.params.perTargetLimit ?? 10)}
                                        className="w-12 bg-zinc-900/60 border border-zinc-600/50 rounded px-1.5 py-1 text-[10px] font-mono text-center text-zinc-300"
                                    />
                                    <span className="text-[9px] text-zinc-600 w-4">条</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const IconBtn = ({ active, icon, title, onClick, activeColor }: {
    active: boolean;
    icon: React.ReactNode;
    title: string;
    onClick: () => void;
    activeColor: string;
}) => (
    <button
        onClick={onClick}
        className={`p-1 rounded transition-colors ${active ? activeColor : 'text-zinc-600 hover:text-zinc-400'}`}
        title={title}
    >
        {icon}
    </button>
);

// Temporary export helper to make handleUpdateParams available in PhoneTargetTable
let currentHandler: ((id: string, paramKey: string, value: any) => void) | null = null;

const exportedHandleUpdateParams = (id: string, paramKey: string, value: any) => {
    // This is a placeholder - the actual function is defined inside SettingsContext
    // PhoneTargetTable should receive this as a prop instead
};

export { exportedHandleUpdateParams as handleUpdateParams };

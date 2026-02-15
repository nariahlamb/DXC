import React, { useEffect, useRef, useState } from 'react';
import { HardDrive, Clock, FileDown, FileUp, Database, Save, RotateCw, Trash2, Github, CloudUpload, CloudDownload, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react';
import { GistService } from '../../../utils/gistService';
import { saveGithubToken, loadGithubToken, saveGistId, loadGistId } from '../../../utils/storage/storageAdapter';
import { GameState, SaveSlot } from '../../../types';
import { ModalWrapper } from '../../ui/ModalWrapper';
import clsx from 'clsx';
import { loadAllSaveSlots } from '../../../utils/storage/storageAdapter';

interface SaveManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  onSaveGame: (slotId?: number | string) => void;
  onLoadGame: (slotId: number | string) => void;
  onUpdateGameState: (newState: GameState) => void;
}

export const SaveManagerModal: React.FC<SaveManagerModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onSaveGame,
  onLoadGame,
  onUpdateGameState,
}) => {
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [autoSlots, setAutoSlots] = useState<SaveSlot[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [githubToken, setGithubToken] = useState('');
  const [githubUser, setGithubUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadSaveSlots = async () => {
    const slots = await loadAllSaveSlots();
    setSaveSlots(slots.manual);
    setAutoSlots(slots.auto);
  };

  useEffect(() => {
    if (isOpen) {
      loadSaveSlots();
      checkGithubConnection();
    }
  }, [isOpen]);

  const checkGithubConnection = async () => {
    const token = await loadGithubToken();
    if (token) {
      setGithubToken(token);
      validateToken(token);
    }
  };

  const validateToken = async (token: string) => {
    setIsSyncing(true);
    try {
      const service = new GistService(token);
      const user = await service.validateToken();
      if (user) {
        setGithubUser(user);
        // Silently check for existing backup to cache ID
        const gist = await service.findBackupGist();
        if (gist) {
          await saveGistId(gist.id);
        }
      } else {
        setSyncStatus({ type: 'error', message: 'Token 无效' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConnectGithub = async () => {
    if (!githubToken) return;
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      await saveGithubToken(githubToken);
      await validateToken(githubToken);
      setSyncStatus({ type: 'success', message: '已连接 GitHub' });
    } catch (err: any) {
      setSyncStatus({ type: 'error', message: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadToGist = async () => {
    if (!githubToken) return;
    setIsSyncing(true);
    setSyncStatus({ type: 'info', message: 'Backing up...' });
    
    try {
      const service = new GistService(githubToken);
      let gistId = await loadGistId();

      // Ensure we have the latest ID if not stored
      if (!gistId) {
        const existing = await service.findBackupGist();
        if (existing) gistId = existing.id;
      }

      const backupData = {
        id: 'cloud_backup',
        type: 'CLOUD',
        timestamp: Date.now(),
        summary: `Cloud Backup: ${gameState.角色?.姓名 || 'Player'} - Lv.${gameState.角色?.等级 || '1'}`,
        data: gameState,
        version: '3.0',
      };

      if (gistId) {
        await service.updateBackupGist(gistId, backupData);
        await saveGistId(gistId); // ensuring it's saved
        setSyncStatus({ type: 'success', message: '云端备份已更新！' });
      } else {
        const newGist = await service.createBackupGist(backupData);
        await saveGistId(newGist.id);
        setSyncStatus({ type: 'success', message: '新备份已创建！' });
      }
    } catch (err: any) {
      console.error(err);
      setSyncStatus({ type: 'error', message: '备份失败: ' + err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadFromGist = async () => {
    if (!githubToken) return;
    if (!confirm('这将覆盖当前游戏进度，确定继续吗？')) return;

    setIsSyncing(true);
    setSyncStatus({ type: 'info', message: '正在下载...' });

    try {
      const service = new GistService(githubToken);
      let gistId = await loadGistId();
      
      if (!gistId) {
         const existing = await service.findBackupGist();
         if (existing) {
             gistId = existing.id;
             await saveGistId(gistId);
         } else {
             throw new Error('未找到备份文件');
         }
      }

      const data = await service.getGistContent(gistId);
      
      // Validate structure similar to file import
      let stateToLoad = data.data ? data.data : data;
      // ... (Reusing minimal validation logic, or trusting cloud data structure as it was generated by us)
      if (stateToLoad.character && !stateToLoad.角色) stateToLoad.角色 = stateToLoad.character;

      onUpdateGameState(stateToLoad);
      setSyncStatus({ type: 'success', message: '云端存档读取成功！' });
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setSyncStatus({ type: 'error', message: '读取失败: ' + err.message });
    } finally {
      setIsSyncing(false);
    }
  };



  const handleExportSave = () => {
    const exportData = {
      id: 'export',
      type: 'EXPORT',
      timestamp: Date.now(),
      summary: `Export: ${gameState.角色?.姓名 || 'Player'} - Lv.${gameState.角色?.等级 || '1'}`,
      data: gameState,
      version: '3.0',
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
          throw new Error('Format Error (Invalid JSON)');
        }

        let stateToLoad = parsed.data ? parsed.data : parsed;

        if (stateToLoad.character && !stateToLoad.角色) stateToLoad.角色 = stateToLoad.character;
        if (stateToLoad.inventory && !stateToLoad.背包) stateToLoad.背包 = stateToLoad.inventory;
        if (stateToLoad.worldMap && !stateToLoad.地图) stateToLoad.地图 = stateToLoad.worldMap;
        if (stateToLoad.logs && !stateToLoad.日志) stateToLoad.日志 = stateToLoad.logs;

        const missingFields = [];
        if (!stateToLoad.角色) missingFields.push('Character');
        if (!stateToLoad.地图) missingFields.push('Map');

        if (missingFields.length > 0) {
          throw new Error(`存档数据不完整，缺少: ${missingFields.join(', ')}`);
        }

        const summary = parsed.summary || stateToLoad.角色?.姓名 || 'Unknown Save';
        const timeStr = parsed.timestamp ? new Date(parsed.timestamp).toLocaleString() : 'Unknown Date';

        if (window.confirm(`导入该存档?\n\n信息: ${summary}\n时间: ${timeStr}\n\n警告: 当前未保存的进度将会丢失！`)) {
          onUpdateGameState(stateToLoad);
          alert('存档导入成功！');
          onClose();
        }
      } catch (err: any) {
        console.error('Import Error:', err);
        alert('导入失败: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title="数据管理"
        icon={<HardDrive size={20} />}
        size="l"
        theme="default"
        className="flex flex-col h-[85vh] md:h-[600px] w-full max-w-5xl"
    >
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-y-auto md:overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-black/90 text-zinc-300">
          
          {/* Top Section: Save Slots */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 md:flex-1">
            
            {/* Auto Saves Column */}
            <div className="flex flex-col gap-2 min-h-0 bg-white/[0.02] rounded-lg p-4">
              <h4 className="flex items-center gap-2 text-[12px] font-bold text-zinc-500 pb-2 border-b border-white/5 shrink-0">
                 <Clock size={14} /> 自动存档 (Auto)
              </h4>
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pr-1">
                {autoSlots.length > 0 ? (
                  autoSlots.map((slot) => (
                    <div key={slot.id} className="group flex items-center gap-3 p-2 hover:bg-white/5 transition-all rounded-md shrink-0">
                      <div className="p-2 text-zinc-500 group-hover:text-blue-400 transition-colors">
                          <Save size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-zinc-300 truncate group-hover:text-white transition-colors">{slot.summary}</div>
                        <div className="text-[10px] text-zinc-600 font-mono">{new Date(slot.timestamp).toLocaleString()}</div>
                      </div>
                      <button 
                          onClick={() => { onLoadGame(slot.id); onClose(); }}
                          className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-white/5 rounded-full transition-all"
                          title="读取存档"
                      >
                          <FileUp size={18} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-zinc-600 text-[12px] italic px-2 py-8 text-center">暂无自动存档</div>
                )}
              </div>
            </div>

            {/* Manual Slots Column */}
            <div className="flex flex-col gap-2 min-h-0 bg-white/[0.02] rounded-lg p-4">
              <h4 className="flex items-center gap-2 text-[12px] font-bold text-zinc-500 pb-2 border-b border-white/5 shrink-0">
                 <HardDrive size={14} /> 手动存档 (Manual)
              </h4>
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 pr-1">
                {[1, 2, 3].map((id) => {
                  const slot = saveSlots.find((s) => s.id === id);
                  return (
                    <div key={id} className="group flex items-center gap-3 p-2 hover:bg-white/5 transition-all rounded-md shrink-0">
                      <div className="font-display text-lg w-8 text-zinc-600 group-hover:text-emerald-500 transition-colors text-center">{id}</div>
                      <div className="flex-1 min-w-0">
                        {slot ? (
                          <>
                            <div className="text-[13px] font-medium text-zinc-300 truncate group-hover:text-white transition-colors">{slot.summary}</div>
                            <div className="text-[10px] text-zinc-600 font-mono">{new Date(slot.timestamp).toLocaleString()}</div>
                          </>
                        ) : (
                          <div className="text-zinc-700 italic text-[12px]">空槽位</div>
                        )}
                      </div>
                      <div className="flex gap-1">
                          <button 
                              onClick={() => {
                                onSaveGame(id);
                                setTimeout(loadSaveSlots, 150);
                              }}
                              className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-white/5 rounded-full transition-all"
                              title="覆盖/保存"
                          >
                              <Save size={18} />
                          </button>
                          {slot && (
                          <button 
                              onClick={() => { onLoadGame(id); onClose(); }}
                              className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-white/5 rounded-full transition-all"
                              title="读取"
                          >
                              <RotateCw size={18} />
                          </button>
                          )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Section: Operations */}
          <div className="shrink-0 grid grid-cols-1 md:grid-cols-12 gap-6 h-auto">
             
             {/* Local File Ops (4 cols) */}
             <div className="md:col-span-4 bg-white/[0.02] p-4 rounded-lg flex flex-col justify-between">
                <h4 className="flex items-center gap-2 text-[12px] font-bold text-zinc-500 mb-3">
                  <Database size={14} /> 本地文件
                </h4>
                <div className="flex items-center justify-around">
                  <button 
                    onClick={handleExportSave} 
                    className="flex flex-col items-center gap-1 p-2 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 rounded-md transition-all group"
                    title="导出 .json 文件"
                  >
                    <FileDown size={20} className="mb-0.5" />
                    <span className="text-[10px]">导出备份</span>
                  </button>
                  <div className="h-8 w-px bg-white/5 mx-2"></div>
                  <div className="relative">
                    <button 
                      onClick={() => fileInputRef.current?.click()} 
                      className="flex flex-col items-center gap-1 p-2 text-zinc-500 hover:text-blue-400 hover:bg-white/5 rounded-md transition-all group"
                      title="导入 .json 文件"
                    >
                      <FileUp size={20} className="mb-0.5" />
                      <span className="text-[10px]">导入备份</span>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportSave} />
                  </div>
                </div>
             </div>

             {/* Cloud Sync (8 cols) */}
             <div className="md:col-span-8 bg-white/[0.02] p-4 rounded-lg flex flex-col justify-center gap-3 relative">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-1">
                   {/* Header & Status Line */}
                   <h4 className="flex items-center gap-2 text-[12px] font-bold text-zinc-500">
                      <Github size={14} /> 云端同步 (Gist)
                   </h4>
                   {syncStatus && (
                      <div className={`flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full ${
                        syncStatus.type === 'error' ? 'text-red-400 bg-red-400/10' :
                        syncStatus.type === 'success' ? 'text-emerald-400 bg-emerald-400/10' :
                        'text-blue-400 bg-blue-400/10'
                      }`}>
                        {syncStatus.type === 'error' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                        <span className="truncate max-w-full md:max-w-[200px]">{syncStatus.message}</span>
                      </div>
                   )}
                </div>

                {!githubUser ? (
                  /* Disconnected State */
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <div className="relative flex-1 group">
                      <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                      <input 
                        type="password" 
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        placeholder="请输入 GitHub Token (需gist权限)..."
                        className="w-full bg-black/20 hover:bg-black/30 transition-colors rounded-md py-2 pl-9 pr-3 text-[12px] text-zinc-300 focus:outline-none placeholder:text-zinc-700"
                      />
                    </div>
                    <button 
                      onClick={handleConnectGithub}
                      disabled={isSyncing || !githubToken}
                      className="h-9 sm:h-auto px-3 sm:px-2 text-zinc-500 hover:text-blue-400 hover:bg-white/5 rounded-md sm:rounded-full transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                      title="连接 GitHub"
                    >
                      {isSyncing ? <RotateCw size={18} className="animate-spin" /> : <CloudUpload size={18} />}
                      <span className="text-[11px] sm:hidden">连接</span>
                    </button>
                  </div>
                ) : (
                  /* Connected State */
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 mr-auto pl-1">
                      <img src={githubUser.avatar_url} alt={githubUser.login} className="w-8 h-8 rounded-full opacity-80" />
                      <div className="flex flex-col leading-tight">
                         <span className="text-[12px] font-medium text-zinc-400">{githubUser.login}</span>
                         <span className="text-[10px] text-emerald-600/70">● 已连接</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:flex gap-2 sm:gap-4 items-center w-full sm:w-auto">
                      <button 
                        onClick={handleUploadToGist}
                        disabled={isSyncing}
                        className="flex flex-col items-center gap-1 p-2 text-zinc-500 hover:text-indigo-400 hover:bg-white/5 rounded-md transition-all group"
                        title="上传当前存档"
                      >
                        <CloudUpload size={20} className="mb-0.5" />
                        <span className="text-[10px]">上传</span>
                      </button>
                      
                      <button 
                        onClick={handleDownloadFromGist}
                        disabled={isSyncing}
                        className="flex flex-col items-center gap-1 p-2 text-zinc-500 hover:text-emerald-400 hover:bg-white/5 rounded-md transition-all group"
                        title="下载云端存档"
                      >
                        <CloudDownload size={20} className="mb-0.5" />
                        <span className="text-[10px]">下载</span>
                      </button>

                      <div className="h-8 w-px bg-white/5 mx-1"></div>

                      <button 
                        onClick={() => { setGithubUser(null); setGithubToken(''); saveGithubToken(''); setSyncStatus(null); }}
                        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-white/5 rounded-full transition-all"
                        title="断开连接"
                      >
                        <RotateCw size={18} className="rotate-45" /> 
                      </button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
    </ModalWrapper>
  );
};
import React, { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import { GameState, SaveSlot } from '../types';
import { createNewGameState } from '../utils/dataMapper';
import { useAppSettings } from '../hooks/useAppSettings';
import { usePerformanceMode } from '../hooks/usePerformanceMode';
import { getLatestSaveSlot, getSaveStorageKey, getManagedJson, loadAllSaveSlots } from '../utils/storage/storageAdapter';
import { migrateLocalToIndexedDbV1 } from '../utils/storage/migrations/v1LocalToIdb';

// Lazy Load Modals
const SettingsModal = lazy(() => import('./game/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));

// Decoupled Components
import { MagicCircleBackground } from './home/MagicCircleBackground';
import { GameTitle } from './home/GameTitle';
import { MainMenu } from './home/MainMenu';

interface HomeProps {
  onStart: (savedState?: GameState) => void;
  onNewGame: () => void;
}

export const Home: React.FC<HomeProps> = ({ onStart, onNewGame }) => {
  const [loaded, setLoaded] = useState(false);
  const [previewGameState, setPreviewGameState] = useState<GameState>(() => createNewGameState('Preview', 'Male', 'Human'));
  const previewAvatarUrl = useMemo(() => {
    const rawAvatar = previewGameState?.角色?.头像;
    const normalized = typeof rawAvatar === 'string' ? rawAvatar.trim() : '';
    return normalized || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  }, [previewGameState]);
  
  // Decoupled Settings Logic
  const { settings, saveSettings } = useAppSettings();
  const { motionLevel } = usePerformanceMode();
  const reduceMotion = motionLevel === 'minimal';
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([]);
  const [autoSlots, setAutoSlots] = useState<SaveSlot[]>([]);
  
  useEffect(() => {
      const timer = setTimeout(() => setLoaded(true), reduceMotion ? 0 : 100);
      migrateLocalToIndexedDbV1().catch((error) => {
        console.warn('local->idb migration skipped', error);
      });
      return () => clearTimeout(timer);
  }, [reduceMotion]);

  const loadSaveSlots = async () => {
    const slots = await loadAllSaveSlots();
    setSaveSlots(slots.manual);
    setAutoSlots(slots.auto);
  };

  const handleLoadGame = async (slotId: number | string) => {
    const targetKey = getSaveStorageKey(slotId);
    const parsedData = await getManagedJson<any>(targetKey);
    if (!parsedData) {
        alert('未找到该存档。');
        return;
    }

    try {
        const stateToLoad = parsedData.data ? parsedData.data : parsedData;
        setIsLoadModalOpen(false);
        onStart(stateToLoad);
    } catch (error) {
        alert('存档损坏 / Save Data Corrupted');
    }
  };

  const handleOpenLoadModal = () => {
    loadSaveSlots().finally(() => {
      setIsLoadModalOpen(true);
    });
  };

  const handleQuickContinue = async () => {
    const latest = await getLatestSaveSlot();
    if (!latest) {
      handleOpenLoadModal();
      return;
    }
    onStart(latest.data as GameState);
  };

  return (
    <div className="relative w-full min-h-[100dvh] overflow-hidden bg-dungeon-black text-white font-sans selection:bg-hestia-blue-600 selection:text-white">
      
      {/* 1. Background Layer */}
      <MagicCircleBackground />

      {/* 2. Main Content Layer */}
      <div className={`relative z-10 w-full h-full min-h-[100dvh] flex flex-col items-center p-6 ${reduceMotion ? '' : 'transition-all duration-1000'} ${loaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        
        {/* Title Section - Elevated */}
        <div className="flex-1 flex flex-col justify-center items-center -mt-20">
             <GameTitle />
        </div>

        {/* Menu Section - Bottom Anchored */}
        <div className="w-full max-w-sm mb-12 md:mb-20">
            <div className="backdrop-blur-sm bg-black/40 border-t border-b border-white/10 py-6 px-8 rounded-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none"/>
                <MainMenu 
                    onNewGame={onNewGame}
                    onLoadGame={handleQuickContinue}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                />
            </div>
        </div>
      </div>
      
      {/* 3. Settings Modal (Global) */}
      <Suspense fallback={null}>
          <SettingsModal
              isOpen={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              settings={settings}
              avatarUrl={previewAvatarUrl}
              onSaveSettings={saveSettings}
              onSaveGame={() => {}}
              canSaveGame={false}
              onLoadGame={handleLoadGame}
              onUpdateAvatar={() => {}}
              onExitGame={() => setIsSettingsOpen(false)}
              gameState={previewGameState}
              onUpdateGameState={(newState) => setPreviewGameState(newState)}
          />
      </Suspense>

      {/* Load Game Modal (Inline) - Refined Style */}
      {isLoadModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-3xl glass-elite border border-white/10 shadow-2xl rounded-lg overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between bg-white/5 px-6 py-4 border-b border-white/10">
              <div className="text-xl font-display uppercase tracking-widest text-guild-gold drop-shadow-md">Select Save File</div>
              <button onClick={() => setIsLoadModalOpen(false)} className="text-zinc-400 hover:text-white transition-colors">Close</button>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">
              {/* Auto Saves */}
              <div>
                <div className="text-xs font-bold uppercase text-hestia-blue-400 border-b border-white/10 pb-2 mb-4 tracking-wider flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-hestia-blue-400 animate-pulse" />
                    Auto Records
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {autoSlots.length > 0 ? autoSlots.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => handleLoadGame(slot.id)}
                      className="group relative bg-white/5 border border-white/10 p-4 text-left hover:bg-white/10 hover:border-hestia-blue-400/50 transition-all duration-300 rounded-sm"
                    >
                      <div className="absolute top-0 left-0 w-[2px] h-full bg-hestia-blue-400/0 group-hover:bg-hestia-blue-400 transition-colors" />
                      <div className="text-xs font-bold text-hestia-blue-100 mb-1 group-hover:text-white transition-colors">AUTO #{String(slot.id).replace('auto_', '')}</div>
                      <div className="text-[10px] text-zinc-500 mb-2 font-mono">{new Date(slot.timestamp).toLocaleString()}</div>
                      <div className="text-xs text-zinc-300 truncate font-serif italic">{slot.summary || '无摘要'}</div>
                    </button>
                  )) : (
                    <div className="text-xs text-zinc-600 italic py-4">No Auto Records Found</div>
                  )}
                </div>
              </div>

              {/* Manual Saves */}
              <div>
                <div className="text-xs font-bold uppercase text-guild-gold border-b border-white/10 pb-2 mb-4 tracking-wider flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-guild-gold animate-pulse" />
                    Manual Records
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(id => {
                    const slot = saveSlots.find(s => s.id === id);
                    return (
                      <button
                        key={id}
                        disabled={!slot}
                        onClick={() => slot && handleLoadGame(id)}
                        className={`group relative border p-4 text-left transition-all duration-300 rounded-sm
                            ${slot 
                                ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-guild-gold/50 cursor-pointer' 
                                : 'bg-transparent border-white/5 text-zinc-700 cursor-not-allowed opacity-50'
                            }`}
                      >
                        {slot && <div className="absolute top-0 left-0 w-[2px] h-full bg-guild-gold/0 group-hover:bg-guild-gold transition-colors" />}
                        <div className={`text-xs font-bold mb-1 transition-colors ${slot ? 'text-guild-gold/80 group-hover:text-guild-gold' : 'text-zinc-600'}`}>SLOT {id}</div>
                        {slot ? (
                          <>
                            <div className="text-[10px] text-zinc-500 mb-2 font-mono">{new Date(slot.timestamp).toLocaleString()}</div>
                            <div className="text-xs text-zinc-300 truncate font-serif italic">{slot.summary || '无摘要'}</div>
                          </>
                        ) : (
                          <div className="text-[10px] italic">Empty Slot</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

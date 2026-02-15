import React, { useState } from 'react';
import { Globe, BookOpen, Brain } from 'lucide-react';
import { GameState, SystemSettings } from '../../../types';
import { ModalWrapper } from '../../ui/ModalWrapper';
import { DynamicWorldModal } from './DynamicWorldModal';
import { StoryModal } from './StoryModal';
import { MemoryModal } from './MemoryModal';
import Icons from '../../../utils/iconMapper';
import clsx from 'clsx';

type ArchiveTab = 'WORLD' | 'STORY' | 'MEMORY';

interface ArchivePanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  onUpdateGameState?: React.Dispatch<React.SetStateAction<GameState>>;
  onSilentWorldUpdate?: () => void;
  systemSettings?: SystemSettings;
  onUpdateSettings?: (settings: any) => void;
  initialTab?: ArchiveTab;
}

const TAB_CONFIG: { id: ArchiveTab; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'WORLD', label: '世界', icon: <Globe size={16} />, color: 'text-emerald-400' },
  { id: 'STORY', label: '剧情', icon: <BookOpen size={16} />, color: 'text-amber-400' },
  { id: 'MEMORY', label: '记忆', icon: <Brain size={16} />, color: 'text-purple-400' }
];

export const ArchivePanelModal: React.FC<ArchivePanelModalProps> = ({
  isOpen,
  onClose,
  gameState,
  onUpdateGameState,
  onSilentWorldUpdate,
  systemSettings,
  onUpdateSettings,
  initialTab = 'WORLD'
}) => {
  const [activeTab, setActiveTab] = useState<ArchiveTab>(initialTab);

  React.useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <ModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="百科档案"
      icon={<Icons.Book className="w-5 h-5 text-emerald-400" />}
      theme="guild"
      size="l"
      noBodyPadding
      className="!p-0"
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex shrink-0 bg-zinc-900/80 backdrop-blur-md border-b border-white/5">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-all relative',
                activeTab === tab.id ? tab.color : 'text-zinc-600 hover:text-zinc-300'
              )}
            >
              <span className="opacity-80">{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div
                  className={clsx(
                    'absolute bottom-0 left-[20%] right-[20%] h-[2px] rounded-full',
                    tab.id === 'WORLD'
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                      : tab.id === 'STORY'
                      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                      : 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.4)]'
                  )}
                />
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'WORLD' && (
            <div className="animate-in fade-in duration-200 h-full min-h-0">
              <DynamicWorldModal
                isOpen
                onClose={onClose}
                worldState={gameState.世界}
                gameTime={gameState.游戏时间}
                turnCount={gameState.回合数}
                onSilentWorldUpdate={onSilentWorldUpdate}
                systemSettings={systemSettings}
                onUpdateSettings={onUpdateSettings}
                embedded
              />
            </div>
          )}
          {activeTab === 'STORY' && (
            <div className="animate-in fade-in duration-200 h-full min-h-0">
              <StoryModal
                isOpen
                onClose={onClose}
                story={gameState.剧情}
                embedded
              />
            </div>
          )}
          {activeTab === 'MEMORY' && (
            <div className="animate-in fade-in duration-200 h-full min-h-0">
              <MemoryModal
                isOpen
                onClose={onClose}
                gameState={gameState}
                onUpdateGameState={onUpdateGameState}
                embedded
              />
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
};

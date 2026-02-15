
import React, { useMemo, useState, useEffect, Suspense, lazy } from 'react';
import { GameState, Difficulty, InventoryItem, Confidant } from '../types';
import { Briefcase, ClipboardList, Navigation, Smartphone } from 'lucide-react';
import { TopNav } from './game/TopNav';
import { LeftPanel } from './game/LeftPanel';
import { CenterPanel } from './game/CenterPanel';
import { RightPanel } from './game/RightPanel';
import { BottomBanner } from './game/BottomBanner';
import { MobileTopNav } from './mobile/MobileTopNav';
import { MobileBottomNav, MobileTab } from './mobile/MobileBottomNav';
import { MobileInventoryView } from './mobile/MobileInventoryView';
import { MobileMenuOverlay } from './mobile/MobileMenuOverlay';
import { MobileMapView } from './mobile/MobileMapView';
import { InventoryView } from './game/views/InventoryView';
import { CharacterView } from './game/views/CharacterView';
import { WorldView } from './game/views/WorldView';
import { MobileCharacterView } from './mobile/MobileCharacterView';


// Modals
// Consolidated Modals
const CharacterPanelModal = lazy(() => import('./game/modals/CharacterPanelModal').then(m => ({ default: m.CharacterPanelModal })));
const ArchivePanelModal = lazy(() => import('./game/modals/ArchivePanelModal').then(m => ({ default: m.ArchivePanelModal })));

const InventoryModal = lazy(() => import('./game/modals/InventoryModal').then(m => ({ default: m.InventoryModal })));
const SettingsModal = lazy(() => import('./game/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));
const SaveManagerModal = lazy(() => import('./game/modals/SaveManagerModal').then(m => ({ default: m.SaveManagerModal })));
const SocialPhoneModal = lazy(() => import('./game/modals/SocialPhoneModal').then(m => ({ default: m.SocialPhoneModal })));
const TasksModal = lazy(() => import('./game/modals/TasksModal').then(m => ({ default: m.TasksModal })));
const LootVaultModal = lazy(() => import('./game/modals/LootVaultModal').then(m => ({ default: m.LootVaultModal })));
const PresentCharactersModal = lazy(() => import('./game/modals/PresentCharactersModal').then(m => ({ default: m.PresentCharactersModal })));
const MapModal = lazy(() => import('./game/modals/MapModal').then(m => ({ default: m.MapModal })));
const NotesModal = lazy(() => import('./game/modals/NotesModal').then(m => ({ default: m.NotesModal })));
const DailyDashboardModal = lazy(() => import('./game/modals/DailyDashboardModal').then(m => ({ default: m.DailyDashboardModal })));

import { useGameLogic } from '../hooks/useGameLogic';
import { buildPreviewState } from '../utils/previewState';
import { buildPreviewCommands } from '../utils/commandPreview';
import { resolveLocationHierarchy } from '../utils/mapSystem';
import { getDefaultEquipSlot } from '../utils/itemUtils';
import { computeInventoryWeight, computeMaxCarry } from '../utils/characterMath';
import { buildPhoneStateFromTables } from '../utils/taverndb/phoneTableAdapter';
import { getNavigationPriority } from '../utils/ui/navigationPriority';

interface GameInterfaceProps {
    onExit: () => void;
    initialState?: GameState;
}

type ActiveModal =
    | 'INVENTORY'
    | 'CHARACTER_PANEL'
    | 'ARCHIVE_PANEL'
    | 'SETTINGS'
    | 'PHONE'
    | 'TASKS'
    | 'LOOT_VAULT'
    | 'PRESENT'
    | 'MAP'
    | 'NOTES'
    | 'DAILY_DASHBOARD'
    | 'SAVE_MANAGER'
    | null;

export const GameInterface: React.FC<GameInterfaceProps> = ({ onExit, initialState }) => {
  const {
      gameState, setGameState,
      settings, saveSettings,
      commandQueue, pendingCommands, addToQueue, removeFromQueue,
      currentOptions, lastAIResponse, lastAIThinking, isProcessing, isStreaming, isPhoneProcessing, phoneProcessingThreadId, phoneProcessingScope,
      draftInput, setDraftInput,
      handlePlayerAction, handlePlayerInput, handleSendMessage, handleCreateMoment, handleCreatePublicPost, handleReplyForumPost, handleLikeForumPost, handleCreateThread, handleMarkThreadRead, handleSilentWorldUpdate, handleManualForumRefresh, handleWaitForPhoneReply,
      stopInteraction, handleEditLog, handleDeleteLog, handleEditUserLog, handleUpdateLogText, handleUserRewrite,
      manualSave, loadGame, handleReroll, handleDeleteTask,
      handleEditPhoneMessage, handleDeletePhoneMessage,
      phoneNotifications,
      isMapUpdating,
      error, setError,
  } = useGameLogic(initialState, onExit);

    // View & Tab States
    const [viewMode, setViewMode] = useState<'ADVENTURE' | 'INVENTORY' | 'CHARACTER' | 'WORLD'>('ADVENTURE');
    const [activeModal, setActiveModal] = useState<ActiveModal>(null);
    const [phoneInitialTab, setPhoneInitialTab] = useState<'COMM' | 'CHAT' | 'CONTACTS' | 'MOMENTS' | 'FORUM' | 'PARTY' | 'FAMILIA'>('COMM');
    const [inventoryTab, setInventoryTab] = useState<'BACKPACK' | 'PUBLIC_LOOT' | 'LOOT_VAULT'>('BACKPACK');
    
    // New Panel Tab States
    const [characterPanelTab, setCharacterPanelTab] = useState<'STATUS' | 'EQUIP' | 'SKILLS'>('STATUS');
    const [archivePanelTab, setArchivePanelTab] = useState<'WORLD' | 'STORY' | 'MEMORY'>('WORLD');
    const [mobileActiveTab, setMobileActiveTab] = useState<MobileTab>('CHAT');
    const [settingsView, setSettingsView] = useState<string>('AI_SERVICES');

  const handleMobileTabChange = (tab: MobileTab) => {
        // Auto-close modals when switching tabs
        if (activeModal === 'PHONE' || activeModal === 'TASKS') {
            setActiveModal(null);
        }
        setMobileActiveTab(tab);
    };

    const closeModal = () => setActiveModal(null);
    const handleOpenInventory = () => { setInventoryTab('BACKPACK'); setViewMode('INVENTORY'); };
  const openCharacterPanel = (tab: 'STATUS' | 'EQUIP' | 'SKILLS' = 'STATUS') => {
      setCharacterPanelTab(tab);
      setActiveModal('CHARACTER_PANEL');
  };
  const openArchivePanel = (tab: 'WORLD' | 'STORY' | 'MEMORY' = 'WORLD') => {
      setArchivePanelTab(tab);
      setActiveModal('ARCHIVE_PANEL');
  };
  const handleOpenSocial = () => {
      setPhoneInitialTab('COMM');
      setActiveModal('PHONE');
  };
  const handleCloseView = () => setViewMode('ADVENTURE');
  const handleResetView = () => setViewMode('ADVENTURE'); // Alias for clear intent
  const openSettings = (view: string = 'AI_SERVICES') => {
      setSettingsView(view);
      setActiveModal('SETTINGS');
  };

  useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key !== 'Escape') return;
          if (activeModal) {
              closeModal();
              return;
          }
          if (mobileActiveTab === 'MORE') {
              setMobileActiveTab('CHAT');
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
      };
  }, [activeModal, mobileActiveTab]);

  // Helper to handle commands that need to update state directly (like equipping)
  const handleUpdateConfidant = (id: string, updates: Partial<Confidant>) => {
      setGameState(prev => ({
          ...prev,
          社交: prev.社交.map(c => c.id === id ? { ...c, ...updates } : c)
      }));
  };

  const queueEquipItem = (item: InventoryItem) => {
      const slotKey = getDefaultEquipSlot(item);
      addToQueue(`装备物品: ${item.名称}`, undefined, `equip_${slotKey}`, {
          kind: 'EQUIP',
          slotKey,
          itemId: item.id,
          itemName: item.名称
      });
  };

  const queueUnequipItem = (slotKey: string, itemName?: string, itemId?: string) => {
      addToQueue(`卸下装备: ${itemName || slotKey}`, undefined, `equip_${slotKey}`, {
          kind: 'UNEQUIP',
          slotKey,
          itemId,
          itemName
      });
  };

  const queueUseItem = (item: InventoryItem) => {
      addToQueue(`使用物品: ${item.名称}`, undefined, undefined, {
          kind: 'USE',
          itemId: item.id,
          itemName: item.名称,
          quantity: 1
      });
  };

  const handleUpdateSystemSettings = (newSettings: any) => {
      const mergedSettings = {
          世界更新间隔回合: 3,
          通知设置: { 新闻推送: true, 传闻更新: true, 私信通知: true, 论坛动态: true },
          订阅源: [],
          ...(gameState.系统设置 || {}),
          ...newSettings
      };
      setGameState(prev => ({
          ...prev,
          系统设置: mergedSettings
      }));
      // Persist system settings to global storage so they survive page refresh
      import('../utils/storage/storageAdapter').then(({ saveGlobalSystemSettings }) => {
          saveGlobalSystemSettings(mergedSettings).catch(err => {
              console.warn('Failed to persist system settings', err);
          });
      });
  };

  const handleEquipItem = (item: InventoryItem) => {
      queueEquipItem(item);
  };

  const isHellMode = gameState.游戏难度 === Difficulty.HELL;
  const hasMagicPhone = (gameState.背包 || []).some(item => 
      item.id === 'Itm_Phone' || 
      item.名称 === '魔石通讯终端' || 
      item.名称 === 'Magic Stone Terminal'
  );
  const combatUIEnabled = settings.enableCombatUI !== false;
  const activeCommands = isProcessing ? pendingCommands : commandQueue;
  const previewCommands = buildPreviewCommands(isProcessing, pendingCommands, commandQueue);
  const handleToggleCombatUI = () => {
      saveSettings({ ...settings, enableCombatUI: !combatUIEnabled });
  };

  const openPhone = (tab: 'COMM' | 'CHAT' | 'CONTACTS' | 'MOMENTS' | 'FORUM' = 'COMM') => {
      if (!hasMagicPhone) return;
      setPhoneInitialTab(tab);
      setActiveModal('PHONE');
  };

  useEffect(() => {
      if (!hasMagicPhone && activeModal === 'PHONE') {
          setActiveModal(null);
      }
  }, [hasMagicPhone, activeModal]);

  const handleUpdatePlayerAvatar = (url: string) => {
      setGameState(prev => ({ ...prev, 角色: { ...prev.角色, 头像: url } }));
  };

  const handleUpdateNpcAvatar = (name: string, url: string) => {
      setGameState(prev => {
          const npc = prev.社交.find(c => c.姓名 === name);
          if (!npc) return prev;
          return {
              ...prev,
              社交: prev.社交.map(c => c.id === npc.id ? { ...c, 头像: url } : c)
          };
      });
  };

  const previewState = useMemo(
      () => buildPreviewState(gameState, previewCommands as any),
      [gameState, previewCommands]
  );
  const tablePhoneState = useMemo(
      () => buildPhoneStateFromTables(gameState, {
          allowFallbackWhenEmpty: false,
          preserveLegacySocialFeeds: false
      }),
      [gameState.__tableRows]
  );
  const locationHierarchy = useMemo(
      () => resolveLocationHierarchy(gameState.地图, gameState.当前地点),
      [gameState.地图, gameState.当前地点]
  );

  const activeTaskCount = (gameState.任务 || []).filter(t => t.状态 === 'active').length;
  const unreadPhoneCount = (tablePhoneState?.对话
      ? [...(tablePhoneState?.对话?.私聊 || []), ...(tablePhoneState?.对话?.群聊 || []), ...(tablePhoneState?.对话?.公共频道 || [])]
            .reduce((sum, t) => sum + (t.未读 || 0), 0)
      : 0);
  const partyCount = (gameState.社交 || []).filter(c => c.是否队友).length + 1;
  const presentCount = (gameState.社交 || []).filter(c => c.是否在场).length;
  const inventoryWeight = computeInventoryWeight(previewState.背包 || []);
  const maxCarry = computeMaxCarry(previewState.角色);
  const lootCount = (gameState.公共战利品?.length || 0) + (gameState.战利品?.length || 0);
  const navigationPriority = getNavigationPriority({
      unreadPhoneCount,
      activeTaskCount,
      hasUrgentNews: (gameState.世界?.头条新闻 || []).some(n => n.重要度 === 'urgent')
  });

  const MobileQuickButton = ({ label, icon, onClick, badge, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; badge?: number; disabled?: boolean }) => (
      <button
          type="button"
          onClick={disabled ? undefined : onClick}
          disabled={disabled}
          className="relative flex-1 h-10 flex items-center justify-center gap-2 px-2 rounded-sm transition-all text-zinc-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed active:bg-white/5"
      >
          <span className="opacity-80">{icon}</span>
          <span className="text-[10px] font-bold tracking-wider">{label}</span>
          {typeof badge === 'number' && badge > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_5px_rgba(239,68,68,0.5)]"></span>
          )}
      </button>
  );

  const centerPanelProps = useMemo(() => ({
      logs: gameState.日志,
      combatState: gameState.战斗,
      playerStats: previewState.角色,
      skills: gameState.角色.技能,
      magic: gameState.角色.魔法,
      inventory: previewState.背包,
      confidants: gameState.社交,
      onSendMessage: handlePlayerInput,
      onReroll: handleReroll,
      lastRawResponse: lastAIResponse,
      lastThinking: lastAIThinking,
      onPlayerAction: handlePlayerAction,
      isProcessing,
      isStreaming,
      isPhoneProcessing,
      commandQueue: activeCommands,
      onRemoveCommand: isProcessing ? undefined : removeFromQueue,
      onEditLog: handleEditLog,
      onDeleteLog: handleDeleteLog,
      onEditUserLog: handleEditUserLog,
      onUpdateLogText: handleUpdateLogText,
      handleUserRewrite: handleUserRewrite,
      onStopInteraction: stopInteraction,
      draftInput,
      setDraftInput,
      actionOptions: currentOptions.length > 0 ? currentOptions : (gameState.可选行动列表 || []),
      dicePool: gameState.骰池,
      encounters: gameState.遭遇,
      logSummaries: gameState.日志摘要,
      logOutlines: gameState.日志大纲,
      fontSize: settings.fontSize,
      chatLogLimit: settings.chatLogLimit ?? 10,
      enableCombatUI: combatUIEnabled,
      enableActionLoop: settings.enableActionOptions !== false,
      isHellMode,
      onUpdatePlayerAvatar: handleUpdatePlayerAvatar,
      onUpdateNpcAvatar: handleUpdateNpcAvatar,
  }), [
      gameState.日志,
      gameState.战斗,
      gameState.角色,
      gameState.社交,
      previewState.背包,
      previewState.角色,
      lastAIResponse,
      lastAIThinking,
      isProcessing,
      isStreaming,
      isPhoneProcessing,
      activeCommands,
      handlePlayerAction,
      currentOptions,
      gameState.可选行动列表,
      draftInput,
      settings.fontSize,
      settings.chatLogLimit,
      combatUIEnabled,
      settings.enableActionOptions,
      isHellMode,
      gameState.骰池,
      gameState.遭遇,
      gameState.日志摘要,
      gameState.日志大纲,
  ]);

  return (
    <div
        data-theme={isHellMode ? 'hell' : 'default'}
        className="w-full fixed inset-0 flex flex-col bg-dungeon-black font-body text-hestia-blue-100 overflow-hidden h-[100dvh]"
        style={settings.backgroundImage ? { backgroundImage: `url(${settings.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : {}}
    >
        {/* Background Overlay Layer */}
        <div className="absolute inset-0 pointer-events-none z-0">
            {!settings.backgroundImage ? (
                <>
                    {/* Default background effects when no custom image */}
                    <div className="absolute inset-0 bg-noise opacity-30" />
                    <div className="absolute inset-0 bg-gradient-to-t from-dungeon-black/90 via-dungeon-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
                </>
            ) : (
                <>
                    {/* Light overlay for custom background to ensure text readability */}
                    <div className="absolute inset-0 bg-black/40" />
                </>
            )}
        </div>
        {phoneNotifications.length > 0 && (
            <div className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50 space-y-2 pointer-events-none">
                {phoneNotifications.map(note => (
                    <div key={note.id} className="panel-metal border border-bronze-400/50 text-hestia-blue-100 px-4 py-2 rounded shadow-lg text-xs">
                        <div className="font-bold uppercase tracking-widest text-bronze-200">{note.title}</div>
                        <div className="text-dungeon-200 mt-1">{note.message}</div>
                    </div>
                ))}
            </div>
        )}
        {/* Error Notification Banner */}
        {error && (
            <div className="absolute top-[calc(3.5rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
                <div className="panel-metal border border-red-500/50 bg-red-950/80 backdrop-blur-sm rounded-lg shadow-lg shadow-red-900/20 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-start gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-display font-bold text-red-200 text-sm tracking-wide">系统错误</span>
                            </div>
                            <p className="text-red-100/80 text-xs mt-1 leading-relaxed">{error}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setError(null)}
                            className="flex-shrink-0 p-1 rounded hover:bg-red-500/20 text-red-300 hover:text-red-100 transition-colors"
                            aria-label="Dismiss error"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        )}
        <div className="hidden lg:flex flex-col h-full w-full max-w-[1920px] mx-auto relative shadow-2xl border-x border-white/5">
            <TopNav 
                time={gameState.游戏时间} 
                location={gameState.当前地点}
                locationHierarchy={locationHierarchy}
                floor={gameState.当前楼层} 
                weather={gameState.天气} 
                coords={gameState.世界坐标}
                isHellMode={isHellMode}
                enableCombatUI={combatUIEnabled}
                onToggleCombatUI={handleToggleCombatUI}
                onManualMapUpdate={() => void handleSilentWorldUpdate()}
                isMapUpdating={isMapUpdating}

            />
            
            <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden z-10">
                <div className="contents animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <LeftPanel 
                        stats={previewState.角色} 
                        isHellMode={isHellMode} 
                        difficulty={gameState.游戏难度} 
                        onOpenPanel={openCharacterPanel}
                    />
                    
                    {viewMode === 'ADVENTURE' ? (
                        <CenterPanel {...centerPanelProps} />
                    ) : viewMode === 'INVENTORY' ? (
                        <div className="flex-1 relative overflow-hidden glass-elite rounded-lg mx-2 my-1">
                             <InventoryView 
                                items={previewState.背包} 
                                equipment={previewState.角色.装备} 
                                onEquipItem={handleEquipItem} 
                                onUnequipItem={queueUnequipItem} 
                                onUseItem={queueUseItem}
                                onClose={handleCloseView}
                                publicLoot={gameState.公共战利品}
                                lootVault={gameState.战利品}
                                initialTab={inventoryTab}
                             />
                        </div>
                    ) : viewMode === 'CHARACTER' ? (
                        <div className="flex-1 relative overflow-hidden glass-elite rounded-lg mx-2 my-1">
                             <CharacterView 
                                player={previewState.角色}
                                inventory={previewState.背包}
                                onUnequipItem={queueUnequipItem}
                                onClose={handleCloseView}
                             />
                        </div>
                    ) : viewMode === 'WORLD' ? (
                        <div className="flex-1 relative overflow-hidden glass-elite rounded-lg mx-2 my-1">
                             <WorldView 
                                worldMap={gameState.地图}
                                currentPos={gameState.世界坐标}
                                floor={gameState.当前楼层}
                                location={gameState.当前地点}
                                playerName={gameState.角色.姓名}
                                confidants={gameState.社交}
                                tasks={gameState.任务}
                                story={gameState.剧情}
                                onDeleteTask={handleDeleteTask}
                                onClose={handleCloseView}
                             />
                        </div>
                    ) : null}

                    <RightPanel 
                        viewMode={viewMode}
                        activeModal={activeModal}
                        onOpenInventory={handleOpenInventory}
                        onOpenCharacter={() => openCharacterPanel('STATUS')}
                        onOpenPhone={openPhone}
                        onOpenMap={() => setActiveModal('MAP')}
                        onOpenTasks={() => setActiveModal('TASKS')}
                        onOpenArchive={() => openArchivePanel('WORLD')}
                        onOpenSettings={() => openSettings('MAIN')}
                        onOpenSaveManager={() => setActiveModal('SAVE_MANAGER')}
                        isHellMode={isHellMode}
                        hasPhone={hasMagicPhone}
                        phoneProcessing={isPhoneProcessing}
                        summary={{
                            activeTasks: activeTaskCount,
                            unreadMessages: unreadPhoneCount,
                            unreadNews: (gameState.世界?.头条新闻 || []).filter(n => n.重要度 === 'urgent').length,
                            partySize: partyCount,
                            presentCount,
                            inventoryWeight: Math.round(inventoryWeight * 10) / 10,
                            maxCarry: Math.round(maxCarry * 10) / 10,
                            lootCount
                        }}
                        navigationPriority={navigationPriority}
                        onOpenNotes={() => setActiveModal('NOTES')}
                    />
                </div>
            </div>
            <BottomBanner isHellMode={isHellMode} announcements={gameState.世界?.头条新闻} />
        </div>

        {/* Mobile View */}
        <div className="lg:hidden flex flex-col h-full w-full overflow-x-hidden">
            <MobileTopNav
                time={gameState.游戏时间} 
                location={gameState.当前地点}
                locationHierarchy={locationHierarchy}
                floor={gameState.当前楼层} 
                weather={gameState.天气}
                coords={gameState.世界坐标}
                isHellMode={isHellMode}
                enableCombatUI={combatUIEnabled}
                onToggleCombatUI={handleToggleCombatUI}
                onManualMapUpdate={() => void handleSilentWorldUpdate()}
                isMapUpdating={isMapUpdating}
            />

            <div className="flex-1 relative overflow-hidden w-full">
                 {mobileActiveTab === 'CHAT' && (
                     <CenterPanel {...centerPanelProps} className="border-none w-full" />
                 )}
                 {mobileActiveTab === 'CHAR' && (
                     <div className="h-full w-full bg-zinc-950">
                         <MobileCharacterView 
                             stats={previewState.角色} 
                             equipment={previewState.角色.装备}
                             inventory={previewState.背包}
                             skills={previewState.角色.技能}
                             magic={previewState.角色.魔法}
                             onUnequipItem={queueUnequipItem}
                             isHellMode={isHellMode} 
                             difficulty={gameState.游戏难度} 
                         />
                     </div>
                 )}
                 {mobileActiveTab === 'MAP' && (
                     <MobileMapView
                        worldMap={gameState.地图}
                        currentPos={gameState.世界坐标}
                        floor={gameState.当前楼层}
                        location={gameState.当前地点}
                        playerName={gameState.角色.姓名}
                        confidants={gameState.社交}
                        tasks={gameState.任务}
                        story={gameState.剧情}
                        onDeleteTask={handleDeleteTask}
                        onRequestMapUpdate={(locationName) => handleSilentWorldUpdate(locationName)}
                        isMapUpdating={isMapUpdating}
                     />
                 )}
                 {mobileActiveTab === 'BACKPACK' && (
                     <MobileInventoryView
                        items={previewState.背包}
                        equipment={previewState.角色.装备}
                        onEquipItem={handleEquipItem}
                        onUnequipItem={queueUnequipItem}
                        onUseItem={queueUseItem}
                        publicLoot={gameState.公共战利品}
                        lootVault={gameState.战利品}
                        initialTab={inventoryTab}
                     />
                 )}
                 {mobileActiveTab === 'MORE' && (
                     <MobileMenuOverlay
                        isOpen={true}
                        onClose={() => {
                            setMobileActiveTab(prev => (prev === 'MORE' ? 'CHAT' : prev));
                        }}
                        hasPhone={hasMagicPhone}
                        summary={{
                            activeTasks: activeTaskCount,
                            unreadMessages: unreadPhoneCount,
                            unreadNews: (gameState.世界?.头条新闻 || []).filter(n => n.重要度 === 'urgent').length,
                            partySize: partyCount,
                            lootCount,
                        }}
                        actions={{
                            onOpenSettings: () => openSettings('MAIN'),
                            onOpenCharacterPanel: openCharacterPanel,
                            onOpenTasks: () => setActiveModal('TASKS'),
                            onOpenPhone: openPhone,
                            onOpenArchivePanel: openArchivePanel,
                            onOpenMap: () => setActiveModal('MAP'),
                            onOpenSaveManager: () => setActiveModal('SAVE_MANAGER'),
                            onOpenNotes: () => setActiveModal('NOTES'),
                        }}
                        navigationPriority={navigationPriority}
                     />
                 )}
            </div>
            <MobileBottomNav
                onTabSelect={handleMobileTabChange}
                activeTab={mobileActiveTab}
                isHellMode={isHellMode}
                unreadMessages={unreadPhoneCount}
                activeTasks={activeTaskCount}
                navigationPriority={navigationPriority}
            />
        </div>

        {/* --- Modals --- */}
        <Suspense fallback={null}>
            <InventoryModal
                isOpen={activeModal === 'INVENTORY'}
                onClose={closeModal}
                items={previewState.背包}
                equipment={previewState.角色.装备}
                onEquipItem={handleEquipItem}
                onUnequipItem={queueUnequipItem}
                onUseItem={queueUseItem}
            />

            <CharacterPanelModal
                isOpen={activeModal === 'CHARACTER_PANEL'}
                onClose={closeModal}
                stats={previewState.角色}
                equipment={previewState.角色.装备}
                inventory={previewState.背包}
                skills={gameState.角色.技能}
                magic={gameState.角色.魔法}
                onUnequipItem={queueUnequipItem}
                isHellMode={isHellMode}
                difficulty={gameState.游戏难度}
                initialTab={characterPanelTab}
            />

            <ArchivePanelModal
                isOpen={activeModal === 'ARCHIVE_PANEL'}
                onClose={closeModal}
                gameState={gameState}
                onUpdateGameState={setGameState}
                onSilentWorldUpdate={handleSilentWorldUpdate}
                systemSettings={gameState.系统设置}
                onUpdateSettings={handleUpdateSystemSettings}
                initialTab={archivePanelTab}
            />

            <SocialPhoneModal
                isOpen={activeModal === 'PHONE'}
                onClose={closeModal}
                phoneState={tablePhoneState}
                contacts={gameState.社交}
                npcTracking={gameState.世界?.NPC后台跟踪}
                playerName={gameState.角色.姓名}
                hasPhone={hasMagicPhone}
                initialTab={phoneInitialTab}
                onSendMessage={handleSendMessage}
                onEditMessage={handleEditPhoneMessage}
                onDeleteMessage={handleDeletePhoneMessage}
                onCreateThread={handleCreateThread}
                onReadThread={handleMarkThreadRead}
                onCreateMoment={(content, imageDesc) => handleCreateMoment(content, imageDesc)}
                onCreatePublicPost={(payload) => handleCreatePublicPost(payload)}
                onReplyForumPost={handleReplyForumPost}
                onLikeForumPost={handleLikeForumPost}
                onRefreshForum={handleManualForumRefresh}
                onWaitReply={handleWaitForPhoneReply}
                onUpdateConfidant={handleUpdateConfidant}
                onAddToQueue={addToQueue}
                isPhoneProcessing={isPhoneProcessing}
                phoneProcessingThreadId={phoneProcessingThreadId}
                phoneProcessingScope={phoneProcessingScope}
                systemSettings={gameState.系统设置}
                onUpdateSettings={handleUpdateSystemSettings}
                familia={gameState.眷族}
            />

        {/* Updated Tasks Modal */}
        <TasksModal 
            isOpen={activeModal === 'TASKS'} 
            onClose={closeModal} 
            tasks={gameState.任务} 
            onDeleteTask={handleDeleteTask}
        />

        <LootVaultModal
            isOpen={activeModal === 'LOOT_VAULT'}
            onClose={closeModal}
            items={gameState.战利品}
        />

        <PresentCharactersModal 
            isOpen={activeModal === 'PRESENT'} 
            onClose={closeModal} 
            characters={gameState.社交.filter(c => c.是否在场)} 
        />

        <MapModal 
            isOpen={activeModal === 'MAP'} 
            onClose={closeModal}
            worldMap={gameState.地图}
            currentPos={gameState.世界坐标}
            floor={gameState.当前楼层}
            location={gameState.当前地点}
            playerName={gameState.角色.姓名}
            confidants={gameState.社交}
            onRequestMapUpdate={(locationName) => handleSilentWorldUpdate(locationName)}
            isMapUpdating={isMapUpdating}
        />

        <NotesModal
            isOpen={activeModal === 'NOTES'}
            onClose={closeModal}
            notes={gameState.笔记}
            onUpdateNotes={(notes) => setGameState(prev => ({ ...prev, 笔记: notes }))}
        />

        <DailyDashboardModal
            isOpen={activeModal === 'DAILY_DASHBOARD'}
            onClose={closeModal}
            gameState={gameState}
            onOpenTasks={() => setActiveModal('TASKS')}
            onOpenSocial={handleOpenSocial}
        />

        <SaveManagerModal
            isOpen={activeModal === 'SAVE_MANAGER'}
            onClose={closeModal}
            gameState={gameState}
            onSaveGame={manualSave}
            onLoadGame={loadGame}
            onUpdateGameState={setGameState}
        />
        
        <SettingsModal 
            isOpen={activeModal === 'SETTINGS'} 
            onClose={closeModal} 
            settings={settings} 
            avatarUrl={gameState.角色.头像} 
            onSaveSettings={saveSettings} 
            onSaveGame={manualSave} 
            onLoadGame={loadGame} 
            onUpdateAvatar={(url) => setGameState({...gameState, 角色: {...gameState.角色, 头像: url}})} 
            onExitGame={onExit} 
            gameState={gameState} 
            onUpdateGameState={setGameState} 
            initialView={settingsView as any}
        />
        </Suspense>
    </div>
  );
};

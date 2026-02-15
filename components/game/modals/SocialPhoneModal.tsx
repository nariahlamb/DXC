
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, X, MessageCircle, Users, Send, BookUser, Camera, ChevronRight, Heart, MessageSquare, ArrowLeft, Plus, Check, Image as ImageIcon, Clock, Lock, Battery, Signal, Edit2, Trash2, Globe, Loader2, Smartphone, Settings, RefreshCw } from 'lucide-react';
import { PhoneState, PhoneThread, PhoneMessage, PhonePost, Confidant, NpcBackgroundTracking, ForumBoard, ForumPost, SystemSettings, FamiliaState } from '../../../types';
import { Swords, Crown, Shield, Backpack, Activity, Dna, Home, Package, ShieldCheck, Coins } from 'lucide-react';
import { getAvatarColor } from '../../../utils/uiUtils';
import { ModalWrapper } from '../../ui/ModalWrapper';
import clsx from 'clsx';
import { normalizeForumBoards, normalizeForumPosts } from '../../../utils/normalizers';
import { CommsHubView } from './social/CommsHubView';
import { ContactsView } from './social/ContactsView';
import { replaceUserPlaceholders, resolvePlayerName } from '../../../utils/userPlaceholder';
import { filterOutPlayerContacts, isContactNearby, isPlayerContact } from '../../../utils/social/contactPresence';

interface SocialPhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneState?: PhoneState;
  contacts: Confidant[];
  npcTracking?: NpcBackgroundTracking[];
  playerName: string;
  hasPhone?: boolean;
  initialTab?: PhoneTab;
  onSendMessage: (text: string, thread: PhoneThread) => void;
  onEditMessage?: (id: string, content: string) => void;
  onDeleteMessage?: (id: string) => void;
  onCreateThread?: (payload: { type: 'private' | 'group' | 'public'; title: string; members: string[] }) => void;
  onCreateMoment?: (content: string, imageDesc?: string) => void;
  onCreatePublicPost?: (payload: { title: string; content: string; imageDesc?: string; boardName?: string }) => void;
  onReplyForumPost?: (payload: { postId: string; content: string }) => void;
  onLikeForumPost?: (postId: string) => void;
  onRefreshForum?: () => void;
  onReadThread?: (threadId: string) => void;
  onWaitReply?: (thread: PhoneThread) => void;
  onUpdateConfidant?: (id: string, updates: Partial<Confidant>) => void;
  onAddToQueue?: (cmd: string, undoAction?: () => void, dedupeKey?: string) => void;
  isPhoneProcessing?: boolean;
  phoneProcessingThreadId?: string | null;
  phoneProcessingScope?: 'chat' | 'moment' | 'forum' | 'sync' | null;
  systemSettings?: SystemSettings;
  onUpdateSettings?: (settings: any) => void;
  familia?: FamiliaState;
}

type PhoneTab = 'COMM' | 'CHAT' | 'CONTACTS' | 'MOMENTS' | 'FORUM' | 'PARTY' | 'FAMILIA';
type ChatType = 'private' | 'group' | 'public';

const DEFAULT_PHONE: PhoneState = {
  设备: { 电量: 0, 当前信号: 0, 状态: 'offline' },
  联系人: { 好友: [], 黑名单: [], 最近: [] },
  对话: { 私聊: [], 群聊: [], 公共频道: [] },
  朋友圈: { 仅好友可见: true, 帖子: [] },
  公共帖子: { 板块: [], 帖子: [] },
  待发送: []
};

export const SocialPhoneModal: React.FC<SocialPhoneModalProps> = ({
  isOpen,
  onClose,
  phoneState,
  contacts = [],
  npcTracking = [],
  playerName,
  hasPhone = true,
  initialTab = 'COMM',
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onCreateThread,
  onCreateMoment,
  onCreatePublicPost,
  onReplyForumPost,
  onLikeForumPost,
  onRefreshForum,
  onReadThread,
  onWaitReply,
  onUpdateConfidant,
  onAddToQueue,
  isPhoneProcessing = false,
  phoneProcessingThreadId = null,
  phoneProcessingScope = null,
  systemSettings,
  onUpdateSettings,
  familia
}) => {
  const phone = phoneState || DEFAULT_PHONE;
  const resolvedPlayerName = resolvePlayerName(playerName);
  const sanitizedContacts = useMemo(
    () => filterOutPlayerContacts(contacts, resolvedPlayerName),
    [contacts, resolvedPlayerName]
  );
  const [activeTab, setActiveTab] = useState<PhoneTab>(initialTab);
  const [showSettings, setShowSettings] = useState(false);
  const [chatType, setChatType] = useState<ChatType>('private');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [pendingThreadTitle, setPendingThreadTitle] = useState<string | null>(null);
  const [viewingContact, setViewingContact] = useState<Confidant | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isStartingPrivate, setIsStartingPrivate] = useState(false);
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [inputText, setInputText] = useState('');
  const [momentText, setMomentText] = useState('');
  const [momentImage, setMomentImage] = useState('');
  const [forumTitle, setForumTitle] = useState('');
  const [forumText, setForumText] = useState('');
  const [forumImage, setForumImage] = useState('');
  const [forumBoardId, setForumBoardId] = useState('');
  const [activeForumPostId, setActiveForumPostId] = useState<string | null>(null);
  const [isCreatingForumPost, setIsCreatingForumPost] = useState(false); // New state for post creation
  const [forumReplyText, setForumReplyText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyPing, setReplyPing] = useState(false);
  const lastActiveMsgId = useRef<string | null>(null);
  const buildTrackingSummary = (entry?: NpcBackgroundTracking | null) => {
    if (!entry) return '暂无跟踪';
    const parts = [entry.当前行动];
    if (entry.进度) parts.push(`进度:${entry.进度}`);
    if (entry.预计完成) parts.push(`预计:${entry.预计完成}`);
    if (entry.位置) parts.push(`地点:${entry.位置}`);
    return parts.filter(Boolean).join(' · ');
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
  }, [isOpen, initialTab]);
  const totalUnread = useMemo(() => {
    const allThreads = [
      ...(phone.对话?.私聊 || []),
      ...(phone.对话?.群聊 || []),
      ...(phone.对话?.公共频道 || [])
    ];
    return allThreads.reduce((sum, t) => sum + (t.未读 || 0), 0);
  }, [phoneState]);

  const getThreadList = (type: ChatType) => {
    if (type === 'private') return phone.对话?.私聊 || [];
    if (type === 'group') return phone.对话?.群聊 || [];
    return phone.对话?.公共频道 || [];
  };

  const getThreadSortValue = (thread: PhoneThread) => {
    const messages = Array.isArray(thread.消息) ? thread.消息 : [];
    if (messages.length === 0) return 0;
    const last = messages[messages.length - 1];
    return typeof last.timestampValue === 'number' ? last.timestampValue : 0;
  };

  const sortedThreads = useMemo(() => {
    const list = getThreadList(chatType);
    return [...list].sort((a, b) => getThreadSortValue(b) - getThreadSortValue(a));
  }, [phoneState, chatType]);

  const activeThread = useMemo(() => {
    if (!activeThreadId) return null;
    return getThreadList(chatType).find(t => t.id === activeThreadId) || null;
  }, [activeThreadId, chatType, phoneState]);

  const focusContacts = useMemo(() => {
    return sanitizedContacts.filter(c => c.特别关注 || c.是否队友).slice(0, 6);
  }, [sanitizedContacts]);

  const commThreads = useMemo(() => {
    const all: Array<{ thread: PhoneThread; type: ChatType }> = [];
    (phone.对话?.私聊 || []).forEach(t => all.push({ thread: t, type: 'private' }));
    (phone.对话?.群聊 || []).forEach(t => all.push({ thread: t, type: 'group' }));
    (phone.对话?.公共频道 || []).forEach(t => all.push({ thread: t, type: 'public' }));
    return all.sort((a, b) => getThreadSortValue(b.thread) - getThreadSortValue(a.thread)).slice(0, 6);
  }, [phoneState]);

  const commThreadItems = useMemo(() => {
    return commThreads.map(({ thread, type }) => ({
      id: thread.id,
      title: thread.标题,
      preview: getThreadPreview(thread),
      unread: thread.未读,
      type
    }));
  }, [commThreads]);

  const showPhoneProcessing = !!isPhoneProcessing;
  const isForumProcessing = showPhoneProcessing && phoneProcessingScope === 'forum';
  const isForumRefreshBlocked = showPhoneProcessing;
  const isActiveThreadProcessing = showPhoneProcessing
    && phoneProcessingScope === 'chat'
    && !!activeThread
    && activeThread.id === phoneProcessingThreadId;
  const processingLabel = useMemo(() => {
    if (!showPhoneProcessing) return '';
    if (phoneProcessingScope === 'moment') return '动态已提交，AI处理中…';
    if (phoneProcessingScope === 'forum') return '帖子已提交，AI处理中…';
    if (phoneProcessingScope === 'sync') return '剧情联动处理中…';
    if (phoneProcessingScope === 'chat') {
      return isActiveThreadProcessing ? '已提交消息，等待AI回复…' : 'AI正在处理手机消息…';
    }
    return 'AI处理中…';
  }, [showPhoneProcessing, phoneProcessingScope, isActiveThreadProcessing]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setChatType('private');
      setActiveThreadId(null);
      setViewingContact(null);
      setIsCreatingGroup(false);
      setIsStartingPrivate(false);
      setEditingMessageId(null);
      setForumTitle('');
      setForumText('');
      setForumImage('');
      setForumBoardId('');
      setActiveForumPostId(null);
      setForumReplyText('');
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (activeThreadId && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThreadId, phoneState]);

  useEffect(() => {
    if (!activeThread) return;
    const msgs = Array.isArray(activeThread.消息) ? activeThread.消息 : [];
    const lastMsg = msgs[msgs.length - 1];
    const isMe = lastMsg?.发送者 === playerName || lastMsg?.发送者 === '玩家' || lastMsg?.发送者 === 'Player';
    if (lastMsg?.id && lastActiveMsgId.current && lastMsg.id !== lastActiveMsgId.current && !isMe) {
      setReplyPing(true);
      setTimeout(() => setReplyPing(false), 2200);
    }
    if (lastMsg?.id && lastMsg.id !== lastActiveMsgId.current) {
      lastActiveMsgId.current = lastMsg.id;
    }
    const hasUnread = (activeThread.未读 || 0) > 0 || msgs.some(msg => msg.状态 === 'received');
    if (hasUnread) {
      onReadThread?.(activeThread.id);
    }
  }, [activeThread?.id, activeThread?.未读, activeThread?.消息?.length, playerName, onReadThread]);

  const phoneLocked = !hasPhone;
  const batteryValue = typeof phone.设备?.电量 === 'number' ? Math.max(0, Math.min(100, phone.设备.电量)) : null;
  const signalValue = typeof phone.设备?.当前信号 === 'number' ? Math.max(0, Math.min(4, phone.设备.当前信号)) : null;
  const batteryColor = batteryValue === null ? 'text-zinc-500' : batteryValue <= 10 ? 'text-red-500' : batteryValue <= 30 ? 'text-yellow-500' : 'text-emerald-500';
  const signalColor = signalValue === null ? 'text-zinc-500' : signalValue <= 1 ? 'text-red-500' : signalValue <= 2 ? 'text-yellow-500' : 'text-emerald-500';

  const validContacts = sanitizedContacts.filter(c => c.已交换联系方式 || c.特别关注 || isContactNearby(c));
  // "关注的人": 用户手动标记为特别关注的NPC
  const specialContacts = useMemo(() => sanitizedContacts.filter(c => c.特别关注), [sanitizedContacts]);
  // "周围的人": 当前在场的NPC (且不在特别关注列表中)
  const nearbyContacts = useMemo(() => sanitizedContacts.filter(c => isContactNearby(c) && !c.特别关注), [sanitizedContacts]);
  const friends = Array.isArray(phone.联系人?.好友) ? phone.联系人.好友 : [];
  const friendSet = new Set(friends);

  useEffect(() => {
    if (!viewingContact) return;
    if (isPlayerContact(viewingContact, resolvedPlayerName)) {
      setViewingContact(null);
    }
  }, [viewingContact, resolvedPlayerName]);

  useEffect(() => {
    if (!pendingThreadTitle) return;
    const list = getThreadList(chatType);
    const found = list.find(t => t.标题 === pendingThreadTitle);
    if (found) {
      setActiveThreadId(found.id);
      setPendingThreadTitle(null);
    }
  }, [phoneState, pendingThreadTitle, chatType]);


  const formatDay = (timestamp?: string) => {
    if (!timestamp) return '';
    const match = timestamp.match(/第\d+日/);
    return match ? match[0] : '';
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '??:??';
    const match = timestamp.match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : timestamp;
  };

  const normalizeMemoryEntry = (entry: any) => {
    if (typeof entry === 'string') {
      return { content: entry, timestamp: '' };
    }
    if (entry && typeof entry === 'object') {
      const content = typeof entry.内容 === 'string'
        ? entry.内容
        : (typeof entry.content === 'string' ? entry.content : '');
      const timestamp = typeof entry.时间戳 === 'string'
        ? entry.时间戳
        : (typeof entry.timestamp === 'string' ? entry.timestamp : '');
      return { content, timestamp };
    }
    return { content: String(entry ?? ''), timestamp: '' };
  };

  const handleTabChange = (tab: PhoneTab) => {
    if (phoneLocked) return;
    setActiveTab(tab);
    setActiveThreadId(null);
    setViewingContact(null);
    setIsCreatingGroup(false);
    setIsStartingPrivate(false);
    setActiveForumPostId(null);
    setIsCreatingForumPost(false); // Reset creation state
    setForumReplyText('');
  };

  const handleToggleAttention = (c: Confidant) => {
    if (!onUpdateConfidant) return;
    const isNowSpecial = !c.特别关注;
    onUpdateConfidant(c.id, { 特别关注: isNowSpecial });
    const cmd = isNowSpecial
      ? `设置 [${c.姓名}] 为特别关注对象，AI补全完整信息。`
      : `取消 [${c.姓名}] 的特别关注`;
    onAddToQueue?.(cmd, () => onUpdateConfidant(c.id, { 特别关注: !isNowSpecial }), `toggle_special_${c.id}`);
  };

  const handleToggleParty = (c: Confidant) => {
    if (!onUpdateConfidant) return;
    const isNowParty = !c.是否队友;
    onUpdateConfidant(c.id, { 是否队友: isNowParty });
    const cmd = isNowParty
      ? `邀请 [${c.姓名}] 加入队伍。`
      : `将 [${c.姓名}] 移出队伍。`;
    onAddToQueue?.(cmd, () => onUpdateConfidant(c.id, { 是否队友: !isNowParty }), `toggle_party_${c.id}`);
  };

  const handleToggleExclude = (c: Confidant) => {
    if (!onUpdateConfidant) return;
    onUpdateConfidant(c.id, { 排除提示词: !c.排除提示词 });
  };

  const openThreadByTitle = (type: ChatType, title: string, members: string[]) => {
    const existing = getThreadList(type).find(t => t.标题 === title);
    if (existing) {
      setChatType(type);
      setActiveThreadId(existing.id);
      return;
    }
    if (onCreateThread) {
      onCreateThread({ type, title, members });
      setChatType(type);
      setPendingThreadTitle(title);
    }
  };

  const handleOpenCommsThread = (id: string, type: ChatType) => {
    setChatType(type);
    setActiveThreadId(id);
    setActiveTab('CHAT');
    onReadThread?.(id);
  };

  const handleSelectContactFromComms = (contact: Confidant) => {
    setViewingContact(contact);
    setActiveTab('CONTACTS');
  };

  const handleSend = () => {
    if (!activeThread || !inputText.trim()) return;
    if (editingMessageId && onEditMessage) {
      onEditMessage(editingMessageId, inputText.trim());
      setEditingMessageId(null);
      setInputText('');
      return;
    }
    onSendMessage(inputText.trim(), activeThread);
    setInputText('');
  };

  const handleStartEdit = (msg: PhoneMessage) => {
    if (!onEditMessage) return;
    setEditingMessageId(msg.id);
    setInputText(msg.内容 || '');
  };

  const handleDelete = (msg: PhoneMessage) => {
    if (!onDeleteMessage) return;
    if (window.confirm('确定要删除这条消息吗？')) onDeleteMessage(msg.id);
  };

  const toggleGroupMember = (name: string) => {
    if (newGroupMembers.includes(name)) {
      setNewGroupMembers(newGroupMembers.filter(n => n !== name));
    } else {
      setNewGroupMembers([...newGroupMembers, name]);
    }
  };

  const submitNewGroup = () => {
    if (!newGroupName.trim() || newGroupMembers.length < 2) {
      alert('需要群组名称且至少2名成员。');
      return;
    }
    const members = [playerName, ...newGroupMembers];
    openThreadByTitle('group', newGroupName.trim(), members);
    setIsCreatingGroup(false);
    setNewGroupMembers([]);
    setNewGroupName('');
  };

  const handleCreateMoment = () => {
    if (!momentText.trim()) return;
    onCreateMoment?.(momentText.trim(), momentImage.trim() || undefined);
    setMomentText('');
    setMomentImage('');
  };

  const handleCreateForumPost = () => {
    if (!forumText.trim()) return;
    const boardName = forumBoards.find(b => b.id === forumBoardId)?.名称 || forumBoards[0]?.名称;
    const title = forumTitle.trim() || forumText.trim().slice(0, 20);
    onCreatePublicPost?.({
      title,
      content: forumText.trim(),
      imageDesc: forumImage.trim() || undefined,
      boardName
    });
    setForumTitle('');
    setForumText('');
    setForumImage('');
    setIsCreatingForumPost(false); // Close creation modal
  };

  const handleReplyForumPost = () => {
    if (!activeForumPost || !forumReplyText.trim()) return;
    onReplyForumPost?.({ postId: activeForumPost.id, content: forumReplyText.trim() });
    setForumReplyText('');
  };

  const messages = useMemo(() => {
    if (!activeThread) return [] as PhoneMessage[];
    const list = Array.isArray(activeThread.消息) ? activeThread.消息 : [];
    const sorted = [...list].sort((a, b) => {
      if (typeof a.timestampValue === 'number' && typeof b.timestampValue === 'number') return a.timestampValue - b.timestampValue;
      return 0;
    });
    const seen = new Set<string>();
    const deduped: PhoneMessage[] = [];
    sorted.forEach(msg => {
      const idKey = typeof msg.id === 'string' ? msg.id.trim() : '';
      const signature = `${msg.发送者 || ''}|${msg.内容 || ''}|${msg.图片描述 || ''}|${msg.时间戳 || ''}`;
      const key = idKey || signature;
      if (!key || seen.has(key)) return;
      seen.add(key);
      deduped.push(msg);
    });
    return deduped.slice(-120);
  }, [activeThread]);

  const visibleMoments = useMemo(() => {
    const posts = Array.isArray(phone.朋友圈?.帖子) ? phone.朋友圈.帖子 : [];
    if (!phone.朋友圈?.仅好友可见) return posts;
    return posts.filter(p => p.发布者 === playerName || friendSet.has(p.发布者));
  }, [phoneState, playerName]);

  const forumBoards = useMemo(() => normalizeForumBoards(phone.公共帖子?.板块), [phoneState]);

  useEffect(() => {
    if (forumBoardId || forumBoards.length === 0) return;
    setForumBoardId(forumBoards[0].id);
  }, [forumBoards, forumBoardId]);
  const publicPosts = useMemo(() => {
    const posts = normalizeForumPosts(phone.公共帖子?.帖子, forumBoards);
    return [...posts].sort((a, b) => (b.timestampValue || 0) - (a.timestampValue || 0));
  }, [phoneState, forumBoards]);
  const forumPreview = useMemo(() => publicPosts.slice(0, 3), [publicPosts]);
  const activeForumPost = useMemo(() => {
    if (!activeForumPostId) return null;
    return publicPosts.find(post => post.id === activeForumPostId) || null;
  }, [publicPosts, activeForumPostId]);
  const activeForumBoard = useMemo(() => forumBoards.find(b => b.id === forumBoardId) || null, [forumBoards, forumBoardId]);
  const visibleForumPosts = useMemo(() => {
    if (!activeForumBoard) return publicPosts;
    return publicPosts.filter(post => post.板块 === activeForumBoard.名称);
  }, [publicPosts, activeForumBoard]);

  if (!isOpen) return null;

  const TitleWithStatus = () => (
      <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span>智能终端</span>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-mono text-zinc-500 ml-4">
              <div className={`flex items-center gap-1 ${batteryColor}`}>
                <Battery size={12} />
                <span>{batteryValue === null ? '??' : `${batteryValue}%`}</span>
              </div>
              <div className={`flex items-center gap-1 ${signalColor}`}>
                <Signal size={12} />
                <span>{signalValue === null ? '??' : `${signalValue}/4`}</span>
              </div>
            </div>
          </div>
          {activeThread && onWaitReply && (
              <button onClick={() => onWaitReply(activeThread)} title="等待回复" className="text-[10px] text-blue-400 flex items-center gap-1 mt-1 hover:text-blue-300">
                <Clock size={10} /> 等待对方回复
              </button>
          )}
      </div>
  );

  return (
    <ModalWrapper
        isOpen={isOpen}
        onClose={onClose}
        title={<TitleWithStatus />}
        icon={<Smartphone className="w-5 h-5 text-blue-400" />}
        theme="social"
        size="s"
        className="!p-0"
        noBodyPadding={true}
        bodyClassName="!overflow-hidden"
    >
        <div className="h-full min-h-0 bg-transparent relative overflow-hidden flex flex-col">
        {/* Navigation Bar */}
        {!viewingContact && !isCreatingGroup && !isStartingPrivate && (
          <div className="sticky top-0 flex w-full bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800/50 shrink-0 z-30">
            <PhoneTabBtn icon={<Users size={18} />} label="通讯" active={activeTab === 'COMM'} onClick={() => handleTabChange('COMM')} />
            <PhoneTabBtn icon={<MessageCircle size={18} />} label="消息" active={activeTab === 'CHAT'} onClick={() => handleTabChange('CHAT')} />
            <PhoneTabBtn icon={<BookUser size={18} />} label="联系人" active={activeTab === 'CONTACTS'} onClick={() => handleTabChange('CONTACTS')} />
            <PhoneTabBtn icon={<Camera size={18} />} label="动态" active={activeTab === 'MOMENTS'} onClick={() => handleTabChange('MOMENTS')} />
            <PhoneTabBtn icon={<Globe size={18} />} label="论坛" active={activeTab === 'FORUM'} onClick={() => handleTabChange('FORUM')} />
            <PhoneTabBtn icon={<Swords size={18} />} label="队伍" active={activeTab === 'PARTY'} onClick={() => handleTabChange('PARTY')} />
            <PhoneTabBtn icon={<Crown size={18} />} label="眷族" active={activeTab === 'FAMILIA'} onClick={() => handleTabChange('FAMILIA')} />
          </div>
        )}

        {/* Sub-Header / Breadcrumbs */}
        {(viewingContact || isCreatingGroup || isStartingPrivate) && (
            <div className="sticky top-0 bg-zinc-800/50 backdrop-blur-md px-4 py-2 border-b border-zinc-700/50 flex items-center gap-2 z-30 shrink-0">
                  {viewingContact ? (
                    <>
                        <button onClick={() => setViewingContact(null)} className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white transition-colors">
                            <ArrowLeft size={14} /> {activeTab === 'PARTY' ? '返回队伍' : '返回联系人'}
                        </button>
                    </>
                  ) : isCreatingGroup ? (
                    <>
                        <button onClick={() => setIsCreatingGroup(false)} className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white transition-colors">
                            <ArrowLeft size={14} /> 取消创建
                        </button>
                    </>
                  ) : isStartingPrivate ? (
                    <>
                        <button onClick={() => setIsStartingPrivate(false)} className="flex items-center gap-1 text-xs font-bold text-zinc-400 hover:text-white transition-colors">
                            <ArrowLeft size={14} /> 取消选择
                        </button>
                    </>
                  ) : null}
            </div>
        )}
          {phoneLocked && (
            <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-md text-white flex flex-col items-center justify-center gap-4 p-6 text-center animate-in fade-in">
              <Lock size={36} className="text-red-500" />
              <div className="text-lg font-display uppercase tracking-widest text-red-500">终端访问受限</div>
              <div className="text-xs text-zinc-400 leading-relaxed font-mono">
                [SYSTEM ERROR] Hardware not found.
                <br/>
                Please insert "Magic Stone Terminal".
              </div>
            </div>
          )}

          {showPhoneProcessing && (
            <div className="px-3 py-2 bg-blue-900/20 text-blue-300 text-[10px] font-bold uppercase tracking-widest border-b border-blue-500/30 flex items-center gap-2 backdrop-blur-sm sticky top-0 z-30">
              <Loader2 size={12} className="animate-spin" />
              <span className="truncate">{processingLabel}</span>
            </div>
          )}

          {activeTab === 'COMM' && (
            <CommsHubView
              following={specialContacts}
              nearby={nearbyContacts}
              onToggleAttention={handleToggleAttention}
              threadItems={commThreadItems}
              forumPreview={forumPreview}
              forumBoards={forumBoards}
              allForumPosts={publicPosts}
              onOpenThread={handleOpenCommsThread}
              onSelectContact={handleSelectContactFromComms}
              onOpenForum={() => handleTabChange('FORUM')}
              onOpenBoard={(boardId) => {
                setForumBoardId(boardId);
                handleTabChange('FORUM');
              }}
              onOpenForumPost={(postId) => { setActiveForumPostId(postId); setActiveTab('FORUM'); }}
            />
          )}

          {activeTab === 'CHAT' && (
            isStartingPrivate ? (
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="text-[10px] text-zinc-500 font-bold uppercase mb-2">选择联系人</div>
                <div className="space-y-2">
                  {validContacts.length > 0 ? validContacts.map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setIsStartingPrivate(false);
                        openThreadByTitle('private', c.姓名, [playerName, c.姓名]);
                      }}
                      className="flex items-center gap-3 p-3 border border-zinc-800 rounded cursor-pointer transition-all bg-zinc-900/50 hover:border-blue-500/50 hover:bg-zinc-800"
                    >
                      <div className={`w-8 h-8 flex items-center justify-center text-white text-xs font-bold rounded-full ${getAvatarColor(c.姓名)}`}>
                        {c.姓名[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate text-zinc-200">{c.姓名}</div>
                        <div className="text-[10px] text-zinc-500">{c.眷族 || '无眷族'}</div>
                      </div>
                      {friendSet.has(c.姓名) && <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-900/50">好友</span>}
                    </div>
                  )) : <EmptyState icon={<MessageCircle size={40} />} text="暂无联系人" />}
                </div>
              </div>
            ) : isCreatingGroup ? (
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <input
                  type="text"
                  placeholder="群组名称..."
                  className="w-full p-2 mb-4 border-b border-blue-500 bg-transparent text-xl font-bold outline-none text-white placeholder:text-zinc-600"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                />
                <p className="text-xs text-zinc-500 mb-2 uppercase font-bold">选择成员 ({newGroupMembers.length})</p>
                <div className="space-y-2">
                  {validContacts.map(c => (
                    <div
                      key={c.id}
                      onClick={() => toggleGroupMember(c.姓名)}
                      className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-all ${newGroupMembers.includes(c.姓名) ? 'bg-blue-900/20 border-blue-500/50' : 'bg-zinc-900/50 border-zinc-800'}`}
                    >
                      <div className={`w-8 h-8 flex items-center justify-center text-white text-xs font-bold rounded-full ${newGroupMembers.includes(c.姓名) ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                        {c.姓名[0]}
                      </div>
                      <span className="font-bold text-sm text-zinc-300">{c.姓名}</span>
                      {newGroupMembers.includes(c.姓名) && <Check size={16} className="ml-auto text-blue-400" />}
                    </div>
                  ))}
                </div>
                <button
                  onClick={submitNewGroup}
                  className="mt-6 w-full bg-blue-600 text-white py-3 font-bold uppercase hover:bg-blue-500 transition-colors text-sm rounded"
                >
                  创建群聊
                </button>
              </div>
            ) : activeThread ? (
              <div className="flex-1 flex flex-col bg-transparent relative overflow-hidden">
                <div className="sticky top-0 bg-zinc-900/90 backdrop-blur px-4 py-3 border-b border-zinc-800 z-20 flex items-center gap-3 shrink-0">
                  <button onClick={() => setActiveThreadId(null)} className="text-zinc-400 hover:text-white transition-colors">
                    <ArrowLeft size={16} />
                  </button>
                  <span className="truncate font-bold text-sm text-zinc-100">{activeThread.标题}</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                  {replyPing && (
                    <div className="flex justify-center">
                      <div className="px-3 py-1 text-[10px] bg-blue-600/80 text-white rounded-full shadow-lg backdrop-blur-sm animate-pulse">
                        收到新回复
                      </div>
                    </div>
                  )}
                {messages.length === 0 ? (
                  <div className="text-center text-zinc-600 text-xs italic mt-10">暂无消息记录</div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.发送者 === playerName || msg.发送者 === '玩家' || msg.发送者 === 'Player';
                    const dayLabel = formatDay(msg.时间戳);
                    const timeLabel = formatTime(msg.时间戳);
                    const showDay = dayLabel && (idx === 0 || dayLabel !== formatDay(messages[idx - 1]?.时间戳));
                    const isSystem = msg.类型 === 'system' || msg.发送者 === '系统';
                    return (
                      <React.Fragment key={`${msg.id}_${idx}`}>
                        {showDay && (
                          <div className="text-center text-[10px] text-zinc-600 font-mono uppercase py-2">
                            {dayLabel}
                          </div>
                        )}
                        {isSystem ? (
                          <div className="text-center my-2">
                            <div className="inline-block bg-zinc-800/50 border border-zinc-700 text-zinc-400 text-[10px] px-3 py-1 rounded-full backdrop-blur-sm">
                              {replaceUserPlaceholders(msg.内容 || '', resolvedPlayerName)}
                            </div>
                          </div>
                        ) : (
                          <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] px-3 py-2 text-[13px] leading-relaxed shadow-lg relative backdrop-blur-sm ${isMe ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-2xl rounded-br-sm' : 'bg-zinc-800/40 border border-zinc-700/50 text-zinc-200 rounded-2xl rounded-bl-sm'}`}>
                              {!isMe && activeThread.类型 !== 'private' && (
                                <div className="font-bold text-[9px] text-blue-400 mb-1 uppercase tracking-wider">{msg.发送者}</div>
                              )}
                              {msg.引用?.内容 && (
                                <div className="text-[10px] border-l-2 border-zinc-600 pl-2 mb-1 text-zinc-500 italic">
                                  {msg.引用.发送者 ? `${msg.引用.发送者}: ` : ''}{msg.引用.内容}
                                </div>
                              )}
                              <div className="whitespace-pre-wrap break-words">{replaceUserPlaceholders(msg.内容 || '', resolvedPlayerName)}</div>
                              {msg.图片描述 && (
                                <div className="mt-2 w-full h-24 bg-black/40 flex flex-col items-center justify-center text-zinc-500 border border-zinc-700/50 rounded-lg">
                                  <ImageIcon size={18} className="mb-1 text-zinc-600" />
                                  <span className="text-[10px] px-2 text-center text-zinc-600">{msg.图片描述}</span>
                                </div>
                              )}
                              <div className={`mt-1 text-[9px] ${isMe ? 'text-blue-300/50' : 'text-zinc-600'} font-mono text-right`}>
                                {isMe && msg.状态 === 'failed' && <span className="text-red-400/80 mr-2">发送失败</span>}
                                {isMe && msg.状态 === 'pending' && <span className="text-blue-400/50 mr-2 animate-pulse">发送中</span>}
                                {isMe && msg.状态 === 'read' && <span className="text-blue-400/50 mr-2">已读</span>}
                                {timeLabel}
                              </div>
                              {isMe && (onEditMessage || onDeleteMessage) && (
                                <div className="mt-1 flex justify-end gap-2 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity">
                                  {onEditMessage && (
                                    <button type="button" onClick={() => handleStartEdit(msg)} className="flex items-center gap-1 text-zinc-500 hover:text-white">
                                      <Edit2 size={10} />
                                    </button>
                                  )}
                                  {onDeleteMessage && (
                                    <button type="button" onClick={() => handleDelete(msg)} className="flex items-center gap-1 text-zinc-500 hover:text-red-400">
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="flex border-b border-zinc-800">
                  <button
                    onClick={() => setChatType('private')}
                    className={`flex-1 py-2 text-xs font-bold uppercase transition-colors ${chatType === 'private' ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                  >
                    私聊
                  </button>
                  <button
                    onClick={() => setChatType('group')}
                    className={`flex-1 py-2 text-xs font-bold uppercase transition-colors ${chatType === 'group' ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                  >
                    群聊
                  </button>
                  <button
                    onClick={() => setChatType('public')}
                    className={`flex-1 py-2 text-xs font-bold uppercase transition-colors ${chatType === 'public' ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500' : 'text-zinc-600 hover:text-zinc-400'}`}
                  >
                    公共
                  </button>
                </div>

                {totalUnread > 0 && (
                  <div className="px-4 py-2 bg-blue-900/20 text-blue-300 text-[10px] font-bold uppercase tracking-widest border-b border-blue-500/20">
                    有 {totalUnread} 条未读消息
                  </div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                  {chatType === 'private' && (
                    <div className="space-y-px">
                      <div
                        onClick={() => setIsStartingPrivate(true)}
                        className="p-3 bg-zinc-900/30 border-b border-zinc-800 flex items-center justify-center text-blue-400 font-bold gap-2 cursor-pointer hover:bg-blue-900/20 text-xs transition-colors"
                      >
                        <Plus size={16} /> 发起私聊
                      </div>
                      {sortedThreads.length > 0 ? sortedThreads.map(thread => (
                        <ChatRow
                          key={thread.id}
                          name={thread.标题}
                          lastMsg={getThreadPreview(thread)}
                          avatar={thread.标题}
                          unread={thread.未读}
                          onClick={() => { setActiveThreadId(thread.id); setChatType('private'); onReadThread?.(thread.id); }}
                        />
                      )) : <EmptyState icon={<MessageCircle size={32} />} text="无私聊消息" />}
                    </div>
                  )}

                  {chatType === 'group' && (
                    <div className="space-y-px">
                      <div
                        onClick={() => setIsCreatingGroup(true)}
                        className="p-3 bg-zinc-900/30 border-b border-zinc-800 flex items-center justify-center text-blue-400 font-bold gap-2 cursor-pointer hover:bg-blue-900/20 text-xs transition-colors"
                      >
                        <Plus size={16} /> 创建新群聊
                      </div>
                      {sortedThreads.length > 0 ? sortedThreads.map(thread => (
                        <ChatRow
                          key={thread.id}
                          name={thread.标题}
                          lastMsg={getThreadPreview(thread)}
                          isGroup
                          unread={thread.未读}
                          onClick={() => { setActiveThreadId(thread.id); setChatType('group'); onReadThread?.(thread.id); }}
                        />
                      )) : <EmptyState icon={<Users size={32} />} text="暂无群组" />}
                    </div>
                  )}

                  {chatType === 'public' && (
                    <div className="space-y-px">
                      {sortedThreads.length > 0 ? sortedThreads.map(thread => (
                        <ChatRow
                          key={thread.id}
                          name={thread.标题}
                          lastMsg={getThreadPreview(thread)}
                          isGroup
                          unread={thread.未读}
                          onClick={() => { setActiveThreadId(thread.id); setChatType('public'); onReadThread?.(thread.id); }}
                        />
                      )) : <EmptyState icon={<Globe size={32} />} text="暂无公共频道" />}
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {activeTab === 'CONTACTS' && (
            viewingContact ? (
              <div className="flex-1 overflow-hidden bg-[#0a0a0f] px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-xl font-bold text-white ${getAvatarColor(viewingContact.姓名)}`}>
                    {viewingContact.姓名[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-display text-zinc-100 truncate">{viewingContact.姓名}</div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {viewingContact.身份 || '未知'} · {viewingContact.眷族 || '无眷族'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setViewingContact(null);
                      setActiveTab('CHAT');
                      openThreadByTitle('private', viewingContact.姓名, [playerName, viewingContact.姓名]);
                    }}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border border-blue-500/60 text-blue-300 hover:text-white hover:bg-blue-600/20 transition-colors"
                  >
                    私信
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionButton
                    active={!!viewingContact.特别关注}
                    onClick={() => handleToggleAttention(viewingContact)}
                    label={viewingContact.特别关注 ? '特别关注中' : '特别关注'}
                    colorClass={
                      viewingContact.特别关注 
                        ? "text-pink-300 border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.15)]"
                        : "text-zinc-400 border-zinc-500/30 bg-zinc-500/5 hover:bg-zinc-500/10 hover:text-zinc-300"
                    }
                    disabled={!onUpdateConfidant}
                  />
                  <ActionButton
                    active={!!viewingContact.是否队友}
                    onClick={() => handleToggleParty(viewingContact)}
                    label={viewingContact.是否队友 ? '队伍中' : '邀请入队'}
                    colorClass="text-indigo-400 border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20"
                    disabled={!onUpdateConfidant}
                  />
                  <ActionButton
                    active={!!viewingContact.排除提示词}
                    onClick={() => handleToggleExclude(viewingContact)}
                    label={viewingContact.排除提示词 ? '已屏蔽' : '屏蔽AI'}
                    colorClass="text-red-400 border-red-500/50 bg-red-500/10 hover:bg-red-500/20"
                    disabled={!onUpdateConfidant}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <InfoBlock label="等级" content={`Lv.${viewingContact.等级 ?? 1}`} />
                  <InfoBlock label="身份" content={viewingContact.身份 || '未知'} />
                  <InfoBlock label="眷族" content={viewingContact.眷族 || '无眷族'} />
                  <InfoBlock label="好感度" content={`${viewingContact.好感度 ?? 0}`} />
                  <InfoBlock className="col-span-2" label="位置" content={viewingContact.位置详情 || (viewingContact.坐标 ? `坐标 ${Math.round(viewingContact.坐标.x)}, ${Math.round(viewingContact.坐标.y)}` : '未知')} />
                  <InfoBlock className="col-span-2" label="后台跟踪" content={buildTrackingSummary(npcTracking.find(t => t.NPC === viewingContact.姓名))} />
                </div>

                {viewingContact.生存数值 && (
                  <div className="mt-3 space-y-1.5">
                    <PhoneStatBar label="HP" current={viewingContact.生存数值.当前生命 || 0} max={viewingContact.生存数值.最大生命 || 100} color="bg-emerald-500" />
                    <PhoneStatBar label="MP" current={viewingContact.生存数值.当前精神 || 0} max={viewingContact.生存数值.最大精神 || 50} color="bg-purple-500" />
                    <PhoneStatBar label="SP" current={viewingContact.生存数值.当前体力 || 0} max={viewingContact.生存数值.最大体力 || 100} color="bg-amber-500" />
                  </div>
                )}

                {viewingContact.装备 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                    {viewingContact.装备.主手 && <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-300 truncate max-w-[160px]">⚔ 主手: {viewingContact.装备.主手}</span>}
                    {viewingContact.装备.副手 && <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-300 truncate max-w-[160px]">🛡 副手: {viewingContact.装备.副手}</span>}
                    {viewingContact.装备.身体 && <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-300 truncate max-w-[160px]">🧥 身体: {viewingContact.装备.身体}</span>}
                  </div>
                )}

                {viewingContact.记忆 && viewingContact.记忆.length > 0 && (
                  <div className="mt-5 border-t border-zinc-800/50 pt-3">
                    <div className="flex items-center gap-2 mb-2 text-pink-400 font-bold text-xs uppercase tracking-widest bg-pink-500/5 p-1.5 rounded w-fit border border-pink-500/20">
                      <Sparkles size={12} className="text-pink-400" />
                      <span>交互回忆 ({viewingContact.记忆.length})</span>
                    </div>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1 bg-zinc-900/20 p-2 rounded-lg border border-zinc-800/30">
                      {[...viewingContact.记忆].reverse().map((mem, idx) => {
                        const normalized = normalizeMemoryEntry(mem);
                        return (
                        <div key={idx} className="bg-[#0c0c10]/80 p-3 rounded-md border border-zinc-800/60 shadow-sm relative group overflow-hidden">
                          <div className="absolute top-0 left-0 w-0.5 h-full bg-pink-500/20 group-hover:bg-pink-500/50 transition-colors"/>
                          <div className="flex justify-between items-center mb-1.5 opacity-60">
                             <div className="text-[10px] font-mono text-pink-300 bg-pink-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Clock size={10}/> {normalized.timestamp || '--:--'}
                             </div>
                             <div className="text-[9px] text-zinc-600">Memory #{viewingContact.记忆.length - idx}</div>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed font-serif italic selection:bg-pink-500/30">
                            "{replaceUserPlaceholders(normalized.content || '', resolvedPlayerName)}"
                          </p>
                        </div>
                      )})}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ContactsView 
                contacts={sanitizedContacts}
                playerName={resolvedPlayerName}
                friendNames={friends} 
                onSelect={setViewingContact}
                onToggleAttention={handleToggleAttention} 
              />
            )
          )}

          {activeTab === 'MOMENTS' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#0a0a0f]">
              <div className="bg-zinc-900/30 border-b border-zinc-800 p-4 backdrop-blur-sm">
                <div className="text-[10px] text-zinc-500 font-bold uppercase mb-2">发布动态 · 仅好友可见</div>
                <textarea
                  value={momentText}
                  onChange={(e) => setMomentText(e.target.value)}
                  placeholder="分享点什么..."
                  className="w-full h-20 border border-zinc-700 bg-black/50 p-2 text-xs resize-none outline-none focus:border-blue-500 text-zinc-200 placeholder:text-zinc-600 rounded-sm"
                />
                <input
                  value={momentImage}
                  onChange={(e) => setMomentImage(e.target.value)}
                  placeholder="图片描述 (可选)"
                  className="w-full mt-2 border border-zinc-700 bg-black/50 p-2 text-xs outline-none focus:border-blue-500 text-zinc-200 placeholder:text-zinc-600 rounded-sm"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleCreateMoment}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold uppercase hover:bg-blue-500 rounded-sm transition-colors"
                  >
                    发布
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-4">
                {visibleMoments.length > 0 ? visibleMoments.map((post) => (
                  <PostCard key={post.id} post={post} resolvedPlayerName={resolvedPlayerName} />
                )) : <EmptyState icon={<Lock size={32} />} text="暂无好友动态" />}
              </div>
            </div>
          )}

          {activeTab === 'FORUM' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#0a0a0f]">
              {!activeForumPost ? (
                <>
                  {/* Forum Header with World Network Branding */}
                  <div className="sticky top-0 z-20 bg-[#1e1e24] shadow-md">
                      <ForumBoardNav 
                        boards={forumBoards} 
                        activeId={forumBoardId} 
                        onSelect={setForumBoardId} 
                        action={
                            <div className="flex gap-3 text-zinc-500 items-center">
                               <Loader2 size={16} className={showPhoneProcessing ? "animate-spin text-blue-400" : "opacity-0"} />
                               <Settings size={16} className="cursor-pointer hover:text-white" onClick={() => setShowSettings(prev => !prev)} />
                            </div>
                        }
                      />
                  </div>

                  {/* Active Board Info & Create Trigger */}
                  <div className="px-4 py-3 bg-[#18181b] border-b border-zinc-800/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold bg-blue-600 shadow-lg`}>
                              {(activeForumBoard?.名称 || '综')[0]}
                          </div>
                          <div>
                              <div className="font-bold text-zinc-100 text-sm">{activeForumBoard?.名称 || '综合板块'}</div>
                              <div className="text-[10px] text-zinc-500">关注: 12.5w • 帖子: 999+</div>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRefreshForum?.()}
                          disabled={isForumRefreshBlocked}
                          title={isForumRefreshBlocked ? '手机任务处理中，请稍后再刷新' : '手动刷新论坛内容'}
                          className={`px-3 py-1.5 text-xs font-bold rounded-full flex items-center gap-1 transition-colors ${
                            isForumRefreshBlocked
                              ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                          }`}
                        >
                          <RefreshCw size={13} className={isForumProcessing ? 'animate-spin' : ''} /> 刷新
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCreatingForumPost(true)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-full flex items-center gap-1 transition-colors"
                        >
                          <Plus size={14} /> 发帖
                        </button>
                      </div>
                   </div>

                  {/* Post List */}
                  <div className="divide-y divide-zinc-800/50">
                    {visibleForumPosts.length > 0 ? visibleForumPosts.map(post => (
                      <ForumPostCard
                        key={post.id}
                        post={post}
                        onOpen={() => setActiveForumPostId(post.id)}
                        onLike={() => onLikeForumPost?.(post.id)}
                        resolvedPlayerName={resolvedPlayerName}
                      />
                    )) : (
                        <div className="py-12 flex flex-col items-center justify-center text-zinc-600 gap-2">
                             <Globe size={32} className="opacity-50"/>
                             <div className="text-xs font-bold uppercase tracking-widest">暂无帖子</div>
                        </div>
                    )}
                  </div>

                  {/* Create Post Overlay */}
                  {isCreatingForumPost && (
                    <div className="absolute inset-0 z-50 bg-[#0a0a0f] animate-in slide-in-from-bottom-5">
                       <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#1e1e24]">
                           <button onClick={() => setIsCreatingForumPost(false)} className="text-zinc-400 text-xs font-bold">取消</button>
                           <span className="font-bold text-zinc-200 text-sm">发布帖子</span>
                           <button 
                                onClick={handleCreateForumPost}
                                className={`text-blue-400 text-xs font-bold ${(!forumTitle && !forumText) ? 'opacity-50' : ''}`}
                           >
                               发布
                           </button>
                       </div>
                       <div className="p-4 space-y-4">
                            <input
                              value={forumTitle}
                              onChange={(e) => setForumTitle(e.target.value)}
                              placeholder="标题 (必填)"
                              className="w-full bg-transparent text-lg font-bold text-white placeholder:text-zinc-600 outline-none pb-2 border-b border-zinc-800 focus:border-blue-500 transition-colors"
                            />
                            {forumBoards.length > 0 && (
                                <div className="flex gap-2 mb-2 overflow-x-auto py-1">
                                    {forumBoards.map(b => (
                                        <button 
                                            key={b.id}
                                            onClick={() => setForumBoardId(b.id)}
                                            className={`px-3 py-1 text-[10px] rounded-full border ${forumBoardId === b.id ? 'border-blue-500 text-blue-400 bg-blue-900/20' : 'border-zinc-700 text-zinc-500'}`}
                                        >
                                            {b.名称}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <textarea
                              value={forumText}
                              onChange={(e) => setForumText(e.target.value)}
                              placeholder="分享你的见闻..."
                              className="w-full h-40 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none resize-none"
                            />
                            <div className="bg-zinc-900/50 p-2 rounded border border-zinc-800 flex items-center gap-2">
                                <ImageIcon size={16} className="text-zinc-500"/>
                                <input
                                  value={forumImage}
                                  onChange={(e) => setForumImage(e.target.value)}
                                  placeholder="图片描述 (例如: 一张怪物的照片)"
                                  className="flex-1 bg-transparent text-xs text-zinc-300 placeholder:text-zinc-600 outline-none"
                                />
                            </div>
                       </div>
                    </div>
                  )}
                </>
              ) : (
                <ForumThreadView
                  post={activeForumPost}
                  replyText={forumReplyText}
                  onReplyChange={setForumReplyText}
                  onReply={handleReplyForumPost}
                  onBack={() => setActiveForumPostId(null)}
                  onLike={() => onLikeForumPost?.(activeForumPost.id)}
                  resolvedPlayerName={resolvedPlayerName}
                />
              )}
            </div>
          )}

          {activeTab === 'PARTY' && (
            viewingContact ? (
              <div className="flex-1 overflow-hidden bg-[#0a0a0f] px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-xl font-bold text-white ${getAvatarColor(viewingContact.姓名)}`}>
                    {viewingContact.姓名[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[16px] font-display text-zinc-100 truncate">{viewingContact.姓名}</div>
                    <div className="text-[10px] text-zinc-500 truncate">
                      {viewingContact.身份 || '未知'} · {viewingContact.眷族 || '无眷族'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setViewingContact(null);
                      setActiveTab('CHAT');
                      openThreadByTitle('private', viewingContact.姓名, [playerName, viewingContact.姓名]);
                    }}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border border-blue-500/60 text-blue-300 hover:text-white hover:bg-blue-600/20 transition-colors"
                  >
                    私信
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <ActionButton
                    active={!!viewingContact.特别关注}
                    onClick={() => handleToggleAttention(viewingContact)}
                    label={viewingContact.特别关注 ? '特别关注中' : '特别关注'}
                    colorClass={
                      viewingContact.特别关注
                        ? "text-pink-300 border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.15)]"
                        : "text-zinc-400 border-zinc-500/30 bg-zinc-500/5 hover:bg-zinc-500/10 hover:text-zinc-300"
                    }
                    disabled={!onUpdateConfidant}
                  />
                  <ActionButton
                    active={!!viewingContact.是否队友}
                    onClick={() => handleToggleParty(viewingContact)}
                    label={viewingContact.是否队友 ? '队伍中' : '邀请入队'}
                    colorClass="text-indigo-400 border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20"
                    disabled={!onUpdateConfidant}
                  />
                  <ActionButton
                    active={!!viewingContact.排除提示词}
                    onClick={() => handleToggleExclude(viewingContact)}
                    label={viewingContact.排除提示词 ? '已屏蔽' : '屏蔽AI'}
                    colorClass="text-red-400 border-red-500/50 bg-red-500/10 hover:bg-red-500/20"
                    disabled={!onUpdateConfidant}
                  />
                  <button
                    onClick={() => handleToggleParty(viewingContact)}
                    disabled={!onUpdateConfidant || !viewingContact.是否队友}
                    className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border border-red-500/50 text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    移出队伍
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <InfoBlock label="等级" content={`Lv.${viewingContact.等级 ?? 1}`} />
                  <InfoBlock label="身份" content={viewingContact.身份 || '未知'} />
                  <InfoBlock label="眷族" content={viewingContact.眷族 || '无眷族'} />
                  <InfoBlock label="好感度" content={`${viewingContact.好感度 ?? 0}`} />
                  <InfoBlock className="col-span-2" label="位置" content={viewingContact.位置详情 || (viewingContact.坐标 ? `坐标 ${Math.round(viewingContact.坐标.x)}, ${Math.round(viewingContact.坐标.y)}` : '未知')} />
                  <InfoBlock className="col-span-2" label="后台跟踪" content={buildTrackingSummary(npcTracking.find(t => t.NPC === viewingContact.姓名))} />
                </div>

                {viewingContact.生存数值 && (
                  <div className="mt-3 space-y-1.5">
                    <PhoneStatBar label="HP" current={viewingContact.生存数值.当前生命 || 0} max={viewingContact.生存数值.最大生命 || 100} color="bg-emerald-500" />
                    <PhoneStatBar label="MP" current={viewingContact.生存数值.当前精神 || 0} max={viewingContact.生存数值.最大精神 || 50} color="bg-purple-500" />
                    <PhoneStatBar label="SP" current={viewingContact.生存数值.当前体力 || 0} max={viewingContact.生存数值.最大体力 || 100} color="bg-amber-500" />
                  </div>
                )}

                {viewingContact.装备 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                    {viewingContact.装备.主手 && <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-300 truncate max-w-[160px]">⚔ 主手: {viewingContact.装备.主手}</span>}
                    {viewingContact.装备.副手 && <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-300 truncate max-w-[160px]">🛡 副手: {viewingContact.装备.副手}</span>}
                    {viewingContact.装备.身体 && <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-300 truncate max-w-[160px]">🧥 身体: {viewingContact.装备.身体}</span>}
                  </div>
                )}

                {viewingContact.记忆 && viewingContact.记忆.length > 0 && (
                  <div className="mt-5 border-t border-zinc-800/50 pt-3">
                    <div className="flex items-center gap-2 mb-2 text-pink-400 font-bold text-xs uppercase tracking-widest bg-pink-500/5 p-1.5 rounded w-fit border border-pink-500/20">
                      <Sparkles size={12} className="text-pink-300" />
                      <span>交互回忆 ({viewingContact.记忆.length})</span>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                      {[...viewingContact.记忆].reverse().map((mem, idx) => {
                        const normalized = normalizeMemoryEntry(mem);
                        return (
                        <div key={idx} className="border border-zinc-800/50 bg-zinc-900/40 rounded-md p-2.5">
                          <div className="text-[10px] text-zinc-300 leading-relaxed whitespace-pre-wrap">{replaceUserPlaceholders(normalized.content || '', resolvedPlayerName)}</div>
                          <div className="text-[9px] text-zinc-600 mt-1.5 font-mono">{normalized.timestamp || '--:--'} · Memory #{viewingContact.记忆.length - idx}</div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#0a0a0f]">
                <div className="p-4">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Swords size={12} className="text-red-400" /> 当前队伍
                  </div>
                  {(() => {
                    const partyMembers = sanitizedContacts.filter(c => c.是否队友);
                    return partyMembers.length > 0 ? (
                      <div className="space-y-3">
                        {partyMembers.map(member => (
                          <button
                            key={member.id}
                            onClick={() => setViewingContact(member)}
                            className="w-full text-left bg-zinc-900/60 border border-zinc-800/50 rounded-lg p-3 hover:border-red-500/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`w-10 h-10 flex items-center justify-center text-white text-sm font-bold rounded-full ${getAvatarColor(member.姓名)}`}>
                                {member.姓名[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-sm text-zinc-100 truncate">{member.姓名}</div>
                                <div className="text-[10px] text-zinc-500 flex gap-2">
                                  <span>Lv.{member.等级}</span>
                                  <span>{member.身份}</span>
                                  {member.眷族 && <span className="text-red-400/60">{member.眷族}</span>}
                                </div>
                              </div>
                            </div>
                            {member.生存数值 && (
                              <div className="space-y-1.5 mt-2">
                                <PhoneStatBar label="HP" current={member.生存数值.当前生命 || 0} max={member.生存数值.最大生命 || 100} color="bg-emerald-500" />
                                <PhoneStatBar label="MP" current={member.生存数值.当前精神 || 0} max={member.生存数值.最大精神 || 50} color="bg-purple-500" />
                                <PhoneStatBar label="SP" current={member.生存数值.当前体力 || 0} max={member.生存数值.最大体力 || 100} color="bg-amber-500" />
                              </div>
                            )}
                            {member.装备 && (
                              <div className="flex gap-2 mt-2 text-[10px]">
                                {member.装备.主手 && <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-400 truncate max-w-[120px]">⚔ {member.装备.主手}</span>}
                                {member.装备.身体 && <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-400 truncate max-w-[120px]">🛡 {member.装备.身体}</span>}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <EmptyState icon={<Swords size={32} />} text="暂无队友" />
                    );
                  })()}
                </div>
              </div>
            )
          )}

          {activeTab === 'FAMILIA' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#0a0a0f]">
              {(() => {
                const safeFamilia = familia || { 名称: '无', 主神: 'None', 等级: 'I', 资金: 0, 声望: 0, 仓库: [], 设施状态: {} };
                return (
                  <div className="p-4 space-y-4">
                    {/* Familia Header */}
                    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-lg p-4 text-center">
                      <div className="w-12 h-12 mx-auto bg-red-950/30 border border-red-500/30 rounded-full flex items-center justify-center text-red-500 mb-2">
                        <Crown size={24} />
                      </div>
                      <div className="text-lg font-display font-bold text-white uppercase tracking-wider">{safeFamilia.名称}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
                        主神: <span className="text-zinc-300">{safeFamilia.主神}</span> · 等级 {safeFamilia.等级}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Coins size={12} className="text-amber-500" />
                          <span className="text-[10px] text-zinc-500 font-bold uppercase">资金</span>
                        </div>
                        <div className="text-lg font-mono font-bold text-amber-400">{safeFamilia.资金?.toLocaleString() || 0}</div>
                      </div>
                      <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ShieldCheck size={12} className="text-purple-500" />
                          <span className="text-[10px] text-zinc-500 font-bold uppercase">声望</span>
                        </div>
                        <div className="text-lg font-mono font-bold text-purple-400">{safeFamilia.声望 ?? 0}</div>
                      </div>
                    </div>

                    {/* Warehouse */}
                    <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Package size={12} className="text-red-400" />
                        <span className="text-[10px] text-zinc-500 font-bold uppercase">仓库 ({safeFamilia.仓库?.length || 0})</span>
                      </div>
                      {safeFamilia.仓库 && safeFamilia.仓库.length > 0 ? (
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                          {safeFamilia.仓库.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs px-2 py-1 bg-zinc-800/30 rounded">
                              <span className="text-zinc-300 truncate">{item.名称}</span>
                              <span className="text-zinc-500 font-mono">x{item.数量}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-600 italic text-center py-2">仓库为空</div>
                      )}
                    </div>

                    {/* Facilities */}
                    {safeFamilia.设施状态 && Object.keys(safeFamilia.设施状态).length > 0 && (
                      <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Home size={12} className="text-red-400" />
                          <span className="text-[10px] text-zinc-500 font-bold uppercase">设施</span>
                        </div>
                        <div className="space-y-1">
                          {Object.entries(safeFamilia.设施状态).map(([name, status]) => (
                            <div key={name} className="flex justify-between items-center text-xs px-2 py-1 bg-zinc-800/30 rounded">
                              <span className="text-zinc-300">{name}</span>
                              <span className="text-[10px] text-red-400 font-bold uppercase">{String(status)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Settings Overlay */}
          {showSettings && (
             <div className="absolute inset-0 z-50 bg-[#0a0a0f] animate-in slide-in-from-right">
                 <div className="flex items-center gap-3 p-4 border-b border-zinc-800 bg-[#1e1e24]">
                     <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-white"><ArrowLeft size={16}/></button>
                     <span className="font-bold text-zinc-200">系统设置</span>
                 </div>
                 <div className="p-4 space-y-6">
                     <div className="space-y-3">
                         <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">通知偏好</div>
                         <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg divide-y divide-zinc-800/50">
                             <ToggleRow 
                                label="新闻推送" 
                                checked={systemSettings?.通知设置?.新闻推送 ?? true} 
                                onChange={(v) => onUpdateSettings?.({ 通知设置: { ...systemSettings?.通知设置, 新闻推送: v } })} 
                             />
                             <ToggleRow 
                                label="传闻更新" 
                                checked={systemSettings?.通知设置?.传闻更新 ?? true} 
                                onChange={(v) => onUpdateSettings?.({ 通知设置: { ...systemSettings?.通知设置, 传闻更新: v } })} 
                             />
                             <ToggleRow 
                                label="论坛回复" 
                                checked={systemSettings?.通知设置?.论坛动态 ?? true} 
                                onChange={(v) => onUpdateSettings?.({ 通知设置: { ...systemSettings?.通知设置, 论坛动态: v } })} 
                             />
                         </div>
                     </div>

                     <div className="space-y-3">
                         <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">数据更新</div>
                         <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex flex-col gap-3">
                            <div className="flex justify-between items-center text-sm text-zinc-300">
                                <span>自动刷新回合</span>
                                <input
                                   type="number"
                                   min={0}
                                   step={1}
                                   className="bg-black border border-zinc-700 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 w-20"
                                   value={typeof systemSettings?.世界更新间隔回合 === 'number' ? systemSettings.世界更新间隔回合 : 3}
                                   onChange={(e) => {
                                       const next = Number(e.target.value);
                                       onUpdateSettings?.({ 世界更新间隔回合: Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 3 });
                                   }}
                                />
                            </div>
                            <div className="text-[10px] text-zinc-500">
                                设为 0 表示手动刷新。
                            </div>
                        </div>
                     </div>
                 </div>
             </div>
          )}
        </div>

        {activeTab === 'CHAT' && activeThread && !isCreatingGroup && !isStartingPrivate && (
          <div className="p-3 bg-zinc-900/80 border-t border-zinc-800 shrink-0 pb-safe backdrop-blur-md sticky bottom-0 z-20">
            {editingMessageId && (
              <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-500">
                <span className="uppercase tracking-widest">正在编辑消息</span>
                <button
                  type="button"
                  onClick={() => { setEditingMessageId(null); setInputText(''); }}
                  className="text-blue-400 hover:text-blue-300 font-bold"
                >
                  取消
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isActiveThreadProcessing && handleSend()}
                placeholder={isActiveThreadProcessing ? 'AI处理中...' : (editingMessageId ? '编辑内容...' : `发送给 ${activeThread.标题}...`)}
                disabled={isActiveThreadProcessing}
                className={`flex-1 bg-black/50 border px-3 py-2 text-xs outline-none rounded-sm placeholder:text-zinc-600 transition-colors ${isActiveThreadProcessing ? 'border-zinc-800 text-zinc-500 cursor-not-allowed' : 'border-zinc-700 text-zinc-200 focus:border-blue-500'}`}
              />
              <button
                onClick={handleSend}
                disabled={isActiveThreadProcessing || !inputText.trim()}
                className={`min-w-[3.75rem] px-3 py-2 font-bold uppercase transition-colors rounded-sm border ${isActiveThreadProcessing ? 'bg-zinc-700 text-zinc-500 border-zinc-700 cursor-not-allowed' : 'bg-blue-600 text-white border-blue-500/70 hover:bg-blue-500'}`}
              >
                {isActiveThreadProcessing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : editingMessageId ? (
                  '保存'
                ) : (
                  <>
                    <span className="md:hidden text-xs tracking-wider">发送</span>
                    <Send size={16} className="hidden md:block" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
    </ModalWrapper>
  );
};

const EmptyState = ({ icon, text }: any) => (
  <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-60">
    <div className="mb-2">{icon}</div>
    <p className="font-display uppercase tracking-widest text-xs">{text}</p>
  </div>
);

const getThreadPreview = (thread: PhoneThread) => {
  const msgs = Array.isArray(thread.消息) ? thread.消息 : [];
  if (msgs.length === 0) return '暂无消息';
  const last = msgs[msgs.length - 1];
  return last?.内容 ? last.内容.slice(0, 20) : '新消息';
};

const ChatRow = ({ name, lastMsg, avatar, onClick, isGroup, unread }: any) => {
  const unreadCount = Math.max(0, unread || 0);
  const unreadLabel = unreadCount > 99 ? '99+' : unreadCount.toString();
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 hover:bg-zinc-800/50 cursor-pointer border-b border-zinc-800/50 transition-colors group"
    >
      <div className={`w-10 h-10 flex items-center justify-center font-bold text-white shrink-0 text-xs rounded-full transition-all border border-zinc-700 ${isGroup ? 'bg-zinc-800' : getAvatarColor(name)}`}>
        {isGroup ? <Users size={16} /> : name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-zinc-200 text-xs truncate uppercase font-display tracking-wide">{name}</h4>
        <p className="text-[10px] text-zinc-500 truncate group-hover:text-zinc-400 transition-colors">{lastMsg}</p>
      </div>
      {unreadCount > 0 && (
        <span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5 shadow-glow-blue">{unreadLabel}</span>
      )}
      <ChevronRight size={14} className="text-zinc-700 group-hover:text-blue-500 transition-colors" />
    </div>
  );
};

const InfoBlock = ({ label, content, className }: { label: string; content: string; className?: string }) => (
  <div className={`rounded-md border border-zinc-800/60 bg-zinc-900/30 px-2 py-1.5 ${className ?? ''}`}>
    <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">{label}</div>
    <div className="text-[11px] text-zinc-200 truncate">{content}</div>
  </div>
);

const ActionButton = ({ active, onClick, label, colorClass, disabled }: { active?: boolean; onClick: () => void; label: string; colorClass: string; disabled?: boolean }) => (
  <button
    onClick={disabled ? undefined : onClick}
    className={`px-2 py-1 rounded-full border text-[9px] font-bold uppercase transition-all ${active ? colorClass : 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    {label}
  </button>
);

const PhoneTabBtn = ({ icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3 flex flex-col justify-center items-center transition-all gap-1 ${active ? 'text-blue-400 bg-zinc-800/50' : 'text-zinc-600 hover:text-zinc-400'}`}
  >
    {icon}
    <span className="text-[9px] uppercase tracking-wider font-bold">{label}</span>
  </button>
);

const ForumBoardNav = ({ boards, activeId, onSelect, action }: { boards: ForumBoard[]; activeId: string; onSelect: (id: string) => void; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between bg-[#1e1e24] pr-4">
    <div className="flex-1 flex items-center gap-6 px-4 overflow-x-auto custom-scrollbar">
      {boards.length > 0 ? boards.map(board => {
        const active = board.id === activeId || (!activeId && board === boards[0]);
        return (
          <button
            key={board.id}
            onClick={() => onSelect(board.id)}
            className={`py-3 text-sm font-bold transition-all relative whitespace-nowrap ${active ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            {board.名称}
            {active && <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-amber-500 rounded-full" />}
          </button>
        );
      }) : <span className="text-[10px] text-zinc-500 py-3">暂无板块</span>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const ForumPostCard: React.FC<{ post: ForumPost; onOpen: () => void; onLike?: () => void; resolvedPlayerName: string }> = ({ post, onOpen, onLike, resolvedPlayerName }) => (
  <div 
    onClick={onOpen}
    className="bg-[#18181b] border-b border-zinc-800 p-4 active:bg-zinc-800 transition-colors cursor-pointer"
  >
    <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
            <div className={`w-9 h-9 flex items-center justify-center font-bold text-white text-xs rounded-full ${getAvatarColor(post.发布者 || 'U')}`}>
                {(post.发布者 || 'U')[0]}
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-200">{post.发布者}</span>
                    <span className="text-[9px] bg-zinc-800 text-zinc-500 px-1 rounded border border-zinc-700">Lv.2</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{post.板块} · {post.时间戳?.split(' ')[1] || '刚刚'}</div>
            </div>
        </div>
        <div className="text-[10px] text-zinc-600 font-mono tracking-tighter">{post.时间戳?.split(' ')[0] || ''}</div>
    </div>
    
    <div className="mb-2">
        <h3 className="text-sm font-bold text-zinc-100 mb-1 leading-snug">{post.标题}</h3>
        <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">{replaceUserPlaceholders(post.内容 || '', resolvedPlayerName)}</p>
        
        {post.图片描述 && (
             <div className="mt-2 flex items-center gap-2 bg-zinc-900 p-2 rounded border border-zinc-800/50 max-w-[80%]">
                 <ImageIcon size={14} className="text-zinc-600"/>
                 <span className="text-[10px] text-zinc-500 truncate">{post.图片描述}</span>
             </div>
        )}
    </div>

    <div className="flex items-center gap-6 mt-3 text-zinc-500">
        <button className="flex items-center gap-1.5 text-xs hover:text-zinc-300">
            <MessageSquare size={14} /> 回复
        </button>
        <button 
           onClick={(e) => { e.stopPropagation(); onLike && onLike(); }}
           className="flex items-center gap-1.5 text-xs hover:text-red-400"
        >
            <Heart size={14} /> {post.点赞数 || 0}
        </button>
        <button className="ml-auto">
             <div className="flex gap-0.5">
                 <div className="w-1 h-1 bg-zinc-600 rounded-full"/>
                 <div className="w-1 h-1 bg-zinc-600 rounded-full"/>
                 <div className="w-1 h-1 bg-zinc-600 rounded-full"/>
             </div>
        </button>
    </div>
  </div>
);

const ForumThreadView = ({ post, replyText, onReplyChange, onReply, onBack, onLike, resolvedPlayerName }: { post: ForumPost; replyText: string; onReplyChange: (value: string) => void; onReply: () => void; onBack: () => void; onLike?: () => void; resolvedPlayerName: string }) => (
  <div className="flex-1 flex flex-col">
    <div className="sticky top-0 bg-zinc-900/90 backdrop-blur px-4 py-3 border-b border-zinc-800 z-20 flex items-center gap-3">
      <button onClick={onBack} className="text-zinc-400 hover:text-white"><ArrowLeft size={16} /></button>
      <div className="min-w-0">
        <div className="text-[10px] text-zinc-500 uppercase tracking-widest">{post.板块}</div>
        <div className="text-sm text-zinc-100 font-bold truncate">{post.标题}</div>
      </div>
      <button onClick={onLike} className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400 hover:text-red-400"><Heart size={12} /> {post.点赞数 || 0}</button>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
      <div className="bg-zinc-900/50 border border-zinc-700/50 p-4 rounded-sm">
        <div className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase tracking-widest">
          <span>{post.发布者}</span>
          <span>{post.时间戳 || '未知'}</span>
        </div>
        <p className="text-xs text-zinc-300 mt-2 leading-relaxed">{replaceUserPlaceholders(post.内容 || '', resolvedPlayerName)}</p>
        {post.图片描述 && (
          <div className="w-full h-24 bg-black/40 flex flex-col items-center justify-center text-zinc-500 border border-zinc-800 mt-3 rounded-sm">
            <ImageIcon size={20} className="mb-1 text-zinc-600" />
            <span className="text-[10px] px-4 text-center text-zinc-600">{post.图片描述}</span>
          </div>
        )}
      </div>
      {post.回复 && post.回复.length > 0 ? (
        post.回复.map(reply => (
          <div key={reply.id} className="bg-[#020617] border border-zinc-800 p-3 rounded-sm">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>{reply.楼层}楼 · {reply.发布者}</span>
              <span>{reply.时间戳 || '未知'}</span>
            </div>
            <p className="text-xs text-zinc-300 mt-1">{replaceUserPlaceholders(reply.内容 || '', resolvedPlayerName)}</p>
          </div>
        ))
      ) : (
        <div className="text-center text-zinc-600 text-xs border border-dashed border-zinc-800 py-6">暂无回复</div>
      )}
    </div>
    <div className="p-3 bg-zinc-900/80 border-t border-zinc-800 shrink-0">
      <div className="flex gap-2">
        <input
          value={replyText}
          onChange={(e) => onReplyChange(e.target.value)}
          placeholder="发表回复..."
          className="flex-1 bg-black/50 border border-zinc-700 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-blue-500 rounded-sm placeholder:text-zinc-600"
        />
        <button onClick={onReply} className="bg-blue-600 text-white px-3 py-2 font-bold uppercase hover:bg-blue-500 transition-colors rounded-sm">回复</button>
      </div>
    </div>
  </div>
);

const PostCard = ({ post, isForum, resolvedPlayerName }: { post: PhonePost; isForum?: boolean; resolvedPlayerName: string }) => (
  <div className="bg-zinc-900/50 border border-zinc-700/50 p-4 shadow-sm backdrop-blur-sm rounded-sm">
    <div className="flex items-start gap-3 mb-3">
      <div className={`w-8 h-8 border border-zinc-700 flex items-center justify-center font-bold text-white text-xs shrink-0 rounded-full ${getAvatarColor(post.发布者 || 'Unknown')}`}>
        {(post.发布者 || 'U')[0]}
      </div>
      <div className="flex-1">
        <div className="font-bold text-sm leading-none text-zinc-200 flex items-center gap-2">
          {post.发布者}
          {Array.isArray(post.话题) && post.话题.length > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{post.话题.join(' / ')}</span>
          )}
        </div>
        <div className="text-[10px] text-zinc-600 font-mono uppercase mt-1">{post.时间戳 || '未知'}</div>
      </div>
    </div>

    <p className="text-xs text-zinc-300 font-sans leading-relaxed mb-3">
      {replaceUserPlaceholders(post.内容 || '', resolvedPlayerName)}
    </p>

    {post.图片描述 && (
      <div className="w-full h-24 bg-black/40 flex flex-col items-center justify-center text-zinc-500 border border-zinc-800 mb-3 rounded-sm">
        <ImageIcon size={20} className="mb-1 text-zinc-600" />
        <span className="text-[10px] px-4 text-center text-zinc-600">{post.图片描述}</span>
      </div>
    )}

    <div className="flex items-center gap-4 border-t border-zinc-800 pt-2">
      <button className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-red-500 transition-colors">
        <Heart size={12} /> Like ({post.点赞数 || 0})
      </button>
      <button className="flex items-center gap-1 text-[10px] font-bold text-zinc-500 hover:text-blue-500 transition-colors">
        <MessageSquare size={12} /> Comment
      </button>
      {isForum && post.来源 && (
        <span className="ml-auto text-[9px] text-zinc-600 uppercase tracking-widest">{post.来源}</span>
      )}
    </div>
  </div>
);

const ToggleRow = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (val: boolean) => void }) => (
    <div className="flex items-center justify-between p-3">
        <span className="text-sm text-zinc-300">{label}</span>
        <button 
            onClick={() => onChange(!checked)}
            className={`w-10 h-5 rounded-full relative transition-colors ${checked ? 'bg-blue-600' : 'bg-zinc-700'}`}
        >
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
        </button>
    </div>
);

const PhoneStatBar = ({ label, current, max, color }: { label: string; current: number; max: number; color: string }) => (
    <div className="flex items-center gap-2 text-[10px]">
        <span className="w-5 font-mono text-zinc-500 font-bold">{label}</span>
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${max > 0 ? (current / max) * 100 : 0}%` }} />
        </div>
        <span className="font-mono text-zinc-500 w-14 text-right">{current}/{max}</span>
    </div>
);

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    Smartphone, Users, Flag, Swords,
    MessageCircle, BookUser, Camera, Globe,
    Send, Plus, Heart, Star,
    Battery, Signal, Lock, ArrowLeft,
    Image as ImageIcon,
    LogOut,
    Upload,
    MessageSquareDashed,
    Shield,
    Backpack,
    Dna,
    Clock,
    MessageSquare,
    Crown,
    Activity,
    Coins,
    Home,
    Package
} from 'lucide-react';
import { PhoneState, PhoneThread, Confidant, NpcBackgroundTracking, FamiliaState } from '../../../types';
import { getAvatarColor } from '../../../utils/uiUtils';
import { normalizeForumBoards, normalizeForumPosts } from '../../../utils/normalizers';
import { BaseButton } from '../../ui/base/BaseButton';
import clsx from 'clsx';

interface SocialViewProps {
  phoneState?: PhoneState;
  contacts: Confidant[];
  npcTracking?: NpcBackgroundTracking[];
  familia?: FamiliaState;
  playerName: string;
  hasPhone?: boolean;
  onSendMessage: (text: string, thread: PhoneThread) => void;
  onEditMessage?: (id: string, content: string) => void;
  onDeleteMessage?: (id: string) => void;
  onCreateThread?: (payload: { type: 'private' | 'group' | 'public'; title: string; members: string[] }) => void;
  onCreateMoment?: (content: string, imageDesc?: string) => void;
  onCreatePublicPost?: (payload: { title: string; content: string; imageDesc?: string; boardName?: string }) => void;
  onReplyForumPost?: (payload: { postId: string; content: string }) => void;
  onLikeForumPost?: (postId: string) => void;
  onReadThread?: (threadId: string) => void;
  onWaitReply?: (thread: PhoneThread) => void;
  onUpdateConfidant: (id: string, updates: Partial<Confidant>) => void;
  onAddToQueue: (cmd: string, undoAction?: () => void, dedupeKey?: string) => void;
  isPhoneProcessing?: boolean;
  phoneProcessingThreadId?: string | null;
  phoneProcessingScope?: 'chat' | 'moment' | 'forum' | 'sync' | null;
  onClose?: () => void;
}

type SocialTab = 'PHONE' | 'NETWORK' | 'PARTY' | 'FAMILIA';
type PhoneTab = 'CHAT' | 'CONTACTS' | 'MOMENTS' | 'FORUM';
type ChatType = 'private' | 'group' | 'public';

// --- Helper Components ---
const EmptyState = ({ icon, text }: any) => (
  <div className="h-full flex flex-col items-center justify-center text-content-muted opacity-60">
    <div className="mb-2 text-content-secondary">{icon}</div>
    <p className="font-display uppercase tracking-widest text-xs">{text}</p>
  </div>
);

const InfoBlock = ({ label, content }: any) => (
  <div>
    <h4 className="text-[9px] font-bold text-content-muted uppercase tracking-widest mb-1">{label}</h4>
    <p className="text-xs text-content-primary font-medium border-l-2 border-accent-blue pl-2">{content}</p>
  </div>
);

// --- Main Component ---
export const SocialView: React.FC<SocialViewProps> = ({
    phoneState,
    contacts = [],
    npcTracking = [],
    familia,
    playerName,
    hasPhone = true,
    onSendMessage,
    onEditMessage,
    onCreateThread,
    onCreateMoment,
    onCreatePublicPost,
    onReplyForumPost,
    onLikeForumPost,
    onReadThread,
    onWaitReply,
    onUpdateConfidant,
    onAddToQueue,
    onClose
}) => {
  const [activeTab, setActiveTab] = useState<SocialTab>('PHONE');
  
  // --- Phone State ---
  const phone = phoneState || {
      设备: { 电量: 0, 当前信号: 0, 状态: 'offline' },
      联系人: { 好友: [], 黑名单: [], 最近: [] },
      对话: { 私聊: [], 群聊: [], 公共频道: [] },
      朋友圈: { 仅好友可见: true, 帖子: [] },
      公共帖子: { 板块: [], 帖子: [] },
      待发送: []
  };
  const [phoneTab, setPhoneTab] = useState<PhoneTab>('CHAT');
  const [chatType, setChatType] = useState<ChatType>('private');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [viewingContact, setViewingContact] = useState<Confidant | null>(null);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isStartingPrivate, setIsStartingPrivate] = useState(false);
  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [momentText, setMomentText] = useState('');
  const [momentImage, setMomentImage] = useState('');
  const [forumTitle, setForumTitle] = useState('');
  const [forumText, setForumText] = useState('');
  const [forumImage, setForumImage] = useState('');
  const [forumBoardId, setForumBoardId] = useState('');
  const [activeForumPostId, setActiveForumPostId] = useState<string | null>(null);
  const [forumReplyText, setForumReplyText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Network State ---
  const [networkFilter, setNetworkFilter] = useState<'ALL' | 'SPECIAL'>('SPECIAL');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  // --- Party State ---
  const partyMembers = contacts.filter(c => c.是否队友);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(partyMembers[0]?.id || "");
  const selectedPartyMember = partyMembers.find(c => c.id === selectedMemberId);

  // --- Phone Logic ---
  const getThreadList = (type: ChatType) => {
    if (type === 'private') return phone.对话?.私聊 || [];
    if (type === 'group') return phone.对话?.群聊 || [];
    return phone.对话?.公共频道 || [];
  };

  const sortedThreads = useMemo(() => {
    const list = getThreadList(chatType);
    return [...list].sort((a, b) => {
        const lastA = a.消息?.[a.消息.length - 1]?.timestampValue || 0;
        const lastB = b.消息?.[b.消息.length - 1]?.timestampValue || 0;
        return lastB - lastA;
    });
  }, [phoneState, chatType]);

  const activeThread = useMemo(() => {
    if (!activeThreadId) return null;
    return getThreadList(chatType).find(t => t.id === activeThreadId) || null;
  }, [activeThreadId, chatType, phoneState]);

  const messages = useMemo(() => {
    if (!activeThread) return [];
    return [...(activeThread.消息 || [])].sort((a, b) => (a.timestampValue || 0) - (b.timestampValue || 0));
  }, [activeThread]);

  useEffect(() => {
    if (activeThreadId && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThreadId, messages.length, activeTab]);

  const handleSend = () => {
    if (!activeThread || !inputText.trim()) return;
    if (editingMessageId && onEditMessage) {
        onEditMessage(editingMessageId, inputText.trim());
        setEditingMessageId(null);
    } else {
        onSendMessage(inputText.trim(), activeThread);
    }
    setInputText('');
  };

  const openThreadByTitle = (type: ChatType, title: string, members: string[]) => {
      let existing = getThreadList(type).find(t => t.标题 === title);
      if (!existing && onCreateThread) {
          onCreateThread({ type, title, members });
      }
      setChatType(type);
      if (existing) {
          setActiveThreadId(existing.id);
          onReadThread?.(existing.id);
      }
  };

  const validContacts = contacts.filter(c => c.已交换联系方式);
  const friendSet = new Set(phone.联系人?.好友 || []);

  const visibleMoments = useMemo(() => {
    const posts = phone.朋友圈?.帖子 || [];
    if (!phone.朋友圈?.仅好友可见) return posts;
    return posts.filter(p => p.发布者 === playerName || friendSet.has(p.发布者));
  }, [phoneState, playerName]);

  const forumBoards = useMemo(() => normalizeForumBoards(phone.公共帖子?.板块), [phoneState]);
  const forumPosts = useMemo(() => normalizeForumPosts(phone.公共帖子?.帖子, forumBoards), [phoneState, forumBoards]);
  const activeForumPost = useMemo(() => {
    if (!activeForumPostId) return null;
    return forumPosts.find(post => post.id === activeForumPostId) || null;
  }, [forumPosts, activeForumPostId]);
  const activeForumBoard = useMemo(() => forumBoards.find(b => b.id === forumBoardId) || null, [forumBoards, forumBoardId]);
  const visibleForumPosts = useMemo(() => {
    if (!activeForumBoard) return forumPosts;
    return forumPosts.filter(post => post.板块 === activeForumBoard.名称);
  }, [forumPosts, activeForumBoard]);

  useEffect(() => {
    if (forumBoardId || forumBoards.length === 0) return;
    setForumBoardId(forumBoards[0].id);
  }, [forumBoards, forumBoardId]);

  // --- Network Logic ---
  const handleToggleAttention = (c: Confidant) => {
      const isNowSpecial = !c.特别关注;
      onUpdateConfidant(c.id, { 特别关注: isNowSpecial });
      const cmd = isNowSpecial 
        ? `设置 [${c.姓名}] 为特别关注对象。`
        : `取消 [${c.姓名}] 的特别关注`;
      onAddToQueue(cmd, undefined, `toggle_special_${c.id}`);
  };

  const handleToggleParty = (c: Confidant) => {
      const isNowParty = !c.是否队友;
      onUpdateConfidant(c.id, { 是否队友: isNowParty });
      const cmd = isNowParty ? `邀请 [${c.姓名}] 加入队伍。` : `将 [${c.姓名}] 移出队伍。`;
      onAddToQueue(cmd, undefined, `toggle_party_${c.id}`);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && uploadTargetId) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              if (ev.target?.result) {
                  onUpdateConfidant(uploadTargetId, { 头像: ev.target.result as string });
              }
          };
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  const getFilteredConfidants = () => {
      const filtered = networkFilter === 'SPECIAL'
          ? contacts.filter(c => c.特别关注)
          : contacts.filter(c => !c.特别关注);
      return [...filtered].sort((a, b) => Number(!!b.是否在场) - Number(!!a.是否在场));
  };


  // --- Render Sections ---

  const renderPhoneTab = () => (
      <div className="flex flex-col md:flex-row h-full bg-surface-base">
          {/* Phone Sidebar */}
          <div className="w-full md:w-64 bg-surface-glass border-r border-white/5 flex flex-col">
              <div className="p-4 bg-accent-blue/20 border-b border-white/5 text-content-primary flex justify-between items-center shrink-0 backdrop-blur-md">
                  <div className="flex items-center gap-2">
                      <Smartphone size={18} className="text-accent-blue" />
                      <span className="font-display font-bold">DEVICE</span>
                  </div>
                  <div className="flex gap-3 text-[10px] font-mono text-content-secondary">
                      <div className="flex items-center gap-1"><Battery size={10} /> {phone.设备?.电量 || 0}%</div>
                      <div className="flex items-center gap-1"><Signal size={10} /> {phone.设备?.当前信号 || 0}/4</div>
                  </div>
              </div>
              
              <div className="flex border-b border-white/5 bg-surface-base">
                  <button onClick={() => setPhoneTab('CHAT')} className={clsx("flex-1 py-3 flex justify-center transition-colors", phoneTab === 'CHAT' ? 'text-accent-blue bg-white/5 border-b-2 border-accent-blue' : 'text-content-muted hover:text-content-primary hover:bg-white/5')}><MessageCircle size={20}/></button>
                  <button onClick={() => setPhoneTab('CONTACTS')} className={clsx("flex-1 py-3 flex justify-center transition-colors", phoneTab === 'CONTACTS' ? 'text-accent-blue bg-white/5 border-b-2 border-accent-blue' : 'text-content-muted hover:text-content-primary hover:bg-white/5')}><BookUser size={20}/></button>
                  <button onClick={() => setPhoneTab('MOMENTS')} className={clsx("flex-1 py-3 flex justify-center transition-colors", phoneTab === 'MOMENTS' ? 'text-accent-blue bg-white/5 border-b-2 border-accent-blue' : 'text-content-muted hover:text-content-primary hover:bg-white/5')}><Camera size={20}/></button>
                  <button onClick={() => setPhoneTab('FORUM')} className={clsx("flex-1 py-3 flex justify-center transition-colors", phoneTab === 'FORUM' ? 'text-accent-blue bg-white/5 border-b-2 border-accent-blue' : 'text-content-muted hover:text-content-primary hover:bg-white/5')}><Globe size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-base/50">
                  {/* Thread List / Contact List based on phoneTab */}
                  {phoneTab === 'CHAT' && (
                      <div className="flex flex-col">
                          <div className="flex border-b border-white/5 text-[10px] uppercase font-bold text-content-muted">
                              <button onClick={() => setChatType('private')} className={clsx("flex-1 py-2 transition-colors", chatType === 'private' ? 'bg-white/5 text-accent-blue' : 'hover:text-content-primary')}>私聊</button>
                              <button onClick={() => setChatType('group')} className={clsx("flex-1 py-2 transition-colors", chatType === 'group' ? 'bg-white/5 text-accent-blue' : 'hover:text-content-primary')}>群聊</button>
                              <button onClick={() => setChatType('public')} className={clsx("flex-1 py-2 transition-colors", chatType === 'public' ? 'bg-white/5 text-accent-blue' : 'hover:text-content-primary')}>公共</button>
                          </div>
                          <div className="space-y-px">
                              {chatType === 'private' && (
                                  <button onClick={() => setIsStartingPrivate(true)} className="w-full py-2.5 text-xs text-accent-blue font-bold hover:bg-white/5 flex items-center justify-center gap-1 border-b border-white/5">
                                      <Plus size={12}/> 新对话
                                  </button>
                              )}
                              {chatType === 'group' && (
                                  <button onClick={() => setIsCreatingGroup(true)} className="w-full py-2.5 text-xs text-accent-blue font-bold hover:bg-white/5 flex items-center justify-center gap-1 border-b border-white/5">
                                      <Plus size={12}/> 新群聊
                                  </button>
                              )}
                              
                              {sortedThreads.map(t => (
                                  <div 
                                      key={t.id} 
                                      onClick={() => { setActiveThreadId(t.id); setViewingContact(null); setIsCreatingGroup(false); setIsStartingPrivate(false); onReadThread?.(t.id); }}
                                      className={clsx(
                                          "p-3 flex items-center gap-3 cursor-pointer transition-all border-l-2",
                                          activeThreadId === t.id 
                                              ? 'bg-accent-blue/10 border-accent-blue' 
                                              : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'
                                      )}
                                  >
                                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm ${getAvatarColor(t.标题)}`}>
                                          {t.标题[0]}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className={clsx("text-xs font-bold truncate mb-0.5", t.未读 ? 'text-content-primary' : 'text-content-secondary')}>{t.标题}</div>
                                          <div className="text-[10px] text-content-muted truncate">{t.消息?.[t.消息.length-1]?.内容 || '无消息'}</div>
                                      </div>
                                      {t.未读 ? <div className="w-2 h-2 rounded-full bg-accent-blue shadow-[0_0_5px_rgba(56,189,248,0.8)]" /> : null}
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
                  {phoneTab === 'CONTACTS' && (
                      <div className="space-y-px">
                          {validContacts.map(c => (
                              <div 
                                  key={c.id} 
                                  onClick={() => { setViewingContact(c); setActiveThreadId(null); setIsCreatingGroup(false); setIsStartingPrivate(false); }}
                                  className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
                              >
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${getAvatarColor(c.姓名)}`}>
                                      {c.姓名[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <div className="text-xs font-bold text-content-primary truncate">{c.姓名}</div>
                                      <div className="text-[10px] text-content-muted truncate">{c.身份}</div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 relative bg-surface-overlay flex flex-col overflow-hidden">
                {!hasPhone ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-content-muted gap-4 opacity-50">
                        <Lock size={48} strokeWidth={1}/>
                        <p className="uppercase tracking-widest font-bold text-xs">Device Offline</p>
                    </div>
                ) : (
                    <>
                    {activeThread ? (
                        <>
                            <div className="p-4 border-b border-white/5 bg-surface-glass backdrop-blur-md flex justify-between items-center z-10 shadow-sm">
                                <h3 className="font-bold text-content-primary">{activeThread.标题}</h3>
                                {onWaitReply && (
                                    <button onClick={() => onWaitReply(activeThread)} className="text-content-muted hover:text-accent-blue transition-colors" title="等待回复">
                                        <Clock size={18} />
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-base/30 custom-scrollbar">
                                {messages.map((msg, i) => {
                                    const isMe = msg.发送者 === playerName || msg.发送者 === 'Player';
                                    return (
                                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={clsx(
                                                "max-w-[85%] p-3 text-sm rounded-2xl shadow-sm leading-relaxed",
                                                isMe 
                                                    ? 'bg-accent-blue text-white rounded-br-sm' 
                                                    : 'bg-surface-glass border border-white/10 text-content-primary rounded-bl-sm'
                                            )}>
                                                {!isMe && chatType !== 'private' && <div className="text-[10px] font-bold text-accent-blue mb-1 opacity-80">{msg.发送者}</div>}
                                                <div className="whitespace-pre-wrap">{msg.内容}</div>
                                                {msg.图片描述 && (
                                                    <div className="mt-2 bg-black/20 p-2 rounded flex items-center justify-center text-xs gap-2 text-content-secondary">
                                                        <ImageIcon size={14}/> <span>{msg.图片描述}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="p-4 bg-surface-glass border-t border-white/5 backdrop-blur-md">
                                <div className="flex gap-3">
                                    <input 
                                        className="flex-1 bg-surface-base border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-accent-blue/50 text-content-primary placeholder:text-content-muted transition-colors"
                                        placeholder="Type a message..."
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    />
                                    <BaseButton variant="solid" onClick={handleSend} className="px-4">
                                        <Send size={18} />
                                    </BaseButton>
                                </div>
                            </div>
                        </>
                    ) : viewingContact ? (
                        <div className="flex-1 overflow-y-auto p-8 bg-surface-base flex flex-col items-center">
                             <div className="flex flex-col items-center max-w-lg w-full">
                                 <div className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl text-white font-bold mb-6 shadow-2xl border-4 border-white/5 ${getAvatarColor(viewingContact.姓名)}`}>
                                     {viewingContact.姓名[0]}
                                 </div>
                                 <h2 className="text-3xl font-display font-bold text-content-primary tracking-wide mb-1">{viewingContact.姓名}</h2>
                                 <span className="text-content-muted font-mono uppercase tracking-widest text-xs mb-8 bg-white/5 px-3 py-1 rounded-full">{viewingContact.眷族}</span>
                                 
                                 <div className="w-full space-y-6 bg-surface-overlay p-6 rounded-2xl border border-white/5">
                                     <InfoBlock label="简介" content={viewingContact.简介 || viewingContact.外貌} />
                                     <div className="grid grid-cols-2 gap-6">
                                         <InfoBlock label="种族" content={viewingContact.种族} />
                                         <InfoBlock label="身份" content={viewingContact.身份} />
                                     </div>
                                     <InfoBlock label="追踪" content={npcTracking.find(t => t.NPC === viewingContact.姓名)?.当前行动 || '无数据'} />
                                 </div>

                                 <BaseButton 
                                    variant="solid"
                                    onClick={() => {
                                        setViewingContact(null);
                                        setPhoneTab('CHAT');
                                        setChatType('private');
                                        openThreadByTitle('private', viewingContact.姓名, [playerName, viewingContact.姓名]);
                                    }}
                                    className="mt-8 px-10 py-3 rounded-full w-full max-w-xs"
                                 >
                                     发送消息
                                 </BaseButton>
                             </div>
                        </div>
                    ) : phoneTab === 'MOMENTS' ? (
                        <div className="flex-1 flex flex-col bg-surface-base">
                            <div className="p-4 bg-surface-glass border-b border-white/5 backdrop-blur-md z-10">
                                <textarea 
                                    className="w-full h-20 bg-surface-base border border-white/10 rounded-lg p-3 text-sm resize-none outline-none focus:border-accent-blue/50 text-content-primary placeholder:text-content-muted transition-colors"
                                    placeholder="What's happening?"
                                    value={momentText}
                                    onChange={e => setMomentText(e.target.value)}
                                />
                                <div className="flex justify-between items-center mt-3">
                                    <div className="flex items-center gap-2 bg-surface-base border border-white/10 rounded-full px-3 py-1.5 w-1/2">
                                        <ImageIcon size={14} className="text-content-muted"/>
                                        <input 
                                            className="text-xs bg-transparent outline-none text-content-primary w-full placeholder:text-content-muted"
                                            placeholder="Image description..."
                                            value={momentImage}
                                            onChange={e => setMomentImage(e.target.value)}
                                        />
                                    </div>
                                    <BaseButton size="sm" variant="solid" onClick={() => { onCreateMoment?.(momentText, momentImage); setMomentText(''); setMomentImage(''); }}>
                                        发布
                                    </BaseButton>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {visibleMoments.map((post, i) => (
                                    <div key={i} className="bg-surface-glass p-5 border border-white/5 shadow-sm rounded-xl hover:border-white/10 transition-colors">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${getAvatarColor(post.发布者)}`}>{post.发布者[0]}</div>
                                            <div>
                                                <div className="font-bold text-sm text-content-primary">{post.发布者}</div>
                                                <div className="text-[10px] text-content-muted font-mono mt-0.5">{post.时间戳}</div>
                                            </div>
                                        </div>
                                        <p className="text-sm text-content-secondary leading-relaxed pl-1">{post.内容}</p>
                                        {post.图片描述 && (
                                            <div className="mt-3 bg-surface-base/50 p-3 rounded-lg border border-white/5 text-xs text-content-muted flex items-center gap-2">
                                                <ImageIcon size={16} className="text-accent-blue"/> {post.图片描述}
                                            </div>
                                        )}
                                        <div className="mt-4 pt-3 border-t border-white/5 flex gap-6 text-content-muted text-xs font-bold">
                                            <button className="hover:text-accent-red flex items-center gap-1.5 transition-colors"><Heart size={16} /> 0</button>
                                            <button className="hover:text-accent-blue flex items-center gap-1.5 transition-colors"><MessageSquare size={16} /> 0</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : phoneTab === 'FORUM' ? (
                        <div className="flex-1 flex flex-col bg-surface-base">
                            {!activeForumPost ? (
                                <>
                                    <div className="p-4 bg-surface-glass border-b border-white/5 space-y-3 backdrop-blur-md z-10">
                                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                            {forumBoards.map(board => (
                                                <button
                                                    key={board.id}
                                                    onClick={() => setForumBoardId(board.id)}
                                                    className={clsx(
                                                        "text-[10px] uppercase font-bold tracking-widest px-4 py-1.5 rounded-full border transition-colors whitespace-nowrap",
                                                        board.id === forumBoardId 
                                                            ? 'border-accent-blue/50 text-accent-blue bg-accent-blue/10' 
                                                            : 'border-white/10 text-content-muted hover:border-white/30 hover:text-content-primary'
                                                    )}
                                                >
                                                    {board.名称}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="space-y-2 bg-surface-overlay/50 p-3 rounded-lg border border-white/5">
                                            <input
                                                className="w-full bg-surface-base border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-accent-blue/50 text-content-primary placeholder:text-content-muted transition-colors"
                                                placeholder="Title..."
                                                value={forumTitle}
                                                onChange={e => setForumTitle(e.target.value)}
                                            />
                                            <textarea 
                                                className="w-full h-16 bg-surface-base border border-white/10 rounded px-3 py-2 text-sm resize-none outline-none focus:border-accent-blue/50 text-content-primary placeholder:text-content-muted transition-colors"
                                                placeholder="Write a post..."
                                                value={forumText}
                                                onChange={e => setForumText(e.target.value)}
                                            />
                                            <div className="flex justify-between items-center pt-1">
                                                <div className="flex items-center gap-2 text-content-muted">
                                                    <ImageIcon size={16} />
                                                    <input
                                                        className="w-full bg-transparent text-xs outline-none text-content-primary placeholder:text-content-muted"
                                                        placeholder="Image desc (opt)..."
                                                        value={forumImage}
                                                        onChange={e => setForumImage(e.target.value)}
                                                    />
                                                </div>
                                                <BaseButton
                                                    size="sm"
                                                    variant="solid"
                                                    onClick={() => {
                                                        const title = forumTitle.trim() || forumText.trim().slice(0, 20);
                                                        const content = forumText.trim();
                                                        const boardName = activeForumBoard?.名称 || forumBoards[0]?.名称;
                                                        if (!content) return;
                                                        onCreatePublicPost?.({ title, content, imageDesc: forumImage.trim() || undefined, boardName });
                                                        setForumTitle('');
                                                        setForumText('');
                                                        setForumImage('');
                                                    }}
                                                >
                                                    POST
                                                </BaseButton>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                        {visibleForumPosts.map((post) => (
                                            <div key={post.id} className="bg-surface-glass p-4 border border-white/5 shadow-sm rounded-xl hover:border-white/20 transition-all cursor-pointer group" onClick={() => setActiveForumPostId(post.id)}>
                                                <div className="flex items-start gap-3 mb-2">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0 ${getAvatarColor(post.发布者)}`}>{post.发布者[0]}</div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-sm text-content-primary truncate group-hover:text-accent-blue transition-colors">{post.标题}</div>
                                                        <div className="text-[10px] text-content-muted font-mono mt-0.5">{post.板块} · {post.时间戳}</div>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-content-secondary line-clamp-2 pl-11 mb-3">{post.内容}</p>
                                                <div className="flex gap-6 text-content-muted text-xs font-bold pl-11">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onLikeForumPost?.(post.id); }} 
                                                        className="hover:text-accent-red flex items-center gap-1.5 transition-colors"
                                                    >
                                                        <Heart size={14} /> {post.点赞数 || 0}
                                                    </button>
                                                    <span className="flex items-center gap-1.5"><MessageSquare size={14} /> {post.回复?.length || 0}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col">
                                    <div className="p-4 bg-surface-glass border-b border-white/5 flex items-center gap-3 backdrop-blur-md shadow-sm z-10">
                                        <button onClick={() => setActiveForumPostId(null)} className="text-content-muted hover:text-content-primary p-1 rounded-full hover:bg-white/10 transition-colors"><ArrowLeft size={20} /></button>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold text-content-muted uppercase tracking-wider">{activeForumPost.板块}</div>
                                            <div className="font-bold text-sm text-content-primary truncate">{activeForumPost.标题}</div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                        <div className="bg-surface-glass p-5 border border-white/5 rounded-xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${getAvatarColor(activeForumPost.发布者)}`}>{activeForumPost.发布者[0]}</div>
                                                <div>
                                                    <div className="font-bold text-sm text-content-primary">{activeForumPost.发布者}</div>
                                                    <div className="text-[10px] text-content-muted font-mono">{activeForumPost.时间戳}</div>
                                                </div>
                                            </div>
                                            <p className="text-sm text-content-secondary leading-relaxed">{activeForumPost.内容}</p>
                                        </div>
                                        
                                        {activeForumPost.回复?.length ? activeForumPost.回复.map(reply => (
                                            <div key={reply.id} className="bg-surface-base/50 p-4 border border-white/5 rounded-xl ml-4">
                                                <div className="text-[10px] font-bold text-content-muted mb-2 flex justify-between">
                                                    <span>{reply.发布者}</span>
                                                    <span className="font-mono">#{reply.楼层}</span>
                                                </div>
                                                <p className="text-xs text-content-secondary leading-relaxed">{reply.内容}</p>
                                            </div>
                                        )) : (
                                            <div className="text-center text-xs text-content-muted border-2 border-dashed border-white/5 py-8 rounded-xl opacity-50">暂无回复</div>
                                        )}
                                    </div>
                                    <div className="p-4 bg-surface-glass border-t border-white/5 backdrop-blur-md">
                                        <div className="flex gap-3">
                                            <input
                                                value={forumReplyText}
                                                onChange={e => setForumReplyText(e.target.value)}
                                                placeholder="Write a reply..."
                                                className="flex-1 bg-surface-base border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-accent-blue/50 text-content-primary placeholder:text-content-muted transition-colors"
                                            />
                                            <BaseButton
                                                variant="solid"
                                                onClick={() => {
                                                    if (!forumReplyText.trim()) return;
                                                    onReplyForumPost?.({ postId: activeForumPost.id, content: forumReplyText.trim() });
                                                    setForumReplyText('');
                                                }}
                                            >
                                                Reply
                                            </BaseButton>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <EmptyState icon={<Smartphone size={48} />} text="Select Item" />
                    )}
                    </>
                )}
          </div>
      </div>
  );

  const renderNetworkTab = () => (
      <div className="flex flex-col md:flex-row h-full bg-zinc-950">
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
          {/* Network Sidebar */}
          <div className="w-full md:w-64 bg-surface-base border-r border-white/5 flex flex-col">
              <div className="p-4 bg-pink-900/20 border-b border-white/5 text-pink-200 flex justify-between items-center backdrop-blur-md">
                  <div className="flex items-center gap-2">
                      <Heart size={18} className="fill-current text-pink-500" />
                      <h2 className="font-display font-bold uppercase tracking-wider text-sm">Relationships</h2>
                  </div>
              </div>
              <div className="flex border-b border-white/5 bg-surface-base">
                  <button onClick={() => setNetworkFilter('SPECIAL')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${networkFilter === 'SPECIAL' ? 'bg-pink-500/10 text-pink-400 border-b-2 border-pink-500' : 'text-content-muted hover:text-content-primary hover:bg-white/5'}`}>Favorites</button>
                  <button onClick={() => setNetworkFilter('ALL')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${networkFilter === 'ALL' ? 'bg-pink-500/10 text-pink-400 border-b-2 border-pink-500' : 'text-content-muted hover:text-content-primary hover:bg-white/5'}`}>All</button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1 bg-surface-base/50">
                  {getFilteredConfidants().map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => setViewingContact(c)}
                        className={clsx(
                            "p-3 rounded-lg transition-all cursor-pointer flex items-center gap-3 border",
                            viewingContact?.id === c.id 
                                ? 'border-pink-500/50 bg-pink-500/10 shadow-sm' 
                                : 'border-transparent hover:bg-white/5 hover:border-white/10'
                        )}
                      >
                          <div className={`w-9 h-9 rounded-md flex items-center justify-center font-bold text-white shrink-0 shadow-sm ${getAvatarColor(c.姓名)}`}>
                              {c.头像 ? <img src={c.头像} className="w-full h-full object-cover rounded-md"/> : c.姓名[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                              <div className={clsx("font-bold text-xs truncate mb-0.5", viewingContact?.id === c.id ? 'text-pink-300' : 'text-content-primary')}>{c.姓名}</div>
                              <div className="text-[10px] text-content-muted">{c.关系状态}</div>
                          </div>
                          {c.是否在场 && <div className="w-1.5 h-1.5 bg-accent-green rounded-full shadow-[0_0_5px_rgba(16,185,129,0.8)]" />}
                      </div>
                  ))}
              </div>
          </div>

          {/* Network Detail */}
          <div className="flex-1 bg-surface-overlay p-8 overflow-y-auto custom-scrollbar relative">
              {/* Background Decor */}
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none" />
              
              {viewingContact ? (
                  <div className="max-w-4xl mx-auto bg-surface-glass border border-white/5 p-8 shadow-2xl rounded-2xl backdrop-blur-xl relative z-10">
                      <div className="flex flex-col md:flex-row gap-8">
                          {/* Left Profile */}
                          <div className="w-64 shrink-0 flex flex-col items-center">
                              <div 
                                onClick={() => { setUploadTargetId(viewingContact.id); fileInputRef.current?.click(); }}
                                className="w-56 h-56 bg-surface-base border-4 border-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.15)] mb-6 overflow-hidden relative group cursor-pointer rounded-xl"
                              >
                                  {viewingContact.头像 ? <img src={viewingContact.头像} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-6xl text-content-muted">{viewingContact.姓名[0]}</div>}
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-medium uppercase text-xs tracking-widest gap-2">
                                      <Upload size={16} /> Upload Photo
                                  </div>
                              </div>
                              <h1 className="text-3xl font-display font-bold text-content-primary text-center mb-1 tracking-wide">{viewingContact.姓名}</h1>
                              <div className="text-pink-400 text-xs font-mono uppercase tracking-widest mb-6 border border-pink-500/30 px-3 py-1 rounded-full bg-pink-500/5">{viewingContact.关系状态}</div>
                              
                              <div className="flex flex-col gap-3 w-full">
                                  <BaseButton 
                                    size="sm"
                                    variant={viewingContact.特别关注 ? 'gold' : 'outline'}
                                    onClick={() => handleToggleAttention(viewingContact)}
                                    leftIcon={<Star size={14} fill={viewingContact.特别关注 ? "currentColor" : "none"} />}
                                  >
                                      {viewingContact.特别关注 ? 'Favorite' : 'Add Favorite'}
                                  </BaseButton>
                                  <BaseButton 
                                    size="sm"
                                    variant={viewingContact.是否队友 ? 'solid' : 'outline'}
                                    onClick={() => handleToggleParty(viewingContact)}
                                    leftIcon={<Swords size={14} />}
                                  >
                                      {viewingContact.是否队友 ? 'In Party' : 'Invite to Party'}
                                  </BaseButton>
                              </div>
                          </div>

                          {/* Right Info */}
                          <div className="flex-1 space-y-6">
                               <div className="grid grid-cols-2 gap-4">
                                   <div className="bg-surface-base/50 p-4 border border-white/5 rounded-xl">
                                       <span className="text-[10px] text-pink-400 uppercase font-bold tracking-widest block mb-1">Affinity</span>
                                       <div className="text-2xl font-display text-content-primary flex items-center gap-2"><Heart className="fill-current text-pink-500" size={20}/> {viewingContact.好感度}</div>
                                   </div>
                                   <div className="bg-surface-base/50 p-4 border border-white/5 rounded-xl">
                                       <span className="text-[10px] text-accent-blue uppercase font-bold tracking-widest block mb-1">Status</span>
                                       <div className="text-xl text-content-secondary">{viewingContact.是否在场 ? 'Nearby' : 'Away'}</div>
                                   </div>
                               </div>

                               <div className="space-y-6 bg-surface-base/30 p-6 rounded-xl border border-white/5">
                                   <InfoBlock label="Background" content={viewingContact.背景 || "Unknown"} />
                                   <div className="grid grid-cols-2 gap-6">
                                       <InfoBlock label="Race" content={viewingContact.种族} />
                                       <InfoBlock label="Familia" content={viewingContact.眷族} />
                                   </div>
                                   <InfoBlock label="Personality" content={viewingContact.性格 || "Unknown"} />
                                   
                                   <div className="pt-4 border-t border-white/5">
                                       <h4 className="text-[10px] text-content-muted uppercase font-bold mb-3 flex items-center gap-2"><MessageSquareDashed size={12}/> Key Memories</h4>
                                       <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                           {viewingContact.记忆?.map((m, i) => (
                                               <div key={i} className="text-xs text-content-secondary border-b border-white/5 pb-2 last:border-0">
                                                   <span className="text-accent-blue font-mono text-[10px] mr-2 opacity-70">[{m.时间戳.split(' ')[1]}]</span>
                                                   {m.内容}
                                               </div>
                                           ))}
                                           {(!viewingContact.记忆 || viewingContact.记忆.length === 0) && (
                                               <div className="text-xs text-content-muted italic">No shared memories recorded.</div>
                                           )}
                                       </div>
                                   </div>
                               </div>
                          </div>
                      </div>
                  </div>
              ) : (
                  <EmptyState icon={<Users size={64} />} text="Select Contact" />
              )}
          </div>
      </div>
  );

  const renderPartyTab = () => (
      <div className="flex flex-col md:flex-row h-full bg-[#0a0a0a]">
          {/* Party List */}
          <div className="w-full md:w-72 bg-surface-glass border-r border-white/5 flex flex-col">
              <div className="p-4 bg-red-900/20 border-b border-white/5 text-red-200 flex items-center gap-2 backdrop-blur-md">
                  <Swords size={18} className="text-red-500" />
                  <h2 className="font-display font-bold uppercase tracking-wider text-sm">Active Party</h2>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 bg-surface-base/50">
                  {partyMembers.length > 0 ? partyMembers.map(c => (
                      <div 
                        key={c.id}
                        onClick={() => setSelectedMemberId(c.id)}
                        className={clsx(
                            "group relative p-3 border rounded-xl transition-all cursor-pointer overflow-hidden",
                            selectedMemberId === c.id 
                                ? 'bg-red-900/10 border-red-500/50 shadow-sm' 
                                : 'bg-surface-base border-white/5 hover:border-white/20'
                        )}
                      >
                          <div className="flex items-center gap-3 relative z-10">
                              <div className={clsx(
                                  "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shrink-0 border transition-colors",
                                  selectedMemberId === c.id ? 'border-red-500/50 text-red-200 bg-red-500/10' : 'border-white/10 text-content-muted bg-black/20'
                              )}>
                                  {c.姓名[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                  <div className={clsx("font-display font-bold uppercase text-sm leading-none mb-1", selectedMemberId === c.id ? 'text-red-100' : 'text-content-primary')}>{c.姓名}</div>
                                  <div className="text-[10px] font-bold uppercase text-content-muted opacity-70">LV.{c.等级} | {c.身份}</div>
                              </div>
                              {selectedMemberId === c.id && <Crown size={16} className="text-accent-gold drop-shadow-md"/>}
                          </div>
                          {selectedMemberId === c.id && <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent pointer-events-none" />}
                      </div>
                  )) : (
                      <div className="flex flex-col items-center justify-center h-full text-content-muted opacity-50 gap-2">
                          <Users size={32} />
                          <span className="text-xs font-bold uppercase tracking-widest">No Members</span>
                      </div>
                  )}
              </div>
          </div>

          {/* Party Member Detail */}
          <div className="flex-1 bg-surface-base relative p-8 overflow-y-auto custom-scrollbar">
              <div className="absolute inset-0 bg-gradient-to-br from-red-900/5 via-transparent to-transparent pointer-events-none" />
              
              {selectedPartyMember ? (
                  <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 relative z-10">
                      {/* Header */}
                      <div className="flex justify-between items-end border-b border-white/10 pb-6">
                          <div>
                              <h1 className="text-5xl font-display font-black text-content-primary tracking-tighter uppercase mb-2">{selectedPartyMember.姓名}</h1>
                              <div className="flex gap-4 text-xs font-mono text-red-200/60">
                                  <span className="bg-red-900/20 px-2 py-0.5 rounded text-red-300 border border-red-500/20">{selectedPartyMember.种族}</span>
                                  <span className="bg-white/5 px-2 py-0.5 rounded text-content-secondary border border-white/5">{selectedPartyMember.性别}</span>
                                  <span className="bg-white/5 px-2 py-0.5 rounded text-content-secondary border border-white/5">{selectedPartyMember.年龄}岁</span>
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="text-[10px] text-red-400 uppercase font-bold tracking-widest mb-1">Level</div>
                              <div className="text-5xl font-display text-white drop-shadow-lg">{selectedPartyMember.等级}</div>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Stats */}
                          <div className="bg-surface-glass border border-white/5 p-6 rounded-2xl space-y-6 shadow-xl">
                              <div>
                                  <h4 className="text-red-400 font-bold uppercase text-xs mb-4 flex items-center gap-2 tracking-wider"><Activity size={14}/> Vitals</h4>
                                  <div className="space-y-4">
                                      <div className="flex items-center gap-3 text-xs font-bold text-white">
                                          <span className="w-8 text-content-muted">HP</span>
                                          <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-accent-green shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${(selectedPartyMember.生存数值?.当前生命||100)/(selectedPartyMember.生存数值?.最大生命||100)*100}%` }}/></div>
                                          <span className="w-20 text-right font-mono text-accent-green">{selectedPartyMember.生存数值?.当前生命}/{selectedPartyMember.生存数值?.最大生命}</span>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs font-bold text-white">
                                          <span className="w-8 text-content-muted">MP</span>
                                          <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-accent-blue shadow-[0_0_10px_rgba(56,189,248,0.5)]" style={{ width: `${(selectedPartyMember.生存数值?.当前精神||50)/(selectedPartyMember.生存数值?.最大精神||50)*100}%` }}/></div>
                                          <span className="w-20 text-right font-mono text-accent-blue">{selectedPartyMember.生存数值?.当前精神}/{selectedPartyMember.生存数值?.最大精神}</span>
                                      </div>
                                  </div>
                              </div>
                              
                              <div className="pt-4 border-t border-white/5">
                                  <h4 className="text-red-400 font-bold uppercase text-xs mb-4 flex items-center gap-2 tracking-wider"><Dna size={14}/> Attributes</h4>
                                  <div className="grid grid-cols-2 gap-3">
                                      {['力量','耐久','灵巧','敏捷','魔力'].map(attr => (
                                          <div key={attr} className="bg-black/20 p-3 flex justify-between items-center border border-white/5 rounded-lg">
                                              <span className="text-[10px] uppercase text-content-muted font-bold">{attr}</span>
                                              <span className="font-mono font-bold text-lg text-content-primary">{(selectedPartyMember.能力值 as any)?.[attr] || '-'}</span>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>

                          {/* Gear & Bag */}
                          <div className="space-y-6">
                               <div className="bg-surface-glass border border-white/5 p-6 rounded-2xl shadow-xl">
                                   <h4 className="text-content-muted font-bold uppercase text-xs mb-4 flex items-center gap-2 tracking-wider"><Shield size={14}/> Equipment</h4>
                                   <div className="space-y-3">
                                       <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                                           <div className="p-2 bg-white/5 rounded text-content-muted"><Swords size={16}/></div>
                                           <div>
                                               <span className="text-[9px] uppercase text-content-muted font-bold block mb-0.5">Main Hand</span>
                                               <div className="text-sm font-bold text-content-primary">{selectedPartyMember.装备?.主手 || "Empty"}</div>
                                           </div>
                                       </div>
                                       <div className="bg-black/20 p-3 rounded-lg border border-white/5 flex items-center gap-3">
                                           <div className="p-2 bg-white/5 rounded text-content-muted"><Shield size={16}/></div>
                                           <div>
                                               <span className="text-[9px] uppercase text-content-muted font-bold block mb-0.5">Armor</span>
                                               <div className="text-sm font-bold text-content-primary">{selectedPartyMember.装备?.身体 || "Empty"}</div>
                                           </div>
                                       </div>
                                   </div>
                               </div>

                               <div className="bg-surface-glass border border-white/5 p-6 flex-1 rounded-2xl shadow-xl">
                                   <h4 className="text-content-muted font-bold uppercase text-xs mb-4 flex items-center gap-2 tracking-wider"><Backpack size={14}/> Inventory</h4>
                                   <div className="flex flex-wrap gap-2">
                                       {selectedPartyMember.背包 && selectedPartyMember.背包.length > 0 ? selectedPartyMember.背包.map((item, i) => (
                                           <span key={i} className="text-[10px] bg-black/40 border border-white/10 text-content-secondary px-3 py-1.5 rounded-full font-medium">
                                               {item.名称} <span className="text-content-muted ml-1">x{item.数量}</span>
                                           </span>
                                       )) : <span className="text-content-muted italic text-xs py-4 w-full text-center">Empty Bag</span>}
                                   </div>
                               </div>
                          </div>
                      </div>
                  </div>
              ) : (
                  <EmptyState icon={<Swords size={48} />} text="Select Member" />
              )}
          </div>
      </div>
  );

  const renderFamiliaTab = () => {
      const safeFamilia = familia || { 名称: "None", 主神: "None", 等级: "I", 资金: 0, 声望: 0, 仓库: [], 设施状态: {} };
      return (
          <div className="flex-1 bg-surface-base h-full p-8 overflow-y-auto custom-scrollbar relative">
               <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-transparent pointer-events-none" />
               
               <div className="max-w-5xl mx-auto space-y-8 relative z-10">
                   <div className="text-center mb-12">
                       <div className="inline-block p-10 bg-surface-glass border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden group hover:border-accent-blue/30 transition-colors">
                           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-blue to-transparent opacity-50" />
                           <h1 className="text-5xl md:text-7xl font-display font-black text-content-primary uppercase tracking-tighter mb-2 drop-shadow-xl">{safeFamilia.名称}</h1>
                           <div className="text-accent-blue font-mono tracking-[0.5em] text-sm uppercase opacity-80">Familia Myth</div>
                       </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="bg-surface-glass border border-white/5 p-6 flex items-center gap-5 rounded-2xl shadow-lg hover:bg-surface-overlay transition-colors group">
                           <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform"><Coins size={24} /></div>
                           <div>
                               <div className="text-xs text-content-muted uppercase font-bold tracking-widest mb-1">Funds</div>
                               <div className="text-3xl font-mono text-content-primary font-bold">{safeFamilia.资金?.toLocaleString() || 0}</div>
                           </div>
                       </div>
                       <div className="bg-surface-glass border border-white/5 p-6 flex items-center gap-5 rounded-2xl shadow-lg hover:bg-surface-overlay transition-colors group">
                           <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform"><Home size={24} /></div>
                           <div>
                               <div className="text-xs text-content-muted uppercase font-bold tracking-widest mb-1">Rank</div>
                               <div className="text-3xl font-display text-content-primary font-bold">{safeFamilia.等级}</div>
                           </div>
                       </div>
                       <div className="bg-surface-glass border border-white/5 p-6 flex items-center gap-5 rounded-2xl shadow-lg hover:bg-surface-overlay transition-colors group">
                           <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform"><Crown size={24} /></div>
                           <div className="flex-1">
                               <div className="text-xs text-content-muted uppercase font-bold tracking-widest mb-1">Renown</div>
                               <div className="text-3xl font-mono text-content-primary font-bold mb-2">{safeFamilia.声望 || 0}</div>
                               <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" style={{ width: `${Math.min(100, (safeFamilia.声望||0)/100)}%` }}/></div>
                           </div>
                       </div>
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                       <div className="bg-surface-glass border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                           <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                               <h3 className="text-lg font-display uppercase text-content-primary flex items-center gap-3 font-bold tracking-wide">
                                   <Package className="text-accent-blue"/> Storage
                               </h3>
                           </div>
                           <div className="p-6 min-h-[200px]">
                               {safeFamilia.仓库 && safeFamilia.仓库.length > 0 ? (
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                       {safeFamilia.仓库.map((item, i) => (
                                           <div key={i} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5 text-sm hover:border-white/10 transition-colors">
                                               <span className="text-content-secondary font-medium">{item.名称}</span>
                                               <span className="text-accent-blue font-mono font-bold">x{item.数量}</span>
                                           </div>
                                       ))}
                                   </div>
                               ) : <div className="h-full flex flex-col items-center justify-center text-content-muted opacity-50 py-10"><Package size={32} className="mb-2"/><span className="text-xs uppercase tracking-widest">Empty Storage</span></div>}
                           </div>
                       </div>

                       <div className="bg-surface-glass border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                           <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                               <h3 className="text-lg font-display uppercase text-content-primary flex items-center gap-3 font-bold tracking-wide">
                                   <Home className="text-purple-400"/> Facilities
                               </h3>
                           </div>
                           <div className="p-6 min-h-[200px]">
                               {Object.keys(safeFamilia.设施状态 || {}).length > 0 ? (
                                   <pre className="text-xs text-content-secondary font-mono bg-black/20 p-4 rounded-lg border border-white/5 overflow-auto">{JSON.stringify(safeFamilia.设施状态, null, 2)}</pre>
                               ) : <div className="h-full flex flex-col items-center justify-center text-content-muted opacity-50 py-10"><Home size={32} className="mb-2"/><span className="text-xs uppercase tracking-widest">No Facilities</span></div>}
                           </div>
                       </div>
                   </div>
               </div>
          </div>
      );
  }

  return (
    <div className="w-full h-full flex flex-col md:flex-row overflow-hidden bg-surface-base animate-in fade-in duration-300">
        
        {/* Main Sidebar */}
        <div className="md:w-20 bg-surface-glass border-r border-white/5 flex flex-col items-center py-6 gap-6 z-20 backdrop-blur-xl">
             <NavButton icon={<Smartphone size={24}/>} active={activeTab === 'PHONE'} onClick={() => setActiveTab('PHONE')} tooltip="Phone"/>
             <NavButton icon={<Users size={24}/>} active={activeTab === 'NETWORK'} onClick={() => setActiveTab('NETWORK')} tooltip="Network"/>
             <NavButton icon={<Swords size={24}/>} active={activeTab === 'PARTY'} onClick={() => setActiveTab('PARTY')} tooltip="Party"/>
             <NavButton icon={<Flag size={24}/>} active={activeTab === 'FAMILIA'} onClick={() => setActiveTab('FAMILIA')} tooltip="Familia"/>
             
             {onClose && (
                 <div className="mt-auto">
                     <NavButton icon={<LogOut size={24}/>} active={false} onClick={onClose} tooltip="Back"/>
                 </div>
             )}
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
             {activeTab === 'PHONE' && renderPhoneTab()}
             {activeTab === 'NETWORK' && renderNetworkTab()}
             {activeTab === 'PARTY' && renderPartyTab()}
             {activeTab === 'FAMILIA' && renderFamiliaTab()}
        </div>
    </div>
  );
};

const NavButton = ({ icon, active, onClick, tooltip }: any) => (
    <button 
        onClick={onClick}
        title={tooltip}
        className={clsx(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
            active 
                ? 'bg-accent-blue text-white shadow-[0_0_15px_rgba(56,189,248,0.4)] scale-110' 
                : 'text-content-muted hover:text-content-primary hover:bg-white/10'
        )}
    >
        {icon}
    </button>
);
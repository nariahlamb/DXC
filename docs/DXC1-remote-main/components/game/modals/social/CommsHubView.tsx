import React, { useState } from 'react';
import { MessageCircle, ScrollText, Heart, ChevronRight, Zap, Users, UserPlus } from 'lucide-react';
import type { Confidant, ForumPost, ForumBoard } from '../../../../types';
import { getAvatarColor } from '../../../../utils/uiUtils';

type ChatType = 'private' | 'group' | 'public';

export interface CommsThreadItem {
  id: string;
  title: string;
  preview: string;
  unread?: number;
  type: ChatType;
}

interface CommsHubViewProps {
  following?: Confidant[];
  nearby?: Confidant[];
  threadItems?: CommsThreadItem[];
  forumPreview?: ForumPost[]; // Kept for backward compat, but we prefer using boards
  forumBoards?: ForumBoard[];
  allForumPosts?: ForumPost[];
  onOpenThread?: (id: string, type: ChatType) => void;
  onSelectContact?: (contact: Confidant) => void;
  onOpenForum?: () => void; // Fallback "View All"
  onOpenBoard?: (boardId: string) => void;
  onOpenForumPost?: (postId: string) => void;
  onToggleAttention?: (contact: Confidant) => void;
}

const SectionTitle = ({ icon: Icon, label, action, actionLabel }: any) => (
  <div className="flex items-center justify-between mb-3 px-1">
    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
      <Icon size={14} className="text-zinc-400" />
      <span>{label}</span>
    </div>
    {action && (
      <button onClick={action} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors">
        {actionLabel} <ChevronRight size={12} />
      </button>
    )}
  </div>
);

type ContactTab = 'FOLLOWING' | 'NEARBY';

export const CommsHubView: React.FC<CommsHubViewProps> = ({
  following = [],
  nearby = [],
  threadItems = [],
  forumPreview = [],
  forumBoards = [],
  allForumPosts = [],
  onOpenThread,
  onSelectContact,
  onOpenForum,
  onOpenBoard,
  onOpenForumPost,
  onToggleAttention
}) => {
  const [activeTab, setActiveTab] = useState<ContactTab>('FOLLOWING');

  // Filter nearby to exclude those already followed
  const displayedNearby = nearby.filter(n => !following.some(f => f.id === n.id || f.姓名 === n.姓名));
  const displayedList = activeTab === 'FOLLOWING' ? following : displayedNearby;

  return (
    <div className="w-full h-full flex flex-col bg-transparent text-zinc-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2 bg-gradient-to-r from-zinc-900/90 to-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="p-1.5 rounded bg-blue-500/10 text-blue-400">
             <Zap size={16} fill="currentColor" />
        </div>
        <span className="font-display tracking-[0.2em] text-sm uppercase text-zinc-100 font-bold">通讯控制台</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
        {/* Contacts Widget Section */}
        <section>
          {/* Tabs */}
          <div className="flex items-center gap-2 mb-3">
             <button 
                onClick={() => setActiveTab('FOLLOWING')}
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all ${activeTab === 'FOLLOWING' ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
                关注的人
             </button>
             <button 
                onClick={() => setActiveTab('NEARBY')}
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all ${activeTab === 'NEARBY' ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
                周围的人
             </button>
          </div>
          
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1 touch-pan-y overscroll-contain">
            {displayedList.length === 0 ? (
                <div className="text-xs text-zinc-600 italic py-8 text-center border border-dashed border-zinc-800 rounded-lg">
                    {activeTab === 'FOLLOWING' ? '暂无特别关注对象' : '周围没有在场人物'}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-2">
                {displayedList.map((c) => (
                    <div
                    key={c.id}
                    className="group relative flex items-center gap-3 p-2.5 
                                bg-zinc-900/30 border border-zinc-800/60 hover:bg-zinc-800/60 hover:border-zinc-700/50
                                rounded-lg transition-all duration-200"
                    >
                    <button 
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        onClick={() => onSelectContact?.(c)}
                    >
                        <div className="relative shrink-0">
                            <div className={`w-9 h-9 flex items-center justify-center font-bold text-white text-xs rounded-full ring-1 ring-zinc-700/50 ${getAvatarColor(c.姓名)}`}>
                            {c.头像 ? <img src={c.头像} alt={c.姓名} className="w-full h-full object-cover rounded-full" /> : (c.姓名?.trim()?.[0] || '?')}
                            </div>
                            
                            {/* Affinity Badge */}
                            {typeof c.好感度 === 'number' && (
                                <div className="absolute -bottom-1 -right-1 z-10 flex items-center justify-center w-4 h-4 
                                            bg-zinc-950 border border-pink-500/30 rounded-full shadow-sm">
                                    <Heart size={8} className="text-pink-500 fill-pink-500" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-zinc-200 truncate group-hover:text-white transition-colors">{c.姓名}</div>
                                {activeTab === 'FOLLOWING' && (
                                    <div className="flex items-center gap-1 bg-pink-500/10 px-1.5 py-0.5 rounded text-pink-300 text-[9px] font-bold border border-pink-500/20">
                                        <Heart size={8} fill="currentColor" />
                                        <span>{c.好感度 ?? 0}</span>
                                    </div>
                                )}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate mt-0.5 flex items-center gap-1">
                                {c.是否队友 && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse mr-1" title="队友"/>}
                                {c.眷族 || '无眷族'}
                            </div>
                        </div>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                        {activeTab === 'NEARBY' && !c.特别关注 && (
                             <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleAttention?.(c);
                                }}
                                className="p-2 text-zinc-500 hover:text-pink-400 hover:bg-pink-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="设为特别关注"
                            >
                                <UserPlus size={16} />
                            </button>
                        )}
                         <button 
                            onClick={() => onSelectContact?.(c)}
                            className="p-2 text-zinc-600 hover:text-zinc-300 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    </div>
                ))}
                </div>
            )}
          </div>
        </section>

        {/* Messages Section */}
        <section>
          <SectionTitle icon={MessageCircle} label="最新简讯" />
          
          {threadItems.length === 0 ? (
            <div className="text-xs text-zinc-600 italic py-4 text-center border border-dashed border-zinc-800 rounded-lg">暂无消息记录</div>
          ) : (
            <div className="flex flex-col gap-2">
              {threadItems.map((thread) => (
                <button
                  key={`${thread.type}:${thread.id}`}
                  onClick={() => onOpenThread?.(thread.id, thread.type)}
                  className="w-full group flex items-start gap-4 p-3
                             bg-zinc-900/30 border border-zinc-800/50 hover:border-blue-500/30 hover:bg-zinc-800/60
                             transition-all duration-200 rounded-lg text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 
                                  flex items-center justify-center text-sm font-bold text-zinc-400 group-hover:text-zinc-200 shadow-inner shrink-0">
                    {(thread.title?.trim()?.[0] || '?')}
                  </div>
                  
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-zinc-300 group-hover:text-blue-200 transition-colors truncate pr-2">{thread.title || '未命名会话'}</span>
                        {/* Type Badge */}
                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold ${
                            thread.type === 'private' ? 'bg-blue-500/10 text-blue-400' :
                            thread.type === 'group' ? 'bg-purple-500/10 text-purple-400' :
                            'bg-amber-500/10 text-amber-400'
                        }`}>
                            {thread.type === 'private' ? '私信' : thread.type === 'group' ? '群组' : '频道'}
                        </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate group-hover:text-zinc-400 transition-colors">
                        {thread.preview || <span className="italic opacity-50">无预览内容</span>}
                    </div>
                  </div>

                  {thread.unread && thread.unread > 0 && (
                    <div className="h-full flex items-center pl-2">
                        <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold bg-blue-500 text-white rounded-full px-1.5 shadow-lg shadow-blue-500/20">
                        {thread.unread > 99 ? '99+' : thread.unread}
                        </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Forum Section - Grouped by Boards */}
        {forumBoards.length > 0 ? (
          forumBoards.map(board => {
            const boardPosts = allForumPosts
              .filter(p => p.板块 === board.名称)
              // Ensure sorted by time descending
              .sort((a, b) => (b.timestampValue || 0) - (a.timestampValue || 0))
              .slice(0, 4);

            if (boardPosts.length === 0) return null;

            return (
              <section key={board.id}>
                <SectionTitle 
                  icon={ScrollText} 
                  label={board.名称} 
                  action={() => onOpenBoard?.(board.id)} 
                  actionLabel="进入分区" 
                />
                
                <div className="grid grid-cols-1 gap-2">
                  {boardPosts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => onOpenForumPost?.(post.id)}
                      className="w-full p-2.5 bg-zinc-900/30 border border-zinc-800/50 hover:border-amber-500/30 hover:bg-zinc-800/50 
                                  transition-all duration-200 rounded-lg text-left group"
                    >
                      <div className="flex items-start gap-3">
                          {/* Simple visual indicator for post */}
                          <div className="pt-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover:bg-amber-500 transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-zinc-300 group-hover:text-amber-100 truncate mb-0.5">{post.标题}</div>
                            <div className="text-[10px] text-zinc-500 truncate opacity-80 flex items-center gap-2">
                              <span>{post.发布者}</span>
                              <span className="w-0.5 h-0.5 rounded-full bg-zinc-600" />
                              <span>{post.时间戳?.split(' ')?.[0] || '未知时间'}</span>
                            </div>
                          </div>
                          {post.图片描述 && (
                              <div className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 group-hover:text-amber-500/80 border border-zinc-700/50">图</div>
                          )}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          /* Fallback if no boards defined or loaded yet */
          <section>
             <SectionTitle icon={ScrollText} label="论坛热点" action={onOpenForum} actionLabel="查看全部" />
             {forumPreview.length === 0 ? (
                <div className="text-xs text-zinc-600 italic py-4 text-center border border-dashed border-zinc-800 rounded-lg">暂无公共帖子</div>
             ) : (
               <div className="grid grid-cols-1 gap-2">
                 {forumPreview.map((post) => (
                   <button
                     key={post.id}
                     onClick={() => onOpenForumPost?.(post.id)}
                     className="w-full p-3 bg-zinc-900/30 border border-zinc-800/50 hover:border-amber-500/30 hover:bg-zinc-800/50 
                                transition-all duration-200 rounded-lg text-left group"
                   >
                     <div className="flex items-start gap-3">
                         <div className="pt-1">
                           <div className="w-1 h-8 rounded-full bg-zinc-800 group-hover:bg-amber-500/50 transition-colors" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="text-xs font-bold text-zinc-300 group-hover:text-amber-100 truncate mb-1">{post.标题}</div>
                           <div className="text-[10px] text-zinc-500 truncate opacity-80">{post.内容}</div>
                         </div>
                     </div>
                   </button>
                 ))}
               </div>
             )}
          </section>
        )}
      </div>
    </div>
  );
};

import { useMemo } from 'react';
import { PhoneState, Confidant, PhoneThread, NpcBackgroundTracking, ForumBoard, ForumPost } from '../../types';
import { normalizeForumBoards, normalizeForumPosts } from '../../utils/normalizers';
import { filterOutPlayerContacts, isContactNearby } from '../../utils/social/contactPresence';

export type ChatType = 'private' | 'group' | 'public';

export interface CommsThreadItem {
  id: string;
  title: string;
  preview: string;
  unread?: number;
  type: ChatType;
}

interface UsePhoneDataProps {
  phoneState?: PhoneState;
  contacts: Confidant[];
  playerName: string;
  activeThreadId?: string | null;
  chatType?: ChatType;
}

export const usePhoneData = ({
  phoneState,
  contacts,
  playerName,
  activeThreadId,
  chatType = 'private'
}: UsePhoneDataProps) => {
  const phone = phoneState || {
    设备: { 电量: 0, 当前信号: 0, 状态: 'offline' },
    联系人: { 好友: [], 黑名单: [], 最近: [] },
    对话: { 私聊: [], 群聊: [], 公共频道: [] },
    朋友圈: { 仅好友可见: true, 帖子: [] },
    公共帖子: { 板块: [], 帖子: [] },
    待发送: []
  };
  const sanitizedContacts = useMemo(
    () => filterOutPlayerContacts(contacts, playerName),
    [contacts, playerName]
  );

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

  const getThreadPreview = (thread: PhoneThread) => {
    const msgs = Array.isArray(thread.消息) ? thread.消息 : [];
    if (msgs.length === 0) return '暂无消息';
    const last = msgs[msgs.length - 1];
    return last?.内容 ? last.内容.slice(0, 20) : '新消息';
  };

  // Chats
  const sortedThreads = useMemo(() => {
    const list = getThreadList(chatType);
    return [...list].sort((a, b) => getThreadSortValue(b) - getThreadSortValue(a));
  }, [phoneState, chatType]);

  const activeThread = useMemo(() => {
    if (!activeThreadId) return null;
    return getThreadList(chatType).find(t => t.id === activeThreadId) || null;
  }, [activeThreadId, chatType, phoneState]);

  const totalUnread = useMemo(() => {
    const allThreads = [
      ...(phone.对话?.私聊 || []),
      ...(phone.对话?.群聊 || []),
      ...(phone.对话?.公共频道 || [])
    ];
    return allThreads.reduce((sum, t) => sum + (t.未读 || 0), 0);
  }, [phoneState]);

  // Contacts
  const specialContacts = useMemo(() => sanitizedContacts.filter(c => c.特别关注), [sanitizedContacts]);
  const nearbyContacts = useMemo(() => sanitizedContacts.filter(c => isContactNearby(c) && !c.特别关注), [sanitizedContacts]);
  const validContacts = useMemo(
    () => sanitizedContacts.filter(c => c.已交换联系方式 || c.特别关注 || isContactNearby(c)),
    [sanitizedContacts]
  );

  const friends = Array.isArray(phone.联系人?.好友) ? phone.联系人.好友 : [];
  const friendSet = useMemo(() => new Set(friends), [friends]);

  // Home / Comms Hub
  const commThreads = useMemo(() => {
    const all: Array<{ thread: PhoneThread; type: ChatType }> = [];
    (phone.对话?.私聊 || []).forEach(t => all.push({ thread: t, type: 'private' }));
    (phone.对话?.群聊 || []).forEach(t => all.push({ thread: t, type: 'group' }));
    (phone.对话?.公共频道 || []).forEach(t => all.push({ thread: t, type: 'public' }));
    // Sort by most recent
    return all.sort((a, b) => getThreadSortValue(b.thread) - getThreadSortValue(a.thread)).slice(0, 6);
  }, [phoneState]);

  const commThreadItems: CommsThreadItem[] = useMemo(() => {
    return commThreads.map(({ thread, type }) => ({
      id: thread.id,
      title: thread.标题,
      preview: getThreadPreview(thread),
      unread: thread.未读,
      type
    }));
  }, [commThreads]);

  // Forum / Moments
  const forumBoards = useMemo(() => normalizeForumBoards(phone.公共帖子?.板块), [phoneState]);

  const publicPosts = useMemo(() => {
    const posts = normalizeForumPosts(phone.公共帖子?.帖子, forumBoards);
    return [...posts].sort((a, b) => (b.timestampValue || 0) - (a.timestampValue || 0));
  }, [phoneState, forumBoards]);

  const forumPreview = useMemo(() => publicPosts.slice(0, 3), [publicPosts]);

  const visibleMoments = useMemo(() => {
    const posts = Array.isArray(phone.朋友圈?.帖子) ? phone.朋友圈.帖子 : [];
    if (!phone.朋友圈?.仅好友可见) return posts;
    return posts.filter(p => p.发布者 === playerName || friendSet.has(p.发布者));
  }, [phoneState, playerName, friendSet]);

  return {
    phone,
    sortedThreads,
    activeThread,
    totalUnread,
    specialContacts,
    nearbyContacts,
    validContacts,
    friendSet,
    commThreadItems,
    forumBoards,
    publicPosts,
    forumPreview,
    visibleMoments,
    getThreadList,
    getThreadPreview
  };
};

import type { GameState, PhonePendingMessage, PhoneState, PhoneThread } from '../../types';
import { isPlayerReference } from '../userPlaceholder';

const toText = (value: unknown): string => String(value ?? '').trim();
const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};
const toBool = (value: unknown): boolean => {
  const text = toText(value).toLowerCase();
  if (!text) return false;
  return ['1', 'true', 'yes', 'y', 'on', '是'].includes(text);
};
const FIXED_FORUM_BOARDS = ['欧拉丽快报', '地下城攻略', '眷族招募', '酒馆闲谈'];
const FIXED_FORUM_BOARD_IDS = ['board_news', 'board_dungeon', 'board_recruit', 'board_tavern'] as const;
const FIXED_FORUM_BOARD_SET = new Set(FIXED_FORUM_BOARDS);
const FIXED_FORUM_BOARD_NAME_TO_ID = new Map<string, string>(
  FIXED_FORUM_BOARDS.map((name, index) => [name, FIXED_FORUM_BOARD_IDS[index]])
);
const FIXED_FORUM_BOARD_ID_TO_NAME = new Map<string, string>(
  FIXED_FORUM_BOARDS.map((name, index) => [FIXED_FORUM_BOARD_IDS[index], name])
);
const normalizeFixedForumBoardName = (value: unknown): string => {
  const text = toText(value);
  return FIXED_FORUM_BOARD_SET.has(text) ? text : '';
};
const normalizeFixedForumBoardId = (value: unknown): string => {
  const text = toText(value);
  if (!text) return '';
  if (FIXED_FORUM_BOARD_ID_TO_NAME.has(text)) return text;
  return '';
};

const normalizeThreadType = (value: unknown): 'private' | 'group' | 'public' => {
  const text = toText(value).toLowerCase();
  if (text === 'group') return 'group';
  if (text === 'public') return 'public';
  return 'private';
};

const parseMembers = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }
  const text = toText(value);
  if (!text) return [];
  return text.split(/[,，]/g).map((item) => item.trim()).filter(Boolean);
};

const parseTagList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }
  const text = toText(value);
  if (!text) return [];
  return text.split(/[，,;；|]/g).map((item) => item.trim()).filter(Boolean);
};

const parseTrigger = (value: unknown): PhonePendingMessage['trigger'] => {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value as any;
  const text = toText(value);
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const buildMessageMergeKey = (message: any, fallbackKey: string): string => {
  const messageId = toText(message?.id);
  if (messageId) return `id:${messageId}`;
  const sender = toText(message?.发送者 || message?.sender);
  const content = toText(message?.内容 || message?.content);
  const timestamp = toText(message?.时间戳 || message?.timestamp);
  const signature = [sender, content, timestamp].filter(Boolean).join('|');
  return signature ? `sig:${signature}` : fallbackKey;
};

const mergeMessages = (primary: any[], legacy: any[]): any[] => {
  const map = new Map<string, any>();
  const pushMessage = (message: any, index: number, source: 'primary' | 'legacy') => {
    const key = buildMessageMergeKey(message, `${source}:${index}`);
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...message });
      return;
    }
    map.set(key, source === 'primary' ? { ...current, ...message } : { ...message, ...current });
  };
  legacy.forEach((message, index) => pushMessage(message, index, 'legacy'));
  primary.forEach((message, index) => pushMessage(message, index, 'primary'));
  return Array.from(map.values());
};

const mergeThreadList = (primary: PhoneThread[], legacy: PhoneThread[]): PhoneThread[] => {
  const map = new Map<string, PhoneThread>();
  const toThreadKey = (thread: PhoneThread, index: number, source: string) => {
    const id = toText(thread?.id);
    if (id) return `id:${id}`;
    const title = toText(thread?.标题);
    if (title) return `title:${title.toLowerCase()}`;
    return `${source}:${index}`;
  };
  legacy.forEach((thread, index) => {
    map.set(toThreadKey(thread, index, 'legacy'), {
      ...thread,
      成员: Array.isArray(thread?.成员) ? [...thread.成员] : [],
      消息: Array.isArray(thread?.消息) ? [...thread.消息] : []
    });
  });
  primary.forEach((thread, index) => {
    const key = toThreadKey(thread, index, 'primary');
    const current = map.get(key);
    if (!current) {
      map.set(key, {
        ...thread,
        成员: Array.isArray(thread?.成员) ? [...thread.成员] : [],
        消息: Array.isArray(thread?.消息) ? [...thread.消息] : []
      });
      return;
    }
    const members = Array.from(new Set([
      ...(Array.isArray(current.成员) ? current.成员 : []),
      ...(Array.isArray(thread.成员) ? thread.成员 : [])
    ]));
    map.set(key, {
      ...current,
      ...thread,
      成员: members,
      消息: mergeMessages(
        Array.isArray(thread.消息) ? thread.消息 : [],
        Array.isArray(current.消息) ? current.消息 : []
      ),
      未读: Math.max(Number(current.未读 || 0), Number(thread.未读 || 0))
    });
  });
  return Array.from(map.values());
};

const mergePendingList = (primary: PhonePendingMessage[], legacy: PhonePendingMessage[]): PhonePendingMessage[] => {
  const map = new Map<string, PhonePendingMessage>();
  legacy.forEach((item, index) => {
    const key = toText(item?.id) || `legacy:${index}`;
    map.set(key, { ...item });
  });
  primary.forEach((item, index) => {
    const key = toText(item?.id) || `primary:${index}`;
    const current = map.get(key);
    map.set(key, current ? { ...current, ...item } : { ...item });
  });
  return Array.from(map.values());
};

const createDefaultPhoneState = (): PhoneState => ({
  设备: { 电量: 0, 当前信号: 0, 状态: 'offline' },
  联系人: { 好友: [], 黑名单: [], 最近: [] },
  对话: { 私聊: [], 群聊: [], 公共频道: [] },
  朋友圈: { 仅好友可见: true, 帖子: [] },
  公共帖子: { 板块: [], 帖子: [] },
  待发送: []
});

type PhoneSheetId =
  | 'PHONE_Device'
  | 'PHONE_Contacts'
  | 'PHONE_Threads'
  | 'PHONE_Messages'
  | 'PHONE_Pending'
  | 'FORUM_Boards'
  | 'FORUM_Posts'
  | 'FORUM_Replies'
  | 'PHONE_Moments';

const readSheetRows = (state: GameState, sheetId: PhoneSheetId): Record<string, unknown>[] => {
  const store = (state as any).__tableRows;
  if (!store || typeof store !== 'object' || Array.isArray(store)) return [];
  const rows = store[sheetId];
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
    .map((row) => ({ ...row }));
};

const buildMomentsFromRows = (rows: Record<string, unknown>[]) => {
  return rows
    .map((row, index) => {
      const id = toText(row.moment_id || row.id) || `Moment_${index + 1}`;
      const sender = toText(row.发布者 || row.sender);
      const content = toText(row.内容 || row.content);
      if (!sender || !content) return null;
      const visibilityText = toText(row.可见性 || row.visibility).toLowerCase();
      const visibility: 'friends' | 'public' = visibilityText === 'public' ? 'public' : 'friends';
      return {
        id,
        发布者: sender,
        头像: toText(row.头像 || row.avatar) || undefined,
        内容: content,
        时间戳: toText(row.时间戳 || row.timestamp),
        timestampValue: Number.isFinite(Number(row.timestamp_value)) ? Number(row.timestamp_value) : undefined,
        点赞数: Math.max(0, toNumber(row.点赞数 ?? row.likes, 0)),
        评论: [],
        图片描述: toText(row.图片描述 || row.image_desc) || undefined,
        可见性: visibility,
        话题: parseTagList(row.话题标签 || row.话题 || row.tags)
      };
    })
    .filter((item): item is any => !!item);
};

const buildForumFromRows = (
  boardRows: Record<string, unknown>[],
  postRows: Record<string, unknown>[],
  replyRows: Record<string, unknown>[]
) => {
  const boardMetaByName = new Map<string, { id: string; 图标?: string; 颜色?: string; 描述?: string }>();
  boardRows.forEach((row, index) => {
    const name = normalizeFixedForumBoardName(row.名称 || row.name);
    if (!name || boardMetaByName.has(name)) return;
    boardMetaByName.set(name, {
      id: normalizeFixedForumBoardId(row.board_id || row.id) || FIXED_FORUM_BOARD_NAME_TO_ID.get(name) || `board_${index + 1}`,
      图标: toText(row.图标 || row.icon) || undefined,
      颜色: toText(row.颜色 || row.color) || undefined,
      描述: toText(row.描述 || row.description) || undefined
    });
  });
  const boards = FIXED_FORUM_BOARDS.map((name, index) => {
    const meta = boardMetaByName.get(name);
    return {
      id: meta?.id || FIXED_FORUM_BOARD_NAME_TO_ID.get(name) || `board_${index + 1}`,
      名称: name,
      图标: meta?.图标,
      颜色: meta?.颜色,
      描述: meta?.描述
    };
  });

  const boardNameById = new Map<string, string>();
  boards.forEach((board) => {
    const id = toText(board.id);
    const name = toText(board.名称);
    if (id && name) boardNameById.set(id, name);
  });

  const replyMap = new Map<string, any[]>();
  replyRows.forEach((row, index) => {
    const postId = toText(row.post_id);
    const sender = toText(row.发布者 || row.sender);
    const content = toText(row.内容 || row.content);
    if (!postId || !sender || !content) return;
    const id = toText(row.reply_id || row.id) || `${postId}_reply_${index + 1}`;
    const list = replyMap.get(postId) || [];
    list.push({
      id,
      楼层: Math.max(1, toNumber(row.楼层 ?? row.floor, list.length + 1)),
      发布者: sender,
      头像: toText(row.头像 || row.avatar) || undefined,
      内容: content,
      时间戳: toText(row.时间戳 || row.timestamp),
      引用楼层: Number.isFinite(Number(row.引用楼层 ?? row.quote_floor))
        ? Number(row.引用楼层 ?? row.quote_floor)
        : undefined,
      点赞数: Number.isFinite(Number(row.点赞数 ?? row.likes)) ? Number(row.点赞数 ?? row.likes) : undefined
    });
    replyMap.set(postId, list);
  });

  const posts = postRows
    .map((row, index) => {
      const id = toText(row.post_id || row.id) || `Forum_${index + 1}`;
      const title = toText(row.标题 || row.title);
      const content = toText(row.内容 || row.content);
      const sender = toText(row.发布者 || row.sender);
      if (!title || !content || !sender) return null;
      const boardId = normalizeFixedForumBoardId(row.board_id || row.boardId);
      const directBoardName = normalizeFixedForumBoardName(row.board_name || row.板块);
      const idBoardName = boardId
        ? (normalizeFixedForumBoardName(boardNameById.get(boardId)) || normalizeFixedForumBoardName(FIXED_FORUM_BOARD_ID_TO_NAME.get(boardId)))
        : '';
      const boardName = directBoardName || idBoardName || FIXED_FORUM_BOARDS[0];
      const replies = (replyMap.get(id) || []).slice().sort((a, b) => (a.楼层 || 0) - (b.楼层 || 0));
      return {
        id,
        标题: title,
        内容: content,
        发布者: sender,
        头像: toText(row.头像 || row.avatar) || undefined,
        时间戳: toText(row.时间戳 || row.timestamp),
        timestampValue: Number.isFinite(Number(row.timestamp_value)) ? Number(row.timestamp_value) : undefined,
        板块: boardName,
        话题标签: parseTagList(row.话题标签 || row.tags),
        置顶: toBool(row.置顶 || row.pinned),
        精华: toBool(row.精华 || row.featured),
        浏览数: Number.isFinite(Number(row.浏览数 ?? row.views)) ? Number(row.浏览数 ?? row.views) : undefined,
        点赞数: Math.max(0, toNumber(row.点赞数 ?? row.likes, 0)),
        回复: replies,
        图片描述: toText(row.图片描述 || row.image_desc) || undefined
      };
    })
    .filter((item): item is any => !!item);

  return { boards, posts };
};

const buildPhoneThreadsFromRows = (threadRows: Record<string, unknown>[]) => {
  const threadMap = new Map<string, PhoneThread>();
  const privateThreads: PhoneThread[] = [];
  const groupThreads: PhoneThread[] = [];
  const publicThreads: PhoneThread[] = [];

  threadRows.forEach((row, index) => {
    const threadId = toText(row.thread_id) || `Thr_${index + 1}`;
    const threadType = normalizeThreadType(row.type);
    const thread: PhoneThread = {
      id: threadId,
      类型: threadType,
      标题: toText(row.title) || threadId,
      成员: parseMembers(row.members),
      消息: [],
      未读: toNumber(row.unread, 0),
      置顶: toBool(row.pinned),
      摘要: toText(row.summary) || undefined,
      摘要时间: toText(row.summary_time) || undefined
    };
    threadMap.set(threadId, thread);
    if (threadType === 'group') groupThreads.push(thread);
    else if (threadType === 'public') publicThreads.push(thread);
    else privateThreads.push(thread);
  });

  return { threadMap, privateThreads, groupThreads, publicThreads };
};

const attachMessages = (
  threadMap: Map<string, PhoneThread>,
  privateThreads: PhoneThread[],
  groupThreads: PhoneThread[],
  publicThreads: PhoneThread[],
  messageRows: Record<string, unknown>[]
) => {
  const ensureThread = (threadId: string, threadType: 'private' | 'group' | 'public', title?: string): PhoneThread => {
    const existed = threadMap.get(threadId);
    if (existed) return existed;
    const created: PhoneThread = {
      id: threadId,
      类型: threadType,
      标题: title || threadId,
      成员: [],
      消息: [],
      未读: 0
    };
    threadMap.set(threadId, created);
    if (threadType === 'group') groupThreads.push(created);
    else if (threadType === 'public') publicThreads.push(created);
    else privateThreads.push(created);
    return created;
  };

  messageRows.forEach((row, index) => {
    const threadId = toText(row.thread_id);
    if (!threadId) return;
    const messageId = toText(row.message_id) || `${threadId}_msg_${index + 1}`;
    const threadType = normalizeThreadType(row.thread_type);
    const threadTitle = toText(row.thread_title);
    const thread = ensureThread(threadId, threadType, threadTitle);
    thread.消息.push({
      id: messageId,
      发送者: toText(row.sender) || '系统',
      内容: toText(row.content),
      时间戳: toText(row.timestamp),
      类型: toText(row.msg_type) || 'text',
      状态: toText(row.status) || undefined,
      送达时间: toText(row.deliver_at) || undefined
    } as any);
  });
};

export interface BuildPhoneStateOptions {
  fallback?: PhoneState;
  allowFallbackWhenEmpty?: boolean;
  preserveLegacySocialFeeds?: boolean;
  mergeLegacyDialog?: boolean;
}

export const buildPhoneStateFromTables = (
  gameState: GameState,
  options: BuildPhoneStateOptions = {}
): PhoneState => {
  const base = createDefaultPhoneState();
  const fallback = options.fallback;
  const preserveLegacySocialFeeds = options.preserveLegacySocialFeeds === true;
  const mergeLegacyDialog = options.mergeLegacyDialog === true;
  const deviceRows = readSheetRows(gameState, 'PHONE_Device');
  const contactRows = readSheetRows(gameState, 'PHONE_Contacts');
  const threadRows = readSheetRows(gameState, 'PHONE_Threads');
  const messageRows = readSheetRows(gameState, 'PHONE_Messages');
  const pendingRows = readSheetRows(gameState, 'PHONE_Pending');
  const forumBoardRows = readSheetRows(gameState, 'FORUM_Boards');
  const forumPostRows = readSheetRows(gameState, 'FORUM_Posts');
  const forumReplyRows = readSheetRows(gameState, 'FORUM_Replies');
  const momentRows = readSheetRows(gameState, 'PHONE_Moments');
  const hasAnyPhoneRows =
    deviceRows.length > 0
    || contactRows.length > 0
    || threadRows.length > 0
    || messageRows.length > 0
    || pendingRows.length > 0
    || forumBoardRows.length > 0
    || forumPostRows.length > 0
    || forumReplyRows.length > 0
    || momentRows.length > 0;

  if (!hasAnyPhoneRows && options.allowFallbackWhenEmpty && fallback) {
    return {
      设备: { ...fallback.设备 },
      联系人: {
        好友: [...(fallback.联系人?.好友 || [])],
        黑名单: [...(fallback.联系人?.黑名单 || [])],
        最近: [...(fallback.联系人?.最近 || [])]
      },
      对话: {
        私聊: [...(fallback.对话?.私聊 || [])],
        群聊: [...(fallback.对话?.群聊 || [])],
        公共频道: [...(fallback.对话?.公共频道 || [])]
      },
      朋友圈: {
        仅好友可见: fallback.朋友圈?.仅好友可见 ?? true,
        帖子: [...(fallback.朋友圈?.帖子 || [])]
      },
      公共帖子: {
        板块: [...(fallback.公共帖子?.板块 || [])],
        帖子: [...(fallback.公共帖子?.帖子 || [])]
      },
      待发送: [...(fallback.待发送 || [])]
    };
  }

  const lastDevice = deviceRows[deviceRows.length - 1] || {};

  const friends = new Set<string>();
  const blacklist = new Set<string>();
  const recent = new Set<string>();
  const playerName = gameState.角色?.姓名;
  contactRows.forEach((row) => {
    const name = toText(row.name || row.contact_id);
    if (!name) return;
    if (isPlayerReference(name, playerName)) return;
    const isBlack = toBool(row.blacklisted) || toText(row.bucket).toLowerCase() === 'blacklist';
    if (isBlack) blacklist.add(name);
    else friends.add(name);
    if (toBool(row.recent)) recent.add(name);
  });

  const { threadMap, privateThreads, groupThreads, publicThreads } = buildPhoneThreadsFromRows(threadRows);
  attachMessages(threadMap, privateThreads, groupThreads, publicThreads, messageRows);

  const pending: PhonePendingMessage[] = pendingRows.map((row, index) => ({
    id: toText(row.pending_id) || `pending_${index + 1}`,
    threadId: toText(row.thread_id),
    threadType: normalizeThreadType(row.thread_type),
    threadTitle: toText(row.thread_title) || undefined,
    deliverAt: toText(row.deliver_at),
    status: (toText(row.status) || 'scheduled') as any,
    payload: {
      id: `${toText(row.pending_id) || `pending_${index + 1}`}_payload`,
      发送者: '系统',
      内容: toText(row.payload_preview),
      时间戳: toText(row.deliver_at),
      类型: 'text',
      状态: 'pending'
    } as any,
    trigger: parseTrigger(row.trigger)
  }));
  const moments = buildMomentsFromRows(momentRows);
  const forumData = buildForumFromRows(forumBoardRows, forumPostRows, forumReplyRows);

  const mergedPrivate = mergeLegacyDialog && fallback
    ? mergeThreadList(privateThreads, fallback.对话?.私聊 || [])
    : privateThreads;
  const mergedGroup = mergeLegacyDialog && fallback
    ? mergeThreadList(groupThreads, fallback.对话?.群聊 || [])
    : groupThreads;
  const mergedPublic = mergeLegacyDialog && fallback
    ? mergeThreadList(publicThreads, fallback.对话?.公共频道 || [])
    : publicThreads;
  const mergedPending = mergeLegacyDialog && fallback
    ? mergePendingList(pending, fallback.待发送 || [])
    : pending;
  const fallbackDevice = fallback?.设备;
  const fallbackFriends = fallback?.联系人?.好友 || [];
  const fallbackBlacklist = fallback?.联系人?.黑名单 || [];
  const fallbackRecent = fallback?.联系人?.最近 || [];
  const mergedFriends = mergeLegacyDialog && fallback
    ? Array.from(new Set([...fallbackFriends, ...Array.from(friends)]))
    : Array.from(friends);
  const mergedBlacklist = mergeLegacyDialog && fallback
    ? Array.from(new Set([...fallbackBlacklist, ...Array.from(blacklist)]))
    : Array.from(blacklist);
  const mergedRecent = mergeLegacyDialog && fallback
    ? Array.from(new Set([...fallbackRecent, ...Array.from(recent)]))
    : Array.from(recent);

  return {
    设备: {
      电量: toNumber(lastDevice.battery, mergeLegacyDialog && fallbackDevice ? fallbackDevice.电量 ?? base.设备.电量 : base.设备.电量),
      当前信号: toNumber(lastDevice.signal, mergeLegacyDialog && fallbackDevice ? fallbackDevice.当前信号 ?? base.设备.当前信号 : base.设备.当前信号),
      状态: toText(lastDevice.status) || (mergeLegacyDialog && fallbackDevice ? fallbackDevice.状态 : '') || base.设备.状态 || 'offline'
    },
    联系人: {
      好友: mergedFriends,
      黑名单: mergedBlacklist,
      最近: mergedRecent
    },
    对话: {
      私聊: mergedPrivate,
      群聊: mergedGroup,
      公共频道: mergedPublic
    },
    朋友圈: preserveLegacySocialFeeds && fallback
      ? {
          仅好友可见: fallback.朋友圈?.仅好友可见 ?? true,
          帖子: [...(fallback.朋友圈?.帖子 || [])]
        }
      : {
          仅好友可见: moments.every((post) => post.可见性 !== 'public'),
          帖子: moments
        },
    公共帖子: preserveLegacySocialFeeds && fallback
      ? {
          板块: [...(fallback.公共帖子?.板块 || [])],
          帖子: [...(fallback.公共帖子?.帖子 || [])]
        }
      : {
          板块: forumData.boards,
          帖子: forumData.posts
        },
    待发送: mergedPending
  };
};

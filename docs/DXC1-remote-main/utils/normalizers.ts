import type { NewsItem, RumorItem } from '../types';
import type { ForumBoard, ForumPost, ForumReply, PhonePost } from '../types';

const FIXED_FORUM_BOARDS = ['欧拉丽快报', '地下城攻略', '眷族招募', '酒馆闲谈'];
const FIXED_FORUM_BOARD_SET = new Set(FIXED_FORUM_BOARDS);
const FIXED_FORUM_BOARD_IDS = ['board_news', 'board_dungeon', 'board_recruit', 'board_tavern'] as const;
const DEFAULT_FORUM_BOARD_NAME = FIXED_FORUM_BOARDS[0];
const FIXED_FORUM_BOARD_NAME_TO_ID = new Map<string, string>(
  FIXED_FORUM_BOARDS.map((name, index) => [name, FIXED_FORUM_BOARD_IDS[index]])
);
const FIXED_FORUM_BOARD_ID_TO_NAME = new Map<string, string>(
  FIXED_FORUM_BOARDS.map((name, index) => [FIXED_FORUM_BOARD_IDS[index], name])
);

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const toBoardId = (name: string, index: number) => {
  const trimmed = name.trim();
  if (!trimmed) return `board_${index + 1}`;
  return FIXED_FORUM_BOARD_NAME_TO_ID.get(trimmed) || `board_${index + 1}`;
};

const normalizeForumBoardName = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return FIXED_FORUM_BOARD_SET.has(text) ? text : '';
};

const normalizeForumBoardId = (value: unknown): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (FIXED_FORUM_BOARD_ID_TO_NAME.has(text)) return text;
  return '';
};

const coerceText = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
};

const coerceNumber = (value: unknown, fallback: number) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const coerceTagList = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((tag) => typeof tag === 'string' && tag.trim().length > 0);
};

const coerceCredibility = (value: unknown): RumorItem['可信度'] => {
  if (value === 'verified' || value === 'likely' || value === 'rumor' || value === 'fake') return value;
  return 'likely';
};

const coerceImportance = (value: unknown): NewsItem['重要度'] => {
  if (value === 'urgent' || value === 'normal' || value === 'minor') return value;
  return 'normal';
};

export const normalizeNewsItems = (items: unknown, gameTime?: string): NewsItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: createId('news'),
        标题: item,
        时间戳: gameTime || '未知',
        来源: 'guild',
        重要度: 'normal'
      };
    }
    const input = item as Partial<NewsItem> & { 标题?: unknown };
    return {
      id: coerceText(input.id, createId('news')),
      标题: coerceText(input.标题, '未命名新闻'),
      内容: typeof input.内容 === 'string' ? input.内容 : undefined,
      时间戳: coerceText(input.时间戳, gameTime || '未知'),
      来源: coerceText(input.来源, 'guild'),
      重要度: coerceImportance(input.重要度),
      关联传闻: typeof input.关联传闻 === 'string' ? input.关联传闻 : undefined
    };
  });
};

export const normalizeRumorItems = (items: unknown, gameTime?: string): RumorItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const input = item as Partial<RumorItem> & { 主题?: unknown; 传播度?: unknown };
    const subject = coerceText(input?.主题, '未知传闻');
    const spread = Math.max(0, Math.min(100, coerceNumber(input?.传播度, 0)));
    const content = typeof input?.内容 === 'string' ? input.内容 : subject;
    return {
      id: coerceText(input?.id, createId('rumor')),
      主题: subject,
      内容: content,
      传播度: spread,
      可信度: coerceCredibility(input?.可信度),
      来源: typeof input?.来源 === 'string' ? input.来源 : undefined,
      话题标签: coerceTagList(input?.话题标签),
      发现时间: typeof input?.发现时间 === 'string' ? input.发现时间 : gameTime,
      评论数: typeof input?.评论数 === 'number' ? input.评论数 : undefined,
      已升级为新闻: typeof input?.已升级为新闻 === 'boolean' ? input.已升级为新闻 : undefined,
      关联新闻: typeof input?.关联新闻 === 'string' ? input.关联新闻 : undefined
    };
  });
};

export const normalizeForumBoards = (boards: unknown, _fallback: string[] = FIXED_FORUM_BOARDS): ForumBoard[] => {
  const metaByName = new Map<string, Partial<ForumBoard>>();
  if (Array.isArray(boards)) {
    boards.forEach((board) => {
      if (typeof board === 'string') {
        const name = normalizeForumBoardName(board);
        if (!name || metaByName.has(name)) return;
        metaByName.set(name, {});
        return;
      }
      const input = board as Partial<ForumBoard> & { 名称?: unknown };
      const name = normalizeForumBoardName(input.名称);
      if (!name || metaByName.has(name)) return;
      metaByName.set(name, {
        id: normalizeForumBoardId(input.id),
        图标: typeof input.图标 === 'string' ? input.图标 : undefined,
        颜色: typeof input.颜色 === 'string' ? input.颜色 : undefined,
        描述: typeof input.描述 === 'string' ? input.描述 : undefined
      });
    });
  }
  return FIXED_FORUM_BOARDS.map((name, index) => {
    const meta = metaByName.get(name);
    return {
      id: coerceText(meta?.id, toBoardId(name, index)),
      名称: name,
      图标: typeof meta?.图标 === 'string' ? meta.图标 : undefined,
      颜色: typeof meta?.颜色 === 'string' ? meta.颜色 : undefined,
      描述: typeof meta?.描述 === 'string' ? meta.描述 : undefined
    };
  });
};

const resolveForumBoard = (post: any, boards: ForumBoard[]) => {
  const rawBoardId = typeof post?.board_id === 'string'
    ? post.board_id.trim()
    : (typeof post?.boardId === 'string' ? post.boardId.trim() : '');
  const boardId = normalizeForumBoardId(rawBoardId);
  if (boardId) {
    const matchedBoard = boards.find((board) => normalizeForumBoardId(board?.id) === boardId);
    const matchedName = normalizeForumBoardName(matchedBoard?.名称);
    if (matchedName) return matchedName;
    const mappedName = normalizeForumBoardName(FIXED_FORUM_BOARD_ID_TO_NAME.get(boardId));
    if (mappedName) return mappedName;
  }
  const candidates: string[] = [];
  if (typeof post?.板块 === 'string') candidates.push(post.板块);
  if (typeof post?.board_name === 'string') candidates.push(post.board_name);
  if (typeof post?.boardName === 'string') candidates.push(post.boardName);
  if (Array.isArray(post?.话题标签) && post.话题标签.length > 0) candidates.push(post.话题标签[0]);
  if (Array.isArray(post?.话题) && post.话题.length > 0) candidates.push(post.话题[0]);
  if (typeof post?.来源 === 'string') candidates.push(post.来源);
  const match = candidates
    .map((name) => normalizeForumBoardName(name))
    .find((name) => !!name);
  return match || DEFAULT_FORUM_BOARD_NAME;
};

const normalizeForumReplies = (replies: unknown, gameTime?: string): ForumReply[] => {
  if (!Array.isArray(replies)) return [];
  return replies.map((reply, index) => {
    const input = reply as Partial<ForumReply> & { 内容?: unknown; 发布者?: unknown };
    return {
      id: coerceText(input.id, createId('reply')),
      楼层: typeof input.楼层 === 'number' ? input.楼层 : index + 1,
      发布者: coerceText(input.发布者, '匿名'),
      头像: typeof input.头像 === 'string' ? input.头像 : undefined,
      内容: coerceText(input.内容, ''),
      时间戳: coerceText(input.时间戳, gameTime || '未知'),
      引用楼层: typeof input.引用楼层 === 'number' ? input.引用楼层 : undefined,
      点赞数: typeof input.点赞数 === 'number' ? input.点赞数 : undefined
    };
  });
};

const normalizeLegacyComments = (comments: unknown, gameTime?: string): ForumReply[] => {
  if (!Array.isArray(comments)) return [];
  return comments.map((comment, index) => {
    const input = comment as { 用户?: unknown; 内容?: unknown };
    return {
      id: createId('reply'),
      楼层: index + 1,
      发布者: coerceText(input.用户, '匿名'),
      内容: coerceText(input.内容, ''),
      时间戳: gameTime || '未知'
    };
  });
};

export const normalizeForumPosts = (posts: unknown, boards: ForumBoard[] = [], gameTime?: string): ForumPost[] => {
  if (!Array.isArray(posts)) return [];
  return posts.map((post, index) => {
    const input = post as Partial<ForumPost> & Partial<PhonePost> & { 标题?: unknown };
    const boardName = resolveForumBoard(input, boards) || DEFAULT_FORUM_BOARD_NAME;
    const content = coerceText(input.内容, '');
    const title = coerceText(input.标题, content.slice(0, 20) || '未命名帖子');
    const replyList = Array.isArray(input.回复)
      ? normalizeForumReplies(input.回复, input.时间戳 || gameTime)
      : normalizeLegacyComments((input as PhonePost).评论, input.时间戳 || gameTime);
    return {
      id: coerceText(input.id, createId('forum')),
      标题: title,
      内容: content,
      发布者: coerceText(input.发布者, '匿名'),
      头像: typeof input.头像 === 'string' ? input.头像 : undefined,
      时间戳: coerceText(input.时间戳, gameTime || '未知'),
      timestampValue: typeof input.timestampValue === 'number' ? input.timestampValue : undefined,
      板块: boardName,
      话题标签: coerceTagList(input.话题标签 || (input as PhonePost).话题),
      置顶: typeof input.置顶 === 'boolean' ? input.置顶 : undefined,
      精华: typeof input.精华 === 'boolean' ? input.精华 : undefined,
      浏览数: typeof input.浏览数 === 'number' ? input.浏览数 : undefined,
      点赞数: typeof input.点赞数 === 'number' ? input.点赞数 : 0,
      回复: replyList,
      图片描述: typeof input.图片描述 === 'string' ? input.图片描述 : undefined
    };
  }).filter((post) => !!post) as ForumPost[];
};

export const normalizePhoneState = (phone: any) => {
  if (!phone) return phone;
  const boards = normalizeForumBoards(phone.公共帖子?.板块);
  const posts = normalizeForumPosts(phone.公共帖子?.帖子, boards);
  return {
    ...phone,
    公共帖子: {
      ...(phone.公共帖子 || {}),
      板块: boards,
      帖子: posts
    }
  };
};

export const normalizeWorldState = (world: any, gameTime?: string) => {
  if (!world) return world;
  return {
    ...world,
    头条新闻: normalizeNewsItems(world.头条新闻, gameTime),
    街头传闻: normalizeRumorItems(world.街头传闻, gameTime)
  };
};

import { describe, expect, it } from 'vitest';
import { normalizeForumBoards, normalizeForumPosts } from '../utils/normalizers';

describe('forum normalizers (strict new boards)', () => {
  it('only keeps canonical board ids and names', () => {
    const boards = normalizeForumBoards([
      { id: 'board_news', 名称: '欧拉丽快报' },
      { id: 'board_2', 名称: '地下城攻略' },
      { id: 'legacy_hot', 名称: '热门' }
    ]);

    expect(boards.map((board) => board.id)).toEqual([
      'board_news',
      'board_dungeon',
      'board_recruit',
      'board_tavern'
    ]);
  });

  it('routes invalid board_id posts to default new board', () => {
    const boards = normalizeForumBoards([]);
    const posts = normalizeForumPosts([
      {
        id: 'Forum_Legacy_Id_001',
        board_id: 'board_2',
        标题: '旧ID帖子',
        内容: '仅有 legacy board_id',
        发布者: '匿名冒险者',
        时间戳: '第2日 09:00',
        回复: []
      }
    ], boards);

    expect(posts).toHaveLength(1);
    expect(posts[0].板块).toBe('欧拉丽快报');
  });

  it('routes invalid board_name posts to default new board', () => {
    const boards = normalizeForumBoards([]);
    const posts = normalizeForumPosts([
      {
        id: 'Forum_Legacy_Name_001',
        标题: '旧版板块名',
        内容: '板块=闲聊',
        发布者: '匿名冒险者',
        板块: '闲聊',
        时间戳: '第2日 09:10',
        回复: []
      }
    ], boards);

    expect(posts).toHaveLength(1);
    expect(posts[0].板块).toBe('欧拉丽快报');
  });
});

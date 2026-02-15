import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../../utils/dataMapper';
import { buildPhoneStateFromTables } from '../../utils/taverndb/phoneTableAdapter';

describe('phone table adapter', () => {
  it('does not fallback to legacy phone fields when PHONE sheets are empty', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.手机.设备.电量 = 77;
    state.手机.设备.当前信号 = 4;
    state.手机.对话.私聊 = [
      {
        id: 'ThrLegacy',
        类型: 'private',
        标题: 'legacy',
        成员: ['Tester', 'legacy'],
        消息: [{ id: 'MsgLegacy', 发送者: 'legacy', 内容: 'legacy', 时间戳: '第1日 10:00' }]
      }
    ];

    const phone = buildPhoneStateFromTables(state);
    expect(phone.设备.电量).toBe(0);
    expect(phone.设备.当前信号).toBe(0);
    expect(phone.对话.私聊).toHaveLength(0);
  });

  it('rebuilds phone state from PHONE_* rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.__tableRows = {
      PHONE_Device: [
        { device_id: 'device_main', status: 'online', battery: 66, signal: 3, last_seen: '第2日 09:00' }
      ],
      PHONE_Contacts: [
        { contact_id: 'hestia', name: '赫斯缇雅', bucket: 'friend', blacklisted: 'no', recent: 'yes' }
      ],
      PHONE_Threads: [
        { thread_id: 'Thr100', type: 'private', title: '赫斯缇雅', members: 'Tester,赫斯缇雅', unread: 1, pinned: 'yes' }
      ],
      PHONE_Messages: [
        { message_id: 'Msg100', thread_id: 'Thr100', sender: '赫斯缇雅', content: '到公会门口了', timestamp: '第2日 09:05' }
      ],
      PHONE_Pending: [
        { pending_id: 'Pending100', thread_id: 'Thr100', thread_type: 'private', deliver_at: '第2日 10:00', status: 'scheduled' }
      ]
    };

    const phone = buildPhoneStateFromTables(state);
    expect(phone.设备.电量).toBe(66);
    expect(phone.联系人.好友).toEqual(['赫斯缇雅']);
    expect(phone.对话.私聊).toHaveLength(1);
    expect(phone.对话.私聊[0].id).toBe('Thr100');
    expect(phone.对话.私聊[0].消息).toHaveLength(1);
    expect(phone.对话.私聊[0].消息[0].id).toBe('Msg100');
    expect(phone.待发送?.[0].id).toBe('Pending100');
  });

  it('filters player placeholders from PHONE_Contacts rows', () => {
    const state = createNewGameState('贝尔', '男', 'Human') as any;
    state.__tableRows = {
      PHONE_Contacts: [
        { contact_id: '{{user}}', name: '{{user}}', bucket: 'friend', blacklisted: 'no', recent: 'yes' },
        { contact_id: 'player', name: 'player', bucket: 'friend', blacklisted: 'no', recent: 'yes' },
        { contact_id: '贝尔', name: '贝尔', bucket: 'friend', blacklisted: 'no', recent: 'yes' },
        { contact_id: '莉莉', name: '莉莉', bucket: 'friend', blacklisted: 'no', recent: 'yes' }
      ]
    };

    const phone = buildPhoneStateFromTables(state);
    expect(phone.联系人.好友).toEqual(['莉莉']);
  });

  it('rebuilds social feeds from FORUM_* and PHONE_Moments rows', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.__tableRows = {
      FORUM_Boards: [
        { board_id: 'board_news', 名称: '欧拉丽快报', 描述: '快报信息' }
      ],
      FORUM_Posts: [
        {
          post_id: 'Forum_001',
          board_id: 'board_news',
          标题: '怪物祭筹备',
          内容: '主街已经开始封路',
          发布者: '路人冒险者',
          时间戳: '第2日 09:00'
        }
      ],
      FORUM_Replies: [
        {
          reply_id: 'Forum_001_reply_1',
          post_id: 'Forum_001',
          楼层: 1,
          发布者: 'Tester',
          内容: '收到',
          时间戳: '第2日 09:05'
        }
      ],
      PHONE_Moments: [
        {
          moment_id: 'Moment_001',
          发布者: 'Tester',
          内容: '刚到公会',
          时间戳: '第2日 08:30',
          可见性: 'friends',
          点赞数: 2
        }
      ]
    };

    const phone = buildPhoneStateFromTables(state);
    expect(phone.公共帖子?.板块?.some((board) => board.名称 === '欧拉丽快报')).toBe(true);
    const forumPost = phone.公共帖子?.帖子?.find((post) => post.id === 'Forum_001');
    expect(forumPost?.标题).toBe('怪物祭筹备');
    expect(forumPost?.回复?.some((reply) => reply.id === 'Forum_001_reply_1')).toBe(true);
    expect(phone.朋友圈.帖子.some((post) => post.id === 'Moment_001')).toBe(true);
  });

  it('routes invalid forum board ids to default new board', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.__tableRows = {
      FORUM_Posts: [
        {
          post_id: 'Forum_Legacy_001',
          board_id: 'board_2',
          标题: '旧板块ID兼容测试',
          内容: '如果映射正确，这条帖子应落到地下城攻略',
          发布者: '路人冒险者',
          时间戳: '第2日 10:00'
        }
      ]
    };

    const phone = buildPhoneStateFromTables(state);
    const post = phone.公共帖子?.帖子?.find((item) => item.id === 'Forum_Legacy_001');
    expect(post).toBeDefined();
    expect(post?.板块).toBe('欧拉丽快报');
  });

  it('can merge legacy dialog updates for transitional UI rendering', () => {
    const state = createNewGameState('Tester', '男', 'Human') as any;
    state.__tableRows = {
      PHONE_Threads: [
        { thread_id: 'Thr100', type: 'private', title: '赫斯缇雅', members: 'Tester,赫斯缇雅', unread: 0 }
      ],
      PHONE_Messages: [
        { message_id: 'Msg100', thread_id: 'Thr100', sender: '赫斯缇雅', content: '旧消息', timestamp: '第2日 09:05' }
      ]
    };
    state.手机.对话.私聊 = [
      {
        id: 'Thr100',
        类型: 'private',
        标题: '赫斯缇雅',
        成员: ['Tester', '赫斯缇雅'],
        消息: [
          { id: 'Msg100', 发送者: '赫斯缇雅', 内容: '旧消息', 时间戳: '第2日 09:05' },
          { id: 'Msg101', 发送者: 'Tester', 内容: '新发出的消息', 时间戳: '第2日 09:06' }
        ],
        未读: 0
      }
    ];

    const phone = buildPhoneStateFromTables(state, {
      fallback: state.手机,
      allowFallbackWhenEmpty: true,
      mergeLegacyDialog: true
    });

    const thread = phone.对话.私聊.find((item) => item.id === 'Thr100');
    expect(thread).toBeDefined();
    expect(thread?.消息.some((msg) => msg.id === 'Msg100')).toBe(true);
    expect(thread?.消息.some((msg) => msg.id === 'Msg101')).toBe(true);
  });
});

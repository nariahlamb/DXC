import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SocialPhoneModal } from './SocialPhoneModal';
import type { Confidant, PhoneState } from '../../../types';

const createContacts = (): Confidant[] => [
  {
    id: 'c-1',
    姓名: '莉莉',
    种族: '人类',
    眷族: '赫斯缇雅',
    身份: '冒险者',
    好感度: 60,
    关系状态: '友好',
    是否在场: true,
    已交换联系方式: true,
    特别关注: false,
    记忆: [],
    等级: 2,
  },
  {
    id: 'c-2',
    姓名: '贝尔',
    种族: '人类',
    眷族: '赫斯缇雅',
    身份: '冒险者',
    好感度: 75,
    关系状态: '友好',
    是否在场: true,
    已交换联系方式: true,
    特别关注: true,
    记忆: [],
    等级: 3,
  },
];

const createPhoneState = (): PhoneState => ({
  设备: { 电量: 80, 当前信号: 4, 状态: 'online' },
  联系人: { 好友: ['莉莉'], 黑名单: [], 最近: [] },
  对话: {
    私聊: [
      {
        id: 'private-1',
        类型: 'private',
        标题: '莉莉',
        成员: ['玩家', '莉莉'],
        未读: 1,
        消息: [
          {
            id: 'msg-1',
            发送者: '莉莉',
            内容: '在吗？',
            时间戳: '第1日 08:00',
            状态: 'received',
          },
        ],
      },
    ],
    群聊: [],
    公共频道: [],
  },
  朋友圈: { 仅好友可见: true, 帖子: [] },
  公共帖子: {
    板块: [
      { id: 'board_news', 名称: '欧拉丽快报' },
      { id: 'board_dungeon', 名称: '地下城攻略' },
    ],
    帖子: [
      {
        id: 'post-1',
        标题: '测试帖子A',
        内容: '论坛内容A',
        发布者: '莉莉',
        时间戳: '第1日 08:10',
        板块: '欧拉丽快报',
        点赞数: 0,
        回复: [],
      },
      {
        id: 'post-2',
        标题: '测试帖子B',
        内容: '论坛内容B',
        发布者: '贝尔',
        时间戳: '第1日 08:20',
        板块: '地下城攻略',
        点赞数: 1,
        回复: [],
      },
    ],
  },
  待发送: [],
});

const createProps = (overrides: Partial<React.ComponentProps<typeof SocialPhoneModal>> = {}): React.ComponentProps<typeof SocialPhoneModal> => ({
  isOpen: true,
  onClose: vi.fn(),
  phoneState: createPhoneState(),
  contacts: createContacts(),
  playerName: '玩家',
  initialTab: 'COMM',
  onSendMessage: vi.fn(),
  onReplyForumPost: vi.fn(),
  onReadThread: vi.fn(),
  onCreateMoment: vi.fn(),
  onCreatePublicPost: vi.fn(),
  onLikeForumPost: vi.fn(),
  onRefreshForum: vi.fn(),
  ...overrides,
});

const renderModal = (overrides: Partial<React.ComponentProps<typeof SocialPhoneModal>> = {}) =>
  render(<SocialPhoneModal {...createProps(overrides)} />);

describe('SocialPhoneModal', () => {
  beforeEach(() => {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders comm view with fixture state', () => {
    renderModal({ initialTab: 'COMM' });

    expect(screen.getAllByText('莉莉').length).toBeGreaterThan(0);
    expect(screen.getByText('论坛')).toBeInTheDocument();
  });

  it('switches thread and sends message', async () => {
    const onSendMessage = vi.fn();
    const onReadThread = vi.fn();
    renderModal({ initialTab: 'CHAT', onSendMessage, onReadThread });

    fireEvent.click(screen.getByText('莉莉'));
    await waitFor(() => {
      expect(onReadThread).toHaveBeenCalledWith('private-1');
    });

    const input = screen.getByPlaceholderText('发送给 莉莉...');
    fireEvent.change(input, { target: { value: '测试消息' } });
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    expect(onSendMessage).toHaveBeenCalledTimes(1);
    expect(onSendMessage).toHaveBeenCalledWith('测试消息', expect.objectContaining({ id: 'private-1' }));
  });

  it('replies forum post with expected payload', async () => {
    const onReplyForumPost = vi.fn();
    renderModal({ initialTab: 'FORUM', onReplyForumPost });

    fireEvent.click(screen.getByText('测试帖子A'));
    const replyInput = await screen.findByPlaceholderText('发表回复...');
    fireEvent.change(replyInput, { target: { value: '收到，稍后处理。' } });
    fireEvent.click(screen.getByRole('button', { name: '回复' }));

    expect(onReplyForumPost).toHaveBeenCalledWith({
      postId: 'post-1',
      content: '收到，稍后处理。',
    });
  });

  it('filters forum posts when switching board', async () => {
    renderModal({ initialTab: 'FORUM' });

    await waitFor(() => {
      expect(screen.getByText('测试帖子A')).toBeInTheDocument();
      expect(screen.queryByText('测试帖子B')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '地下城攻略' }));

    await waitFor(() => {
      expect(screen.queryByText('测试帖子A')).not.toBeInTheDocument();
      expect(screen.getByText('测试帖子B')).toBeInTheDocument();
    });
  });

  it('hides player placeholder contact from contacts list', async () => {
    const contactsWithPlayer: Confidant[] = [
      ...createContacts(),
      {
        id: 'pc_main',
        姓名: '{{user}}',
        种族: '人类',
        眷族: '无',
        身份: '巫女',
        好感度: 0,
        关系状态: '自身',
        是否在场: true,
        已交换联系方式: true,
        特别关注: true,
        记忆: [],
        等级: 1,
      },
    ];
    renderModal({ initialTab: 'CONTACTS', contacts: contactsWithPlayer, playerName: '博丽灵梦' });

    await waitFor(() => {
      expect(screen.queryByText('{{user}}')).not.toBeInTheDocument();
      expect(screen.queryByText('博丽灵梦')).not.toBeInTheDocument();
    });
  });
});

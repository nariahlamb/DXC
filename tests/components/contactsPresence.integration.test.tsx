import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, renderHook } from '@testing-library/react';
import type { Confidant } from '../../types';
import { ContactsView } from '../../components/game/modals/social/ContactsView';
import { usePhoneData } from '../../hooks/game/usePhoneData';

const createContact = (id: string, name: string, overrides: Partial<Confidant> & { 当前状态?: string } = {}) =>
  ({
    id,
    姓名: name,
    种族: '人类',
    眷族: '无',
    身份: '冒险者',
    好感度: 0,
    关系状态: '普通',
    已交换联系方式: false,
    特别关注: false,
    记忆: [],
    等级: 1,
    ...overrides,
  }) as Confidant;

describe('contacts presence integration', () => {
  it('keeps special/nearby/valid grouping consistent in usePhoneData', () => {
    const contacts = [
      createContact('a', '阿尔法', { 是否在场: true }),
      createContact('b', '贝塔', { 当前状态: '在场' } as any),
      createContact('c', '伽马', { 特别关注: true, 当前状态: '离场' } as any),
      createContact('d', '德尔塔', { 当前状态: '死亡' } as any),
      createContact('e', '艾普西隆', { 已交换联系方式: true, 当前状态: '离场' } as any),
    ];

    const { result } = renderHook(() =>
      usePhoneData({
        contacts,
        playerName: '玩家',
      })
    );

    expect(result.current.specialContacts.map((c) => c.姓名)).toEqual(['伽马']);
    expect(result.current.nearbyContacts.map((c) => c.姓名)).toEqual(['阿尔法', '贝塔']);
    expect(result.current.validContacts.map((c) => c.姓名)).toEqual(['阿尔法', '贝塔', '伽马', '艾普西隆']);
  });

  it('renders same nearby filtering in ContactsView tabs', () => {
    const contacts = [
      createContact('a', '阿尔法', { 是否在场: true }),
      createContact('b', '贝塔', { 当前状态: '在场' } as any),
      createContact('c', '伽马', { 特别关注: true, 当前状态: '离场' } as any),
      createContact('d', '德尔塔', { 当前状态: '失踪' } as any),
    ];

    render(
      <ContactsView
        contacts={contacts}
        onSelect={vi.fn()}
        onToggleAttention={vi.fn()}
      />
    );

    expect(screen.getByText('伽马')).toBeInTheDocument();
    expect(screen.queryByText('阿尔法')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '周围的人' }));
    expect(screen.getByText('阿尔法')).toBeInTheDocument();
    expect(screen.getByText('贝塔')).toBeInTheDocument();
    expect(screen.queryByText('德尔塔')).not.toBeInTheDocument();
  });

  it('dedupes generated npc code and keeps focused contact unique', () => {
    const contacts = [
      createContact('NPC_Hestia', 'NPC_Hestia', { 特别关注: true, 当前状态: '离场' } as any),
      createContact('NPC_Hestia', '赫斯缇雅', { 当前状态: '在场' } as any)
    ];

    const { result } = renderHook(() =>
      usePhoneData({
        contacts,
        playerName: '玩家'
      })
    );

    expect(result.current.specialContacts.map((c) => c.姓名)).toEqual(['赫斯缇雅']);
    expect(result.current.nearbyContacts).toHaveLength(0);

    render(
      <ContactsView
        contacts={contacts}
        onSelect={vi.fn()}
        onToggleAttention={vi.fn()}
      />
    );

    expect(screen.getByText('赫斯缇雅')).toBeInTheDocument();
    expect(screen.queryByText('NPC_Hestia')).not.toBeInTheDocument();
  });

  it('ignores narrative-noise contacts in grouped lists', () => {
    const contacts = [
      createContact('a', '阿尔法', { 是否在场: true }),
      createContact('人群中传来刻意压低的窃窃私语', '人群中传来刻意压低的窃窃私语', { 是否在场: true } as any),
      createContact('c', '伽马', { 特别关注: true, 当前状态: '离场' } as any)
    ];

    const { result } = renderHook(() =>
      usePhoneData({
        contacts,
        playerName: '玩家'
      })
    );

    expect(result.current.nearbyContacts.map((c) => c.姓名)).toEqual(['阿尔法']);
    expect(result.current.validContacts.map((c) => c.姓名)).toEqual(['阿尔法', '伽马']);
  });
});

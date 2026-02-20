import React, { useMemo, useState } from 'react';
import { ChevronRight, Heart, Users, UserPlus, Check } from 'lucide-react';
import type { Confidant } from '../../../../types';
import { getAvatarColor } from '../../../../utils/uiUtils';
import { filterOutPlayerContacts, isContactNearby, resolveContactDisplayName } from '../../../../utils/social/contactPresence';

type ContactTab = 'FOLLOWING' | 'NEARBY';

interface ContactsViewProps {
  contacts: Confidant[];
  playerName?: string;
  friendNames?: string[];
  initialTab?: ContactTab;
  onSelect: (contact: Confidant) => void;
  onToggleAttention?: (contact: Confidant) => void;
}

export interface ContactSummaryStats {
  presentCount: number;
  focusCount: number;
}

export const summarizeContactStats = (contacts: Confidant[] = [], playerName?: string): ContactSummaryStats => {
  const sanitizedContacts = filterOutPlayerContacts(contacts, playerName);
  const presentCount = sanitizedContacts.filter(c => isContactNearby(c)).length;
  const focusCount = sanitizedContacts.filter(c => c.特别关注).length;

  return {
    presentCount,
    focusCount
  };
};

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  playerName,
  friendNames = [],
  initialTab = 'FOLLOWING',
  onSelect,
  onToggleAttention
}) => {
  const [activeTab, setActiveTab] = useState<ContactTab>(initialTab || 'NEARBY');
  const sanitizedContacts = useMemo(
    () => filterOutPlayerContacts(contacts, playerName),
    [contacts, playerName]
  );
  // "关注的人": 用户手动标记为特别关注的NPC
  const following = useMemo(() => sanitizedContacts.filter(c => c.特别关注), [sanitizedContacts]);
  // "周围的人": 当前在场的NPC (且不在特别关注列表中)
  const nearby = useMemo(() => sanitizedContacts.filter(c => isContactNearby(c) && !c.特别关注), [sanitizedContacts]);
  const friendSet = useMemo(() => new Set(friendNames), [friendNames]);
  const list = activeTab === 'FOLLOWING' ? following : nearby;
  
  // Sort list: Followed -> Friends -> Affinity -> Name
  const sortedList = useMemo(() => {
    return [...list].sort((a, b) => {
        const nameA = resolveContactDisplayName(a) || a.姓名 || '';
        const nameB = resolveContactDisplayName(b) || b.姓名 || '';
        if (a.特别关注 !== b.特别关注) return (b.特别关注 ? 1 : 0) - (a.特别关注 ? 1 : 0);
        if (friendSet.has(nameA) !== friendSet.has(nameB)) return (friendSet.has(nameB) ? 1 : 0) - (friendSet.has(nameA) ? 1 : 0);
        return (b.好感度 || 0) - (a.好感度 || 0);
    });
  }, [list, friendSet]);

  const countLabel = `共${sortedList.length}人`;

  return (
    <div className="flex-1 overflow-hidden p-0 bg-transparent flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-zinc-950/70 backdrop-blur-md border-b border-zinc-800/70 shrink-0">
        <div className="px-3 pt-2 pb-2">
          <div className="flex items-end justify-between">
            <div className="text-sm font-display text-zinc-200">联系人</div>
            <div className="text-[10px] text-zinc-500 tracking-widest">{countLabel}</div>
          </div>
          <div className="mt-2 p-1 rounded-full border border-zinc-800/70 bg-zinc-900/60">
            <div className="flex gap-1 text-[11px] font-semibold bg-zinc-900/40 p-1 rounded-lg border border-zinc-800/50">
              <button
                onClick={() => setActiveTab('FOLLOWING')}
                className={`flex-1 px-3 py-1.5 rounded-md transition-all duration-200 ${
                  activeTab === 'FOLLOWING' 
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm ring-1 ring-white/10' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                }`}
              >
                关注的人
              </button>
              <button
                onClick={() => setActiveTab('NEARBY')}
                className={`flex-1 px-3 py-1.5 rounded-md transition-all duration-200 ${
                  activeTab === 'NEARBY' 
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm ring-1 ring-white/10' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                }`}
              >
                周围的人
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 pt-2">
        {sortedList.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {sortedList.map((npc) => {
              const displayName = resolveContactDisplayName(npc) || npc.姓名 || npc.id || '未知';
              return (
              <div
                key={npc.id || displayName}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-zinc-800/70 bg-zinc-900/40 hover:bg-zinc-900/70 transition-all group relative"
              >
                <div 
                    onClick={() => onSelect(npc)}
                    className={`w-10 h-10 flex items-center justify-center font-bold text-white text-sm shrink-0 rounded-full ring-2 ring-zinc-800 cursor-pointer hover:ring-white/20 transition-all ${getAvatarColor(displayName)}`}
                >
                  {displayName[0] || '?'}
                </div>
                
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(npc)}>
                  <div className="flex items-center gap-2">
                      <h4 className="font-bold text-zinc-200 text-sm truncate">{displayName}</h4>
                      {friendSet.has(displayName) && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 font-bold">
                          好友
                        </span>
                      )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center gap-1 bg-pink-500/10 px-1.5 py-0.5 rounded text-pink-300 text-[10px] font-bold border border-pink-500/20">
                          <Heart size={8} fill="currentColor" />
                          <span>{npc.好感度 ?? 0}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 truncate tracking-wide border-l border-zinc-700 pl-2">
                          {npc.身份 || '未知'} · {npc.眷族 || '无眷族'}
                      </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                    {activeTab === 'NEARBY' && !npc.特别关注 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleAttention?.(npc);
                            }}
                            className="p-2 text-zinc-500 hover:text-pink-400 hover:bg-pink-500/10 rounded-full transition-colors"
                            title="设为特别关注"
                        >
                            <UserPlus size={16} />
                        </button>
                    )}
                    {npc.特别关注 && (
                         <div className="p-2 text-pink-400" title="已特别关注">
                            <Heart size={16} fill="currentColor" />
                         </div>
                    )}
                    <button 
                        onClick={() => onSelect(npc)}
                        className="p-2 text-zinc-600 hover:text-white transition-colors"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
              </div>
            );})}
          </div>
        ) : (
          <EmptyState text={activeTab === 'FOLLOWING' ? '暂无关注对象' : '周围没有在场人物'} />
        )}
      </div>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-60 py-10">
    <Users size={32} className="mb-2" />
    <p className="font-display uppercase tracking-widest text-xs">{text}</p>
  </div>
);

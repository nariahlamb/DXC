
import React from 'react';
import { LogEntry, CharacterStats, Confidant, ReadabilitySettings } from '../../../types';
import { Edit2, Terminal, Trash2, Sparkles } from 'lucide-react';
import { getAvatarColor } from '../../../utils/uiUtils';
import { replaceUserPlaceholders } from '../../../utils/userPlaceholder';
import { sanitizeLogText, splitLogTextIntoParagraphs } from '../../../utils/logTextFormat';

interface LogEntryProps {
  log: LogEntry;
  isLatest: boolean;
  playerStats: CharacterStats;
  confidants: Confidant[];
  onEditClick: (log: LogEntry) => void;
  onDelete?: (logId: string) => void;
  onEditUserLog?: (logId: string) => void;
  aiActionAnchor?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  readability?: ReadabilitySettings;
  showAiToolbar?: boolean; 
  isHellMode?: boolean;
  onAvatarClick?: (target: { type: 'PLAYER' | 'NPC', name?: string }) => void;
  playerName?: string;
}

const inferSpeakerFromText = (content: string): string => {
    const lines = sanitizeLogText(content)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const firstLine = lines[0] || '';
    if (!firstLine) return '';
    const direct = firstLine.match(/^([^\s：:「」『』“”"'()（）【】\[\]]{1,16})[：:]\s*/);
    if (direct?.[1]) return direct[1];
    const said = firstLine.match(/^([^\s：:「」『』“”"'()（）【】\[\]]{1,16})(?:说|问|答|喊|低声|轻声|高声)(?:道)?[：:，,]\s*/);
    if (said?.[1]) return said[1];
    return '';
};


// --- Sub-Components ---

const SystemNode = ({ content, children, align = 'center', onAvatarClick }: any) => (
    <div className="group relative flex w-full justify-center my-6 animate-in fade-in duration-300">
        <div className="flex flex-col items-center max-w-[85%]">
            {children} {/* Action Header */}
            <div className="bubble-system flex items-center gap-3 shadow-lg bg-black/20 border border-slate-700/30">
                {content.includes('好感度') || content.includes('up') ? (
                    <Sparkles size={14} className="text-guild-gold shrink-0 animate-pulse" />
                ) : (
                    <Terminal size={14} className="text-emerald-500/70 shrink-0" />
                )}
                <span className={`font-mono text-xs md:text-sm tracking-wide ${content.includes('好感度') ? 'text-guild-gold-100' : 'text-slate-400'}`}>
                    {content}
                </span>
            </div>
        </div>
    </div>
);

const NarrativeNode = ({ content, children, renderDecoratedText }: any) => (
    <div className="group relative w-full my-8 animate-in fade-in duration-1000">
        <div className="absolute top-0 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
           {/* Actions are passed via children/context if needed, but usually ActionMenu is outside */}
        </div>
        <div className="flex flex-col items-center">
            {children}
            <div className="relative w-full max-w-4xl px-4 md:px-12 py-2">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-hestia-blue-900/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="narrative-container">
                    {renderDecoratedText(content, "prose-cinematic text-slate-200 text-justify text-base md:text-lg drop-shadow-md")}
                </div>
            </div>
        </div>
    </div>
);

const PlayerNode = ({ content, children, playerStats, textSizeClass, textToneClass, renderDecoratedText, onAvatarClick }: any) => (
    <div className="group relative flex w-full justify-end my-6 pl-10 animate-in slide-in-from-right-4 fade-in duration-300">
        <div className="flex items-end gap-4 max-w-full">
            <div className="flex flex-col items-end">
                <div className="bubble-dialogue bg-black/20 backdrop-blur-sm border-r-2 border-l-0 border-hestia-blue-500/30 rounded-l-lg rounded-r-none text-right">
                    <div className="text-[10px] text-hestia-blue-300 font-bold uppercase tracking-widest mb-1 opacity-70">YOU</div>
                    {renderDecoratedText(content, `font-ui tracking-wide ${textToneClass} ${textSizeClass}`)}
                </div>
                {children}
            </div>
            <div 
                className="w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-full border border-hestia-blue-500/30 overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.2)] cursor-pointer hover:ring-2 hover:ring-hestia-blue-400 transition-all"
                onClick={() => onAvatarClick?.({ type: 'PLAYER' })}
                title="点击更换头像"
            >
                <img src={playerStats.头像 || "https://picsum.photos/200"} alt="You" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
    </div>
);

const NpcNode = ({ content, children, senderName, confidants, textSizeClass, textToneClass, renderDecoratedText, onAvatarClick, getAvatarColor }: any) => {
    const npc = confidants.find((c: any) => c.姓名 === senderName);
    const avatarUrl = npc?.头像;
    const initial = senderName[0] || "?";
    const bgColor = getAvatarColor(senderName);

    return (
        <div className="group relative flex w-full justify-start my-6 pr-10 animate-in slide-in-from-left-4 fade-in duration-300">
            <div className="absolute right-0 top-0">
                {/* ActionMenu placeholder if needed */}
            </div>
            <div className="flex items-start gap-5 max-w-full">
                <div className="flex flex-col items-center gap-1 mt-1">
                    <div 
                        className={`w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-lg overflow-hidden shadow-2xl relative z-10 transform transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-1 border border-white/5 cursor-pointer hover:ring-2 hover:ring-white/30 ${!avatarUrl ? bgColor : ''}`}
                        onClick={() => onAvatarClick?.({ type: 'NPC', name: senderName })}
                        title="点击更换头像"
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={senderName} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-hestia-blue-100 font-display font-bold text-xl bg-slate-800">
                                {initial}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                    </div>
                </div>
                <div className="flex flex-col items-start relative max-w-[85%]">
                     {children}
                    <div className="bubble-dialogue shadow-inner bg-black/20 backdrop-blur-md border-l-2 border-slate-700/30">
                        <div className="text-[10px] text-hestia-blue-300 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                             {senderName}
                             <div className="h-px w-8 bg-hestia-blue-500/30"></div>
                        </div>
                        {renderDecoratedText(content, `font-ui ${textToneClass} ${textSizeClass}`)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const LogEntryItem = React.memo<LogEntryProps>(({ 
    log,
    isLatest,
    playerStats,
    confidants,
    onEditClick,
    onDelete,
    onEditUserLog,
    aiActionAnchor = false,
    fontSize = 'medium',
    readability = { lineHeight: 'normal', contrastMode: 'default', infoDensity: 'balanced' },
    showAiToolbar = false,
    isHellMode = false,
    onAvatarClick,
    playerName
}) => {
    const resolvedPlayerName = String(playerName || playerStats?.姓名 || '').trim() || '玩家';
    const content = sanitizeLogText(replaceUserPlaceholders(log.text || "", resolvedPlayerName));

    const rawSenderName = String(log.sender ?? '').trim();
    const inferredSender = rawSenderName ? '' : inferSpeakerFromText(content);
    // 兼容：sender 为空时按“未知 NPC”渲染（否则会被当作旁白分支）。
    const senderName = rawSenderName || inferredSender || '未知';
    const senderKey = senderName.toLowerCase();
    const npcNameExactSet = new Set((confidants || []).map((c: any) => String(c?.姓名 || '').trim()).filter(Boolean));
    const npcNameLowerSet = new Set((confidants || []).map((c: any) => String(c?.姓名 || '').trim().toLowerCase()).filter(Boolean));
    const systemAliases = ['system', '系统', 'hint', 'guide'];
    const narratorAliases = ['旁白', 'narrator', 'narrative', 'scene', '环境'];
    const isReservedAlias = senderKey === 'player' || systemAliases.includes(senderKey) || narratorAliases.includes(senderKey);
    const matchesNpc = !!senderName && (npcNameExactSet.has(senderName) || (!isReservedAlias && npcNameLowerSet.has(senderKey)));
    const isPlayer = senderKey === 'player';
    const isSystem = !matchesNpc && systemAliases.includes(senderKey);
    const isNarrator = !matchesNpc && narratorAliases.includes(senderKey);

    const isPrimaryAiLog = !!log.rawResponse;
    const isAiLog = !isPlayer && isPrimaryAiLog;
    const showAiActions = isAiLog && aiActionAnchor;
    const canEditAI = showAiActions && !!onEditClick;
    const canDeleteAI = showAiActions && !!onDelete;
    const canEditUser = isPlayer && !!onEditUserLog;
    const canDeleteUser = isPlayer && !!onDelete;
    const hasInlineActions = canEditUser || canDeleteUser;
    const lineHeightClass = readability.lineHeight === 'compact'
        ? 'leading-snug'
        : readability.lineHeight === 'relaxed'
            ? 'leading-loose'
            : 'leading-relaxed';
    const contrastTextClass = readability.contrastMode === 'high' ? 'text-white' : 'text-slate-100';

    const getTextSize = () => {
        switch(fontSize) {
            case 'small': return `text-xs ${lineHeightClass} break-words`;
            case 'large': return `text-base md:text-xl ${lineHeightClass} break-words`;
            case 'medium': default: return `text-sm md:text-base ${lineHeightClass} break-words`;
        }
    };
    const textSizeClass = getTextSize();

    const renderDecoratedText = (text: string, className: string) => {
        const formatLine = (line: string): React.ReactNode => {
            const parts: React.ReactNode[] = [];
            const regex = /\*\*(.*?)\*\*/g;
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(<span key={lastIndex}>{line.substring(lastIndex, match.index)}</span>);
                }
                parts.push(<i key={match.index} className="italic text-red-500 mx-2">{match[1]}</i>);
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) {
                parts.push(<span key={lastIndex}>{line.substring(lastIndex)}</span>);
            }
            return parts.length > 0 ? parts : line;
        };
        const paragraphs = splitLogTextIntoParagraphs(text, { mode: isNarrator ? 'narrative' : 'dialogue' });
        return (
            <div className={`${className} whitespace-pre-wrap space-y-2 md:space-y-1`} style={{ textShadow: '0 0 5px rgba(100, 200, 255, 0.2)' }}>
                {paragraphs.map((paragraph, idx) => {
                    const trimmed = paragraph.trim();
                    if (!trimmed) return <div key={idx} className={isNarrator ? "h-1 md:h-0.5" : "h-4 md:h-3"} />;
                    const isJudge = trimmed.startsWith('【判定】');
                    const isKeyLine = trimmed.includes('关键') || trimmed.includes('好感度');
                    if (isJudge) {
                        return (
                            <div key={idx} className="px-2 py-1 border border-blue-600/50 bg-blue-950/40 text-blue-200 font-mono tracking-widest text-[11px] uppercase">
                                {trimmed}
                            </div>
                        );
                    }
                    if (isKeyLine) {
                        return (
                            <div key={idx} className="px-2 py-1 border border-amber-500/40 bg-amber-950/20 rounded">
                                {formatLine(paragraph)}
                            </div>
                        );
                    }
                    return <div key={idx}>{formatLine(paragraph)}</div>;
                })}
            </div>
        );
    };

    const RepairHint = ({ align }: { align: 'left' | 'right' | 'center' }) => {
        if (!log.repairNote) return null;
        const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
        return (
            <div className={`mt-2 flex ${alignClass}`}>
                <div className="max-w-[90%] px-2 py-1 text-[10px] text-amber-200 border border-amber-700/60 bg-amber-900/30 uppercase tracking-wider">
                    本条消息已自动修复：{log.repairNote}
                </div>
            </div>
        );
    };

    const AiActionHeader = ({ align }: { align: 'left' | 'right' | 'center' }) => {
        if (!showAiActions) return null;
        const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
        return (
            <div className={`mb-2 flex gap-2 ${alignClass}`}>
                {canEditAI && (
                    <button type="button" onClick={() => onEditClick(log)} className="flex items-center justify-center w-7 h-7 border border-iron-800 text-dungeon-200 bg-iron-900/70 hover:text-hestia-blue-100 hover:border-green-500" title="查看原文">
                        <Terminal size={12} />
                    </button>
                )}
                {canDeleteAI && (
                    <button type="button" onClick={() => onDelete?.(log.id)} className="flex items-center justify-center w-7 h-7 border border-iron-800 text-dungeon-200 bg-iron-900/70 hover:text-hestia-blue-100 hover:border-red-500" title="删除消息">
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
        );
    };

    const MobileActions = ({ align }: { align: 'left' | 'right' | 'center' }) => {
        if (!hasInlineActions) return null;
        const alignClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
        return (
            <div className={`md:hidden mt-2 flex gap-2 ${alignClass}`}>
                {canEditUser && (
                    <button type="button" onClick={() => onEditUserLog?.(log.id)} className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider border border-iron-800 text-dungeon-200 bg-iron-900/70 hover:text-hestia-blue-100 hover:border-hestia-blue-500">
                        <Edit2 size={12} /> 编辑
                    </button>
                )}
                {canDeleteUser && (
                    <button type="button" onClick={() => onDelete?.(log.id)} className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider border border-iron-800 text-dungeon-200 bg-iron-900/70 hover:text-hestia-blue-100 hover:border-red-500">
                        <Trash2 size={12} /> 删除
                    </button>
                )}
            </div>
        );
    };

    const ActionMenu = () => {
        if (!hasInlineActions) return null;
        return (
            <div className="hidden md:block absolute z-30" style={{ top: '-1.5rem', right: isPlayer ? 'auto' : '0', left: isPlayer ? '-0.5rem' : 'auto' }}>
                <div className="relative">
                    <div className="flex flex-row gap-1 bg-iron-900/90 backdrop-blur-md border border-iron-800 p-1.5 rounded-lg shadow-xl transition-all duration-200 origin-center opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto">
                        {canEditUser && (
                            <button onClick={() => onEditUserLog!(log.id)} className="flex items-center gap-2 px-2 py-1.5 text-xs text-dungeon-200 hover:text-hestia-blue-100 hover:bg-hestia-blue-700/40 rounded transition-colors whitespace-nowrap" title="编辑内容">
                                <Edit2 size={12} />
                            </button>
                        )}
                        {canDeleteUser && (
                            <button onClick={() => onDelete?.(log.id)} className="flex items-center gap-2 px-2 py-1.5 text-xs text-dungeon-200 hover:text-hestia-blue-100 hover:bg-red-600 rounded transition-colors whitespace-nowrap" title="删除消息">
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    if (isSystem) {
        return (
            <>
                <ActionMenu />
                <SystemNode content={content} align="center">
                    <AiActionHeader align="center" />
                    <MobileActions align="center" />
                    <RepairHint align="center" />
                </SystemNode>
            </>
        );
    }

    if (isNarrator) {
        return (
            <>
                <div className="absolute top-0 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionMenu />
                </div>
                <NarrativeNode content={content} renderDecoratedText={renderDecoratedText}>
                    <AiActionHeader align="center" />
                    <MobileActions align="center" />
                    <RepairHint align="center" />
                </NarrativeNode>
            </>
        );
    }

    if (isPlayer) {
        return (
            <>
                <ActionMenu />
                <PlayerNode content={content} playerStats={playerStats} textSizeClass={textSizeClass} textToneClass={contrastTextClass} renderDecoratedText={renderDecoratedText} onAvatarClick={onAvatarClick}>
                    <MobileActions align="right" />
                    <RepairHint align="right" />
                </PlayerNode>
            </>
        );
    }

    // NPC
    return (
        <>
            <div className="absolute right-0 top-0">
                <ActionMenu />
            </div>
            <NpcNode content={content} senderName={senderName} confidants={confidants} textSizeClass={textSizeClass} textToneClass={contrastTextClass} renderDecoratedText={renderDecoratedText} onAvatarClick={onAvatarClick} getAvatarColor={getAvatarColor}>
                 <AiActionHeader align="left" />
                 <MobileActions align="left" />
                 <RepairHint align="left" />
            </NpcNode>
        </>
    );
});

LogEntryItem.displayName = 'LogEntryItem';

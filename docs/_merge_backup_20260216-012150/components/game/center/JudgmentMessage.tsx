import React from 'react';
import { Shield, Target, Dices, Crown, Skull, Flame, User, Users } from 'lucide-react';

interface JudgmentMessageProps {
  text: string;
  isNsfw?: boolean;
}

type JudgmentTargetKind = 'player' | 'npc' | 'unknown';

const splitJudgmentParts = (text: string) => {
  const clean = text
    .replace(/^【(?:NSFW)?判定】[:：]?\s*/i, '')
    .replace(/^判定[:：]?\s*/i, '')
    .trim();

  return clean
    .split(/｜|\|/g)
    .map(part => part.trim())
    .filter(Boolean);
};

const parseScore = (parts: string[]) => {
  for (const part of parts) {
    const explicit = part.match(/判定值\s*([+-]?\d+)\s*\/\s*难度\s*([+-]?\d+)/i);
    if (explicit) {
      return { score: explicit[1], difficulty: explicit[2] };
    }

    const generic = part.match(/([+-]?\d+)\s*\/\s*([+-]?\d+)/);
    if (generic) {
      return { score: generic[1], difficulty: generic[2] };
    }
  }

  return { score: '?', difficulty: '?' };
};

const parseTarget = (parts: string[]): { targetName: string; targetKind: JudgmentTargetKind } => {
  const raw = parts.find(p => /^触发对象|^目标对象|^对象[:：]/.test(p));
  if (!raw) return { targetName: '未指定', targetKind: 'unknown' };

  const normalized = raw.replace(/^(触发对象|目标对象|对象)[:：]?\s*/u, '').trim();
  if (!normalized) return { targetName: '未指定', targetKind: 'unknown' };

  if (normalized.includes('玩家')) return { targetName: normalized, targetKind: 'player' };
  if (normalized.includes('NPC')) return { targetName: normalized, targetKind: 'npc' };

  return { targetName: normalized, targetKind: 'unknown' };
};

export const JudgmentMessage: React.FC<JudgmentMessageProps> = ({ text, isNsfw = false }) => {
  const parts = splitJudgmentParts(text);

  if (parts.length < 2) {
    return <div className="text-xs text-red-400 font-mono">{text}</div>;
  }

  const actionName = parts[0] || '判定';
  const result = parts[1] || '未知';
  const isSuccess = /成功/.test(result);
  const isCritical = /大成功|完美/.test(result);
  const isFumble = /大失败/.test(result);

  const { score, difficulty } = parseScore(parts.slice(2));
  const { targetName, targetKind } = parseTarget(parts);
  const modifiers = parts.filter(part => {
    if (/^触发对象|^目标对象|^对象[:：]/.test(part)) return false;
    const scoreLike = /判定值\s*[+-]?\d+\s*\/\s*难度\s*[+-]?\d+/i.test(part) || /[+-]?\d+\s*\/\s*[+-]?\d+/.test(part);
    return !scoreLike;
  }).slice(2);

  const theme = isNsfw
    ? {
        baseText: isSuccess ? 'text-pink-300' : 'text-rose-300',
        border: isSuccess ? 'border-pink-500' : 'border-rose-500',
        bg: isSuccess ? 'bg-pink-950/80' : 'bg-rose-950/80',
        accent: isSuccess ? 'bg-pink-600' : 'bg-rose-600',
        badge: 'text-pink-200 border-pink-500/70 bg-pink-900/40'
      }
    : {
        baseText: isSuccess ? 'text-blue-300' : 'text-red-300',
        border: isSuccess ? 'border-blue-500' : 'border-red-500',
        bg: isSuccess ? 'bg-blue-950/80' : 'bg-red-950/80',
        accent: isSuccess ? 'bg-blue-600' : 'bg-red-600',
        badge: 'text-zinc-200 border-zinc-500/70 bg-zinc-900/50'
      };

  const targetTheme = targetKind === 'player'
    ? { text: 'text-cyan-200', border: 'border-cyan-500/60 bg-cyan-900/30', icon: <User size={12} className="text-cyan-300" />, label: 'PLAYER' }
    : targetKind === 'npc'
      ? { text: 'text-amber-200', border: 'border-amber-500/60 bg-amber-900/30', icon: <Users size={12} className="text-amber-300" />, label: 'NPC' }
      : { text: 'text-zinc-200', border: 'border-zinc-500/60 bg-zinc-900/30', icon: <Target size={12} className="text-zinc-300" />, label: 'TARGET' };

  return (
    <div className="relative my-2 w-full max-w-xl mx-auto overflow-hidden font-display">
      <div className={`relative border-2 ${theme.border} ${theme.bg} p-2 shadow-[6px_6px_0px_rgba(0,0,0,0.45)]`}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className={`px-2 py-0.5 text-[10px] uppercase tracking-widest border ${theme.badge}`}>
            {isNsfw ? 'NSFW Judgment' : 'Judgment'}
          </div>
          {isNsfw && (
            <div className="flex items-center gap-1 text-pink-300 text-[11px] uppercase tracking-wider">
              <Flame size={12} /> Trigger
            </div>
          )}
        </div>

        <div className="mb-2 flex items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1 px-2 py-1 border ${targetTheme.border} ${targetTheme.text}`}>
            {targetTheme.icon}
            {targetTheme.label}
          </span>
          <span className="text-zinc-200">触发对象：{targetName}</span>
        </div>

        <div className="flex items-stretch mb-2">
          <div className={`flex-1 ${theme.accent} text-white px-3 py-2 flex items-center justify-between gap-2`}>
            <span className="font-bold uppercase tracking-wider text-sm md:text-base truncate">
              {actionName}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              {isSuccess ? <Crown size={16} className={isCritical ? 'animate-pulse' : ''} /> : <Skull size={16} className={isFumble ? 'animate-pulse' : ''} />}
              <span className="font-black text-base md:text-lg italic uppercase tracking-widest">
                {result}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-2 py-2 bg-black/40 mb-2 border border-white/10">
          <div className="flex-1 flex flex-col items-center border-r border-white/10">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <Shield size={10} /> Check
            </span>
            <span className={`text-2xl font-black ${theme.baseText}`}>{score}</span>
          </div>
          <div className="text-zinc-500 font-black text-xl">VS</div>
          <div className="flex-1 flex flex-col items-center border-l border-white/10">
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <Target size={10} /> Target
            </span>
            <span className="text-2xl font-black text-zinc-200">{difficulty}</span>
          </div>
        </div>

        {modifiers.length > 0 && (
          <div className="space-y-1 px-2 py-1">
            {modifiers.map((mod, idx) => {
              const firstSpace = mod.indexOf(' ');
              if (firstSpace === -1) return <div key={idx} className="text-xs text-zinc-300">{mod}</div>;

              const label = mod.substring(0, firstSpace);
              const rest = mod.substring(firstSpace + 1);
              const valueMatch = rest.match(/([+-]?\d+)\s*(.*)/);
              const value = valueMatch ? valueMatch[1] : '';
              const detail = valueMatch ? valueMatch[2] : rest;

              const isPositive = value.startsWith('+') || (!value.startsWith('-') && Number(value) > 0);
              const valColor = isPositive ? 'text-emerald-300' : 'text-red-300';

              return (
                <div key={idx} className="flex items-center text-xs font-mono tracking-tight">
                  <div className="w-14 text-zinc-500 text-right mr-2 shrink-0">{label}</div>
                  <div className={`w-14 font-bold text-right mr-2 ${valColor}`}>{value}</div>
                  <div className="text-zinc-300 truncate opacity-80">{detail}</div>
                </div>
              );
            })}
          </div>
        )}

        <div className="absolute -bottom-5 -right-5 text-white/5 transform rotate-[-15deg]">
          <Dices size={88} />
        </div>
      </div>
    </div>
  );
};

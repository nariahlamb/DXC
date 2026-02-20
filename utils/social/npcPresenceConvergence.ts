import type { GameState } from '../../types';
import type { Confidant } from '../../types/social';

export const DEFAULT_NPC_PRESENCE_STALE_TURN_GAP = 2;

export interface NpcPresenceConvergenceParams {
  prevState: GameState;
  nextState: GameState;
  currentTurn: number;
  logs?: Array<{ sender?: string; text?: string }>;
  interactionNpcIndices?: number[];
  staleTurnGap?: number;
}

const NARRATION_SENDERS = new Set([
  '旁白',
  '系统',
  '战斗结算',
  'narrator',
  'narrative',
  'system'
]);

const isNarrationSender = (sender: string, playerName: string): boolean => {
  const normalized = String(sender || '').trim();
  if (!normalized) return true;
  if (playerName && normalized === playerName) return true;
  const lower = normalized.toLowerCase();
  return NARRATION_SENDERS.has(normalized) || NARRATION_SENDERS.has(lower);
};

const toNpcNameMap = (social: Confidant[] = []) => {
  const map = new Map<string, string>();
  social.forEach((npc) => {
    const name = String((npc as any)?.姓名 || '').trim();
    if (!name) return;
    map.set(name.toLowerCase(), name);
  });
  return map;
};

const deriveObservedNpcNames = (
  stateSnapshot: GameState,
  logs: Array<{ sender?: string; text?: string }> = [],
  interactionNpcIndices: number[] = []
): Set<string> => {
  const observed = new Set<string>();
  const social = Array.isArray(stateSnapshot.社交) ? stateSnapshot.社交 : [];
  const playerName = String(stateSnapshot.角色?.姓名 || '').trim();
  const nameMap = toNpcNameMap(social as any);

  interactionNpcIndices.forEach((index) => {
    if (!Number.isFinite(index) || index < 0 || index >= social.length) return;
    const name = String((social[index] as any)?.姓名 || '').trim();
    if (name) observed.add(name);
  });

  logs.forEach((log) => {
    const sender = String(log?.sender || '').trim();
    if (!sender || isNarrationSender(sender, playerName)) return;
    const key = sender.toLowerCase();
    const resolved = nameMap.get(key);
    if (resolved) observed.add(resolved);
  });

  return observed;
};

const toBooleanPresence = (npc: Confidant): boolean => {
  if (typeof (npc as any)?.是否在场 === 'boolean') return Boolean((npc as any).是否在场);
  const status = String((npc as any)?.当前状态 || '').trim();
  return status === '在场';
};

const isHardAbsentStatus = (status: string): boolean => status === '死亡' || status === '失踪';

export const applyNpcPresenceConvergence = ({
  prevState,
  nextState,
  currentTurn,
  logs = [],
  interactionNpcIndices = [],
  staleTurnGap = DEFAULT_NPC_PRESENCE_STALE_TURN_GAP
}: NpcPresenceConvergenceParams): GameState => {
  const prevSocial = Array.isArray(prevState.社交) ? prevState.社交 : [];
  const nextSocial = Array.isArray(nextState.社交) ? [...nextState.社交] : [];
  if (nextSocial.length === 0) return nextState;

  const normalizedTurn = Math.max(1, Math.floor(Number(currentTurn || 1)));
  const normalizedGap = Math.max(1, Math.floor(Number(staleTurnGap || DEFAULT_NPC_PRESENCE_STALE_TURN_GAP)));
  const observedNpcNames = deriveObservedNpcNames(nextState, logs, interactionNpcIndices);

  let changed = false;

  for (let index = 0; index < nextSocial.length; index += 1) {
    const npc = nextSocial[index] as any;
    const name = String(npc?.姓名 || '').trim();
    if (!name) continue;

    const prevNpc = (prevSocial[index] || {}) as any;
    const observed = observedNpcNames.has(name);
    const status = String(npc?.当前状态 || '').trim();
    const hardAbsent = isHardAbsentStatus(status);
    const isPresent = toBooleanPresence(npc);

    const rawLastSeen = Number(npc?.最后出现回合 ?? prevNpc?.最后出现回合);
    const hadLastSeen = Number.isFinite(rawLastSeen);
    const lastSeenTurn = hadLastSeen ? Math.max(0, Math.floor(rawLastSeen)) : undefined;

    let nextNpc = npc;
    let nextLastSeenTurn = lastSeenTurn;

    if (observed) {
      nextLastSeenTurn = normalizedTurn;
      if (!hardAbsent && (!isPresent || status !== '在场')) {
        nextNpc = {
          ...nextNpc,
          是否在场: true,
          当前状态: '在场'
        };
      }
    } else if (isPresent && !hardAbsent && nextLastSeenTurn === undefined) {
      // 首次收敛时避免立即离场，先初始化基线回合。
      nextLastSeenTurn = normalizedTurn;
    }

    const isPartyMember = Boolean(npc?.是否队友);
    const canAutoAbsent = isPresent && !hardAbsent && !isPartyMember && !observed && typeof nextLastSeenTurn === 'number';
    const staleGap = canAutoAbsent ? normalizedTurn - nextLastSeenTurn : 0;
    if (canAutoAbsent && staleGap >= normalizedGap) {
      nextNpc = {
        ...nextNpc,
        是否在场: false,
        当前状态: '离场'
      };
    }

    if (typeof nextLastSeenTurn === 'number' && nextLastSeenTurn !== lastSeenTurn) {
      nextNpc = {
        ...nextNpc,
        最后出现回合: nextLastSeenTurn
      };
    }

    if (nextNpc !== npc) {
      nextSocial[index] = nextNpc;
      changed = true;
    }
  }

  if (!changed) return nextState;
  return {
    ...nextState,
    社交: nextSocial
  };
};

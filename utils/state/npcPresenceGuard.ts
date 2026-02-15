import type { GameState, TavernCommand } from '../../types';

type NarrativeRow = { sender?: unknown; text?: unknown };

export type NpcPresenceEvidence = {
  presentNpcNames: Set<string>;
  allowAbsentNpcNames: Set<string>;
};

const LEAVE_KEYWORDS = [
  '离开',
  '离场',
  '先走',
  '告辞',
  '转身离去',
  '走远',
  '离去',
  '退出'
];

const safeTrim = (value: unknown): string => String(value ?? '').trim();

const safeLower = (value: unknown): string => safeTrim(value).toLowerCase();

const isNarrationSender = (sender: string): boolean => {
  const k = sender.trim().toLowerCase();
  return k === '旁白' || k === 'narrator' || k === 'narrative' || k === 'system' || k === '系统';
};

const parseJsonObject = (input: string): Record<string, unknown> | null => {
  const text = String(input ?? '').trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const normalizeNarrativeRows = (value: unknown): NarrativeRow[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => !!row && typeof row === 'object' && !Array.isArray(row))
    .map((row) => row as NarrativeRow);
};

const buildKnownNpcNameSet = (stateSnapshot: GameState): Set<string> => {
  const social = Array.isArray(stateSnapshot?.社交) ? stateSnapshot.社交 : [];
  return new Set(
    social
      .map((npc: any) => safeTrim(npc?.姓名))
      .filter(Boolean)
  );
};

const lineSuggestsDeparture = (text: string): boolean => {
  if (!text) return false;
  return LEAVE_KEYWORDS.some((kw) => text.includes(kw));
};

const allowDepartureForNpcInRow = (row: NarrativeRow, npcName: string): boolean => {
  const sender = safeTrim(row?.sender);
  const text = safeTrim(row?.text);
  if (!text) return false;
  if (!lineSuggestsDeparture(text)) return false;
  // If the NPC says they are leaving, or the narration explicitly references the NPC leaving.
  if (sender === npcName) return true;
  if (text.includes(npcName)) return true;
  return false;
};

export const extractNpcPresenceEvidenceFromStateServiceInput = (
  input: string,
  stateSnapshot: GameState
): NpcPresenceEvidence => {
  const payload = parseJsonObject(input);
  if (!payload) return { presentNpcNames: new Set(), allowAbsentNpcNames: new Set() };

  const knownNpcNames = buildKnownNpcNameSet(stateSnapshot);
  const narrativeRows = normalizeNarrativeRows((payload as any)?.叙事);

  const presentNpcNames = new Set<string>();
  const allowAbsentNpcNames = new Set<string>();

  narrativeRows.forEach((row) => {
    const sender = safeTrim(row?.sender);
    if (!sender || isNarrationSender(sender)) return;
    if (knownNpcNames.has(sender)) {
      presentNpcNames.add(sender);
    }
  });

  if (presentNpcNames.size > 0) {
    narrativeRows.forEach((row) => {
      presentNpcNames.forEach((npcName) => {
        if (allowDepartureForNpcInRow(row, npcName)) {
          allowAbsentNpcNames.add(npcName);
        }
      });
    });
  }

  return { presentNpcNames, allowAbsentNpcNames };
};

const unwrapRows = (raw: unknown): Array<Record<string, unknown>> => {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const nestedKeys = ['rows', 'value', 'data', 'payload', 'npcs', 'records'];
    for (const nestedKey of nestedKeys) {
      if (obj[nestedKey] !== undefined && obj[nestedKey] !== raw) {
        const nested = unwrapRows(obj[nestedKey]);
        if (nested.length > 0) return nested;
      }
    }
    return [obj];
  }
  return [];
};

const isAbsentPatch = (row: Record<string, unknown>): boolean => {
  const presence = row.是否在场 ?? row.present;
  if (presence === false) return true;
  const status = safeTrim(row.当前状态 ?? row.status ?? row.状态);
  if (status === '离场') return true;
  return false;
};

const stripAbsentFields = (row: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...row };
  // Only strip fields that would force an "away" interpretation.
  if ((next as any).是否在场 === false) delete (next as any).是否在场;
  if ((next as any).present === false) delete (next as any).present;
  const status = safeTrim((next as any).当前状态 ?? (next as any).status ?? (next as any).状态);
  if (status === '离场') {
    delete (next as any).当前状态;
    delete (next as any).status;
    delete (next as any).状态;
  }
  return next;
};

export const guardNpcPresenceCommands = (
  commands: TavernCommand[],
  evidence: NpcPresenceEvidence
): { commands: TavernCommand[]; blocked: number } => {
  const list = Array.isArray(commands) ? commands : [];
  if (evidence.presentNpcNames.size === 0) return { commands: list, blocked: 0 };

  let blocked = 0;
  const guarded: TavernCommand[] = [];

  list.forEach((cmd) => {
    const action = safeLower((cmd as any)?.action ?? (cmd as any)?.type ?? (cmd as any)?.command ?? '');
    if (action === 'upsert_npc') {
      const rows = unwrapRows((cmd as any)?.value);
      const nextRows: Array<Record<string, unknown>> = [];
      rows.forEach((row) => {
        const npcName = safeTrim((row as any)?.姓名 ?? (row as any)?.name ?? (row as any)?.NPC ?? (row as any)?.npc_name);
        if (
          npcName
          && evidence.presentNpcNames.has(npcName)
          && !evidence.allowAbsentNpcNames.has(npcName)
          && isAbsentPatch(row)
        ) {
          blocked += 1;
          const stripped = stripAbsentFields(row);
          nextRows.push(stripped);
          return;
        }
        nextRows.push(row);
      });
      guarded.push({ ...(cmd as any), value: nextRows } as TavernCommand);
      return;
    }

    if (action === 'upsert_sheet_rows') {
      const value = (cmd as any)?.value;
      const payloads = Array.isArray(value) ? value : [value];
      const nextPayloads: any[] = [];
      payloads.forEach((payload) => {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
        const sheetId = safeTrim((payload as any)?.sheetId ?? (payload as any)?.sheet_id);
        if (sheetId !== 'NPC_Registry') {
          nextPayloads.push(payload);
          return;
        }
        const rows = unwrapRows((payload as any)?.rows);
        const nextRows: Array<Record<string, unknown>> = [];
        rows.forEach((row) => {
          const npcName = safeTrim((row as any)?.姓名 ?? (row as any)?.name ?? (row as any)?.NPC ?? (row as any)?.npc_name);
          if (
            npcName
            && evidence.presentNpcNames.has(npcName)
            && !evidence.allowAbsentNpcNames.has(npcName)
            && isAbsentPatch(row)
          ) {
            blocked += 1;
            nextRows.push(stripAbsentFields(row));
            return;
          }
          nextRows.push(row);
        });
        nextPayloads.push({ ...(payload as any), rows: nextRows });
      });
      const nextValue = Array.isArray(value) ? nextPayloads : (nextPayloads[0] ?? value);
      guarded.push({ ...(cmd as any), value: nextValue } as TavernCommand);
      return;
    }

    guarded.push(cmd);
  });

  return { commands: guarded, blocked };
};


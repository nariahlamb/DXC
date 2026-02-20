import type { Confidant } from '../../types';
import { isPlayerReference } from '../userPlaceholder';

export type ContactPresenceInput = Pick<Confidant, '是否在场'> & {
  当前状态?: string | null | undefined;
};

export type ContactIdentityInput = Pick<Confidant, 'id' | '姓名'>;

const PRESENT_STATUS = new Set(['在场']);
const ABSENT_STATUS = new Set(['离场', '死亡', '失踪']);
const CJK_NAME_RE = /[\u3400-\u9fff]/;
const CJK_ONLY_RE = /^[\u3400-\u9fff·]+$/;
const GENERATED_PREFIX_RE = /^(npc|char)[_-]?/i;
const GENERATED_FULL_RE = /^(npc|char)[_-]?[a-z0-9_-]+$/i;
const CONTROL_CHAR_RE = /[\r\n\t]/;
const SENTENCE_PUNCTUATION_RE = /[，。！？；：]/;
const NARRATIVE_TOKEN_RE = /(人群中|窃窃私语|传来|低声|说道|喊道|忽然|突然|旁白|系统提示|你听见|你看到)/;

const safeText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeIdentity = (value: unknown): string =>
  safeText(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const stripGeneratedPrefix = (value: unknown): string =>
  safeText(value)
    .replace(GENERATED_PREFIX_RE, '')
    .replace(/^[-_\s]+/, '')
    .trim();

const isGeneratedLabel = (value: unknown): boolean => {
  const text = safeText(value);
  if (!text) return false;
  return GENERATED_FULL_RE.test(text) || GENERATED_PREFIX_RE.test(text);
};

const isPlausibleContactLabel = (value: unknown): boolean => {
  const text = safeText(value);
  if (!text) return false;
  if (CONTROL_CHAR_RE.test(text)) return false;
  if (text.length > 40) return false;
  if (SENTENCE_PUNCTUATION_RE.test(text)) return false;
  if (NARRATIVE_TOKEN_RE.test(text)) return false;
  if (CJK_ONLY_RE.test(text) && text.length > 12) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 4) return false;
  if ((text.includes('的') || text.includes('了')) && text.length >= 10) return false;
  return true;
};

const scoreDisplayCandidate = (value: string): number => {
  if (!value) return -1;
  if (!isPlausibleContactLabel(value)) return -1;
  let score = value.length;
  if (CJK_NAME_RE.test(value)) score += 30;
  if (!isGeneratedLabel(value)) score += 20;
  if (!/^[-_\d]+$/.test(value)) score += 10;
  return score;
};

const pickBestDisplayName = (...candidates: string[]): string => {
  let best = '';
  let bestScore = -1;
  candidates.forEach((candidate) => {
    const text = safeText(candidate);
    if (!text) return;
    const score = scoreDisplayCandidate(text);
    if (score > bestScore) {
      best = text;
      bestScore = score;
    }
  });
  return best;
};

export const resolveContactDisplayName = (contact: ContactIdentityInput): string => {
  const rawName = safeText(contact.姓名);
  const rawId = safeText(contact.id);
  const strippedName = stripGeneratedPrefix(rawName);
  const strippedId = stripGeneratedPrefix(rawId);
  return pickBestDisplayName(rawName, strippedName, rawId, strippedId) || rawName || rawId;
};

export const isValidContactIdentity = (contact: ContactIdentityInput): boolean => {
  const rawName = safeText(contact.姓名);
  const rawId = safeText(contact.id);
  const displayName = resolveContactDisplayName(contact);
  const strippedName = stripGeneratedPrefix(rawName);
  const strippedId = stripGeneratedPrefix(rawId);
  const candidates = [displayName, rawName, strippedName, rawId, strippedId];
  return candidates.some((candidate) => isPlausibleContactLabel(candidate));
};

const buildContactIdentityKeys = (contact: ContactIdentityInput): string[] => {
  const rawName = safeText(contact.姓名);
  const rawId = safeText(contact.id);
  const displayName = resolveContactDisplayName(contact);

  return [
    normalizeIdentity(rawId),
    normalizeIdentity(rawName),
    normalizeIdentity(stripGeneratedPrefix(rawId)),
    normalizeIdentity(stripGeneratedPrefix(rawName)),
    normalizeIdentity(displayName)
  ].filter(Boolean);
};

const mergeContactRecords = (base: Confidant, incoming: Confidant): Confidant => {
  const baseId = safeText(base.id);
  const incomingId = safeText(incoming.id);
  const incomingName = safeText(incoming.姓名);
  const baseName = safeText(base.姓名);

  const safeIncoming = Object.fromEntries(
    Object.entries(incoming as Record<string, unknown>).filter(([, value]) => value !== undefined)
  ) as Partial<Confidant>;

  const mergedId = pickBestDisplayName(
    !isGeneratedLabel(incomingId) ? incomingId : '',
    !isGeneratedLabel(baseId) ? baseId : '',
    incomingId,
    baseId
  );

  const mergedName = pickBestDisplayName(
    incomingName,
    baseName,
    stripGeneratedPrefix(incomingName),
    stripGeneratedPrefix(baseName),
    stripGeneratedPrefix(mergedId),
    mergedId
  );

  const next: Confidant = {
    ...base,
    ...safeIncoming,
    id: mergedId || baseId || incomingId,
    姓名: mergedName || baseName || incomingName,
    特别关注: Boolean(base.特别关注 || incoming.特别关注),
    已交换联系方式: Boolean(base.已交换联系方式 || incoming.已交换联系方式),
    是否队友: Boolean(base.是否队友 || incoming.是否队友)
  } as Confidant;

  return next;
};

export const dedupeContacts = (contacts: Confidant[] = []): Confidant[] => {
  const merged: Confidant[] = [];
  const keyToIndex = new Map<string, number>();

  contacts.forEach((contact) => {
    if (!contact || typeof contact !== 'object') return;
    const normalizedContact = {
      ...contact,
      姓名: resolveContactDisplayName(contact)
    } as Confidant;

    const keys = buildContactIdentityKeys(normalizedContact);
    const matchedIndex = keys
      .map((key) => keyToIndex.get(key))
      .find((value): value is number => typeof value === 'number');

    if (typeof matchedIndex !== 'number') {
      const index = merged.length;
      merged.push(normalizedContact);
      keys.forEach((key) => keyToIndex.set(key, index));
      return;
    }

    const next = mergeContactRecords(merged[matchedIndex], normalizedContact);
    merged[matchedIndex] = next;
    buildContactIdentityKeys(next).forEach((key) => keyToIndex.set(key, matchedIndex));
  });

  return merged;
};

export const isContactPresent = (contact: ContactPresenceInput): boolean => {
  if (typeof contact.是否在场 === 'boolean') return contact.是否在场;

  const status = typeof contact.当前状态 === 'string' ? contact.当前状态.trim() : '';
  if (!status) return false;
  if (PRESENT_STATUS.has(status)) return true;
  if (ABSENT_STATUS.has(status)) return false;
  return false;
};

export const isContactNearby = (contact: ContactPresenceInput): boolean => isContactPresent(contact);

export const isPlayerContact = (contact: ContactIdentityInput, playerName?: string): boolean => {
  const id = typeof contact.id === 'string' ? contact.id : '';
  const name = typeof contact.姓名 === 'string' ? contact.姓名 : '';
  return isPlayerReference(id, playerName) || isPlayerReference(name, playerName);
};

export const filterOutPlayerContacts = (contacts: Confidant[] = [], playerName?: string): Confidant[] =>
  dedupeContacts(contacts.filter((contact) => !isPlayerContact(contact, playerName)))
    .filter((contact) => isValidContactIdentity(contact));

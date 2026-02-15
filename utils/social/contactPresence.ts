import type { Confidant } from '../../types';
import { isPlayerReference } from '../userPlaceholder';

export type ContactPresenceInput = Pick<Confidant, '是否在场'> & {
  当前状态?: string | null | undefined;
};

export type ContactIdentityInput = Pick<Confidant, 'id' | '姓名'>;

const PRESENT_STATUS = new Set(['在场']);
const ABSENT_STATUS = new Set(['离场', '死亡', '失踪']);

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
  contacts.filter((contact) => !isPlayerContact(contact, playerName));

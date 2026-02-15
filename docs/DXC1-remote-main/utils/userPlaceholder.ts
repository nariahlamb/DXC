export const resolvePlayerName = (playerName?: string): string => {
  const name = String(playerName || '').trim();
  return name || '玩家';
};

const normalizeUserRef = (value?: string | null): string =>
  String(value || '').trim().toLowerCase();

const USER_PLACEHOLDER_SET = new Set([
  '{{user}}',
  '{{ user }}',
  '{{player}}',
  '{{ player }}',
  '<玩家>',
  '玩家',
  'player',
  'user'
]);

const PLAYER_ID_SET = new Set([
  'pc_main',
  'player',
  'player_main',
  'main_player'
]);

export const isUserPlaceholderName = (value?: string | null): boolean => {
  const normalized = normalizeUserRef(value);
  if (!normalized) return false;
  return USER_PLACEHOLDER_SET.has(normalized);
};

export const isPlayerReference = (value?: string | null, playerName?: string): boolean => {
  const normalized = normalizeUserRef(value);
  if (!normalized) return false;
  if (PLAYER_ID_SET.has(normalized)) return true;
  if (isUserPlaceholderName(normalized)) return true;
  const resolved = normalizeUserRef(resolvePlayerName(playerName));
  if (resolved && normalized === resolved) return true;
  return false;
};

export const replaceUserPlaceholders = (text: string, playerName?: string): string => {
  if (typeof text !== 'string' || !text) return text || '';
  const resolvedName = resolvePlayerName(playerName);
  return text
    .replace(/{{\s*user\s*}}/gi, resolvedName)
    .replace(/{{\s*player\s*}}/gi, resolvedName)
    .replace(/<玩家>/g, resolvedName);
};

export const replaceUserPlaceholdersDeep = <T>(value: T, playerName?: string): T => {
  if (typeof value === 'string') {
    return replaceUserPlaceholders(value, playerName) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceUserPlaceholdersDeep(item, playerName)) as T;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    Object.entries(record).forEach(([key, item]) => {
      result[key] = replaceUserPlaceholdersDeep(item, playerName);
    });
    return result as T;
  }
  return value;
};

const JUDGMENT_SENDERS = new Set(['【判定】', '判定', '【NSFW判定】', 'NSFW判定']);

const NSFW_JUDGMENT_KEYWORDS = [
  'nsfw',
  '魅惑',
  '榨干',
  '无法抵御',
  '无法抗拒',
  '失控',
  '沉沦',
  '快感',
  '欲望',
  '强制',
  '支配',
  '催情'
];

const NSFW_ALERT_KEYWORDS = [
  '无法抵御',
  '无法抗拒',
  '完全失控',
  '榨干',
  '魅惑',
  '强制',
  '沦陷',
  '精神崩溃',
  '失去行动能力'
];

const normalize = (value?: string) => (value || '').trim().toLowerCase();

export const isJudgmentSender = (sender?: string) => {
  const value = (sender || '').trim();
  if (!value) return false;
  if (JUDGMENT_SENDERS.has(value)) return true;
  return value.includes('判定');
};

export const isJudgmentLine = (text?: string) => {
  const value = (text || '').trim();
  if (!value) return false;
  return /^【(?:NSFW)?判定】/.test(value) || value.startsWith('判定：') || value.startsWith('判定:');
};

export const extractJudgmentTarget = (text?: string) => {
  const raw = text || '';
  const match = raw.match(/(?:触发对象|目标对象|对象)[:：]\s*([^｜\n]+)/u);
  if (!match) return { targetName: '未指定', targetKind: 'unknown' as const };
  const targetName = match[1].trim();
  const lower = targetName.toLowerCase();
  if (targetName.includes('玩家') || lower.includes('player')) {
    return { targetName, targetKind: 'player' as const };
  }
  if (targetName.includes('NPC') || lower.includes('npc')) {
    return { targetName, targetKind: 'npc' as const };
  }
  return { targetName, targetKind: 'unknown' as const };
};

export const isNsfwJudgment = (sender?: string, text?: string) => {
  const senderValue = normalize(sender);
  const textValue = normalize(text);
  if (senderValue.includes('nsfw')) return true;
  return NSFW_JUDGMENT_KEYWORDS.some(keyword =>
    senderValue.includes(keyword) || textValue.includes(keyword)
  );
};

export const shouldTriggerNsfwJudgmentAlert = (sender?: string, text?: string) => {
  if (!isNsfwJudgment(sender, text)) return false;
  const textValue = normalize(text);
  return NSFW_ALERT_KEYWORDS.some(keyword => textValue.includes(keyword));
};

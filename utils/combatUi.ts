export type ThreatTier = 'CRITICAL' | 'HIGH' | 'MID' | 'LOW' | 'TRIVIAL' | 'UNKNOWN';

export const getThreatTier = (enemyLevel?: number, playerLevel?: number): ThreatTier => {
  if (typeof enemyLevel !== 'number' || typeof playerLevel !== 'number') return 'UNKNOWN';
  const diff = enemyLevel - playerLevel;
  if (diff >= 5) return 'CRITICAL';
  if (diff >= 2) return 'HIGH';
  if (diff >= 0) return 'MID';
  if (diff >= -2) return 'LOW';
  return 'TRIVIAL';
};

export type ThreatTone = 'critical' | 'high' | 'mid' | 'low' | 'trivial' | 'unknown';

export const getThreatLabel = (tier: ThreatTier): { label: string; tone: ThreatTone } => {
  switch (tier) {
    case 'CRITICAL':
      return { label: '极危', tone: 'critical' };
    case 'HIGH':
      return { label: '高危', tone: 'high' };
    case 'MID':
      return { label: '警戒', tone: 'mid' };
    case 'LOW':
      return { label: '低危', tone: 'low' };
    case 'TRIVIAL':
      return { label: '可控', tone: 'trivial' };
    default:
      return { label: '未知', tone: 'unknown' };
  }
};

export const getCombatModeMeta = (enableCombatUI: boolean) => {
  if (enableCombatUI) {
    return {
      stateLabel: '战斗面板',
      actionLabel: '切换为仅对话',
      description: '面板操作 + 对话指令',
      tone: 'panel' as const
    };
  }
  return {
    stateLabel: '仅对话',
    actionLabel: '切换为战斗面板',
    description: '仅使用对话完成战斗',
    tone: 'chat' as const
  };
};

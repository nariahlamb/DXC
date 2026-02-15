export type SkillCostValue = string | number | null | undefined;
export type SkillCostObject = object;
export type SkillCostInput = SkillCostValue | SkillCostObject;

const COST_LABEL_MAP: Record<string, string> = {
  精神: 'MP',
  体力: 'HP',
};

const hasUsableValue = (value: SkillCostValue): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
};

const normalizeCostValue = (rawValue: unknown): SkillCostValue => {
  if (typeof rawValue === 'string') return rawValue;
  if (typeof rawValue === 'number') return rawValue;
  if (rawValue === null) return null;
  if (rawValue === undefined) return undefined;
  return String(rawValue);
};

export const formatSkillCost = (cost: SkillCostInput): string | null => {
  if (cost === null || cost === undefined) return null;

  if (typeof cost === 'string') {
    const normalized = cost.trim();
    return normalized || null;
  }

  if (typeof cost === 'number') {
    return String(cost);
  }

  const entries = Object.entries(cost as Record<string, unknown>).filter(([, rawValue]) =>
    hasUsableValue(normalizeCostValue(rawValue))
  );
  if (entries.length === 0) return null;

  return entries
    .map(([key, value]) => {
      const label = COST_LABEL_MAP[key] || `${key}:`;
      return `${label} ${String(value).trim()}`;
    })
    .join(' · ');
};

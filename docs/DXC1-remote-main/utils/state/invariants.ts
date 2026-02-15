import type { GameState } from '../../types';

export type InvariantIssueCode =
  | 'MONEY_NEGATIVE'
  | 'RESOURCE_BELOW_ZERO'
  | 'RESOURCE_EXCEEDS_MAX'
  | 'AFFINITY_OUT_OF_RANGE';

export interface InvariantIssue {
  code: InvariantIssueCode;
  path: string;
  message: string;
  actual: number;
}

export interface InvariantOptions {
  allowDebt?: boolean;
  affinityMin?: number;
  affinityMax?: number;
}

const asNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

const pushIssue = (
  target: InvariantIssue[],
  code: InvariantIssueCode,
  path: string,
  message: string,
  actual: number
) => {
  target.push({ code, path, message, actual });
};

const validateBoundedResource = (
  issues: InvariantIssue[],
  label: string,
  current: unknown,
  max: unknown,
  options: { skipUpperBound?: boolean } = {}
) => {
  const currentNumber = asNumber(current);
  const maxNumber = asNumber(max);
  if (currentNumber === null) return;
  if (currentNumber < 0) {
    pushIssue(
      issues,
      'RESOURCE_BELOW_ZERO',
      `角色.${label}`,
      `${label} 不得小于 0（当前 ${currentNumber}）。`,
      currentNumber
    );
  }
  if (!options.skipUpperBound && maxNumber !== null && currentNumber > maxNumber) {
    pushIssue(
      issues,
      'RESOURCE_EXCEEDS_MAX',
      `角色.${label}`,
      `${label} 不得超过最大值（当前 ${currentNumber} / 最大 ${maxNumber}）。`,
      currentNumber
    );
  }
};

export const validateStateInvariants = (
  state: GameState,
  options: InvariantOptions = {}
): InvariantIssue[] => {
  const issues: InvariantIssue[] = [];
  const allowDebt = options.allowDebt === true;
  const affinityMin = Number.isFinite(Number(options.affinityMin)) ? Number(options.affinityMin) : 0;
  const affinityMax = Number.isFinite(Number(options.affinityMax)) ? Number(options.affinityMax) : 100;

  const playerMoney = asNumber(state.角色?.法利);
  if (playerMoney !== null && !allowDebt && playerMoney < 0) {
    pushIssue(
      issues,
      'MONEY_NEGATIVE',
      '角色.法利',
      `角色法利不得为负数（当前 ${playerMoney}）。`,
      playerMoney
    );
  }

  const familiaMoney = asNumber(state.眷族?.资金);
  if (familiaMoney !== null && familiaMoney < 0) {
    pushIssue(
      issues,
      'MONEY_NEGATIVE',
      '眷族.资金',
      `眷族资金不得为负数（当前 ${familiaMoney}）。`,
      familiaMoney
    );
  }

  const bodyPartUpperBound = state.角色?.身体部位
    ? Object.values(state.角色.身体部位).reduce((sum, part: any) => {
      const value = asNumber(part?.最大);
      return sum + (value ?? 0);
    }, 0)
    : null;

  validateBoundedResource(
    issues,
    '生命值',
    state.角色?.生命值,
    bodyPartUpperBound && bodyPartUpperBound > 0 ? bodyPartUpperBound : state.角色?.最大生命值
  );
  validateBoundedResource(issues, '精神力', state.角色?.精神力, state.角色?.最大精神力);
  validateBoundedResource(issues, '体力', state.角色?.体力, state.角色?.最大体力);

  if (Array.isArray(state.社交)) {
    state.社交.forEach((npc, index) => {
      const favor = asNumber(npc?.好感度);
      if (favor === null) return;
      if (favor < affinityMin || favor > affinityMax) {
        pushIssue(
          issues,
          'AFFINITY_OUT_OF_RANGE',
          `社交[${index}].好感度`,
          `好感度必须位于 ${affinityMin}-${affinityMax}（当前 ${favor}）。`,
          favor
        );
      }
    });
  }

  return issues;
};

export type StandardDiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

export interface DiceExpressionTerm {
  sides: number;
  count: number;
  rolls: number[];
  subtotal: number;
}

export interface DiceExpressionResult {
  expression: string;
  terms: DiceExpressionTerm[];
  modifier: number;
  total: number;
}

export interface D20CheckOptions {
  modifier?: number;
  dc?: number;
  advantage?: boolean;
  disadvantage?: boolean;
  forcedRolls?: number[];
  rng?: () => number;
}

export interface D20CheckResult {
  rolls: number[];
  selected: number;
  modifier: number;
  total: number;
  mode: 'normal' | 'advantage' | 'disadvantage';
  dc?: number;
  success?: boolean;
}

const DICE_SIDES: Record<StandardDiceType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100
};

export const STANDARD_DICE_TYPES: StandardDiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

export const getDiceSides = (type: StandardDiceType): number => DICE_SIDES[type];

export const rollDie = (sides: number, rng: () => number = Math.random): number => {
  const safeSides = Number.isFinite(sides) && sides > 1 ? Math.floor(sides) : 20;
  return Math.floor(rng() * safeSides) + 1;
};

export const rollStandardDie = (type: StandardDiceType, rng: () => number = Math.random): number =>
  rollDie(getDiceSides(type), rng);

export const parseDiceExpression = (input: string): { count: number; sides: number; modifier: number } | null => {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();

  // 允许纯数字常量（例如 "12"）
  if (/^[+-]?\d+$/.test(normalized)) {
    return { count: 0, sides: 0, modifier: Number(normalized) };
  }

  const match = normalized.match(/^(\d+)?d(\d+)([+-]\d+)?$/);
  if (!match) return null;
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  if (!Number.isFinite(count) || !Number.isFinite(sides) || sides < 2 || count < 1 || count > 100) {
    return null;
  }
  return { count, sides, modifier };
};

export const rollDiceExpression = (
  expression: string,
  rng: () => number = Math.random
): DiceExpressionResult | null => {
  const parsed = parseDiceExpression(expression);
  if (!parsed) return null;

  if (parsed.count === 0) {
    return {
      expression,
      terms: [],
      modifier: parsed.modifier,
      total: parsed.modifier
    };
  }

  const rolls: number[] = [];
  for (let i = 0; i < parsed.count; i += 1) {
    rolls.push(rollDie(parsed.sides, rng));
  }

  const subtotal = rolls.reduce((sum, value) => sum + value, 0);
  return {
    expression,
    terms: [
      {
        sides: parsed.sides,
        count: parsed.count,
        rolls,
        subtotal
      }
    ],
    modifier: parsed.modifier,
    total: subtotal + parsed.modifier
  };
};

export const rollD20Check = (options: D20CheckOptions = {}): D20CheckResult => {
  const rng = options.rng || Math.random;
  const rollsNeeded = options.advantage || options.disadvantage ? 2 : 1;
  const forcedRolls = Array.isArray(options.forcedRolls) ? options.forcedRolls.slice(0, rollsNeeded) : [];

  while (forcedRolls.length < rollsNeeded) {
    forcedRolls.push(rollDie(20, rng));
  }

  let mode: D20CheckResult['mode'] = 'normal';
  if (options.advantage && !options.disadvantage) mode = 'advantage';
  if (options.disadvantage && !options.advantage) mode = 'disadvantage';

  let selected = forcedRolls[0];
  if (mode === 'advantage') selected = Math.max(...forcedRolls);
  if (mode === 'disadvantage') selected = Math.min(...forcedRolls);

  const modifier = Number.isFinite(options.modifier) ? Number(options.modifier) : 0;
  const total = selected + modifier;
  const dc = Number.isFinite(options.dc) ? Number(options.dc) : undefined;

  return {
    rolls: forcedRolls,
    selected,
    modifier,
    total,
    mode,
    dc,
    success: typeof dc === 'number' ? total >= dc : undefined
  };
};

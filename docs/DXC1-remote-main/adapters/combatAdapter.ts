import { CombatUnit } from '../types/combat-normalized';
import { Enemy } from '../types';
import { getThreatTier } from '../utils/combatUi';

export const normalizeEnemy = (raw: any, playerLevel: number = 1): CombatUnit => {
  if (!raw) {
    return {
      id: 'unknown',
      name: 'Unknown Entity',
      hp: 0,
      maxHp: 1,
      mp: 0,
      maxMp: 1,
      level: 0,
      attack: 0,
      description: '',
      skills: [],
      threatTier: 'UNKNOWN'
    };
  }

  const hp = typeof raw.当前生命值 === 'number'
    ? raw.当前生命值
    : (typeof raw.生命值 === 'number' ? raw.生命值 : 0);

  const maxHp = typeof raw.最大生命值 === 'number'
    ? raw.最大生命值
    : Math.max(hp, 1);

  const mp = typeof raw.当前精神MP === 'number'
    ? raw.当前精神MP
    : (typeof raw.精神力 === 'number' ? raw.精神力 : 0);

  const maxMp = typeof raw.最大精神MP === 'number'
    ? raw.最大精神MP
    : (typeof raw.最大精神力 === 'number' ? raw.最大精神力 : 1);

  const level = typeof raw.等级 === 'number' ? raw.等级 : 1;
  const threatTier = getThreatTier(level, playerLevel);

  return {
    id: raw.id || `enemy-${Math.random().toString(36).substr(2, 9)}`,
    name: raw.名称 || raw.name || 'Unknown',
    hp,
    maxHp,
    mp,
    maxMp,
    level,
    attack: raw.攻击力 || '??',
    description: raw.描述 || '',
    skills: Array.isArray(raw.技能) ? raw.技能 : [],
    threatTier
  };
};

export const normalizeCombatState = (combatState: any, playerLevel: number): CombatUnit[] => {
  const rawEnemies = (combatState as any)?.敌方;
  if (!rawEnemies) return [];
  const list = Array.isArray(rawEnemies) ? rawEnemies : [rawEnemies];
  return list.filter(Boolean).map(e => normalizeEnemy(e, playerLevel));
};

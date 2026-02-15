export interface CombatUnit {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  level: number;
  attack: number | string;
  description: string;
  skills: string[];
  threatTier: 'CRITICAL' | 'HIGH' | 'MID' | 'LOW' | 'TRIVIAL' | 'UNKNOWN';
}

export interface NormalizedCombatState {
  enemies: CombatUnit[];
  logs: string[];
  turn: number;
}

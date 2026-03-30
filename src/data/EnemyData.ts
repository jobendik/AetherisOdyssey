import type { SlimeType, EnemyTypeStats, EnemyArchetype } from '../types';

export const SLIME_TYPES: SlimeType[] = [
  { element: 'Pyro',    color: 0xff6347, core: 0xffaa66, emissive: 0x882211, name: 'Pyro Slime' },
  { element: 'Cryo',    color: 0x7ec8e3, core: 0xc8ecff, emissive: 0x224488, name: 'Cryo Slime' },
  { element: 'Electro', color: 0x9966ff, core: 0xddbbff, emissive: 0x442288, name: 'Electro Slime' },
  { element: 'Hydro',   color: 0x4488ff, core: 0xaaccff, emissive: 0x113366, name: 'Hydro Slime' },
];

export const ENEMY_TYPES: Record<EnemyArchetype, EnemyTypeStats> = {
  slime:  { hp: 4, spd: 2.9, atkRange: 3,  atkCd: 1.9, dmg: 14, xp: 10, mora: 15, aggro: 24, shieldHp: 0 },
  archer: { hp: 3, spd: 1.8, atkRange: 20, atkCd: 2.5, dmg: 12, xp: 14, mora: 20, aggro: 28, shieldHp: 0 },
  shield: { hp: 8, spd: 2.2, atkRange: 3,  atkCd: 2.2, dmg: 20, xp: 20, mora: 30, aggro: 22, shieldHp: 6 },
  wisp:   { hp: 2, spd: 3.5, atkRange: 8,  atkCd: 1.5, dmg: 10, xp: 12, mora: 18, aggro: 30, shieldHp: 0 },
  mage:   { hp: 3, spd: 1.6, atkRange: 16, atkCd: 3.0, dmg: 22, xp: 22, mora: 28, aggro: 26, shieldHp: 0 },
  bomber: { hp: 3, spd: 3.0, atkRange: 6,  atkCd: 2.8, dmg: 28, xp: 18, mora: 22, aggro: 24, shieldHp: 0 },
};

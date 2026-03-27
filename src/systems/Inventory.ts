import { G, mem } from '../core/GameState';
import { WEAPONS, ARTIFACTS, FOODS } from '../data/ItemData';
import type { Weapon, Artifact, Food, CalcStatsResult } from '../types';

export function getW(id: string): Weapon | undefined {
  return WEAPONS.find((w) => w.id === id);
}

export function getA(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export function getF(id: string): Food | undefined {
  return FOODS.find((f) => f.id === id);
}

export function calcStats(): CalcStatsResult {
  const m = mem();
  let atk = m.baseDmg + G.lv * 2;
  let bonusHp = 0;
  let elemDmg = 1;
  let burstDmg = 1;
  let critBonus = 0;
  let healOnHit = 0;

  const w = getW(G.inventory.equippedWeapon);
  if (w) atk += w.atk;
  if (w && w.id === 'w3') elemDmg += 0.2;
  if (w && w.id === 'w4') critBonus += 0.15;
  if (w && w.id === 'w5') healOnHit = 0.03;

  const a = getA(G.inventory.equippedArtifact || '');
  if (a) {
    if (a.stat === 'atk') atk += a.val;
    if (a.stat === 'hp') bonusHp += a.val;
    if (a.stat === 'elemDmg') elemDmg += a.val / 100;
    if (a.stat === 'burstDmg') burstDmg += a.val / 100;
  }

  return { atk, bonusHp, elemDmg, burstDmg, critBonus, healOnHit };
}

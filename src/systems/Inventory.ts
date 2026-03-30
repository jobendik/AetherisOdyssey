import { G } from '../core/GameState';
import { PARTY } from '../data/PartyData';
import { WEAPONS, ARTIFACTS, FOODS, ARTIFACT_SETS } from '../data/ItemData';
import { getTalentBonuses } from './Talents';
import { getConstellationBonuses } from './Constellations';
import { applySubstatBonuses } from './ArtifactSubstats';
import type { Weapon, Artifact, Food, CalcStatsResult } from '../types';

interface CalcStatsOptions {
  memberIdx?: number;
  weaponId?: string;
  artifactId?: string | null;
  artifactIds?: string[];
}

export function getW(id: string): Weapon | undefined {
  return WEAPONS.find((w) => w.id === id);
}

export function getA(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export function getF(id: string): Food | undefined {
  return FOODS.find((f) => f.id === id);
}

export function calcStats(options: CalcStatsOptions = {}): CalcStatsResult {
  const memberIdx = options.memberIdx ?? G.activeIdx;
  const m = PARTY[memberIdx];
  const equippedWeapon = options.weaponId ?? m.equippedWeapon ?? G.inventory.equippedWeapon;
  const equippedArtifact = options.artifactId !== undefined
    ? options.artifactId
    : (m.equippedArtifact ?? G.inventory.equippedArtifact);
  const equippedArtifacts = options.artifactIds ?? m.equippedArtifacts ?? G.inventory.equippedArtifacts;
  let atk = m.baseDmg + G.lv * 2;
  let bonusHp = 0;
  let elemDmg = 1;
  let burstDmg = 1;
  let critBonus = 0;
  let healOnHit = 0;

  const w = getW(equippedWeapon);
  if (w) atk += w.atk;
  /* Weapon enhancement bonus: +3 ATK per level */
  const wLv = G.weaponLevels[equippedWeapon] || 0;
  atk += wLv * 3;
  if (w && w.id === 'w3') elemDmg += 0.2;
  if (w && w.id === 'w4') critBonus += 0.15;
  if (w && w.id === 'w5') healOnHit = 0.03;
  if (w && w.id === 'w9') elemDmg += 0.3;

  /* Talent bonuses */
  const tb = getTalentBonuses(memberIdx);
  atk = Math.round(atk * tb.atkMult);
  critBonus += tb.critBonus;
  burstDmg += tb.burstDmg;
  bonusHp += tb.shieldHp;
  elemDmg += tb.elemDmg;

  /* Constellation bonuses */
  const cb = getConstellationBonuses(memberIdx);
  atk = Math.round(atk * cb.atkMult);
  critBonus += cb.critBonus;
  burstDmg += cb.burstDmg;
  bonusHp += cb.shieldHp;
  elemDmg += cb.elemDmg;

  const a = getA(equippedArtifact || '');
  if (a) {
    if (a.stat === 'atk') atk += a.val;
    if (a.stat === 'hp') bonusHp += a.val;
    if (a.stat === 'elemDmg') elemDmg += a.val / 100;
    if (a.stat === 'burstDmg') burstDmg += a.val / 100;
    /* Substats */
    const sub = { atk, bonusHp, elemDmg, burstDmg, critBonus };
    applySubstatBonuses(a.id, a.stat, a.rarity, sub);
    atk = sub.atk; bonusHp = sub.bonusHp; elemDmg = sub.elemDmg; burstDmg = sub.burstDmg; critBonus = sub.critBonus;
  }

  /* Multi-slot artifacts + set bonuses */
  const equipped = (equippedArtifacts || []).map(id => getA(id)).filter(Boolean) as Artifact[];
  for (const ea of equipped) {
    if (ea.stat === 'atk') atk += ea.val;
    if (ea.stat === 'hp') bonusHp += ea.val;
    if (ea.stat === 'elemDmg') elemDmg += ea.val / 100;
    if (ea.stat === 'burstDmg') burstDmg += ea.val / 100;
    /* Substats */
    const sub2 = { atk, bonusHp, elemDmg, burstDmg, critBonus };
    applySubstatBonuses(ea.id, ea.stat, ea.rarity, sub2);
    atk = sub2.atk; bonusHp = sub2.bonusHp; elemDmg = sub2.elemDmg; burstDmg = sub2.burstDmg; critBonus = sub2.critBonus;
  }
  /* Count set pieces */
  const setCounts: Record<string, number> = {};
  for (const ea of equipped) {
    if (ea.setId) setCounts[ea.setId] = (setCounts[ea.setId] || 0) + 1;
  }
  /* Also count the legacy single slot */
  if (a && a.setId) setCounts[a.setId] = (setCounts[a.setId] || 0) + 1;
  for (const [setId, count] of Object.entries(setCounts)) {
    const bonus = ARTIFACT_SETS[setId];
    if (!bonus) continue;
    if (count >= 2) {
      if (bonus.two.stat === 'atk') atk += bonus.two.val;
      if (bonus.two.stat === 'hp') bonusHp += bonus.two.val;
      if (bonus.two.stat === 'elemDmg') elemDmg += bonus.two.val / 100;
      if (bonus.two.stat === 'burstDmg') burstDmg += bonus.two.val / 100;
      if (bonus.two.stat === 'critBonus') critBonus += bonus.two.val;
      if (bonus.two.stat === 'healOnHit') healOnHit += bonus.two.val;
    }
    if (count >= 4) {
      if (bonus.four.stat === 'atk') atk += bonus.four.val;
      if (bonus.four.stat === 'atkMult') atk = Math.round(atk * (1 + bonus.four.val));
      if (bonus.four.stat === 'hp') bonusHp += bonus.four.val;
      if (bonus.four.stat === 'elemDmg') elemDmg += bonus.four.val / 100;
      if (bonus.four.stat === 'burstDmg') burstDmg += bonus.four.val / 100;
      if (bonus.four.stat === 'critBonus') critBonus += bonus.four.val;
      if (bonus.four.stat === 'healOnHit') healOnHit += bonus.four.val;
    }
  }

  return { atk, bonusHp, elemDmg, burstDmg, critBonus, healOnHit };
}

/* ─── Weapon Enhancement ─── */
const ENHANCE_BASE_COST = 50;
const ENHANCE_MAX = 10;

export function getEnhanceCost(id: string): number {
  const lv = G.weaponLevels[id] || 0;
  return ENHANCE_BASE_COST + lv * 30;
}

export function canEnhance(id: string): boolean {
  const lv = G.weaponLevels[id] || 0;
  return lv < ENHANCE_MAX && G.mora >= getEnhanceCost(id);
}

export function enhanceWeapon(id: string): boolean {
  if (!canEnhance(id)) return false;
  G.mora -= getEnhanceCost(id);
  G.weaponLevels[id] = (G.weaponLevels[id] || 0) + 1;
  return true;
}

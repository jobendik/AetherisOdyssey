import { G } from '../core/GameState';
import { SFX } from '../audio/Audio';

/* ═══════════════════════════════════════════════════════════
   CONSTELLATION SYSTEM
   Duplicate character items (stella fortuna) unlock power
   upgrades. Each character has 6 constellations.
   ═══════════════════════════════════════════════════════════ */

export interface Constellation {
  name: string;
  desc: string;
  icon: string;
}

/* Per-character constellation trees (6 each) */
const CONSTELLATIONS: Constellation[][] = [
  /* 0 – Aerin (Anemo) */
  [
    { name: 'Gale Surge',       desc: 'Skill DMG +20%',            icon: '🌀' },
    { name: 'Tailwind Rush',    desc: 'Skill CD reduced by 2s',    icon: '💨' },
    { name: 'Zephyr\'s Grace',  desc: 'Burst radius +30%',         icon: '🌬️' },
    { name: 'Stormweaver',      desc: 'Normal ATK SPD +15%',       icon: '⚡' },
    { name: 'Eye of the Gale',  desc: 'Elem DMG +25%',             icon: '👁️' },
    { name: 'Sovereign Winds',  desc: 'All party ATK +15%',        icon: '🌪️' },
  ],
  /* 1 – Kaela (Electro) */
  [
    { name: 'Voltaic Spark',    desc: 'Crit Rate +10%',            icon: '⚡' },
    { name: 'Arc Discharge',    desc: 'Skill chains +2 targets',   icon: '🔗' },
    { name: 'Thunder Shield',   desc: 'Shield on burst (30 HP)',   icon: '🛡️' },
    { name: 'Plasma Edge',      desc: 'Normal ATK DMG +20%',       icon: '⚔️' },
    { name: 'Lightning Rod',    desc: 'Burst CD reduced by 3s',    icon: '🔩' },
    { name: 'Superconductor',   desc: 'Burst DMG +50%',            icon: '💜' },
  ],
  /* 2 – Lyra (Cryo) */
  [
    { name: 'Frostbite',        desc: 'Shield HP +30',             icon: '❄️' },
    { name: 'Rime Armor',       desc: 'DMG taken -10%',            icon: '🧊' },
    { name: 'Glacial Burst',    desc: 'Burst heals 25 HP',         icon: '💙' },
    { name: 'Arctic Veil',      desc: 'Freeze duration +1s',       icon: '🌨️' },
    { name: 'Permafrost Core',  desc: 'Shield lasts 3s longer',    icon: '💎' },
    { name: 'Absolute Zero',    desc: 'Cryo DMG +40%',             icon: '🏔️' },
  ],
  /* 3 – Solen (Pyro) */
  [
    { name: 'Ember Strike',     desc: 'Elem DMG +15%',             icon: '🔥' },
    { name: 'Wildfire Spread',  desc: 'Skill radius +2',           icon: '💥' },
    { name: 'Inferno Wall',     desc: 'Burst creates fire zone',   icon: '🧱' },
    { name: 'Pyroclasm',        desc: 'Crit DMG +25%',             icon: '🌋' },
    { name: 'Blazing Resolve',  desc: 'Low HP (<30%) ATK +30%',    icon: '♨️' },
    { name: 'Solar Flare',      desc: 'Burst DMG +60%',            icon: '☀️' },
  ],
];

/* State: constellation levels per party index (0 = none, max 6) */
const constellationLevels: number[] = [0, 0, 0, 0];

/* Stella Fortuna items per party member */
const stellaFortuna: number[] = [0, 0, 0, 0];

export function getConstellationLevel(partyIdx: number): number {
  return constellationLevels[partyIdx] ?? 0;
}

export function getStellaFortuna(partyIdx: number): number {
  return stellaFortuna[partyIdx] ?? 0;
}

export function addStellaFortuna(partyIdx: number): void {
  stellaFortuna[partyIdx] = (stellaFortuna[partyIdx] ?? 0) + 1;
}

export function unlockConstellation(partyIdx: number): boolean {
  const cur = constellationLevels[partyIdx] ?? 0;
  if (cur >= 6) return false;
  if ((stellaFortuna[partyIdx] ?? 0) < 1) return false;
  stellaFortuna[partyIdx]--;
  constellationLevels[partyIdx] = cur + 1;
  SFX.lvlUp();
  return true;
}

/* Bonuses applied to calcStats or combat */
export function getConstellationBonuses(partyIdx: number): {
  atkMult: number; elemDmg: number; critBonus: number; burstDmg: number;
  shieldHp: number; dmgReduction: number; cdReduction: number;
  skillRadiusBonus: number;
} {
  const lv = constellationLevels[partyIdx] ?? 0;
  const r = { atkMult: 1, elemDmg: 0, critBonus: 0, burstDmg: 0,
              shieldHp: 0, dmgReduction: 0, cdReduction: 0, skillRadiusBonus: 0 };
  if (lv === 0) return r;
  switch (partyIdx) {
    case 0: /* Aerin */
      if (lv >= 1) r.elemDmg += 0.10;         /* C1: +20% skill → approx +10% elem */
      if (lv >= 2) r.cdReduction += 2;
      if (lv >= 3) r.skillRadiusBonus += 2;    /* burst radius mapped to skill radius bonus */
      if (lv >= 5) r.elemDmg += 0.25;
      if (lv >= 6) r.atkMult += 0.15;
      break;
    case 1: /* Kaela */
      if (lv >= 1) r.critBonus += 0.10;
      if (lv >= 4) r.atkMult += 0.20;
      if (lv >= 5) r.cdReduction += 3;
      if (lv >= 6) r.burstDmg += 0.50;
      break;
    case 2: /* Lyra */
      if (lv >= 1) r.shieldHp += 30;
      if (lv >= 2) r.dmgReduction += 0.10;
      if (lv >= 6) r.elemDmg += 0.40;
      break;
    case 3: /* Solen */
      if (lv >= 1) r.elemDmg += 0.15;
      if (lv >= 2) r.skillRadiusBonus += 2;
      if (lv >= 4) r.critBonus += 0.12;
      if (lv >= 6) r.burstDmg += 0.60;
      break;
  }
  return r;
}

export function getConstellationTree(partyIdx: number): Constellation[] {
  return CONSTELLATIONS[partyIdx] ?? [];
}

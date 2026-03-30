import { G } from '../core/GameState';

/* ═══════════════════════════════════════════════════════════
   ARTIFACT SUBSTATS
   Each equipped artifact can roll 1-3 random secondary stats
   when obtained. Substats are generated lazily on first query.
   ═══════════════════════════════════════════════════════════ */

export interface ArtifactSubstat {
  stat: string;   /* 'atk' | 'hp' | 'critRate' | 'elemDmg' | 'burstDmg' */
  val: number;
  label: string;
}

const SUBSTAT_POOL: { stat: string; min: number; max: number; label: string }[] = [
  { stat: 'atk',      min: 2,  max: 8,  label: 'ATK' },
  { stat: 'hp',       min: 5,  max: 20, label: 'HP' },
  { stat: 'critRate',  min: 2,  max: 6,  label: 'Crit Rate%' },
  { stat: 'elemDmg',  min: 3,  max: 10, label: 'Elem DMG%' },
  { stat: 'burstDmg', min: 3,  max: 10, label: 'Burst DMG%' },
];

/* Stores generated substats keyed by artifact id */
const substatMap: Record<string, ArtifactSubstat[]> = {};

function rollSubstats(mainStat: string, rarity: number): ArtifactSubstat[] {
  const count = rarity >= 5 ? 3 : rarity >= 4 ? 2 : 1;
  const pool = SUBSTAT_POOL.filter(s => s.stat !== mainStat);
  const picked: ArtifactSubstat[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count && pool.length > 0; i++) {
    const available = pool.filter(s => !used.has(s.stat));
    if (available.length === 0) break;
    const s = available[Math.floor(Math.random() * available.length)];
    used.add(s.stat);
    const val = s.min + Math.floor(Math.random() * (s.max - s.min + 1));
    picked.push({ stat: s.stat, val, label: s.label });
  }
  return picked;
}

export function getSubstats(artifactId: string, mainStat: string, rarity: number): ArtifactSubstat[] {
  if (!substatMap[artifactId]) {
    substatMap[artifactId] = rollSubstats(mainStat, rarity);
  }
  return substatMap[artifactId];
}

export function applySubstatBonuses(
  artifactId: string, mainStat: string, rarity: number,
  out: { atk: number; bonusHp: number; elemDmg: number; burstDmg: number; critBonus: number }
): void {
  const subs = getSubstats(artifactId, mainStat, rarity);
  for (const s of subs) {
    if (s.stat === 'atk') out.atk += s.val;
    if (s.stat === 'hp') out.bonusHp += s.val;
    if (s.stat === 'critRate') out.critBonus += s.val / 100;
    if (s.stat === 'elemDmg') out.elemDmg += s.val / 100;
    if (s.stat === 'burstDmg') out.burstDmg += s.val / 100;
  }
}

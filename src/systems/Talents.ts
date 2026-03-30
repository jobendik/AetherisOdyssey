import { G } from '../core/GameState';
import { SFX } from '../audio/Audio';

/* ──── Talent definitions ──── */
export interface Talent {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: number; // mora cost
  lvReq: number; // minimum player level
  maxRank: number;
}

export interface TalentState {
  ranks: Record<string, number>; // talentId → current rank
}

/* Per-character talent trees (keyed by party index) */
const TALENTS: Talent[][] = [
  /* 0 – Aerin (Anemo / Support) */
  [
    { id: 'a_atk', name: 'Gale Strike',   desc: '+8% normal ATK per rank',      icon: '💨', cost: 100, lvReq: 2, maxRank: 5 },
    { id: 'a_cd',  name: 'Tailwind',       desc: '-0.8s skill CD per rank',      icon: '🌀', cost: 150, lvReq: 3, maxRank: 3 },
    { id: 'a_heal',name: 'Zephyr Blessing',desc: 'Burst heals +15 HP per rank',  icon: '🍃', cost: 200, lvReq: 5, maxRank: 3 },
  ],
  /* 1 – Kaela (Electro / DPS) */
  [
    { id: 'k_crit',name: 'Voltaic Edge',   desc: '+5% crit rate per rank',       icon: '⚡', cost: 100, lvReq: 2, maxRank: 5 },
    { id: 'k_chain',name:'Chain Lightning', desc: 'Skill chains to +1 enemy/rank',icon: '🔗', cost: 150, lvReq: 3, maxRank: 3 },
    { id: 'k_burst',name:'Supercell',       desc: '+15% burst DMG per rank',      icon: '🌩️', cost: 200, lvReq: 5, maxRank: 3 },
  ],
  /* 2 – Lyra (Cryo / Shielder) */
  [
    { id: 'l_shd', name: 'Permafrost',     desc: 'Shield +20 HP per rank',       icon: '🧊', cost: 100, lvReq: 2, maxRank: 5 },
    { id: 'l_dur', name: 'Icebound',       desc: 'Freeze lasts +0.5s per rank',  icon: '❄️', cost: 150, lvReq: 3, maxRank: 3 },
    { id: 'l_res', name: 'Glacial Aura',   desc: '-5% DMG taken per rank',       icon: '🛡️', cost: 200, lvReq: 5, maxRank: 3 },
  ],
  /* 3 – Solen (Pyro / Nuker) */
  [
    { id: 's_dmg', name: 'Ignition',       desc: '+10% elem DMG per rank',       icon: '🔥', cost: 100, lvReq: 2, maxRank: 5 },
    { id: 's_aoe', name: 'Wildfire',       desc: 'Skill radius +1 per rank',     icon: '💥', cost: 150, lvReq: 3, maxRank: 3 },
    { id: 's_meteor',name:'Cataclysm',     desc: 'Burst DMG mult +0.5 per rank', icon: '☄️', cost: 200, lvReq: 5, maxRank: 3 },
  ],
];

/* State storage */
const talentStates: TalentState[] = TALENTS.map(() => ({ ranks: {} }));

export function getTalentRank(partyIdx: number, talentId: string): number {
  return talentStates[partyIdx]?.ranks[talentId] ?? 0;
}

export function upgradeTalent(partyIdx: number, talentId: string): boolean {
  const tree = TALENTS[partyIdx];
  if (!tree) return false;
  const talent = tree.find(t => t.id === talentId);
  if (!talent) return false;
  const state = talentStates[partyIdx];
  const cur = state.ranks[talentId] ?? 0;
  if (cur >= talent.maxRank) return false;
  if (G.lv < talent.lvReq) return false;
  if (G.mora < talent.cost) return false;
  G.mora -= talent.cost;
  state.ranks[talentId] = cur + 1;
  SFX.lvlUp();
  return true;
}

/* ──── Apply talent bonuses to stats ──── */
export function getTalentBonuses(partyIdx: number): {
  atkMult: number; cdReduction: number; burstHeal: number;
  critBonus: number; burstDmg: number; shieldHp: number;
  dmgReduction: number; elemDmg: number; freezeBonus: number;
  skillRadiusBonus: number; burstDmgMult: number;
} {
  const s = talentStates[partyIdx];
  return {
    atkMult:         1 + (s.ranks['a_atk'] ?? 0) * 0.08,
    cdReduction:     (s.ranks['a_cd'] ?? 0) * 0.8,
    burstHeal:       (s.ranks['a_heal'] ?? 0) * 15,
    critBonus:       (s.ranks['k_crit'] ?? 0) * 0.05,
    burstDmg:        (s.ranks['k_burst'] ?? 0) * 0.15,
    shieldHp:        (s.ranks['l_shd'] ?? 0) * 20,
    freezeBonus:     (s.ranks['l_dur'] ?? 0) * 0.5,
    dmgReduction:    (s.ranks['l_res'] ?? 0) * 0.05,
    elemDmg:         (s.ranks['s_dmg'] ?? 0) * 0.10,
    skillRadiusBonus:(s.ranks['s_aoe'] ?? 0) * 1,
    burstDmgMult:    (s.ranks['s_meteor'] ?? 0) * 0.5,
  };
}

export function getTalentTree(partyIdx: number): Talent[] {
  return TALENTS[partyIdx] ?? [];
}

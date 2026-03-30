import type { PartyMember } from '../types';

export const PARTY: PartyMember[] = [
  {
    name: 'Aerin', role: 'Support', element: 'Anemo', portrait: '🍃',
    accent: '#72ffbf', burst: '#c2ff8a',
    hp: 100, maxHp: 100, skillCd: 0, burstCd: 0, burstEnergy: 40, baseDmg: 10,
    skillDesc: 'Vortex', burstDesc: 'Tornado',
    normalHits: 3, normalSpeed: 1.0, normalArc: 1.1, normalRange: 3.8,
    skillType: 'vortex', skillCdMax: 8, skillRadius: 7, skillDmgMult: 1.5,
    burstType: 'tornado', burstCdMax: 15, burstRadius: 10, burstDmgMult: 3, burstDur: 3,
    equippedWeapon: 'w1', equippedArtifact: null, equippedArtifacts: [],
  },
  {
    name: 'Kaela', role: 'DPS', element: 'Electro', portrait: '⚡',
    accent: '#c393ff', burst: '#f3c8ff',
    hp: 100, maxHp: 100, skillCd: 0, burstCd: 0, burstEnergy: 70, baseDmg: 14,
    skillDesc: 'Bolt', burstDesc: 'Storm',
    normalHits: 4, normalSpeed: 0.9, normalArc: 1.6, normalRange: 4.5,
    skillType: 'bolt', skillCdMax: 6, skillRadius: 5, skillDmgMult: 2.5,
    burstType: 'storm', burstCdMax: 12, burstRadius: 9, burstDmgMult: 4, burstDur: 0,
    equippedWeapon: 'w1', equippedArtifact: null, equippedArtifacts: [],
  },
  {
    name: 'Lyra', role: 'Shielder', element: 'Cryo', portrait: '❄',
    accent: '#8fe9ff', burst: '#b9f7ff',
    hp: 120, maxHp: 120, skillCd: 0, burstCd: 0, burstEnergy: 55, baseDmg: 9,
    skillDesc: 'Shield', burstDesc: 'Blizzard',
    normalHits: 2, normalSpeed: 0.75, normalArc: 1.0, normalRange: 3.5,
    skillType: 'shield', skillCdMax: 10, skillRadius: 0, skillDmgMult: 0,
    burstType: 'blizzard', burstCdMax: 15, burstRadius: 11, burstDmgMult: 2.5, burstDur: 0,
    equippedWeapon: 'w1', equippedArtifact: null, equippedArtifacts: [],
  },
  {
    name: 'Solen', role: 'Nuker', element: 'Pyro', portrait: '🔥',
    accent: '#ffb06b', burst: '#ffdd94',
    hp: 90, maxHp: 90, skillCd: 0, burstCd: 0, burstEnergy: 85, baseDmg: 18,
    skillDesc: 'Fire Dash', burstDesc: 'Meteor',
    normalHits: 2, normalSpeed: 0.6, normalArc: 1.4, normalRange: 4.0,
    skillType: 'dash', skillCdMax: 7, skillRadius: 3, skillDmgMult: 2.0,
    burstType: 'meteor', burstCdMax: 14, burstRadius: 8, burstDmgMult: 6, burstDur: 0,
    equippedWeapon: 'w1', equippedArtifact: null, equippedArtifacts: [],
  },
];

import type { Weapon, Artifact, Food, ArtifactSetBonus } from '../types';

export const WEAPONS: Weapon[] = [
  { id: 'w1', name: 'Dull Blade',     icon: '🗡️', rarity: 3, atk: 5,  desc: 'A basic blade.',          wtype: 'sword' },
  { id: 'w2', name: 'Iron Sting',     icon: '⚔️', rarity: 3, atk: 10, desc: 'Sharp iron blade.',       wtype: 'sword' },
  { id: 'w3', name: 'Prototype',      icon: '🔱', rarity: 4, atk: 18, desc: '+20% elem skill dmg.',    wtype: 'sword' },
  { id: 'w4', name: 'Jade Cutter',    icon: '💎', rarity: 5, atk: 30, desc: '+15% crit rate.',         wtype: 'sword' },
  { id: 'w5', name: 'Skyward',        icon: '✨', rarity: 5, atk: 35, desc: '3% lifesteal on hit.',    wtype: 'sword' },
  { id: 'w6', name: 'Wolf Gravestone',icon: '🪓', rarity: 4, atk: 24, desc: 'Slow & heavy. +40% stagger.', wtype: 'claymore' },
  { id: 'w7', name: 'Dragonspine',    icon: '🔩', rarity: 4, atk: 16, desc: 'Fast thrusts. +20% range.',   wtype: 'polearm' },
  { id: 'w8', name: 'Favonius Bow',   icon: '🏹', rarity: 4, atk: 14, desc: 'Ranged shots. Safe DPS.',     wtype: 'bow' },
  { id: 'w9', name: 'Lost Prayer',    icon: '📖', rarity: 5, atk: 12, desc: 'AoE magic. +30% elem DMG.',   wtype: 'catalyst' },
];

export const ARTIFACTS: Artifact[] = [
  { id: 'a1', name: 'Adventurer Flower',    icon: '🎗️', rarity: 3, stat: 'hp',      val: 20, desc: '+20 HP', setId: 'adventurer' },
  { id: 'a2', name: 'Berserker Mask',       icon: '🎭', rarity: 3, stat: 'atk',     val: 8,  desc: '+8 ATK', setId: 'berserker' },
  { id: 'a3', name: 'Gladiator Helm',       icon: '⛑️', rarity: 4, stat: 'atk',     val: 15, desc: '+15 ATK', setId: 'gladiator' },
  { id: 'a4', name: 'Crimson Witch Hat',    icon: '🔮', rarity: 4, stat: 'elemDmg', val: 25, desc: '+25% Elem DMG', setId: 'crimson' },
  { id: 'a5', name: 'Noblesse Crown',       icon: '👑', rarity: 5, stat: 'burstDmg',val: 40, desc: '+40% Burst DMG', setId: 'noblesse' },
  { id: 'a6', name: 'Tenacity Shield',      icon: '🛡️', rarity: 4, stat: 'hp',      val: 40, desc: '+40 HP', setId: 'tenacity' },
  { id: 'a7', name: 'Adventurer Plume',     icon: '🪶', rarity: 3, stat: 'atk',     val: 5,  desc: '+5 ATK', setId: 'adventurer' },
  { id: 'a8', name: 'Berserker Goblet',     icon: '🏆', rarity: 3, stat: 'hp',      val: 12, desc: '+12 HP', setId: 'berserker' },
  { id: 'a9', name: 'Gladiator Plume',      icon: '🦅', rarity: 4, stat: 'hp',      val: 25, desc: '+25 HP', setId: 'gladiator' },
  { id: 'a10', name: 'Crimson Witch Plume', icon: '🔥', rarity: 4, stat: 'atk',     val: 10, desc: '+10 ATK', setId: 'crimson' },
  { id: 'a11', name: 'Noblesse Plume',      icon: '✒️', rarity: 5, stat: 'atk',     val: 18, desc: '+18 ATK', setId: 'noblesse' },
  { id: 'a12', name: 'Tenacity Flower',     icon: '🌸', rarity: 4, stat: 'hp',      val: 30, desc: '+30 HP', setId: 'tenacity' },
  { id: 'a13', name: 'Gladiator Goblet',    icon: '🍷', rarity: 4, stat: 'elemDmg', val: 10, desc: '+10% Elem DMG', setId: 'gladiator' },
  { id: 'a14', name: 'Gladiator Sands',     icon: '⏳', rarity: 4, stat: 'atk',     val: 12, desc: '+12 ATK', setId: 'gladiator' },
  { id: 'a15', name: 'Crimson Witch Goblet',icon: '🧪', rarity: 4, stat: 'hp',      val: 20, desc: '+20 HP', setId: 'crimson' },
  { id: 'a16', name: 'Crimson Witch Sands', icon: '⌛', rarity: 4, stat: 'atk',     val: 14, desc: '+14 ATK', setId: 'crimson' },
];

export const ARTIFACT_SETS: Record<string, ArtifactSetBonus> = {
  adventurer: { name: 'Adventurer', two: { stat: 'hp', val: 30, desc: '+30 HP' }, four: { stat: 'healOnHit', val: 0.02, desc: '2% lifesteal' } },
  berserker:  { name: 'Berserker',  two: { stat: 'atk', val: 12, desc: '+12 ATK' }, four: { stat: 'critBonus', val: 0.20, desc: '+20% Crit Rate' } },
  gladiator:  { name: 'Gladiator',  two: { stat: 'atk', val: 18, desc: '+18 ATK' }, four: { stat: 'atkMult', val: 0.35, desc: '+35% Normal ATK' } },
  crimson:    { name: 'Crimson Witch', two: { stat: 'elemDmg', val: 15, desc: '+15% Elem DMG' }, four: { stat: 'elemDmg', val: 30, desc: '+30% more Elem DMG' } },
  noblesse:   { name: 'Noblesse',   two: { stat: 'burstDmg', val: 20, desc: '+20% Burst DMG' }, four: { stat: 'atk', val: 25, desc: '+25 ATK after burst' } },
  tenacity:   { name: 'Tenacity',   two: { stat: 'hp', val: 50, desc: '+50 HP' }, four: { stat: 'shieldStr', val: 0.30, desc: '+30% Shield STR' } },
};

export const FOODS: Food[] = [
  { id: 'f1', name: 'Apple',        icon: '🍎', rarity: 3, heal: 20,  desc: 'Restores 20 HP.' },
  { id: 'f2', name: 'Sweet Madame', icon: '🍗', rarity: 3, heal: 50,  desc: 'Restores 50 HP.' },
  { id: 'f3', name: 'Adeptus',      icon: '🍲', rarity: 4, heal: 999, desc: 'Full heal.' },
];

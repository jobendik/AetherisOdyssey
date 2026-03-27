import type { Weapon, Artifact, Food } from '../types';

export const WEAPONS: Weapon[] = [
  { id: 'w1', name: 'Dull Blade',  icon: '🗡️', rarity: 3, atk: 5,  desc: 'A basic blade.' },
  { id: 'w2', name: 'Iron Sting',  icon: '⚔️', rarity: 3, atk: 10, desc: 'Sharp iron blade.' },
  { id: 'w3', name: 'Prototype',   icon: '🔱', rarity: 4, atk: 18, desc: '+20% elem skill dmg.' },
  { id: 'w4', name: 'Jade Cutter', icon: '💎', rarity: 5, atk: 30, desc: '+15% crit rate.' },
  { id: 'w5', name: 'Skyward',     icon: '✨', rarity: 5, atk: 35, desc: '3% lifesteal on hit.' },
];

export const ARTIFACTS: Artifact[] = [
  { id: 'a1', name: 'Adventurer',    icon: '🎗️', rarity: 3, stat: 'hp',      val: 20, desc: '+20 HP' },
  { id: 'a2', name: 'Berserker',     icon: '🎭', rarity: 3, stat: 'atk',     val: 8,  desc: '+8 ATK' },
  { id: 'a3', name: 'Gladiator',     icon: '⛑️', rarity: 4, stat: 'atk',     val: 15, desc: '+15 ATK' },
  { id: 'a4', name: 'Crimson Witch', icon: '🔮', rarity: 4, stat: 'elemDmg', val: 25, desc: '+25% Elem DMG' },
  { id: 'a5', name: 'Noblesse',      icon: '👑', rarity: 5, stat: 'burstDmg',val: 40, desc: '+40% Burst DMG' },
  { id: 'a6', name: 'Tenacity',      icon: '🛡️', rarity: 4, stat: 'hp',      val: 40, desc: '+40 HP' },
];

export const FOODS: Food[] = [
  { id: 'f1', name: 'Apple',        icon: '🍎', rarity: 3, heal: 20,  desc: 'Restores 20 HP.' },
  { id: 'f2', name: 'Sweet Madame', icon: '🍗', rarity: 3, heal: 50,  desc: 'Restores 50 HP.' },
  { id: 'f3', name: 'Adeptus',      icon: '🍲', rarity: 4, heal: 999, desc: 'Full heal.' },
];

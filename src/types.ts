import * as THREE from 'three';

import type { DestructibleProp } from './world/Props';

/* ──────────────────────────── Party Member ──────────────────────────── */
export interface PartyMember {
  name: string;
  role: string;
  element: ElementType;
  portrait: string;
  accent: string;
  burst: string;
  hp: number;
  maxHp: number;
  skillCd: number;
  burstCd: number;
  burstEnergy: number;
  baseDmg: number;
  skillDesc: string;
  burstDesc: string;
  normalHits: number;
  normalSpeed: number;
  normalArc: number;
  normalRange: number;
  skillType: SkillType;
  skillCdMax: number;
  skillRadius: number;
  skillDmgMult: number;
  burstType: BurstType;
  burstCdMax: number;
  burstRadius: number;
  burstDmgMult: number;
  burstDur: number;
}

export type ElementType = 'Anemo' | 'Electro' | 'Cryo' | 'Pyro' | 'Hydro';
export type SkillType = 'vortex' | 'bolt' | 'shield' | 'dash';
export type BurstType = 'tornado' | 'storm' | 'blizzard' | 'meteor';
export type EnemyArchetype = 'slime' | 'archer' | 'shield' | 'wisp' | 'mage' | 'bomber';

/* ──────────────────────────── Enemy ──────────────────────────── */
export interface SlimeType {
  element: ElementType;
  color: number;
  core: number;
  emissive: number;
  name: string;
}

export interface EnemyTypeStats {
  hp: number;
  spd: number;
  atkRange: number;
  atkCd: number;
  dmg: number;
  xp: number;
  mora: number;
  aggro: number;
  shieldHp: number;
}

export interface EnemyEntity {
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  dead: boolean;
  attackCooldown: number;
  hurtTimer: number;
  frozenTimer: number;
  vel: THREE.Vector3;
  bobSeed: number;
  home: THREE.Vector3;
  type: SlimeType;
  level: number;
  appliedEl: ElementType | null;
  elTimer: number;
  isBoss: boolean;
  archetype: EnemyArchetype;
  shieldHp: number;
  maxShieldHp: number;
  isElite?: boolean;
  phaseTimer?: number;
  mixer?: THREE.AnimationMixer;
  animActions?: Record<string, THREE.AnimationAction>;
  currentAnim?: string;
}

export type WeaponType = 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst';

/* ──────────────────────────── Items ──────────────────────────── */
export interface Weapon {
  id: string;
  name: string;
  icon: string;
  rarity: number;
  atk: number;
  desc: string;
  wtype: WeaponType;
}

export interface Artifact {
  id: string;
  name: string;
  icon: string;
  rarity: number;
  stat: string;
  val: number;
  desc: string;
  setId?: string;
}

export interface ArtifactSetBonus {
  name: string;
  two: { stat: string; val: number; desc: string };
  four: { stat: string; val: number; desc: string };
}

export interface Food {
  id: string;
  name: string;
  icon: string;
  rarity: number;
  heal: number;
  desc: string;
}

export interface Reaction {
  n: string;
  c: string;
  m: number;
}

/* ──────────────────────────── Inventory ──────────────────────────── */
export interface InventoryState {
  weapons: string[];
  artifacts: string[];
  food: string[];
  equippedWeapon: string;
  equippedArtifact: string | null;
  equippedArtifacts: string[];
}

/* ──────────────────────────── Stats ──────────────────────────── */
export interface CalcStatsResult {
  atk: number;
  bonusHp: number;
  elemDmg: number;
  burstDmg: number;
  critBonus: number;
  healOnHit: number;
}

/* ──────────────────────────── Loot ──────────────────────────── */
export interface ChestLoot {
  t: string;
  id: string;
}

export interface ChestEntity {
  mesh: THREE.Group;
  opened: boolean;
  mora: number;
  xp: number;
  loot: ChestLoot;
}

/* ──────────────────────────── Misc Entities ──────────────────────────── */
export interface CollectibleEntity {
  mesh: THREE.Mesh;
  startY: number;
  collected: boolean;
}

export interface UpdraftEntity {
  x: number;
  z: number;
  radius: number;
  top: number;
}

export interface ParticleEntity {
  mesh: THREE.Mesh;
  life: number;
  vel: THREE.Vector3;
  ring?: boolean;
  ss?: number;
  es?: number;
}

export interface ProjectileEntity {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
}

/* ──────────────────────────── Player Materials ──────────────────────────── */
export interface PlayerMaterials {
  bm: THREE.MeshStandardMaterial;
  am: THREE.MeshStandardMaterial;
  sk: THREE.MeshStandardMaterial;
  hm: THREE.MeshStandardMaterial;
  dm: THREE.MeshStandardMaterial;
}

/* ──────────────────────────── UI Refs ──────────────────────────── */
export interface UIElements {
  [key: string]: HTMLElement;
}

/* ──────────────────────────── Entities Container ──────────────────────────── */
export interface EntitiesContainer {
  trees: Array<{ x: number; z: number; radius: number }>;
  slimes: EnemyEntity[];
  collectibles: CollectibleEntity[];
  updrafts: UpdraftEntity[];
  particles: ParticleEntity[];
  windParticles: THREE.Mesh[];
  chests: ChestEntity[];
  props: DestructibleProp[];
}

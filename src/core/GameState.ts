import * as THREE from 'three';
import type {
  InventoryState,
  EntitiesContainer,
  PlayerMaterials,
  EnemyEntity,
} from '../types';
import { PARTY } from '../data/PartyData';

/* ──────── Input key state ──────── */
export const keys = { w: 0, a: 0, s: 0, d: 0, shift: 0, space: 0 };

/* ──────── Constants ──────── */
export const W = 140;
export const CAM_D = 6.4;
export const P_RAD = 0.55;
export const GRAV = 34;

/* ──────── Global Game State ──────── */
export const G = {
  /* Three.js core */
  scene: null as THREE.Scene | null,
  cam: null as THREE.PerspectiveCamera | null,
  rend: null as THREE.WebGLRenderer | null,
  clock: null as THREE.Clock | null,

  /* Game flow */
  hasStarted: false,
  isActive: false,
  inDialogue: false,
  dialogueLines: [] as string[],
  dialogueIdx: 0,
  questPhase: 0,

  /* Player objects */
  player: null as THREE.Group | null,
  playerModel: null as THREE.Group | null,
  glider: null as THREE.Group | null,
  cape: null as THREE.Mesh | null,
  swordPivot: null as THREE.Group | null,
  limbs: {} as Record<string, THREE.Group>,
  npc: null as THREE.Group | null,
  terrain: null as THREE.Mesh | null,
  water: null as THREE.Mesh | null,

  /* Time */
  worldTime: 0,
  dayTime: 0.3,

  /* Camera */
  camYaw: 0,
  camPitch: 0.25,
  baseFov: 70,

  /* Player physics */
  pVel: new THREE.Vector3(),
  isGrounded: false,
  isGliding: false,
  isDashing: false,
  moveVec: new THREE.Vector3(),

  /* Combat timers */
  atkTimer: 0,
  atkCombo: 0,
  invulnTimer: 0,
  dashTimer: 0,
  dashCd: 0,
  activeIdx: 0,

  /* Combat stats */
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  skillCd: 0,
  burstCd: 0,
  burstEnergy: 40,
  shield: 0,
  maxShield: 0,
  shieldTimer: 0,
  isSprinting: false,
  target: null as EnemyEntity | null,

  /* Combo */
  comboHits: 0,
  comboTimer: 0,
  comboMult: 1,

  /* Progression */
  xp: 0,
  xpNext: 50,
  lv: 1,
  mora: 0,

  /* Effects */
  screenShake: 0,
  shakeDecay: 0,
  hitstop: 0,

  /* Performance */
  fpsSamples: [] as number[],
  pingMs: 32,

  /* Update throttles */
  lastMini: 0,
  lastHud: 0,
  needsAmbient: false,

  /* Platform */
  mobile: typeof window !== 'undefined'
    ? window.matchMedia('(pointer:coarse)').matches
    : false,

  /* Lighting */
  sunLight: null as THREE.DirectionalLight | null,

  /* Waves & boss */
  enemiesKilled: 0,
  waveCount: 0,
  bossEntity: null as EnemyEntity | null,
  bossPhase: 0,
  bossActive: false,

  /* Tornado */
  tornadoTimer: 0,
  tornadoPos: null as THREE.Vector3 | null,

  /* Inventory */
  invOpen: false,
  inventory: {
    weapons: ['w1'],
    artifacts: [],
    food: ['f1', 'f1', 'f1'],
    equippedWeapon: 'w1',
    equippedArtifact: null,
  } as InventoryState,

  /* Projectiles */
  projectiles: [] as Array<{
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    life: number;
    dmg: number;
  }>,

  /* Player materials */
  pMats: {} as PlayerMaterials,

  /* All world entities */
  entities: {
    trees: [],
    slimes: [],
    collectibles: [],
    updrafts: [],
    particles: [],
    windParticles: [],
    chests: [],
  } as EntitiesContainer,
};

/* ──────── Party member save/load ──────── */
export function saveMem(): void {
  const m = PARTY[G.activeIdx];
  m.hp = G.health;
  m.maxHp = G.maxHealth;
  m.skillCd = G.skillCd;
  m.burstCd = G.burstCd;
  m.burstEnergy = G.burstEnergy;
}

export function loadMem(): void {
  const m = PARTY[G.activeIdx];
  G.health = m.hp;
  G.maxHealth = m.maxHp;
  G.skillCd = m.skillCd;
  G.burstCd = m.burstCd;
  G.burstEnergy = m.burstEnergy;
}

export function mem() {
  return PARTY[G.activeIdx];
}

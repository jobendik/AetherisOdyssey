import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { mkMesh, mkPointLight, wH, rwp, distXZ, lerp } from '../core/Helpers';
import { SLIME_TYPES, ENEMY_TYPES } from '../data/EnemyData';
import type { EnemyEntity, EnemyArchetype } from '../types';
import { SFX } from '../audio/Audio';
import { takeDamage } from '../combat/DamageSystem';
import { shootArrow } from '../combat/Projectiles';
import { spawnParts } from '../systems/Particles';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/* ──── Attack telegraph: ground warning circle ──── */
function spawnTelegraph(pos: THREE.Vector3, radius: number, color: number, duration: number): void {
  const geo = new THREE.RingGeometry(radius * 0.7, radius, 32);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(pos);
  ring.position.y = wH(pos.x, pos.z) + 0.1;
  G.scene!.add(ring);

  /* Fill indicator */
  const fillGeo = new THREE.CircleGeometry(radius, 32);
  const fillMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const fill = new THREE.Mesh(fillGeo, fillMat);
  fill.rotation.x = -Math.PI / 2;
  fill.position.copy(ring.position);
  fill.position.y += 0.05;
  G.scene!.add(fill);

  let t = 0;
  const tick = () => {
    t += 0.016;
    const prog = Math.min(t / duration, 1);
    fillMat.opacity = 0.2 * prog;
    fill.scale.setScalar(prog);
    mat.opacity = 0.45 * (1 - prog * 0.5);
    if (t >= duration) {
      /* Flash and remove */
      mat.opacity = 0.7;
      fillMat.opacity = 0.4;
      setTimeout(() => {
        G.scene!.remove(ring);
        G.scene!.remove(fill);
        geo.dispose(); mat.dispose();
        fillGeo.dispose(); fillMat.dispose();
      }, 100);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ──── Element icon colors ──── */
const EL_ICON_COLORS: Record<string, number> = {
  Pyro: 0xff4422,
  Cryo: 0x88ccff,
  Electro: 0xcc66ff,
  Anemo: 0x66ffcc,
  Hydro: 0x4488ff,
};

interface EnemyFBXData {
  mesh: THREE.Group;
  clips: Record<string, THREE.AnimationClip>;
}

export const ENEMY_MODELS: Record<string, EnemyFBXData> = {};
let enemyModelLoadPromise: Promise<void> | null = null;

export async function loadEnemyModels(): Promise<void> {
  if (enemyModelLoadPromise) return enemyModelLoadPromise;

  const loader = new FBXLoader();
  enemyModelLoadPromise = (async () => {
    try {
      const [mutant, mutIdle, mutWalk, mutAtk, mutDeath] = await Promise.all([
        loader.loadAsync('/models/enemies/mutant/Mutant.fbx'),
        loader.loadAsync('/models/enemies/mutant/Breathing Idle.fbx'),
        loader.loadAsync('/models/enemies/mutant/Walking (1).fbx'),
        loader.loadAsync('/models/enemies/mutant/Zombie Attack.fbx'),
        loader.loadAsync('/models/enemies/mutant/Death.fbx'),
      ]);
      mutant.scale.setScalar(0.035);
      mutant.traverse((child) => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true; } });
      ENEMY_MODELS['slime'] = {
        mesh: mutant,
        clips: {
          idle: mutIdle.animations[0],
          walk: mutWalk.animations[0],
          attack: mutAtk.animations[0],
          death: mutDeath.animations[0],
        }
      };

      const [warrok, warIdle, warWalk, warAtk, warHit, warDeath] = await Promise.all([
        loader.loadAsync('/models/enemies/humanoid/Warrok W Kurniawan.fbx'),
        loader.loadAsync('/models/enemies/humanoid/Idle (1).fbx'),
        loader.loadAsync('/models/enemies/humanoid/Walking (2).fbx'),
        loader.loadAsync('/models/enemies/humanoid/Zombie Attack (1).fbx'),
        loader.loadAsync('/models/enemies/humanoid/Stomach Hit.fbx'),
        loader.loadAsync('/models/enemies/humanoid/Sword And Shield Death.fbx'),
      ]);
      warrok.scale.setScalar(0.028);
      warrok.traverse((child) => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true; } });
      const humanData = {
        mesh: warrok,
        clips: {
          idle: warIdle.animations[0],
          walk: warWalk.animations[0],
          attack: warAtk.animations[0],
          hit: warHit.animations[0],
          death: warDeath.animations[0],
        }
      };
      ENEMY_MODELS['archer'] = humanData;
      ENEMY_MODELS['shield'] = humanData;
      ENEMY_MODELS['mage'] = humanData;
      ENEMY_MODELS['bomber'] = humanData;

      const [vamp, vampIdle, vampFloat, vampDie] = await Promise.all([
        loader.loadAsync('/models/enemies/wisp/Vampire A Lusth.fbx'),
        loader.loadAsync('/models/enemies/wisp/Falling Idle.fbx'),
        loader.loadAsync('/models/enemies/wisp/Floating.fbx'),
        loader.loadAsync('/models/enemies/wisp/Dying.fbx'),
      ]);
      vamp.scale.setScalar(0.028);
      vamp.traverse((child) => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true; } });
      ENEMY_MODELS['wisp'] = {
        mesh: vamp,
        clips: {
          idle: vampIdle.animations[0],
          walk: vampFloat.animations[0],
          attack: vampIdle.animations[0],
          death: vampDie.animations[0],
        }
      };
      console.log('Enemy models loaded');
    } catch(e) {
      console.error('Failed to load enemy FBX:', e);
    }
  })();

  return enemyModelLoadPromise;
}

export function createEnemy(
  x: number,
  y: number,
  z: number,
  archetype: EnemyArchetype,
  typeIdx?: number,
): EnemyEntity {
  if (typeIdx === undefined) typeIdx = Math.floor(Math.random() * SLIME_TYPES.length);
  const st = SLIME_TYPES[typeIdx];
  const et = ENEMY_TYPES[archetype];
  const mesh = new THREE.Group();
  const lv = Math.max(1, G.lv + Math.floor(Math.random() * 3) - 1);
  const hpMult = 1 + (lv - 1) * 0.25;
  const yOff = archetype === 'wisp' ? 3 : archetype === 'slime' ? 0 : 0;
  
  let mixer: THREE.AnimationMixer | undefined;
  let animActions: Record<string, THREE.AnimationAction> | undefined;

  const mData = ENEMY_MODELS[archetype];
  if (mData) {
    const clone = SkeletonUtils.clone(mData.mesh);
    mesh.add(clone);
    mixer = new THREE.AnimationMixer(clone);
    animActions = {};
    for (const [k, clip] of Object.entries(mData.clips)) {
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      if (k === 'attack' || k === 'hit' || k === 'death') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      animActions[k] = action;
    }
    if (animActions.idle) animActions.idle.play();
  } else {
    /* Fallback procedural meshes if models haven't loaded yet... */
    if (archetype === 'slime') {
      mesh.add(new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 12), new THREE.MeshStandardMaterial({ color: st.color, flatShading: true })));
    } else if (archetype === 'archer' || archetype === 'shield') {
      mesh.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.4), new THREE.MeshStandardMaterial({ color: 0x665544, flatShading: true })));
    } else if (archetype === 'wisp') {
      mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), new THREE.MeshStandardMaterial({ color: st.color, emissive: st.emissive, emissiveIntensity: 1.2, flatShading: true, transparent: true, opacity: 0.85 })));
    } else if (archetype === 'mage') {
      /* Tall robed figure */
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.2, 6), new THREE.MeshStandardMaterial({ color: st.color, flatShading: true }));
      body.position.y = 1.1;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshStandardMaterial({ color: st.core, emissive: st.emissive, emissiveIntensity: 0.6 }));
      head.position.y = 2.5;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshBasicMaterial({ color: st.color }));
      orb.position.set(0.7, 1.5, 0);
      orb.name = 'mageOrb';
      mesh.add(body, head, orb);
    } else if (archetype === 'bomber') {
      /* Squat round body */
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 10), new THREE.MeshStandardMaterial({ color: 0x554433, flatShading: true }));
      body.position.y = 0.8;
      const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), new THREE.MeshBasicMaterial({ color: 0xff6600 }));
      fuse.position.set(0, 1.6, 0);
      mesh.add(body, fuse);
    }
  }

  mesh.position.set(x, y + yOff, z);
  G.scene!.add(mesh);

  /* Element status icon (sprite above head) */
  const iconSpriteMat = new THREE.SpriteMaterial({
    color: EL_ICON_COLORS[st.element] || 0xffffff,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const iconSprite = new THREE.Sprite(iconSpriteMat);
  iconSprite.scale.setScalar(0.6);
  iconSprite.position.y = archetype === 'wisp' ? 2.5 : 3.2;
  iconSprite.visible = false;
  mesh.add(iconSprite);

  const entity: EnemyEntity = {
    mesh,
    hp: Math.ceil(et.hp * hpMult),
    maxHp: Math.ceil(et.hp * hpMult),
    dead: false,
    attackCooldown: 0,
    hurtTimer: 0,
    frozenTimer: 0,
    vel: new THREE.Vector3(),
    bobSeed: Math.random() * 10,
    home: mesh.position.clone(),
    type: st,
    level: lv,
    appliedEl: st.element,
    elTimer: 99,
    isBoss: false,
    archetype,
    shieldHp: et.shieldHp || 0,
    maxShieldHp: et.shieldHp || 0,
    isElite: false,
    mixer,
    animActions,
    currentAnim: 'idle',
  };

  /* ── Elite variant: ~15% chance, stat buffs, glowing aura ── */
  if (Math.random() < 0.15) {
    entity.isElite = true;
    entity.hp = Math.ceil(entity.hp * 2.5);
    entity.maxHp = entity.hp;
    entity.level += 3;
    /* Scale up slightly */
    mesh.scale.setScalar(1.3);
    /* Add glowing aura ring */
    const auraGeo = new THREE.RingGeometry(1.5, 2.0, 24);
    const auraMat = new THREE.MeshBasicMaterial({
      color: st.color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.1;
    aura.name = 'eliteAura';
    mesh.add(aura);
    /* Add point light */
    const glow = mkPointLight(st.color, 0.8, 6);
    glow.position.y = 1.5;
    glow.name = 'eliteGlow';
    mesh.add(glow);
  }

  G.entities.slimes.push(entity);
  return entity;
}

export function populateEnemies(count: number, arch: EnemyArchetype): void {
  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(45, 110, -0.4);
    createEnemy(x, y, z, arch);
  }
}

function playEnemyAnim(s: EnemyEntity, name: string) {
  if (!s.mixer || !s.animActions || !s.animActions[name] || s.currentAnim === name) return;
  const next = s.animActions[name];
  const prev = s.currentAnim ? s.animActions[s.currentAnim] : null;
  if (['attack', 'hit', 'death'].includes(name)) next.reset();
  next.reset().fadeIn(0.2).play();
  if (prev) prev.fadeOut(0.2);
  s.currentAnim = name;
}

/** Check if it's currently night (dayTime 0.35–0.85 roughly) */
export function isNight(): boolean {
  return G.dayTime > 0.35 && G.dayTime < 0.85;
}

/* Reusable temp vectors to eliminate per-frame allocations */
const _enemyTP = new THREE.Vector3();
const _enemyFL = new THREE.Vector3();
const _enemyPrevPos = new THREE.Vector3();

/* Reusable arrays for group tactics — avoids GC pressure */
const _engaged: EnemyEntity[] = [];
const _meleeEngaged: EnemyEntity[] = [];
const _rangedEngaged: EnemyEntity[] = [];

/* Cached geometries for VFX to avoid per-use creation */
const _mageBurstGeo = new THREE.SphereGeometry(3.5, 12, 8);
const _bomberExplodeGeo = new THREE.SphereGeometry(4, 12, 8);

export function updateEnemies(dt: number): void {
  const nightMult = isNight() ? 1.4 : 1;

  /* ── Group tactics: compute engaged enemies and assign surround angles ── */
  _engaged.length = 0;
  _meleeEngaged.length = 0;
  _rangedEngaged.length = 0;
  for (const s of G.entities.slimes) {
    if (s.isBoss || s.dead) continue;
    const d = distXZ(s.mesh.position, G.player!.position);
    if (d < ENEMY_TYPES[s.archetype].aggro) _engaged.push(s);
  }
  for (const e of _engaged) {
    const a = e.archetype;
    if (a === 'slime' || a === 'shield' || a === 'bomber') _meleeEngaged.push(e);
    else _rangedEngaged.push(e);
  }
  /* Assign angular offsets so melee enemies surround the player */
  const spreadMap = new Map<EnemyEntity, number>();
  if (_meleeEngaged.length > 1) {
    const step = (Math.PI * 2) / _meleeEngaged.length;
    _meleeEngaged.forEach((e, i) => spreadMap.set(e, step * i));
  }
  /* Ranged enemies get flanking angles (offset from player-facing) */
  if (_rangedEngaged.length > 1) {
    const step = Math.PI / (_rangedEngaged.length + 1);
    _rangedEngaged.forEach((e, i) => spreadMap.set(e, Math.PI * 0.5 + step * (i + 1)));
  }
  /* Stagger attacks: only allow 1-2 enemies to attack per frame window */
  let atkSlots = 2;

  for (const s of G.entities.slimes) {
    if (s.isBoss) continue;
    if (s.mixer) s.mixer.update(dt);
    if (s.dead) {
      playEnemyAnim(s, 'death');
      continue;
    }

    s.attackCooldown = Math.max(0, s.attackCooldown - dt);
    s.hurtTimer = Math.max(0, s.hurtTimer - dt);

    const prevPos = _enemyPrevPos.copy(s.mesh.position);

    // Frozen
    if (s.frozenTimer > 0) {
      s.frozenTimer -= dt;
    }

    if (s.elTimer > 0) s.elTimer -= dt;
    if (s.elTimer <= 0) s.appliedEl = s.type.element;

    const et = ENEMY_TYPES[s.archetype];

    _enemyTP.copy(G.player!.position).sub(s.mesh.position);
    const d = _enemyTP.length();
    _enemyFL.set(_enemyTP.x, 0, _enemyTP.z);
    const fd = _enemyFL.length();
    if (fd > 0.001) { _enemyFL.x /= fd; _enemyFL.z /= fd; }

    const fl = _enemyFL;
    const tp = _enemyTP;

    if (d < et.aggro) {
      G.combatTimer = 10;
    }

    /** Try to move enemy in x/z, rejecting if terrain is too steep */
    const tryMove = (dx: number, dz: number): void => {
      const nx = s.mesh.position.x + dx;
      const nz = s.mesh.position.z + dz;
      const currentH = wH(s.mesh.position.x, s.mesh.position.z);
      const targetH = wH(nx, nz);
      /* Reject movement into slopes steeper than 3 units height difference */
      if (Math.abs(targetH - currentH) > 3) return;
      /* Reject movement into water/void */
      if (targetH < -1) return;
      s.mesh.position.x = nx;
      s.mesh.position.z = nz;
    };

    if (s.archetype === 'slime') {
      if (d < et.aggro && fd > 1.6) {
        /* Surround: steer toward assigned angle around player */
        const spreadAng = spreadMap.get(s);
        if (spreadAng !== undefined && fd < 8) {
          const baseAng = Math.atan2(fl.x, fl.z);
          const targetAng = baseAng + spreadAng;
          const tx = G.player!.position.x - Math.sin(targetAng) * 3;
          const tz = G.player!.position.z - Math.cos(targetAng) * 3;
          const dx2 = tx - s.mesh.position.x;
          const dz2 = tz - s.mesh.position.z;
          const dl2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
          if (dl2 > 0.5) {
            tryMove((dx2 / dl2) * et.spd * dt, (dz2 / dl2) * et.spd * dt);
          }
        } else {
          tryMove(fl.x * et.spd * dt, fl.z * et.spd * dt);
        }
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
      }
      if (fd < et.atkRange && s.attackCooldown <= 0 && atkSlots > 0) {
        atkSlots--;
        s.attackCooldown = et.atkCd;
        spawnTelegraph(G.player!.position.clone(), 2.5, 0xff4444, 0.5);
        s.vel.x = fl.x * 12;
        s.vel.z = fl.z * 12;
        s.vel.y = 8.5;
        SFX.jump();
      }
      if (fd < 1.8 && s.vel.lengthSq() > 18 && G.invulnTimer <= 0)
        takeDamage(et.dmg * (s.isElite ? 1.5 : 1) * nightMult, s.mesh.position);
    } else if (s.archetype === 'archer') {
      if (d < et.aggro) {
        /* Flanking: archers strafe to assigned flanking angle */
        const spreadAng = spreadMap.get(s);
        if (spreadAng !== undefined) {
          const baseAng = Math.atan2(fl.x, fl.z);
          const targetAng = baseAng + spreadAng;
          const idealDist = 13;
          const tx = G.player!.position.x - Math.sin(targetAng) * idealDist;
          const tz = G.player!.position.z - Math.cos(targetAng) * idealDist;
          const dx2 = tx - s.mesh.position.x;
          const dz2 = tz - s.mesh.position.z;
          const dl2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
          if (dl2 > 1) {
            tryMove((dx2 / dl2) * et.spd * dt, (dz2 / dl2) * et.spd * dt);
          }
        } else if (fd < 10) {
          tryMove(-fl.x * et.spd * dt, -fl.z * et.spd * dt);
        } else if (fd > 16) {
          tryMove(fl.x * et.spd * dt, fl.z * et.spd * dt);
        }
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
        if (s.attackCooldown <= 0 && fd < et.atkRange && atkSlots > 0) {
          atkSlots--;
          s.attackCooldown = et.atkCd;
          spawnTelegraph(G.player!.position.clone(), 1.5, 0xffaa22, 0.5);
          setTimeout(() => { if (!s.dead) shootArrow(s); }, 500);
        }
      }
    } else if (s.archetype === 'shield') {
      if (d < et.aggro && fd > 1.8) {
        /* Surround like slimes */
        const spreadAng = spreadMap.get(s);
        if (spreadAng !== undefined && fd < 8) {
          const baseAng = Math.atan2(fl.x, fl.z);
          const targetAng = baseAng + spreadAng;
          const tx = G.player!.position.x - Math.sin(targetAng) * 2.5;
          const tz = G.player!.position.z - Math.cos(targetAng) * 2.5;
          const dx2 = tx - s.mesh.position.x;
          const dz2 = tz - s.mesh.position.z;
          const dl2 = Math.sqrt(dx2 * dx2 + dz2 * dz2);
          if (dl2 > 0.5) {
            tryMove((dx2 / dl2) * et.spd * dt, (dz2 / dl2) * et.spd * dt);
          }
        } else {
          tryMove(fl.x * et.spd * dt, fl.z * et.spd * dt);
        }
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
      }
      if (fd < et.atkRange && s.attackCooldown <= 0 && atkSlots > 0) {
        atkSlots--;
        s.attackCooldown = et.atkCd;
        spawnTelegraph(G.player!.position.clone(), 2.8, 0xff4444, 0.4);
        s.vel.x = fl.x * 10;
        s.vel.z = fl.z * 10;
        s.vel.y = 5;
        SFX.jump();
      }
      if (fd < 2.2 && s.vel.lengthSq() > 12 && G.invulnTimer <= 0)
        takeDamage(et.dmg * (s.isElite ? 1.5 : 1) * nightMult, s.mesh.position);
      if (
        s.shieldHp > 0 &&
        s.mesh.children[2] &&
        (s.mesh.children[2] as THREE.Mesh).material
      ) {
        ((s.mesh.children[2] as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity =
          0.5 + 0.5 * (s.shieldHp / s.maxShieldHp);
      }
    } else if (s.archetype === 'wisp') {
      const wobX = Math.sin(G.worldTime * 3 + s.bobSeed * 5) * 8;
      const wobZ = Math.cos(G.worldTime * 2.5 + s.bobSeed * 3) * 8;
      if (d < et.aggro) {
        const tx = G.player!.position.x + wobX;
        const tz = G.player!.position.z + wobZ;
        const dx2 = tx - s.mesh.position.x;
        const dz2 = tz - s.mesh.position.z;
        const dl = Math.sqrt(dx2 * dx2 + dz2 * dz2);
        if (dl > 1) {
          /* Wisps float so they don't need terrain checks */
          s.mesh.position.x += (dx2 / dl) * et.spd * dt;
          s.mesh.position.z += (dz2 / dl) * et.spd * dt;
        }
        const wispGnd = wH(s.mesh.position.x, s.mesh.position.z) + 3;
        s.mesh.position.y = wispGnd + Math.sin(G.worldTime * 2 + s.bobSeed) * 0.8;
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
        if (s.attackCooldown <= 0 && fd < et.atkRange && atkSlots > 0) {
          atkSlots--;
          s.attackCooldown = et.atkCd;
          spawnTelegraph(G.player!.position.clone(), 1.5, 0xcc66ff, 0.3);
          shootArrow(s);
        }
      }
    } else if (s.archetype === 'mage') {
      /* Mage: keeps distance, casts AoE spells, teleports if player gets close */
      if (d < et.aggro) {
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
        /* Teleport blink away if player too close */
        if (fd < 6 && s.attackCooldown < et.atkCd - 1) {
          const escAng = Math.atan2(-fl.x, -fl.z) + (Math.random() - 0.5) * 1.2;
          const blinkDist = 10;
          const bx = s.mesh.position.x + Math.sin(escAng) * blinkDist;
          const bz = s.mesh.position.z + Math.cos(escAng) * blinkDist;
          const bGnd = wH(bx, bz);
          if (bGnd > -1) {
            /* Blink particles at old position — use pooled particles */
            spawnParts(s.mesh.position.clone(), '#9966ff', 5, 4);
            s.mesh.position.set(bx, bGnd, bz);
          }
        } else if (fd < 12) {
          /* Back away */
          tryMove(-fl.x * et.spd * dt, -fl.z * et.spd * dt);
        } else if (fd > 18) {
          tryMove(fl.x * et.spd * dt, fl.z * et.spd * dt);
        }
        /* AoE spell: telegraph circle at player position, delayed damage */
        if (s.attackCooldown <= 0 && fd < et.atkRange && atkSlots > 0) {
          atkSlots--;
          s.attackCooldown = et.atkCd;
          const targetPos = G.player!.position.clone();
          spawnTelegraph(targetPos, 3.5, 0x9966ff, 1.0);
          setTimeout(() => {
            if (s.dead) return;
            /* AoE damage at telegraphed location */
            if (distXZ(targetPos, G.player!.position) < 3.5 && G.invulnTimer <= 0) {
              takeDamage(et.dmg * (s.isElite ? 1.5 : 1), targetPos);
            }
            /* Visual burst */
            const burst = new THREE.Mesh(
              _mageBurstGeo,
              new THREE.MeshBasicMaterial({ color: 0x9966ff, transparent: true, opacity: 0.4, depthWrite: false }),
            );
            burst.position.copy(targetPos);
            burst.position.y = wH(targetPos.x, targetPos.z) + 0.5;
            G.scene!.add(burst);
            let burstT = 0;
            const burstTick = () => {
              burstT += 0.016;
              burst.scale.setScalar(1 + burstT * 3);
              (burst.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - burstT * 2);
              if (burstT < 0.5) requestAnimationFrame(burstTick);
              else G.scene!.remove(burst);
            };
            requestAnimationFrame(burstTick);
          }, 1000);
        }
      }
      /* Floating orb animation */
      const orb = s.mesh.getObjectByName('mageOrb') as THREE.Mesh | undefined;
      if (orb) {
        orb.position.y = 1.5 + Math.sin(G.worldTime * 3 + s.bobSeed) * 0.3;
        orb.rotation.y += dt * 2;
      }
    } else if (s.archetype === 'bomber') {
      /* Bomber: charges at player, explodes on contact dealing AoE damage */
      if (d < et.aggro) {
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
        /* Sprint toward player */
        if (fd > 1.5) {
          tryMove(fl.x * et.spd * dt * 1.5, fl.z * et.spd * dt * 1.5);
        }
        /* Fuse animation: flash faster as closer */
        const fuse = s.mesh.children[1] as THREE.Mesh | undefined;
        if (fuse && (fuse as THREE.Mesh).isMesh && (fuse.material as THREE.MeshStandardMaterial).emissive) {
          const flashRate = Math.max(2, 10 - fd);
          (fuse.material as THREE.MeshStandardMaterial).emissive.setHex(
            Math.sin(G.worldTime * flashRate) > 0 ? 0xff6600 : 0xff0000
          );
          (fuse.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5;
        }
        /* Self-destruct when close */
        if (fd < et.atkRange && s.attackCooldown <= 0 && atkSlots > 0) {
          atkSlots--;
          s.attackCooldown = et.atkCd;
          spawnTelegraph(s.mesh.position.clone(), 4, 0xff6600, 0.6);
          setTimeout(() => {
            if (s.dead) return;
            /* Explosion VFX */
            const explode = new THREE.Mesh(
              _bomberExplodeGeo,
              new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.6, depthWrite: false }),
            );
            explode.position.copy(s.mesh.position);
            G.scene!.add(explode);
            let exT = 0;
            const exTick = () => {
              exT += 0.016;
              explode.scale.setScalar(1 + exT * 4);
              (explode.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - exT * 1.5);
              if (exT < 0.7) requestAnimationFrame(exTick);
              else G.scene!.remove(explode);
            };
            requestAnimationFrame(exTick);
            /* AOE damage to player */
            if (distXZ(s.mesh.position, G.player!.position) < 5 && G.invulnTimer <= 0) {
              takeDamage(et.dmg * (s.isElite ? 1.5 : 1), s.mesh.position);
            }
            SFX.jump();
            /* Bomber dies after exploding */
            s.hp = 0;
            s.dead = true;
          }, 600);
        }
      }
    }

    /* Apply velocity (knockback / lunges) */
    s.mesh.position.addScaledVector(s.vel, dt);
    s.vel.y -= 28 * dt;
    s.vel.x = lerp(s.vel.x, 0, dt * 3.4);
    s.vel.z = lerp(s.vel.z, 0, dt * 3.4);

    /* Snap ground-based enemies to terrain every frame */
    if (s.archetype !== 'wisp') {
      const gnd = wH(s.mesh.position.x, s.mesh.position.z);
      if (s.mesh.position.y <= gnd) {
        s.mesh.position.y = gnd;
        s.vel.y = Math.max(0, s.vel.y);
      }
    }

    const dx_m = s.mesh.position.x - prevPos.x;
    const dz_m = s.mesh.position.z - prevPos.z;
    const moved = (dx_m * dx_m + dz_m * dz_m) > 0.001;

    /* Spin elite aura ring */
    if (s.isElite) {
      const aura = s.mesh.getObjectByName('eliteAura') as THREE.Mesh | undefined;
      if (aura) aura.rotation.z += dt * 1.2;
    }
    if (s.hurtTimer > 0) playEnemyAnim(s, 'hit');
    else if (s.attackCooldown > ENEMY_TYPES[s.archetype].atkCd - 0.8) playEnemyAnim(s, 'attack');
    else if (moved || s.vel.lengthSq() > 1) playEnemyAnim(s, 'walk');
    else playEnemyAnim(s, 'idle');

    // Hurt flash
    s.mesh.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          if (s.hurtTimer > 0) {
            mat.emissive.set(0xffffff);
            mat.emissiveIntensity = s.hurtTimer * 4;
          } else if (mat.emissiveIntensity > 0) {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
      }
    });

    /* Element status icon above head */
    const hasApplied = s.appliedEl && s.appliedEl !== s.type.element && s.elTimer > 0;
    const iconSprite = s.mesh.children[s.mesh.children.length - 1] as THREE.Sprite;
    if (iconSprite && iconSprite.isSprite) {
      iconSprite.visible = !!hasApplied;
      if (hasApplied) {
        (iconSprite.material as THREE.SpriteMaterial).color.setHex(
          EL_ICON_COLORS[s.appliedEl!] || 0xffffff,
        );
        (iconSprite.material as THREE.SpriteMaterial).opacity =
          0.7 + Math.sin(G.worldTime * 5) * 0.2;
      }
    }
  }
}

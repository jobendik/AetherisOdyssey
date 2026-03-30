import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { mkMesh, mkPointLight, wH, distXZ, lerp, rwp } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { ui } from '../ui/UIRefs';
import { takeDamage } from '../combat/DamageSystem';
import { showReaction } from '../combat/Reactions';
import { spawnRing, spawnParts } from '../systems/Particles';
import { createEnemy } from './Enemy';
import type { EnemyEntity } from '../types';
import { addStellaFortuna } from '../systems/Constellations';

import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ENEMY_MODELS } from './Enemy';

/* ─── Arena barrier ─── */
const ARENA_RADIUS = 28;
let arenaBarrier: THREE.Mesh | null = null;

function buildArenaBarrier(center: THREE.Vector3): void {
  if (arenaBarrier) return;
  const geo = new THREE.SphereGeometry(ARENA_RADIUS, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vPos;
      void main() {
        float h = vPos.y / ${ARENA_RADIUS.toFixed(1)};
        float hex = abs(sin(vPos.x * 2.0 + vPos.z * 2.0 + uTime * 1.5)) * 0.3;
        float alpha = (0.08 + hex * 0.08) * (1.0 - h * 0.6);
        gl_FragColor = vec4(1.0, 0.2, 0.15, alpha);
      }
    `,
  });
  arenaBarrier = new THREE.Mesh(geo, mat);
  arenaBarrier.position.copy(center);
  G.scene!.add(arenaBarrier);
}

export function removeArenaBarrier(): void {
  if (!arenaBarrier) return;
  G.scene!.remove(arenaBarrier);
  (arenaBarrier.material as THREE.ShaderMaterial).dispose();
  arenaBarrier.geometry.dispose();
  arenaBarrier = null;
}

function playBossAnim(b: EnemyEntity, name: string) {
  if (!b.mixer || !b.animActions || !b.animActions[name] || b.currentAnim === name) return;
  const next = b.animActions[name];
  const prev = b.currentAnim ? b.animActions[b.currentAnim] : null;
  if (['attack', 'hit', 'death'].includes(name)) next.reset();
  next.reset().fadeIn(0.2).play();
  if (prev) prev.fadeOut(0.2);
  b.currentAnim = name;
}

export function createBoss(x: number, y: number, z: number): EnemyEntity {
  const mesh = new THREE.Group();
  let mixer: THREE.AnimationMixer | undefined;
  let animActions: Record<string, THREE.AnimationAction> | undefined;

  const mData = ENEMY_MODELS['slime'];
  if (mData) {
    const clone = SkeletonUtils.clone(mData.mesh);
    /** Boss is 3x bigger */
    clone.scale.setScalar(0.045);
    // Custom color for boss slime? The FBX texture is pre-baked, but we can try tinting if it's a standard material
    clone.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
        // Just clone the material so we don't tint regular slimes
        (m as THREE.Mesh).material = mat.clone();
        ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(0xdd2244);
      }
    });

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
  }

  mesh.position.set(x, y + 2.8, z);
  G.scene!.add(mesh);

  const entity: EnemyEntity = {
    mesh,
    hp: 60,
    maxHp: 60,
    dead: false,
    attackCooldown: 0,
    hurtTimer: 0,
    frozenTimer: 0,
    vel: new THREE.Vector3(),
    bobSeed: 0,
    home: mesh.position.clone(),
    type: { element: 'Pyro', color: 0xdd2244, name: 'King Slime', core: 0xff8899, emissive: 0x881122 },
    level: Math.max(8, G.lv + 3),
    appliedEl: 'Pyro',
    elTimer: 99,
    isBoss: true,
    archetype: 'slime',
    shieldHp: 0,
    maxShieldHp: 0,
    phaseTimer: 0,
    mixer,
    animActions,
    currentAnim: 'idle',
  };
  G.entities.slimes.push(entity);
  G.bossEntity = entity;
  G.bossActive = true;
  G.bossPhase = 1;
  SFX.bossRoar();
  buildArenaBarrier(mesh.position.clone());
  return entity;
}

export function updateBoss(dt: number): void {
  if (!G.bossActive || !G.bossEntity || G.bossEntity.dead) return;
  const b = G.bossEntity;
  if (b.mixer) b.mixer.update(dt);

  /* Update arena barrier shader */
  if (arenaBarrier) {
    (arenaBarrier.material as THREE.ShaderMaterial).uniforms.uTime.value = G.worldTime;
    /* Keep player inside arena */
    if (G.player) {
      const dx = G.player.position.x - arenaBarrier.position.x;
      const dz = G.player.position.z - arenaBarrier.position.z;
      const dh = Math.sqrt(dx * dx + dz * dz);
      if (dh > ARENA_RADIUS - 1) {
        const nx = dx / dh;
        const nz = dz / dh;
        G.player.position.x = arenaBarrier.position.x + nx * (ARENA_RADIUS - 1);
        G.player.position.z = arenaBarrier.position.z + nz * (ARENA_RADIUS - 1);
      }
    }
  }

  if (b.dead) {
    playBossAnim(b, 'death');
    return;
  }

  b.attackCooldown = Math.max(0, b.attackCooldown - dt);
  b.hurtTimer = Math.max(0, b.hurtTimer - dt);

  const atkCd = G.bossPhase === 3 ? 1 : G.bossPhase === 2 ? 1.5 : 2;
  const prevPos = b.mesh.position.clone();

  if (b.frozenTimer > 0) {
    b.frozenTimer -= dt;
    // can skip frozen visuals for boss or omit
    return;
  }

  const hpPct = b.hp / b.maxHp;
  if (hpPct <= 0.6 && G.bossPhase === 1) {
    G.bossPhase = 2;
    SFX.bossRoar();
    showReaction('PHASE 2', '#ff4444');
    trigPhaseTransition();
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const ex = b.mesh.position.x + Math.cos(a) * 8;
      const ez = b.mesh.position.z + Math.sin(a) * 8;
      createEnemy(ex, wH(ex, ez), ez, 'slime', 0);
    }
  }
  if (hpPct <= 0.3 && G.bossPhase === 2) {
    G.bossPhase = 3;
    SFX.bossRoar();
    showReaction('PHASE 3', '#ff0000');
    trigPhaseTransition();
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const ex = b.mesh.position.x + Math.cos(a) * 10;
      const ez = b.mesh.position.z + Math.sin(a) * 10;
      createEnemy(ex, wH(ex, ez), ez, 'wisp');
    }
  }

  const fl = new THREE.Vector3(
    G.player!.position.x - b.mesh.position.x,
    0,
    G.player!.position.z - b.mesh.position.z,
  );
  const fd = fl.length();
  if (fd > 0.001) fl.normalize();

  const gnd = wH(b.mesh.position.x, b.mesh.position.z);
  const spd = G.bossPhase === 3 ? 6 : 4.5;
  if (fd > 3) {
    b.mesh.position.x += fl.x * spd * dt;
    b.mesh.position.z += fl.z * spd * dt;
    b.mesh.rotation.y = Math.atan2(fl.x, fl.z);
  }
  
  if (fd < 25) {
    G.combatTimer = 10;
  }

  b.mesh.position.addScaledVector(b.vel, dt);
  b.vel.y -= 28 * dt;
  b.vel.x = lerp(b.vel.x, 0, dt * 2);
  b.vel.z = lerp(b.vel.z, 0, dt * 2);
  if (b.mesh.position.y <= gnd) {
    b.mesh.position.y = gnd;
    b.vel.y = Math.max(0, b.vel.y);
  }

  const moved = b.mesh.position.distanceToSquared(prevPos) > 0.001;
  if (b.hurtTimer > 0) playBossAnim(b, 'hit');
  else if (b.attackCooldown > atkCd - 0.8) playBossAnim(b, 'attack');
  else if (moved || b.vel.lengthSq() > 1) playBossAnim(b, 'walk');
  else playBossAnim(b, 'idle');

  b.phaseTimer = (b.phaseTimer || 0) + dt;

  // Slam
  if (b.attackCooldown <= 0 && fd < 5) {
    b.attackCooldown = atkCd;
    showBossWarn('SLAM!');
    setTimeout(() => {
      if (b.dead) return;
      b.vel.x = fl.x * 15;
      b.vel.z = fl.z * 15;
      b.vel.y = 12;
      SFX.bossRoar();
      setTimeout(() => {
        if (b.dead) return;
        if (distXZ(b.mesh.position, G.player!.position) < 4.5 && G.invulnTimer <= 0)
          takeDamage(G.bossPhase === 3 ? 35 : 25, b.mesh.position);
        trigShake(0.6, 0.25);
        spawnRing(b.mesh.position.clone(), '#ff4444', 5);
        if (G.bossPhase >= 3 && distXZ(b.mesh.position, G.player!.position) < 8 && G.invulnTimer <= 0)
          takeDamage(15, b.mesh.position);
      }, 500);
    }, 600);
  }

  // Fire breath
  if (G.bossPhase >= 2 && b.phaseTimer > 3 && fd < 15 && fd > 4) {
    b.phaseTimer = 0;
    showBossWarn('FIRE BREATH!');
    setTimeout(() => {
      if (b.dead) return;
      const dir = G.player!.position.clone().sub(b.mesh.position).setY(0).normalize();
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          if (b.dead) return;
          const sp = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.6);
          const proj = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xff4422 }),
          );
          proj.position.copy(b.mesh.position).add(new THREE.Vector3(0, 2, 0));
          G.scene!.add(proj);
          G.projectiles.push({ mesh: proj, vel: sp.multiplyScalar(14), life: 2, dmg: 18 });
        }, i * 80);
      }
      SFX.bossRoar();
    }, 800);
  }

  // Spinning attack (phase 2+): boss spins hitting all nearby
  if (G.bossPhase >= 2 && b.attackCooldown <= 0 && fd >= 5 && fd < 8) {
    b.attackCooldown = atkCd + 0.5;
    showBossWarn('SPIN!');
    SFX.bossRoar();
    let spinT = 0;
    const spinDur = 1.2;
    const spinDmg = G.bossPhase === 3 ? 22 : 16;
    let spinHit = false;
    const spinTick = () => {
      if (b.dead) return;
      spinT += 0.016;
      b.mesh.rotation.y += 0.4;
      /* Expanding ring visual */
      if (spinT < spinDur) {
        requestAnimationFrame(spinTick);
        if (!spinHit && distXZ(b.mesh.position, G.player!.position) < 6 && G.invulnTimer <= 0) {
          spinHit = true;
          takeDamage(spinDmg, b.mesh.position);
          trigShake(0.4, 0.15);
        }
      } else {
        spawnRing(b.mesh.position.clone(), '#ff8822', 7);
      }
    };
    requestAnimationFrame(spinTick);
  }

  // Meteor rain (phase 3): rains fire from sky
  if (G.bossPhase >= 3 && b.phaseTimer > 5) {
    b.phaseTimer = 0;
    showBossWarn('METEOR RAIN!');
    SFX.bossRoar();
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        if (b.dead) return;
        /* Target near player with some randomness */
        const tx = G.player!.position.x + (Math.random() - 0.5) * 14;
        const tz = G.player!.position.z + (Math.random() - 0.5) * 14;
        const tGnd = wH(tx, tz);
        const impactPos = new THREE.Vector3(tx, tGnd + 0.2, tz);
        /* Warning circle */
        const warnGeo = new THREE.RingGeometry(2.5, 3, 24);
        const warnMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
        const warn = new THREE.Mesh(warnGeo, warnMat);
        warn.rotation.x = -Math.PI / 2;
        warn.position.copy(impactPos);
        G.scene!.add(warn);
        /* Falling meteor */
        const meteor = new THREE.Mesh(
          new THREE.SphereGeometry(0.6, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xff4400 }),
        );
        meteor.position.set(tx, tGnd + 25, tz);
        G.scene!.add(meteor);
        let mt = 0;
        const mTick = () => {
          mt += 0.016;
          meteor.position.y = tGnd + 25 - mt * 30;
          if (meteor.position.y > tGnd + 0.5) {
            requestAnimationFrame(mTick);
          } else {
            /* Impact */
            G.scene!.remove(meteor);
            G.scene!.remove(warn);
            if (distXZ(impactPos, G.player!.position) < 3.5 && G.invulnTimer <= 0) {
              takeDamage(20, impactPos);
            }
            trigShake(0.3, 0.12);
            spawnRing(impactPos, '#ff4400', 3.5);
          }
        };
        requestAnimationFrame(mTick);
      }, i * 400);
    }
  }

  // Hurt flash
  b.mesh.traverse((m) => {
    if ((m as THREE.Mesh).isMesh) {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        if (b.hurtTimer > 0) {
          mat.emissive.set(0xffffff);
          mat.emissiveIntensity = b.hurtTimer * 4;
        } else if (mat.emissiveIntensity > 0) {
          mat.emissive.setHex(0xdd2244); // Wait, boss slime base emissive was 0xdd2244 or something... wait!
          mat.emissiveIntensity = 0;
        }
      }
    }
  });
}

function trigShake(i: number, d: number): void {
  G.screenShake = i;
  G.shakeDecay = d;
}

export function showBossWarn(text: string): void {
  const ex = document.querySelector('.bossWarning');
  if (ex) ex.remove();
  const el = document.createElement('div');
  el.className = 'bossWarning';
  el.textContent = text;
  ui.uiRoot.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/* ─── Phase transition cinematic ─── */
function trigPhaseTransition(): void {
  /* Brief hitstop to freeze the action */
  G.hitstop = 0.6;
  trigShake(0.8, 0.3);

  /* Letterbox bars */
  const topBar = document.createElement('div');
  const botBar = document.createElement('div');
  topBar.className = 'phaseLetterbox phaseLetterboxTop';
  botBar.className = 'phaseLetterbox phaseLetterboxBot';
  document.body.appendChild(topBar);
  document.body.appendChild(botBar);
  requestAnimationFrame(() => {
    topBar.style.height = '8vh';
    botBar.style.height = '8vh';
  });

  /* Camera zoom toward boss */
  const origFov = G.cam!.fov;
  G.cam!.fov = origFov - 15;
  G.cam!.updateProjectionMatrix();

  /* Flash overlay */
  const flash = document.createElement('div');
  flash.className = 'phaseFlash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 500);

  /* Restore after duration */
  setTimeout(() => {
    G.cam!.fov = origFov;
    G.cam!.updateProjectionMatrix();
    topBar.style.height = '0';
    botBar.style.height = '0';
    setTimeout(() => { topBar.remove(); botBar.remove(); }, 400);
  }, 1200);
}

/* ═══════════════════════════════════════════════════════════
   ELECTRO HYPOSTASIS — Field Boss
   ═══════════════════════════════════════════════════════════ */
let hypostasis: EnemyEntity | null = null;
let hypoBarrier: THREE.Mesh | null = null;
const HYPO_ARENA = 22;

export function spawnHypostasis(x: number, z: number): void {
  hypoSpawnX = x;
  hypoSpawnZ = z;
  const y = wH(x, z);
  const mesh = new THREE.Group();

  /* Core: glowing cube */
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xcc88ff, emissive: 0x9944ff, emissiveIntensity: 1.5, flatShading: true,
  });
  const core = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), coreMat);
  core.name = 'hypoCore';
  core.position.y = 3;
  mesh.add(core);

  /* Orbiting cubes (shell) */
  for (let i = 0; i < 8; i++) {
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x6633cc, emissive: 0x4411aa, emissiveIntensity: 0.8, flatShading: true,
      }),
    );
    cube.name = 'hypoCube' + i;
    cube.position.y = 3;
    mesh.add(cube);
  }

  /* Point light */
  const light = mkPointLight(0xcc88ff, 2, 18);
  light.position.y = 3;
  mesh.add(light);

  mesh.position.set(x, y, z);
  G.scene!.add(mesh);

  const entity: EnemyEntity = {
    mesh, hp: 80, maxHp: 80, dead: false, attackCooldown: 2,
    hurtTimer: 0, frozenTimer: 0, vel: new THREE.Vector3(), bobSeed: 0,
    home: mesh.position.clone(),
    type: { element: 'Electro', color: 0xcc88ff, name: 'Electro Hypostasis', core: 0x9944ff, emissive: 0x6622cc },
    level: Math.max(10, G.lv + 4), appliedEl: 'Electro', elTimer: 99,
    isBoss: true, archetype: 'slime', shieldHp: 0, maxShieldHp: 0, phaseTimer: 0,
    mixer: undefined, animActions: undefined, currentAnim: 'idle',
    isElite: false,
  };
  G.entities.slimes.push(entity);
  hypostasis = entity;
}

let hypoPhase = 0;
let hypoShieldUp = true;
let hypoVulnTimer = 0;
let hypoAttack = '';
let hypoRespawnTimer = 0;
const HYPO_RESPAWN_TIME = 60; /* seconds until respawn */
let hypoSpawnX = 65;
let hypoSpawnZ = 55;

export function updateHypostasis(dt: number): void {
  if (!hypostasis || hypostasis.dead) return;
  const h = hypostasis;
  const fd = distXZ(h.mesh.position, G.player!.position);

  /* Activate arena when player approaches */
  if (fd < 25 && !hypoBarrier) {
    SFX.bossRoar();
    showBossWarn('ELECTRO HYPOSTASIS');

    /* Boss bar */
    ui.bossBar.style.display = 'flex';
    ui.bossName.textContent = 'Electro Hypostasis';
    (ui as any).bossPhaseLabel && ((ui as any).bossPhaseLabel.textContent = '');

    const bgeo = new THREE.SphereGeometry(HYPO_ARENA, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const bmat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vPos; void main(){ vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uTime; varying vec3 vPos; void main(){
        float h=vPos.y/${HYPO_ARENA.toFixed(1)};
        float pulse=abs(sin(vPos.x*3.0+vPos.z*3.0+uTime*2.0))*0.3;
        float alpha=(0.06+pulse*0.06)*(1.0-h*0.6);
        gl_FragColor=vec4(0.6,0.3,1.0,alpha);
      }`,
    });
    hypoBarrier = new THREE.Mesh(bgeo, bmat);
    hypoBarrier.position.copy(h.mesh.position);
    G.scene!.add(hypoBarrier);
  }

  if (!hypoBarrier) return; /* Not yet active */

  /* Arena barrier */
  (hypoBarrier.material as THREE.ShaderMaterial).uniforms.uTime.value = G.worldTime;
  if (G.player) {
    const dx = G.player.position.x - hypoBarrier.position.x;
    const dz = G.player.position.z - hypoBarrier.position.z;
    const dh = Math.sqrt(dx * dx + dz * dz);
    if (dh > HYPO_ARENA - 1) {
      G.player.position.x = hypoBarrier.position.x + (dx / dh) * (HYPO_ARENA - 1);
      G.player.position.z = hypoBarrier.position.z + (dz / dh) * (HYPO_ARENA - 1);
    }
  }

  /* Update boss bar */
  const hpPct = Math.max(0, h.hp / h.maxHp);
  ui.bossHpFill.style.width = (hpPct * 100) + '%';
  G.combatTimer = 10;

  h.attackCooldown = Math.max(0, h.attackCooldown - dt);
  h.hurtTimer = Math.max(0, h.hurtTimer - dt);
  h.phaseTimer = (h.phaseTimer || 0) + dt;

  /* Core animation: bobbing and rotation */
  const core = h.mesh.getObjectByName('hypoCore') as THREE.Mesh;
  if (core) {
    core.position.y = 3 + Math.sin(G.worldTime * 2) * 0.5;
    core.rotation.x += dt * 1.5;
    core.rotation.y += dt * 2;
  }

  /* Orbiting cubes */
  for (let i = 0; i < 8; i++) {
    const cube = h.mesh.getObjectByName('hypoCube' + i) as THREE.Mesh;
    if (!cube) continue;
    const ang = (i / 8) * Math.PI * 2 + G.worldTime * 1.5;
    const orbitR = hypoShieldUp ? 2.5 : 4.5;
    cube.position.set(Math.cos(ang) * orbitR, 3 + Math.sin(ang * 2 + G.worldTime) * 0.8, Math.sin(ang) * orbitR);
    cube.rotation.x = G.worldTime * 2 + i;
    cube.rotation.z = G.worldTime * 1.5 + i;
    cube.visible = hypoShieldUp;
  }

  /* Phase transitions */
  if (hpPct <= 0.6 && hypoPhase === 0) { hypoPhase = 1; trigPhaseTransition(); }
  if (hpPct <= 0.3 && hypoPhase === 1) { hypoPhase = 2; trigPhaseTransition(); }

  /* Shield logic: boss is invulnerable while shell cubes orbit */
  if (hypoShieldUp) {
    /* Block all damage while shield is up */
    if (h.hurtTimer > 0) {
      h.hp = Math.min(h.maxHp, h.hp + 1); /* undo damage */
      spawnParts(h.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), '#cc88ff', 5, 4);
    }
    /* After doing an attack, become vulnerable briefly */
    if (hypoVulnTimer > 0) {
      hypoVulnTimer -= dt;
      if (hypoVulnTimer <= 0) hypoShieldUp = false;
    }
  } else {
    /* Vulnerable window: 5 seconds */
    hypoVulnTimer += dt;
    if (hypoVulnTimer > 5) {
      hypoShieldUp = true;
      hypoVulnTimer = 0;
    }
  }

  /* Attacks */
  if (hypoShieldUp && h.attackCooldown <= 0) {
    const choices = hypoPhase >= 2 ? 3 : hypoPhase >= 1 ? 2 : 1;
    const pick = Math.floor(Math.random() * choices);

    if (pick === 0) {
      /* Laser pillars: columns of electricity in a line toward player */
      h.attackCooldown = 3.5;
      hypoAttack = 'lasers';
      showBossWarn('LASER BARRAGE!');
      const dir = G.player!.position.clone().sub(h.mesh.position).setY(0).normalize();
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          if (h.dead) return;
          const pos = h.mesh.position.clone().add(dir.clone().multiplyScalar(4 + i * 3));
          pos.y = wH(pos.x, pos.z);
          /* Warning circle */
          const warnGeo = new THREE.RingGeometry(1.5, 2, 20);
          const warnMat = new THREE.MeshBasicMaterial({ color: 0xcc88ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
          const warn = new THREE.Mesh(warnGeo, warnMat);
          warn.rotation.x = -Math.PI / 2;
          warn.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0));
          G.scene!.add(warn);
          setTimeout(() => {
            G.scene!.remove(warn);
            /* Lightning pillar */
            const pillar = new THREE.Mesh(
              new THREE.CylinderGeometry(0.3, 0.3, 12, 6),
              new THREE.MeshBasicMaterial({ color: 0xcc88ff, transparent: true, opacity: 0.7 }),
            );
            pillar.position.copy(pos).add(new THREE.Vector3(0, 6, 0));
            G.scene!.add(pillar);
            if (distXZ(pos, G.player!.position) < 2.5 && G.invulnTimer <= 0) {
              takeDamage(18, pos);
            }
            spawnRing(pos, '#cc88ff', 2.5);
            setTimeout(() => G.scene!.remove(pillar), 400);
          }, 600);
        }, i * 200);
      }
      /* Become vulnerable after attack finishes */
      hypoVulnTimer = 2.5;
    } else if (pick === 1) {
      /* Cube missiles: fires cubes at player */
      h.attackCooldown = 3;
      hypoAttack = 'missiles';
      showBossWarn('CUBE MISSILES!');
      SFX.bossRoar();
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          if (h.dead) return;
          const dir2 = G.player!.position.clone().sub(h.mesh.position).setY(0).normalize();
          const proj = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.5),
            new THREE.MeshBasicMaterial({ color: 0x9944ff }),
          );
          proj.position.copy(h.mesh.position).add(new THREE.Vector3(0, 3, 0));
          G.scene!.add(proj);
          G.projectiles.push({ mesh: proj, vel: dir2.multiplyScalar(16), life: 2.5, dmg: 15 });
        }, i * 250);
      }
      hypoVulnTimer = 2;
    } else {
      /* Clap attack: telegraphed AoE around boss */
      h.attackCooldown = 4;
      hypoAttack = 'clap';
      showBossWarn('CONVERGENCE!');
      SFX.bossRoar();
      /* Warning ring */
      const warnGeo = new THREE.RingGeometry(5, 6, 32);
      const warnMat = new THREE.MeshBasicMaterial({ color: 0x9944ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
      const warn = new THREE.Mesh(warnGeo, warnMat);
      warn.rotation.x = -Math.PI / 2;
      warn.position.copy(h.mesh.position).add(new THREE.Vector3(0, 0.15, 0));
      G.scene!.add(warn);
      setTimeout(() => {
        G.scene!.remove(warn);
        if (h.dead) return;
        if (distXZ(h.mesh.position, G.player!.position) < 6 && G.invulnTimer <= 0) {
          takeDamage(25, h.mesh.position);
        }
        spawnRing(h.mesh.position.clone(), '#9944ff', 6);
        trigShake(0.5, 0.2);
      }, 1200);
      hypoVulnTimer = 2.5;
    }
  }

  /* Death: remove barrier */
  if (h.hp <= 0 && !h.dead) {
    h.dead = true;
    showBossWarn('DEFEATED!');
    SFX.bossRoar();
    spawnParts(h.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), '#cc88ff', 50, 25);
    spawnRing(h.mesh.position.clone(), '#cc88ff', 8);
    trigShake(1, 0.4);
    /* Remove barrier */
    if (hypoBarrier) {
      G.scene!.remove(hypoBarrier);
      (hypoBarrier.material as THREE.ShaderMaterial).dispose();
      hypoBarrier.geometry.dispose();
      hypoBarrier = null;
    }
    /* Hide mesh after delay */
    setTimeout(() => { h.mesh.visible = false; }, 1500);
    /* Award XP/Mora */
    G.xp += 80;
    G.mora += 120;
    /* Drop a random Stella Fortuna */
    addStellaFortuna(Math.floor(Math.random() * 4));
    ui.bossBar.style.display = 'none';
    /* Start respawn timer */
    hypoRespawnTimer = HYPO_RESPAWN_TIME;
  }

  /* Respawn timer (ticks when dead) */
  if (h.dead && hypoRespawnTimer > 0) {
    hypoRespawnTimer -= dt;
    if (hypoRespawnTimer <= 0) {
      /* Remove old entity from slimes array */
      const idx = G.entities.slimes.indexOf(h);
      if (idx >= 0) G.entities.slimes.splice(idx, 1);
      if (h.mesh.parent) G.scene!.remove(h.mesh);
      hypostasis = null;
      hypoPhase = 0;
      hypoShieldUp = true;
      hypoVulnTimer = 0;
      /* Respawn */
      spawnHypostasis(hypoSpawnX, hypoSpawnZ);
    }
  }

  /* Hurt flash */
  if (!hypoShieldUp) {
    h.mesh.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          if (h.hurtTimer > 0) {
            mat.emissive.set(0xffffff);
            mat.emissiveIntensity = h.hurtTimer * 4;
          } else {
            mat.emissive.setHex(0x6622cc);
            mat.emissiveIntensity = mat.userData?.baseEmissive ?? 0.8;
          }
        }
      }
    });
  }
}

import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { mkMesh, wH, distXZ, lerp, rwp } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { ui } from '../ui/UIRefs';
import { takeDamage } from '../combat/DamageSystem';
import { showReaction } from '../combat/Reactions';
import { spawnRing } from '../systems/Particles';
import { createEnemy } from './Enemy';
import type { EnemyEntity } from '../types';

export function createBoss(x: number, y: number, z: number): EnemyEntity {
  const mesh = new THREE.Group();
  mesh.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 18, 14),
      new THREE.MeshStandardMaterial({ color: 0xdd2244, flatShading: true }),
    ),
  );
  mesh.add(
    mkMesh(
      new THREE.SphereGeometry(1, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0xff8899,
        emissive: 0x881122,
        emissiveIntensity: 1.5,
        flatShading: true,
      }),
      0,
      0.4,
      0,
    ),
  );
  mesh.add(
    mkMesh(
      new THREE.ConeGeometry(0.7, 1.2, 5),
      new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0x886600,
        flatShading: true,
      }),
      0,
      2.6,
      0,
    ),
  );
  for (const s of [-0.8, 0.8]) {
    mesh.add(
      mkMesh(
        new THREE.SphereGeometry(0.25, 8, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffff00,
          emissive: 0xffaa00,
          emissiveIntensity: 2,
        }),
        s,
        1.2,
        2.2,
      ),
    );
  }
  mesh.position.set(x, y + 2.8, z);
  mesh.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
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
  };
  G.entities.slimes.push(entity);
  G.bossEntity = entity;
  G.bossActive = true;
  G.bossPhase = 1;
  SFX.bossRoar();
  return entity;
}

export function updateBoss(dt: number): void {
  if (!G.bossActive || !G.bossEntity || G.bossEntity.dead) return;
  const b = G.bossEntity;
  b.attackCooldown = Math.max(0, b.attackCooldown - dt);
  b.hurtTimer = Math.max(0, b.hurtTimer - dt);
  if (b.frozenTimer > 0) {
    b.frozenTimer -= dt;
    return;
  }

  const hpPct = b.hp / b.maxHp;
  if (hpPct <= 0.6 && G.bossPhase === 1) {
    G.bossPhase = 2;
    SFX.bossRoar();
    showReaction('PHASE 2', '#ff4444');
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

  const gnd = wH(b.mesh.position.x, b.mesh.position.z) + 2.8;
  const spd = G.bossPhase === 3 ? 6 : 4.5;
  if (fd > 3) {
    b.mesh.position.x += fl.x * spd * dt;
    b.mesh.position.z += fl.z * spd * dt;
    b.mesh.rotation.y = Math.atan2(fl.x, fl.z);
  }
  b.mesh.position.y += Math.abs(Math.sin(G.worldTime * 3)) * 0.05;
  b.mesh.position.addScaledVector(b.vel, dt);
  b.vel.y -= 28 * dt;
  b.vel.x = lerp(b.vel.x, 0, dt * 2);
  b.vel.z = lerp(b.vel.z, 0, dt * 2);
  if (b.mesh.position.y <= gnd) {
    b.mesh.position.y = gnd;
    b.vel.y = Math.max(0, b.vel.y);
  }

  b.phaseTimer = (b.phaseTimer || 0) + dt;
  const atkCd = G.bossPhase === 3 ? 1 : G.bossPhase === 2 ? 1.5 : 2;

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

  // Hurt flash
  if (b.hurtTimer > 0 && b.mesh.children[0] && (b.mesh.children[0] as THREE.Mesh).material) {
    ((b.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.set(0xffffff);
    ((b.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity =
      b.hurtTimer * 4;
  } else if (b.mesh.children[0] && (b.mesh.children[0] as THREE.Mesh).material) {
    ((b.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.set(0x000000);
    ((b.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
  }
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

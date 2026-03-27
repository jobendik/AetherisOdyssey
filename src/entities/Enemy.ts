import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { mkMesh, wH, rwp, distXZ, lerp } from '../core/Helpers';
import { SLIME_TYPES, ENEMY_TYPES } from '../data/EnemyData';
import type { EnemyEntity, EnemyArchetype } from '../types';
import { SFX } from '../audio/Audio';
import { takeDamage } from '../combat/DamageSystem';
import { shootArrow } from '../combat/Projectiles';

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

  if (archetype === 'slime') {
    mesh.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 14, 12),
        new THREE.MeshStandardMaterial({ color: st.color, flatShading: true }),
      ),
    );
    mesh.add(
      mkMesh(
        new THREE.SphereGeometry(0.42, 10, 10),
        new THREE.MeshStandardMaterial({
          color: st.core,
          emissive: st.emissive,
          flatShading: true,
        }),
        0,
        0.2,
        0,
      ),
    );
  } else if (archetype === 'archer') {
    const bm = new THREE.MeshStandardMaterial({ color: 0x665544, flatShading: true });
    mesh.add(mkMesh(new THREE.BoxGeometry(0.6, 1.6, 0.4), bm, 0, 1, 0));
    mesh.add(
      mkMesh(
        new THREE.SphereGeometry(0.3, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xffddb8, flatShading: true }),
        0,
        2.1,
        0,
      ),
    );
    mesh.add(
      mkMesh(
        new THREE.BoxGeometry(0.08, 1.2, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x442200, flatShading: true }),
        0.4,
        1.2,
        0.2,
      ),
    );
    mesh.add(
      mkMesh(
        new THREE.ConeGeometry(0.35, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: st.color, flatShading: true }),
        0,
        2.5,
        0,
      ),
    );
  } else if (archetype === 'shield') {
    const bm = new THREE.MeshStandardMaterial({ color: 0x556677, flatShading: true });
    mesh.add(mkMesh(new THREE.BoxGeometry(1, 1.8, 0.8), bm, 0, 1.1, 0));
    mesh.add(
      mkMesh(
        new THREE.SphereGeometry(0.35, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xffddb8, flatShading: true }),
        0,
        2.3,
        0,
      ),
    );
    const shieldMesh = mkMesh(
      new THREE.BoxGeometry(1.4, 1.6, 0.15),
      new THREE.MeshStandardMaterial({
        color: st.color,
        flatShading: true,
        emissive: st.emissive,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 1,
      }),
      0,
      1.2,
      0.5,
    );
    mesh.add(shieldMesh);
  } else if (archetype === 'wisp') {
    mesh.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 12, 12),
        new THREE.MeshStandardMaterial({
          color: st.color,
          emissive: st.emissive,
          emissiveIntensity: 1.2,
          flatShading: true,
          transparent: true,
          opacity: 0.85,
        }),
      ),
    );
    const wl = new THREE.PointLight(st.color, 0.5, 8);
    mesh.add(wl);
  }

  const yOff = archetype === 'wisp' ? 3 : archetype === 'slime' ? 1.15 : 0;
  mesh.position.set(x, y + yOff, z);
  mesh.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
  });
  G.scene!.add(mesh);

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
  };
  G.entities.slimes.push(entity);
  return entity;
}

export function populateEnemies(count: number, arch: EnemyArchetype): void {
  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(24, 110, -0.4);
    createEnemy(x, y, z, arch);
  }
}

export function updateEnemies(dt: number): void {
  for (const s of G.entities.slimes) {
    if (s.dead || s.isBoss) continue;
    s.attackCooldown = Math.max(0, s.attackCooldown - dt);
    s.hurtTimer = Math.max(0, s.hurtTimer - dt);

    // Frozen
    if (s.frozenTimer > 0) {
      s.frozenTimer -= dt;
      const mat = s.mesh.children[0] && (s.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.set(0x4488ff);
        mat.emissiveIntensity = 0.5;
      }
      continue;
    } else {
      const mat = s.mesh.children[0] && (s.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
      }
    }

    if (s.elTimer > 0) s.elTimer -= dt;
    if (s.elTimer <= 0) s.appliedEl = s.type.element;

    const et = ENEMY_TYPES[s.archetype];
    const gnd =
      wH(s.mesh.position.x, s.mesh.position.z) +
      (s.archetype === 'wisp' ? 3 : s.archetype === 'slime' ? 1.15 : 0);

    const tp = G.player!.position.clone().sub(s.mesh.position);
    const d = tp.length();
    const fl = new THREE.Vector3(tp.x, 0, tp.z);
    const fd = fl.length();
    if (fd > 0.001) fl.normalize();

    if (s.archetype === 'slime') {
      if (d < et.aggro && fd > 1.6) {
        s.mesh.position.x += fl.x * et.spd * dt;
        s.mesh.position.z += fl.z * et.spd * dt;
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
      }
      s.mesh.position.y += Math.abs(Math.sin(G.worldTime * 5.8 + s.bobSeed)) * 0.03;
      if (fd < et.atkRange && s.attackCooldown <= 0) {
        s.attackCooldown = et.atkCd;
        s.vel.x = fl.x * 12;
        s.vel.z = fl.z * 12;
        s.vel.y = 8.5;
        SFX.jump();
      }
      if (fd < 1.8 && s.vel.lengthSq() > 18 && G.invulnTimer <= 0)
        takeDamage(et.dmg, s.mesh.position);
    } else if (s.archetype === 'archer') {
      if (d < et.aggro) {
        if (fd < 10) {
          s.mesh.position.x -= fl.x * et.spd * dt;
          s.mesh.position.z -= fl.z * et.spd * dt;
        } else if (fd > 16) {
          s.mesh.position.x += fl.x * et.spd * dt;
          s.mesh.position.z += fl.z * et.spd * dt;
        }
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
        if (s.attackCooldown <= 0 && fd < et.atkRange) {
          s.attackCooldown = et.atkCd;
          shootArrow(s);
        }
      }
    } else if (s.archetype === 'shield') {
      if (d < et.aggro && fd > 1.8) {
        s.mesh.position.x += fl.x * et.spd * dt;
        s.mesh.position.z += fl.z * et.spd * dt;
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
      }
      if (fd < et.atkRange && s.attackCooldown <= 0) {
        s.attackCooldown = et.atkCd;
        s.vel.x = fl.x * 10;
        s.vel.z = fl.z * 10;
        s.vel.y = 5;
        SFX.jump();
      }
      if (fd < 2.2 && s.vel.lengthSq() > 12 && G.invulnTimer <= 0)
        takeDamage(et.dmg, s.mesh.position);
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
          s.mesh.position.x += (dx2 / dl) * et.spd * dt;
          s.mesh.position.z += (dz2 / dl) * et.spd * dt;
        }
        s.mesh.position.y = gnd + Math.sin(G.worldTime * 2 + s.bobSeed) * 0.8;
        s.mesh.rotation.y = Math.atan2(fl.x, fl.z);
        if (s.attackCooldown <= 0 && fd < et.atkRange) {
          s.attackCooldown = et.atkCd;
          shootArrow(s);
        }
      }
    }

    s.mesh.position.addScaledVector(s.vel, dt);
    s.vel.y -= 28 * dt;
    s.vel.x = lerp(s.vel.x, 0, dt * 3.4);
    s.vel.z = lerp(s.vel.z, 0, dt * 3.4);
    if (s.archetype !== 'wisp' && s.mesh.position.y <= gnd) {
      s.mesh.position.y = gnd;
      s.vel.y = Math.max(0, s.vel.y);
    }

    // Hurt flash
    if (s.hurtTimer > 0) {
      const mat = s.mesh.children[0] && (s.mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.set(0xffffff);
        mat.emissiveIntensity = s.hurtTimer * 4;
      }
    }
  }
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import type { EnemyEntity } from '../types';
import { SFX } from '../audio/Audio';
import { ENEMY_TYPES } from '../data/EnemyData';
import { takeDamage, dmgEnemy } from './DamageSystem';
import { isNight } from '../entities/Enemy';
import { addCombo } from './Combo';
import { tryReaction } from './Reactions';
import { mem } from '../core/GameState';
import { distXZ } from '../core/Helpers';

export function shootArrow(e: EnemyEntity): void {
  SFX.arrow();
  const dir = G.player!.position.clone().sub(e.mesh.position).normalize();
  const proj = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 6, 6),
    new THREE.MeshBasicMaterial({ color: e.type.color }),
  );
  proj.position.copy(e.mesh.position).add(new THREE.Vector3(0, 1.5, 0));
  G.scene!.add(proj);
  const et = ENEMY_TYPES[e.archetype];
  const nightX = isNight() ? 1.4 : 1;
  G.projectiles.push({ mesh: proj, vel: dir.multiplyScalar(18), life: 3, dmg: et.dmg * (e.isElite ? 1.5 : 1) * nightX });
}

export function updateProjectiles(dt: number): void {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    p.life -= dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    if (p.life <= 0) {
      G.scene!.remove(p.mesh);
      G.projectiles.splice(i, 1);
      continue;
    }
    if (G.player!.position.distanceTo(p.mesh.position) < 1.5 && G.invulnTimer <= 0) {
      takeDamage(p.dmg, p.mesh.position);
      G.scene!.remove(p.mesh);
      G.projectiles.splice(i, 1);
    }
  }

  /* Player projectiles */
  for (let i = playerProjectiles.length - 1; i >= 0; i--) {
    const pp = playerProjectiles[i];
    pp.life -= dt;
    pp.mesh.position.addScaledVector(pp.vel, dt);
    if (pp.life <= 0) {
      G.scene!.remove(pp.mesh);
      playerProjectiles.splice(i, 1);
      continue;
    }
    for (const s of G.entities.slimes) {
      if (s.dead) continue;
      if (distXZ(s.mesh.position, pp.mesh.position) < (s.isBoss ? 3 : 1.8)) {
        const m = mem();
        const rxn = tryReaction(m.element, s);
        let d = pp.dmg;
        if (rxn) d *= rxn.m;
        dmgEnemy(s, d, s.isBoss ? 3 : 12, s.isBoss ? 1 : 4, pp.color);
        addCombo();
        G.scene!.remove(pp.mesh);
        playerProjectiles.splice(i, 1);
        break;
      }
    }
  }
}

/* ──── Player-fired projectiles (bow, catalyst) ──── */
interface PlayerProj {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
  color: string;
}
const playerProjectiles: PlayerProj[] = [];

export function fireProjectile(origin: THREE.Vector3, vel: THREE.Vector3, dmg: number, color: string): void {
  SFX.arrow();
  const proj = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 6, 6),
    new THREE.MeshBasicMaterial({ color }),
  );
  proj.position.copy(origin);
  G.scene!.add(proj);
  playerProjectiles.push({ mesh: proj, vel: vel.clone(), life: 2.5, dmg, color });
}

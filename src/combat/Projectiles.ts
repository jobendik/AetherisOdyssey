import * as THREE from 'three';
import { G } from '../core/GameState';
import type { EnemyEntity } from '../types';
import { SFX } from '../audio/Audio';
import { ENEMY_TYPES } from '../data/EnemyData';
import { takeDamage } from './DamageSystem';
import { isNight } from '../entities/Enemy';

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
}

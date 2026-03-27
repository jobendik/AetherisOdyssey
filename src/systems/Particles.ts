import * as THREE from 'three';
import { G } from '../core/GameState';
import { lerp } from '../core/Helpers';

export function spawnParts(
  pos: THREE.Vector3,
  color: string,
  count = 10,
  spread = 12,
): void {
  const pc = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshBasicMaterial({ color: pc }),
    );
    m.position.copy(pos);
    G.scene!.add(m);
    G.entities.particles.push({
      mesh: m,
      life: 0.8 + Math.random() * 0.4,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        Math.random() * spread,
        (Math.random() - 0.5) * spread,
      ),
    });
  }
}

export function spawnRing(
  pos: THREE.Vector3,
  color: string,
  radius: number,
): void {
  const r = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.55, radius, 32),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    }),
  );
  r.rotation.x = -Math.PI / 2;
  r.position.copy(pos);
  G.scene!.add(r);
  G.entities.particles.push({
    mesh: r,
    life: 0.45,
    vel: new THREE.Vector3(),
    ring: true,
    ss: 0.3,
    es: 1.4,
  });
}

export function updateParticles(dt: number): void {
  for (let i = G.entities.particles.length - 1; i >= 0; i--) {
    const p = G.entities.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      G.scene!.remove(p.mesh);
      G.entities.particles.splice(i, 1);
      continue;
    }
    if (p.ring) {
      const pr = 1 - p.life / 0.45;
      p.mesh.scale.setScalar(lerp(p.ss!, p.es!, pr));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - pr);
    } else {
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 18 * dt;
      p.mesh.scale.setScalar(Math.max(0.1, p.life));
    }
  }
}

export function updateWindParts(dt: number): void {
  for (const p of G.entities.windParticles) {
    p.position.y += p.userData.speed * dt;
    p.position.x =
      p.userData.baseX + Math.sin(G.worldTime * 4 + p.position.y * 0.35) * p.userData.sway;
    p.position.z =
      p.userData.baseZ + Math.cos(G.worldTime * 4 + p.position.y * 0.35) * p.userData.sway;
    if (p.position.y > p.userData.top) p.position.y = p.userData.baseY;
    p.lookAt(G.cam!.position);
  }
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import { rwp, wH, clamp } from '../core/Helpers';
import { ui } from '../ui/UIRefs';
import { spawnParts } from '../systems/Particles';
import { SFX } from '../audio/Audio';
import { gainXp } from '../systems/Progression';

export function createUpdraft(x: number, z: number, top: number): void {
  const by = wH(x, z);
  G.entities.updrafts.push({ x, z, radius: 5.2, top });
  const pm = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 1.5), pm);
    p.position.set(
      x + (Math.random() - 0.5) * 7,
      by + Math.random() * (top - by),
      z + (Math.random() - 0.5) * 7,
    );
    p.userData = {
      baseX: p.position.x,
      baseZ: p.position.z,
      baseY: by,
      top,
      speed: 9 + Math.random() * 10,
      sway: Math.random() * 1.5 + 0.3,
    };
    G.scene!.add(p);
    G.entities.windParticles.push(p);
  }
}

export function populateCollectibles(count: number): void {
  let p = 0, t = 0;
  while (p < count && t < 2000) {
    t++;
    const pt = rwp(30, 108, -0.2);
    const el = 2 + Math.random() * 8;
    const cr = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({
        color: 0x8ff8ff,
        emissive: 0x1c8a94,
        emissiveIntensity: 1.1,
        flatShading: true,
      }),
    );
    cr.position.set(pt.x, pt.y + el, pt.z);
    cr.add(new THREE.PointLight(0x85f9ff, 0.8, 12));
    G.scene!.add(cr);
    G.entities.collectibles.push({ mesh: cr, startY: pt.y + el, collected: false });
    if (el > 4.5) createUpdraft(pt.x, pt.z, pt.y + el + 2.5);
    p++;
  }
}

export function updateCollectibles(dt: number): void {
  if (G.questPhase < 1) return;

  for (const c of G.entities.collectibles) {
    if (c.collected) continue;
    c.mesh.rotation.y += dt * 1.1;
    c.mesh.position.y = c.startY + Math.sin(G.worldTime * 2 + c.mesh.position.x * 0.2) * 0.42;
    if (G.player!.position.distanceTo(c.mesh.position) < 2.8) {
      c.collected = true;
      c.mesh.visible = false;
      spawnParts(c.mesh.position.clone(), '#8cfaff', 22, 18);
      SFX.collect();
      G.burstEnergy = clamp(G.burstEnergy + 18, 0, 100);
      gainXp(20);
      const rem = G.entities.collectibles.filter((cc) => !cc.collected).length;
      if (rem > 0) {
        ui.objectiveText.textContent = 'Gather ' + rem + ' crystal' + (rem === 1 ? '' : 's');
        ui.objectiveSubtext.textContent = 'Follow minimap.';
      } else {
        G.questPhase = 2;
        ui.objectiveText.textContent = 'Return to Guide';
        ui.objectiveSubtext.textContent = 'Report back.';
      }
    }
  }
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import { rwp, wH, clamp, mkPointLight } from '../core/Helpers';
import { ui } from '../ui/UIRefs';
import { spawnParts } from '../systems/Particles';
import { SFX } from '../audio/Audio';
import { gainXp } from '../systems/Progression';
import { spawnDmg } from '../ui/DamageNumbers';

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
    cr.add(mkPointLight(0x85f9ff, 0.8, 12));
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
    const dx = G.player!.position.x - c.mesh.position.x;
    const dy = G.player!.position.y - c.mesh.position.y;
    const dz = G.player!.position.z - c.mesh.position.z;
    if (dx * dx + dy * dy + dz * dz < 2.8 * 2.8) {
      c.collected = true;
      c.mesh.visible = false;
      spawnParts(c.mesh.position.clone(), '#8cfaff', 22, 18);
      SFX.collect();
      G.burstEnergy = clamp(G.burstEnergy + 18, 0, 100);
      gainXp(20);
      /* Count remaining without filtering the whole array */
      let rem = 0;
      for (const cc of G.entities.collectibles) if (!cc.collected) rem++;
      if (rem > 0) {
        ui.objectiveText.textContent = 'Gather ' + rem + ' crystal' + (rem === 1 ? '' : 's');
        ui.objectiveSubtext.textContent = 'Follow minimap.';
      } else {
        G.questPhase = 2;
        ui.objectiveText.textContent = 'Return to Guide';
        ui.objectiveSubtext.textContent = 'Report back.';
        SFX.questComplete();
      }
    }
  }
}

/* ─── Aerial Collectibles: floating orbs high up requiring glider ─── */
interface AerialOrb {
  mesh: THREE.Mesh;
  collected: boolean;
  startY: number;
}
const aerialOrbs: AerialOrb[] = [];

export function populateAerialOrbs(count: number): void {
  for (let i = 0; i < count; i++) {
    const pt = rwp(25, 100, 0);
    const height = pt.y + 14 + Math.random() * 12;  /* well above ground */
    /* Golden orb with glow */
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffaa00,
        emissiveIntensity: 1.5,
        flatShading: true,
      }),
    );
    /* Outer ring */
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1, 0.06, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.5 }),
    );
    orb.add(ring);
    orb.add(mkPointLight(0xffdd55, 1.2, 15));
    orb.position.set(pt.x, height, pt.z);
    G.scene!.add(orb);
    aerialOrbs.push({ mesh: orb, collected: false, startY: height });
    /* Add updraft nearby so gliding is possible */
    createUpdraft(pt.x + (Math.random() - 0.5) * 6, pt.z + (Math.random() - 0.5) * 6, height + 3);
  }
}

export function updateAerialOrbs(dt: number): void {
  for (const o of aerialOrbs) {
    if (o.collected) continue;
    o.mesh.rotation.y += dt * 1.4;
    o.mesh.rotation.x += dt * 0.5;
    o.mesh.position.y = o.startY + Math.sin(G.worldTime * 1.8 + o.mesh.position.x * 0.3) * 0.6;
    /* Ring expand/contract */
    const ring = o.mesh.children[0] as THREE.Mesh;
    if (ring) ring.rotation.z += dt * 2;
    const dx = G.player!.position.x - o.mesh.position.x;
    const dy = G.player!.position.y - o.mesh.position.y;
    const dz = G.player!.position.z - o.mesh.position.z;
    if (dx * dx + dy * dy + dz * dz < 9) {
      o.collected = true;
      o.mesh.visible = false;
      spawnParts(o.mesh.position.clone(), '#ffdd44', 28, 22);
      SFX.collect();
      gainXp(40);
      G.mora += 50;
      G.burstEnergy = clamp(G.burstEnergy + 25, 0, 100);
      spawnDmg(o.mesh.position.clone(), 50, '#ffd700', false, '+50 Mora');
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   ORE MINING NODES
   ═══════════════════════════════════════════════════════════ */
interface OreNode {
  mesh: THREE.Group;
  hp: number;
  mined: boolean;
  pos: THREE.Vector3;
}
const oreNodes: OreNode[] = [];

export function populateOreNodes(count: number): void {
  for (let i = 0; i < count; i++) {
    const pt = rwp(20, 100, 0);
    const y = wH(pt.x, pt.z);
    const group = new THREE.Group();

    /* Crystal shards */
    const colors = [0x55ccff, 0x77ddff, 0x44aadd];
    for (let s = 0; s < 4; s++) {
      const h = 0.8 + Math.random() * 1.2;
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.25 + Math.random() * 0.2, h, 5),
        new THREE.MeshStandardMaterial({
          color: colors[s % 3],
          emissive: 0x2288aa,
          emissiveIntensity: 0.6,
          flatShading: true,
        }),
      );
      shard.position.set(
        (Math.random() - 0.5) * 0.8,
        h / 2,
        (Math.random() - 0.5) * 0.8,
      );
      shard.rotation.set(
        (Math.random() - 0.5) * 0.3,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.3,
      );
      group.add(shard);
    }

    /* Base rock */
    const base = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({ color: 0x555566, flatShading: true }),
    );
    base.position.y = 0.2;
    group.add(base);

    group.add(mkPointLight(0x55ccff, 0.5, 8));
    group.position.set(pt.x, y, pt.z);
    G.scene!.add(group);
    oreNodes.push({ mesh: group, hp: 3, mined: false, pos: group.position.clone() });
  }
}

export function hitOreNearby(pos: THREE.Vector3, radius: number): void {
  for (const ore of oreNodes) {
    if (ore.mined) continue;
    const d = pos.distanceTo(ore.pos);
    if (d < radius + 1.2) {
      ore.hp--;
      spawnParts(ore.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#55ccff', 8, 6);
      SFX.hit();
      /* Shake crystals */
      ore.mesh.children.forEach((c, i) => {
        const orig = c.position.clone();
        c.position.x += (Math.random() - 0.5) * 0.15;
        c.position.z += (Math.random() - 0.5) * 0.15;
        setTimeout(() => { c.position.copy(orig); }, 100);
      });
      if (ore.hp <= 0) {
        ore.mined = true;
        ore.mesh.visible = false;
        spawnParts(ore.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), '#77ddff', 20, 12);
        SFX.collect();
        G.mora += 30;
        G.oreMaterials = (G.oreMaterials || 0) + 1;
        spawnDmg(ore.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 30, '#55ccff', false, '+1 Ore');
      }
    }
  }
}

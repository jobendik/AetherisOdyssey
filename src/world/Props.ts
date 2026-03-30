import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkCelMat, rwp, wH } from '../core/Helpers';
import { spawnParts } from '../systems/Particles';
import { spawnDmg } from '../ui/DamageNumbers';
import { SFX } from '../audio/Audio';

export interface DestructibleProp {
  mesh: THREE.Group;
  hp: number;
  broken: boolean;
  type: 'crate' | 'barrel' | 'pot';
}

const PROP_REWARDS: Record<string, { mora: [number, number]; hpChance: number }> = {
  crate:  { mora: [5, 15], hpChance: 0.2 },
  barrel: { mora: [8, 20], hpChance: 0.3 },
  pot:    { mora: [3, 10], hpChance: 0.15 },
};

function buildCrate(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = mkCelMat(0x8b6914, 0x7a5812, 0);
  const bandMat = mkCelMat(0x555555, 0x444444, 0);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), bodyMat));
  /* Horizontal bands */
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), bandMat));
  (g.children[1] as THREE.Mesh).position.y = 0.25;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), bandMat));
  (g.children[2] as THREE.Mesh).position.y = -0.25;
  return g;
}

function buildBarrel(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = mkCelMat(0x7a5c3a, 0x694b2e, 0);
  const bandMat = mkCelMat(0x666666, 0x555555, 0);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.42, 1.1, 10), bodyMat));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 10), bandMat));
  (g.children[1] as THREE.Mesh).position.y = 0.3;
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.06, 10), bandMat));
  (g.children[2] as THREE.Mesh).position.y = -0.3;
  return g;
}

function buildPot(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = mkCelMat(0xb07040, 0x9a6030, 0);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.7), bodyMat));
  /* Rim */
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.12, 8), bodyMat));
  (g.children[1] as THREE.Mesh).position.y = 0.32;
  return g;
}

const BUILDERS = { crate: buildCrate, barrel: buildBarrel, pot: buildPot };

export function populateProps(count: number): void {
  const types: Array<'crate' | 'barrel' | 'pot'> = ['crate', 'barrel', 'pot'];
  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(12, 100, 0);
    const type = types[i % types.length];
    const mesh = BUILDERS[type]();
    mesh.position.set(x, y + (type === 'barrel' ? 0.55 : type === 'pot' ? 0.3 : 0.45), z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    G.scene!.add(mesh);
    G.entities.props.push({ mesh, hp: 1, broken: false, type });
  }
}

export function breakProp(prop: DestructibleProp): void {
  if (prop.broken) return;
  prop.broken = true;

  const pos = prop.mesh.position.clone();
  const colors: Record<string, string> = {
    crate: '#8b6914',
    barrel: '#7a5c3a',
    pot: '#b07040',
  };
  /* Break particles — wood/clay fragments */
  spawnParts(pos.clone().add(new THREE.Vector3(0, 0.5, 0)), colors[prop.type], 12, 10);
  SFX.hit();

  /* Hide mesh */
  prop.mesh.visible = false;

  /* Drop rewards */
  const rw = PROP_REWARDS[prop.type];
  const moraAmt = rw.mora[0] + Math.floor(Math.random() * (rw.mora[1] - rw.mora[0]));
  G.mora += moraAmt;
  spawnDmg(pos.clone().add(new THREE.Vector3(0, 1.2, 0)), moraAmt, '#ffdd44', false, '+' + moraAmt + ' Mora');

  if (Math.random() < rw.hpChance) {
    G.health = Math.min(G.maxHealth, G.health + 5);
    setTimeout(() => {
      spawnDmg(pos.clone().add(new THREE.Vector3(0, 1.8, 0)), 5, '#78ff84', false, '+5 HP');
    }, 300);
  }
}

export function updateProps(): void {
  if (!G.player || G.atkTimer <= 0) return;
  const px = G.player.position.x, py = G.player.position.y, pz = G.player.position.z;
  for (const prop of G.entities.props) {
    if (prop.broken) continue;
    const dx = px - prop.mesh.position.x;
    const dy = py - prop.mesh.position.y;
    const dz = pz - prop.mesh.position.z;
    if (dx * dx + dy * dy + dz * dz < 6.25) breakProp(prop);
  }
}

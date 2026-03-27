import * as THREE from 'three';
import { G } from './GameState';

/* ──────── Utility functions ──────── */

export const clamp = (v: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, v));

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const distXZ = (a: THREE.Vector3, b: THREE.Vector3): number => {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
};

export const normAng = (a: number): number => {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  return v;
};

export const rnd = (a: number, b: number): number =>
  a + Math.random() * (b - a);

/* ──────── Mesh factory helpers ──────── */

export function mkMesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x?: number,
  y?: number,
  z?: number,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  return m;
}

export function mkLight(
  color: number,
  intensity: number,
  dist: number,
  x: number,
  y: number,
  z: number,
): THREE.PointLight {
  const l = new THREE.PointLight(color, intensity, dist);
  l.position.set(x, y, z);
  return l;
}

/* ──────── World coordinate helpers ──────── */

/** Terrain height at world (x, z) */
export function wH(x: number, z: number): number {
  const W = 140;
  const d = Math.sqrt(x * x + z * z);
  if (d > W) return -10;
  const f = Math.min(1, d / 18);
  const h =
    Math.sin(x * 0.03) * 8 +
    Math.cos(z * 0.03) * 8 +
    Math.sin(x * 0.08 + z * 0.05) * 4 +
    Math.cos(x * 0.14 - z * 0.11) * 2;
  return h * f * Math.max(0, 1 - (d - 100) / 40);
}

/** Random world position at valid terrain height */
export function rwp(
  minD = 24,
  maxD = 112,
  minH = -0.6,
): { x: number; y: number; z: number } {
  for (let i = 0; i < 800; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = minD + Math.random() * (maxD - minD);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = wH(x, z);
    if (y >= minH) return { x, y, z };
  }
  return { x: 28, y: wH(28, 0), z: 0 };
}

/** World position to screen coordinates */
export function w2s(pos: THREE.Vector3): { x: number; y: number; behind: boolean } {
  const v = pos.clone().project(G.cam!);
  return {
    x: (v.x * 0.5 + 0.5) * innerWidth,
    y: (-v.y * 0.5 + 0.5) * innerHeight,
    behind: v.z > 1,
  };
}

/** Get current objective target position */
export function objTarget(): THREE.Vector3 {
  if (G.questPhase === 0 || G.questPhase >= 2) {
    return G.npc ? G.npc.position : new THREE.Vector3();
  }
  let b: THREE.Vector3 | null = null;
  let bd = Infinity;
  for (const c of G.entities.collectibles) {
    if (c.collected) continue;
    const d = G.player!.position.distanceTo(c.mesh.position);
    if (d < bd) {
      bd = d;
      b = c.mesh.position;
    }
  }
  return b || (G.npc ? G.npc.position : new THREE.Vector3());
}



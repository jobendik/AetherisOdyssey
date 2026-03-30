import * as THREE from 'three';
import { G } from '../core/GameState';
import { wH, mkMesh, mkCelMat, mkCelEmissiveMat } from '../core/Helpers';
import { createUpdraft } from './Collectibles';

/* ═══════════════════════════════════════
   Elevated launch points & wind columns
   ═══════════════════════════════════════ */

interface LaunchPoint {
  mesh: THREE.Group;
  pos: THREE.Vector3;
}

const launchPoints: LaunchPoint[] = [];

/* [x, z, height, updraftTop] */
const LAUNCH_DATA: [number, number, number, number][] = [
  [0, -50, 14, 35],    // South cliff — tall pillar with strong updraft
  [60, 20, 10, 28],    // East overlook
  [-30, 70, 12, 32],   // Behind shrine — high vantage
  [70, -60, 8, 24],    // Southeast outpost
  [-65, -20, 11, 30],  // West ruins plateau
];

/* Standalone wind columns (no platform, just updraft) */
const WIND_COLUMN_DATA: [number, number, number][] = [
  [20, 30, 28],     // Open field near center
  [-20, -60, 25],   // South ravine
  [50, 50, 30],     // East mountain base
];

export function buildLaunchPoints(): void {
  const stoneM = mkCelMat(0x9e9488, 0x8e8478, 0.15);
  const darkM = mkCelMat(0x6e6458, 0x5e5448, 0.1);
  const glowM = mkCelEmissiveMat(0x66ccff, 0x44aaff, 1.2);

  for (const [lx, lz, height, updraftTop] of LAUNCH_DATA) {
    const ly = wH(lx, lz);
    const group = new THREE.Group();
    group.position.set(lx, ly, lz);

    /* Stone pillar base — tapers upward */
    const base = mkMesh(
      new THREE.CylinderGeometry(2.5, 3.5, height, 8),
      stoneM, 0, height / 2, 0,
    );
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    /* Platform on top */
    const platform = mkMesh(
      new THREE.CylinderGeometry(3, 2.8, 0.5, 8),
      darkM, 0, height + 0.25, 0,
    );
    platform.castShadow = true;
    platform.receiveShadow = true;
    group.add(platform);

    /* Decorative trim ring */
    const trim = mkMesh(
      new THREE.TorusGeometry(2.9, 0.12, 6, 16),
      glowM, 0, height + 0.5, 0,
    );
    trim.rotation.x = Math.PI / 2;
    group.add(trim);

    /* Corner pillars on platform */
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const cx = Math.cos(a) * 2.3;
      const cz = Math.sin(a) * 2.3;
      const post = mkMesh(
        new THREE.BoxGeometry(0.4, 1.8, 0.4),
        darkM, cx, height + 1.15, cz,
      );
      post.castShadow = true;
      group.add(post);

      /* Glowing crystal on top of each post */
      const crystal = mkMesh(
        new THREE.OctahedronGeometry(0.2, 0),
        glowM, cx, height + 2.2, cz,
      );
      group.add(crystal);
    }

    /* Wind swirl indicator at top */
    const swirlMat = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
    });
    const swirl = new THREE.Mesh(
      new THREE.ConeGeometry(2, height * 0.6, 8, 1, true),
      swirlMat,
    );
    swirl.position.set(0, height + height * 0.3 + 2, 0);
    group.add(swirl);

    G.scene!.add(group);
    launchPoints.push({ mesh: group, pos: new THREE.Vector3(lx, ly, lz) });

    /* Create updraft above the platform */
    createUpdraft(lx, lz, ly + updraftTop);
  }

  /* Standalone wind columns */
  for (const [wx, wz, top] of WIND_COLUMN_DATA) {
    const wy = wH(wx, wz);

    /* Visual column */
    const colMat = new THREE.MeshBasicMaterial({
      color: 0xaaeeff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const colMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4, top - wy, 8, 1, true),
      colMat,
    );
    colMesh.position.set(wx, wy + (top - wy) / 2, wz);
    G.scene!.add(colMesh);

    /* Updraft effect */
    createUpdraft(wx, wz, wy + top);
  }
}

export function updateLaunchPoints(dt: number): void {
  /* Animate decorative elements */
  for (const lp of launchPoints) {
    lp.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material;
        /* Rotate swirl cone */
        if (mat instanceof THREE.MeshBasicMaterial && mat.transparent && mat.opacity < 0.3) {
          child.rotation.y += dt * 0.5;
        }
      }
    });
  }
}

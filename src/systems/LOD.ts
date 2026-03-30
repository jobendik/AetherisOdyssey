import * as THREE from 'three';
import { G } from '../core/GameState';

/* ═══════════════════════════════════════════════════════════
   LOD — Distance-based visibility culling + Frustum culling
   Hides objects beyond a distance threshold AND objects
   outside the camera frustum to improve performance.
   ═══════════════════════════════════════════════════════════ */

const LOD_FAR = 90;       /* objects beyond this are hidden */
const LOD_NEAR = 80;      /* objects closer than this are shown (hysteresis band) */
const UPDATE_INTERVAL = 5; /* frames between LOD checks */
const FRUSTUM_MARGIN = 1.15; /* slightly wider frustum to avoid popping at edges */

let frame = 0;
const managed: { obj: THREE.Object3D; wasVisible: boolean }[] = [];
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

export function registerLOD(obj: THREE.Object3D): void {
  managed.push({ obj, wasVisible: true });
}

export function updateLOD(): void {
  frame++;
  if (frame % UPDATE_INTERVAL !== 0) return;
  if (!G.player || !G.cam) return;

  const px = G.player.position.x;
  const pz = G.player.position.z;

  /* Update frustum from camera */
  G.cam.updateMatrixWorld();
  projScreenMatrix.multiplyMatrices(G.cam.projectionMatrix, G.cam.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreenMatrix);

  for (const entry of managed) {
    const ox = entry.obj.position.x;
    const oz = entry.obj.position.z;
    const dx = ox - px;
    const dz = oz - pz;
    const distSq = dx * dx + dz * dz;

    if (distSq > LOD_FAR * LOD_FAR) {
      /* Too far — always hide */
      if (entry.obj.visible) {
        entry.wasVisible = true;
        entry.obj.visible = false;
      }
    } else if (distSq < LOD_NEAR * LOD_NEAR) {
      /* Within LOD range — check frustum */
      const inFrustum = frustum.containsPoint(entry.obj.position);
      if (distSq < 20 * 20) {
        /* Very close objects always show (prevents popping near player) */
        if (!entry.obj.visible && entry.wasVisible) {
          entry.obj.visible = true;
        }
      } else if (inFrustum) {
        if (!entry.obj.visible && entry.wasVisible) {
          entry.obj.visible = true;
        }
      } else {
        /* Off-screen — hide */
        if (entry.obj.visible) {
          entry.wasVisible = true;
          entry.obj.visible = false;
        }
      }
    }
  }
}

import * as THREE from 'three';
import { G } from './GameState';
import { lerp } from './Helpers';
import { wH } from './Helpers';
import { resizePostProcessing } from './Scene';

/* ── Camera configuration ── */
const CAM_IDEAL_DIST = 8.5;       // desired distance behind player
const CAM_MIN_DIST = 1.8;         // closest the camera will zoom in
const CAM_PIVOT_HEIGHT = 2.8;     // look-at height above player origin
const CAM_CLIP_OFFSET = 0.35;     // offset from hit surface to avoid z-fighting
const CAM_LERP_SPEED = 14;        // general position smoothing
const CAM_ZOOM_IN_SPEED = 18;     // fast pull-in when occluded
const CAM_ZOOM_OUT_SPEED = 4;     // gentle push-out when clear
const CAM_TERRAIN_PAD = 0.65;     // minimum height above terrain
const SPHERE_CAST_RADIUS = 0.3;   // radius for the spherecast-style multi-ray

/* ── Per-frame state ── */
let currentDist = CAM_IDEAL_DIST;

/* Reusable objects (avoid per-frame allocations) */
const _raycaster = new THREE.Raycaster();
const _pivotWorld = new THREE.Vector3();
const _dirToCamera = new THREE.Vector3();
const _desiredPos = new THREE.Vector3();
const _offsets = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, SPHERE_CAST_RADIUS, 0),
  new THREE.Vector3(0, -SPHERE_CAST_RADIUS, 0),
  new THREE.Vector3(SPHERE_CAST_RADIUS, 0, 0),
  new THREE.Vector3(-SPHERE_CAST_RADIUS, 0, 0),
];

/**
 * Collect scene meshes that can occlude the camera.
 * Excludes the player, enemies, NPCs, particles, UI helpers, etc.
 */
function getOccluders(): THREE.Object3D[] {
  const list: THREE.Object3D[] = [];
  if (!G.scene) return list;

  // Build a set of roots to ignore (player, enemies, NPC)
  const ignore = new Set<THREE.Object3D>();
  if (G.player) ignore.add(G.player);
  if (G.npc) ignore.add(G.npc);
  for (const e of G.entities.slimes) ignore.add(e.mesh);

  G.scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    // Skip anything parented under an ignored root
    let p: THREE.Object3D | null = obj;
    while (p) {
      if (ignore.has(p)) return;
      p = p.parent;
    }
    // Skip transparent / invisible meshes
    const mat = (obj as THREE.Mesh).material as THREE.Material;
    if (mat && (mat.transparent && (mat as any).opacity < 0.4)) return;
    list.push(obj);
  });
  return list;
}

/**
 * Raycast from pivot (player look-at point) toward desired camera position.
 * Returns the safe distance (shortened if something blocks the view).
 */
function occlusionDistance(pivot: THREE.Vector3, dir: THREE.Vector3, maxDist: number): number {
  const occluders = getOccluders();
  if (occluders.length === 0) return maxDist;

  let safeDist = maxDist;

  for (const offset of _offsets) {
    const origin = pivot.clone().add(offset);
    _raycaster.set(origin, dir);
    _raycaster.far = maxDist;
    _raycaster.near = 0;
    const hits = _raycaster.intersectObjects(occluders, false);
    if (hits.length > 0) {
      const hitDist = hits[0].distance - CAM_CLIP_OFFSET;
      if (hitDist < safeDist) safeDist = hitDist;
    }
  }

  return Math.max(CAM_MIN_DIST, safeDist);
}

export function updateCamera(dt: number): void {
  if (!G.cam || !G.player) return;

  /* ── FOV spring ── */
  const tf = G.isSprinting ? 80 : G.isDashing ? 85 : G.baseFov;
  G.cam.fov = lerp(G.cam.fov, tf, dt * 8);
  G.cam.updateProjectionMatrix();

  /* ── Clear dead lock-on targets ── */
  if (G.lockOnTarget && (G.lockOnTarget.dead || G.lockOnTarget.mesh.position.distanceTo(G.player.position) > 35)) {
    G.lockOnTarget = null;
  }

  /* ── Lock-on: auto-rotate yaw to face target ── */
  if (G.lockOnTarget) {
    const dx = G.lockOnTarget.mesh.position.x - G.player.position.x;
    const dz = G.lockOnTarget.mesh.position.z - G.player.position.z;
    const targetYaw = Math.atan2(dx, dz);
    /* Smooth yaw towards target */
    let diff = targetYaw - G.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.camYaw += diff * dt * 6;
  }

  /* ── Compute pivot (look-at point above player) ── */
  _pivotWorld.set(
    G.player.position.x,
    G.player.position.y + CAM_PIVOT_HEIGHT,
    G.player.position.z,
  );

  /* ── Desired camera direction from pivot ── */
  const rxz = Math.cos(G.camPitch);
  _dirToCamera.set(
    rxz * Math.sin(G.camYaw),
    Math.sin(G.camPitch),
    rxz * Math.cos(G.camYaw),
  ).normalize();

  /* ── Occlusion check: shorten distance if something blocks the view ── */
  const safeDist = occlusionDistance(_pivotWorld, _dirToCamera, CAM_IDEAL_DIST);

  // Smooth the distance — snap in fast, ease out slowly
  const lerpSpeed = safeDist < currentDist ? CAM_ZOOM_IN_SPEED : CAM_ZOOM_OUT_SPEED;
  currentDist = lerp(currentDist, safeDist, dt * lerpSpeed);

  /* ── Compute desired camera world position ── */
  _desiredPos.copy(_dirToCamera).multiplyScalar(currentDist).add(_pivotWorld);

  /* ── Clamp above terrain ── */
  const terrainY = wH(_desiredPos.x, _desiredPos.z) + CAM_TERRAIN_PAD;
  if (_desiredPos.y < terrainY) _desiredPos.y = terrainY;

  /* ── Screen shake ── */
  if (G.screenShake > 0) {
    G.screenShake -= (dt / G.shakeDecay) * G.screenShake;
    if (G.screenShake < 0.01) G.screenShake = 0;
    _desiredPos.x += (Math.random() - 0.5) * G.screenShake;
    _desiredPos.y += (Math.random() - 0.5) * G.screenShake * 0.5;
    _desiredPos.z += (Math.random() - 0.5) * G.screenShake;
  }

  /* ── Smooth final position ── */
  G.cam.position.lerp(_desiredPos, dt * CAM_LERP_SPEED);

  /* ── Look at the pivot ── */
  G.cam.lookAt(_pivotWorld);
}

export function onResize(): void {
  G.cam!.aspect = innerWidth / innerHeight;
  G.cam!.updateProjectionMatrix();
  G.rend!.setSize(innerWidth, innerHeight);
  resizePostProcessing();
}

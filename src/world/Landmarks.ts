import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh, mkLight, mkPointLight, wH, rnd, mkCelMat, mkCelEmissiveMat, distXZ } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { spawnParts, spawnRing } from '../systems/Particles';

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function buildLandmarks(): Promise<void> {
  const stone = mkCelMat(0xb5aca5, 0xa59c95, 0.2);
  const dark = mkCelMat(0x7a726b, 0x6a625b, 0.15);
  const wood = mkCelMat(0x8b6b3d, 0x7a5c32, 0);
  const roofTile = mkCelMat(0x884422, 0x774018, 0);

  /* ── Bridge ── */
  const bx = 45, bz = -30, by = wH(bx, bz);
  /* Bridge deck with edge trim */
  for (let i = 0; i < 12; i++) {
    const seg = mkMesh(new THREE.BoxGeometry(3, 0.6, 6), stone, bx + i * 2.8 - 15, by + 3, bz);
    seg.castShadow = true;
    seg.receiveShadow = true;
    G.scene!.add(seg);
  }
  /* Side rails */
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const rail = mkMesh(new THREE.BoxGeometry(0.4, 1.5, 0.4), dark, bx + i * 2.8 - 15, by + 4, bz + side * 2.6);
      rail.castShadow = true;
      G.scene!.add(rail);
    }
    /* Top rail beam */
    const topRail = mkMesh(new THREE.BoxGeometry(33.6, 0.2, 0.5), dark, bx, by + 4.75, bz + side * 2.6);
    topRail.castShadow = true;
    G.scene!.add(topRail);
  }
  /* Arch supports */
  for (const i of [0, 5, 11]) {
    const sup = mkMesh(new THREE.BoxGeometry(1.5, 8, 1.5), dark, bx + i * 2.8 - 15, by - 1, bz);
    sup.castShadow = true;
    G.scene!.add(sup);
    /* Decorative brackets */
    for (const side of [-1, 1]) {
      const bracket = mkMesh(new THREE.BoxGeometry(0.3, 0.3, 2.0), stone, bx + i * 2.8 - 15, by + 2.8, bz + side * 1.5);
      G.scene!.add(bracket);
    }
  }
  await yieldToBrowser();

  /* ── Tower ── */
  const tx = -50, tz = 40, ty = wH(tx, tz);
  /* Base foundation */
  const towerBase = mkMesh(new THREE.CylinderGeometry(4.5, 5, 2, 8), stone, tx, ty + 1, tz);
  towerBase.receiveShadow = true;
  G.scene!.add(towerBase);
  /* Main tower body */
  const tower = mkMesh(new THREE.CylinderGeometry(3, 4, 18, 8), stone, tx, ty + 11, tz);
  tower.castShadow = true;
  G.scene!.add(tower);
  /* Roof */
  const top = mkMesh(new THREE.ConeGeometry(5, 5, 8), roofTile, tx, ty + 22.5, tz);
  top.castShadow = true;
  G.scene!.add(top);
  /* Decorative rings */
  for (let j = 0; j < 3; j++) {
    const ring = mkMesh(new THREE.CylinderGeometry(4.2, 4.2, 0.4, 12), dark, tx, ty + 5 + j * 5, tz);
    ring.castShadow = true;
    G.scene!.add(ring);
  }
  /* Window slits */
  for (let w = 0; w < 4; w++) {
    const wa = (w / 4) * Math.PI * 2;
    const windowMat = mkCelEmissiveMat(0xffdd88, 0xaa8844, 0.8);
    const win = mkMesh(
      new THREE.BoxGeometry(0.6, 1.8, 0.3), windowMat,
      tx + Math.cos(wa) * 3.5, ty + 14, tz + Math.sin(wa) * 3.5,
    );
    win.lookAt(tx, ty + 14, tz);
    G.scene!.add(win);
  }
  G.scene!.add(mkLight(0xffaa44, 0.6, 25, tx, ty + 22, tz));
  await yieldToBrowser();

  /* ── Shrine ── */
  const sx = 60, sz = 55, sy = wH(sx, sz);
  /* Multi-layer base */
  const shrineBase = mkMesh(
    new THREE.BoxGeometry(10, 0.4, 10), stone, sx, sy + 0.2, sz,
  );
  shrineBase.receiveShadow = true;
  G.scene!.add(shrineBase);
  const shrineTop = mkMesh(
    new THREE.BoxGeometry(8, 0.4, 8), dark, sx, sy + 0.6, sz,
  );
  shrineTop.receiveShadow = true;
  G.scene!.add(shrineTop);
  /* Pillars */
  for (let i = 0; i < 4; i++) {
    const ca = (i / 4) * Math.PI * 2;
    const px = sx + Math.cos(ca) * 3.2;
    const pz = sz + Math.sin(ca) * 3.2;
    /* Pillar base */
    G.scene!.add(mkMesh(new THREE.CylinderGeometry(0.7, 0.75, 0.4, 6), dark, px, sy + 1.0, pz));
    /* Pillar shaft */
    G.scene!.add(mkMesh(new THREE.CylinderGeometry(0.45, 0.55, 4.5, 6), stone, px, sy + 3.4, pz));
    /* Capital */
    G.scene!.add(mkMesh(new THREE.CylinderGeometry(0.7, 0.5, 0.4, 6), dark, px, sy + 5.85, pz));
  }
  /* Small roof */
  const shrineRoof = mkMesh(
    new THREE.ConeGeometry(5, 2.5, 4), roofTile, sx, sy + 7.35, sz,
  );
  shrineRoof.rotation.y = Math.PI / 4;
  shrineRoof.castShadow = true;
  G.scene!.add(shrineRoof);
  /* Glowing altar */
  G.scene!.add(
    mkMesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.1, 12),
      mkCelEmissiveMat(0x88ddff, 0x44aadd, 1.0),
      sx, sy + 0.85, sz,
    ),
  );
  G.scene!.add(mkLight(0x88ddff, 0.5, 15, sx, sy + 3, sz));
  await yieldToBrowser();

  /* ── Windmill ── */
  const wx = -30, wz = -60, wy = wH(wx, wz);
  /* Foundation */
  G.scene!.add(mkMesh(new THREE.CylinderGeometry(3.5, 4, 1.5, 6), stone, wx, wy + 0.75, wz));
  /* Main body */
  const wmBody = mkCelMat(0xe8ddd0, 0xd8cdc0, 0.1);
  G.scene!.add(mkMesh(new THREE.CylinderGeometry(2, 3, 12, 6), wmBody, wx, wy + 7.5, wz));
  /* Roof */
  G.scene!.add(mkMesh(new THREE.ConeGeometry(3.5, 3, 6), roofTile, wx, wy + 15, wz));
  /* Door */
  G.scene!.add(mkMesh(new THREE.BoxGeometry(1.2, 2.5, 0.3), wood, wx, wy + 2.75, wz + 3.1));
  /* Windmill blades */
  for (let i = 0; i < 4; i++) {
    const ba = i * Math.PI / 2;
    const blade = mkMesh(new THREE.BoxGeometry(0.3, 7, 0.1), wood, wx + Math.cos(ba) * 3.5, wy + 11.5, wz + 0.1);
    blade.rotation.z = ba;
    G.scene!.add(blade);
    /* Cloth on blades */
    const cloth = mkMesh(
      new THREE.PlaneGeometry(1.8, 5.5),
      mkCelMat(0xeee8dc, 0xddd5c8, 0),
      wx + Math.cos(ba) * 3.5 + 0.8, wy + 11.5, wz + 0.15,
    );
    cloth.rotation.z = ba;
    G.scene!.add(cloth);
  }
  await yieldToBrowser();

  /* ── Ruined Gate ── */
  const gx = 70, gz = -60, gy = wH(gx, gz);
  const ruinStone = mkCelMat(0x7a726b, 0x6a625b, 0.3); // more moss on ruins
  for (const side of [-1, 1]) {
    /* Pillar with taper */
    G.scene!.add(mkMesh(new THREE.BoxGeometry(2, 12, 2), ruinStone, gx + side * 5, gy + 6, gz));
    /* Pillar base */
    G.scene!.add(mkMesh(new THREE.BoxGeometry(2.8, 1.5, 2.8), dark, gx + side * 5, gy + 0.75, gz));
  }
  /* Lintel (cracked — offset slightly) */
  const lintel = mkMesh(new THREE.BoxGeometry(12, 2, 2), ruinStone, gx, gy + 12, gz);
  lintel.rotation.z = 0.04; // slightly askew — it's ruined!
  G.scene!.add(lintel);
  /* Rubble around the gate */
  for (let i = 0; i < 8; i++) {
    const rub = mkMesh(
      new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.8, 0),
      ruinStone,
      gx + rnd(-7, 7),
      gy + rnd(0, 0.4),
      gz + rnd(-4, 4),
    );
    rub.rotation.set(rnd(0, 3), rnd(0, 3), 0);
    rub.castShadow = true;
    G.scene!.add(rub);
  }
  /* Vine/moss accent on one pillar */
  const vine = mkMesh(
    new THREE.CylinderGeometry(0.08, 0.1, 8, 4),
    mkCelMat(0x3a6628, 0x2d5520, 0),
    gx - 5.8, gy + 5, gz,
  );
  vine.rotation.z = 0.15;
  G.scene!.add(vine);
  await yieldToBrowser();
}

/* ═══════════════════════════════════════════════════════════
   VIEWPOINTS — Scenic overlook platforms
   ═══════════════════════════════════════════════════════════ */
interface Viewpoint {
  pos: THREE.Vector3;
  activated: boolean;
  marker: THREE.Mesh;
}
const viewpoints: Viewpoint[] = [];
let viewCamActive = false;
let viewCamTimer = 0;
let viewCamOrigin: THREE.Vector3 | null = null;
let viewCamTarget: THREE.Vector3 | null = null;

const VP_LOCATIONS: [number, number][] = [
  [-50, 40],   /* near tower */
  [70, -60],   /* near ruined gate */
  [0, 80],     /* far field */
  [-70, -40],  /* west hills */
];

export function buildViewpoints(): void {
  const pillarMat = mkCelMat(0xb5aca5, 0xa59c95, 0.2);
  const glowMat = mkCelEmissiveMat(0xffdd44, 0xffaa22, 1.2);

  for (const [vx, vz] of VP_LOCATIONS) {
    const vy = wH(vx, vz);
    /* Stone platform */
    const platform = mkMesh(new THREE.CylinderGeometry(1.8, 2.2, 0.6, 8), pillarMat, vx, vy + 0.3, vz);
    platform.receiveShadow = true;
    G.scene!.add(platform);
    /* Glowing obelisk */
    const obelisk = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 2.5, 4),
      glowMat.clone(),
    );
    obelisk.position.set(vx, vy + 1.85, vz);
    obelisk.castShadow = true;
    G.scene!.add(obelisk);
    /* Light beacon */
    const light = mkPointLight(0xffdd44, 0.6, 12);
    light.position.set(vx, vy + 3, vz);
    G.scene!.add(light);

    viewpoints.push({
      pos: new THREE.Vector3(vx, vy, vz),
      activated: false,
      marker: obelisk,
    });
  }
}

export function nearViewpoint(): boolean {
  if (viewCamActive) return false;
  for (const vp of viewpoints) {
    if (vp.activated) continue;
    if (distXZ(G.player!.position, vp.pos) < 3) return true;
  }
  return false;
}

export function activateViewpoint(): void {
  for (const vp of viewpoints) {
    if (vp.activated) continue;
    if (distXZ(G.player!.position, vp.pos) < 3) {
      vp.activated = true;
      SFX.questComplete();
      spawnParts(vp.pos.clone().add(new THREE.Vector3(0, 2, 0)), '#ffdd44', 30, 15);
      spawnRing(vp.pos.clone(), '#ffdd44', 4);
      /* Dim the obelisk */
      const mat = vp.marker.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3;
      /* Start panoramic camera */
      viewCamActive = true;
      viewCamTimer = 0;
      viewCamOrigin = G.cam!.position.clone();
      viewCamTarget = vp.pos.clone().add(new THREE.Vector3(0, 20, 0));
      G.isActive = false;
      return;
    }
  }
}

export function updateViewpoints(dt: number): void {
  if (!viewCamActive || !viewCamOrigin || !viewCamTarget) return;
  viewCamTimer += dt;
  const dur = 4;
  const t = Math.min(viewCamTimer / dur, 1);
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  /* Sweep camera up and around */
  const angle = ease * Math.PI * 1.5;
  const radius = 30;
  const height = viewCamTarget.y + Math.sin(ease * Math.PI) * 10;
  G.cam!.position.set(
    viewCamTarget.x + Math.cos(angle) * radius,
    height,
    viewCamTarget.z + Math.sin(angle) * radius,
  );
  G.cam!.lookAt(viewCamTarget.x, viewCamTarget.y - 15, viewCamTarget.z);

  if (t >= 1) {
    viewCamActive = false;
    G.cam!.position.copy(viewCamOrigin);
    G.isActive = true;
    /* Award XP */
    G.xp += 30;
    G.mora += 40;
  }
}

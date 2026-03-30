import * as THREE from 'three';
import { G } from '../core/GameState';
import { wH, mkPointLight } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { spawnRing, spawnParts } from '../systems/Particles';
import { ui } from '../ui/UIRefs';

export interface Waypoint {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  unlocked: boolean;
  name: string;
  light: THREE.Sprite;
}

const WP_LOCS: { x: number; z: number; name: string }[] = [
  { x: 0, z: 0, name: 'Spawn' },
  { x: 45, z: -30, name: 'Bridge' },
  { x: -50, z: 40, name: 'Tower' },
  { x: 60, z: 55, name: 'Shrine' },
  { x: -35, z: -45, name: 'Ruins' },
];

const waypoints: Waypoint[] = [];

export function getWaypoints(): Waypoint[] {
  return waypoints;
}

export function buildWaypoints(): void {
  for (const loc of WP_LOCS) {
    const y = wH(loc.x, loc.z);
    const grp = new THREE.Group();
    grp.position.set(loc.x, y, loc.z);

    /* Pillar */
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.5, 6);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x8899aa,
      roughness: 0.5,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.y = 1.25;
    pillar.castShadow = true;
    grp.add(pillar);

    /* Crystal on top */
    const crystalGeo = new THREE.OctahedronGeometry(0.5, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x446688,
      emissive: 0x223344,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.8,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 2.8;
    grp.add(crystal);

    /* Glow light */
    const light = mkPointLight(0x446688, 0.3, 6);
    light.position.y = 3;
    grp.add(light);

    G.scene!.add(grp);

    const wp: Waypoint = {
      mesh: grp,
      pos: new THREE.Vector3(loc.x, y, loc.z),
      unlocked: loc.name === 'Spawn', // spawn always unlocked
      name: loc.name,
      light,
    };
    waypoints.push(wp);

    if (wp.unlocked) activateWP(wp);
  }
}

function activateWP(wp: Waypoint): void {
  wp.unlocked = true;
  /* Turn crystal bright cyan */
  wp.mesh.traverse((m) => {
    if ((m as THREE.Mesh).isMesh && (m as THREE.Mesh).geometry.type === 'OctahedronGeometry') {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.color.setHex(0x66ddff);
      mat.emissive.setHex(0x44aacc);
      mat.emissiveIntensity = 0.8;
    }
  });
  (wp.light.material as THREE.SpriteMaterial).color.setHex(0x66ddff);
  (wp.light.material as THREE.SpriteMaterial).opacity = 0.5;
}

export function updateWaypoints(dt: number): void {
  if (!G.player) return;
  for (const wp of waypoints) {
    /* Rotate crystal */
    const crystal = wp.mesh.children[1];
    if (crystal) crystal.rotation.y += dt * 1.5;

    /* Bob crystal */
    if (crystal) crystal.position.y = 2.8 + Math.sin(G.worldTime * 2 + wp.pos.x) * 0.15;

    const d = G.player.position.distanceTo(wp.pos);

    /* Auto-unlock when player gets close */
    if (!wp.unlocked && d < 4) {
      activateWP(wp);
      SFX.collect();
      spawnRing(wp.pos.clone().add(new THREE.Vector3(0, 2, 0)), '#66ddff', 4);
      spawnParts(wp.pos.clone().add(new THREE.Vector3(0, 2, 0)), '#66ddff', 20, 10);
      showWPNotif(`Waypoint Unlocked: ${wp.name}`);
    }
  }
}

/** Teleport player to a waypoint by index */
export function teleportTo(idx: number): void {
  const wp = waypoints[idx];
  if (!wp || !wp.unlocked || !G.player) return;

  /* Departure VFX */
  spawnParts(G.player.position.clone().add(new THREE.Vector3(0, 1, 0)), '#66ddff', 15, 8);

  /* Move player */
  const y = wH(wp.pos.x, wp.pos.z);
  G.player.position.set(wp.pos.x, y + 1, wp.pos.z);
  G.pVel.set(0, 0, 0);

  /* Arrival VFX */
  spawnRing(G.player.position.clone(), '#66ddff', 3);
  spawnParts(G.player.position.clone().add(new THREE.Vector3(0, 1, 0)), '#66ddff', 20, 10);
  SFX.collect();
}

function showWPNotif(text: string): void {
  const el = document.createElement('div');
  el.className = 'wpNotif';
  el.textContent = text;
  ui.uiRoot.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

/** Build the waypoint selection UI (M key) */
let wpOverlayEl: HTMLElement | null = null;

export function toggleWaypointUI(): void {
  if (wpOverlayEl) {
    closeWaypointUI();
    return;
  }

  openWaypointUI();
}

export function isWaypointUIOpen(): boolean {
  return wpOverlayEl !== null;
}

export function closeWaypointUI(): void {
  if (!wpOverlayEl) return;
  SFX.menuClose();
  wpOverlayEl.remove();
  wpOverlayEl = null;
  if (G.hasStarted && G.health > 0) {
    if (G.mobile) G.isActive = true;
    else document.body.requestPointerLock();
  }
}

function openWaypointUI(): void {
  SFX.menuOpen();
  G.isActive = false;
  if (!G.mobile && document.pointerLockElement) document.exitPointerLock();

  const overlay = document.createElement('div');
  overlay.id = 'waypointOverlay';
  overlay.innerHTML = `<div class="wpTitle">TELEPORT WAYPOINTS</div><button class="wpCloseBtn" type="button">✕ Close</button><div class="wpList"></div><div class="wpClose">Press Esc to close</div>`;
  const list = overlay.querySelector('.wpList')!;
  waypoints.forEach((wp, i) => {
    const btn = document.createElement('button');
    btn.className = 'wpBtn' + (wp.unlocked ? ' unlocked' : ' locked');
    btn.innerHTML = `<span class="wpIcon">${wp.unlocked ? '◈' : '◇'}</span><span class="wpName">${wp.name}</span>`;
    if (wp.unlocked) {
      btn.addEventListener('click', () => {
        teleportTo(i);
        toggleWaypointUI();
      });
    }
    list.appendChild(btn);
  });
  overlay.querySelector('.wpCloseBtn')!.addEventListener('click', closeWaypointUI);
  document.body.appendChild(overlay);
  wpOverlayEl = overlay;
}

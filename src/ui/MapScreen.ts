import { G } from '../core/GameState';
import { wH } from '../core/Helpers';
import { SFX } from '../audio/Audio';

/* ═══════════════════════════════════════════════════════════
   MAP SCREEN — Full-screen terrain overview
   Toggle with M key (repurposed from waypoint toggle).
   Shows landmarks, player position, waypoints, bosses.
   ═══════════════════════════════════════════════════════════ */

let panel: HTMLElement | null = null;
let canvas: HTMLCanvasElement | null = null;

/* Landmark labels with world positions */
const LANDMARKS: { name: string; x: number; z: number; icon: string }[] = [
  { name: 'Spawn',       x: 0,   z: 0,    icon: '🏠' },
  { name: 'Bridge',      x: 45,  z: -30,  icon: '🌉' },
  { name: 'Tower',       x: -50, z: 40,   icon: '🗼' },
  { name: 'Ruins',       x: 55,  z: 75,   icon: '🏚️' },
  { name: 'Hypostasis',  x: 65,  z: 55,   icon: '💜' },
  { name: 'NPC Guide',   x: 6,   z: -10,  icon: '💬' },
  { name: 'West Hills',  x: -70, z: -40,  icon: '⛰️' },
  { name: 'Far Field',   x: 0,   z: 80,   icon: '🌿' },
];

export function toggleMapScreen(): void {
  if (panel) { closeMap(); return; }
  openMap();
}

function openMap(): void {
  SFX.menuOpen();
  G.isActive = false;
  if (!G.mobile && document.pointerLockElement) document.exitPointerLock();
  panel = document.createElement('div');
  panel.id = 'mapOverlay';
  panel.innerHTML = `
    <div class="mapHeader"><span class="mapTitle">WORLD MAP</span><button id="mapClose">✕ Close</button></div>
    <canvas id="mapCanvas" width="600" height="600"></canvas>
    <div class="mapLegend">
      <span>🔵 You</span>
      <span>🔴 Enemy</span>
      <span>📦 Chest</span>
      <span>💎 Waypoint</span>
    </div>
  `;
  document.body.appendChild(panel);
  canvas = panel.querySelector('#mapCanvas') as HTMLCanvasElement;
  panel.querySelector('#mapClose')!.addEventListener('click', closeMap);
  drawMap();
}

function closeMap(): void {
  if (!panel) return;
  SFX.menuClose();
  panel.remove();
  panel = null;
  canvas = null;
  if (G.hasStarted && G.health > 0) {
    if (G.mobile) G.isActive = true;
    else document.body.requestPointerLock();
  }
}

export function isMapOpen(): boolean { return panel !== null; }
export { closeMap as closeMapScreen };

function drawMap(): void {
  if (!canvas || !G.player) return;
  const ctx = canvas.getContext('2d')!;
  const W = 600;
  const WORLD = 140; /* world size */
  const scale = W / WORLD;
  const ox = W / 2;
  const oz = W / 2;

  /* Clear */
  ctx.fillStyle = '#0a1422';
  ctx.fillRect(0, 0, W, W);

  /* Draw terrain heightmap */
  const step = 2;
  for (let wx = -WORLD / 2; wx < WORLD / 2; wx += step) {
    for (let wz = -WORLD / 2; wz < WORLD / 2; wz += step) {
      const h = wH(wx, wz);
      let r: number, g: number, b: number;
      if (h < -0.2) {
        r = 50; g = 106; b = 161;
      } else if (h > 9) {
        r = 143; g = 156; b = 170;
      } else if (h > 4) {
        r = 112; g = 133; b = 93;
      } else if (h > 1) {
        r = 100; g = 138; b = 83;
      } else {
        r = 85; g = 133; b = 95;
      }
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const sx = ox + wx * scale;
      const sz = oz + wz * scale;
      ctx.fillRect(sx, sz, step * scale + 1, step * scale + 1);
    }
  }

  /* Grid lines */
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 10; i++) {
    const p = (i / 10) * W;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
  }

  /* Chests */
  for (const ch of G.entities.chests) {
    if (ch.opened) continue;
    const sx = ox + ch.mesh.position.x * scale;
    const sz = oz + ch.mesh.position.z * scale;
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(sx - 3, sz - 3, 6, 6);
  }

  /* Enemies */
  for (const e of G.entities.slimes) {
    if (e.dead) continue;
    const sx = ox + e.mesh.position.x * scale;
    const sz = oz + e.mesh.position.z * scale;
    ctx.fillStyle = e.isBoss ? '#ff4444' : '#ff8866';
    ctx.beginPath();
    ctx.arc(sx, sz, e.isBoss ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Landmarks */
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  for (const lm of LANDMARKS) {
    const sx = ox + lm.x * scale;
    const sz = oz + lm.z * scale;
    ctx.fillStyle = '#fff';
    ctx.fillText(lm.icon, sx, sz - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px sans-serif';
    ctx.fillText(lm.name, sx, sz + 10);
    ctx.font = '12px sans-serif';
  }

  /* Player */
  const px = ox + G.player.position.x * scale;
  const pz = oz + G.player.position.z * scale;
  ctx.fillStyle = '#44aaff';
  ctx.beginPath();
  ctx.arc(px, pz, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  /* Player direction arrow */
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-G.camYaw + Math.PI);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(4, 2);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

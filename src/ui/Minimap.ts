import { G } from '../core/GameState';
import { wH, objTarget } from '../core/Helpers';
import { ui } from './UIRefs';

/* ─── Custom Waypoint ─── */
let customWaypoint: { x: number; z: number } | null = null;
let minimapBound = false;
let terrainCacheCanvas: HTMLCanvasElement | null = null;
let lastTerrainCacheX = NaN;
let lastTerrainCacheZ = NaN;

const MINIMAP_SIZE = 200;
const MINIMAP_CENTER = 100;
const MINIMAP_RADIUS = 100;
const MINIMAP_RANGE = 48;
const MINIMAP_TILE = 8;
const MINIMAP_TERRAIN_REFRESH_DISTANCE = 4;

function getTerrainCacheCanvas(): HTMLCanvasElement {
  if (!terrainCacheCanvas) {
    terrainCacheCanvas = document.createElement('canvas');
    terrainCacheCanvas.width = MINIMAP_SIZE;
    terrainCacheCanvas.height = MINIMAP_SIZE;
  }
  return terrainCacheCanvas;
}

function redrawTerrainLayer(playerX: number, playerZ: number): void {
  const canvas = getTerrainCacheCanvas();
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  ctx.save();
  ctx.beginPath();
  ctx.arc(MINIMAP_CENTER, MINIMAP_CENTER, MINIMAP_RADIUS, 0, Math.PI * 2);
  ctx.clip();

  const grd = ctx.createRadialGradient(MINIMAP_CENTER, MINIMAP_CENTER, 12, MINIMAP_CENTER, MINIMAP_CENTER, MINIMAP_RADIUS);
  grd.addColorStop(0, 'rgba(41,72,96,0.98)');
  grd.addColorStop(1, 'rgba(18,32,50,0.98)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

  for (let sy = -MINIMAP_RANGE; sy <= MINIMAP_RANGE; sy += MINIMAP_TILE) {
    for (let sx = -MINIMAP_RANGE; sx <= MINIMAP_RANGE; sx += MINIMAP_TILE) {
      const wx = playerX + sx;
      const wz = playerZ + sy;
      const h = wH(wx, wz);
      let cl = '#55855f';
      if (h < -0.2) cl = '#326aa1';
      else if (h > 9) cl = '#8f9caa';
      else if (h > 4) cl = '#70855d';
      else if (h > 1) cl = '#648a53';
      ctx.fillStyle = cl;
      ctx.fillRect(
        MINIMAP_CENTER + (sx / MINIMAP_RANGE) * MINIMAP_RADIUS - 4,
        MINIMAP_CENTER + (sy / MINIMAP_RANGE) * MINIMAP_RADIUS - 4,
        MINIMAP_TILE,
        MINIMAP_TILE,
      );
    }
  }

  ctx.restore();
  lastTerrainCacheX = playerX;
  lastTerrainCacheZ = playerZ;
}

function ensureTerrainLayer(playerX: number, playerZ: number): HTMLCanvasElement {
  if (
    !terrainCacheCanvas
    || Math.abs(playerX - lastTerrainCacheX) >= MINIMAP_TERRAIN_REFRESH_DISTANCE
    || Math.abs(playerZ - lastTerrainCacheZ) >= MINIMAP_TERRAIN_REFRESH_DISTANCE
  ) {
    redrawTerrainLayer(playerX, playerZ);
  }
  return getTerrainCacheCanvas();
}

function bindMinimapClick(): void {
  if (minimapBound) return;
  minimapBound = true;
  const canvas = ui.minimapCanvas as unknown as HTMLCanvasElement;
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const sz = 200, c = 100, r = 100, rng = 48;
    const dx = ((mx - c) / r) * rng;
    const dz = ((my - c) / r) * rng;
    /* Convert minimap offset to world position */
    const wx = G.player!.position.x + dx;
    const wz = G.player!.position.z + dz;
    customWaypoint = { x: wx, z: wz };
  });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    customWaypoint = null;
  });
}

export function updateMinimap(): void {
  const now = performance.now();
  if (now - G.lastMini < 70) return;
  G.lastMini = now;

  const canvas = ui.minimapCanvas as unknown as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const terrainLayer = ensureTerrainLayer(G.player!.position.x, G.player!.position.z);
  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  ctx.drawImage(terrainLayer, 0, 0);

  // Chests
  for (const ch of G.entities.chests) {
    if (ch.opened) continue;
    const dx = ch.mesh.position.x - G.player!.position.x;
    const dz = ch.mesh.position.z - G.player!.position.z;
    if (Math.abs(dx) < MINIMAP_RANGE && Math.abs(dz) < MINIMAP_RANGE) {
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(
        MINIMAP_CENTER + (dx / MINIMAP_RANGE) * MINIMAP_RADIUS - 2,
        MINIMAP_CENTER + (dz / MINIMAP_RANGE) * MINIMAP_RADIUS - 2,
        4,
        4,
      );
    }
  }

  // Enemies
  for (const s of G.entities.slimes) {
    if (s.dead) continue;
    const dx = s.mesh.position.x - G.player!.position.x;
    const dz = s.mesh.position.z - G.player!.position.z;
    if (Math.abs(dx) < MINIMAP_RANGE && Math.abs(dz) < MINIMAP_RANGE) {
      ctx.fillStyle = s.isBoss ? '#ff0000' : s.archetype === 'archer' ? '#ffaa44' : '#ff6666';
      ctx.beginPath();
      ctx.arc(
        MINIMAP_CENTER + (dx / MINIMAP_RANGE) * MINIMAP_RADIUS,
        MINIMAP_CENTER + (dz / MINIMAP_RANGE) * MINIMAP_RADIUS,
        s.isBoss ? 5 : 3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Objective
  const obj = objTarget();
  const odx = obj.x - G.player!.position.x;
  const odz = obj.z - G.player!.position.z;
  const ol = Math.sqrt(odx * odx + odz * odz);
  if (ol > 0.01) {
    const cd = Math.min(ol, MINIMAP_RANGE - 4);
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath();
    ctx.arc(
      MINIMAP_CENTER + ((odx / ol) * cd / MINIMAP_RANGE) * MINIMAP_RADIUS,
      MINIMAP_CENTER + ((odz / ol) * cd / MINIMAP_RANGE) * MINIMAP_RADIUS,
      5,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  /* Custom waypoint marker */
  if (customWaypoint) {
    const wdx = customWaypoint.x - G.player!.position.x;
    const wdz = customWaypoint.z - G.player!.position.z;
    if (Math.abs(wdx) < MINIMAP_RANGE && Math.abs(wdz) < MINIMAP_RANGE) {
      const wpx = MINIMAP_CENTER + (wdx / MINIMAP_RANGE) * MINIMAP_RADIUS;
      const wpz = MINIMAP_CENTER + (wdz / MINIMAP_RANGE) * MINIMAP_RADIUS;
      /* Blue diamond marker */
      ctx.fillStyle = '#44aaff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.save();
      ctx.translate(wpx, wpz);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.strokeRect(-4, -4, 8, 8);
      ctx.restore();
    }
  }

  // Player arrow
  ctx.save();
  ctx.translate(MINIMAP_CENTER, MINIMAP_CENTER);
  ctx.rotate(-G.camYaw);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(6, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  /* Bind click handler (once) */
  bindMinimapClick();
}

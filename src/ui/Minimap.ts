import { G } from '../core/GameState';
import { wH, objTarget } from '../core/Helpers';
import { ui } from './UIRefs';

/* ─── Custom Waypoint ─── */
let customWaypoint: { x: number; z: number } | null = null;
let minimapBound = false;

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
  const sz = 200, c = 100, r = 100, rng = 48;
  ctx.clearRect(0, 0, sz, sz);
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.clip();

  const grd = ctx.createRadialGradient(c, c, 12, c, c, r);
  grd.addColorStop(0, 'rgba(41,72,96,0.98)');
  grd.addColorStop(1, 'rgba(18,32,50,0.98)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, sz, sz);

  for (let sy = -rng; sy <= rng; sy += 8) {
    for (let sx = -rng; sx <= rng; sx += 8) {
      const wx = G.player!.position.x + sx;
      const wz = G.player!.position.z + sy;
      const h = wH(wx, wz);
      let cl = '#55855f';
      if (h < -0.2) cl = '#326aa1';
      else if (h > 9) cl = '#8f9caa';
      else if (h > 4) cl = '#70855d';
      else if (h > 1) cl = '#648a53';
      ctx.fillStyle = cl;
      ctx.fillRect(c + (sx / rng) * r - 4, c + (sy / rng) * r - 4, 8, 8);
    }
  }

  // Chests
  for (const ch of G.entities.chests) {
    if (ch.opened) continue;
    const dx = ch.mesh.position.x - G.player!.position.x;
    const dz = ch.mesh.position.z - G.player!.position.z;
    if (Math.abs(dx) < rng && Math.abs(dz) < rng) {
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(c + (dx / rng) * r - 2, c + (dz / rng) * r - 2, 4, 4);
    }
  }

  // Enemies
  for (const s of G.entities.slimes) {
    if (s.dead) continue;
    const dx = s.mesh.position.x - G.player!.position.x;
    const dz = s.mesh.position.z - G.player!.position.z;
    if (Math.abs(dx) < rng && Math.abs(dz) < rng) {
      ctx.fillStyle = s.isBoss ? '#ff0000' : s.archetype === 'archer' ? '#ffaa44' : '#ff6666';
      ctx.beginPath();
      ctx.arc(c + (dx / rng) * r, c + (dz / rng) * r, s.isBoss ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Objective
  const obj = objTarget();
  const odx = obj.x - G.player!.position.x;
  const odz = obj.z - G.player!.position.z;
  const ol = Math.sqrt(odx * odx + odz * odz);
  if (ol > 0.01) {
    const cd = Math.min(ol, rng - 4);
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath();
    ctx.arc(
      c + ((odx / ol) * cd / rng) * r,
      c + ((odz / ol) * cd / rng) * r,
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
    if (Math.abs(wdx) < rng && Math.abs(wdz) < rng) {
      const wpx = c + (wdx / rng) * r;
      const wpz = c + (wdz / rng) * r;
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
  ctx.translate(c, c);
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
  ctx.restore();

  /* Bind click handler (once) */
  bindMinimapClick();
}

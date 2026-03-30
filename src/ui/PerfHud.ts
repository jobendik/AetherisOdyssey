import { G } from '../core/GameState';

let hudEl: HTMLElement | null = null;
let visible = false;
let lastUpdate = 0;

export function initPerfHud(): void {
  hudEl = document.createElement('div');
  hudEl.id = 'perfHud';
  document.body.appendChild(hudEl);
}

export function togglePerfHud(): void {
  visible = !visible;
  if (hudEl) hudEl.classList.toggle('show', visible);
}

export function updatePerfHud(): void {
  if (!visible || !hudEl || !G.rend) return;
  const now = performance.now();
  if (now - lastUpdate < 250) return; // update 4× per second
  lastUpdate = now;

  const samples = G.fpsSamples;
  const fps = samples.length > 0
    ? Math.round(samples.reduce((a, b) => a + b, 0) / samples.length)
    : 0;

  const info = G.rend.info;
  const calls = info.render.calls;
  const tris = info.render.triangles;
  const tex = info.memory.textures;
  const geom = info.memory.geometries;

  hudEl.innerHTML =
    `FPS: ${fps}<br>` +
    `Draw: ${calls}<br>` +
    `Tris: ${(tris / 1000).toFixed(1)}k<br>` +
    `Tex: ${tex} · Geo: ${geom}`;
}

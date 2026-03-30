import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════
   TEXTURE ATLAS — Combines small procedural textures into
   a shared atlas to reduce draw calls and material count.
   Useful for props, vegetation, terrain tiles, and UI icons.
   ═══════════════════════════════════════════════════════════ */

const ATLAS_SIZE = 1024; /* atlas canvas resolution */
const TILE_SIZE = 64;    /* each tile in the atlas */
const TILES_PER_ROW = ATLAS_SIZE / TILE_SIZE; /* 16 */

interface AtlasEntry {
  key: string;
  u: number; v: number;
  uSize: number; vSize: number;
}

const entries: AtlasEntry[] = [];
let atlasCanvas: HTMLCanvasElement | null = null;
let atlasTexture: THREE.CanvasTexture | null = null;
let nextSlot = 0;

function ensureAtlas(): void {
  if (atlasCanvas) return;
  atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_SIZE;
  atlasCanvas.height = ATLAS_SIZE;
  const ctx = atlasCanvas.getContext('2d')!;
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestMipMapLinearFilter;
  atlasTexture.encoding = THREE.sRGBEncoding;
}

/** Register a solid-color tile in the atlas.  Returns UV region. */
export function addColorTile(key: string, color: string): AtlasEntry {
  ensureAtlas();
  /* Already registered? */
  const existing = entries.find(e => e.key === key);
  if (existing) return existing;

  if (nextSlot >= TILES_PER_ROW * TILES_PER_ROW) {
    /* Atlas full — return first slot as fallback */
    return entries[0];
  }

  const col = Math.floor(nextSlot % TILES_PER_ROW);
  const row = Math.floor(nextSlot / TILES_PER_ROW);
  const px = col * TILE_SIZE;
  const py = row * TILE_SIZE;

  const ctx = atlasCanvas!.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  /* Add subtle noise for cel-shading feel */
  for (let i = 0; i < 40; i++) {
    const nx = px + Math.random() * TILE_SIZE;
    const ny = py + Math.random() * TILE_SIZE;
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    ctx.fillRect(nx, ny, 2, 2);
  }

  const entry: AtlasEntry = {
    key,
    u: px / ATLAS_SIZE,
    v: 1 - (py + TILE_SIZE) / ATLAS_SIZE, /* flip Y for GL */
    uSize: TILE_SIZE / ATLAS_SIZE,
    vSize: TILE_SIZE / ATLAS_SIZE,
  };
  entries.push(entry);
  nextSlot++;
  atlasTexture!.needsUpdate = true;
  return entry;
}

/** Register a gradient tile (top→bottom). */
export function addGradientTile(key: string, topColor: string, bottomColor: string): AtlasEntry {
  ensureAtlas();
  const existing = entries.find(e => e.key === key);
  if (existing) return existing;

  if (nextSlot >= TILES_PER_ROW * TILES_PER_ROW) return entries[0];

  const col = Math.floor(nextSlot % TILES_PER_ROW);
  const row = Math.floor(nextSlot / TILES_PER_ROW);
  const px = col * TILE_SIZE;
  const py = row * TILE_SIZE;

  const ctx = atlasCanvas!.getContext('2d')!;
  const grad = ctx.createLinearGradient(px, py, px, py + TILE_SIZE);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  const entry: AtlasEntry = {
    key,
    u: px / ATLAS_SIZE,
    v: 1 - (py + TILE_SIZE) / ATLAS_SIZE,
    uSize: TILE_SIZE / ATLAS_SIZE,
    vSize: TILE_SIZE / ATLAS_SIZE,
  };
  entries.push(entry);
  nextSlot++;
  atlasTexture!.needsUpdate = true;
  return entry;
}

/** Get the shared atlas texture (for batched meshes using this atlas). */
export function getAtlasTexture(): THREE.CanvasTexture {
  ensureAtlas();
  return atlasTexture!;
}

/** Create a MeshBasicMaterial using this atlas for a given tile key. */
export function getAtlasMaterial(key: string): THREE.MeshBasicMaterial {
  ensureAtlas();
  return new THREE.MeshBasicMaterial({ map: atlasTexture! });
}

/** Total tiles registered */
export function getAtlasCount(): number {
  return nextSlot;
}

/** Lookup UV region for a key */
export function getAtlasUV(key: string): AtlasEntry | undefined {
  return entries.find(e => e.key === key);
}

/** Pre-populate atlas with common prop colours used throughout the world. */
export function initDefaultAtlas(): void {
  addColorTile('rock_gray',   '#888880');
  addColorTile('rock_warm',   '#8a8278');
  addColorTile('rock_cool',   '#787878');
  addColorTile('trunk_brown', '#6b4226');
  addGradientTile('leaf_green',  '#5e9a4a', '#4a7833');
  addGradientTile('leaf_olive',  '#6baa52', '#4e8836');
  addColorTile('flower_pink',  '#ff7799');
  addColorTile('flower_yellow','#ffdd44');
  addColorTile('grass_tip',    '#3e7530');
  addColorTile('grass_base',   '#2a5520');
  addColorTile('ore_gold',     '#ffaa33');
  addColorTile('ore_crystal',  '#88ccff');
  addColorTile('water_blue',   '#3388bb');
  addColorTile('sand_tan',     '#c8b080');
  addGradientTile('sky_day', '#88bbdd', '#44667a');
  addGradientTile('sky_sunset', '#ff8844', '#442266');
}

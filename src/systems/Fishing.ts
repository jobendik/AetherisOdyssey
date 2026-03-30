import * as THREE from 'three';
import { G } from '../core/GameState';
import { wH, mkMesh, mkCelMat, distXZ } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { spawnParts } from '../systems/Particles';
import { spawnDmg } from '../ui/DamageNumbers';

/* ═══════════════════════════════════════════════════════════
   FISHING MINI-GAME
   Fishing spots near water. Player presses F to cast, then a
   timing-based minigame: keep the cursor in the green zone.
   ═══════════════════════════════════════════════════════════ */

interface FishSpot {
  pos: THREE.Vector3;
  mesh: THREE.Group;
  active: boolean;
  cooldown: number;
}

const FISH_ITEMS = [
  { name: 'Medaka',       icon: '🐟', rarity: 3, heal: 15, desc: 'A common freshwater fish.' },
  { name: 'Aizen Medaka', icon: '🐠', rarity: 3, heal: 25, desc: 'A blueish freshwater fish.' },
  { name: 'Crystalfish',  icon: '💎', rarity: 4, heal: 40, desc: 'A rare crystalline fish.' },
  { name: 'Golden Koi',   icon: '🏆', rarity: 5, heal: 80, desc: 'A prized golden fish.' },
];

const fishSpots: FishSpot[] = [];
let panel: HTMLElement | null = null;
let fishingActive = false;
let fishingSpot: FishSpot | null = null;

export function populateFishSpots(count: number): void {
  const buoyMat = mkCelMat(0xff6644, 0xcc4422, 0);
  const poleMat = mkCelMat(0x886644, 0x664422, 0);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const r = 30 + Math.random() * 40;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const h = wH(x, z);
    /* Only place near water (h < 0) */
    if (h > 0.5) continue;
    const mesh = new THREE.Group();
    /* Buoy marker */
    const buoy = mkMesh(new THREE.SphereGeometry(0.3, 8, 6), buoyMat, 0, 0.3, 0);
    mesh.add(buoy);
    /* Small pole */
    const pole = mkMesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 4), poleMat, 0.5, 0.75, 0);
    mesh.add(pole);
    /* Bobbing ring on water */
    const ringGeo = new THREE.RingGeometry(0.6, 0.8, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    mesh.add(ring);
    mesh.position.set(x, Math.max(h, -0.5), z);
    G.scene!.add(mesh);
    fishSpots.push({ pos: new THREE.Vector3(x, h, z), mesh, active: true, cooldown: 0 });
  }
}

export function nearFishSpot(): boolean {
  if (!G.player) return false;
  for (const fs of fishSpots) {
    if (!fs.active) continue;
    if (distXZ(G.player.position, fs.pos) < 4) return true;
  }
  return false;
}

export function startFishing(): void {
  if (fishingActive || !G.player) return;
  let nearest: FishSpot | null = null;
  let bestD = 4;
  for (const fs of fishSpots) {
    if (!fs.active) continue;
    const d = distXZ(G.player.position, fs.pos);
    if (d < bestD) { bestD = d; nearest = fs; }
  }
  if (!nearest) return;
  fishingSpot = nearest;
  fishingActive = true;
  openFishingUI();
}

export function updateFishing(dt: number): void {
  /* Cooldown recovery */
  for (const fs of fishSpots) {
    if (!fs.active && fs.cooldown > 0) {
      fs.cooldown -= dt;
      if (fs.cooldown <= 0) {
        fs.active = true;
        fs.mesh.visible = true;
      }
    }
  }
  /* Bobbing animation */
  for (const fs of fishSpots) {
    if (!fs.active) continue;
    fs.mesh.position.y = Math.max(wH(fs.pos.x, fs.pos.z), -0.5) + Math.sin(G.worldTime * 2 + fs.pos.x) * 0.15;
  }
}

export function isFishingOpen(): boolean { return panel !== null; }

function openFishingUI(): void {
  SFX.menuOpen();
  G.isActive = false;
  if (!G.mobile && document.pointerLockElement) document.exitPointerLock();
  panel = document.createElement('div');
  panel.id = 'fishOverlay';
  renderFishUI();
  document.body.appendChild(panel);
}

function closeFishingUI(): void {
  if (!panel) return;
  SFX.menuClose();
  panel.remove();
  panel = null;
  fishingActive = false;
  fishingSpot = null;
  if (G.hasStarted && G.health > 0) {
    if (G.mobile) G.isActive = true;
    else document.body.requestPointerLock();
  }
}

export { closeFishingUI };

/* Timing-based mini-game state */
let cursorPos = 0;       /* 0..1 position of moving cursor */
let cursorDir = 1;       /* +1 or -1 */
let greenStart = 0;
let greenEnd = 0;
let attempts = 0;
let gamePhase: 'ready' | 'playing' | 'result' = 'ready';
let resultFish: typeof FISH_ITEMS[number] | null = null;

function startMiniGame(): void {
  cursorPos = 0;
  cursorDir = 1;
  greenStart = 0.3 + Math.random() * 0.2;
  greenEnd = greenStart + 0.15 + Math.random() * 0.1;
  attempts = 0;
  gamePhase = 'playing';
  renderFishUI();
  animateCursor();
}

function animateCursor(): void {
  if (gamePhase !== 'playing' || !panel) return;
  cursorPos += cursorDir * 0.012;
  if (cursorPos > 1) { cursorPos = 1; cursorDir = -1; }
  if (cursorPos < 0) { cursorPos = 0; cursorDir = 1; }
  updateCursorUI();
  requestAnimationFrame(animateCursor);
}

function attemptCatch(): void {
  if (gamePhase !== 'playing') return;
  attempts++;
  if (cursorPos >= greenStart && cursorPos <= greenEnd) {
    /* Success! */
    gamePhase = 'result';
    /* Determine fish rarity based on how centered the hit was */
    const center = (greenStart + greenEnd) / 2;
    const accuracy = 1 - Math.abs(cursorPos - center) / ((greenEnd - greenStart) / 2);
    let roll = Math.random() + accuracy * 0.3;
    let fishIdx = 0;
    if (roll > 0.95) fishIdx = 3;
    else if (roll > 0.8) fishIdx = 2;
    else if (roll > 0.5) fishIdx = 1;
    resultFish = FISH_ITEMS[fishIdx];
    /* Add fish as food item (use f1 slot for simplicity, but show custom name) */
    G.inventory.food.push('f1');
    G.mora += 20 + fishIdx * 15;
    SFX.chest();
    if (fishingSpot) {
      spawnParts(fishingSpot.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#44aaff', 15, 8);
      spawnDmg(fishingSpot.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0, '#44aaff', false, resultFish.icon + ' ' + resultFish.name);
      fishingSpot.active = false;
      fishingSpot.mesh.visible = false;
      fishingSpot.cooldown = 30;
    }
    renderFishUI();
  } else {
    /* Miss — visual feedback */
    SFX.error();
    if (attempts >= 3) {
      gamePhase = 'result';
      resultFish = null;
      renderFishUI();
    }
  }
}

function updateCursorUI(): void {
  if (!panel) return;
  const cursor = panel.querySelector('#fishCursor') as HTMLElement;
  if (cursor) cursor.style.left = (cursorPos * 100) + '%';
}

function renderFishUI(): void {
  if (!panel) return;
  if (gamePhase === 'ready') {
    panel.innerHTML = `
      <div class="fishPanel">
        <h2>🎣 Fishing</h2>
        <p style="color:rgba(200,220,255,0.7);text-align:center">Cast your line and catch fish!</p>
        <button class="fishCastBtn" id="fishCast">Cast Line</button>
        <button class="fishCloseBtn" id="fishClose">✕ Cancel</button>
      </div>
    `;
    panel.querySelector('#fishCast')!.addEventListener('click', startMiniGame);
    panel.querySelector('#fishClose')!.addEventListener('click', closeFishingUI);
  } else if (gamePhase === 'playing') {
    panel.innerHTML = `
      <div class="fishPanel">
        <h2>🎣 Reel it in!</h2>
        <p style="color:rgba(200,220,255,0.6);text-align:center">Click when cursor is in the green zone! (${3 - attempts} tries left)</p>
        <div class="fishBar">
          <div class="fishGreen" style="left:${greenStart * 100}%;width:${(greenEnd - greenStart) * 100}%"></div>
          <div class="fishCursor" id="fishCursor" style="left:${cursorPos * 100}%"></div>
        </div>
        <button class="fishCastBtn" id="fishReel">🎣 Reel!</button>
        <button class="fishCloseBtn" id="fishClose">✕ Give up</button>
      </div>
    `;
    panel.querySelector('#fishReel')!.addEventListener('click', attemptCatch);
    panel.querySelector('#fishClose')!.addEventListener('click', closeFishingUI);
  } else {
    panel.innerHTML = `
      <div class="fishPanel">
        <h2>${resultFish ? resultFish.icon + ' Caught!' : '😞 Got away...'}</h2>
        ${resultFish ? `<p style="text-align:center;font-size:18px;color:#fff">${resultFish.name}</p><p style="text-align:center;color:rgba(200,220,255,0.7)">${resultFish.desc}</p>` : '<p style="color:rgba(200,220,255,0.5);text-align:center">Better luck next time!</p>'}
        <button class="fishCastBtn" id="fishDone">OK</button>
      </div>
    `;
    panel.querySelector('#fishDone')!.addEventListener('click', closeFishingUI);
  }
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh, mkPointLight, mkCelMat, mkCelEmissiveMat, rwp, wH } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { ui } from '../ui/UIRefs';
import { updateHUD } from '../ui/HUD';

/* ─── Recipes ─── */
interface Recipe {
  name: string;
  icon: string;
  inputs: { id: string; qty: number }[];
  output: { id: string; qty: number };
  desc: string;
}

const RECIPES: Recipe[] = [
  { name: 'Sweet Madame', icon: '🍗', inputs: [{ id: 'f1', qty: 2 }], output: { id: 'f2', qty: 1 }, desc: '2 Apples → 1 Sweet Madame' },
  { name: 'Adeptus Temptation', icon: '🍲', inputs: [{ id: 'f2', qty: 3 }], output: { id: 'f3', qty: 1 }, desc: '3 Sweet Madames → 1 Adeptus' },
];

/* ─── Campfire positions (world meshes) ─── */
const campfirePositions: THREE.Vector3[] = [];

export function populateCampfires(count: number): void {
  const logMat = mkCelMat(0x664422, 0x553311, 0);
  const fireMat = mkCelEmissiveMat(0xff6600, 0xff3300, 1.2);
  const stoneMat = mkCelMat(0x888888, 0x666666, 0);

  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(18, 110, 0);
    const group = new THREE.Group();
    /* Stone ring */
    for (let s = 0; s < 6; s++) {
      const ang = (s / 6) * Math.PI * 2;
      const stone = mkMesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), stoneMat,
        Math.cos(ang) * 0.6, 0.12, Math.sin(ang) * 0.6);
      group.add(stone);
    }
    /* Logs */
    const log1 = mkMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6), logMat, 0, 0.2, 0);
    log1.rotation.z = 0.4;
    group.add(log1);
    const log2 = mkMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6), logMat, 0, 0.2, 0);
    log2.rotation.z = -0.4;
    log2.rotation.y = 1.2;
    group.add(log2);
    /* Flame (simple animated cone) */
    const flame = mkMesh(new THREE.ConeGeometry(0.25, 0.6, 8), fireMat, 0, 0.55, 0);
    flame.name = 'campFlame';
    group.add(flame);
    /* Point light */
    const light = mkPointLight(0xff6622, 1.5, 8);
    light.position.set(0, 1, 0);
    group.add(light);

    group.position.set(x, y, z);
    G.scene!.add(group);
    campfirePositions.push(new THREE.Vector3(x, y, z));
  }
}

export function nearCampfire(): boolean {
  if (!G.player) return false;
  for (const p of campfirePositions) {
    if (G.player.position.distanceTo(p) < 3.5) return true;
  }
  return false;
}

/* ─── Cooking UI ─── */
let cookingOpen = false;
let cookOverlay: HTMLDivElement | null = null;

export function isCookingOpen(): boolean { return cookingOpen; }

export function openCookingUI(): void {
  if (cookingOpen) return;
  cookingOpen = true;
  SFX.collect();
  cookOverlay = document.createElement('div');
  cookOverlay.className = 'cookingOverlay';
  cookOverlay.innerHTML = `
    <div class="cookPanel">
      <h2>🔥 Cooking</h2>
      <div class="cookRecipes"></div>
      <div class="cookClose">Press C or ESC to close</div>
    </div>
  `;
  ui.uiRoot.appendChild(cookOverlay);
  renderRecipes();
}

export function closeCookingUI(): void {
  if (!cookingOpen) return;
  cookingOpen = false;
  if (cookOverlay) {
    cookOverlay.remove();
    cookOverlay = null;
  }
}

function renderRecipes(): void {
  if (!cookOverlay) return;
  const container = cookOverlay.querySelector('.cookRecipes') as HTMLDivElement;
  if (!container) return;
  container.innerHTML = '';
  for (const r of RECIPES) {
    const canCook = r.inputs.every(inp => countItem(inp.id) >= inp.qty);
    const btn = document.createElement('button');
    btn.className = 'cookBtn' + (canCook ? '' : ' cookDisabled');
    btn.innerHTML = `<span class="cookIcon">${r.icon}</span> <span class="cookName">${r.name}</span><br><small>${r.desc}</small>`;
    if (canCook) {
      btn.addEventListener('click', () => {
        cook(r);
        renderRecipes();
      });
    }
    container.appendChild(btn);
  }
}

function countItem(id: string): number {
  if (id.startsWith('f')) return G.inventory.food.filter(f => f === id).length;
  return 0;
}

function cook(r: Recipe): void {
  /* Remove inputs */
  for (const inp of r.inputs) {
    for (let i = 0; i < inp.qty; i++) {
      const idx = G.inventory.food.indexOf(inp.id);
      if (idx >= 0) G.inventory.food.splice(idx, 1);
    }
  }
  /* Add output */
  for (let i = 0; i < r.output.qty; i++) {
    G.inventory.food.push(r.output.id);
  }
  SFX.hit();
  updateHUD();
}

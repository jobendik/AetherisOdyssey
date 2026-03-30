import { G } from '../core/GameState';
import { PARTY } from '../data/PartyData';
import { SFX } from '../audio/Audio';
import {
  getConstellationLevel,
  getConstellationTree,
  getStellaFortuna,
  unlockConstellation,
} from '../systems/Constellations';

let panel: HTMLElement | null = null;

export function toggleConstellationPanel(): void {
  if (panel) { closeConstellationPanel(); return; }
  openConstellationPanel();
}

export function isConstellationPanelOpen(): boolean {
  return panel !== null;
}

function openConstellationPanel(): void {
  SFX.menuOpen();
  G.isActive = false;
  if (!G.mobile && document.pointerLockElement) document.exitPointerLock();
  panel = document.createElement('div');
  panel.id = 'constOverlay';
  renderUI();
  document.body.appendChild(panel);
}

function closeConstellationPanel(): void {
  if (!panel) return;
  SFX.menuClose();
  panel.remove();
  panel = null;
  if (G.hasStarted && G.health > 0) {
    if (G.mobile) G.isActive = true;
    else document.body.requestPointerLock();
  }
}

function renderUI(): void {
  if (!panel) return;
  const idx = G.activeIdx;
  const level = getConstellationLevel(idx);
  const stella = getStellaFortuna(idx);
  const tree = getConstellationTree(idx);

  const tabs = PARTY.map((member, i) =>
    `<button class="constTab ${i === idx ? 'constTabActive' : ''}" data-idx="${i}" style="--accent:${member.accent}">${member.portrait} ${member.name}</button>`
  ).join('');

  const nodes = tree.map((constellation, nodeIdx) => {
    const unlocked = nodeIdx < level;
    return `<div class="constNode ${unlocked ? 'constUnlocked' : 'constLocked'}">
      <div class="constIcon">${constellation.icon}</div>
      <div class="constInfo">
        <div class="constName">C${nodeIdx + 1}: ${constellation.name}</div>
        <div class="constDesc">${constellation.desc}</div>
      </div>
      <div class="constStatus">${unlocked ? '✓' : '🔒'}</div>
    </div>`;
  }).join('');

  const canUnlock = level < 6 && stella >= 1;

  panel.innerHTML = `
    <div class="constHeader"><div class="constTitle">CONSTELLATIONS</div><button id="constClose">✕ Close</button></div>
    <div class="constTabs">${tabs}</div>
    <div class="constBody">
      <div class="constStellaInfo">Stella Fortuna: ${stella} ${canUnlock ? `<button class="constUnlockBtn" id="constUnlock">Unlock C${level + 1}</button>` : level >= 6 ? '(MAX)' : '(Need Stella Fortuna)'}</div>
      ${nodes}
    </div>
  `;

  panel.querySelector('#constClose')?.addEventListener('click', closeConstellationPanel);
  panel.querySelectorAll('.constTab').forEach((btn) => {
    btn.addEventListener('click', () => {
      G.activeIdx = parseInt((btn as HTMLElement).dataset.idx!, 10);
      renderUI();
    });
  });
  panel.querySelector('#constUnlock')?.addEventListener('click', () => {
    if (unlockConstellation(idx)) renderUI();
  });
}
import { G } from '../core/GameState';
import { PARTY } from '../data/PartyData';
import { SFX } from '../audio/Audio';
import { getTalentRank, getTalentTree, upgradeTalent } from '../systems/Talents';

let panel: HTMLElement | null = null;

export function toggleTalentPanel(): void {
  if (panel) { closeTalentPanel(); return; }
  openTalentPanel();
}

export function isTalentPanelOpen(): boolean {
  return panel !== null;
}

function openTalentPanel(): void {
  SFX.menuOpen();
  G.isActive = false;
  if (!G.mobile && document.pointerLockElement) document.exitPointerLock();
  panel = document.createElement('div');
  panel.id = 'talentOverlay';
  renderTalentUI();
  document.body.appendChild(panel);
}

function closeTalentPanel(): void {
  if (!panel) return;
  SFX.menuClose();
  panel.remove();
  panel = null;
  if (G.hasStarted && G.health > 0) {
    if (G.mobile) G.isActive = true;
    else document.body.requestPointerLock();
  }
}

function renderTalentUI(): void {
  if (!panel) return;
  const idx = G.activeIdx;
  const tree = getTalentTree(idx);

  const tabs = PARTY.map((member, i) =>
    `<button class="tlTab ${i === idx ? 'tlTabActive' : ''}" data-idx="${i}" style="--accent:${member.accent}">${member.portrait} ${member.name}</button>`
  ).join('');

  const rows = tree.map((talent) => {
    const rank = getTalentRank(idx, talent.id);
    const maxed = rank >= talent.maxRank;
    const canUpgrade = !maxed && G.lv >= talent.lvReq && G.mora >= talent.cost;
    return `<div class="tlRow ${maxed ? 'tlMaxed' : ''}">
      <div class="tlIcon">${talent.icon}</div>
      <div class="tlInfo">
        <div class="tlName">${talent.name} <span class="tlRank">${rank}/${talent.maxRank}</span></div>
        <div class="tlDesc">${talent.desc}</div>
        <div class="tlReq">Lv.${talent.lvReq} · ${talent.cost} Mora</div>
      </div>
      <button class="tlUpBtn ${canUpgrade ? '' : 'tlDisabled'}" data-tid="${talent.id}">${maxed ? 'MAX' : '↑'}</button>
    </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="tlHeader"><div class="tlTitle">TALENTS</div><button id="tlClose">✕ Close</button></div>
    <div class="tlTabs">${tabs}</div>
    <div class="tlBody">${rows}</div>
  `;

  panel.querySelector('#tlClose')?.addEventListener('click', closeTalentPanel);
  panel.querySelectorAll('.tlTab').forEach((btn) => {
    btn.addEventListener('click', () => {
      G.activeIdx = parseInt((btn as HTMLElement).dataset.idx!, 10);
      renderTalentUI();
    });
  });
  panel.querySelectorAll('.tlUpBtn:not(.tlDisabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const talentId = (btn as HTMLElement).dataset.tid!;
      if (upgradeTalent(idx, talentId)) renderTalentUI();
    });
  });
}
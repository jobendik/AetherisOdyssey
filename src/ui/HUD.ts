import { G, mem, saveMem, loadMem } from '../core/GameState';
import { clamp } from '../core/Helpers';
import { PARTY } from '../data/PartyData';
import { ui } from './UIRefs';
import { applyVisuals } from '../entities/Player';
import { SFX } from '../audio/Audio';
import { spawnRing, spawnParts } from '../systems/Particles';
import { tryReaction } from '../combat/Reactions';
import { dmgEnemy } from '../combat/DamageSystem';
import { calcStats } from '../systems/Inventory';
import * as THREE from 'three';

export function buildPartyHud(): void {
  ui.partyColumn.innerHTML = '';
  PARTY.forEach((m, i) => {
    const c = document.createElement('button');
    c.className = 'partyCard panel';
    c.style.position = 'relative';
    c.innerHTML = `<div class="partyKey">${i + 1}</div><div class="portrait" style="background:radial-gradient(circle at 35% 30%,${m.accent},rgba(8,14,26,0.92))">${m.portrait}</div><div class="partyName">${m.name}</div><div class="partyRole">${m.role}</div><div class="partyHp"><div class="partyHpFill" style="background:${m.accent};width:${(m.hp / m.maxHp) * 100}%"></div></div>`;
    c.addEventListener('click', () => switchParty(i));
    ui.partyColumn.appendChild(c);
  });
}

export function updateHUD(force = false): void {
  const now = performance.now();
  if (!force && now - G.lastHud < 40) return;
  G.lastHud = now;

  [...ui.partyColumn.children].forEach((c, i) => {
    const m = PARTY[i];
    (c as HTMLElement).classList.toggle('active', i === G.activeIdx);
    const f = (c as HTMLElement).querySelector('.partyHpFill') as HTMLElement;
    if (f) f.style.width = (m.hp / m.maxHp) * 100 + '%';
  });

  ui.hpFill.style.width = clamp(G.health / G.maxHealth, 0, 1) * 100 + '%';
  ui.hpNumbers.textContent = Math.ceil(G.health) + '/' + G.maxHealth;
  ui.shieldFill.style.width =
    G.shield > 0 ? clamp(G.shield / G.maxShield, 0, 1) * 100 + '%' : '0%';
  ui.staminaMiniFill.style.width =
    clamp(G.stamina / G.maxStamina, 0, 1) * 100 + '%';
  ui.staminaValue.textContent = Math.round((G.stamina / G.maxStamina) * 100) + '%';
  ui.playerLevel.textContent = 'Lv.' + G.lv + ' · ' + mem().element + ' · ' + mem().role;
  ui.moraValue.textContent = G.mora.toLocaleString();

  const scd = Math.max(0, G.skillCd);
  const bcd = Math.max(0, G.burstCd);
  ui.skillBtn.classList.toggle('cooling', scd > 0.01);
  ui.burstBtn.classList.toggle('cooling', bcd > 0.01);
  ui.skillCdText.textContent = scd > 0.01 ? scd.toFixed(scd < 1 ? 1 : 0) : '';
  ui.burstCdText.textContent = bcd > 0.01 ? bcd.toFixed(bcd < 1 ? 1 : 0) : '';
  ui.burstArc.style.setProperty('--energy', mem().accent);
  ui.burstArc.style.setProperty(
    '--energyDeg',
    clamp((G.burstEnergy / 100) * 360, 0, 360) + 'deg',
  );
  ui.skillArc.style.setProperty('--energy', mem().accent);
  ui.skillArc.style.setProperty(
    '--energyDeg',
    (scd > 0 ? 360 - (scd / mem().skillCdMax) * 360 : 360) + 'deg',
  );

  if (G.bossActive && G.bossEntity && !G.bossEntity.dead) {
    ui.targetInfo.style.display = 'none';
    ui.bossBar.style.display = 'block';
    ui.bossName.textContent = '👑 KING SLIME';
    ui.bossPhaseLabel.textContent =
      ['', 'Phase 1', 'Phase 2 — Fury', 'Phase 3 — RAGE'][G.bossPhase] || '';
    ui.bossHpFill.style.width = (G.bossEntity.hp / G.bossEntity.maxHp) * 100 + '%';
  } else {
    ui.bossBar.style.display = 'none';
    if (G.target && !G.target.dead) {
      ui.targetInfo.style.display = 'block';
      ui.targetName.textContent = G.target.type ? G.target.type.name : 'Enemy';
      ui.targetLevel.textContent = 'Lv.' + G.target.level;
      ui.targetBarFill.style.width = (G.target.hp / G.target.maxHp) * 100 + '%';
    } else {
      ui.targetInfo.style.display = 'none';
    }
  }

  ui.fpsValue.textContent = G.fpsSamples.length
    ? String(Math.round(G.fpsSamples.reduce((a, b) => a + b, 0) / G.fpsSamples.length))
    : '60';
}

export function switchParty(i: number): void {
  if (i < 0 || i >= PARTY.length || i === G.activeIdx) return;
  saveMem();
  G.activeIdx = i;
  loadMem();
  applyVisuals();
  updateHUD(true);
  SFX.swap();
  spawnRing(
    G.player!.position.clone().add(new THREE.Vector3(0, 1, 0)),
    mem().accent,
    3,
  );

  const el = mem().element;
  const stats = calcStats();
  for (const s of G.entities.slimes) {
    if (s.dead || distXZ(s.mesh.position, G.player!.position) > 4) continue;
    const r = tryReaction(el, s);
    if (r) {
      dmgEnemy(s, stats.atk * r.m * 0.5, 5, 3, mem().accent);
      spawnParts(s.mesh.position.clone(), r.c, 18, 12);
      if (r.n === 'Frozen') s.frozenTimer = 2.5;
    }
  }
}

function distXZ(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export function updateTargetSel(): void {
  let best = null as typeof G.target;
  let bs = Infinity;
  const cf = new THREE.Vector3();
  G.cam!.getWorldDirection(cf);
  cf.y = 0;
  cf.normalize();
  for (const s of G.entities.slimes) {
    if (s.dead) continue;
    const fl = new THREE.Vector3(
      s.mesh.position.x - G.player!.position.x,
      0,
      s.mesh.position.z - G.player!.position.z,
    );
    const d = fl.length();
    if (d > 14 || d < 0.001) continue;
    fl.normalize();
    const a = cf.angleTo(fl);
    if (a > 0.9) continue;
    const sc = d + a * 8;
    if (sc < bs) {
      bs = sc;
      best = s;
    }
  }
  G.target = best;
}

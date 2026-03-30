import * as THREE from 'three';
import { G, mem, saveMem } from '../core/GameState';
import { ui } from './UIRefs';
import { SFX } from '../audio/Audio';
import { spawnDmg } from './DamageNumbers';
import { updateHUD } from './HUD';
import { getW, getA, getF, calcStats, canEnhance, getEnhanceCost, enhanceWeapon } from '../systems/Inventory';
import { getSubstats } from '../systems/ArtifactSubstats';
import type { Weapon, Artifact } from '../types';

/* ──── Comparison tooltip ──── */
let tooltipEl: HTMLElement | null = null;

function ensureTooltip(): HTMLElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'equipCompareTooltip';
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showCompare(el: HTMLElement, type: string, id: string): void {
  const tip = ensureTooltip();
  let html = '';
  if (type === 'weapon') {
    const item = getW(id);
    const cur = getW(G.inventory.equippedWeapon);
    if (!item) return;
    const diff = item.atk - (cur ? cur.atk : 0);
    const diffStr = diff > 0 ? `<span class="statUp">+${diff}</span>` : diff < 0 ? `<span class="statDown">${diff}</span>` : '<span class="statNeutral">±0</span>';
    html = `<div class="ttName">${item.icon} ${item.name}</div>
      <div class="ttType">${item.wtype?.toUpperCase() ?? 'SWORD'} · ${'★'.repeat(item.rarity)}</div>
      <div class="ttDesc">${item.desc}</div>
      <div class="ttDivider"></div>
      <div class="ttStat">ATK ${item.atk} ${cur && id !== G.inventory.equippedWeapon ? '(' + diffStr + ')' : ''}</div>`;
  } else if (type === 'artifact') {
    const item = getA(id);
    if (!item) return;
    const cur = getA(G.inventory.equippedArtifact || '');
    let diffHtml = '';
    if (cur && id !== G.inventory.equippedArtifact) {
      if (cur.stat === item.stat) {
        const d = item.val - cur.val;
        diffHtml = d > 0 ? `<span class="statUp">+${d}</span>` : d < 0 ? `<span class="statDown">${d}</span>` : '';
      } else {
        diffHtml = '<span class="statUp">NEW</span>';
      }
    }
    html = `<div class="ttName">${item.icon} ${item.name}</div>
      <div class="ttType">${'★'.repeat(item.rarity)}</div>
      <div class="ttDesc">${item.desc}</div>
      <div class="ttDivider"></div>
      <div class="ttStat">${item.stat.toUpperCase()} +${item.val} ${diffHtml}</div>
      ${getSubstats(id, item.stat, item.rarity).map(s => `<div class="ttStat" style="color:#8cf">${s.label} +${s.val}</div>`).join('')}`;
  } else if (type === 'food') {
    const item = getF(id);
    if (!item) return;
    html = `<div class="ttName">${item.icon} ${item.name}</div>
      <div class="ttDesc">${item.desc}</div>`;
  }
  tip.innerHTML = html;
  tip.style.display = 'block';

  const r = el.getBoundingClientRect();
  tip.style.left = r.right + 8 + 'px';
  tip.style.top = r.top + 'px';
  // Keep on screen
  const tr = tip.getBoundingClientRect();
  if (tr.right > innerWidth - 8) tip.style.left = (r.left - tr.width - 8) + 'px';
  if (tr.bottom > innerHeight - 8) tip.style.top = (innerHeight - tr.height - 8) + 'px';
}

function hideCompare(): void {
  if (tooltipEl) tooltipEl.style.display = 'none';
}

export function toggleInv(): void {
  G.invOpen = !G.invOpen;
  if (G.invOpen) {
    ui.inventoryOverlay.classList.add('show');
    G.isActive = false;
    if (!G.mobile && document.pointerLockElement) document.exitPointerLock();
    renderInv();
    SFX.menuOpen();
  } else {
    ui.inventoryOverlay.classList.remove('show');
    SFX.menuClose();
    if (G.hasStarted && G.health > 0) {
      if (G.mobile) G.isActive = true;
      else document.body.requestPointerLock();
    }
  }
}

export function renderInv(): void {
  const inv = G.inventory;
  const stats = calcStats();
  const w = getW(inv.equippedWeapon);
  const a = getA(inv.equippedArtifact || '');

  ui.invEquipSlots.innerHTML =
    `<div class="equipSlot"><div class="equipSlotIcon">${w ? w.icon : '—'}</div><div class="equipSlotInfo"><div class="equipSlotLabel">Weapon</div><div class="equipSlotName">${w ? w.name : 'None'}</div><div class="equipSlotStat">${w ? '+' + w.atk + ' ATK' : ''}</div></div></div>` +
    `<div class="equipSlot"><div class="equipSlotIcon">${a ? a.icon : '—'}</div><div class="equipSlotInfo"><div class="equipSlotLabel">Artifact</div><div class="equipSlotName">${a ? a.name : 'None'}</div><div class="equipSlotStat">${a ? a.desc : ''}</div></div></div>`;

  let wH2 = '';
  inv.weapons.forEach((id) => {
    const w = getW(id);
    if (!w) return;
    const wLv = G.weaponLevels[id] || 0;
    const lvStr = wLv > 0 ? ` Lv.${wLv}` : '';
    const enhCost = getEnhanceCost(id);
    const enhBtn = wLv < 10 ? `<button class="enhanceBtn" data-wid="${id}" title="Cost: ${enhCost} Mora" ${G.mora < enhCost ? 'disabled' : ''}>⬆</button>` : '';
    wH2 += `<div class="invItem rarity-${w.rarity} ${inv.equippedWeapon === id ? 'equipped' : ''}" data-type="weapon" data-id="${id}"><div class="invItemIcon">${w.icon}</div><div class="invItemName">${w.name}${lvStr}</div><div class="invItemStat">ATK+${w.atk + wLv * 3} ${enhBtn}</div></div>`;
  });
  ui.invWeapons.innerHTML =
    wH2 || '<div style="color:rgba(200,220,255,0.4);font-size:12px">Find weapons in chests!</div>';

  let aH = '';
  inv.artifacts.forEach((id) => {
    const a = getA(id);
    if (!a) return;
    aH += `<div class="invItem rarity-${a.rarity} ${inv.equippedArtifact === id ? 'equipped' : ''}" data-type="artifact" data-id="${id}"><div class="invItemIcon">${a.icon}</div><div class="invItemName">${a.name}</div><div class="invItemStat">${a.desc}</div></div>`;
  });
  ui.invArtifacts.innerHTML =
    aH || '<div style="color:rgba(200,220,255,0.4);font-size:12px">Find artifacts in chests!</div>';

  let fH = '';
  const fc: Record<string, number> = {};
  inv.food.forEach((id) => {
    fc[id] = (fc[id] || 0) + 1;
  });
  Object.entries(fc).forEach(([id, ct]) => {
    const f = getF(id);
    if (!f) return;
    fH += `<div class="invItem rarity-${f.rarity}" data-type="food" data-id="${id}"><div class="invItemIcon">${f.icon}</div><div class="invItemName">${f.name} ×${ct}</div><div class="invItemStat">HP+${f.heal === 999 ? 'MAX' : f.heal}</div></div>`;
  });
  ui.invFood.innerHTML =
    fH || '<div style="color:rgba(200,220,255,0.4);font-size:12px">No food</div>';

  ui.invStats.innerHTML = `<div style="font-size:12px;color:rgba(200,220,255,0.7);line-height:2"><div>ATK: <b style="color:#fff">${stats.atk}</b></div><div>HP: <b style="color:#fff">${mem().maxHp + stats.bonusHp}</b></div><div>Elem: <b style="color:#8ff">${Math.round(stats.elemDmg * 100)}%</b></div><div>Burst: <b style="color:#ffa">${Math.round(stats.burstDmg * 100)}%</b></div><div>Crit: <b style="color:#ff8">${Math.round(20 + stats.critBonus * 100)}%</b></div><div>Lv: <b>${G.lv}</b></div><div>Mora: <b style="color:#ffe89a">${G.mora}</b></div><div>Ore: <b style="color:#55ccff">${G.oreMaterials || 0}</b></div></div>`;

  ui.inventoryOverlay.querySelectorAll('.invItem').forEach((el) => {
    (el as HTMLElement).onclick = () => {
      const t = (el as HTMLElement).dataset.type;
      const id = (el as HTMLElement).dataset.id!;
      if (t === 'weapon') {
        inv.equippedWeapon = id;
        renderInv();
      } else if (t === 'artifact') {
        inv.equippedArtifact = inv.equippedArtifact === id ? null : id;
        renderInv();
      } else if (t === 'food') {
        const f = getF(id);
        if (!f) return;
        const idx = inv.food.indexOf(id);
        if (idx >= 0) inv.food.splice(idx, 1);
        const heal = f.heal === 999 ? G.maxHealth : f.heal;
        G.health = Math.min(G.maxHealth, G.health + heal);
        spawnDmg(
          G.player!.position.clone().add(new THREE.Vector3(0, 3, 0)),
          heal,
          '#78ff84',
          false,
          '+' + heal + ' HP',
        );
        SFX.heal();
        saveMem();
        renderInv();
        updateHUD(true);
      }
    };
    (el as HTMLElement).addEventListener('mouseenter', () => {
      const tp = (el as HTMLElement).dataset.type;
      showCompare(el as HTMLElement, tp!, (el as HTMLElement).dataset.id!);
    });
    (el as HTMLElement).addEventListener('mouseleave', hideCompare);
  });

  /* Weapon enhancement buttons */
  ui.inventoryOverlay.querySelectorAll('.enhanceBtn').forEach((btn) => {
    (btn as HTMLElement).onclick = (e) => {
      e.stopPropagation();
      const wid = (btn as HTMLElement).dataset.wid!;
      if (enhanceWeapon(wid)) {
        SFX.lvlUp();
        spawnDmg(G.player!.position.clone().add(new THREE.Vector3(0, 2, 0)), 0, '#ffe590', false, '⬆ Enhanced!');
        renderInv();
        updateHUD(true);
      }
    };
  });
}

import * as THREE from 'three';
import { G, mem, saveMem } from '../core/GameState';
import { ui } from './UIRefs';
import { SFX } from '../audio/Audio';
import { spawnDmg } from './DamageNumbers';
import { updateHUD } from './HUD';
import { getW, getA, getF, calcStats } from '../systems/Inventory';

export function toggleInv(): void {
  G.invOpen = !G.invOpen;
  if (G.invOpen) {
    ui.inventoryOverlay.classList.add('show');
    G.isActive = false;
    if (!G.mobile && document.pointerLockElement) document.exitPointerLock();
    renderInv();
  } else {
    ui.inventoryOverlay.classList.remove('show');
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
    wH2 += `<div class="invItem rarity-${w.rarity} ${inv.equippedWeapon === id ? 'equipped' : ''}" data-type="weapon" data-id="${id}"><div class="invItemIcon">${w.icon}</div><div class="invItemName">${w.name}</div><div class="invItemStat">ATK+${w.atk}</div></div>`;
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

  ui.invStats.innerHTML = `<div style="font-size:12px;color:rgba(200,220,255,0.7);line-height:2"><div>ATK: <b style="color:#fff">${stats.atk}</b></div><div>HP: <b style="color:#fff">${mem().maxHp + stats.bonusHp}</b></div><div>Elem: <b style="color:#8ff">${Math.round(stats.elemDmg * 100)}%</b></div><div>Burst: <b style="color:#ffa">${Math.round(stats.burstDmg * 100)}%</b></div><div>Crit: <b style="color:#ff8">${Math.round(20 + stats.critBonus * 100)}%</b></div><div>Lv: <b>${G.lv}</b></div><div>Mora: <b style="color:#ffe89a">${G.mora}</b></div></div>`;

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
  });
}

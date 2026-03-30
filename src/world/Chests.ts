import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh, mkLight, mkPointLight, rwp, clamp, mkCelMat, mkCelEmissiveMat } from '../core/Helpers';
import { ui } from '../ui/UIRefs';
import type { ChestLoot } from '../types';
import { SFX } from '../audio/Audio';
import { spawnParts, spawnRing } from '../systems/Particles';
import { spawnDmg } from '../ui/DamageNumbers';
import { gainXp } from '../systems/Progression';
import { saveMem } from '../core/GameState';
import { updateHUD } from '../ui/HUD';
import { getW, getA, getF } from '../systems/Inventory';
import { onChestOpened } from '../systems/Commissions';

/* Rarity color map: 3★ blue, 4★ purple, 5★ gold */
const RARITY_COLORS: Record<number, string> = {
  3: '#5599ff',
  4: '#cc77ff',
  5: '#ffaa00',
};
const RARITY_HEX: Record<number, number> = {
  3: 0x5599ff,
  4: 0xcc77ff,
  5: 0xffaa00,
};

const CHEST_LOOT: ChestLoot[] = [
  { t: 'weapon', id: 'w2' },
  { t: 'weapon', id: 'w3' },
  { t: 'artifact', id: 'a1' },
  { t: 'artifact', id: 'a2' },
  { t: 'artifact', id: 'a3' },
  { t: 'artifact', id: 'a4' },
  { t: 'artifact', id: 'a5' },
  { t: 'artifact', id: 'a6' },
  { t: 'food', id: 'f2' },
  { t: 'food', id: 'f2' },
  { t: 'food', id: 'f1' },
  { t: 'food', id: 'f1' },
  { t: 'food', id: 'f3' },
  { t: 'food', id: 'f2' },
];

export function populateChests(count: number): void {
  const bodyMat = mkCelMat(0xc4a35a, 0xb4934a, 0);
  const lidMat = mkCelMat(0xd4b36a, 0xc4a35a, 0);
  const trimMat = mkCelMat(0x886622, 0x775518, 0);
  const lockMat = mkCelEmissiveMat(0xffcc00, 0xaa8800, 0.6);

  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(16, 115, 0);
    const ch = new THREE.Group();
    ch.add(mkMesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), bodyMat, 0, 0.35, 0));
    ch.add(mkMesh(new THREE.BoxGeometry(1.25, 0.3, 0.85), lidMat, 0, 0.85, 0));
    ch.add(mkMesh(new THREE.BoxGeometry(1.3, 0.06, 0.9), trimMat, 0, 0.7, 0));
    /* Side trim bands */
    ch.add(mkMesh(new THREE.BoxGeometry(0.06, 0.72, 0.82), trimMat, -0.6, 0.36, 0));
    ch.add(mkMesh(new THREE.BoxGeometry(0.06, 0.72, 0.82), trimMat, 0.6, 0.36, 0));
    /* Lock/clasp */
    ch.add(mkMesh(new THREE.BoxGeometry(0.15, 0.25, 0.15), lockMat, 0, 0.55, 0.42));
    const lootItem = CHEST_LOOT[i % CHEST_LOOT.length];
    /* Determine rarity for chest glow color */
    let rarity = 3;
    if (lootItem.t === 'weapon') { const w = getW(lootItem.id); if (w) rarity = w.rarity; }
    else if (lootItem.t === 'artifact') { const a = getA(lootItem.id); if (a) rarity = a.rarity; }
    else if (lootItem.t === 'food') { const f = getF(lootItem.id); if (f) rarity = f.rarity; }
    const glowColor = RARITY_HEX[rarity] || 0xffdd66;
    ch.add(mkLight(glowColor, 0.4, 8, 0, 1, 0));
    ch.position.set(x, y, z);
    ch.rotation.y = Math.random() * Math.PI * 2;
    ch.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    G.scene!.add(ch);
    G.entities.chests.push({
      mesh: ch,
      opened: false,
      mora: 30 + Math.floor(Math.random() * 50),
      xp: 15 + Math.floor(Math.random() * 20),
      loot: CHEST_LOOT[i % CHEST_LOOT.length],
    });
  }
}

/* Cached geometry for chest opening beam effect */
const _beamGeo = new THREE.CylinderGeometry(0.15, 0.6, 6, 8, 1, true);
/* Cached reusable offset vector */
const _chestOffset = new THREE.Vector3();

export function openChest(ch: (typeof G.entities.chests)[number]): void {
  ch.opened = true;
  SFX.chest();
  onChestOpened();

  const cPos = ch.mesh.position.clone();

  /* ── Animated lid opening ── */
  const lid = ch.mesh.children[1];
  if (lid) {
    const startRot = lid.rotation.x;
    const startY = lid.position.y;
    const startZ = lid.position.z;
    const dur = 500;
    const t0 = performance.now();
    const animateLid = () => {
      const p = clamp((performance.now() - t0) / dur, 0, 1);
      const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
      lid.rotation.x = startRot + (-1.2 - startRot) * ease;
      lid.position.y = startY + (1.1 - startY) * ease;
      lid.position.z = startZ + (-0.3 - startZ) * ease;
      if (p < 1) requestAnimationFrame(animateLid);
    };
    requestAnimationFrame(animateLid);
  }

  /* ── Golden light beam ── */
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(_beamGeo, beamMat);
  _chestOffset.set(0, 4, 0);
  beam.position.copy(cPos).add(_chestOffset);
  G.scene!.add(beam);

  /* ── Golden point light ── */
  const glow = mkPointLight(0xffdd44, 3, 12);
  _chestOffset.set(0, 2, 0);
  glow.position.copy(cPos).add(_chestOffset);
  G.scene!.add(glow);

  /* ── Expanding golden ring ── */
  _chestOffset.set(0, 0.3, 0);
  spawnRing(cPos.clone().add(_chestOffset), '#ffdd44', 3);

  /* ── Burst particles ── */
  _chestOffset.set(0, 1.5, 0);
  spawnParts(cPos.clone().add(_chestOffset), '#ffdd44', 40, 16);
  const cPosStored = cPos.clone();
  setTimeout(() => spawnParts(_chestOffset.set(0, 2.0, 0).add(cPosStored), '#ffffcc', 20, 10), 200);

  /* ── Fade out beam & light ── */
  const fadeStart = performance.now() + 600;
  const fadeDur = 800;
  const fadeBeam = () => {
    const p = clamp((performance.now() - fadeStart) / fadeDur, 0, 1);
    beamMat.opacity = 0.45 * (1 - p);
    (glow.material as THREE.SpriteMaterial).opacity = 1 - p;
    beam.scale.set(1 + p * 0.3, 1 - p * 0.2, 1 + p * 0.3);
    if (p < 1) {
      requestAnimationFrame(fadeBeam);
    } else {
      G.scene!.remove(beam);
      G.scene!.remove(glow);
      beamMat.dispose();
      (glow.material as THREE.SpriteMaterial).dispose();
    }
  };
  requestAnimationFrame(fadeBeam);

  /* ── Rewards (staggered reveal) ── */
  G.mora += ch.mora;
  gainXp(ch.xp);
  setTimeout(() => {
    spawnDmg(cPos.clone().add(new THREE.Vector3(0, 2, 0)), ch.mora, '#ffdd44', false, '+' + ch.mora + ' Mora');
  }, 350);

  if (ch.loot) {
    const { t: type, id } = ch.loot;
    if (type === 'weapon' && !G.inventory.weapons.includes(id)) {
      G.inventory.weapons.push(id);
      const w = getW(id);
      const rc = w ? (RARITY_COLORS[w.rarity] || '#6af') : '#6af';
      const stars = w ? '★'.repeat(w.rarity) + ' ' : '';
      setTimeout(() => {
        spawnParts(cPos.clone().add(new THREE.Vector3(0, 2.5, 0)), rc, 15, 10);
        spawnDmg(cPos.clone().add(new THREE.Vector3(0, 3, 0)), 0, rc, false, stars + (w ? w.name : 'New Weapon!'));
        SFX.pickup();
      }, 700);
    } else if (type === 'artifact' && !G.inventory.artifacts.includes(id)) {
      G.inventory.artifacts.push(id);
      const a = getA(id);
      const rc = a ? (RARITY_COLORS[a.rarity] || '#c8f') : '#c8f';
      const stars = a ? '★'.repeat(a.rarity) + ' ' : '';
      setTimeout(() => {
        spawnParts(cPos.clone().add(new THREE.Vector3(0, 2.5, 0)), rc, 15, 10);
        spawnDmg(cPos.clone().add(new THREE.Vector3(0, 3, 0)), 0, rc, false, stars + (a ? a.name : 'New Artifact!'));
        SFX.pickup();
      }, 700);
    } else if (type === 'food') {
      G.inventory.food.push(id);
      SFX.pickup();
    }
  }

  setTimeout(() => {
    G.health = Math.min(G.maxHealth, G.health + 15);
    SFX.heal();
    spawnParts(cPos.clone().add(new THREE.Vector3(0, 1, 0)), '#88ff88', 10, 8);
    updateHUD(true);
  }, 500);
}

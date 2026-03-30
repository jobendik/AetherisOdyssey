import * as THREE from 'three';
import { ui } from '../ui/UIRefs';
import { G } from '../core/GameState';
import type { EnemyEntity, ElementType } from '../types';
import { REACTIONS } from '../data/ReactionData';
import { SFX } from '../audio/Audio';
import { spawnParts } from '../systems/Particles';
import { wH, legacyLightIntensity } from '../core/Helpers';

export function tryReaction(el: ElementType, e: EnemyEntity) {
  if (!e.appliedEl || e.appliedEl === el) {
    if (el !== 'Anemo') {
      e.appliedEl = el;
      e.elTimer = 6;
    }
    return null;
  }
  const r = REACTIONS[el + '+' + e.appliedEl];
  if (r) {
    e.appliedEl = null;
    e.elTimer = 0;
    showReaction(r.n, r.c);
    SFX.reaction();
    return r;
  }
  e.appliedEl = el;
  e.elTimer = 6;
  return null;
}

export function showReaction(n: string, c: string): void {
  const b = ui.reactionBanner;
  b.textContent = n;
  b.style.color = c;
  b.style.setProperty('--rcolor', c);
  b.style.animation = 'none';
  b.offsetHeight; // force reflow
  b.style.animation = 'reactionPop 1.2s ease-out forwards';
}

/* ──── Environmental element reactions ──── */
export function envReaction(pos: THREE.Vector3, el: ElementType, radius = 4): void {
  const y = wH(pos.x, pos.z);

  if (el === 'Pyro') {
    /* Burn grass — spawn fire embers on ground */
    for (let i = 0; i < 12; i++) {
      const ox = (Math.random() - 0.5) * radius * 2;
      const oz = (Math.random() - 0.5) * radius * 2;
      const gy = wH(pos.x + ox, pos.z + oz);
      if (gy < -1) continue; // skip water
      spawnParts(new THREE.Vector3(pos.x + ox, gy + 0.2, pos.z + oz), '#ff6622', 3, 8);
    }
    /* Scorch mark on ground */
    const scorchGeo = new THREE.CircleGeometry(radius * 0.6, 16);
    const scorchMat = new THREE.MeshBasicMaterial({
      color: 0x221100,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const scorch = new THREE.Mesh(scorchGeo, scorchMat);
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(pos.x, y + 0.05, pos.z);
    G.scene!.add(scorch);
    /* Damage enemies standing in fire */
    for (const s of G.entities.slimes) {
      if (s.dead) continue;
      const d = Math.sqrt((s.mesh.position.x - pos.x) ** 2 + (s.mesh.position.z - pos.z) ** 2);
      if (d < radius && s.appliedEl !== 'Pyro') {
        s.appliedEl = 'Pyro';
        s.elTimer = 4;
      }
    }
    /* Fade out scorch */
    setTimeout(() => {
      const t0 = performance.now();
      const fade = () => {
        const p = (performance.now() - t0) / 3000;
        if (p >= 1) {
          G.scene!.remove(scorch);
          scorchGeo.dispose();
          scorchMat.dispose();
          return;
        }
        scorchMat.opacity = 0.35 * (1 - p);
        requestAnimationFrame(fade);
      };
      requestAnimationFrame(fade);
    }, 4000);
  }

  if (el === 'Cryo') {
    /* Freeze puddles — spawn ice crystals if near water */
    const isNearWater = y < 0.5;
    if (isNearWater) {
      const iceGeo = new THREE.CircleGeometry(radius * 0.8, 6);
      const iceMat = new THREE.MeshBasicMaterial({
        color: 0xaaddff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ice = new THREE.Mesh(iceGeo, iceMat);
      ice.rotation.x = -Math.PI / 2;
      ice.position.set(pos.x, -2.9, pos.z);
      G.scene!.add(ice);
      spawnParts(new THREE.Vector3(pos.x, -2.5, pos.z), '#88ccff', 15, 10);
      /* Melt after 5 seconds */
      setTimeout(() => {
        const t0 = performance.now();
        const melt = () => {
          const p = (performance.now() - t0) / 2000;
          if (p >= 1) {
            G.scene!.remove(ice);
            iceGeo.dispose();
            iceMat.dispose();
            return;
          }
          iceMat.opacity = 0.5 * (1 - p);
          requestAnimationFrame(melt);
        };
        requestAnimationFrame(melt);
      }, 5000);
    }
    /* Frost particles on ground */
    spawnParts(new THREE.Vector3(pos.x, y + 0.3, pos.z), '#ccddff', 12, 8);
  }

  if (el === 'Electro') {
    /* Electric charge — spark particles and brief light */
    spawnParts(new THREE.Vector3(pos.x, y + 0.5, pos.z), '#cc66ff', 16, 12);
    const light = new THREE.PointLight(0x9966ff, legacyLightIntensity(2), 8);
    light.position.set(pos.x, y + 1.5, pos.z);
    G.scene!.add(light);
    /* Chain damage nearby enemies */
    for (const s of G.entities.slimes) {
      if (s.dead) continue;
      const d = Math.sqrt((s.mesh.position.x - pos.x) ** 2 + (s.mesh.position.z - pos.z) ** 2);
      if (d < radius) {
        s.appliedEl = 'Electro';
        s.elTimer = 4;
        spawnParts(s.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), '#cc66ff', 5, 6);
      }
    }
    /* If on water, bigger spread */
    if (y < 0.5) {
      spawnParts(new THREE.Vector3(pos.x, -2.5, pos.z), '#bb88ff', 20, 14);
    }
    /* Remove light */
    setTimeout(() => G.scene!.remove(light), 300);
  }

  if (el === 'Hydro') {
    /* Splash particles */
    spawnParts(new THREE.Vector3(pos.x, y + 0.3, pos.z), '#4488ff', 14, 10);
  }

  if (el === 'Anemo') {
    /* Wind swirl — push particles outward */
    spawnParts(new THREE.Vector3(pos.x, y + 0.5, pos.z), '#66ffcc', 18, 12);
  }
}

import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { PARTY } from '../data/PartyData';
import { ui } from '../ui/UIRefs';
import { spawnParts, spawnRing } from './Particles';
import { SFX } from '../audio/Audio';
import { trigShake, Shake } from '../combat/DamageSystem';

export const ASCENSION_LEVELS = [20, 40, 60, 80];

export function gainXp(a: number): void {
  G.xp += a;
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.lv++;
    G.xpNext = Math.floor(50 * Math.pow(1.25, G.lv - 1));
    PARTY.forEach((m) => {
      m.maxHp += 8;
      m.hp = m.maxHp;
      m.baseDmg += 1;
    });
    /* Ascension milestones */
    if (ASCENSION_LEVELS.includes(G.lv)) {
      const tier = ASCENSION_LEVELS.indexOf(G.lv) + 1;
      PARTY.forEach((m) => {
        m.maxHp += 20 * tier;
        m.hp = m.maxHp;
        m.baseDmg += 3 * tier;
      });
      trigAscension(tier);
    }
    G.health = G.maxHealth = mem().maxHp;
    trigLvUp();
  }
  ui.xpBarFill.style.width = (G.xp / G.xpNext) * 100 + '%';
}

function trigAscension(tier: number): void {
  SFX.lvlUp();
  const label = document.createElement('div');
  label.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);font-size:28px;font-weight:bold;color:#ffe590;text-shadow:0 0 20px #ffb800,0 0 40px #ff8800;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.4s;';
  label.textContent = `⭐ Ascension ${tier} Reached! ⭐`;
  document.body.appendChild(label);
  requestAnimationFrame(() => (label.style.opacity = '1'));
  setTimeout(() => {
    label.style.opacity = '0';
    setTimeout(() => label.remove(), 500);
  }, 3000);

  const p = G.player!.position.clone();
  spawnParts(p.clone().add(new THREE.Vector3(0, 2, 0)), '#ffb800', 60, 20);
  spawnRing(p.clone(), '#ffb800', 8);
  setTimeout(() => spawnRing(p.clone().add(new THREE.Vector3(0, 0.5, 0)), '#ffe590', 6), 300);
  Shake.medium();
}

function trigLvUp(): void {
  SFX.lvlUp();
  ui.levelUpSub.textContent = 'Level ' + G.lv;
  ui.levelUpOverlay.classList.add('show');
  setTimeout(() => ui.levelUpOverlay.classList.remove('show'), 2200);

  const p = G.player!.position.clone();

  /* Golden particle burst */
  spawnParts(p.clone().add(new THREE.Vector3(0, 1.5, 0)), '#ffe590', 40, 16);

  /* Expanding ring at feet */
  spawnRing(p.clone().add(new THREE.Vector3(0, 0.2, 0)), '#ffe590', 5);

  /* Secondary ascending sparkle ring */
  setTimeout(() => {
    spawnRing(p.clone().add(new THREE.Vector3(0, 1.0, 0)), '#fffce0', 3);
    spawnParts(p.clone().add(new THREE.Vector3(0, 2.5, 0)), '#ffffff', 20, 10);
  }, 200);

  /* Screen shake + flash */
  Shake.medium();

  /* Level-up screen flash */
  const flash = ui.burstFlash;
  if (flash) {
    flash.style.background = 'radial-gradient(ellipse at center, rgba(255,229,144,0.5), transparent 70%)';
    flash.style.opacity = '1';
    flash.style.animation = 'none';
    void flash.offsetWidth;
    flash.style.animation = 'burstFlashAnim 0.6s ease-out forwards';
  }
}

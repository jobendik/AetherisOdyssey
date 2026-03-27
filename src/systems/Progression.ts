import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { PARTY } from '../data/PartyData';
import { ui } from '../ui/UIRefs';
import { spawnParts } from './Particles';
import { SFX } from '../audio/Audio';

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
    G.health = G.maxHealth = mem().maxHp;
    trigLvUp();
  }
  ui.xpBarFill.style.width = (G.xp / G.xpNext) * 100 + '%';
}

function trigLvUp(): void {
  SFX.lvlUp();
  ui.levelUpSub.textContent = 'Level ' + G.lv;
  ui.levelUpOverlay.classList.add('show');
  setTimeout(() => ui.levelUpOverlay.classList.remove('show'), 2200);
  spawnParts(
    G.player!.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
    '#ffe590',
    40,
    16,
  );
}

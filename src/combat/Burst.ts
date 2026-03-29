import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { clamp, distXZ, rnd } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { spawnParts, spawnRing } from '../systems/Particles';
import { spawnDmg } from '../ui/DamageNumbers';
import { tryReaction, envReaction } from './Reactions';
import { dmgEnemy, trigShake, Shake } from './DamageSystem';
import { addCombo } from './Combo';
import { calcStats } from '../systems/Inventory';
import { updateHUD } from '../ui/HUD';
import { ui } from '../ui/UIRefs';

export function useBurst(): void {
  if (G.burstCd > 0 || G.inDialogue || G.burstEnergy < 100) return;
  const m = mem();
  const stats = calcStats();
  G.burstCd = m.burstCdMax;
  G.burstTimer = 0.8;
  G.burstEnergy = 0;
  SFX.burst();
  SFX.barkBurst();

  /* Cinematic burst flash */
  ui.burstFlash.style.background = `radial-gradient(circle at center, ${m.burst}cc 0%, transparent 70%)`;
  ui.burstFlash.classList.add('active');
  setTimeout(() => ui.burstFlash.classList.remove('active'), 400);

  spawnRing(G.player!.position.clone().add(new THREE.Vector3(0, 1, 0)), m.burst, m.burstRadius);
  spawnParts(G.player!.position.clone().add(new THREE.Vector3(0, 1, 0)), m.burst, 42, 20);

  if (m.burstType === 'tornado') {
    G.tornadoTimer = m.burstDur;
    G.tornadoPos = G.player!.position.clone();
  } else {
    for (const s of G.entities.slimes) {
      if (s.dead || distXZ(s.mesh.position, G.player!.position) >= m.burstRadius) continue;
      let dmg = stats.atk * m.burstDmgMult * stats.elemDmg * stats.burstDmg;
      const rxn = tryReaction(m.element, s);
      if (rxn) {
        dmg *= rxn.m;
        spawnDmg(
          s.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)),
          0,
          rxn.c,
          false,
          rxn.n,
        );
      }
      if (m.burstType === 'blizzard') s.frozenTimer = 3.5;
      const aw = s.mesh.position.clone().sub(G.player!.position).normalize();
      dmgEnemy(
        s,
        dmg,
        m.burstType === 'meteor' ? 40 : 32,
        m.burstType === 'meteor' ? 15 : 11,
        m.burst,
        aw,
        true,
      );
      addCombo();
    }
    if (m.burstType === 'blizzard') {
      G.health = Math.min(G.maxHealth, G.health + 30);
      spawnDmg(
        G.player!.position.clone().add(new THREE.Vector3(0, 3, 0)),
        30,
        '#78ff84',
        false,
        '+30 HP',
      );
      SFX.heal();
    }
  }
  Shake.massive();
  envReaction(G.player!.position.clone(), m.element, m.burstRadius);
  G.hitstop = 0.1;
  updateHUD(true);
}

export function updateTornado(dt: number): void {
  if (G.tornadoTimer <= 0) return;
  G.tornadoTimer -= dt;
  const stats = calcStats();
  const m = mem();
  spawnParts(
    G.tornadoPos!.clone().add(new THREE.Vector3(rnd(-3, 3), rnd(0, 4), rnd(-3, 3))),
    m.burst,
    2,
    4,
  );
  for (const s of G.entities.slimes) {
    if (s.dead || distXZ(s.mesh.position, G.tornadoPos!) >= m.burstRadius) continue;
    const tw = G.tornadoPos!.clone().sub(s.mesh.position).setY(0).normalize();
    s.vel.x += tw.x * 20 * dt;
    s.vel.z += tw.z * 20 * dt;
    s.vel.y += 8 * dt;
    if (Math.random() < dt * 3) {
      const dmg = stats.atk * m.burstDmgMult * 0.15 * stats.elemDmg * stats.burstDmg;
      dmgEnemy(s, dmg, 0, 3, m.burst);
      addCombo();
    }
  }
}

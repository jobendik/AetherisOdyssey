import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { clamp, distXZ } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { spawnParts, spawnRing } from '../systems/Particles';
import { spawnDmg } from '../ui/DamageNumbers';
import { tryReaction } from './Reactions';
import { dmgEnemy, trigShake } from './DamageSystem';
import { addCombo } from './Combo';
import { calcStats } from '../systems/Inventory';
import { updateHUD } from '../ui/HUD';

export function useSkill(): void {
  if (G.skillCd > 0 || G.inDialogue) return;
  const m = mem();
  const stats = calcStats();
  G.skillCd = m.skillCdMax;
  SFX.skill();

  if (m.skillType === 'vortex') {
    spawnRing(G.player!.position.clone().add(new THREE.Vector3(0, 1, 0)), m.accent, m.skillRadius);
    for (const s of G.entities.slimes) {
      if (s.dead || distXZ(s.mesh.position, G.player!.position) >= m.skillRadius) continue;
      const tw = G.player!.position.clone().sub(s.mesh.position).setY(0).normalize();
      s.vel.x = tw.x * 15;
      s.vel.z = tw.z * 15;
      s.vel.y = 6;
      let dmg = stats.atk * m.skillDmgMult * stats.elemDmg;
      const rxn = tryReaction(m.element, s);
      if (rxn) dmg *= rxn.m;
      dmgEnemy(s, dmg, 0, 6, m.accent);
      addCombo();
    }
  } else if (m.skillType === 'bolt') {
    let tgt = G.target;
    if (!tgt || tgt.dead) {
      for (const s of G.entities.slimes) {
        if (!s.dead && distXZ(s.mesh.position, G.player!.position) < m.skillRadius) {
          tgt = s;
          break;
        }
      }
    }
    if (tgt && !tgt.dead) {
      let dmg = stats.atk * m.skillDmgMult * stats.elemDmg;
      const rxn = tryReaction(m.element, tgt);
      if (rxn) dmg *= rxn.m;
      dmgEnemy(tgt, dmg, 10, 8, m.accent, null, true);
      addCombo();
      trigShake(0.4, 0.15);
      for (const s of G.entities.slimes) {
        if (s === tgt || s.dead || distXZ(s.mesh.position, tgt.mesh.position) >= 6) continue;
        dmgEnemy(s, dmg * 0.4, 5, 3, '#c393ff');
        addCombo();
      }
    }
  } else if (m.skillType === 'shield') {
    G.shield = 40 + stats.bonusHp * 0.5;
    G.maxShield = G.shield;
    G.shieldTimer = 8;
    SFX.shield();
    spawnParts(G.player!.position.clone().add(new THREE.Vector3(0, 1.5, 0)), '#8fe9ff', 20, 10);
    spawnRing(G.player!.position.clone().add(new THREE.Vector3(0, 0.5, 0)), '#8fe9ff', 2.5);
    for (const s of G.entities.slimes) {
      if (!s.dead && distXZ(s.mesh.position, G.player!.position) < 4) tryReaction(m.element, s);
    }
  } else if (m.skillType === 'dash') {
    const fwd = new THREE.Vector3(0, 0, -1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), G.playerModel!.rotation.y)
      .normalize();
    G.pVel.x = fwd.x * 25;
    G.pVel.z = fwd.z * 25;
    G.invulnTimer = 0.3;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        spawnParts(G.player!.position.clone().add(new THREE.Vector3(0, 0.5, 0)), '#ffb06b', 6, 8);
        for (const s of G.entities.slimes) {
          if (s.dead || distXZ(s.mesh.position, G.player!.position) >= m.skillRadius) continue;
          const dmg = stats.atk * m.skillDmgMult * stats.elemDmg * 0.3;
          dmgEnemy(s, dmg, 8, 4, m.accent);
          addCombo();
        }
      }, i * 60);
    }
  }
  trigShake(0.4, 0.15);
  G.burstEnergy = clamp(G.burstEnergy + 15, 0, 100);
  updateHUD(true);
}

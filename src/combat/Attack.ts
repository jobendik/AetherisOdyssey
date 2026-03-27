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

export function performAttack(): void {
  if (G.atkTimer > 0 || G.inDialogue || G.isGliding || G.isDashing) return;
  const m = mem();
  const stats = calcStats();
  G.atkTimer = 0.35 / m.normalSpeed;
  G.atkCombo++;
  G.swordPivot!.visible = true;
  G.swordPivot!.rotation.set(
    -Math.PI / 2,
    0,
    G.atkCombo % 2 === 0 ? Math.PI / 4 : -Math.PI / 4,
  );
  SFX.swing(G.atkCombo);

  const el = m.element;
  const fwd = new THREE.Vector3(0, 0, -1)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), G.playerModel!.rotation.y)
    .normalize();

  let hitAny = false;
  for (const s of G.entities.slimes) {
    if (s.dead || (s.frozenTimer > 0.5 && !s.isBoss)) continue;
    const fl = new THREE.Vector3(
      s.mesh.position.x - G.player!.position.x,
      0,
      s.mesh.position.z - G.player!.position.z,
    );
    const d = fl.length();
    if (d < 0.001 || d > (s.isBoss ? 5.5 : m.normalRange)) continue;
    fl.normalize();
    if (fwd.angleTo(fl) > m.normalArc) continue;

    if (s.shieldHp > 0) {
      s.shieldHp -= stats.atk;
      spawnDmg(
        s.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)),
        stats.atk,
        '#aaaaff',
        false,
        'Shield',
      );
      if (s.shieldHp <= 0) {
        s.shieldHp = 0;
        spawnDmg(
          s.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
          0,
          '#fff',
          false,
          'BREAK!',
        );
        trigShake(0.4, 0.15);
        if (
          s.mesh.children[2] &&
          (s.mesh.children[2] as THREE.Mesh).material
        ) {
          (
            (s.mesh.children[2] as THREE.Mesh).material as THREE.MeshStandardMaterial
          ).opacity = 0.2;
        }
      }
      continue;
    }

    const crit = Math.random() < 0.2 + stats.critBonus;
    let dmg = stats.atk * (crit ? 2 : 1) * G.comboMult;
    const rxn = tryReaction(el, s);
    if (rxn) {
      dmg *= rxn.m * stats.elemDmg;
      spawnDmg(
        s.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0)),
        0,
        rxn.c,
        false,
        rxn.n,
      );
      spawnParts(s.mesh.position.clone(), rxn.c, 24, 16);
      trigShake(0.5, 0.2);
      if (rxn.n === 'Frozen') s.frozenTimer = 2.5;
      if (rxn.n === 'Overloaded') {
        const aw = s.mesh.position.clone().sub(G.player!.position).normalize();
        s.vel.x = aw.x * 30;
        s.vel.z = aw.z * 30;
        s.vel.y = 14;
      }
    }
    dmgEnemy(
      s,
      dmg,
      s.isBoss ? 5 : 19,
      s.isBoss ? 3 : 6,
      crit ? '#ffff44' : m.accent,
      null,
      crit,
    );
    G.burstEnergy = clamp(G.burstEnergy + 8, 0, 100);
    hitAny = true;
    addCombo();
    if (crit) {
      SFX.crit();
      trigShake(0.3, 0.12);
    }
    if (stats.healOnHit > 0) {
      const h = Math.round(G.maxHealth * stats.healOnHit);
      G.health = Math.min(G.maxHealth, G.health + h);
    }
    G.hitstop = crit ? 0.06 : 0.03;
  }
  if (hitAny) updateHUD(true);
}

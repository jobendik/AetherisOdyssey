import * as THREE from 'three';
import { G, mem, saveMem, loadMem } from '../core/GameState';
import { clamp, distXZ, rnd } from '../core/Helpers';
import { PARTY } from '../data/PartyData';
import { ENEMY_TYPES } from '../data/EnemyData';
import { SFX } from '../audio/Audio';
import { ui } from '../ui/UIRefs';
import { spawnParts, spawnRing } from '../systems/Particles';
import { spawnDmg } from '../ui/DamageNumbers';
import { resetCombo } from './Combo';
import { gainXp } from '../systems/Progression';
import { updateHUD } from '../ui/HUD';
import { createEnemy } from '../entities/Enemy';
import { rwp, wH } from '../core/Helpers';
import type { EnemyEntity } from '../types';

export function trigShake(i = 0.3, d = 0.15): void {
  G.screenShake = i;
  G.shakeDecay = d;
}

export function dmgEnemy(
  s: EnemyEntity,
  amt: number,
  kxz: number,
  ky: number,
  color: string,
  dir?: THREE.Vector3 | null,
  crit?: boolean,
): void {
  s.hp -= amt;
  s.hurtTimer = 0.22;
  const d =
    dir || s.mesh.position.clone().sub(G.player!.position).setY(0).normalize();
  if (Number.isFinite(d.x) && Number.isFinite(d.z)) {
    s.vel.x = d.x * kxz;
    s.vel.z = d.z * kxz;
  }
  s.vel.y = ky;
  spawnParts(s.mesh.position.clone(), color, 14, 14);
  spawnDmg(
    s.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
    amt,
    crit ? '#ffff44' : color,
    crit,
  );
  SFX.hit();

  if (s.hp <= 0) {
    s.dead = true;
    s.mesh.visible = false;
    spawnParts(s.mesh.position.clone(), '#ff6b86', 28, 18);
    G.burstEnergy = clamp(G.burstEnergy + 20, 0, 100);
    G.enemiesKilled++;

    const et = ENEMY_TYPES[s.archetype];
    const moraAmt = s.isBoss ? 300 : et.mora + s.level * 2;
    const xpAmt = s.isBoss ? 150 : et.xp + s.level * 2;
    G.mora += moraAmt;
    gainXp(xpAmt);
    spawnDmg(
      s.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)),
      moraAmt,
      '#ffdd44',
      false,
      '+' + moraAmt + ' Mora',
    );

    if (Math.random() < 0.35) {
      G.health = Math.min(G.maxHealth, G.health + 10);
      setTimeout(() => {
        spawnDmg(
          G.player!.position.clone().add(new THREE.Vector3(0, 3, 0)),
          10,
          '#78ff84',
          false,
          '+10 HP',
        );
        SFX.heal();
      }, 400);
    }

    if (s.isBoss) {
      trigShake(1.2, 0.5);
      G.bossActive = false;
      G.questPhase = 4;
      ui.objectiveText.textContent = 'Victory!';
      ui.objectiveSubtext.textContent = 'Return to the Guide.';

      if (!G.inventory.weapons.includes('w4')) {
        G.inventory.weapons.push('w4');
        setTimeout(
          () =>
            spawnDmg(
              s.mesh.position.clone().add(new THREE.Vector3(0, 4, 0)),
              0,
              '#ffa',
              false,
              '★★★★★ Jade Cutter!',
            ),
          800,
        );
      }
      if (!G.inventory.weapons.includes('w5')) {
        G.inventory.weapons.push('w5');
        setTimeout(
          () =>
            spawnDmg(
              s.mesh.position.clone().add(new THREE.Vector3(0, 4.5, 0)),
              0,
              '#ffa',
              false,
              '★★★★★ Skyward!',
            ),
          1200,
        );
      }
      if (!G.inventory.artifacts.includes('a5')) {
        G.inventory.artifacts.push('a5');
        setTimeout(
          () =>
            spawnDmg(
              s.mesh.position.clone().add(new THREE.Vector3(0, 5, 0)),
              0,
              '#ffa',
              false,
              '★★★★★ Noblesse!',
            ),
          1600,
        );
      }
    }

    if (G.enemiesKilled % 10 === 0 && !s.isBoss) {
      G.waveCount++;
      const archs: Array<'slime' | 'archer' | 'wisp' | 'shield'> = [
        'slime',
        'slime',
        'archer',
        'wisp',
        'shield',
      ];
      for (let i = 0; i < 4 + G.waveCount; i++) {
        const pt = rwp(30, 100, 0);
        createEnemy(pt.x, pt.y, pt.z, archs[i % archs.length]);
      }
    }
    updateHUD(true);
  }
}

export function takeDamage(amt: number, src?: THREE.Vector3): void {
  if (G.invulnTimer > 0 || G.health <= 0) return;

  if (G.shield > 0) {
    G.shield -= amt;
    if (G.shield <= 0) {
      const rem = -G.shield;
      G.shield = 0;
      G.shieldTimer = 0;
      spawnDmg(
        G.player!.position.clone().add(new THREE.Vector3(0, 3.5, 0)),
        0,
        '#8fe9ff',
        false,
        'Shield Break!',
      );
      if (rem > 0) amt = rem;
      else return;
    } else {
      spawnDmg(
        G.player!.position.clone().add(new THREE.Vector3(0, 3, 0)),
        amt,
        '#8fe9ff',
        false,
        'Blocked',
      );
      return;
    }
  }

  G.health = Math.max(0, G.health - amt);
  G.invulnTimer = 0.9;
  ui.damageOverlay.style.opacity = '1';
  setTimeout(() => (ui.damageOverlay.style.opacity = '0'), 180);
  SFX.damage();
  trigShake(0.4, 0.15);
  spawnDmg(
    G.player!.position.clone().add(new THREE.Vector3(0, 3, 0)),
    amt,
    '#ff4455',
  );
  resetCombo();

  if (src) {
    const p = G.player!.position.clone().sub(src).setY(0).normalize();
    if (Number.isFinite(p.x)) G.pVel.x = p.x * 12;
    if (Number.isFinite(p.z)) G.pVel.z = p.z * 12;
  }
  G.pVel.y = 8;
  saveMem();
  updateHUD(true);

  if (G.health <= 0) {
    PARTY.forEach((m) => {
      m.hp = m.maxHp;
      m.skillCd = 0;
      m.burstCd = 0;
      m.burstEnergy = 40;
    });
    ui.deathScreen.style.display = 'flex';
    G.isActive = false;
    if (!G.mobile && document.pointerLockElement) document.exitPointerLock();
  }
}

export function respawn(): void {
  PARTY.forEach((m) => {
    m.hp = m.maxHp;
    m.skillCd = 0;
    m.burstCd = 0;
    m.burstEnergy = 40;
  });
  loadMem();
  G.health = G.maxHealth;
  G.stamina = G.maxStamina;
  G.shield = 0;
  G.player!.position.set(0, 5, 0);
  G.pVel.set(0, 0, 0);
  G.camYaw = 0;
  G.camPitch = 0.25;
  G.isGliding = false;
  G.glider!.visible = false;
  G.invulnTimer = 0;
  ui.deathScreen.style.display = 'none';
  if (G.mobile) G.isActive = true;
  else document.body.requestPointerLock();
  updateHUD(true);
}

import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { clamp, distXZ } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { spawnParts, spawnRing, spawnElementalHit } from '../systems/Particles';
import { spawnDmg } from '../ui/DamageNumbers';
import { tryReaction } from './Reactions';
import { dmgEnemy, trigShake, Shake } from './DamageSystem';
import { addCombo } from './Combo';
import { calcStats, getW } from '../systems/Inventory';
import { hitOreNearby } from '../world/Collectibles';
import { updateHUD } from '../ui/HUD';
import { triggerSlashTrail } from './SlashTrail';
import { fireProjectile } from './Projectiles';
import type { WeaponType } from '../types';

/* ──── Weapon-type attack profiles ──── */
interface AttackProfile { hits: number; speedMult: number; arcMult: number; rangeMult: number; kbMult: number; dmgMult: number; }
const WEAPON_PROFILES: Record<WeaponType, AttackProfile> = {
  sword:    { hits: 3, speedMult: 1.0,  arcMult: 1.0, rangeMult: 1.0,  kbMult: 1.0, dmgMult: 1.0 },
  claymore: { hits: 2, speedMult: 0.6,  arcMult: 1.4, rangeMult: 1.15, kbMult: 1.8, dmgMult: 1.5 },
  polearm:  { hits: 4, speedMult: 1.35, arcMult: 0.6, rangeMult: 1.3,  kbMult: 0.7, dmgMult: 0.8 },
  bow:      { hits: 1, speedMult: 1.0,  arcMult: 0.3, rangeMult: 20,   kbMult: 0.5, dmgMult: 1.1 },
  catalyst: { hits: 2, speedMult: 1.1,  arcMult: 2.0, rangeMult: 1.4,  kbMult: 0.8, dmgMult: 1.2 },
};

function getWeaponProfile(): AttackProfile {
  const w = getW(G.inventory.equippedWeapon);
  return WEAPON_PROFILES[w?.wtype ?? 'sword'];
}

function getWeaponType(): WeaponType {
  const w = getW(G.inventory.equippedWeapon);
  return w?.wtype ?? 'sword';
}

export function performAttack(): void {
  if (G.atkTimer > 0 || G.inDialogue || G.isGliding || G.isDashing) return;

  /* ──── Plunging attack: airborne + falling → slam ──── */
  if (!G.isGrounded && G.pVel.y < -2 && !G.isPlunging) {
    G.isPlunging = true;
    G.plungeTimer = 0;
    G.pVel.y = -40; // slam downward
    return;
  }

  const m = mem();
  const stats = calcStats();
  const wp = getWeaponProfile();
  const wt = getWeaponType();
  G.atkCombo = (G.atkCombo % wp.hits) + 1;

  /* Use actual animation clip duration so the full animation plays out */
  const atkName = `attack${G.atkCombo}`;
  let clipDur = 0.35 / (m.normalSpeed * wp.speedMult); // fallback for procedural
  if (G.animActions && G.animActions[atkName]) {
    clipDur = G.animActions[atkName].getClip().duration / (m.normalSpeed * wp.speedMult);
  }
  G.atkTimer = clipDur;
  if (!G.modelLoaded) {
    G.swordPivot!.visible = true;
    G.swordPivot!.rotation.set(
      -Math.PI / 2,
      0,
      G.atkCombo % 2 === 0 ? Math.PI / 4 : -Math.PI / 4,
    );
  }
  SFX.swing(G.atkCombo);
  SFX.barkAttack();
  triggerSlashTrail();

  /* ──── Combo finisher (last hit): bigger VFX ──── */
  const isFinisher = G.atkCombo === wp.hits;
  if (isFinisher) {
    Shake.heavy();
    spawnRing(
      G.player!.position.clone().add(new THREE.Vector3(0, 0.3, 0)),
      m.accent,
      3.5,
    );
  }

  const el = m.element;
  const fwd = new THREE.Vector3(0, 0, -1)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), G.playerModel!.rotation.y)
    .normalize();

  /* ──── Bow: fire a projectile instead of melee ──── */
  if (wt === 'bow') {
    const origin = G.player!.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const vel = fwd.clone().multiplyScalar(45);
    const dmg = stats.atk * wp.dmgMult * (isFinisher ? 1.5 : 1);
    fireProjectile(origin, vel, dmg, m.accent);
    if (isFinisher) updateHUD(true);
    return;
  }

  const range = m.normalRange * wp.rangeMult;
  const arc = m.normalArc * wp.arcMult;

  let hitAny = false;
  for (const s of G.entities.slimes) {
    if (s.dead || (s.frozenTimer > 0.5 && !s.isBoss)) continue;
    const fl = new THREE.Vector3(
      s.mesh.position.x - G.player!.position.x,
      0,
      s.mesh.position.z - G.player!.position.z,
    );
    const d = fl.length();
    if (d < 0.001 || d > (s.isBoss ? 5.5 : range)) continue;
    fl.normalize();
    if (fwd.angleTo(fl) > arc) continue;

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
    let dmg = stats.atk * wp.dmgMult * (crit ? 2 : 1) * G.comboMult;
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
      Shake.medium();
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
      s.isBoss ? 5 : (isFinisher ? 28 : 19) * wp.kbMult,
      s.isBoss ? 3 : (isFinisher ? 10 : 6) * wp.kbMult,
      crit ? '#ffff44' : m.accent,
      null,
      crit,
    );
    G.burstEnergy = clamp(G.burstEnergy + (isFinisher ? 14 : 8), 0, 100);
    hitAny = true;
    addCombo();
    if (crit) {
      SFX.crit();
      Shake.medium();
    }
    if (stats.healOnHit > 0) {
      const h = Math.round(G.maxHealth * stats.healOnHit);
      G.health = Math.min(G.maxHealth, G.health + h);
    }
    G.hitstop = crit ? 0.06 : (isFinisher ? 0.08 : 0.03);
  }
  if (hitAny) updateHUD(true);

  /* Hit ore nodes near attack position */
  hitOreNearby(G.player!.position.clone().add(fwd.clone().multiplyScalar(range * 0.5)), range);
}

/* ──── Plunge landing: AoE damage burst on ground impact ──── */
export function plungeLand(): void {
  G.isPlunging = false;
  G.plungeTimer = 0;
  const m = mem();
  const stats = calcStats();
  const dmg = stats.atk * 2.5 * stats.elemDmg;
  const radius = 5;

  /* VFX */
  Shake.massive();
  spawnRing(G.player!.position.clone().add(new THREE.Vector3(0, 0.3, 0)), m.accent, radius);
  spawnParts(G.player!.position.clone(), m.accent, 30, 14);
  spawnElementalHit(
    G.player!.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
    m.element,
  );
  SFX.hit();
  G.hitstop = 0.08;
  G.atkTimer = 0.4;

  /* Damage all enemies in radius */
  for (const s of G.entities.slimes) {
    if (s.dead) continue;
    if (distXZ(s.mesh.position, G.player!.position) >= radius) continue;
    const rxn = tryReaction(m.element, s);
    let d = dmg;
    if (rxn) d *= rxn.m;
    dmgEnemy(s, d, s.isBoss ? 8 : 22, s.isBoss ? 5 : 12, m.accent);
    addCombo();
  }
  updateHUD(true);
}

/* ──── Charged attack: released after holding attack ──── */
const CHARGE_THRESHOLD = 0.5; // seconds of holding needed

export function releaseCharge(): void {
  const wasCharging = G.isCharging;
  const timer = G.chargeTimer;
  G.isCharging = false;
  G.chargeTimer = 0;

  if (!wasCharging || timer < CHARGE_THRESHOLD) return;
  if (G.inDialogue || G.isGliding || G.isDashing || G.isPlunging) return;
  if (G.stamina < 20) return;

  G.stamina -= 20;
  const m = mem();
  const stats = calcStats();
  const dmg = stats.atk * 3 * stats.elemDmg;
  const radius = 4;

  G.atkTimer = 0.5;
  G.atkCombo = 0;

  /* VFX */
  Shake.heavy();
  SFX.skill();
  spawnRing(
    G.player!.position.clone().add(new THREE.Vector3(0, 0.5, 0)),
    m.accent,
    radius,
  );
  spawnElementalHit(
    G.player!.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
    m.element,
  );
  spawnParts(G.player!.position.clone().add(new THREE.Vector3(0, 1, 0)), m.accent, 24, 12);
  triggerSlashTrail();
  G.hitstop = 0.1;

  /* Forward direction */
  const fwd = new THREE.Vector3(0, 0, -1)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), G.playerModel!.rotation.y)
    .normalize();

  let hitAny = false;
  for (const s of G.entities.slimes) {
    if (s.dead) continue;
    const fl = new THREE.Vector3(
      s.mesh.position.x - G.player!.position.x,
      0,
      s.mesh.position.z - G.player!.position.z,
    );
    const d = fl.length();
    if (d < 0.001 || d > radius) continue;
    fl.normalize();
    if (fwd.angleTo(fl) > Math.PI * 0.6) continue; // wider arc than normal

    const crit = Math.random() < 0.35 + stats.critBonus;
    let finalDmg = dmg * (crit ? 2 : 1);
    const rxn = tryReaction(m.element, s);
    if (rxn) {
      finalDmg *= rxn.m * stats.elemDmg;
      spawnParts(s.mesh.position.clone(), rxn.c, 24, 16);
    }
    dmgEnemy(s, finalDmg, s.isBoss ? 10 : 25, s.isBoss ? 5 : 12, crit ? '#ffff44' : m.accent, null, crit);
    G.burstEnergy = clamp(G.burstEnergy + 15, 0, 100);
    hitAny = true;
    addCombo();
  }
  if (hitAny) updateHUD(true);
}

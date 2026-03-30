import * as THREE from 'three';
import { G, keys, saveMem } from '../core/GameState';
import { clamp, lerp, normAng, wH } from '../core/Helpers';
import { P_RAD, GRAV } from '../core/GameState';
import { SFX } from '../audio/Audio';
import { spawnParts } from './Particles';
import { plungeLand } from '../combat/Attack';

/* ──── Dodge afterimage helpers ──── */
function spawnAfterimage(): void {
  if (!G.playerModel) return;
  const ghost = G.playerModel.clone(true);
  ghost.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      const m = (c as THREE.Mesh);
      m.material = new THREE.MeshBasicMaterial({
        color: 0x88ccff,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  const wrapper = new THREE.Group();
  wrapper.position.copy(G.player!.position);
  wrapper.add(ghost);
  G.scene!.add(wrapper);

  const startTime = G.worldTime;
  const life = 0.35;
  G.entities.particles.push({
    mesh: wrapper as unknown as THREE.Mesh,
    life,
    vel: new THREE.Vector3(),
    ring: false,
    afterimage: true,
    startTime,
  } as any);
}

export function updateMovement(dt: number): void {
  if (G.isDashing) {
    const nx = G.player!.position.clone().addScaledVector(G.pVel, dt);
    resolveTreeCol(nx);
    resolveSpawnCol(nx);
    resolveGroundCol(nx);
    G.player!.position.copy(nx);
    return;
  }

  /* ──── Swimming mode ──── */
  if (G.isSwimming) {
    updateSwimming(dt);
    return;
  }

  /* ──── Climbing mode ──── */
  if (G.isClimbing) {
    updateClimbing(dt);
    return;
  }

  /* ──── Try to start climbing ──── */
  if (!G.isGrounded && !G.isGliding && !G.isClimbing && G.stamina > 10) {
    const climbNormal = checkClimbableSurface();
    if (climbNormal) {
      G.isClimbing = true;
      G.climbSurface = climbNormal;
      G.pVel.set(0, 0, 0);
      return;
    }
  }

  const mv = G.moveVec.set(0, 0, 0);
  if (G.health > 0) {
    if (keys.w) mv.z -= 1;
    if (keys.s) mv.z += 1;
    if (keys.a) mv.x -= 1;
    if (keys.d) mv.x += 1;
    if (mv.lengthSq() > 0) {
      mv.normalize();
      mv.applyAxisAngle(new THREE.Vector3(0, 1, 0), G.camYaw);
    }
  }

  const ts = G.inDialogue ? 0 : G.isGliding ? 9.5 : G.isSprinting ? 14 : 7.4;
  const ac = G.isGrounded ? 12 : 3.3;
  G.pVel.x = lerp(G.pVel.x, mv.x * ts, dt * ac);
  G.pVel.z = lerp(G.pVel.z, mv.z * ts, dt * ac);

  if (mv.lengthSq() > 0.01 && !G.inDialogue) {
    const des = Math.atan2(G.pVel.x, G.pVel.z);
    G.playerModel!.rotation.y += normAng(des - G.playerModel!.rotation.y) * dt * 15;
  } else if (G.inDialogue && G.npc) {
    const des = Math.atan2(
      G.npc.position.x - G.player!.position.x,
      G.npc.position.z - G.player!.position.z,
    );
    G.playerModel!.rotation.y += normAng(des - G.playerModel!.rotation.y) * dt * 10;
  }

  let inU = false;
  for (const u of G.entities.updrafts) {
    const dx = G.player!.position.x - u.x;
    const dz = G.player!.position.z - u.z;
    if (Math.sqrt(dx * dx + dz * dz) < u.radius && G.player!.position.y < u.top) {
      inU = true;
      if (G.isGliding) G.pVel.y = Math.min(G.pVel.y + 42 * dt, 15);
    }
  }

  if (!G.isGrounded) {
    if (G.isGliding && !inU) G.pVel.y = Math.max(G.pVel.y - 4 * dt, -4);
    else if (!inU) G.pVel.y -= GRAV * dt;
  }

  const nx = G.player!.position.clone().addScaledVector(G.pVel, dt);
  resolveTreeCol(nx);
  resolveSpawnCol(nx);
  resolveGroundCol(nx);
  G.player!.position.copy(nx);
}

function resolveTreeCol(nx: THREE.Vector3): void {
  for (const t of G.entities.trees) {
    const dx = nx.x - t.x;
    const dz = nx.z - t.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const md = t.radius + P_RAD;
    if (d < md) {
      if (d < 0.001) nx.x += md;
      else {
        const p = (md - d) / d;
        nx.x += dx * p;
        nx.z += dz * p;
      }
    }
  }
}

function resolveSpawnCol(nx: THREE.Vector3 & { onPlatform?: boolean }): void {
  const d = Math.sqrt(nx.x * nx.x + nx.z * nx.z);
  nx.onPlatform = false;
  if (d < 8.5) {
    if (G.player!.position.y >= 2) {
      nx.onPlatform = true;
      if (nx.y < 2) nx.y = 2;
    } else if (d > 0.001) {
      const a = Math.atan2(nx.z, nx.x);
      nx.x = Math.cos(a) * 8.55;
      nx.z = Math.sin(a) * 8.55;
    } else {
      nx.x = 8.55;
    }
  }
}

function resolveGroundCol(nx: THREE.Vector3 & { onPlatform?: boolean }): void {
  let g = wH(nx.x, nx.z);
  if (nx.onPlatform) g = 2;

  /* Enter swimming when falling into water */
  if (!G.isSwimming && g < WATER_Y && nx.y <= SWIM_SURFACE_Y) {
    G.isSwimming = true;
    G.isGrounded = false;
    G.isGliding = false;
    if (G.glider) G.glider.visible = false;
    G.pVel.y = 0;
    nx.y = SWIM_SURFACE_Y;
    SFX.footWater();
    return;
  }

  // Snap to ground to prevent falling when walking down steep slopes or cresting hills
  if (G.isGrounded && G.pVel.y <= 0 && nx.y > g && nx.y - g < 2.0) {
    nx.y = g;
  }

  if (nx.y <= g) {
    nx.y = g;
    G.pVel.y = 0;
    G.isGrounded = true;
    if (G.isPlunging) plungeLand();
    if (G.isGliding) {
      G.isGliding = false;
      G.glider!.visible = false;
    }
  } else {
    G.isGrounded = false;
  }
}

export function handleJump(): void {
  if (G.inDialogue) return;

  /* Jump out of water */
  if (G.isSwimming) {
    G.isSwimming = false;
    G.pVel.y = 8;
    G.isGrounded = false;
    SFX.jump();
    SFX.barkJump();
    const sp = G.player!.position.clone();
    sp.y = WATER_Y + 0.1;
    spawnParts(sp, '#88ccff', 6, 5);
    return;
  }

  /* Detach from climbing surface */
  if (G.isClimbing) {
    G.isClimbing = false;
    G.climbSurface = null;
    G.pVel.y = 10;
    G.isGrounded = false;
    SFX.jump();
    SFX.barkJump();
    return;
  }

  if (G.isGrounded) {
    G.pVel.y = 14;
    G.isGrounded = false;
    SFX.jump();
    SFX.barkJump();
    return;
  }
  if (!G.isGliding && G.pVel.y < 5 && G.stamina > 10) {
    G.isGliding = true;
    G.glider!.visible = true;
    G.pVel.y = Math.max(G.pVel.y, -1.4);
    SFX.glide();
    return;
  }
  if (G.isGliding) {
    G.isGliding = false;
    G.glider!.visible = false;
  }
}

export function performDash(): void {
  if (G.isSwimming) return;
  G.isDashing = true;
  G.dashTimer = 0.25;
  G.dashCd = 0.6;
  G.invulnTimer = Math.max(G.invulnTimer, 0.25);
  G.stamina -= 15;
  SFX.dash();
  SFX.barkDash();
  const mv = new THREE.Vector3();
  if (keys.w) mv.z -= 1;
  if (keys.s) mv.z += 1;
  if (keys.a) mv.x -= 1;
  if (keys.d) mv.x += 1;
  if (mv.lengthSq() < 0.01) mv.z = -1;
  mv.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), G.camYaw);
  G.pVel.x = mv.x * 22;
  G.pVel.z = mv.z * 22;
  spawnParts(G.player!.position.clone().add(new THREE.Vector3(0, 0.5, 0)), '#ffffff', 8, 6);

  /* Dodge afterimages — spawn 3 ghosts at staggered intervals */
  spawnAfterimage();
  setTimeout(() => spawnAfterimage(), 80);
  setTimeout(() => spawnAfterimage(), 160);
}

export function updateTimers(dt: number): void {
  if (G.invulnTimer > 0) G.invulnTimer -= dt;
  if (G.dashCd > 0) G.dashCd -= dt;
  if (G.skillTimer > 0) G.skillTimer -= dt;
  if (G.burstTimer > 0) G.burstTimer -= dt;
  if (G.dashTimer > 0) {
    G.dashTimer -= dt;
    if (G.dashTimer <= 0) G.isDashing = false;
  }
  if (G.shieldTimer > 0) {
    G.shieldTimer -= dt;
    if (G.shieldTimer <= 0) {
      G.shield = 0;
      G.maxShield = 0;
    }
  }
  G.skillCd = Math.max(0, G.skillCd - dt);
  G.burstCd = Math.max(0, G.burstCd - dt);

  /* Charged attack timer */
  if (G.isCharging) {
    G.chargeTimer += dt;
  }

  /* Reset attack combo after a window of no attacks */
  if (G.atkTimer <= 0 && G.atkCombo > 0) {
    G.combatTimer += dt;
    if (G.combatTimer > 0.8) {
      G.atkCombo = 0;
      G.combatTimer = 0;
    }
  } else {
    G.combatTimer = 0;
  }

  saveMem();

  const mv = keys.w || keys.a || keys.s || keys.d;
  /* Hysteresis: once stamina depletes, lock sprint until recovered past 20% */
  if (G.stamina <= 0) G.sprintLocked = true;
  if (G.sprintLocked && G.stamina >= G.maxStamina * 0.2) G.sprintLocked = false;
  G.isSprinting =
    G.isGrounded && !!keys.shift && !!mv && !G.inDialogue && G.stamina > 0 && !G.sprintLocked && !G.isDashing && !G.isSwimming;
  if (G.isSprinting) {
    G.stamina -= 26 * dt;
    /* Sprint dust particles */
    G.sprintDustTimer -= dt;
    if (G.sprintDustTimer <= 0) {
      G.sprintDustTimer = 0.12;
      const foot = G.player!.position.clone();
      foot.x += (Math.random() - 0.5) * 0.6;
      foot.z += (Math.random() - 0.5) * 0.6;
      spawnParts(foot, '#c8b89a', 3, 3);
    }
  } else if (G.isGliding) {
    G.stamina -= 10 * dt;
    if (G.stamina <= 0) {
      G.isGliding = false;
      G.glider!.visible = false;
    }
  } else if (G.isGrounded && !G.isSwimming) {
    G.stamina += 18 * dt;
  }
  G.stamina = clamp(G.stamina, 0, G.maxStamina);

  /* ──── Footstep sounds ──── */
  if (G.isGrounded && mv && !G.isDashing && !G.inDialogue) {
    const interval = G.isSprinting ? 0.22 : 0.38;
    G.footstepTimer -= dt;
    if (G.footstepTimer <= 0) {
      G.footstepTimer = interval;
      const h = wH(G.player!.position.x, G.player!.position.z);
      if (h < 0.2) SFX.footWater();
      else if (h > 12) SFX.footStone();
      else SFX.footGrass();
    }
  } else {
    G.footstepTimer = 0;
  }
}

/* ═══════════════════════════════════════
   Swimming System
   ═══════════════════════════════════════ */

function updateSwimming(dt: number): void {
  if (!G.player) return;

  /* Drain stamina */
  G.stamina -= SWIM_STAMINA_DRAIN * dt;
  if (G.stamina <= 0) {
    G.stamina = 0;
    /* Drown — take damage */
    G.health -= 8 * dt;
    if (G.health <= 0) G.health = 0;
  }

  /* WASD horizontal movement */
  const mv = G.moveVec.set(0, 0, 0);
  if (G.health > 0 && !G.inDialogue) {
    if (keys.w) mv.z -= 1;
    if (keys.s) mv.z += 1;
    if (keys.a) mv.x -= 1;
    if (keys.d) mv.x += 1;
    if (mv.lengthSq() > 0) {
      mv.normalize();
      mv.applyAxisAngle(new THREE.Vector3(0, 1, 0), G.camYaw);
    }
  }

  const swimSpd = keys.shift && G.stamina > 0 ? SWIM_SPEED * 1.5 : SWIM_SPEED;
  if (keys.shift && G.stamina > 0) G.stamina -= 8 * dt; // extra drain for sprint-swim
  G.pVel.x = lerp(G.pVel.x, mv.x * swimSpd, dt * 8);
  G.pVel.z = lerp(G.pVel.z, mv.z * swimSpd, dt * 8);
  G.pVel.y = 0;

  const nx = G.player.position.clone().addScaledVector(G.pVel, dt);
  resolveTreeCol(nx);
  resolveSpawnCol(nx);

  /* Keep at water surface with gentle bobbing */
  nx.y = SWIM_SURFACE_Y + Math.sin(G.worldTime * 2.4) * 0.12;

  /* Check if we've reached shore (ground above water) */
  const g = wH(nx.x, nx.z);
  if (g >= WATER_Y) {
    /* Exit swimming — walk onto land */
    G.isSwimming = false;
    nx.y = g;
    G.pVel.y = 0;
    G.isGrounded = true;
  }

  G.player.position.copy(nx);

  /* Face movement direction */
  if (mv.lengthSq() > 0.01 && G.playerModel) {
    const des = Math.atan2(G.pVel.x, G.pVel.z);
    G.playerModel.rotation.y += normAng(des - G.playerModel.rotation.y) * dt * 15;
  }

  /* Water splash particles when moving */
  if (mv.lengthSq() > 0.01) {
    G.sprintDustTimer -= dt;
    if (G.sprintDustTimer <= 0) {
      G.sprintDustTimer = 0.25;
      const sp = G.player.position.clone();
      sp.y = WATER_Y + 0.1;
      spawnParts(sp, '#88ccff', 4, 4);
    }
  }
}

/* ═══════════════════════════════════════
   Climbing System
   ═══════════════════════════════════════ */

const CLIMB_SPEED = 4.5;
const CLIMB_STAMINA_DRAIN = 20; // per second
const SWIM_SPEED = 5.5;
const SWIM_STAMINA_DRAIN = 12; // per second
const WATER_Y = -3;
const SWIM_SURFACE_Y = WATER_Y + 0.3; // keep head above water

/** Check if the player is pressing into a climbable surface (tree trunk or spawn pillar) */
function checkClimbableSurface(): THREE.Vector3 | null {
  if (!G.player) return null;
  const pp = G.player.position;

  /* Check trees */
  for (const t of G.entities.trees) {
    const dx = pp.x - t.x;
    const dz = pp.z - t.z;
    const hd = Math.sqrt(dx * dx + dz * dz);
    const climbR = t.radius + P_RAD + 0.3;
    if (hd < climbR && pp.y > wH(pp.x, pp.z) + 0.5) {
      /* Player is near the trunk and above ground — check if moving toward it */
      const toTree = new THREE.Vector3(-dx, 0, -dz).normalize();
      const moveDir = new THREE.Vector3(G.pVel.x, 0, G.pVel.z);
      if (moveDir.lengthSq() > 0.1 && moveDir.normalize().dot(toTree) > 0.3) {
        return new THREE.Vector3(dx, 0, dz).normalize(); // surface outward normal
      }
    }
  }

  /* Check spawn pillar */
  const sd = Math.sqrt(pp.x * pp.x + pp.z * pp.z);
  if (sd < 9.5 && sd > 7 && pp.y > 0.5) {
    const toCenter = new THREE.Vector3(-pp.x, 0, -pp.z).normalize();
    const moveDir = new THREE.Vector3(G.pVel.x, 0, G.pVel.z);
    if (moveDir.lengthSq() > 0.1 && moveDir.normalize().dot(toCenter) > 0.3) {
      return new THREE.Vector3(pp.x, 0, pp.z).normalize();
    }
  }

  return null;
}

function updateClimbing(dt: number): void {
  if (!G.player || !G.climbSurface) return;

  /* Drain stamina */
  G.stamina -= CLIMB_STAMINA_DRAIN * dt;
  if (G.stamina <= 0) {
    /* Fall off */
    G.isClimbing = false;
    G.climbSurface = null;
    G.stamina = 0;
    return;
  }

  /* Vertical movement: W = up, S = down */
  let vy = 0;
  if (keys.w) vy = CLIMB_SPEED;
  if (keys.s) vy = -CLIMB_SPEED;
  G.player.position.y += vy * dt;

  /* Lateral movement along the surface: A/D slide sideways */
  const lateral = new THREE.Vector3(-G.climbSurface.z, 0, G.climbSurface.x);
  let lm = 0;
  if (keys.a) lm = -CLIMB_SPEED * 0.6;
  if (keys.d) lm = CLIMB_SPEED * 0.6;
  G.player.position.addScaledVector(lateral, lm * dt);

  /* Keep pushed against the surface */
  // Re-check proximity to stay attached
  const ground = wH(G.player.position.x, G.player.position.z);
  if (G.player.position.y <= ground + 0.1) {
    /* Back on ground */
    G.isClimbing = false;
    G.climbSurface = null;
    G.player.position.y = ground;
    G.isGrounded = true;
    G.pVel.set(0, 0, 0);
  }

  /* Face the surface */
  if (G.playerModel && G.climbSurface) {
    const faceAngle = Math.atan2(-G.climbSurface.x, -G.climbSurface.z);
    G.playerModel.rotation.y += normAng(faceAngle - G.playerModel.rotation.y) * dt * 10;
  }
}

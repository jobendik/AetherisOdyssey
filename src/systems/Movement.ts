import * as THREE from 'three';
import { G, keys, saveMem } from '../core/GameState';
import { clamp, lerp, normAng, wH } from '../core/Helpers';
import { P_RAD, GRAV } from '../core/GameState';
import { SFX } from '../audio/Audio';
import { spawnParts } from './Particles';

export function updateMovement(dt: number): void {
  if (G.isDashing) {
    const nx = G.player!.position.clone().addScaledVector(G.pVel, dt);
    resolveTreeCol(nx);
    resolveSpawnCol(nx);
    resolveGroundCol(nx);
    G.player!.position.copy(nx);
    return;
  }

  const mv = G.moveVec.set(0, 0, 0);
  if (keys.w) mv.z -= 1;
  if (keys.s) mv.z += 1;
  if (keys.a) mv.x -= 1;
  if (keys.d) mv.x += 1;
  if (mv.lengthSq() > 0) {
    mv.normalize();
    mv.applyAxisAngle(new THREE.Vector3(0, 1, 0), G.camYaw);
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
  if (nx.y <= g) {
    nx.y = g;
    G.pVel.y = 0;
    G.isGrounded = true;
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
  if (G.isGrounded) {
    G.pVel.y = 14;
    G.isGrounded = false;
    SFX.jump();
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
  G.isDashing = true;
  G.dashTimer = 0.25;
  G.dashCd = 0.6;
  G.invulnTimer = Math.max(G.invulnTimer, 0.25);
  G.stamina -= 15;
  SFX.dash();
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
}

export function updateTimers(dt: number): void {
  if (G.invulnTimer > 0) G.invulnTimer -= dt;
  if (G.dashCd > 0) G.dashCd -= dt;
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
  saveMem();

  const mv = keys.w || keys.a || keys.s || keys.d;
  G.isSprinting =
    G.isGrounded && !!keys.shift && !!mv && !G.inDialogue && G.stamina > 0 && !G.isDashing;
  if (G.isSprinting) G.stamina -= 26 * dt;
  else if (G.isGliding) {
    G.stamina -= 10 * dt;
    if (G.stamina <= 0) {
      G.isGliding = false;
      G.glider!.visible = false;
    }
  } else if (G.isGrounded) {
    G.stamina += 18 * dt;
  }
  G.stamina = clamp(G.stamina, 0, G.maxStamina);
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import { lerp } from '../core/Helpers';

const FADE_DUR = 0.2;

/** Smoothly transition to a named animation clip */
function playAnim(name: string): void {
  if (!G.mixer || !G.animActions || G.currentAnim === name) return;
  const next = G.animActions[name];
  if (!next) return;

  const prev = G.currentAnim ? G.animActions[G.currentAnim] : null;

  /* Reset one-shot clips before replaying */
  if (name === 'jumpUp' || name === 'jumpDown' || name === 'land') {
    next.reset();
  }

  next.reset().fadeIn(FADE_DUR).play();
  if (prev) prev.fadeOut(FADE_DUR);

  G.currentAnim = name;
}

export function updatePose(dt: number): void {
  /* ─── Update the AnimationMixer (skeletal anim) ─── */
  if (G.mixer) {
    G.mixer.update(dt);

    /* Determine target animation based on state */
    const mv = G.moveVec.lengthSq() > 0.01 && G.isGrounded && !G.inDialogue;

    if (G.isGliding) {
      playAnim('fly');
    } else if (G.isDashing) {
      playAnim('run');
    } else if (!G.isGrounded && G.pVel.y > 1) {
      playAnim('jumpUp');
    } else if (!G.isGrounded && G.pVel.y < -1) {
      playAnim('jumpDown');
    } else if (mv && G.isSprinting) {
      playAnim('run');
    } else if (mv) {
      playAnim('walk');
    } else if (G.isGrounded) {
      playAnim('idle');
    }
  }

  /* ─── Procedural fallback (used when model hasn't loaded) ─── */
  if (!G.modelLoaded) {
    const t = G.worldTime;
    const mv = G.moveVec.lengthSq() > 0.01 && G.isGrounded && !G.inDialogue;

    if (G.isDashing) {
      G.playerModel!.rotation.x = 0.3;
      for (const l of Object.values(G.limbs)) l.rotation.x = 0;
    } else if (mv) {
      const sp = G.isSprinting ? 17 : 10.5;
      G.limbs.legL.rotation.x = Math.sin(t * sp) * 0.8;
      G.limbs.legR.rotation.x = Math.sin(t * sp + Math.PI) * 0.8;
      G.limbs.armL.rotation.x = Math.sin(t * sp + Math.PI) * 0.8;
      G.limbs.armR.rotation.x = Math.sin(t * sp) * 0.8;
      G.playerModel!.position.y = Math.abs(Math.sin(t * sp * 2)) * 0.08;
      G.playerModel!.rotation.x = 0.07;
      G.cape!.rotation.x = -0.58 + Math.sin(t * 13) * 0.14;
    } else if (G.isGliding) {
      G.limbs.legL.rotation.x = G.limbs.legR.rotation.x = 0.2;
      G.limbs.armL.rotation.x = G.limbs.armR.rotation.x = -Math.PI / 2;
      G.playerModel!.rotation.x = -0.38;
      G.playerModel!.position.y = 0;
      G.cape!.rotation.x = -1.1;
    } else {
      for (const l of Object.values(G.limbs))
        l.rotation.x = lerp(l.rotation.x, 0, dt * 10);
      G.playerModel!.rotation.x = lerp(G.playerModel!.rotation.x, 0, dt * 10);
      G.playerModel!.position.y = Math.sin(t * 3) * 0.04;
      G.cape!.rotation.x = -0.1 + Math.sin(t * 2) * 0.05;
    }
  }

  /* ─── Shared logic (both procedural & skeletal) ─── */
  if (G.invulnTimer > 0) G.playerModel!.visible = Math.floor(G.worldTime * 18) % 2 === 0;
  else G.playerModel!.visible = true;

  if (G.atkTimer > 0) {
    G.atkTimer -= dt;
    G.swordPivot!.rotation.x += 15.5 * dt;
    if (!G.modelLoaded) {
      G.limbs.armR.rotation.x = -Math.PI / 2 + G.swordPivot!.rotation.x;
    }
    if (G.atkTimer <= 0) {
      G.swordPivot!.visible = false;
      G.swordPivot!.rotation.set(0, 0, 0);
    }
  }
}

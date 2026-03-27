import { G } from '../core/GameState';
import { lerp } from '../core/Helpers';

export function updatePose(dt: number): void {
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
    for (const l of Object.values(G.limbs)) l.rotation.x = lerp(l.rotation.x, 0, dt * 10);
    G.playerModel!.rotation.x = lerp(G.playerModel!.rotation.x, 0, dt * 10);
    G.playerModel!.position.y = Math.sin(t * 3) * 0.04;
    G.cape!.rotation.x = -0.1 + Math.sin(t * 2) * 0.05;
  }

  if (G.invulnTimer > 0) G.playerModel!.visible = Math.floor(t * 18) % 2 === 0;
  else G.playerModel!.visible = true;

  if (G.atkTimer > 0) {
    G.atkTimer -= dt;
    G.swordPivot!.rotation.x += 15.5 * dt;
    G.limbs.armR.rotation.x = -Math.PI / 2 + G.swordPivot!.rotation.x;
    if (G.atkTimer <= 0) {
      G.swordPivot!.visible = false;
      G.swordPivot!.rotation.set(0, 0, 0);
    }
  }
}

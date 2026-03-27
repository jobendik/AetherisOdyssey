import * as THREE from 'three';
import { G } from './GameState';
import { lerp } from './Helpers';
import { wH } from './Helpers';

export function updateCamera(dt: number): void {
  const tf = G.isSprinting ? 80 : G.isDashing ? 85 : G.baseFov;
  G.cam!.fov = lerp(G.cam!.fov, tf, dt * 8);
  G.cam!.updateProjectionMatrix();

  const CAM_D = 6.4;
  const rxz = CAM_D * Math.cos(G.camPitch);
  const tgt = new THREE.Vector3(
    G.player!.position.x + rxz * Math.sin(G.camYaw),
    G.player!.position.y + 1.65 + CAM_D * Math.sin(G.camPitch),
    G.player!.position.z + rxz * Math.cos(G.camYaw),
  );

  const mcy = wH(tgt.x, tgt.z) + 0.65;
  if (tgt.y < mcy) tgt.y = mcy;

  if (G.screenShake > 0) {
    G.screenShake -= (dt / G.shakeDecay) * G.screenShake;
    if (G.screenShake < 0.01) G.screenShake = 0;
    tgt.x += (Math.random() - 0.5) * G.screenShake;
    tgt.y += (Math.random() - 0.5) * G.screenShake * 0.5;
    tgt.z += (Math.random() - 0.5) * G.screenShake;
  }

  G.cam!.position.lerp(tgt, dt * 14);
  G.cam!.lookAt(
    G.player!.position.x,
    G.player!.position.y + 1.5,
    G.player!.position.z,
  );
}

export function onResize(): void {
  G.cam!.aspect = innerWidth / innerHeight;
  G.cam!.updateProjectionMatrix();
  G.rend!.setSize(innerWidth, innerHeight);
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh } from '../core/Helpers';

import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export function buildGuideNPC(): void {
  G.npc = new THREE.Group();
  G.npc.position.set(3.2, 2.05, -3.2);
  G.npc.rotation.y = -Math.PI / 4;
  G.scene!.add(G.npc);

  const loader = new FBXLoader();
  Promise.all([
    loader.loadAsync('/models/characters/npc/Maria WProp J J Ong.fbx'),
    loader.loadAsync('/models/characters/npc/Neutral Idle.fbx'),
    loader.loadAsync('/models/characters/npc/Talking.fbx'),
  ]).then(([mesh, idleData, talkData]) => {
    mesh.scale.setScalar(0.038);
    mesh.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    // Remove any fallback procedural meshes if created
    while (G.npc!.children.length > 0) G.npc!.remove(G.npc!.children[0]);
    G.npc!.add(mesh);

    const mixer = new THREE.AnimationMixer(mesh);
    G.npc!.userData.mixer = mixer;
    G.npc!.userData.actions = {
      idle: mixer.clipAction(idleData.animations[0]),
      talk: mixer.clipAction(talkData.animations[0]),
    };
    G.npc!.userData.currentAnim = 'idle';
    G.npc!.userData.actions.idle.play();
  }).catch(e => console.error("NPC load failed: ", e));
}

export function updateNPC(dt: number): void {
  if (!G.npc || !G.npc.userData.mixer) return;
  G.npc.userData.mixer.update(dt);

  const stateTarget = G.inDialogue ? 'talk' : 'idle';
  if (stateTarget !== G.npc.userData.currentAnim) {
    const prev = G.npc.userData.actions[G.npc.userData.currentAnim];
    const next = G.npc.userData.actions[stateTarget];
    if (next) {
      next.reset().fadeIn(0.3).play();
      if (prev) prev.fadeOut(0.3);
      G.npc.userData.currentAnim = stateTarget;
    }
  }
}

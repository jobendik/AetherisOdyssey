import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh } from '../core/Helpers';

export function buildGuideNPC(): void {
  G.npc = new THREE.Group();
  G.npc.add(
    mkMesh(
      new THREE.BoxGeometry(0.72, 1.25, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x475cae, flatShading: true }),
      0,
      1.25,
      0,
    ),
  );
  G.npc.add(
    mkMesh(
      new THREE.SphereGeometry(0.34, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffddb8, flatShading: true }),
      0,
      2.18,
      0,
    ),
  );
  G.npc.add(
    mkMesh(
      new THREE.ConeGeometry(0.38, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0efe7, flatShading: true }),
      0,
      2.46,
      0,
    ),
  );
  G.npc.position.set(3.2, 2, -3.2);
  G.npc.rotation.y = -Math.PI / 4;
  G.scene!.add(G.npc);
}

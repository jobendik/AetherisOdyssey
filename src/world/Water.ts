import * as THREE from 'three';
import { G } from '../core/GameState';

export function buildWater(): void {
  G.water = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({
      color: 0x2d88d1,
      transparent: true,
      opacity: 0.75,
      flatShading: true,
    }),
  );
  G.water.rotation.x = -Math.PI / 2;
  G.water.position.y = -3;
  G.scene!.add(G.water);
}

export function updateWater(): void {
  if (G.water) {
    G.water.position.y = -3 + Math.sin(G.worldTime * 0.8) * 0.3;
  }
}

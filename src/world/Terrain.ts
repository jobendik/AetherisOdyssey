import * as THREE from 'three';
import { G } from '../core/GameState';
import { wH } from '../core/Helpers';

export function buildTerrain(): void {
  const tGeo = new THREE.PlaneGeometry(300, 300, 128, 128);
  tGeo.rotateX(-Math.PI / 2);
  const pos = tGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, wH(pos.getX(i), pos.getZ(i)));
  }
  tGeo.computeVertexNormals();

  G.terrain = new THREE.Mesh(
    tGeo,
    new THREE.MeshStandardMaterial({ color: 0x7fb569, roughness: 0.95, flatShading: true }),
  );
  G.terrain.receiveShadow = true;
  G.scene!.add(G.terrain);
}

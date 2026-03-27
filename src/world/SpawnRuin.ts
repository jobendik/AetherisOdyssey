import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh } from '../core/Helpers';

export function buildSpawnRuin(): void {
  const s = new THREE.MeshStandardMaterial({ color: 0xcfc7c0, flatShading: true, roughness: 0.9 });
  const p = mkMesh(new THREE.CylinderGeometry(8.5, 8.5, 2, 18), s, 0, 1, 0);
  p.receiveShadow = true;
  p.castShadow = true;
  G.scene!.add(p);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pl = mkMesh(
      new THREE.CylinderGeometry(0.8, 1, 10, 8),
      s,
      Math.cos(a) * 6,
      5,
      Math.sin(a) * 6,
    );
    pl.castShadow = true;
    G.scene!.add(pl);
  }

  const cg = mkMesh(
    new THREE.CylinderGeometry(2.6, 2.6, 0.08, 18),
    new THREE.MeshStandardMaterial({
      color: 0x91dbff,
      emissive: 0x2c6f90,
      emissiveIntensity: 0.7,
      flatShading: true,
    }),
    0,
    2.04,
    0,
  );
  G.scene!.add(cg);
}

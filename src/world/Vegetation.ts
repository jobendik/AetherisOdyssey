import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh, rwp, rnd } from '../core/Helpers';

export function populateTrees(count: number): void {
  const tk = new THREE.MeshStandardMaterial({ color: 0x6b4326, flatShading: true });
  const lf = new THREE.MeshStandardMaterial({ color: 0x5e9a4a, flatShading: true });

  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(18, 118);
    const t = new THREE.Group();
    const sc = 0.75 + Math.random() * 0.65;
    t.add(mkMesh(new THREE.CylinderGeometry(0.42, 0.65, 4.8, 6), tk, 0, 2.4, 0));
    t.add(mkMesh(new THREE.ConeGeometry(2.5, 4.3, 7), lf, 0, 5.4, 0));
    t.add(mkMesh(new THREE.ConeGeometry(2, 3.5, 7), lf, 0, 7, 0));
    t.position.set(x, y, z);
    t.scale.setScalar(sc);
    t.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    G.scene!.add(t);
    G.entities.trees.push({ x, z, radius: 1.25 * sc });
  }
}

export function populateRocks(count: number): void {
  const m = new THREE.MeshStandardMaterial({ color: 0x888880, flatShading: true, roughness: 1 });
  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(10, 120);
    const sc = 0.4 + Math.random() * 1.2;
    const r = mkMesh(new THREE.DodecahedronGeometry(sc, 0), m, x, y + sc * 0.3, z);
    r.rotation.set(rnd(0, Math.PI), rnd(0, Math.PI), 0);
    r.castShadow = true;
    G.scene!.add(r);
  }
}

export function populateFlowers(count: number): void {
  const cols = [0xff7799, 0xffdd44, 0xff66aa, 0xaaddff, 0xffbb55];
  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(10, 115, 0);
    const fl = new THREE.Group();
    fl.add(
      mkMesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.6, 4),
        new THREE.MeshStandardMaterial({ color: 0x44882a, flatShading: true }),
        0,
        0.3,
        0,
      ),
    );
    fl.add(
      mkMesh(
        new THREE.SphereGeometry(0.2, 6, 6),
        new THREE.MeshStandardMaterial({ color: cols[i % cols.length], flatShading: true }),
        0,
        0.65,
        0,
      ),
    );
    fl.position.set(x, y, z);
    G.scene!.add(fl);
  }
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh, mkLight, wH, rnd } from '../core/Helpers';

export function buildLandmarks(): void {
  const stone = new THREE.MeshStandardMaterial({ color: 0xb5aca5, flatShading: true, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x7a726b, flatShading: true, roughness: 1 });

  /* ── Bridge ── */
  const bx = 45, bz = -30, by = wH(bx, bz);
  for (let i = 0; i < 12; i++) {
    const seg = mkMesh(new THREE.BoxGeometry(3, 0.6, 6), stone, bx + i * 2.8 - 15, by + 3, bz);
    seg.castShadow = true;
    seg.receiveShadow = true;
    G.scene!.add(seg);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const rail = mkMesh(new THREE.BoxGeometry(0.4, 1.5, 0.4), dark, bx + i * 2.8 - 15, by + 4, bz + side * 2.6);
      rail.castShadow = true;
      G.scene!.add(rail);
    }
  }
  for (const i of [0, 5, 11]) {
    const sup = mkMesh(new THREE.BoxGeometry(1.5, 8, 1.5), dark, bx + i * 2.8 - 15, by - 1, bz);
    sup.castShadow = true;
    G.scene!.add(sup);
  }

  /* ── Tower ── */
  const tx = -50, tz = 40, ty = wH(tx, tz);
  const tower = mkMesh(new THREE.CylinderGeometry(3, 4, 18, 8), stone, tx, ty + 9, tz);
  tower.castShadow = true;
  G.scene!.add(tower);
  const top = mkMesh(
    new THREE.ConeGeometry(5, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x884422, flatShading: true }),
    tx,
    ty + 20.5,
    tz,
  );
  top.castShadow = true;
  G.scene!.add(top);
  for (let j = 0; j < 3; j++) {
    const ring = mkMesh(new THREE.CylinderGeometry(4.2, 4.2, 0.4, 12), stone, tx, ty + 5 + j * 5, tz);
    ring.castShadow = true;
    G.scene!.add(ring);
  }
  G.scene!.add(mkLight(0xffaa44, 0.6, 25, tx, ty + 22, tz));

  /* ── Shrine ── */
  const sx = 60, sz = 55, sy = wH(sx, sz);
  const shrine = mkMesh(
    new THREE.BoxGeometry(8, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0xddd8cc, flatShading: true }),
    sx,
    sy + 0.25,
    sz,
  );
  shrine.receiveShadow = true;
  G.scene!.add(shrine);
  for (let i = 0; i < 4; i++) {
    const ca = (i / 4) * Math.PI * 2;
    G.scene!.add(
      mkMesh(
        new THREE.CylinderGeometry(0.5, 0.6, 5, 6),
        stone,
        sx + Math.cos(ca) * 3.2,
        sy + 2.5,
        sz + Math.sin(ca) * 3.2,
      ),
    );
  }
  G.scene!.add(
    mkMesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.1, 12),
      new THREE.MeshStandardMaterial({
        color: 0x88ddff,
        emissive: 0x44aadd,
        emissiveIntensity: 1,
        flatShading: true,
      }),
      sx,
      sy + 0.55,
      sz,
    ),
  );
  G.scene!.add(mkLight(0x88ddff, 0.5, 15, sx, sy + 3, sz));

  /* ── Windmill ── */
  const wx = -30, wz = -60, wy = wH(wx, wz);
  G.scene!.add(
    mkMesh(
      new THREE.CylinderGeometry(2, 3, 12, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8ddd0, flatShading: true }),
      wx,
      wy + 6,
      wz,
    ),
  );
  G.scene!.add(
    mkMesh(
      new THREE.ConeGeometry(3.5, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x994422, flatShading: true }),
      wx,
      wy + 13.5,
      wz,
    ),
  );
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b6b3d, flatShading: true });
  for (let i = 0; i < 4; i++) {
    const ba = i * Math.PI / 2;
    const blade = mkMesh(new THREE.BoxGeometry(0.3, 7, 0.1), woodMat, wx + Math.cos(ba) * 3.5, wy + 10, wz + 0.1);
    blade.rotation.z = ba;
    G.scene!.add(blade);
  }

  /* ── Ruined Gate ── */
  const gx = 70, gz = -60, gy = wH(gx, gz);
  for (const side of [-1, 1]) {
    G.scene!.add(mkMesh(new THREE.BoxGeometry(2, 12, 2), dark, gx + side * 5, gy + 6, gz));
  }
  G.scene!.add(mkMesh(new THREE.BoxGeometry(12, 2, 2), dark, gx, gy + 12, gz));
  for (let i = 0; i < 5; i++) {
    const rub = mkMesh(
      new THREE.DodecahedronGeometry(0.5 + Math.random(), 0),
      dark,
      gx + rnd(-6, 6),
      gy + rnd(0, 0.5),
      gz + rnd(-3, 3),
    );
    rub.rotation.set(rnd(0, 3), rnd(0, 3), 0);
    G.scene!.add(rub);
  }
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh, mkCelMat, mkCelEmissiveMat } from '../core/Helpers';

export function buildSpawnRuin(): void {
  /* Stone materials — cel-shaded with subtle color variation */
  const stoneMain = mkCelMat(0xcfc7c0, 0xb8b0a8, 0.25);  // light stone with moss tint
  const stoneDark = mkCelMat(0xa89e96, 0x8e847c, 0.15);   // darker accent stone
  const stoneBase = mkCelMat(0xc2bab2, 0xb0a89f, 0.35);   // base platform with more moss

  /* Main platform — two-tier for depth */
  const pBase = mkMesh(new THREE.CylinderGeometry(9.2, 9.5, 1.0, 18), stoneBase, 0, 0.5, 0);
  pBase.receiveShadow = true;
  pBase.castShadow = true;
  G.scene!.add(pBase);

  const pTop = mkMesh(new THREE.CylinderGeometry(8.3, 8.5, 1.2, 18), stoneMain, 0, 1.6, 0);
  pTop.receiveShadow = true;
  pTop.castShadow = true;
  G.scene!.add(pTop);

  /* Pillars — tapered with caps and bases */
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const px = Math.cos(a) * 6;
    const pz = Math.sin(a) * 6;

    /* Pillar base */
    const plBase = mkMesh(
      new THREE.CylinderGeometry(1.2, 1.3, 0.6, 8),
      stoneDark, px, 2.5, pz,
    );
    plBase.castShadow = true;
    G.scene!.add(plBase);

    /* Pillar shaft — tapered */
    const pl = mkMesh(
      new THREE.CylinderGeometry(0.7, 0.95, 9, 8),
      stoneMain, px, 7.3, pz,
    );
    pl.castShadow = true;
    G.scene!.add(pl);

    /* Pillar capital (top adornment) */
    const plCap = mkMesh(
      new THREE.CylinderGeometry(1.1, 0.75, 0.8, 8),
      stoneDark, px, 12.2, pz,
    );
    plCap.castShadow = true;
    G.scene!.add(plCap);
  }

  /* Cross beams connecting opposite pillars */
  for (let i = 0; i < 2; i++) {
    const a = (i / 4) * Math.PI * 2;
    const beam = mkMesh(
      new THREE.BoxGeometry(12.5, 0.5, 0.6),
      stoneDark, 0, 12.6, 0,
    );
    beam.rotation.y = a;
    beam.castShadow = true;
    G.scene!.add(beam);
  }

  /* Small decorative ring around the base */
  const ring = mkMesh(
    new THREE.TorusGeometry(8.4, 0.12, 6, 24),
    stoneDark, 0, 2.2, 0,
  );
  ring.rotation.x = Math.PI / 2;
  G.scene!.add(ring);

  /* Steps leading up */
  for (let s = 0; s < 3; s++) {
    const step = mkMesh(
      new THREE.BoxGeometry(3.5, 0.35, 1.2),
      stoneBase, 0, 0.35 + s * 0.35, 9.5 + s * 1.0,
    );
    step.receiveShadow = true;
    G.scene!.add(step);
  }

  /* Glowing center circle */
  const cg = mkMesh(
    new THREE.CylinderGeometry(2.6, 2.6, 0.08, 18),
    mkCelEmissiveMat(0x91dbff, 0x2c6f90, 1.0),
    0, 2.24, 0,
  );
  G.scene!.add(cg);

  /* Rune circles carved into the floor */
  const runeRing = mkMesh(
    new THREE.TorusGeometry(4.5, 0.06, 4, 32),
    mkCelEmissiveMat(0x80ccee, 0x206080, 0.5),
    0, 2.24, 0,
  );
  runeRing.rotation.x = Math.PI / 2;
  G.scene!.add(runeRing);
}

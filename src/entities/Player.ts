import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { mkMesh } from '../core/Helpers';
import { ui } from '../ui/UIRefs';

export function buildPlayer(): void {
  G.player = new THREE.Group();
  G.player.position.set(0, 5, 0);
  G.scene!.add(G.player);

  G.playerModel = new THREE.Group();
  G.player.add(G.playerModel);

  const bm = new THREE.MeshStandardMaterial({ color: 0xf5f7fb, flatShading: true });
  const am = new THREE.MeshStandardMaterial({ color: 0x7ae2ff, flatShading: true });
  const sk = new THREE.MeshStandardMaterial({ color: 0xffddb8, flatShading: true });
  const hm = new THREE.MeshStandardMaterial({ color: 0xd7ae6f, flatShading: true });
  const dm = new THREE.MeshStandardMaterial({ color: 0x303645, flatShading: true });
  G.pMats = { bm, am, sk, hm, dm };

  // Torso
  const torso = mkMesh(new THREE.BoxGeometry(0.72, 1.26, 0.42), bm, 0, 1.3, 0);
  torso.castShadow = true;
  G.playerModel.add(torso);
  G.playerModel.add(mkMesh(new THREE.BoxGeometry(0.78, 0.18, 0.46), am, 0, 1.2, 0));

  // Head
  const head = mkMesh(new THREE.SphereGeometry(0.38, 16, 16), sk, 0, 2.28, 0);
  head.castShadow = true;
  G.playerModel.add(head);
  G.playerModel.add(mkMesh(new THREE.ConeGeometry(0.43, 0.52, 8), hm, 0, 2.6, 0));

  // Limbs
  const lg = new THREE.BoxGeometry(0.24, 0.84, 0.24);
  const mkL = (x: number, y: number, m: THREE.MeshStandardMaterial): THREE.Group => {
    const p = new THREE.Group();
    p.position.set(x, y, 0);
    const l = new THREE.Mesh(lg, m);
    l.position.y = -0.42;
    l.castShadow = true;
    p.add(l);
    G.playerModel!.add(p);
    return p;
  };
  G.limbs.armL = mkL(-0.5, 1.82, sk);
  G.limbs.armR = mkL(0.5, 1.82, sk);
  G.limbs.legL = mkL(-0.2, 0.72, dm);
  G.limbs.legR = mkL(0.2, 0.72, dm);

  // Cape
  G.cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 1.55),
    new THREE.MeshStandardMaterial({
      color: 0x77dfff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.86,
      flatShading: true,
    }),
  );
  G.cape.position.set(0, 1.62, -0.27);
  G.cape.rotation.x = -0.08;
  G.playerModel.add(G.cape);

  // Glider
  G.glider = new THREE.Group();
  const wm = new THREE.MeshStandardMaterial({
    color: 0xf4f6fb,
    transparent: true,
    opacity: 0.84,
    flatShading: true,
  });
  const lw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.1), wm);
  lw.position.set(-1.66, 0, 0);
  lw.rotation.y = 0.22;
  G.glider.add(lw);
  const rw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.1), wm);
  rw.position.set(1.66, 0, 0);
  rw.rotation.y = -0.22;
  G.glider.add(rw);
  G.glider.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.5), am));
  G.glider.position.set(0, 2.02, -0.6);
  G.glider.visible = false;
  G.player.add(G.glider);

  // Sword
  G.swordPivot = new THREE.Group();
  G.swordPivot.position.set(0.72, 1.55, 0);
  const blade = mkMesh(
    new THREE.BoxGeometry(0.11, 1.9, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xb4c4d3, flatShading: true }),
    0,
    0.95,
    0,
  );
  blade.castShadow = true;
  G.swordPivot.add(blade);
  G.swordPivot.visible = false;
  G.player.add(G.swordPivot);
}

export function applyVisuals(): void {
  const m = mem();
  const ac = new THREE.Color(m.accent);
  G.pMats.am.color.copy(ac);
  (G.cape!.material as THREE.MeshStandardMaterial).color.copy(ac.clone().offsetHSL(0, 0, 0.05));
  G.pMats.hm.color.copy(ac.clone().lerp(new THREE.Color(0xffd58a), 0.55));
  ui.playerAvatar.textContent = m.portrait;
  (ui.playerAvatar as HTMLElement).style.background = `radial-gradient(circle at 35% 30%,${m.accent},rgba(8,15,30,0.92))`;
  ui.playerName.textContent = m.name;

  const glyphs: Record<string, string[]> = {
    Anemo: ['✦', '✹'],
    Electro: ['⚡', '✺'],
    Cryo: ['❄', '✸'],
    Pyro: ['🔥', '✷'],
  };
  ui.skillGlyph.textContent = glyphs[m.element][0];
  ui.burstGlyph.textContent = glyphs[m.element][1];
  ui.skillDescText.textContent = m.skillDesc;
  ui.burstDescText.textContent = m.burstDesc;
}

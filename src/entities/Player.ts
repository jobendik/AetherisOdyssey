import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { G, mem } from '../core/GameState';
import { mkMesh } from '../core/Helpers';
import { ui } from '../ui/UIRefs';

const ANIM_PATHS: Record<string, string> = {
  idle: '/models/animations/Idle.fbx',
  walk: '/models/animations/Walking.fbx',
  run: '/models/animations/Slow Run.fbx',
  jumpUp: '/models/animations/Jumping Up.fbx',
  jumpDown: '/models/animations/Jumping Down.fbx',
  land: '/models/animations/Falling To Landing.fbx',
  fly: '/models/animations/Flying.fbx',
};

export async function loadPlayerModel(): Promise<void> {
  const loader = new FBXLoader();

  /* ─── Load base model ─── */
  const fbx = await loader.loadAsync('/models/characters/player.fbx');

  /* Scale down — Mixamo FBX models are typically in cm */
  const desiredHeight = 2.5;
  const box = new THREE.Box3().setFromObject(fbx);
  const currentHeight = box.max.y - box.min.y;
  const scaleFactor = desiredHeight / currentHeight;
  fbx.scale.setScalar(scaleFactor);

  /* Center the model so feet are at Y=0 */
  fbx.updateMatrixWorld(true);
  const boxScaled = new THREE.Box3().setFromObject(fbx);
  fbx.position.y = -boxScaled.min.y;

  /* Enable shadows on all meshes */
  fbx.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  /* Replace the procedural playerModel with the loaded FBX */
  if (G.playerModel) {
    /* Remove all procedural children */
    while (G.playerModel.children.length) {
      G.playerModel.remove(G.playerModel.children[0]);
    }
    G.playerModel.add(fbx);
  }

  /* ─── Set up AnimationMixer ─── */
  G.mixer = new THREE.AnimationMixer(fbx);
  G.animActions = {};

  /* ─── Load animation clips ─── */
  const loadPromises = Object.entries(ANIM_PATHS).map(async ([name, path]) => {
    try {
      const animFbx = await loader.loadAsync(path);
      if (animFbx.animations.length > 0) {
        const clip = animFbx.animations[0];
        clip.name = name;
        const action = G.mixer!.clipAction(clip);

        /* Configure action defaults */
        if (name === 'jumpUp' || name === 'jumpDown' || name === 'land') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }

        G.animActions![name] = action;
      }
    } catch (e) {
      console.warn(`Failed to load animation: ${name}`, e);
    }
  });

  await Promise.all(loadPromises);

  /* Start with idle */
  if (G.animActions!.idle) {
    G.animActions!.idle.play();
    G.currentAnim = 'idle';
  }

  G.modelLoaded = true;
  console.log('✅ Player model + animations loaded');
}

export function buildPlayer(): void {
  G.player = new THREE.Group();
  G.player.position.set(0, 5, 0);
  G.scene!.add(G.player);

  G.playerModel = new THREE.Group();
  G.player.add(G.playerModel);

  /* Procedural fallback (shown until FBX loads) */
  const bm = new THREE.MeshStandardMaterial({ color: 0xf5f7fb, flatShading: true });
  const am = new THREE.MeshStandardMaterial({ color: 0x7ae2ff, flatShading: true });
  const sk = new THREE.MeshStandardMaterial({ color: 0xffddb8, flatShading: true });
  const hm = new THREE.MeshStandardMaterial({ color: 0xd7ae6f, flatShading: true });
  const dm = new THREE.MeshStandardMaterial({ color: 0x303645, flatShading: true });
  G.pMats = { bm, am, sk, hm, dm };

  /* Simple box placeholder torso */
  const torso = mkMesh(new THREE.BoxGeometry(0.72, 1.26, 0.42), bm, 0, 1.3, 0);
  torso.castShadow = true;
  G.playerModel.add(torso);

  /* Head */
  const head = mkMesh(new THREE.SphereGeometry(0.38, 16, 16), sk, 0, 2.28, 0);
  head.castShadow = true;
  G.playerModel.add(head);

  /* Limbs (needed for procedural fallback pose) */
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

  /* Cape */
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

  /* Glider (keep procedural — used regardless of model) */
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

  /* Sword pivot */
  G.swordPivot = new THREE.Group();
  G.swordPivot.position.set(0.72, 1.55, 0);
  const blade = mkMesh(
    new THREE.BoxGeometry(0.11, 1.9, 0.24),
    new THREE.MeshStandardMaterial({ color: 0xb4c4d3, flatShading: true }),
    0, 0.95, 0,
  );
  blade.castShadow = true;
  G.swordPivot.add(blade);
  G.swordPivot.visible = false;
  G.player.add(G.swordPivot);

  /* Kick off async model load (non-blocking) */
  loadPlayerModel().catch((e) => console.warn('Model load failed, using fallback:', e));
}

export function applyVisuals(): void {
  const m = mem();

  /* Only recolor procedural materials if model hasn't loaded yet */
  if (!G.modelLoaded) {
    const ac = new THREE.Color(m.accent);
    G.pMats.am.color.copy(ac);
    (G.cape!.material as THREE.MeshStandardMaterial).color.copy(
      ac.clone().offsetHSL(0, 0, 0.05),
    );
    G.pMats.hm.color.copy(ac.clone().lerp(new THREE.Color(0xffd58a), 0.55));
  }

  ui.playerAvatar.textContent = m.portrait;
  (ui.playerAvatar as HTMLElement).style.background =
    `radial-gradient(circle at 35% 30%,${m.accent},rgba(8,15,30,0.92))`;
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

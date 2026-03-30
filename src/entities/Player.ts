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
  attack1: '/models/animations/Attack1.fbx',
  attack2: '/models/animations/Attack2.fbx',
  attack3: '/models/animations/Attaxk3.fbx',
  hit: '/models/animations/Hit To Body.fbx',
  dash: '/models/animations/dash.fbx',
  skill: '/models/animations/Standing 2H Cast Spell 01.fbx',
  burst: '/models/animations/Wide Arm Spell Casting.fbx',
  death: '/models/animations/Standing React Death Backward.fbx',
};

export async function loadPlayerModel(): Promise<void> {
  const loader = new FBXLoader();

  /* ─── Load base model ─── */
  const fbx = await loader.loadAsync('/models/characters/player.fbx');

  /* Scale down — Mixamo FBX models are typically in cm */
  const desiredHeight = 3.5;
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
    /* Remove all procedural children (but save glider reference) */
    const savedGlider = G.glider;
    while (G.playerModel.children.length) {
      G.playerModel.remove(G.playerModel.children[0]);
    }
    G.playerModel.add(fbx);
    /* Re-attach glider to playerModel so it follows rotation */
    if (savedGlider) G.playerModel.add(savedGlider);
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
        if (
          ['jumpUp', 'jumpDown', 'land', 'attack1', 'attack2', 'attack3', 'hit', 'dash', 'skill', 'burst', 'death'].includes(name)
        ) {
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

  /* ─── Load Wings FBX model ─── */
  try {
    const wingsFbx = await loader.loadAsync('/models/glider/Wings.fbx');

    /* Load wing textures */
    const texLoader = new THREE.TextureLoader();
    const featherTex = texLoader.load('/models/glider/1_AcmbDMNBF2iG-hBpqi9ibg.png');
    const boneTex = texLoader.load('/models/glider/depositphotos_53726629-stock-photo-bone-seamless-texture-til.jpeg');

    /* Apply materials to wing meshes */
    wingsFbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        const name = mesh.name.toLowerCase();
        if (name.includes('bone') || name.includes('frame') || name.includes('arm')) {
          mesh.material = new THREE.MeshStandardMaterial({
            map: boneTex,
            flatShading: false,
            roughness: 0.8,
          });
        } else {
          mesh.material = new THREE.MeshStandardMaterial({
            map: featherTex,
            transparent: true,
            alphaTest: 0.3,
            side: THREE.DoubleSide,
            flatShading: false,
            roughness: 0.6,
          });
        }
      }
    });

    /* ─── Measure raw model ─── */
    wingsFbx.updateMatrixWorld(true);
    const wingsBox = new THREE.Box3().setFromObject(wingsFbx);
    const wSize = new THREE.Vector3();
    wingsBox.getSize(wSize);

    /* Scale: wingspan is X=26.3, target ~4.0 game units wide */
    const wScale = 4.0 / Math.max(wSize.x, 0.01);
    wingsFbx.scale.setScalar(wScale);

    /* Orientation: raw Y=feather length (up), need it along -Z (backward)
       Rotate -90° around X to swing Y→Z */
    wingsFbx.rotation.set(-Math.PI / 2, 0, 0);

    /* Center the wings after scale+rotation */
    wingsFbx.updateMatrixWorld(true);
    const centeredBox = new THREE.Box3().setFromObject(wingsFbx);
    const center = centeredBox.getCenter(new THREE.Vector3());
    wingsFbx.position.sub(center);

    /* Replace procedural glider contents */
    if (G.glider) {
      while (G.glider.children.length) {
        G.glider.remove(G.glider.children[0]);
      }
      G.glider.add(wingsFbx);
      /* Position on upper back — slightly behind player center */
      G.glider.position.set(0, 2.4, -0.5);
    }
    console.log('✅ Wings model loaded');
  } catch (e) {
    console.warn('Wings FBX load failed, keeping procedural glider:', e);
  }
}

export function buildPlayer(): void {
  G.player = new THREE.Group();
  G.player.position.set(0, 3, 0);
  G.player.scale.setScalar(1.3);
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
  G.playerModel.add(G.glider);

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

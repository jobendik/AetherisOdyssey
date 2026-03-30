import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { mkMesh, mkPointLight, wH, mkCelMat, mkCelEmissiveMat, distXZ } from '../core/Helpers';
import { SFX } from '../audio/Audio';
import { spawnParts, spawnRing } from '../systems/Particles';
import { ui } from '../ui/UIRefs';
import { gainXp } from '../systems/Progression';

/* ═══════════════════════════════════════
   Environmental Puzzle System
   - Torches (light with Pyro)
   - Pressure plates (stand on to activate)
   ═══════════════════════════════════════ */

interface Torch {
  mesh: THREE.Group;
  flame: THREE.Mesh | null;
  light: THREE.Sprite | null;
  lit: boolean;
  group: number; // puzzle group ID
}

interface PressurePlate {
  mesh: THREE.Mesh;
  active: boolean;
  group: number;
}

interface PuzzleGroup {
  id: number;
  torchCount: number;
  plateCount: number;
  solved: boolean;
  reward: THREE.Vector3;
}

const torches: Torch[] = [];
const plates: PressurePlate[] = [];
const groups: PuzzleGroup[] = [];
let rewardChests: THREE.Group[] = [];

/* ─── Torch placement data: [x, z, groupId] ─── */
const TORCH_DATA: [number, number, number][] = [
  /* Group 0: Triangle near shrine (3 torches) */
  [25, 55, 0], [35, 55, 0], [30, 65, 0],
  /* Group 1: Pair near bridge (2 torches) */
  [38, -25, 1], [52, -25, 1],
  /* Group 2: Line near ruins (3 torches) */
  [-35, -40, 2], [-40, -40, 2], [-45, -40, 2],
];

/* ─── Pressure plate data: [x, z, groupId] ─── */
const PLATE_DATA: [number, number, number][] = [
  /* Group 3: stepping stones near tower */
  [-55, 35, 3], [-50, 30, 3], [-45, 35, 3],
];

export function buildPuzzles(): void {
  const stoneM = mkCelMat(0x8a7e72, 0x7a6e62, 0.15);
  const metalM = mkCelMat(0xaaaaaa, 0x888888, 0.3);
  const bowlM = mkCelMat(0x554433, 0x443322, 0.1);

  /* Build torches */
  for (const [tx, tz, gid] of TORCH_DATA) {
    const ty = wH(tx, tz);
    const group = new THREE.Group();
    group.position.set(tx, ty, tz);

    /* Stone pillar */
    const pillar = mkMesh(new THREE.CylinderGeometry(0.3, 0.4, 2.5, 6), stoneM, 0, 1.25, 0);
    pillar.castShadow = true;
    group.add(pillar);

    /* Metal bowl on top */
    const bowl = mkMesh(new THREE.CylinderGeometry(0.5, 0.3, 0.4, 8), bowlM, 0, 2.6, 0);
    group.add(bowl);

    /* Metal spikes */
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const spike = mkMesh(
        new THREE.ConeGeometry(0.06, 0.5, 4),
        metalM,
        Math.cos(a) * 0.35, 2.9, Math.sin(a) * 0.35,
      );
      group.add(spike);
    }

    G.scene!.add(group);
    torches.push({ mesh: group, flame: null, light: null, lit: false, group: gid });
  }

  /* Build pressure plates */
  for (const [px, pz, gid] of PLATE_DATA) {
    const py = wH(px, pz);
    const plate = mkMesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.15, 8),
      stoneM,
      px, py + 0.08, pz,
    );
    plate.receiveShadow = true;
    G.scene!.add(plate);

    /* Glyph ring on top */
    const ring = mkMesh(
      new THREE.RingGeometry(0.6, 1.0, 16),
      new THREE.MeshBasicMaterial({ color: 0x666666, side: THREE.DoubleSide, transparent: true, opacity: 0.4 }),
      px, py + 0.16, pz,
    );
    ring.rotation.x = -Math.PI / 2;
    G.scene!.add(ring);

    plates.push({ mesh: plate, active: false, group: gid });
  }

  /* Register puzzle groups */
  const groupIds = new Set([...TORCH_DATA.map(d => d[2]), ...PLATE_DATA.map(d => d[2])]);
  for (const gid of groupIds) {
    const tc = TORCH_DATA.filter(d => d[2] === gid).length;
    const pc = PLATE_DATA.filter(d => d[2] === gid).length;
    /* Reward spawns at group center */
    const allPos = [...TORCH_DATA.filter(d => d[2] === gid), ...PLATE_DATA.filter(d => d[2] === gid)];
    const cx = allPos.reduce((s, d) => s + d[0], 0) / allPos.length;
    const cz = allPos.reduce((s, d) => s + d[1], 0) / allPos.length;
    groups.push({
      id: gid,
      torchCount: tc,
      plateCount: pc,
      solved: false,
      reward: new THREE.Vector3(cx, wH(cx, cz), cz),
    });
  }
}

function lightTorch(t: Torch): void {
  if (t.lit) return;
  t.lit = true;

  /* Flame mesh */
  const flameMat = mkCelEmissiveMat(0xff6622, 0xff4400, 1.5);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.8, 6), flameMat);
  flame.position.set(0, 3.1, 0);
  t.mesh.add(flame);
  t.flame = flame;

  /* Point light */
  const light = mkPointLight(0xff6622, 1.2, 12);
  light.position.set(0, 3.2, 0);
  t.mesh.add(light);
  t.light = light;

  SFX.swing(0); // fire whoosh
  spawnParts(t.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), '#ff6622', 8);
}

function checkGroup(gid: number): void {
  const grp = groups.find(g => g.id === gid);
  if (!grp || grp.solved) return;

  const litCount = torches.filter(t => t.group === gid && t.lit).length;
  const activeCount = plates.filter(p => p.group === gid && p.active).length;

  if (litCount >= grp.torchCount && activeCount >= grp.plateCount) {
    grp.solved = true;
    SFX.chest();
    spawnRing(grp.reward.clone().add(new THREE.Vector3(0, 1, 0)), '#ffd700', 8);

    /* Spawn reward chest */
    const chest = new THREE.Group();
    const body = mkMesh(
      new THREE.BoxGeometry(1.2, 0.8, 0.8),
      mkCelMat(0xdaa520, 0xb8860b, 0.2),
      0, 0.4, 0,
    );
    body.castShadow = true;
    chest.add(body);
    const lid = mkMesh(
      new THREE.BoxGeometry(1.3, 0.15, 0.85),
      mkCelMat(0xdaa520, 0xb8860b, 0.2),
      0, 0.85, 0,
    );
    chest.add(lid);
    chest.position.copy(grp.reward).setY(grp.reward.y + 0.01);
    G.scene!.add(chest);
    rewardChests.push(chest);

    /* Grant rewards */
    gainXp(30);
    G.mora += 150;

    /* Notification */
    const notif = document.createElement('div');
    notif.className = 'puzzleSolvedNotif';
    notif.textContent = '✦ Puzzle Solved! +30 XP +150 Mora';
    ui.uiRoot.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }
}

export function updatePuzzles(dt: number): void {
  if (!G.player) return;
  const pPos = G.player.position;
  const curElement = mem().element;

  /* Check torch interaction — Pyro skill/attack near unlit torch */
  for (const t of torches) {
    if (t.lit) continue;
    const d = distXZ(pPos, t.mesh.position);
    if (d < 4 && curElement === 'Pyro' && (G.skillTimer > 0 || G.atkTimer > 0)) {
      lightTorch(t);
      checkGroup(t.group);
    }

    /* Also check environmental fire reactions (Pyro projectiles) */
    for (const proj of G.projectiles) {
      if (distXZ(proj.mesh.position, t.mesh.position) < 2.5) {
        lightTorch(t);
        checkGroup(t.group);
      }
    }
  }

  /* Animate flames */
  for (const t of torches) {
    if (t.flame) {
      t.flame.scale.y = 0.9 + Math.sin(G.worldTime * 8 + t.mesh.position.x) * 0.15;
      t.flame.scale.x = t.flame.scale.z = 0.85 + Math.sin(G.worldTime * 6 + t.mesh.position.z) * 0.1;
    }
    if (t.light) {
      (t.light.material as THREE.SpriteMaterial).opacity = 0.4 + Math.sin(G.worldTime * 7 + t.mesh.position.x * 2) * 0.12;
    }
  }

  /* Check pressure plates — activated while player stands on them */
  for (const p of plates) {
    const d = distXZ(pPos, p.mesh.position);
    const wasActive = p.active;
    p.active = d < 1.5;

    if (p.active && !wasActive) {
      /* Press down */
      p.mesh.position.y -= 0.08;
      (p.mesh.material as THREE.MeshStandardMaterial).emissive?.set(0x44ff44);
      (p.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5;
      SFX.swing(1); // click sound
      spawnParts(p.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0)), '#44ff44', 4);
      checkGroup(p.group);
    } else if (!p.active && wasActive) {
      /* Release */
      p.mesh.position.y += 0.08;
      (p.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    }
  }
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh, mkLight, rwp, clamp } from '../core/Helpers';
import { ui } from '../ui/UIRefs';
import type { ChestLoot } from '../types';
import { SFX } from '../audio/Audio';
import { spawnParts } from '../systems/Particles';
import { spawnDmg } from '../ui/DamageNumbers';
import { gainXp } from '../systems/Progression';
import { saveMem } from '../core/GameState';
import { updateHUD } from '../ui/HUD';

const CHEST_LOOT: ChestLoot[] = [
  { t: 'weapon', id: 'w2' },
  { t: 'weapon', id: 'w3' },
  { t: 'artifact', id: 'a1' },
  { t: 'artifact', id: 'a2' },
  { t: 'artifact', id: 'a3' },
  { t: 'artifact', id: 'a4' },
  { t: 'artifact', id: 'a5' },
  { t: 'artifact', id: 'a6' },
  { t: 'food', id: 'f2' },
  { t: 'food', id: 'f2' },
  { t: 'food', id: 'f1' },
  { t: 'food', id: 'f1' },
  { t: 'food', id: 'f3' },
  { t: 'food', id: 'f2' },
];

export function populateChests(count: number): void {
  const cm = new THREE.MeshStandardMaterial({ color: 0xc4a35a, flatShading: true });
  const lm = new THREE.MeshStandardMaterial({ color: 0xd4b36a, flatShading: true });

  for (let i = 0; i < count; i++) {
    const { x, y, z } = rwp(16, 115, 0);
    const ch = new THREE.Group();
    ch.add(mkMesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), cm, 0, 0.35, 0));
    ch.add(mkMesh(new THREE.BoxGeometry(1.25, 0.3, 0.85), lm, 0, 0.85, 0));
    ch.add(
      mkMesh(
        new THREE.BoxGeometry(1.3, 0.06, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x886622, flatShading: true }),
        0,
        0.7,
        0,
      ),
    );
    ch.add(
      mkMesh(
        new THREE.BoxGeometry(0.15, 0.25, 0.15),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, flatShading: true }),
        0,
        0.55,
        0.42,
      ),
    );
    ch.add(mkLight(0xffdd66, 0.4, 8, 0, 1, 0) as unknown as THREE.Object3D);
    ch.position.set(x, y, z);
    ch.rotation.y = Math.random() * Math.PI * 2;
    ch.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    G.scene!.add(ch);
    G.entities.chests.push({
      mesh: ch,
      opened: false,
      mora: 30 + Math.floor(Math.random() * 50),
      xp: 15 + Math.floor(Math.random() * 20),
      loot: CHEST_LOOT[i % CHEST_LOOT.length],
    });
  }
}

export function openChest(ch: (typeof G.entities.chests)[number]): void {
  ch.opened = true;
  SFX.chest();
  spawnParts(ch.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), '#ffdd44', 30, 14);

  const lid = ch.mesh.children[1];
  if (lid) {
    lid.rotation.x = -1.2;
    lid.position.y = 1.1;
    lid.position.z = -0.3;
  }

  G.mora += ch.mora;
  gainXp(ch.xp);
  spawnDmg(
    ch.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)),
    ch.mora,
    '#ffdd44',
    false,
    '+' + ch.mora + ' Mora',
  );

  if (ch.loot) {
    const { t: type, id } = ch.loot;
    if (type === 'weapon' && !G.inventory.weapons.includes(id)) {
      G.inventory.weapons.push(id);
      setTimeout(
        () => spawnDmg(ch.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), 0, '#6af', false, 'New Weapon!'),
        600,
      );
    } else if (type === 'artifact' && !G.inventory.artifacts.includes(id)) {
      G.inventory.artifacts.push(id);
      setTimeout(
        () => spawnDmg(ch.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), 0, '#c8f', false, 'New Artifact!'),
        600,
      );
    } else if (type === 'food') {
      G.inventory.food.push(id);
    }
  }

  G.health = Math.min(G.maxHealth, G.health + 15);
  SFX.heal();
  updateHUD(true);
}

import * as THREE from 'three';
import { G } from '../core/GameState';
import { mkMesh, mkCelMat, rwp } from '../core/Helpers';
import { startDialogue } from '../ui/Dialogue';
import { ui } from '../ui/UIRefs';
import { SFX } from '../audio/Audio';
import { gainXp } from './Progression';

/* ═══════════════════════════════════════
   Side Quest System
   ═══════════════════════════════════════ */

interface SideQuest {
  id: string;
  name: string;
  giver: THREE.Group;
  giverPos: THREE.Vector3;
  intro: string[];
  complete: string[];
  objective: string;
  type: 'kill' | 'reach' | 'collect';
  target: number;
  progress: number;
  state: 'available' | 'active' | 'done';
  rewardXp: number;
  rewardMora: number;
  marker: THREE.Mesh | null;  // floating "!" or "?" above NPC head
  destPos?: THREE.Vector3;    // for reach quests
}

const sideQuests: SideQuest[] = [];
let questNotif: HTMLElement | null = null;

/* ──── Side quest NPC builder ──── */
function buildQuestNPC(pos: THREE.Vector3): THREE.Group {
  const npc = new THREE.Group();

  /* Body */
  const bodyMat = mkCelMat(0x5566aa, 0x4455aa, 0);
  const body = mkMesh(new THREE.CylinderGeometry(0.35, 0.4, 1.4, 8), bodyMat, 0, 0.7, 0);
  body.castShadow = true;
  npc.add(body);

  /* Head */
  const headMat = mkCelMat(0xf0c8a0, 0xe0b890, 0.1);
  const head = mkMesh(new THREE.SphereGeometry(0.3, 8, 8), headMat, 0, 1.75, 0);
  head.castShadow = true;
  npc.add(head);

  /* Hat */
  const hatMat = mkCelMat(0x8855aa, 0x7744aa, 0);
  const hat = mkMesh(new THREE.ConeGeometry(0.35, 0.5, 6), hatMat, 0, 2.25, 0);
  npc.add(hat);

  npc.position.copy(pos);
  G.scene!.add(npc);
  return npc;
}

function buildMarker(npc: THREE.Group, symbol: '!' | '?'): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = symbol === '!' ? '#ffd54f' : '#66bbff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 32, 32);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.8, 0.8, 1);
  sprite.position.set(0, 3.0, 0);
  npc.add(sprite);
  return sprite as unknown as THREE.Mesh;
}

/* ──── Quest definitions ──── */
export function initSideQuests(): void {
  /* Quest 1: Hunter — Kill 5 enemies */
  const pos1 = new THREE.Vector3(25, 0, -20);
  pos1.y = getTerrainH(pos1.x, pos1.z);
  const npc1 = buildQuestNPC(pos1);
  sideQuests.push({
    id: 'hunter',
    name: 'Monster Hunter',
    giver: npc1,
    giverPos: pos1,
    intro: [
      'Traveler! These beasts have been terrorizing our village.',
      'Could you eliminate 5 of them? I\'ll reward you handsomely.',
    ],
    complete: [
      'You did it! The village is safe again. Thank you, hero!',
    ],
    objective: 'Defeat 5 enemies (Side Quest)',
    type: 'kill',
    target: 5,
    progress: 0,
    state: 'available',
    rewardXp: 40,
    rewardMora: 200,
    marker: null,
  });

  /* Quest 2: Explorer — Reach the old ruins */
  const pos2 = new THREE.Vector3(-30, 0, 25);
  pos2.y = getTerrainH(pos2.x, pos2.z);
  const npc2 = buildQuestNPC(pos2);
  const destRuins = new THREE.Vector3(65, 0, 50);
  destRuins.y = getTerrainH(destRuins.x, destRuins.z);
  sideQuests.push({
    id: 'explorer',
    name: 'Lost Explorer',
    giver: npc2,
    giverPos: pos2,
    intro: [
      'I\'ve heard rumors of ancient ruins to the east.',
      'Could you scout the area and report back? Here, take this map fragment.',
    ],
    complete: [
      'So the ruins are real! This confirms the old legends. Thank you!',
    ],
    objective: 'Reach the ancient ruins',
    type: 'reach',
    target: 1,
    progress: 0,
    state: 'available',
    rewardXp: 35,
    rewardMora: 150,
    marker: null,
    destPos: destRuins,
  });

  /* Quest 3: Collector — Kill 10 enemies */
  const pos3 = new THREE.Vector3(15, 0, 40);
  pos3.y = getTerrainH(pos3.x, pos3.z);
  const npc3 = buildQuestNPC(pos3);
  sideQuests.push({
    id: 'slayer',
    name: 'Bounty Board',
    giver: npc3,
    giverPos: pos3,
    intro: [
      'Adventurer! The guild has posted a bounty.',
      'Eliminate 10 monsters and claim your reward at the board.',
    ],
    complete: [
      'All targets confirmed eliminated. Here\'s your bounty payment!',
    ],
    objective: 'Defeat 10 enemies (Bounty)',
    type: 'kill',
    target: 10,
    progress: 0,
    state: 'available',
    rewardXp: 60,
    rewardMora: 350,
    marker: null,
  });

  /* Build initial markers */
  for (const q of sideQuests) {
    q.marker = buildMarker(q.giver, '!');
  }
}

/* Terrain height helper (avoids circular import) */
function getTerrainH(x: number, z: number): number {
  // Simple approximation — match wH() behavior
  const d = Math.sqrt(x * x + z * z);
  if (d > 130) return -4;
  return Math.sin(x * 0.03) * 2 + Math.cos(z * 0.04) * 1.5 + 0.5;
}

/* ──── Interaction ──── */
export function trySideQuestInteract(): boolean {
  if (!G.player) return false;

  for (const q of sideQuests) {
    const dist = G.player.position.distanceTo(q.giverPos);
    if (dist > 4.2) continue;

    if (q.state === 'available') {
      startDialogue(q.intro);
      q.state = 'active';
      /* Replace ! with nothing while active */
      if (q.marker) { q.giver.remove(q.marker); q.marker = null; }
      showQuestNotif(`Quest Accepted: ${q.name}`);
      SFX.questComplete();
      return true;
    }

    if (q.state === 'active' && q.progress >= q.target) {
      startDialogue(q.complete);
      q.state = 'done';
      gainXp(q.rewardXp);
      G.mora += q.rewardMora;
      showQuestNotif(`Quest Complete: ${q.name} (+${q.rewardXp} XP, +${q.rewardMora} Mora)`);
      SFX.questComplete();
      /* Show ? then remove */
      if (q.marker) { q.giver.remove(q.marker); q.marker = null; }
      return true;
    }

    if (q.state === 'active') {
      startDialogue([`You still need to ${q.objective}. (${q.progress}/${q.target})`]);
      return true;
    }

    if (q.state === 'done') {
      startDialogue(['Thanks again for your help, traveler!']);
      return true;
    }
  }
  return false;
}

/* ──── Progress tracking ──── */
export function onSideQuestKill(): void {
  for (const q of sideQuests) {
    if (q.state === 'active' && q.type === 'kill' && q.progress < q.target) {
      q.progress++;
      if (q.progress >= q.target) {
        showQuestNotif(`${q.name}: Return to quest giver`);
        q.marker = buildMarker(q.giver, '?');
      }
    }
  }
}

export function updateSideQuests(): void {
  if (!G.player) return;

  /* Check reach quests */
  for (const q of sideQuests) {
    if (q.state === 'active' && q.type === 'reach' && q.destPos) {
      const dist = G.player.position.distanceTo(q.destPos);
      if (dist < 8 && q.progress < q.target) {
        q.progress = q.target;
        showQuestNotif(`${q.name}: Location found! Return to quest giver`);
        q.marker = buildMarker(q.giver, '?');
      }
    }
  }

  /* Bob markers */
  for (const q of sideQuests) {
    if (q.marker) {
      q.marker.position.y = 3.0 + Math.sin(G.worldTime * 3) * 0.15;
    }
  }
}

export function canInteractSideQuest(): boolean {
  if (!G.player) return false;
  for (const q of sideQuests) {
    if (G.player.position.distanceTo(q.giverPos) < 4.2) return true;
  }
  return false;
}

export function getSideQuests() { return sideQuests; }

/* ──── UI notification ──── */
function showQuestNotif(text: string): void {
  if (questNotif) questNotif.remove();
  questNotif = document.createElement('div');
  questNotif.className = 'sideQuestNotif';
  questNotif.textContent = text;
  ui.uiRoot.appendChild(questNotif);
  setTimeout(() => { if (questNotif) questNotif.remove(); questNotif = null; }, 3500);
}

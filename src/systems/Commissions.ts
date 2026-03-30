import * as THREE from 'three';
import { G, mem } from '../core/GameState';
import { wH, distXZ, rwp } from '../core/Helpers';
import { ui } from '../ui/UIRefs';
import { gainXp } from './Progression';
import { SFX } from '../audio/Audio';
import { spawnParts } from './Particles';

/* ═══════════════════════════════════════
   Daily Commissions System
   ═══════════════════════════════════════ */

export type CommType = 'kill' | 'reach' | 'timer' | 'collect';

export interface Commission {
  type: CommType;
  title: string;
  desc: string;
  target: number;
  progress: number;
  done: boolean;
  rewardXp: number;
  rewardMora: number;
  /* For 'reach' / 'timer' types */
  goalPos?: THREE.Vector3;
  goalRadius?: number;
  /* For 'timer' type */
  timeLimit?: number;
  elapsed?: number;
  started?: boolean;
}

const KILL_TEMPLATES = [
  { title: 'Slime Sweep', desc: 'Defeat {n} slimes', base: 3 },
  { title: 'Pest Control', desc: 'Defeat {n} enemies', base: 5 },
  { title: 'Elite Hunt', desc: 'Defeat {n} elite enemies', base: 1 },
];

const REACH_TEMPLATES = [
  { title: 'Scenic Route', desc: 'Reach the marked location' },
  { title: 'Scout Ahead', desc: 'Investigate the distant point' },
  { title: 'Hilltop View', desc: 'Climb to the overlook' },
];

const TIMER_TEMPLATES = [
  { title: 'Speed Trial', desc: 'Reach the goal within {t}s', time: 30 },
  { title: 'Rush Order', desc: 'Sprint to the marker in {t}s', time: 25 },
];

let commissions: Commission[] = [];
let commDay = -1;
let commUI: HTMLElement | null = null;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateCommissions(): void {
  /* Use day number as seed for reproducible daily quests */
  const dayNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  if (dayNum === commDay) return;
  commDay = dayNum;
  commissions = [];

  const rng = seededRandom(dayNum);

  /* 4 commissions per day */
  /* 1. Kill commission */
  const kIdx = Math.floor(rng() * KILL_TEMPLATES.length);
  const kT = KILL_TEMPLATES[kIdx];
  const kn = kT.base + Math.floor(rng() * 3);
  commissions.push({
    type: 'kill',
    title: kT.title,
    desc: kT.desc.replace('{n}', String(kn)),
    target: kn,
    progress: 0,
    done: false,
    rewardXp: 20 + kn * 5,
    rewardMora: 50 + kn * 15,
  });

  /* 2. Reach commission */
  const rIdx = Math.floor(rng() * REACH_TEMPLATES.length);
  const rT = REACH_TEMPLATES[rIdx];
  const rPos = rwp(20, 90, 0);
  commissions.push({
    type: 'reach',
    title: rT.title,
    desc: rT.desc,
    target: 1,
    progress: 0,
    done: false,
    rewardXp: 25,
    rewardMora: 80,
    goalPos: new THREE.Vector3(rPos.x, rPos.y, rPos.z),
    goalRadius: 5,
  });

  /* 3. Timer trial */
  const tIdx = Math.floor(rng() * TIMER_TEMPLATES.length);
  const tT = TIMER_TEMPLATES[tIdx];
  const tPos = rwp(15, 80, 0);
  commissions.push({
    type: 'timer',
    title: tT.title,
    desc: tT.desc.replace('{t}', String(tT.time)),
    target: 1,
    progress: 0,
    done: false,
    rewardXp: 35,
    rewardMora: 120,
    goalPos: new THREE.Vector3(tPos.x, tPos.y, tPos.z),
    goalRadius: 5,
    timeLimit: tT.time,
    elapsed: 0,
    started: false,
  });

  /* 4. Collect commission */
  commissions.push({
    type: 'collect',
    title: 'Treasure Hunter',
    desc: `Open ${2 + Math.floor(rng() * 2)} chests`,
    target: 2 + Math.floor(rng() * 2),
    progress: 0,
    done: false,
    rewardXp: 20,
    rewardMora: 60,
  });
}

function buildCommUI(): void {
  if (commUI) commUI.remove();
  commUI = document.createElement('div');
  commUI.id = 'commPanel';
  commUI.innerHTML = '<div class="commTitle">Daily Commissions</div>';
  for (let i = 0; i < commissions.length; i++) {
    const c = commissions[i];
    const row = document.createElement('div');
    row.className = 'commRow' + (c.done ? ' commDone' : '');
    row.id = `comm${i}`;
    row.innerHTML = `
      <span class="commCheck">${c.done ? '✓' : '○'}</span>
      <span class="commInfo">
        <strong>${c.title}</strong><br>
        <small>${c.desc}</small>
      </span>
      <span class="commProg">${c.done ? 'Done' : `${c.progress}/${c.target}`}</span>
    `;
    commUI.appendChild(row);
  }
  ui.uiRoot.appendChild(commUI);
}

function refreshCommUI(): void {
  for (let i = 0; i < commissions.length; i++) {
    const c = commissions[i];
    const row = document.getElementById(`comm${i}`);
    if (!row) continue;
    row.className = 'commRow' + (c.done ? ' commDone' : '');
    row.innerHTML = `
      <span class="commCheck">${c.done ? '✓' : '○'}</span>
      <span class="commInfo">
        <strong>${c.title}</strong><br>
        <small>${c.desc}</small>
      </span>
      <span class="commProg">${c.done ? 'Done' : `${c.progress}/${c.target}`}</span>
    `;
  }
}

function completeComm(c: Commission): void {
  if (c.done) return;
  c.done = true;
  gainXp(c.rewardXp);
  G.mora += c.rewardMora;
  SFX.questComplete();
  if (G.player) spawnParts(G.player.position.clone().add(new THREE.Vector3(0, 2, 0)), '#ffd700', 12);

  const notif = document.createElement('div');
  notif.className = 'commCompleteNotif';
  notif.textContent = `✦ ${c.title} Complete! +${c.rewardXp} XP +${c.rewardMora} Mora`;
  ui.uiRoot.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
  refreshCommUI();
}

/* Track enemy kills from outside */
export function onEnemyKilled(isElite: boolean): void {
  for (const c of commissions) {
    if (c.done) continue;
    if (c.type === 'kill') {
      if (c.desc.includes('elite') && !isElite) continue;
      c.progress = Math.min(c.progress + 1, c.target);
      if (c.progress >= c.target) completeComm(c);
    }
  }
  refreshCommUI();
}

export function onChestOpened(): void {
  for (const c of commissions) {
    if (c.done || c.type !== 'collect') continue;
    c.progress = Math.min(c.progress + 1, c.target);
    if (c.progress >= c.target) completeComm(c);
  }
  refreshCommUI();
}

export function initCommissions(): void {
  generateCommissions();
  buildCommUI();
}

export function updateCommissions(dt: number): void {
  if (!G.player) return;

  for (const c of commissions) {
    if (c.done) continue;

    if (c.type === 'reach' && c.goalPos) {
      if (distXZ(G.player.position, c.goalPos) < (c.goalRadius || 5)) {
        c.progress = c.target;
        completeComm(c);
      }
    }

    if (c.type === 'timer' && c.goalPos) {
      /* Start timer when player is near start (within 15 units) */
      if (!c.started && distXZ(G.player.position, c.goalPos) < 20) {
        c.started = true;
        c.elapsed = 0;
      }
      if (c.started && !c.done) {
        c.elapsed = (c.elapsed || 0) + dt;
        if (distXZ(G.player.position, c.goalPos) < (c.goalRadius || 5)) {
          c.progress = c.target;
          completeComm(c);
        } else if (c.elapsed > (c.timeLimit || 30)) {
          /* Failed — reset */
          c.started = false;
          c.elapsed = 0;
        }
      }
    }
  }
}

export function getCommissions(): Commission[] {
  return commissions;
}

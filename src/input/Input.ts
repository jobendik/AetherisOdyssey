import { G, keys } from '../core/GameState';
import { clamp, distXZ } from '../core/Helpers';
import type { EnemyEntity } from '../types';
import { ui } from '../ui/UIRefs';
import { ensureAudio, scheduleAmbient, SFX } from '../audio/Audio';
import { performAttack, releaseCharge } from '../combat/Attack';
import { useSkill } from '../combat/Skills';
import { useBurst } from '../combat/Burst';
import { toggleInv } from '../ui/InventoryUI';
import { switchParty } from '../ui/HUD';
import { handleJump, performDash } from '../systems/Movement';
import { startDialogue, advanceDialogue } from '../ui/Dialogue';
import { DIALOGUE } from '../data/DialogueData';
import { openChest } from '../world/Chests';
import { createBoss } from '../entities/Boss';
import { respawn } from '../combat/DamageSystem';
import { rwp } from '../core/Helpers';
import { toggleWaypointUI } from '../world/Waypoints';
import { toggleAchievementPanel } from '../systems/Achievements';
import { trySideQuestInteract, canInteractSideQuest } from '../systems/SideQuests';
import { toggleCharacterDetail, isCharDetailOpen } from '../ui/CharacterDetail';
import { toggleMapScreen, isMapOpen, closeMapScreen } from '../ui/MapScreen';
import { togglePerfHud } from '../ui/PerfHud';
import { toggleTalentPanel, isTalentPanelOpen } from '../systems/Talents';
import { openSettings, isSettingsOpen, closeSettings, loadSettings, settings } from '../ui/Settings';
import { nearCampfire, openCookingUI, closeCookingUI, isCookingOpen } from '../systems/Cooking';
import { nearViewpoint, activateViewpoint } from '../world/Landmarks';
import { toggleConstellationPanel, isConstellationPanelOpen } from '../systems/Constellations';
import { nearFishSpot, startFishing, isFishingOpen, closeFishingUI } from '../systems/Fishing';

/* ─── Pause menu ─── */
let pauseEl: HTMLElement | null = null;

function togglePause(): void {
  if (pauseEl) {
    closePause();
    return;
  }
  SFX.menuOpen();
  G.isActive = false;
  keys.w = keys.a = keys.s = keys.d = 0;
  document.exitPointerLock();

  const overlay = document.createElement('div');
  overlay.id = 'pauseOverlay';
  overlay.innerHTML = `
    <div class="pauseTitle">PAUSED</div>
    <div class="pauseMenu">
      <button class="pauseBtn" id="pauseResume">Resume</button>
      <button class="pauseBtn" id="pauseSettings">Settings</button>
      <button class="pauseBtn" id="pauseWaypoints">Waypoints</button>
    </div>
    <div class="pauseControls">
      <div><span class="key">WASD</span> Move</div><div><span class="key">Mouse</span> Look</div>
      <div><span class="key">Space</span> Jump / Glide</div><div><span class="key">Shift</span> Sprint</div>
      <div><span class="key">LMB</span> Attack</div><div><span class="key">RMB</span> Dodge</div>
      <div><span class="key">E</span> Skill</div><div><span class="key">Q</span> Burst</div>
      <div><span class="key">F</span> Interact</div><div><span class="key">T</span> Lock-on</div>
      <div><span class="key">Tab</span> Inventory</div><div><span class="key">M</span> Map</div>
      <div><span class="key">1-4</span> Party</div><div><span class="key">C</span> Character</div>
      <div><span class="key">N</span> Talents</div><div><span class="key">B</span> Constellations</div><div><span class="key">Esc</span> Pause</div>
    </div>
  `;
  document.body.appendChild(overlay);
  pauseEl = overlay;

  overlay.querySelector('#pauseResume')!.addEventListener('click', closePause);
  overlay.querySelector('#pauseSettings')!.addEventListener('click', () => {
    openSettings();
  });
  overlay.querySelector('#pauseWaypoints')!.addEventListener('click', () => {
    closePause();
    toggleWaypointUI();
  });
}

function closePause(): void {
  if (!pauseEl) return;
  SFX.menuClose();
  pauseEl.remove();
  pauseEl = null;
  if (!G.mobile) {
    document.body.requestPointerLock();
  } else {
    G.isActive = true;
  }
}

function canInteract(): string | false {
  if (canInteractSideQuest()) return 'sidequest';
  if (G.npc && G.player!.position.distanceTo(G.npc.position) < 4.2) return 'npc';
  for (const ch of G.entities.chests) {
    if (!ch.opened && G.player!.position.distanceTo(ch.mesh.position) < 3.5) return 'chest';
  }
  if (nearCampfire()) return 'campfire';
  if (nearViewpoint()) return 'viewpoint';
  if (nearFishSpot()) return 'fish';
  return false;
}

function toggleLockOn(): void {
  if (G.lockOnTarget) {
    G.lockOnTarget = null;
    return;
  }
  /* Find nearest alive enemy within 30 units */
  let best: EnemyEntity | null = null;
  let bestD = 30;
  for (const s of G.entities.slimes) {
    if (s.dead) continue;
    const d = distXZ(s.mesh.position, G.player!.position);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  G.lockOnTarget = best;
}

function handleInteract(): void {
  const t = canInteract();
  if (!t) return;

  if (t === 'sidequest') {
    trySideQuestInteract();
    return;
  }

  if (t === 'chest') {
    for (const ch of G.entities.chests) {
      if (!ch.opened && G.player!.position.distanceTo(ch.mesh.position) < 3.5) {
        openChest(ch);
        return;
      }
    }
    return;
  }

  if (t === 'campfire') {
    openCookingUI();
    return;
  }

  if (t === 'viewpoint') {
    activateViewpoint();
    return;
  }

  if (t === 'fish') {
    startFishing();
    return;
  }

  if (G.questPhase >= 2 && G.questPhase < 4) {
    startDialogue(DIALOGUE.complete);
    if (G.questPhase === 2) {
      G.questPhase = 3;
      ui.objectiveText.textContent = 'Defeat King Slime';
      ui.objectiveSubtext.textContent = 'Find it near the Ruined Gate!';
      const pt = rwp(55, 75, 2);
      createBoss(pt.x, pt.y, pt.z);
    }
    return;
  }

  if (G.questPhase >= 4) {
    startDialogue(DIALOGUE.victory);
    G.questPhase = 5;
    ui.objectiveText.textContent = 'Explore freely!';
    ui.objectiveSubtext.textContent = 'Keep fighting.';
    return;
  }

  startDialogue(DIALOGUE.intro);
}

export function startGame(): void {
  ensureAudio();
  G.hasStarted = true;
  if (G.mobile) {
    G.isActive = true;
    ui.startScreen.style.display = 'none';
    scheduleAmbient();
  } else {
    document.body.requestPointerLock();
    scheduleAmbient();
  }
}

export { canInteract };

export function setupInput(): void {
  loadSettings();
  ui.startBtn.addEventListener('click', startGame);
  ui.respawnBtn.addEventListener('click', () => {
    respawn();
  });
  ui.bagBtn.addEventListener('click', toggleInv);
  ui.invClose.addEventListener('click', toggleInv);

  if (!G.mobile) {
    document.addEventListener('pointerlockchange', () => {
      if (G.mobile) return;
      const lk = document.pointerLockElement === document.body;
      if (lk) {
        G.isActive = true;
        ui.startScreen.style.display = 'none';
        ui.deathScreen.style.display = 'none';
        if (G.needsAmbient) scheduleAmbient();
      } else if (G.hasStarted && G.health > 0 && !G.invOpen && !pauseEl) {
        G.isActive = false;
        keys.w = keys.a = keys.s = keys.d = 0;
        ui.startScreen.style.display = 'flex';
        ui.startScreen.querySelector('p')!.textContent =
          'Paused. Click Enter World to resume.';
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (!G.hasStarted) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (isCookingOpen()) { closeCookingUI(); return; }
      if (isFishingOpen()) { closeFishingUI(); return; }
      if (G.invOpen) { toggleInv(); return; }
      if (isCharDetailOpen()) { toggleCharacterDetail(); return; }
      if (isMapOpen()) { closeMapScreen(); return; }
      if (isTalentPanelOpen()) { toggleTalentPanel(); return; }
      if (isConstellationPanelOpen()) { toggleConstellationPanel(); return; }
      if (isSettingsOpen()) { closeSettings(); return; }
      togglePause();
      return;
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      toggleInv();
      return;
    }
    if (G.invOpen) return;
    if (e.code === 'KeyW') keys.w = 1;
    if (e.code === 'KeyA') keys.a = 1;
    if (e.code === 'KeyS') keys.s = 1;
    if (e.code === 'KeyD') keys.d = 1;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      keys.shift = 1;
    }
    if (e.code === 'Space') {
      keys.space = 1;
      if (G.isActive) handleJump();
    }
    if (e.code === 'KeyF' && G.isActive) handleInteract();
    if (e.code === 'KeyE' && G.isActive && !G.inDialogue) useSkill();
    if (e.code === 'KeyQ' && G.isActive && !G.inDialogue) useBurst();
    if (e.code === 'KeyT' && G.isActive && !G.inDialogue) toggleLockOn();
    if (e.code === 'KeyM' && G.isActive && !G.inDialogue) toggleMapScreen();
    if (e.code === 'KeyJ' && G.isActive && !G.inDialogue) toggleAchievementPanel();
    if (e.code === 'KeyC' && G.isActive && !G.inDialogue) toggleCharacterDetail();
    if (e.code === 'F3') { e.preventDefault(); togglePerfHud(); }
    if (e.code === 'KeyN' && G.isActive && !G.inDialogue) toggleTalentPanel();
    if (e.code === 'KeyB' && G.isActive && !G.inDialogue) toggleConstellationPanel();
    if (e.code === 'Digit1') switchParty(0);
    if (e.code === 'Digit2') switchParty(1);
    if (e.code === 'Digit3') switchParty(2);
    if (e.code === 'Digit4') switchParty(3);
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') keys.w = 0;
    if (e.code === 'KeyA') keys.a = 0;
    if (e.code === 'KeyS') keys.s = 0;
    if (e.code === 'KeyD') keys.d = 0;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = 0;
    if (e.code === 'Space') keys.space = 0;
  });

  document.addEventListener('mousemove', (e) => {
    if (!G.isActive || G.inDialogue || G.mobile || G.invOpen) return;
    G.camYaw -= e.movementX * 0.0022 * settings.mouseSens;
    G.camPitch += e.movementY * 0.002 * settings.mouseSens;
    G.camPitch = clamp(G.camPitch, -1.42, 1.45);
  });

  document.addEventListener('contextmenu', (e) => {
    if (G.hasStarted) e.preventDefault();
  });

  document.addEventListener('mousedown', (e) => {
    if (!G.hasStarted || G.invOpen) return;
    if (
      !G.mobile &&
      !G.isActive &&
      document.pointerLockElement !== document.body &&
      G.health > 0
    ) {
      document.body.requestPointerLock();
      return;
    }
    if (!G.isActive) return;
    if (e.button === 2) {
      if (!G.inDialogue && G.dashCd <= 0 && G.stamina > 15 && !G.isDashing)
        performDash();
      return;
    }
    if (e.button === 1) {
      e.preventDefault();
      toggleLockOn();
      return;
    }
    if (e.button !== 0) return;
    if (G.inDialogue) advanceDialogue();
    else {
      performAttack();
      G.isCharging = true;
      G.chargeTimer = 0;
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0 && G.isCharging) {
      releaseCharge();
    }
  });

  // Touch
  const tc = {
    lId: null as number | null,
    rId: null as number | null,
    lO: { x: 0, y: 0 },
    rO: { x: 0, y: 0 },
    rL: { x: 0, y: 0 },
    rM: false,
  };

  document.addEventListener(
    'touchstart',
    (e) => {
      if (!G.hasStarted) {
        startGame();
        return;
      }
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.5 && tc.lId === null) {
          tc.lId = t.identifier;
          tc.lO = { x: t.clientX, y: t.clientY };
        } else if (tc.rId === null) {
          tc.rId = t.identifier;
          tc.rO = tc.rL = { x: t.clientX, y: t.clientY };
          tc.rM = false;
        }
      }
    },
    { passive: false },
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (!G.isActive) return;
      for (const t of e.changedTouches) {
        if (t.identifier === tc.lId) {
          const dx = t.clientX - tc.lO.x;
          const dy = t.clientY - tc.lO.y;
          keys.w = dy < -18 ? 1 : 0;
          keys.s = dy > 18 ? 1 : 0;
          keys.a = dx < -18 ? 1 : 0;
          keys.d = dx > 18 ? 1 : 0;
        }
        if (t.identifier === tc.rId) {
          const dx = t.clientX - tc.rL.x;
          const dy = t.clientY - tc.rL.y;
          tc.rM =
            tc.rM ||
            Math.abs(t.clientX - tc.rO.x) > 12 ||
            Math.abs(t.clientY - tc.rO.y) > 12;
          G.camYaw -= dx * 0.006;
          G.camPitch += dy * 0.006;
          G.camPitch = clamp(G.camPitch, -1.42, 1.45);
          tc.rL = { x: t.clientX, y: t.clientY };
        }
      }
    },
    { passive: false },
  );

  document.addEventListener(
    'touchend',
    (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === tc.lId) {
          tc.lId = null;
          keys.w = keys.a = keys.s = keys.d = 0;
        }
        if (t.identifier === tc.rId) {
          if (!tc.rM) {
            if (G.inDialogue) advanceDialogue();
            else if (canInteract()) handleInteract();
            else performAttack();
          }
          tc.rId = null;
        }
      }
    },
    { passive: false },
  );
}

import { G, keys } from '../core/GameState';
import { clamp } from '../core/Helpers';
import { ui } from '../ui/UIRefs';
import { ensureAudio, scheduleAmbient } from '../audio/Audio';
import { performAttack } from '../combat/Attack';
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

function canInteract(): string | false {
  if (G.npc && G.player!.position.distanceTo(G.npc.position) < 4.2) return 'npc';
  for (const ch of G.entities.chests) {
    if (!ch.opened && G.player!.position.distanceTo(ch.mesh.position) < 3.5) return 'chest';
  }
  return false;
}

function handleInteract(): void {
  const t = canInteract();
  if (!t) return;

  if (t === 'chest') {
    for (const ch of G.entities.chests) {
      if (!ch.opened && G.player!.position.distanceTo(ch.mesh.position) < 3.5) {
        openChest(ch);
        return;
      }
    }
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
      } else if (G.hasStarted && G.health > 0 && !G.invOpen) {
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
      if (G.isActive && !G.inDialogue && G.dashCd <= 0 && G.stamina > 15 && !G.isDashing)
        performDash();
    }
    if (e.code === 'Space') {
      keys.space = 1;
      if (G.isActive) handleJump();
    }
    if (e.code === 'KeyF' && G.isActive) handleInteract();
    if (e.code === 'KeyE' && G.isActive && !G.inDialogue) useSkill();
    if (e.code === 'KeyQ' && G.isActive && !G.inDialogue) useBurst();
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
    G.camYaw -= e.movementX * 0.0022;
    G.camPitch += e.movementY * 0.002;
    G.camPitch = clamp(G.camPitch, -1.42, 1.45);
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
    if (!G.isActive || e.button !== 0) return;
    if (G.inDialogue) advanceDialogue();
    else performAttack();
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

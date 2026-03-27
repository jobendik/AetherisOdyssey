import * as THREE from 'three';
import '../styles/game.css';

/* ─── Core ─── */
import { G, loadMem } from './core/GameState';
import { setupLighting, updateDayNight } from './core/Scene';
import { updateCamera, onResize } from './core/Camera';

/* ─── UI ─── */
import { initUI } from './ui/UIRefs';
import { ui } from './ui/UIRefs';
import { buildPartyHud, updateHUD, updateTargetSel } from './ui/HUD';
import { updateMinimap } from './ui/Minimap';

/* ─── World ─── */
import { buildTerrain } from './world/Terrain';
import { buildWater, updateWater } from './world/Water';
import { buildSpawnRuin } from './world/SpawnRuin';
import { buildLandmarks } from './world/Landmarks';
import { populateTrees, populateRocks, populateFlowers } from './world/Vegetation';
import { populateCollectibles, updateCollectibles } from './world/Collectibles';
import { populateChests } from './world/Chests';
import { buildGuideNPC } from './entities/NPC';

/* ─── Entities ─── */
import { buildPlayer, applyVisuals } from './entities/Player';
import { populateEnemies, updateEnemies } from './entities/Enemy';
import { updateBoss } from './entities/Boss';

/* ─── Systems ─── */
import { updateMovement, updateTimers } from './systems/Movement';
import { updatePose } from './systems/Animation';
import { updateParticles, updateWindParts } from './systems/Particles';
import { resetCombo } from './combat/Combo';
import { updateProjectiles } from './combat/Projectiles';
import { updateTornado } from './combat/Burst';

/* ─── Input ─── */
import { setupInput, canInteract } from './input/Input';

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */

function init(): void {
  initUI();

  /* Three.js setup */
  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x83b7de);
  G.scene.fog = new THREE.FogExp2(0x83b7de, 0.008);
  G.cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
  G.rend = new THREE.WebGLRenderer({ antialias: true });
  G.rend.setSize(innerWidth, innerHeight);
  G.rend.setPixelRatio(Math.min(devicePixelRatio, 2));
  G.rend.shadowMap.enabled = true;
  G.rend.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(G.rend.domElement);
  G.clock = new THREE.Clock();

  /* Build world */
  setupLighting();
  buildTerrain();
  buildWater();
  buildSpawnRuin();
  buildGuideNPC();
  buildLandmarks();
  populateTrees(100);
  populateRocks(40);
  populateFlowers(60);
  populateEnemies(16, 'slime');
  populateEnemies(5, 'archer');
  populateEnemies(3, 'shield');
  populateEnemies(6, 'wisp');
  populateCollectibles(5);
  populateChests(14);

  /* Build player */
  buildPlayer();
  loadMem();
  applyVisuals();
  buildPartyHud();

  /* Input */
  setupInput();

  /* HUD */
  updateHUD(true);

  /* Resize */
  addEventListener('resize', onResize);

  /* Start loop */
  animate();
}

/* ════════════════════════════════════════════
   GAME LOOP
   ════════════════════════════════════════════ */

function animate(): void {
  requestAnimationFrame(animate);
  let dt = Math.min(G.clock!.getDelta(), 0.08);

  if (G.hitstop > 0) {
    G.hitstop -= dt;
    dt *= 0.05;
  }

  G.worldTime += dt;
  if (dt > 0) {
    G.fpsSamples.push(1 / dt);
    if (G.fpsSamples.length > 18) G.fpsSamples.shift();
  }
  G.pingMs = 28 + Math.round((Math.sin(G.worldTime * 0.7) * 0.5 + 0.5) * 16);

  if (G.isActive) updateGame(dt);
  G.rend!.render(G.scene!, G.cam!);
}

function updateGame(dt: number): void {
  updateTimers(dt);
  updateDayNight(dt);

  const interact = canInteract();
  ui.centerPrompt.style.display = !G.inDialogue && interact ? 'flex' : 'none';
  if (interact === 'chest') ui.promptText.textContent = 'Open Chest';
  else if (G.questPhase === 2) ui.promptText.textContent = 'Report';
  else ui.promptText.textContent = 'Talk';

  updateMovement(dt);
  updatePose(dt);
  updateCollectibles(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateBoss(dt);
  updateTornado(dt);
  updateParticles(dt);
  updateWindParts(dt);
  updateTargetSel();
  updateCamera(dt);
  updateMinimap();
  updateHUD();

  if (G.comboTimer > 0) {
    G.comboTimer -= dt;
    if (G.comboTimer <= 0) resetCombo();
  }

  updateWater();
}

/* ─── Boot ─── */
addEventListener('load', init);

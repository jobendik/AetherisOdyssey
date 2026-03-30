import * as THREE from 'three';
import '../styles/game.css';

/* ─── Core ─── */
import { G, loadMem } from './core/GameState';
import { setupLighting, updateDayNight, setupPostProcessing, resizePostProcessing, buildSkyDome, updateGodRays, updateShadowCamera } from './core/Scene';
import { updateCamera, onResize } from './core/Camera';

/* ─── UI ─── */
import { initUI } from './ui/UIRefs';
import { ui } from './ui/UIRefs';
import { buildPartyHud, updateHUD, updateTargetSel } from './ui/HUD';
import { updateMinimap } from './ui/Minimap';

/* ─── World ─── */
import { buildTerrain, updateTerrain } from './world/Terrain';
import { buildWater, updateWater, renderWaterReflection } from './world/Water';
import { buildGrass, updateGrass } from './world/Grass';
import { buildSpawnRuin } from './world/SpawnRuin';
import { buildLandmarks, buildViewpoints, updateViewpoints } from './world/Landmarks';
import { populateTrees, populateRocks, populateFlowers, updateTrees } from './world/Vegetation';
import { populateCollectibles, updateCollectibles, populateAerialOrbs, updateAerialOrbs, populateOreNodes } from './world/Collectibles';
import { populateChests } from './world/Chests';
import { populateProps, updateProps } from './world/Props';
import { buildWaypoints, updateWaypoints } from './world/Waypoints';
import { buildPuzzles, updatePuzzles } from './world/Puzzles';
import { buildLaunchPoints, updateLaunchPoints } from './world/LaunchPoints';
import { buildGuideNPC, updateNPC } from './entities/NPC';
import { updateCelEmissiveMats } from './core/Helpers';

/* ─── Entities ─── */
import { buildPlayer, applyVisuals } from './entities/Player';
import { loadEnemyModels, populateEnemies, updateEnemies } from './entities/Enemy';
import { updateBoss, spawnHypostasis, updateHypostasis } from './entities/Boss';

/* ─── Systems ─── */
import { updateMovement, updateTimers } from './systems/Movement';
import { updatePose } from './systems/Animation';
import { updateParticles, updateWindParts, updateAmbientParticles, spawnAmbientParticles } from './systems/Particles';
import { updateSlashTrail, initSlashTrail } from './combat/SlashTrail';
import { resetCombo } from './combat/Combo';
import { updateProjectiles } from './combat/Projectiles';
import { initCommissions, updateCommissions } from './systems/Commissions';
import { updateAchievements } from './systems/Achievements';
import { initSideQuests, updateSideQuests } from './systems/SideQuests';
import { initPerfHud, updatePerfHud } from './ui/PerfHud';
import { updateTornado } from './combat/Burst';
import { updateMusic, startAmbientEnv, updateAmbientEnv } from './audio/Audio';
import { populateCampfires } from './systems/Cooking';
import { updateLOD } from './systems/LOD';
import { populateFishSpots, updateFishing } from './systems/Fishing';
import { initDefaultAtlas } from './systems/TextureAtlas';

/* ─── Input ─── */
import { setupInput, canInteract } from './input/Input';

/* ─── Lock-on indicator ─── */
let lockOnSprite: THREE.Sprite | null = null;

function updateLockOnIndicator(dt: number): void {
  if (G.lockOnTarget) {
    if (!lockOnSprite) {
      const mat = new THREE.SpriteMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0.7,
        depthTest: false,
      });
      lockOnSprite = new THREE.Sprite(mat);
      lockOnSprite.scale.setScalar(1.2);
      G.scene!.add(lockOnSprite);
    }
    const tp = G.lockOnTarget.mesh.position;
    lockOnSprite.position.set(tp.x, tp.y + 3.5, tp.z);
    lockOnSprite.scale.setScalar(1.0 + Math.sin(G.worldTime * 6) * 0.15);
    (lockOnSprite.material as THREE.SpriteMaterial).opacity =
      0.6 + Math.sin(G.worldTime * 4) * 0.15;
    lockOnSprite.visible = true;
  } else if (lockOnSprite) {
    lockOnSprite.visible = false;
  }
}

/* ─── World-space interaction prompts ─── */
const interactSprites: THREE.Sprite[] = [];

function initInteractPrompts(): void {
  /* NPC prompt */
  const npcMat = new THREE.SpriteMaterial({
    color: 0xffdd44,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const npcSprite = new THREE.Sprite(npcMat);
  npcSprite.scale.setScalar(0.5);
  npcSprite.visible = false;
  G.scene!.add(npcSprite);
  interactSprites.push(npcSprite);

  /* We'll create chest prompts dynamically when needed */
}

function updateInteractPrompts(): void {
  /* NPC prompt */
  const npcSprite = interactSprites[0];
  if (npcSprite && G.npc && G.player) {
    const d = G.player.position.distanceTo(G.npc.position);
    const show = d < 8 && !G.inDialogue;
    npcSprite.visible = show;
    if (show) {
      npcSprite.position.set(G.npc.position.x, G.npc.position.y + 3.2, G.npc.position.z);
      const fade = d < 4.2 ? 0.9 : 0.4;
      (npcSprite.material as THREE.SpriteMaterial).opacity = fade + Math.sin(G.worldTime * 3) * 0.1;
      npcSprite.scale.setScalar(0.45 + Math.sin(G.worldTime * 2) * 0.05);
    }
  }

  /* Chest prompts — show diamond above nearby unopened chests */
  if (!G.player) return;
  for (const ch of G.entities.chests) {
    if (ch.opened) {
      if ((ch as any)._prompt) {
        ((ch as any)._prompt as THREE.Sprite).visible = false;
      }
      continue;
    }
    const d = G.player.position.distanceTo(ch.mesh.position);
    if (d < 10) {
      if (!(ch as any)._prompt) {
        const mat = new THREE.SpriteMaterial({
          color: 0xffcc00,
          transparent: true,
          opacity: 0,
          depthTest: false,
        });
        const sp = new THREE.Sprite(mat);
        sp.scale.setScalar(0.4);
        G.scene!.add(sp);
        (ch as any)._prompt = sp;
      }
      const sp = (ch as any)._prompt as THREE.Sprite;
      sp.visible = true;
      sp.position.set(ch.mesh.position.x, ch.mesh.position.y + 2.2, ch.mesh.position.z);
      const fade = d < 3.5 ? 0.9 : 0.35;
      (sp.material as THREE.SpriteMaterial).opacity = fade + Math.sin(G.worldTime * 3) * 0.1;
      sp.scale.setScalar(0.35 + Math.sin(G.worldTime * 2.5) * 0.05);
    } else if ((ch as any)._prompt) {
      ((ch as any)._prompt as THREE.Sprite).visible = false;
    }
  }
}

/* ─── Quest direction tracker ─── */
const questArrowEl = document.getElementById('questArrow');
const questDistEl = () => document.getElementById('questDistance');

function getQuestTarget(): THREE.Vector3 | null {
  if (G.questPhase === 0 && G.npc) return G.npc.position;
  if (G.questPhase === 1) {
    for (const c of G.entities.collectibles) {
      if (!c.collected) return c.mesh.position;
    }
    return null;
  }
  if (G.questPhase === 2 && G.npc) return G.npc.position;
  if (G.questPhase === 3 && G.bossEntity && !G.bossEntity.dead)
    return G.bossEntity.mesh.position;
  if (G.questPhase === 4 && G.npc) return G.npc.position;
  return null;
}

function updateQuestTracker(): void {
  if (!G.player || !G.cam) return;
  const target = getQuestTarget();
  const qdEl = questDistEl();
  if (!target) {
    if (questArrowEl) questArrowEl.style.opacity = '0';
    if (qdEl) qdEl.textContent = '';
    return;
  }

  const d = G.player.position.distanceTo(target);
  if (qdEl) qdEl.textContent = `${Math.round(d)}m`;

  if (!questArrowEl) return;
  const screenPos = target.clone().project(G.cam);
  const onScreen = screenPos.x > -0.8 && screenPos.x < 0.8
    && screenPos.y > -0.8 && screenPos.y < 0.8 && screenPos.z < 1;

  if (d < 8 || onScreen) {
    questArrowEl.style.opacity = '0';
    return;
  }

  questArrowEl.style.opacity = '0.7';
  const angle = Math.atan2(screenPos.x, screenPos.y);
  questArrowEl.style.transform = `translate(-50%, -50%) rotate(${-angle}rad)`;
}

/* ════════════════════════════════════════════
   LOADING TIPS
   ════════════════════════════════════════════ */
const LOADING_TIPS = [
  '💡 Combine elemental attacks for powerful reactions!',
  '💡 Dodge at the right moment to avoid damage.',
  '💡 Collect crystals to gain burst energy faster.',
  '💡 Switch party members to exploit enemy weaknesses.',
  '💡 Hold attack to charge a powerful strike.',
  '💡 Use updrafts to reach aerial collectibles!',
  '💡 Cook food at campfires to heal between fights.',
  '💡 Explore at night for tougher enemies and better rewards.',
  '💡 Equip artifacts from the same set for bonus stats.',
  '💡 Lock on with T for better targeting in combat.',
  '💡 Mages teleport away — close distance quickly!',
  '💡 Watch for bomber enemies — they explode on contact!',
  '💡 The boss gains new attacks in each phase.',
  '💡 Glide with Space while airborne to cover distance.',
  '💡 Open the talent tree (N) to unlock character upgrades.',
];
let tipInterval: ReturnType<typeof setInterval> | null = null;
function startLoadingTips(): void {
  const el = document.getElementById('loadingTip');
  if (!el) return;
  el.textContent = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
  tipInterval = setInterval(() => {
    el.textContent = LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
  }, 4000);
}
function stopLoadingTips(): void {
  if (tipInterval) { clearInterval(tipInterval); tipInterval = null; }
}

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */

async function init(): Promise<void> {
  initUI();
  startLoadingTips();

  /* Three.js setup */
  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x000000);
  G.scene.fog = new THREE.FogExp2(0x83b7de, 0.008);
  G.cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);
  G.rend = new THREE.WebGLRenderer({ antialias: true });
  G.rend.setSize(innerWidth, innerHeight);
  G.rend.setPixelRatio(Math.min(devicePixelRatio, 2));
  G.rend.outputColorSpace = THREE.SRGBColorSpace;
  G.rend.shadowMap.enabled = true;
  G.rend.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(G.rend.domElement);
  G.clock = new THREE.Clock();

  /* Build world */
  setupLighting();
  buildSkyDome();
  initDefaultAtlas();
  buildTerrain();
  buildWater();
  buildSpawnRuin();
  buildGuideNPC();
  buildLandmarks();
  buildViewpoints();
  populateTrees(100);
  populateRocks(40);
  populateFlowers(60);
  buildGrass();
  
  await loadEnemyModels();

  populateEnemies(16, 'slime');
  populateEnemies(5, 'archer');
  populateEnemies(3, 'shield');
  populateEnemies(6, 'wisp');
  populateEnemies(3, 'mage');
  populateEnemies(4, 'bomber');
  populateCampfires(4);
  populateCollectibles(5);
  populateAerialOrbs(6);
  populateOreNodes(8);
  populateChests(14);
  populateProps(25);

  /* Field boss: Electro Hypostasis */
  spawnHypostasis(65, 55);

  /* Fishing spots */
  populateFishSpots(5);

  /* Waypoints */
  buildWaypoints();

  /* Puzzles */
  buildPuzzles();

  /* Launch points & updrafts */
  buildLaunchPoints();

  /* Build player */
  buildPlayer();
  loadMem();
  applyVisuals();
  buildPartyHud();

  /* Input */
  setupInput();

  /* Post-processing (must be after scene + camera are ready) */
  setupPostProcessing();

  /* Ambient world particles */
  spawnAmbientParticles();

  /* Slash trail */
  initSlashTrail();

  /* Interaction prompts */
  initInteractPrompts();

  /* HUD */
  updateHUD(true);

  /* Daily commissions */
  initCommissions();

  /* Side quests */
  initSideQuests();

  /* Performance HUD */
  initPerfHud();

  /* Achievements – no separate init needed, just runs in loop */

  /* Resize */
  addEventListener('resize', onResize);

  /* Start loop */
  stopLoadingTips();
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
  renderWaterReflection();
  if (G.composer) {
    G.composer.render();
  } else {
    G.rend!.render(G.scene!, G.cam!);
  }
}

function updateGame(dt: number): void {
  updateTimers(dt);
  updateDayNight(dt);
  updateGodRays();
  updateShadowCamera();

  const interact = canInteract();
  ui.centerPrompt.style.display = !G.inDialogue && interact ? 'flex' : 'none';
  if (interact === 'chest') ui.promptText.textContent = 'Open Chest';
  else if (interact === 'campfire') ui.promptText.textContent = 'Cook';
  else if (interact === 'viewpoint') ui.promptText.textContent = 'View Scenery';
  else if (interact === 'sidequest') ui.promptText.textContent = 'Talk (Quest)';
  else if (interact === 'fish') ui.promptText.textContent = 'Fish';
  else if (G.questPhase === 2) ui.promptText.textContent = 'Report';
  else ui.promptText.textContent = 'Talk';

  updateMovement(dt);
  updatePose(dt);
  updateCollectibles(dt);
  updateAerialOrbs(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateBoss(dt);
  updateHypostasis(dt);
  updateViewpoints(dt);
  updateNPC(dt);
  updateTornado(dt);
  updateParticles(dt);
  updateWindParts(dt);
  updateAmbientParticles(dt);
  updateSlashTrail(dt);
  updateProps();
  updateWaypoints(dt);
  updatePuzzles(dt);
  updateLaunchPoints(dt);
  updateTargetSel();
  updateCamera(dt);
  updateMinimap();
  updateHUD();
  updateLockOnIndicator(dt);
  updateInteractPrompts();
  updateQuestTracker();

  if (G.combatTimer > 0) G.combatTimer -= dt;
  updateMusic(dt);
  updateAmbientEnv();
  updateCommissions(dt);
  updateAchievements();
  updateSideQuests();
  updatePerfHud();
  updateLOD();
  updateFishing(dt);

  if (G.comboTimer > 0) {
    G.comboTimer -= dt;
    if (G.comboTimer <= 0) resetCombo();
  }

  updateWater();
  updateGrass();
  updateTerrain();
  updateTrees();
  updateCelEmissiveMats(G.worldTime);
}

/* ─── Boot ─── */
addEventListener('load', init);

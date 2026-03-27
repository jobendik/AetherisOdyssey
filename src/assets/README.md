# Placeholder Assets

This directory is reserved for **procedural asset generation** code.

Currently, all game entities (player, enemies, NPCs, landmarks, trees, etc.) are built using Three.js primitives (boxes, spheres, cones, cylinders) directly in the entity/world modules.

## Replacing with Real Assets

When you're ready to add real assets:

1. **3D Models** — Place `.glb` / `.gltf` files in `/public/models/`
2. **Textures** — Place textures in `/public/textures/`
3. **Sounds** — Place audio files in `/public/audio/`

Then update the relevant builder functions:

| Current Procedural Builder | File to Modify |
|---|---|
| Player mesh (boxes/spheres) | `src/entities/Player.ts` → `buildPlayer()` |
| Enemy meshes (slime/archer/shield/wisp) | `src/entities/Enemy.ts` → `createEnemy()` |
| Boss mesh | `src/entities/Boss.ts` → `createBoss()` |
| NPC mesh | `src/entities/NPC.ts` → `buildGuideNPC()` |
| Trees, rocks, flowers | `src/world/Vegetation.ts` |
| Landmarks (bridge, tower, etc.) | `src/world/Landmarks.ts` |
| Chests | `src/world/Chests.ts` |
| Terrain | `src/world/Terrain.ts` |

### Example: Loading a GLTF model

```typescript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const gltf = await loader.loadAsync('/models/player.glb');
const model = gltf.scene;
model.traverse((child) => {
  if (child.isMesh) child.castShadow = true;
});
```

### Audio

Replace the synthesized SFX in `src/audio/Audio.ts` with real audio files:

```typescript
const audio = new Audio('/audio/sword-swing.mp3');
audio.volume = 0.3;
audio.play();
```

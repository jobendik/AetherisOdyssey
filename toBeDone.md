# To Be Done — Genshin Impact Clone Improvements

## Visual Improvements

### Lighting & Atmosphere
- [x] **Bloom post-processing** — Add `UnrealBloomPass` to make emissive materials (runes, crystals, elemental effects) glow
- [x] **Skybox** — Add a gradient sky dome or cubemap with clouds synced to the day/night cycle
- [x] **Volumetric fog / god rays** — Screen-space god rays from the directional sun, especially during dawn/dusk
- [x] **Ambient occlusion (SSAO)** — Add `SSAOPass` to darken ground contact under trees, rocks, pillars
- [x] **Color grading / tone mapping** — ACESFilmic tone mapping + warm exploration / desaturated combat LUT
- [x] **Better shadow quality** — Cascade shadow maps for sharper shadows near the player, softer far away

### Water
- [x] **Planar reflections** — Real reflections on the water surface instead of just fresnel
- [x] **Caustic projections** — Animated caustic textures on terrain near the waterline
- [x] **Depth-based color/opacity** — Fade water opacity based on depth instead of flat 0.82

### Particles & VFX
- [x] **Elemental hit particles** — Pyro embers, Cryo ice shards, Electro sparks, Anemo wind swirls on damage
- [x] **Sword slash trails** — Ribbon mesh geometry on sword swing arcs
- [x] **Ambient world particles** — Floating dust motes, fireflies at night, leaves blowing in wind
- [x] **Sprint/dash dust** — Kick-up particles when sprinting and afterimage on dash
- [x] **Burst cinematic flash** — Screen flash, radial blur, or zoom on burst activation
- [x] **Skill cast effects** — Elemental circles/runes on the ground during skill windup

### World Detail
- [x] **Ground decals** — Dirt paths between landmarks, grass variation, fallen leaves under trees
- [x] **Better tree models** — Billboarded leaf clusters or more layered cones with alpha cutout
- [x] **Distant terrain / horizon** — Low-detail far terrain ring or mountain silhouettes to prevent island feeling
- [x] **Dynamic grass interaction** — Grass bends away from player/enemies as they walk through
- [x] **Destructible props** — Breakable crates, pots, and barrels with loot drops

---

## Combat & Game Feel

### Hit Feedback
- [x] **Hitstop (hit freeze)** — 2-3 frame pause on heavy hits for tactile impact
- [x] **Enemy hit reactions** — Knockback/stagger animations when enemies take damage
- [x] **Screen shake tuning** — More impactful shake on burst hits, lighter shake on normal attacks
- [x] **Hit flash** — Brief white flash on enemy mesh when damaged
- [x] **Dodge i-frame feedback** — Afterimage or desaturation during invulnerability frames

### Combat Mechanics
- [x] **Combo finisher** — Knockback slam or elemental burst on 3rd hit of combo
- [x] **Lock-on targeting** — Tab/middle-click to lock camera onto an enemy
- [x] **Charged attacks** — Hold attack button for a heavy elemental strike
- [x] **Plunging attacks** — Aerial slam attack when falling from height
- [x] **Weapon variety** — Different weapon types (claymore, polearm, bow, catalyst) with distinct movesets

### Enemy AI & Variety
- [x] **Attack telegraphs** — Clear wind-up animations with colored ground indicators
- [x] **Elite enemies** — Rare buffed variants (e.g., "Blazing Slime") with auras and better drops
- [x] **Day/night enemy variants** — Stronger enemies at night with better loot (risk/reward)
- [x] **Enemy group tactics** — Enemies coordinate (archers stay back while shields advance)
- [x] **More enemy types** — Mages, berserkers, bombers, flying units

### Boss Fight
- [x] **Phase transition cinematics** — Pause, camera zoom, arena change between boss phases
- [x] **Unique attack patterns per phase** — Distinct movesets instead of just stat changes
- [x] **Boss arena boundaries** — Visible barrier preventing escape during boss fight
- [x] **Boss health bar segments** — Phase indicators on the boss HP bar
- [x] **More bosses** — Additional boss encounters in the world (e.g., dragon, elemental hypostasis)

---

## Progression & Systems

### Character Progression
- [x] **Level-up VFX & sound** — Visual/audio celebration when a character levels up
- [x] **Talent trees** — Unlock and upgrade individual skills/passives per character
- [x] **Constellation system** — Duplicate character items unlock power upgrades
- [x] **Ascension milestones** — Character stat jumps at certain level thresholds

### Equipment & Inventory
- [x] **Equipment comparison UI** — Show stat diff when hovering new gear vs equipped
- [x] **Artifact sets** — 2-piece and 4-piece set bonuses for matching artifacts
- [x] **Weapon enhancement** — Spend materials to upgrade weapon damage
- [x] **Artifact substats** — Random secondary stats on artifacts for build variety
- [x] **Rarity color coding in world** — Chest/drop glow color matches item rarity

### Quests & Content
- [x] **Daily commissions** — Randomized repeatable tasks (kill X, reach location, time trial)
- [x] **Environmental puzzles** — Torch lighting, pressure plates, elemental totems
- [x] **World bosses** — Respawning field bosses scattered across the map
- [x] **Achievement system** — Tracked milestones with rewards (first kill, exploration %, etc.)
- [x] **Side quests from NPCs** — Additional NPC dialogue trees that grant side objectives

---

## Exploration & Movement

### Traversal
- [x] **Climbing system** — Stamina-gated vertical traversal on surfaces
- [x] **Elevated launch points** — High platforms and updraft columns for glider gameplay
- [x] **Aerial collectibles** — Floating items only reachable by gliding
- [x] **Swimming** — Allow movement through water with stamina drain
- [x] **Teleport waypoints** — Unlockable fast-travel points across the map

### World Interaction
- [x] **Environmental reactions** — Pyro burns grass, Cryo freezes water, Electro charges puddles
- [x] **Cooking system** — Combine ingredients at campfires to craft food
- [x] **Fishing** — Mini-game at designated water spots
- [x] **Ore mining** — Breakable ore nodes that drop weapon materials
- [x] **Viewpoints** — Scenic overlook spots that reveal minimap areas

---

## UI & Quality of Life

### HUD Improvements
- [x] **Interaction prompts** — World-space "F to open" / "F to talk" indicators
- [x] **Minimap waypoints** — Clickable minimap to set custom markers
- [x] **Quest tracker** — On-screen objective text with directional indicator
- [x] **Combo counter** — Visible hit counter during combat chains
- [x] **Elemental status icons** — Show active element on enemies above their heads

### Menus & Screens
- [x] **Pause menu** — Settings, controls reference, quit option
- [x] **Character detail screen** — View stats, equipment, talents for each party member
- [x] **Map screen** — Full-screen map with landmark labels and waypoints
- [x] **Settings menu** — Graphics quality, audio volume sliders, keybind remapping
- [x] **Loading screen tips** — Gameplay tips during initial load

### Feedback & Polish
- [x] **Death/respawn system** — Respawn at last waypoint with brief penalty
- [x] **Low health warning** — Screen edge vignette + heartbeat sound at critical HP
- [x] **Chest open animation** — Lid opening with golden light burst and item reveal
- [x] **Character switch animation** — Swap-in flash/burst effect on party member change
- [x] **Footstep sounds** — Surface-dependent footstep audio (grass, stone, water)

---

## Audio

- [x] **Hit impact sounds** — Per-element and per-weapon-type contact sounds
- [x] **UI sounds** — Menu open/close, item pickup, quest complete jingles
- [x] **Ambient environmental audio** — Wind, birds, water, crickets at night
- [x] **Voiced character barks** — Synthesized or placeholder voice lines for attacks/skills
- [x] **Dynamic music layers** — Add exploration intensity layers (near landmarks, at night)
- [x] **Footstep system** — Different sounds for grass, stone, wood, water surfaces

---

## Technical & Performance

- [x] **LOD system** — Level-of-detail for distant objects (grass, trees, enemies)
- [x] **Object pooling** — Pool damage numbers, particles, projectiles to reduce GC pressure
- [x] **Frustum culling tuning** — Ensure off-screen grass/vegetation instances are culled
- [x] **Texture atlas** — Combine small textures to reduce draw calls
- [x] **Performance HUD** — Optional FPS counter and draw call stats for debugging

# Codebase Review Report

Date: 2026-03-29
Project: Aetheris Odyssey / GenshinImpactClone
Reviewer: GitHub Copilot

## Scope

This report covers:

- Code structure and maintainability
- Runtime bug risks and hidden defects
- Build and type-check health
- Performance and browser-delivery concerns
- UI and input-flow issues
- Refactor opportunities
- Feature ideas to improve spectacle, visual quality, and fun
- An implementation checklist for remediation

## Review Summary

The project is in better condition than the size of the feature set suggests. The codebase builds successfully, no current TypeScript diagnostics were reported during inspection, and the domain-based folder structure is a solid foundation.

The main weaknesses are not syntax errors. They are concentrated in four areas:

1. State coupling through a large mutable global game state
2. Lifecycle bugs around transient effects, overlays, and pointer lock
3. Large hotspot files that are accumulating too much behavior
4. Browser performance risk from bundle size and CPU-heavy update paths

The game already has strong feature density: elemental combat, multiple UI systems, traversal modes, procedural world content, boss logic, quests, inventory, and audio. The next stage should focus on reliability and maintainability before adding too many new systems.

## Validation Performed

- Reviewed project structure and architecture documentation
- Read core gameplay, entity, UI, input, combat, and systems modules
- Verified build health with `npm run build`
- Checked workspace diagnostics
- Inspected gameplay hotspots and asset references

## Current Build and Type Health

### Status

- TypeScript diagnostics: none reported during review
- Production build: succeeds
- Main concern: large production bundle

### Build Observation

The current production build emits a large main JavaScript asset of roughly 816.8 KB minified. That is a material risk for:

- mobile load times
- parse/compile time in browser
- lower-end laptop performance
- first interaction latency

This is not a correctness bug, but it is an engineering priority if the game is intended to feel polished in-browser.

## Prioritized Findings

## 1. High Severity: Particle pool contract is unsafe and mixes incompatible object types

### Why this matters

The transient effects system is currently treating multiple object categories as if they are interchangeable pooled meshes. That is fragile and can lead to runtime failures, visual corruption, or leaks after enough gameplay.

### Evidence

- Afterimages are stored as a `THREE.Group` forced into a mesh slot in [src/systems/Movement.ts](src/systems/Movement.ts#L34)
- Expired particles are always returned through the mesh pool in [src/systems/Particles.ts](src/systems/Particles.ts#L105)
- The mesh pool assumes the object has `material`, `geometry`, and a mesh-compatible structure in [src/systems/ObjectPool.ts](src/systems/ObjectPool.ts#L18) and [src/systems/ObjectPool.ts](src/systems/ObjectPool.ts#L29)

### Root cause

One particle list is being used for:

- pooled cube particles
- ring meshes
- elemental hit meshes
- afterimage wrapper groups

Those objects do not share the same disposal and reuse contract.

### Likely symptoms

- broken particles after several dashes
- reused objects with wrong geometry or material
- intermittent runtime exceptions when releasing non-mesh objects
- incorrect opacity or transform behavior when pooled objects are reused

### Recommended fix

Split transient effects into separate lifecycles:

- pooled particles: only pool one mesh type with one material contract
- temporary custom meshes: dispose directly, do not pool
- temporary groups/afterimages: remove recursively, do not return to mesh pool

## 2. Medium Severity: Waypoint overlay flow conflicts with pointer lock and desktop input ownership

### Why this matters

The UI flow for waypoints is internally inconsistent. The overlay can be opened through the pause menu, but the pause close path immediately requests pointer lock again on desktop.

### Evidence

- Pause menu Waypoints button closes pause and opens waypoint UI in [src/input/Input.ts](src/input/Input.ts#L71) and [src/input/Input.ts](src/input/Input.ts#L72)
- Closing pause requests pointer lock again in [src/input/Input.ts](src/input/Input.ts#L83)
- The waypoint UI is appended as a plain overlay in [src/world/Waypoints.ts](src/world/Waypoints.ts#L148) and [src/world/Waypoints.ts](src/world/Waypoints.ts#L171)

### Root cause

The codebase does not have a centralized UI mode owner. Overlay creation and pointer-lock state transitions are being managed ad hoc in separate modules.

### Likely symptoms

- waypoint overlay appears but mouse control remains captured
- desktop users cannot reliably interact with waypoint buttons
- intermittent reopen/close oddities if pointer lock changes mid-overlay

### Recommended fix

Introduce a UI mode manager or at minimum a common overlay contract:

- opening an overlay should explicitly set gameplay inactive
- opening an overlay should release pointer lock on desktop
- closing an overlay should restore the correct previous state
- pause/menu/map/waypoint/settings/inventory should share one lifecycle pattern

## 3. Medium Severity: Character detail screen can show mixed data for the wrong character

### Why this matters

The character detail view appears to support browsing different party members, but it still computes stats and equipment from the globally active selection rather than the viewed character.

### Evidence

- Character detail content is built from an arbitrary `idx` in [src/ui/CharacterDetail.ts](src/ui/CharacterDetail.ts#L44)
- Stats are computed using `calcStats()` in [src/ui/CharacterDetail.ts](src/ui/CharacterDetail.ts#L46)
- Equipment is read from active global inventory in [src/ui/CharacterDetail.ts](src/ui/CharacterDetail.ts#L47) and [src/ui/CharacterDetail.ts](src/ui/CharacterDetail.ts#L48)

### Root cause

The screen has two conceptual modes:

- active character state
- roster inspection state

But only one actual data source exists for stats/equipment rendering.

### Likely symptoms

- viewing a non-active party member shows the wrong ATK/HP/equipment details
- player confusion about which character’s build is being displayed

### Recommended fix

Either:

- make the screen explicitly show only the active character, or
- refactor stat calculation to accept a specific character snapshot and equipment loadout

## 4. Low Severity: Control labels are inconsistent with actual key bindings

### Why this matters

This is a player-facing UX defect. It makes the controls feel broken even when the code works as implemented.

### Evidence

- Start screen says `M` is Waypoints in [index.html](index.html#L19)
- Pause menu labels `M` as Map in [src/input/Input.ts](src/input/Input.ts#L59)
- Actual key binding opens the map in [src/input/Input.ts](src/input/Input.ts#L256)
- Waypoints are opened via pause submenu in [src/input/Input.ts](src/input/Input.ts#L51)

### Recommended fix

Normalize the UX contract:

- either `M` opens map and waypoint selection lives inside map
- or `M` opens waypoint UI and map moves elsewhere

Then update all displayed control references to match.

## 5. Low Severity: The architecture is heavily centralized and now beyond comfortable scaling range

### Why this matters

This is the main long-term maintainability risk. The game is functional now, but the cost of adding features safely will rise quickly if the current structure remains unchanged.

### Evidence

- Global mutable state object in [src/core/GameState.ts](src/core/GameState.ts#L21)
- Main entrypoint size: [src/main.ts](src/main.ts)
- Enemy AI hotspot size: [src/entities/Enemy.ts](src/entities/Enemy.ts)
- Input hotspot size: [src/input/Input.ts](src/input/Input.ts)

### Hotspot file sizes observed during review

- `src/entities/Enemy.ts`: about 685 lines
- `src/main.ts`: about 438 lines
- `src/input/Input.ts`: about 406 lines
- `src/entities/Player.ts`: about 296 lines
- `src/systems/Particles.ts`: about 241 lines
- `src/core/GameState.ts`: about 235 lines

### Why this is a problem

The code is organized by domain at the folder level, but inside key files too many responsibilities are still mixed together.

Examples:

- `main.ts` acts as bootstrapper, world assembly, runtime orchestration, quest tracker, lock-on indicator owner, and prompt manager
- `Enemy.ts` mixes loading, instantiation, AI behavior, elite rules, telegraphs, movement, and combat execution
- `Input.ts` mixes input bindings, pause UI, pointer lock lifecycle, overlay control, and gameplay interaction dispatch

### Recommended fix

Refactor by responsibility, not just by feature folder.

## 6. Low Severity: Asset naming is brittle and should not be trusted implicitly

### Why this matters

This did not appear to be a broken path in the current workspace because the asset exists with the same typo, but it is still fragile and likely to cause future asset-pipeline issues.

### Evidence

- Player animation path uses `Attaxk3.fbx` in [src/entities/Player.ts](src/entities/Player.ts#L17)
- The asset exists under that misspelled name in the current `public/models/animations` folder

### Risk

Anyone normalizing filenames later may silently break runtime loading.

### Recommended fix

Standardize animation asset names and isolate them behind a manifest or loader mapping with validation.

## Structural Assessment

## What is working well

- Folder structure is domain-oriented and understandable
- Feature coverage is ambitious and broad
- TypeScript usage is present across the project
- Many systems are already modular enough to isolate for later improvement
- The project currently builds cleanly

## What is becoming risky

- global state ownership is too broad
- subsystem lifecycle rules are inconsistent
- UI overlays are not centrally coordinated
- effect objects do not share a safe memory-management contract
- browser-delivery performance is starting to degrade due to bundle size

## Recommended Refactor Direction

## Phase 1: Correctness and lifecycle stability

Focus on defects that can create confusing bugs or runtime issues.

### Goals

- separate pooled and non-pooled effect objects
- fix waypoint overlay usability on desktop
- fix character detail data source correctness
- normalize controls text and keybind labeling

## Phase 2: State and orchestration cleanup

Reduce coupling before adding more features.

### Suggested state split

- `PlayerState`
- `CombatState`
- `WorldState`
- `UIState`
- `SessionState`

### Suggested controller split

- bootstrap/world assembly controller
- overlay/input mode controller
- quest/objective controller
- effect lifecycle controller
- encounter controller

## Phase 3: Hotspot decomposition

### Refactor candidates

- split [src/entities/Enemy.ts](src/entities/Enemy.ts) into:
  - enemy loaders
  - enemy factory
  - enemy shared update loop
  - archetype-specific behavior modules
- split [src/input/Input.ts](src/input/Input.ts) into:
  - raw input bindings
  - gameplay actions
  - overlay mode transitions
  - pause and pointer-lock management
- split [src/main.ts](src/main.ts) into:
  - bootstrap/init
  - per-frame orchestration
  - quest tracker and prompt systems
  - runtime debug and UI helpers

## Phase 4: Performance and delivery

### Priorities

- code-split non-core UI systems
- lazy-load heavy overlay features
- reduce initial startup work where possible
- measure per-frame cost of enemy and particle updates
- reduce browser parse/compile cost from the large main bundle

## Performance Risks

## 1. Large initial bundle

The biggest distribution concern is the large main bundle produced by the build. Features that do not need to be present on first frame should be candidates for dynamic import.

### Good candidates for lazy loading

- character detail
- map screen
- settings overlay
- talents
- constellations
- fishing UI and minigame
- waypoint selection overlay

## 2. CPU-heavy update concentration

The codebase appears to do a lot of real-time work in centralized frame updates. That is manageable now, but it should be profiled before additional AI or environment spectacle is added.

### Likely hotspots

- enemy AI and telegraph logic
- particles and transient VFX
- minimap rendering
- shadow and post-processing updates
- ambient effects and environment systems

## 3. Object churn risk

There are many uses of transient allocations, timers, and dynamically created DOM elements. Not all of that is a problem, but the code should be reviewed for:

- repeated creation of overlays without a shared owner
- temporary mesh churn
- timer proliferation for VFX and UI cleanup

## Gameplay and UX Opportunities

## What already feels promising

- elemental reaction combat
- traversal variety
- day/night presentation
- boss phase structure
- high system density for a browser game

## What would make it more spectacular

## 1. Landmark-scale spectacle

Add large environmental set pieces that are visible from a distance and create anticipation:

- floating ruins
- giant airborne creatures in the skybox
- lightning strikes on distant towers
- moving magical weather funnels
- radiant night-only landmarks

## 2. Stronger element-driven battlefield identity

Make each element reshape the fight space visually and mechanically:

- Pyro: burning ground, heat shimmer, ember drafts
- Cryo: freeze surfaces, ice ramps, brittle terrain shards
- Electro: conductive props, chain arcs, storm-charged terrain
- Hydro: puddles, splash propagation, reflective rain events
- Anemo: leaf/vapor swirl fields, push and lift zones

## 3. Traversal spectacle

Make movement itself feel premium:

- launch rings and air tunnels for glider routes
- cliffside wind channels
- grapple flowers or leap nodes
- hidden aerial routes between landmarks
- moving traversal targets activated by time of day

## 4. Better combat presentation escalation

The combat system would benefit from stronger payoff at higher intensity:

- escalating hit FX with combo count
- stronger finisher camera accents
- enemy-specific stagger reactions
- more distinct burst phase visuals
- stronger phase-transition presentation for bosses

## 5. More systemic world surprises

The open world will feel more alive if rare events can happen outside the quest path:

- wandering elite hunts
- meteor crashes
- ghost caravans at night
- hidden encounter chains
- mini-world events that temporarily alter an area

## 6. Bosses should change arena rules, not just attack cadence

Examples:

- a phase that floods or ignites sections of the arena
- a phase that forces aerial play
- a phase that spawns destructible cover or hazards
- arena geometry changes during transitions

## Implementation Checklist

Use this checklist as the working execution plan.

## Correctness Fixes

- [ ] Replace the shared particle list contract with typed effect categories
- [ ] Remove afterimages from the mesh pool path
- [ ] Ensure only pooled particle meshes are returned to `releaseParticleMesh`
- [ ] Dispose non-pooled meshes and groups safely
- [ ] Add a regression test path for repeated dash usage and effect expiry
- [ ] Fix waypoint overlay desktop usability around pointer lock
- [ ] Ensure overlay open/close state toggles `G.isActive` consistently
- [ ] Fix character detail to show viewed-character data, not active-character data
- [ ] Normalize map/waypoint labels across UI and actual controls

## Refactor Tasks

- [ ] Introduce a UI mode/overlay manager
- [ ] Define separate state slices instead of routing everything through `G`
- [ ] Move quest tracker and interaction prompt logic out of `main.ts`
- [ ] Split `Enemy.ts` into factory, loader, shared update, and archetype behavior modules
- [ ] Split `Input.ts` into raw bindings, gameplay actions, and overlay lifecycle management
- [ ] Split `main.ts` into bootstrap, world assembly, and frame orchestration modules

## Performance Tasks

- [ ] Add dynamic imports for non-core overlays and menus
- [ ] Measure startup cost before and after code splitting
- [ ] Profile enemy update cost with larger encounter counts
- [ ] Profile particle churn under heavy combat
- [ ] Review minimap draw frequency and cost
- [ ] Review post-processing cost on low-end GPUs
- [ ] Evaluate whether all runtime systems need to initialize at boot

## Stability and Validation

- [ ] Re-run `npm run build` after each major refactor step
- [ ] Add a smoke checklist for desktop pointer-lock interactions
- [ ] Add a smoke checklist for mobile touch interactions
- [ ] Test repeated opening and closing of every overlay
- [ ] Test character switching during combat and while menus are open
- [ ] Test waypoint travel during and after combat
- [ ] Test boss transitions with particle-heavy encounters
- [ ] Test long-play sessions for leaked scene objects or DOM overlays

## Content and Polish Tasks

- [ ] Add one signature visual set piece per major landmark region
- [ ] Add one traversal spectacle mechanic beyond current glide/updraft flow
- [ ] Add stronger combo-finisher VFX escalation
- [ ] Add arena-rule changes to at least one boss phase
- [ ] Add rare world events tied to time-of-day or exploration
- [ ] Improve visual identity differences between subregions

## Suggested Order of Work

## Sprint 1

- fix pooled effect lifecycle issues
- fix waypoint overlay/input ownership
- fix character detail correctness
- align control labels

## Sprint 2

- introduce overlay manager
- split input lifecycle from gameplay actions
- split enemy logic by responsibility

## Sprint 3

- add code splitting for secondary UI systems
- profile and optimize heavy update loops
- reduce initial bundle size

## Sprint 4

- add presentation upgrades to traversal, combat payoff, and boss spectacle
- expand region identity and rare encounter content

## Final Assessment

This codebase is viable and already impressive in scope. It does not currently look blocked by basic engineering failure. The larger concern is that it is transitioning from “feature-rich prototype” into “content-heavy game,” and the current architecture will become expensive to change unless the state, overlay lifecycle, and hotspot files are cleaned up soon.

The immediate priority should be reliability and maintainability. After that, the project is in a good position to invest in visual identity, traversal spectacle, and stronger combat presentation.
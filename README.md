<div align="center">

# ⚔️ Aetheris Odyssey

**A browser-based open-world action RPG built with Three.js and TypeScript**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.170-049EF4?logo=three.js&logoColor=white)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#license)

<br/>

*An open-world adventure featuring 4 switchable characters, elemental combat, a multi-phase boss, inventory system, and a procedurally generated world — all running in your browser.*

</div>

---

## 🎮 Features

### 🌍 Open World
- **Procedural terrain** with hills, valleys, and water
- **Day/night cycle** with dynamic lighting and sky colors
- **Landmarks** — stone bridge, watchtower, shrine, windmill, ruined gate
- **Vegetation** — trees, rocks, wildflowers scattered across the landscape
- **Minimap** with real-time entity tracking

### ⚔️ Combat System
- **Melee combo attacks** with hit-stop and screen shake
- **Elemental reactions** (Swirl, Overloaded, Superconduct, Frozen, Melt, Vaporize, Electro-Charged)
- **4 enemy archetypes** — Slimes, Archers, Shield Bearers, Wisps
- **Multi-phase boss fight** (King Slime) with slam attacks, fire breath, and minion spawning
- **Combo counter** with damage multipliers
- **Floating damage numbers** with crit indicators

### 🧑‍🤝‍🧑 Party System
| Character | Element | Role | Skill | Burst |
|-----------|---------|------|-------|-------|
| **Aerin** | Anemo | Sword DPS | Wind Vortex | Tornado |
| **Raiya** | Electro | Burst DPS | Lightning Bolt | Thunderstorm |
| **Frostine** | Cryo | Support | Ice Shield | Blizzard |
| **Kael** | Pyro | Melee DPS | Flame Dash | Meteor Strike |

Switch characters mid-combat to trigger elemental reactions for massive bonus damage.

### 🎒 Inventory & Progression
- **Weapons** with ATK bonuses and unique passives
- **Artifacts** boosting HP, elemental damage, burst damage
- **Consumable food** for healing
- **XP & leveling** system that scales all party members
- **Treasure chests** scattered throughout the world with randomized loot

### 🎵 Audio
- **Procedural synthesizer** — all sound effects generated via Web Audio API
- **Ambient music** with generative melodic phrases
- **Contextual SFX** for attacks, skills, reactions, UI interactions

### 📱 Cross-Platform
- Full **keyboard + mouse** support (desktop)
- **Touch controls** with virtual joystick (mobile)
- **Responsive UI** that adapts to any screen size

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ with npm

### Installation

```bash
# Clone the repository
git clone https://github.com/jobendik/AetherisOdyssey.git
cd AetherisOdyssey

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open **http://localhost:5173** in your browser and click **Enter World**.

### Production Build

```bash
npm run build    # Build to dist/
npm run preview  # Preview the production build
```

---

## 🏗️ Project Architecture

The codebase is organized into domain-based modules for maintainability and scalability:

```
src/
├── main.ts              ← Entry point & game loop
├── types.ts             ← Shared TypeScript interfaces
│
├── core/                ← Engine fundamentals
│   ├── GameState.ts     ← Central state singleton
│   ├── Helpers.ts       ← Math & mesh utilities
│   ├── Camera.ts        ← Camera controller
│   └── Scene.ts         ← Lighting & day/night
│
├── data/                ← Game data (easy to tweak!)
│   ├── PartyData.ts     ← Character definitions
│   ├── EnemyData.ts     ← Enemy stats & archetypes  
│   ├── ItemData.ts      ← Weapons, artifacts, food
│   ├── ReactionData.ts  ← Elemental reaction table
│   └── DialogueData.ts  ← Quest dialogue
│
├── world/               ← World generation
│   ├── Terrain.ts       ← Procedural heightmap
│   ├── Water.ts         ← Animated water plane
│   ├── Landmarks.ts     ← Structures & points of interest
│   ├── Vegetation.ts    ← Trees, rocks, flowers
│   ├── Collectibles.ts  ← Crystal gathering + updrafts
│   └── Chests.ts        ← Loot containers
│
├── entities/            ← Game entities
│   ├── Player.ts        ← Player model & visuals
│   ├── NPC.ts           ← Guide NPC
│   ├── Enemy.ts         ← Enemy AI & spawning
│   └── Boss.ts          ← Multi-phase boss
│
├── combat/              ← Combat mechanics
│   ├── Attack.ts        ← Melee attack system
│   ├── Skills.ts        ← Character skills (4 types)
│   ├── Burst.ts         ← Ultimate abilities (4 types)
│   ├── DamageSystem.ts  ← Damage dealing & receiving
│   ├── Reactions.ts     ← Elemental reactions
│   ├── Combo.ts         ← Hit combo tracking
│   └── Projectiles.ts   ← Arrow physics
│
├── systems/             ← Game systems
│   ├── Movement.ts      ← Physics & collision
│   ├── Animation.ts     ← Character animation
│   ├── Particles.ts     ← Visual effects
│   ├── Progression.ts   ← XP & leveling
│   └── Inventory.ts     ← Stat calculation
│
├── ui/                  ← User interface
│   ├── UIRefs.ts        ← DOM element cache
│   ├── HUD.ts           ← Health, stamina, party
│   ├── Minimap.ts       ← Canvas minimap
│   ├── DamageNumbers.ts ← Floating text
│   ├── Dialogue.ts      ← NPC dialogue system
│   └── InventoryUI.ts   ← Inventory overlay
│
├── audio/
│   └── Audio.ts         ← Web Audio synth & SFX
│
├── input/
│   └── Input.ts         ← Keyboard, mouse, touch
│
└── assets/
    └── README.md        ← Guide for adding real assets
```

---

## 🎨 Adding Real Assets

The game currently uses **procedural meshes** (Three.js primitives) as placeholders. To replace them with real 3D models:

1. Place `.glb` / `.gltf` files in `/public/models/`
2. Update the relevant builder function (see `src/assets/README.md` for the full mapping)

```typescript
// Example: Loading a GLTF model
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const gltf = await loader.loadAsync('/models/player.glb');
const model = gltf.scene;
```

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| `WASD` | Move |
| `Mouse` | Look around |
| `Space` | Jump / Toggle glider |
| `Shift` | Dodge roll |
| `LMB` | Attack |
| `E` | Elemental Skill |
| `Q` | Elemental Burst |
| `F` | Interact (NPC / Chest) |
| `1-4` | Switch party member |
| `Tab` | Open inventory |

**Mobile:** Left side drag = move, Right side drag = look, Tap right = attack/interact.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **TypeScript** | Type-safe game logic |
| **Three.js** | 3D rendering engine |
| **Vite** | Build tool & dev server |
| **Web Audio API** | Procedural sound synthesis |
| **Canvas 2D** | Minimap rendering |

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">
<sub>Built with ❤️ and Three.js</sub>
</div>

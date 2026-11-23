# Adventure Platformer

A lightweight, modular 2D side-scrolling platformer built with **Phaser 4**, **TypeScript** and **Vite**.
The project is developed incrementally, one reviewed milestone at a time.

**Current status: Task 003 — JSON-driven levels.** The game boots into a menu and loads a validated
JSON level with generated terrain, static physics, a goal marker, camera follow and automatic
respawn. Movement, variable jumping, coyote time, jump buffering and unified keyboard/touch controls
are already in place. Enemies, collectibles, goal completion, scoring and persistence are not
implemented yet.

## Requirements

| Tool | Version used |
| --- | --- |
| Node.js | 22.23.4 (Vite 8 requires `^20.19.0 \|\| >=22.12.0`) |
| npm | 10.9.9 |
| Phaser | 4.2.1 |
| TypeScript | 7.0.2 (strict mode) |
| Vite | 8.3.8 |
| Vitest | 5.1.1 |

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. The port is fixed so it is predictable in CI and screenshots.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move left | Arrow Left / A | Left button |
| Move right | Arrow Right / D | Right button |
| Jump | Arrow Up / W / Space | Jump button |
| Respawn | R (development builds only) | Automatic after falling |

Jumping is variable-height: release early for a short hop, hold for the full jump.

## Touch controls

Touch controls appear automatically on touch-capable devices and are hidden on desktop. For
development and automated verification they can be forced on:

- Dev server only: open <http://localhost:5173/?touch=1>.
- Any build: set `VITE_FORCE_TOUCH_CONTROLS=true` before `npm run dev` / `npm run build`.

In development, `window.__MATIO_GAME__` exposes the running Phaser game for debugging.

## Levels

Levels are auto-discovered from `content/levels/**/*.json` at build time. The default is
`world-01-level-01`; use the development selector to load another:

```text
http://localhost:5173/?level=world-01-level-02
```

Shipped levels:

| ID | Name | Size (tiles) |
| --- | --- | --- |
| `world-01-level-01` | Green Introduction | 40×15 |
| `world-01-level-02` | Platform Challenge | 80×18 |
| `world-01-level-03` | Water Valley | 90×16 |

Adding a level requires only a valid JSON file — no TypeScript changes. See
[How to create level-04.json](docs/LEVEL_FORMAT.md#9-how-to-create-level-04json-without-modifying-typescript).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with HMR |
| `npm run build` | Production bundle in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run `tsc --noEmit` with strict settings |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

Always run `typecheck`, `test` and `build` before handing a task back for review.

## What works now

- Phaser 4 boots with a centralized, responsive 1280×720 configuration and Arcade Physics.
- `BootScene -> MenuScene -> GameScene` navigation with mouse and touch.
- A reusable `Player` entity driven by a normalized input snapshot, never by raw devices.
- Acceleration/deceleration, facing direction and a procedural placeholder visual state machine
  (idle, running, rising, falling, landing).
- Variable jump height, coyote time, jump buffering and double-jump protection.
- JSON-driven levels: automatic discovery, validation, duplicate-ID protection, geometry planning,
  static terrain collision, goal marker and loading-error screen.
- Three playable test levels (`Green Introduction`, `Platform Challenge`, `Water Valley`).
- Smooth horizontal/vertical camera follow with world bounds, plus a centered frame for small levels.
- Terrain types: solid ground/platform/block, non-solid water; one static body per rectangle.
- Fall respawn at the JSON spawn, relative to each level's height.
- Unified keyboard/touch `InputManager` with held input, edge-detected jump, multitouch pointer
  ownership and shutdown cleanup; touch UI stays fixed while the camera scrolls.
- Player physics tuning loaded from validated external JSON (`content/config/player.json`).
- Development-only HUD and dev bridge; production builds omit both.
- 71 unit tests covering level validation, level discovery, geometry/camera math, player
  configuration, input resolution and jump rules.

## Explicitly not implemented yet

Enemies, coins, stars, power-ups, combat, goal completion/scoring, level progression, save data,
Tiled/editor integration, inventory, shop, daily rewards, achievements, ads, Android packaging and
final art/audio. Valid object entries in level JSON are ignored with development diagnostics.

## Project layout

```text
public/assets/          Runtime art/audio, grouped by category (empty for now)
content/levels/         Auto-discovered JSON levels (3 playable levels)
content/config/         Validated gameplay configuration (player.json)
src/core/               Game config, constants, level catalog/config, error overlay, dev bridge
src/scenes/             Boot, Menu and Game scenes (lifecycle + orchestration)
src/entities/           Player entity and procedural placeholder textures
src/systems/            Validators, jump rules, level repository/geometry/loader
src/factories/          Terrain, backdrop and goal marker construction
src/input/              Unified input manager, touch controls, pure input resolution
src/ui/components/      Reusable UI pieces (text, buttons, header, debug/error panels)
src/ui/screens/         Future composed UI screens (pause, victory, shop)
src/types/              Shared contracts (level, runtime geometry, player, config, validation)
src/utils/              Small engine-agnostic helpers
tests/                  Vitest unit tests and content checks
tools/                  Future developer scripts
docs/                   Design, architecture, asset, level and workflow documentation
```

## Documentation

- [Game design](docs/GAME_DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Asset guide](docs/ASSET_GUIDE.md)
- [Level format](docs/LEVEL_FORMAT.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Agent instructions](AGENTS.md)

# Adventure Platformer

A lightweight, modular 2D side-scrolling platformer built with **Phaser 4**, **TypeScript** and **Vite**.
The project is developed incrementally, one reviewed milestone at a time.

**Current status: Task 002 — playable movement prototype.** The game boots into a menu and opens a
temporary arena with a physics-driven player, variable-height jumping, coyote time, jump buffering,
and unified keyboard/touch controls. Level loading, enemies, collectibles and persistence are not
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
- Temporary test arena: solid ground with a gap, four thin platforms at four distinct heights, visible world
  bounds, spawn marker and automatic respawn after falling.
- Unified keyboard/touch `InputManager` with held input, edge-detected jump, multitouch pointer
  ownership and shutdown cleanup.
- Player physics tuning loaded from validated external JSON (`content/config/player.json`).
- Development-only HUD and dev bridge; production builds omit both.
- 47 unit tests covering level validation, player configuration, input resolution and jump rules.

## Explicitly not implemented yet

Enemies, coins, power-ups, combat, level loading/rendering, Tiled/level editor integration,
inventory, shop, daily rewards, achievements, save data, ads, Android packaging and final art/audio.

## Project layout

```text
public/assets/          Runtime art/audio, grouped by category (empty for now)
content/levels/         JSON level files (contract only in this milestone)
content/config/         Validated gameplay configuration (player.json)
src/core/               Game configuration, content loading, constants, error overlay, dev bridge
src/scenes/             Boot, Menu and Game scenes (lifecycle + orchestration)
src/entities/           Player entity and procedural placeholder textures
src/systems/            Engine-free rules: level/config validation, jump/coyote/buffer logic
src/factories/          Future creation of objects from validated definitions
src/input/              Unified input manager, touch controls, pure input resolution
src/ui/components/      Reusable UI pieces (text, buttons, debug HUD)
src/ui/screens/         Future composed UI screens (pause, victory, shop)
src/types/              Shared contracts (level, player, configuration, validation)
src/utils/              Small engine-agnostic helpers
tests/                  Vitest unit tests
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

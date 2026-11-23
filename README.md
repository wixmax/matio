# Adventure Platformer

A lightweight, modular 2D side-scrolling platformer built with **Phaser 4**, **TypeScript** and **Vite**.
The project is developed incrementally, one reviewed milestone at a time.

**Current status: Task 004 — collectibles, victory and progression.** The game boots into a menu with
level selection, loads validated JSON levels and runs the full loop: collect coins/stars, reach the
goal, calculate score and a 1–3 star rating, save best results, unlock the next level and continue.
Movement, variable jumping, coyote time, jump buffering, unified keyboard/touch controls, camera
follow, respawn and versioned local save are in place. Enemies and combat are not implemented yet.

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

Levels are auto-discovered from `content/levels/**/*.json` at build time. Campaign order and unlocks
come from `content/config/level-order.json`. The default is `world-01-level-01`; in development you
can still load any level directly:

```text
http://localhost:5173/?level=world-01-level-02
```

The development selector bypasses progression locks; production ignores it.

Shipped levels:

| ID | Name | Size (tiles) | Coins | Collectible stars |
| --- | --- | --- | --- | --- |
| `world-01-level-01` | Green Introduction | 40×15 | 12 | 2 |
| `world-01-level-02` | Platform Challenge | 80×18 | 26 | 3 |
| `world-01-level-03` | Water Valley | 90×16 | 29 | 4 |

Adding a level requires only a valid JSON file plus its ID in `level-order.json` — no TypeScript
changes. See [How to create level-04.json](docs/LEVEL_FORMAT.md#9-how-to-create-level-04json-without-modifying-typescript).

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
- `BootScene -> MenuScene -> GameScene -> ResultScene` navigation with mouse and touch.
- A menu with START GAME and a three-level grid showing locked/unlocked state and best ratings.
- A reusable `Player` entity driven by a normalized input snapshot, never by raw devices.
- Acceleration/deceleration, facing direction and a procedural placeholder visual state machine
  (idle, running, rising, falling, landing).
- Variable jump height, coyote time, jump buffering and double-jump protection.
- JSON-driven levels: automatic discovery, validation, duplicate-ID protection, geometry planning,
  static terrain collision, goal marker/sensor and loading-error screen.
- Three playable test levels (`Green Introduction`, `Platform Challenge`, `Water Valley`).
- Coins and collectible stars placed in JSON at tile centers, collected once, with HUD feedback.
- Falling preserves collected objects and run score; Retry restores every collectible.
- Goal completion with a one-time settlement, final score (coins + stars + completion bonus) and a
  1–3 star rating that is separate from collectible stars.
- Result screen with counts, score, best record, rating, RETRY, NEXT LEVEL and MAIN MENU.
- Explicit campaign order (`content/config/level-order.json`) with initial unlock, next-level
  unlocking, replay and locked-level rejection in production.
- Versioned localStorage save (`matio.save.v1`) with validation, corruption recovery, unavailable-
  storage fallback and monotonic best records.
- Smooth horizontal/vertical camera follow with world bounds, plus a centered frame for small levels.
- Terrain types: solid ground/platform/block, non-solid water; one static body per rectangle.
- Fall respawn at the JSON spawn, relative to each level's height.
- Unified keyboard/touch `InputManager` with held input, edge-detected jump, multitouch pointer
  ownership and shutdown cleanup; touch UI stays fixed while the camera scrolls.
- Player physics tuning and scoring loaded from validated external JSON
  (`content/config/player.json`, `content/config/scoring.json`).
- Development-only debug HUD and dev bridge; production builds omit both.
- 156 unit tests covering validation, geometry/camera math, collectibles, scoring/rating,
  progression, saves, player configuration, input resolution and jump rules.

## Scoring and persistence

| Event | Points |
| --- | --- |
| Coin | 100 |
| Collectible star | 500 |
| Level completion | 1000 |

The HUD shows collected points while playing; the result adds the completion bonus. Rating rules:
1 star for completing, 2 stars at ≥70% of coins, 3 stars only when every coin and collectible star in
the level is collected. A level with no coins/stars cannot receive a higher rating by default.

Progress is stored locally under `matio.save.v1`. It keeps unlocked levels and per-level best score,
best rating and best coin/star counts. There is no persistent wallet or shop. Corrupt/invalid saves
reset to first-launch data with a console diagnostic; an unsupported newer save is never overwritten.

### Testing save behavior

1. Open DevTools → Application → Local Storage and remove `matio.save.v1` for a clean first launch.
2. Play level 01, reach the goal, return to the menu: level 02 should be unlocked with best stats.
3. Refresh the page: the menu must show the same progress.
4. Replay level 01 and finish worse: the best score/rating must not decrease.
5. Set `matio.save.v1` to `{bad json` and reload: the game must start fresh and log a diagnostic.
6. Set it to `{"saveVersion":99,...}` and reload: the game must not overwrite that value.
7. In unit tests, `SaveStore` takes an injectable `SaveStorage` (`tests/save-store.test.ts`).

## Explicitly not implemented yet

Enemies, combat, power-ups (bomb/shield/magnet runtime), persistent wallet/currency, shop,
Tiled/editor integration, inventory, daily rewards, achievements, ads, cloud save, Android packaging
and final art/audio. Valid unimplemented object entries remain in level JSON with development
diagnostics.

## Project layout

```text
public/assets/          Runtime art/audio, grouped by category (empty for now)
content/levels/         Auto-discovered JSON levels (3 playable levels)
content/config/         Validated gameplay config (player.json, scoring.json, level-order.json)
src/core/               Game config, constants, level catalog/order, scoring/save singletons, dev bridge
src/scenes/             Boot, Menu, Game and Result scenes (lifecycle + orchestration)
src/entities/           Player, Collectible and procedural placeholder textures
src/systems/            Validators, scoring/progression/save rules, jump rules, game state,
                        level repository/geometry/loader, CollectionSystem
src/factories/          Terrain, backdrop, goal marker and collectible construction
src/input/              Unified input manager, touch controls, pure input resolution
src/ui/components/      Reusable UI pieces (text, buttons, HUD, header, debug/error panels)
src/ui/screens/         Future composed UI screens (pause, shop)
src/types/              Shared contracts (level, collectible, scoring, save, result, player, ...)
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

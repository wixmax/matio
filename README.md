# Adventure Platformer

A lightweight, modular 2D side-scrolling platformer built with **Phaser 4**, **TypeScript** and **Vite**.
The project is developed incrementally, one reviewed milestone at a time.

**Current status: Task 006-B — shield, coin magnet and temporary effects.** The game boots into a menu
with level selection, loads validated JSON levels and runs the full loop: collect coins/stars, stomp
or avoid JSON-defined enemies, reach the goal, calculate score (including enemy defeats) and a 1–3
star rating, save best results, unlock the next level and continue. Movement, variable jumping,
coyote time, jump buffering, unified keyboard/touch controls, camera follow, respawn, player health,
invulnerability, knockback, Game Over/retry and versioned local save are in place.

Bombs, shields and magnets are placed in the level JSON. Throw bombs with X/J or
the touch THROW button. The shield protects against one eligible enemy hit before
its 15-second limit. The magnet attracts nearby coins for 12 seconds along clear
paths. The HUD shows active effects and remaining time. Falling preserves the
current attempt. Retry restores pickups and clears effects.

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
| Jump / stomp | Arrow Up / W / Space | Jump button |
| Respawn | R (development builds only) | Automatic after falling |

Jumping is variable-height: release early for a short hop, hold for the full jump. Land on a
stompable enemy from above to damage it and bounce; touching one from the side costs health.

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

| ID | Name | Size (tiles) | Coins | Collectible stars | Enemies |
| --- | --- | --- | --- | --- | --- |
| `world-01-level-01` | Green Introduction | 40×15 | 12 | 2 | 2 mushroom, 1 snail |
| `world-01-level-02` | Platform Challenge | 80×18 | 26 | 3 | 3 mushroom, 2 snail, 1 spiky |
| `world-01-level-03` | Water Valley | 90×16 | 29 | 4 | 3 mushroom, 1 snail, 2 spiky |

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
- `BootScene -> MenuScene -> GameScene -> ResultScene` and `GameOverScene` navigation with mouse
  and touch.
- A menu with START GAME and a three-level grid showing locked/unlocked state and best ratings.
- A reusable `Player` entity driven by a normalized input snapshot, never by raw devices.
- Acceleration/deceleration, facing direction and a procedural placeholder visual state machine
  (idle, running, rising, falling, landing).
- Variable jump height, coyote time, jump buffering and double-jump protection.
- JSON-driven levels: automatic discovery, validation, duplicate-ID protection, geometry planning,
  static terrain collision, goal marker/sensor and loading-error screen.
- Three playable test levels (`Green Introduction`, `Platform Challenge`, `Water Valley`).
- Coins and collectible stars placed in JSON at tile centers, collected once, with HUD feedback.
- Enemies placed in JSON with archetypes (mushroom, snail, spiky), feet anchors and patrol bounds.
- Deterministic patrol with wall, bound and ledge/water reversal; terrain collision and gravity.
- Stomp combat: mushrooms die in one stomp, snails need two, spiky cannot be stomped; one contact is
  either a stomp or player damage, never both.
- Player health (3 hearts), 1000 ms invulnerability, knockback, brief input lock and damage flash.
- Health-zero Game Over with RETRY/MAIN MENU; no completion bonus, record or unlock is written.
- Falling preserves collected objects, run score, health and enemy states; Retry restores all.
- Goal completion with a one-time settlement, final score (coins + stars + enemy defeats +
  completion bonus) and a 1–3 star rating that is separate from collectible stars.
- Result screen with counts, enemy defeats/points, score, best record, rating, RETRY, NEXT LEVEL and
  MAIN MENU.
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
- Vitest suites covering validation, geometry/camera math, collectibles, enemies, patrol
  behavior, stomp classification, player health/invulnerability, enemy scoring, gameplay states,
  scoring/rating, progression, saves, player configuration, input resolution, jump rules and effects.

## Scoring and persistence

| Event | Points |
| --- | --- |
| Coin | 100 |
| Collectible star | 500 |
| Mushroom defeat | 200 |
| Snail defeat | 350 |
| Spiky defeat | 0 points, possible with bombs |
| Level completion | 1000 |

The HUD shows collected + enemy points while playing; the result adds the completion bonus. Rating
rules: 1 star for completing, 2 stars at ≥70% of coins, 3 stars only when every coin and collectible
star in the level is collected. Enemy defeats do not change the rating. A level with no coins/stars
cannot receive a higher rating by default. A failed run shows only collected + enemy points and
never writes a record or unlocks a level.

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

Permanent power-up inventory, chasing/flying enemies, enemy projectiles, bosses, permanent lives,
persistent wallet/currency, shop, Tiled/editor integration, daily rewards, achievements, ads, cloud
save, Android packaging and final art/audio.

## Project layout

```text
public/assets/          Runtime art/audio, grouped by category (empty for now)
content/levels/         Auto-discovered JSON levels (3 playable levels with enemies)
content/config/         Validated gameplay config (player, enemies, combat, scoring, level order)
src/core/               Game config, constants, config singletons, level catalog, dev bridge
src/scenes/             Boot, Menu, Game, Result and GameOver scenes (lifecycle + orchestration)
src/entities/           Player, Collectible, Enemy and procedural placeholder textures
src/systems/            Validators, scoring/progression/save rules, jump rules, combat rules,
                        player health, patrol behavior, enemy ledger, game state,
                        level repository/geometry/loader, CollectionSystem, EnemySystem
src/factories/          Terrain, backdrop, goal marker, collectible and enemy construction
src/input/              Unified input manager, touch controls, pure input resolution
src/ui/components/      Reusable UI pieces (text, buttons, HUD, header, debug/error panels)
src/ui/screens/         Future composed UI screens (pause, shop)
src/types/              Shared contracts (level, collectible, enemy, combat, scoring, save, ...)
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

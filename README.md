# Adventure Platformer

A lightweight, modular 2D side-scrolling platformer built with **Phaser 4**, **TypeScript** and **Vite**.
The project is developed incrementally, one reviewed milestone at a time.

**Current status: Task 001 — project foundation.** The game boots into a menu and navigates to a
static development playground. There is no player movement, physics, enemies, level rendering or
persistence yet.

## Requirements

| Tool | Version used |
| --- | --- |
| Node.js | 22.23.4 (Vite 8 requires `^20.19.0 || >=22.12.0`) |
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

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with HMR |
| `npm run build` | Type-agnostic production bundle in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run `tsc --noEmit` with strict settings |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |

Always run `typecheck`, `test` and `build` before handing a task back for review.

## What works now

- Phaser 4 boots with a centralized, responsive 1280×720 configuration.
- `BootScene -> MenuScene -> GameScene` navigation.
- A reusable mouse/touch `TextButton` component ("START GAME").
- A static development playground with ground and a shape-based player placeholder.
- A versioned JSON level contract with a pure validator and 16 unit tests.
- Development-only error overlay and renderer/DPR console diagnostics.

## Explicitly not implemented yet

Player movement, jumping, physics, enemies, coins, combat, level loading/rendering, inventory,
shop, daily rewards, ads, audio, Android packaging and final art.

## Project layout

```text
public/assets/          Runtime art/audio, grouped by category (empty for now)
content/levels/         JSON level files (world-01/level-01.json is the reference example)
content/config/         Future JSON gameplay/UI configuration
src/core/               Game configuration, constants, error overlay
src/scenes/             Boot, Menu and Game scenes (lifecycle + orchestration only)
src/entities/           Future game objects (player, enemies, pickups)
src/systems/            Reusable logic (level validation lives here)
src/factories/          Future creation of objects from validated definitions
src/input/              Future shared keyboard/touch input abstraction
src/ui/components/      Reusable UI pieces (text, buttons)
src/ui/screens/         Future composed UI screens (pause, victory, shop)
src/types/              Shared TypeScript contracts (level schema, validation)
src/utils/              Small engine-agnostic helpers
tests/                  Vitest unit tests
tools/                  Future developer scripts (level checks, asset tooling)
docs/                   Design, architecture, asset, level and workflow documentation
```

## Documentation

- [Game design](docs/GAME_DESIGN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Asset guide](docs/ASSET_GUIDE.md)
- [Level format](docs/LEVEL_FORMAT.md)
- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)
- [Agent instructions](AGENTS.md)

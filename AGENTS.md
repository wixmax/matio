# AGENTS.md — Instructions for AI Coding Agents

Task 006-A bomb rules: tuning is validated from `content/config/bombs.json`.
`BombSystem` owns run inventory, pickups, Arcade projectiles and explosion lifetime.
External enemy damage enters through `EnemySystem`, which retains health and
`EnemyLedger` ownership. Bomb pickups never affect coin/star scoring or saves.
Freeze active bombs on victory, Game Over and shutdown.

This repository is an incremental, reviewed game project. You are the implementation agent; a
technical architect reviews each task. Read this file before doing anything.

## Project facts

- 2D side-scrolling platformer: **Phaser 4.2.1**, **TypeScript 7.0.2 (strict)**, **Vite 8.3.8**,
  **Vitest 5.1.1**, npm, JSON content, Phaser Arcade Physics.
- Logical resolution 1280×720, landscape-first, FIT scaling, WebGL with Canvas fallback.
- No React/Vue/Angular/Next.js, no backend, no authentication, no database, no cloud services.
- Current milestone: **Task 005 complete** — JSON-driven levels, terrain/collision generation,
  goal marker, camera follow, collectibles, scoring/rating, progression, local save, plus JSON
  enemy archetypes, patrol behavior, stomp/damage combat, player health/invulnerability and a
  Game Over/retry flow. TASK 006-A adds player bomb pickups, throws and explosion combat.

## Mandatory rules

1. **Read the relevant documentation before modifying code.** Start with `docs/ARCHITECTURE.md`
   and `docs/DEVELOPMENT_WORKFLOW.md`; read `docs/LEVEL_FORMAT.md`, `docs/ASSET_GUIDE.md` or
   `docs/GAME_DESIGN.md` when the task touches those areas.
2. **Work only on the requested task.** If you notice unrelated problems, report them; do not fix
   them unasked.
3. **Never implement unrequested major features.** No movement, enemies, coins, shop, ads,
   persistence or Android packaging until a task explicitly asks for them.
4. **Never hardcode level layouts inside game scenes.** Level content is JSON under
   `content/levels/`; scenes only orchestrate.
5. **Preserve existing working systems.** Do not rename, delete or restructure modules without a
   documented reason tied to the task.
6. **Prefer simple, reusable modules.** No speculative abstractions, no empty classes, no plugin
   frameworks, no premature pooling.
7. **Use strict TypeScript typing.** `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`,
   `noUnusedParameters`, `verbatimModuleSyntax` are enabled. Keep them enabled.
8. **Avoid `any` unless thoroughly justified.** Use `unknown` plus narrowing, discriminated unions
   and type guards. If `any` is unavoidable, explain it in a comment.
9. **Keep gameplay configuration separate from logic.** Tuning values (speed, gravity, jump force,
   timings) belong in configuration/content modules, not inline in scenes or entities.
10. **Validate JSON content before using it.** `parseLevelJson()` / `validateLevel()` are the only
    trusted entry point. Never cast raw JSON to a domain type.
11. **Test relevant changes.** Add or update Vitest coverage for logic, and verify scenes/input in a
    real browser.
12. **Do not claim tests passed unless they were actually executed.** Report exact commands and
    results. State explicitly when something could not be verified.
13. **Document architectural decisions.** Record non-obvious choices, trade-offs and deviations in
    the docs (usually `docs/ARCHITECTURE.md`).
14. **Report blockers instead of inventing workarounds.** If an API, dependency or environment
    prevents the task, stop and describe the blocker precisely.
15. **Keep browser and future Android compatibility in mind.** Browser-safe APIs only, relative
    asset paths (`base: './'`), touch parity, small bundle, no `file://`-hostile patterns.

## Scope guardrails

Do not add any of the following without an explicit task:

- Tiled/editor integration, a level editor, enemies, AI, combat, power-ups, inventory.
- Purchases, shop, achievements, daily quests, daily rewards, lucky spin, ads, wallet currency.
- Final art/audio, full-screen/orientation lock, Android/Capacitor packaging.
- New runtime dependencies, state libraries, UI frameworks, backends or analytics.

If a task seems to require one of these, ask or report the dependency instead of implementing it
as a side effect.

## Commands

```bash
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # production bundle
npm run preview    # serve the production bundle
npm run typecheck  # tsc --noEmit (strict)
npm run test       # Vitest, single run
npm run test:watch # Vitest watch mode
```

Run `typecheck`, `test` and `build` before every handoff, plus a browser check for visual/input
changes. The dev server uses a fixed port so review steps stay stable.

## Where code goes

| Need | Location |
| --- | --- |
| Engine/app configuration, constants | `src/core/` |
| A new scene | `src/scenes/` and register it in `src/core/game-config.ts` |
| Player/enemy/pickup behavior | `src/entities/` |
| Shared rules (collision, spawning, scoring, validation) | `src/systems/` |
| Building objects from validated content | `src/factories/` |
| Keyboard/touch abstraction | `src/input/` |
| Reusable UI widget | `src/ui/components/` |
| Composed screen (pause, victory, shop) | `src/ui/screens/` |
| Shared contracts/types | `src/types/` |
| Pure helpers | `src/utils/` |
| JSON levels | `content/levels/<world>/` |
| JSON gameplay/UI config | `content/config/` |
| Runtime art/audio | `public/assets/<category>/` |
| Tests | `tests/` |
| Developer scripts | `tools/` |

Import direction must stay acyclic:
`core -> scenes -> entities + input + ui + systems + factories + types`.
Pure systems and `types/` must never import scenes or UI. `types/` must stay Phaser-free.
`LevelLoader` is the one Phaser-aware system; it may import factories and level geometry.

## Technical conventions

- **Phaser 4 only.** Verify every Phaser API against `node_modules/phaser/types/phaser.d.ts` or the
  bundled `node_modules/phaser/skills/*/SKILL.md`. Phaser 3 code often does not apply.
- `Phaser.AUTO`, FIT scaling, auto-center, 1280×720 logical size and Arcade Physics are fixed in
  `src/core/game-config.ts`. Do not stretch the canvas or introduce fixed pixel device sizes.
- Player tuning lives in `content/config/player.json`, is imported at build time, and must pass
  `validatePlayerConfig()`. Never add movement tuning constants to the Player or scene.
- The Player receives `PlayerInputState`; it must never read keyboard keys, pointers or Phaser input
  plugins. All device handling belongs in `src/input/`.
- Jump/coyote/buffer rules belong in `src/systems/jump-controller.ts` (engine-free, tested), not in
  the scene. Movement uses Arcade velocity/acceleration; never move the player by editing `x`/`y`.
- Sprite origin is (0.5, 1) with the body offset defined in `src/entities/player-textures.ts`. Keep
  body metrics and frame sizes consistent when changing visuals.
- Enemy balance lives only in `content/config/enemies.json`; placements live in level JSON.
  Enemy entities must not hardcode health, speed, damage or score.
- Combat tuning (health, invulnerability, knockback, stomp bounce/tolerance) lives only in
  `content/config/combat.json`. Combat classification belongs in `src/systems/combat-rules.ts`,
  health rules in `src/systems/player-health.ts`, and patrol in `src/systems/enemy-behaviors.ts`.
- Never classify stomps from velocity alone: Arcade separation can zero velocity before the
  callback. Use previous-step body geometry plus current enemy geometry.
- The player/enemy contact handler is exclusive: one contact resolves as either a stomp or player
  damage, never both. Defeated enemies disable their body immediately.
- Enemy defeat points are recorded once by `EnemyLedger` and merged into the existing scoring
  functions; never add a second mutable score total.
- A failed run (health 0) must not write a save record or unlock a level. `GameOverScene` offers
  RETRY and MAIN MENU only.
- Level layouts exist only in `content/levels/**/*.json`; never add level arrays or coordinates to
  scenes/factories. Discovery is the eager raw `import.meta.glob` in `src/core/level-repository.ts`.
- Load levels through `LevelRepository` → `loadLevel` → `createLevelGeometry`. Do not use `fetch`,
  Node `fs`, hardcoded catalogs or a partial "best effort" render.
- Terrain `x/y` is top-left in tiles; spawn/goal are cells whose world anchor is bottom-center:
  `(x·tile + tile/2, (y+1)·tile)`. Preserve the player feet-origin convention.
- Every solid area gets one static body; `water` is intentionally non-solid. Do not add per-tile
  bodies or move players manually during physics updates.
- Collectible objects use the **center** of their JSON cell: `(x + 0.5) · tileSize`,
  `(y + 0.5) · tileSize`. Spawn/goal/enemy remain bottom-center.
- Enemy patrol `minX`/`maxX` are inclusive tile columns converted to body-edge pixels:
  `minX · tileSize .. (maxX + 1) · tileSize`. Enemies must start in an empty cell above solid
  terrain, and patrol bounds must contain the enemy cell and stay over solid ground.
- A collectible is collected at most once per run. Keep the entity guard (`Collectible.collect()`)
  and the run ledger (`CollectionLedger`) in place; never update score/HUD from a raw overlap.
- Falling preserves collected objects and the current run score. Retry must start a new scene and
  therefore a new run ledger; never reset collection state inside respawn logic.
- Goal completion is settled exactly once (`playing` → `completing` → `results`). Do not add timers
  or overlap callbacks that can settle twice.
- Score points and the 2-star coin ratio live in `content/config/scoring.json`; never hardcode them
  in scenes or systems. Score calculation stays Phaser-free.
- Campaign order lives only in `content/config/level-order.json`; never infer it from file or
  discovery order. Locked levels must not start through normal UI (the dev `?level=` selector is the
  only bypass).
- Save data is versioned and validated before use. Never trust localStorage; keep the storage
  interface injectable and handle unavailable/corrupt/unsupported data without crashing.
- Camera bounds come from JSON size; smoothing is 0.1 on X/Y with zoom 1. HUD/touch UI must keep
  `scrollFactor(0)` so it stays fixed while following.
- Fall respawn uses `worldHeight + 2 * tileSize`; do not hardcode screen pixel limits.
- Invalid/unknown/duplicate levels must show `LevelErrorPanel` and never start gameplay.
- Valid-but-unimplemented object entries are ignored with dev diagnostics; do not convert them into
  unrelated systems.
- Every `Text` object uses `addUiText()` so DPR-aware `resolution` is applied consistently.
- Container hit areas use **top-left box coordinates** (0,0 → width,height), not centered
  coordinates. See `TextButton` and `TouchControlButton`.
- Touch controls are shown on touch devices only; force them with `?touch=1` (dev) or
  `VITE_FORCE_TOUCH_CONTROLS=true`. Release every pointer on up/up-outside/game-out/blur/pause and
  remove all listeners, keys and captures on shutdown.
- Clean up listeners/timers added to global managers when a scene shuts down. Verify scene restart
  does not duplicate input listeners.
- Colors and fonts come from `src/ui/theme.ts`; no ad-hoc palette per scene.
- Runtime units: px/s for speed, px/s² for gravity; level coordinates are tile units.
- Keep static drawing in `create()`, not in `update()`.
- No absolute asset URLs; use paths relative to `public/`.
- `window.__MATIO_GAME__` exists only in dev builds; never depend on it from gameplay code.

## Content rules

- Levels are versioned JSON (`schemaVersion: 1`), documented in `docs/LEVEL_FORMAT.md`.
- Level IDs are unique kebab-case strings; filenames are discovered automatically but are not the ID.
- Coordinates are tile units; X right, Y down; default tile size 64 px; spawn/goal bottom-center.
- Validate content and fail visibly with `path`/`message` errors. Never silently skip invalid data.
- Add/change levels without editing TypeScript; use `?level=<id>` in development to load one.
- Player configuration is versioned JSON (`content/config/player.json`, schema 1). Validate it and
  keep movement tuning there.
- Valid-but-unimplemented object entries (`shield`, `magnet`) are preserved in JSON and
  ignored at runtime with development diagnostics. Never turn them into coins or award score.
- `content/config/scoring.json` is versioned (`schemaVersion: 1`) and validated by
  `validateScoringConfig()` before gameplay starts.
- `content/config/enemies.json` and `content/config/combat.json` are versioned (`schemaVersion: 1`)
  and validated at startup. Invalid values block the game; never guess defaults.
- Enemy placements are validated structurally and cross-checked against the archetype registry and
  terrain safety. Unknown `enemyId`, invalid patrols or unsafe cells must fail visibly.
- Enemy defeat score is added to the existing run score exactly once per defeat. Zero-enemy levels
  must keep the exact pre-Task-005 score breakdown. Enemy defeats do not change rating rules.
- `content/config/level-order.json` is versioned (`schemaVersion: 1`), structurally validated, and
  cross-checked against discovered level IDs at startup. Missing references block the game with a
  visible error.
- Local save data uses `saveVersion: 1`, is validated by `validateSaveData()`, and is stored under
  `matio.save.v1`. Never write transient scene/physics state. Best records are monotonic.
- Collectible cells must not overlap solid terrain. Collectibles and rating stars are different
  concepts: use `collectedStars` / `totalCollectibleStars` / `ratingStars` explicitly.
- Schema changes bump `schemaVersion` and ship with migration + tests.
- New asset conventions are in `docs/ASSET_GUIDE.md` (kebab-case names, 64 px grid, straight-alpha
  PNG, feet-center pivot). Do not add unapproved art.

## Testing and evidence

- Unit-test pure logic in `tests/` with Vitest (Node environment). Use the shipped levels and player
  config where they strengthen content tests.
- For scene/input/level changes: start the dev server, load each affected level (`?level=`), check
  spawn alignment, terrain/colliders, gaps/water respawn, goal marker, camera bounds/follow, fixed
  HUD/touch UI, error handling, restart cleanup and console output.
- For collectible/progression changes also verify: coin/star collection updates HUD once, falling
  keeps collected objects, Retry restores them, completion settles once, best results never shrink,
  locked levels cannot start through normal UI, and saved progress survives a page refresh.
- For enemy/combat changes verify: enemy anchors/patrol bounds/terrain collision, one-hit vs two-hit
  stomps, spiky damage-only, exclusive stomp/damage, invulnerability timing, health HUD, knockback,
  Game Over exactly once, Retry restoring health/enemies/collectibles, falling preserving health and
  collection, enemy score once, and victory score including enemy points.
- Test the production build with `npm run preview` for menu/result/HUD behavior; remember the dev
  bridge and dev level selector are absent there.
- Force touch controls with `?touch=1` when the test machine has no touchscreen. Synthetic touch
  events verify the Phaser input path, not a real device; say which was used.
- If a background browser tab throttles `requestAnimationFrame`, stop `game.loop` and call
  `game.step(time, 16.666)` manually for deterministic verification. Do not ship that as logic.
- Report exact command output (test count, build sizes, console errors), not claims.
- Never describe unexecuted checks as successful.

## Reporting

End every task with the report format requested by the architect (Arabic when required): status,
versions, structure, implementation details, executed commands/results, problems and limitations,
architecture notes/deviations, readiness for the next task, Git status/commit, and a concise
summary. Be factual; list anything unverified.

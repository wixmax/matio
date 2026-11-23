# AGENTS.md — Instructions for AI Coding Agents

This repository is an incremental, reviewed game project. You are the implementation agent; a
technical architect reviews each task. Read this file before doing anything.

## Project facts

- 2D side-scrolling platformer: **Phaser 4.2.1**, **TypeScript 7.0.2 (strict)**, **Vite 8.3.8**,
  **Vitest 5.1.1**, npm, JSON content, Phaser Arcade Physics.
- Logical resolution 1280×720, landscape-first, FIT scaling, WebGL with Canvas fallback.
- No React/Vue/Angular/Next.js, no backend, no authentication, no database, no cloud services.
- Current milestone: **Task 002 complete** — player controller, Arcade Physics, unified
  keyboard/touch input, external player tuning. Level loading is the next planned area.

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

- Level loading, level rendering, Tiled/editor integration or a level editor.
- Enemies, AI, combat, coins, power-ups, inventory, scoring, save data.
- Shop, achievements, daily quests, daily rewards, lucky spin, ads.
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

Import direction must stay acyclic: `core -> scenes -> ui/components + systems + types`.
`systems` and `types` must never import scenes or UI. `types/` must stay Phaser-free.

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
- Coordinates are tile units; X right, Y down; default tile size 64 px.
- Validate content and fail visibly with `path`/`message` errors. Never silently skip invalid data.
- Player configuration is versioned JSON (`content/config/player.json`, schema 1). Validate it and
  keep movement tuning there.
- Schema changes bump `schemaVersion` and ship with migration + tests.
- New asset conventions are in `docs/ASSET_GUIDE.md` (kebab-case names, 64 px grid, straight-alpha
  PNG, feet-center pivot). Do not add unapproved art.

## Testing and evidence

- Unit-test pure logic in `tests/` with Vitest (Node environment). Use the shipped example level
  and shipped player config where they strengthen content tests.
- For scenes/input, start the dev server, exercise keyboard and touch controls, verify restart
  cleanup, resize the window, and check the console. Take screenshots where practical.
- Force touch controls with `?touch=1` when the test machine has no touchscreen. Synthetic touch
  events verify the Phaser input path, not a real device; say which was used.
- If a background browser tab throttles `requestAnimationFrame`, stop `game.loop` and call
  `game.step(time, 16.666)` manually for deterministic verification. Do not ship that as logic.
- Report exact command output ("47 tests passed", build sizes, console errors), not claims.
- Never describe unexecuted checks as successful.

## Reporting

End every task with the report format requested by the architect (Arabic when required): status,
versions, structure, implementation details, executed commands/results, problems and limitations,
architecture notes/deviations, readiness for the next task, Git status/commit, and a concise
summary. Be factual; list anything unverified.

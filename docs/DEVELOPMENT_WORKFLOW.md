# Development Workflow

## 1. How work is organized

- The **technical architect** defines one task at a time and reviews the result.
- The **implementation agent** executes only that task, verifies it, and reports back.
- Tasks are incremental. A task may build on the previous one but may not silently expand scope.
- The repository must stay runnable at the end of every task.

## 2. Start-of-task checklist

1. Read `AGENTS.md` and the docs relevant to the task (`docs/ARCHITECTURE.md` is almost always
   relevant; add `LEVEL_FORMAT.md`, `ASSET_GUIDE.md` or `GAME_DESIGN.md` as needed).
2. Inspect the working tree: `git status`, recent changes, and any files the user may have edited.
3. Confirm the app still works before changing it (`npm run typecheck`, `npm run test`,
   `npm run dev` if the change is visual).
4. Write down the acceptance criteria implied by the task, including what is out of scope.
5. Check Phaser 4 APIs before using them: `node_modules/phaser/types/phaser.d.ts` or
   `node_modules/phaser/skills/<topic>/SKILL.md`. Do not copy Phaser 3 code from memory.
6. For gameplay changes, identify the config/content involved: `player.json`, `enemies.json`,
   `combat.json`, `bombs.json`, `effects.json`, `player-forms.json`, `scoring.json`, `level-order.json`, level JSON and
   the save schema are validated content, not inline constants.

## 3. Implementation loop

```text
read docs -> plan -> inspect -> small change -> typecheck -> test -> build -> verify in browser -> report
```

Rules of thumb:

- Prefer the smallest change that satisfies the task.
- Keep scenes thin: wiring, lifecycle, camera; push rules into systems and behavior into entities.
- Never hardcode a level layout in a scene. Scene presentation constants (ground band, camera
  framing) are acceptable; level content is not.
- Add a module only when a second caller exists or the task explicitly requires it. No speculative
  interfaces, base classes or plugin systems.
- If a requirement is ambiguous or blocked, report it instead of inventing a workaround.
- Do not "fix" unrelated code while implementing a task. Note it for review instead.

## 4. Commands

| Command | When |
| --- | --- |
| `npm run dev` | Every visual/input change; verify in a real browser |
| `npm run typecheck` | After every TypeScript change |
| `npm run test` | After logic/content changes, and before handoff |
| `npm run build` | Before handoff, to catch bundling and config issues |
| `npm run preview` | To sanity-check the production bundle if needed |

The dev server uses port **5173** with `strictPort`. If the port is taken, stop the other process
instead of changing the port, so review instructions remain stable.

Open `/tests/effects-browser.html?touch=1` in Vite dev to verify the effect integration.
It uses scripted Arcade contacts, isolated storage and a manually stepped game loop.
Review damage priority, terrain obstruction, coin settlement, pause, fall, Retry, Victory
and Game Over. Run `/tests/bomb-browser.html?touch=1` for bomb and synthetic multitouch
regressions. Check the production preview separately.

Open `/tests/growth-browser.html?touch=1` in Vite dev for scripted growth checks.
The fixture uses a test-only save and advances the real Arcade world. It covers
body sizes and feet, keyboard movement and jumps, the existing level 02
overhang, effect refresh and expiry, combat, bombs, shield and magnet, and the
fall, Retry, Victory and Game Over paths. For a manual ceiling check in level 02,
approach the mushroom at (56, 14) from the ground on its right and retreat right
when the HUD shows `PENDING GROWTH`.

## 5. Coding standards

### TypeScript

- `strict` is on, plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`,
  `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`.
- `any` is forbidden unless it is the only honest representation of an external value; a comment
  explaining why is mandatory. Prefer `unknown` plus narrowing.
- No non-null assertions on values that can actually be absent. Where validation guarantees
  presence, keep the invariant local and document it.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- `satisfies`/discriminated unions are preferred over enums and casts.
- Public functions get explicit return types when inference is not obvious.

### Naming and structure

- Files: PascalCase for classes/scenes/components (`GameScene.ts`, `TextButton.ts`), kebab-case for
  utility modules (`level-validator.ts`, `ui-text.ts`).
- Scenes end with `Scene`; systems are nouns with a clear job; factories end with `Factory`.
- One primary export per file; helpers stay private unless reused.
- Keep files focused. If a file is doing orchestration **and** rules **and** rendering, split it.
- Comments explain **why** (constraints, trade-offs), not what the next line obviously does.

### Phaser 4

- Verify API names and signatures against the bundled types. Phaser 4 is not Phaser 3.
- Do not add custom WebGL pipelines (removed in v4); use filters/render nodes only when required.
- Containers need an explicit hit area for input.
- Clean up scene-level listeners, timers and input bindings on shutdown if they outlive the scene.
- Keep rendering work out of `update()` when it is static; draw once in `create()`.
- Use `this.scale`/`this.cameras` APIs for layout rather than hardcoded device sizes.

### Content and configuration

- Levels live in `content/levels/`; tuning values live in configuration modules/content, never
  inside scene bodies.
- All JSON content passes through `parseLevelJson()`/`validateLevel()` before use.
- Colors and typography come from `src/ui/theme.ts`; do not scatter hex strings.
- Runtime units: pixels per second for speeds and pixels per second² for gravity.

## 6. Testing

### Unit tests (required for logic)

- Location: `tests/*.test.ts`.
- Environment: Node (no DOM). Test pure modules and validators, not Phaser internals.
- Cover the happy path, defaults, boundary values, invalid input and multiple-error behavior.
- Use the real example content where it strengthens the test (the shipped level is validated).
- Keep scoring, rating, progression and save rules engine-free so they are tested without Phaser.
- Use injected storage (`SaveStorage`) for save tests instead of mocking the whole browser.
- For collectible content, assert that no coin/star cell overlaps solid terrain.

### Manual browser verification

For any scene, layout or input change:

1. `npm run dev`.
2. Open <http://localhost:5173>.
3. Verify the expected flow (currently Boot → Menu → Game).
4. Test mouse **and** touch (device emulation or synthetic touch events).
5. Resize the viewport/window and confirm the 16:9 canvas stays centered without stretching.
6. Check the browser console for errors and the dev error overlay for failures.

For input/physics work specifically:

1. Verify keyboard movement, release-to-stop, jump, landing and platforms.
2. Verify no double jump and that holding jump does not repeat.
3. Exercise touch controls: LEFT, RIGHT, JUMP, RIGHT+JUMP together, releasing one finger while the
   other stays held, sliding off a button, and focus loss.
4. Force touch controls when testing on desktop: `?touch=1` (dev) or
   `VITE_FORCE_TOUCH_CONTROLS=true` (any build).
5. Restart `GameScene` several times and confirm keyboard/pointer listener counts do not grow.
6. Use `window.__MATIO_GAME__` (dev only) to inspect scene/player state. If a browser tab is
   occluded and throttles `requestAnimationFrame`, stop `game.loop` and drive deterministic frames
   with `game.step(time, 16.666)` for verification; never ship that as game logic.

For level/camera work:

1. Load the default level and each changed level with `?level=<id>`.
2. Confirm the player spawns with feet on the expected ground (no tile/body offset).
3. Confirm each solid type collides, water does not, and terrain visuals match the data.
4. Walk into every declared gap/water area and confirm respawn at the JSON spawn.
5. Confirm the goal marker is at the goal cell and stays in world space.
6. Scroll to both horizontal/vertical world edges and confirm camera clamping.
7. Confirm HUD/touch controls remain fixed while the camera moves.
8. Load an unknown ID and confirm the error panel lists available levels and BACK TO MENU works.
9. Restart the scene repeatedly and compare static/dynamic body counts and text/listener counts.

For enemy/combat work:

1. Load each affected level and confirm enemies render at their feet anchors, patrol within authored
   bounds, collide with terrain and don't walk off ledges/into water.
2. Stomp a mushroom from above: one hit, player bounce, score once, no player damage.
3. Stomp a snail twice: first hit only reduces health, second defeats and scores exactly once.
4. Land on a spiky enemy: player takes damage, the enemy survives, no score.
5. Touch an enemy from the side: damage, knockback, flash and input lock; HUD loses one heart.
6. Repeated contact during invulnerability does not remove more health; after ~1000 ms it can.
7. Reach health zero: Game Over appears once, no completion bonus/record/unlock is written.
8. RETRY: full health, all enemies alive, all collectibles restored, run score/counters reset.
9. Fall into a gap: respawn at spawn, health unchanged, collected objects/score preserved, enemy
   states preserved.
10. Finish a level: final score includes coins + collectible stars + enemy points + completion.
11. Restart several scenes: collider count, enemy set and input-key count stay constant.

For collectible/progression/save work:

1. Confirm coins and collectible stars render at JSON cell centers and inside no solid terrain.
2. Collect one coin and one star; check HUD counts/score change once and objects disappear.
3. Overlap the same object repeatedly (deterministic frames are acceptable) and confirm no duplicate
   reward.
4. Fall into a gap/respawn and confirm collected objects and run score are preserved.
5. Reach the goal and confirm the result counts/score/rating are correct and settlement happened
   once (inspect the save and repeat the overlap).
6. Use RETRY and confirm all collectibles return with counters at zero.
7. Replay a level worse than the record and confirm the saved best does not shrink.
8. Return to the menu, refresh the page and confirm best records/unlocks persist.
9. Try a locked level through normal UI (must be rejected) and via `?level=` in development (must
   bypass).
10. Clear corrupt/unsupported `localStorage` values and confirm a diagnostic plus safe recovery; do
    not lose an unsupported-version save.

Report what was actually observed. "Should work" is not verification. If a check could not run in
the environment, say so explicitly. Synthetic touch events are not a substitute for claiming
real-device testing.

## 7. Level content workflow

- Levels live in `content/levels/<world>/*.json`; discovery is automatic via the raw glob in
  `src/core/level-repository.ts`.
- Use the existing schema; never duplicate validation rules or add a second level format.
- Place spawn/goal in empty cells directly above solid terrain (bottom-center anchor).
- Place coins/stars in empty cells (center anchor) above reachable ground/platforms; never inside
  solid terrain.
- Place enemies in empty cells (feet anchor) with solid ground directly below; author ordered patrol
  columns that contain the enemy cell and stay over solid ground.
- Keep rectangles within bounds; one static body per solid area.
- Prefer reachable geometry (steps ≤ ~100 px, gaps ≤ ~3 tiles with current tuning).
- Add the level ID to `content/config/level-order.json` when it belongs to the campaign.
- Test the level via `?level=<id>`, then run `npm run test`, `npm run typecheck`, `npm run build`.
- Add a level without editing TypeScript. The practical tutorial lives in
  `docs/LEVEL_FORMAT.md#9-how-to-create-level-04json-without-modifying-typescript`.
- Place shield and magnet in reachable empty cells. Verify effects leave scoring totals unchanged.
- Scoring values live in `content/config/scoring.json`; save schema changes require a migration and
  tests.

## 7. Git conventions

- One task per commit (or a small, clearly described series).
- Commit message: imperative summary plus scope, e.g.
  `feat(foundation): add scene navigation and level contract`.
- Never commit `node_modules/`, `dist/`, `coverage/`, logs or local editor files.
- Do not rewrite or discard the user's uncommitted work. Inspect before staging.
- If a task produces no commit, say so in the report and include `git status`.

## 8. Review checklist

Before handing off, confirm:

- [ ] Scope: only the requested task was implemented.
- [ ] Documentation: relevant docs updated; decisions and deviations recorded.
- [ ] TypeScript: `npm run typecheck` passes.
- [ ] Tests: `npm run test` passes, with new coverage for new logic.
- [ ] Build: `npm run build` succeeds.
- [ ] Runtime: `npm run dev` boots; expected navigation/interaction was observed.
- [ ] Physics/input: movement, jump, platforms, respawn and release-to-stop were exercised.
- [ ] Touch: forced controls show; LEFT/RIGHT/JUMP and multitouch were exercised (state whether on a
      real device or via synthetic events).
- [ ] Input cleanup: restarting the scene does not duplicate keyboard/pointer listeners or captures.
- [ ] Levels: all affected IDs load; spawn/terrain/goal/camera and gaps/water/error states verified.
- [ ] Collectibles: JSON-driven, tile-center anchors, collected once, HUD/score updated once.
- [ ] Enemies: JSON archetypes/placements, feet anchors, patrol bounds/ledges, terrain collision.
- [ ] Combat: stomp vs damage exclusive, spiky not stompable, multi-hit enemies, score once.
- [ ] Health: clamping, 1000 ms invulnerability, knockback/flash/input lock, HUD update on change.
- [ ] Game Over: transitions once, freezes collection/victory, writes no record, RETRY restores all.
- [ ] Respawn: health/collected objects/score/enemies preserved; Retry starts a fresh run.
- [ ] Victory: result counts/score (with enemy points)/rating correct; settlement runs once;
      next/final level handled.
- [ ] Progression: explicit order, initial unlock, next unlock, replay allowed, locked rejected.
- [ ] Save: versioned/validated, survives refresh, best records never shrink, corruption recovered.
- [ ] Restart: static/dynamic body counts, text objects and listeners stay stable.
- [ ] Content: no hardcoded level data; JSON (levels and player config) validated.
- [ ] Console: no uncaught errors or warnings introduced.
- [ ] Assets: no unapproved art/audio added; naming and grid rules respected.
- [ ] Android/browser: no Node-only APIs, no absolute asset URLs, touch still works.
- [ ] Report: honest about limitations and unverified behavior.

## 9. Handoff report

Every task ends with the mandated report (Arabic when requested) containing execution status,
versions, structure, implementation details, exact commands and results, problems, architecture
notes, readiness for the next task, Git status and a short summary. Include command output evidence
where it matters (test counts, build sizes, console errors).

## 10. Definition of done

A task is done when the requested behavior exists, the checks above pass, the documentation matches
the code, and an independent reviewer can reproduce the result from the report alone.

## 11. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Blank canvas | Import error or WebGL failure; check console and the dev error overlay |
| `Port 5173 is already in use` | Another dev server is running; stop it |
| Stale modules after refactor | Stop the dev server and restart; delete `node_modules/.vite` if needed |
| Phaser type error after upgrade | API changed between majors; check bundled types in `node_modules/phaser/types` |
| Canvas not centered | Host element has no size; `#game-root` must fill the viewport |
| Touch does nothing | Check `input.touch`, pointer event wiring, and whether another element overlays the canvas |
| JSON validation failure | Read the `path`/`message` pairs; fix the content, never bypass the validator |

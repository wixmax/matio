# Architecture

## 1. Stack

| Layer | Choice | Version | Rationale |
| --- | --- | --- | --- |
| Engine | Phaser | 4.2.1 | Stable Phaser 4 release, WebGL-first renderer, MIT licensed, one runtime dependency |
| Physics | Phaser Arcade Physics | bundled | Predictable platformer collisions, fixed step |
| Language | TypeScript | 7.0.2 | Strict typing; native compiler passes `tsc --noEmit` |
| Bundler | Vite | 8.3.8 | Fast dev server, `import.meta.glob`, small config |
| Tests | Vitest | 5.1.1 | Node tests for pure logic and content |
| Runtime | Browser / WebView | - | No backend, no SSR, no UI framework |

Phaser 4 specifics that matter:

- `Phaser.AUTO` selects WebGL and falls back to Canvas.
- Phaser 4 has no game-level `resolution` option (DPR strategy in section 5).
- Bundled TypeScript definitions are the source of truth; no `@types/phaser`.
- Container input hit areas use **top-left box coordinates**, not centered coordinates.
- `import.meta.glob` with `{ eager: true, query: '?raw', import: 'default' }` returns the raw JSON text
  of every matched file.

## 2. Directory responsibilities

```text
public/assets/            Static runtime art/audio (still empty)
content/levels/           Source-of-truth JSON levels (auto-discovered)
content/config/           Validated gameplay config (player.json)
src/core/                 Composition root: game config, constants, level catalog/order,
                          scoring/save singletons, dev bridge
src/scenes/               Boot, Menu, Game and Result scenes (lifecycle/orchestration)
src/entities/             Player, Collectible and procedural placeholder textures
src/systems/              Pure rules + Phaser-aware orchestration:
                          validators, scoring, progression, save, jump rules, geometry,
                          LevelRepository, LevelLoader, CollectionSystem
src/factories/            Phaser construction: terrain, backdrop, goal marker, collectibles
src/input/                Unified keyboard/touch input and pure input resolution
src/ui/components/        Reusable UI: text, button, HUD, header, debug/error panels
src/ui/screens/           Future composed UI screens (pause, shop)
src/types/                Phaser-free contracts (level, collectible, scoring, save, result, ...)
src/utils/                Small helpers
src/styles/               Global page CSS
tests/                    Vitest suites and content checks
tools/                    Future developer scripts
docs/                     Design/architecture/format/workflow/asset docs
```

Import direction:

```text
core -> scenes -> entities + input + ui + systems + factories + types
systems/LevelLoader + CollectionSystem -> factories + entities + systems + types
                                                      (Phaser-aware orchestration)
systems (pure) -> types
factories -> types + ui/theme + systems geometry
ui/components -> theme + utils
types -> (nothing, no Phaser)
```

`types/` never imports Phaser. `LevelRepository`, `level-geometry`, validators, scoring, progression,
save rules and jump rules stay engine-free. `LevelLoader`, `CollectionSystem` and the factories are
the only Phaser-heavy systems/factories.

## 3. Scene lifecycle

```text
Phaser boot
  └─ BootScene: init/preload/create -> MenuScene
  └─ MenuScene: START GAME / level cards -> GameScene({ levelId })
  └─ GameScene
       create():
         resolve level ID (?level= in dev, else scene data/default)
         getLevelRepository() -> getLevel(id)
         reject locked IDs through normal navigation (dev selector bypasses)
         loadLevel(scene, level) -> geometry + terrain + goal sensor + collectibles
         startPlayableLevel(...)
         OR showLevelError(failure) and return
       update():
         input -> player.tick -> fall/respawn -> debug HUD
       goal overlap:
         playing -> completing -> settle score/save once -> ResultScene(data)
       shutdown:
         destroy CollectionSystem/InputManager, stop camera follow, clear references
  └─ ResultScene: RETRY / NEXT LEVEL / MAIN MENU -> GameScene or MenuScene
```

`scene.start()` stops the previous scene. A successful `GameScene` owns one Player, one
InputManager, one CollectionSystem, one collider set and one camera follow target. An error state
owns no gameplay systems and shows only a blocking error panel with BACK TO MENU.

## 4. Level architecture and data flow

```text
content/levels/**/*.json
        │ import.meta.glob (build time, raw)
        ▼
core/level-repository  ──►  systems/LevelRepository
                                  │ parseLevelJson (existing validator)
                                  ▼
                            validated LevelDefinition by ID
                                  │
                            systems/level-geometry
                            tile→px, spawn/goal anchors, camera frame
                                  │
                            systems/LevelLoader
                     ┌────────────┼─────────────┐
                     ▼            ▼             ▼
              BackdropFactory TerrainFactory GoalMarkerFactory CollectibleFactory
                                  |              | (visual+sensor)  | (group)
                          solids[] (static)      |                  |
                                  |              |                  |
                          GameScene wiring: Player, colliders, overlaps,
                          CollectionSystem, world bounds, camera, input, HUD
```

### LevelRepository (`src/systems/LevelRepository.ts`)

- Takes `LevelSource[]` (`{ path, raw }`) so it is testable without Vite.
- Parses every source through `parseLevelJson`; no duplicate validation rules.
- Maps valid IDs to definitions; records invalid/duplicate failures separately.
- Duplicate IDs make the ID unavailable (never chooses arbitrarily).
- Unknown IDs return an error listing available IDs.
- Invalid unrelated files produce diagnostics but do not prevent a valid requested level.
- Exposes `listLevels()` summaries and `getDiagnostics()`.

`src/core/level-repository.ts` supplies the bundled glob sources lazily as a singleton.

### LevelLoader (`src/systems/LevelLoader.ts`)

- Accepts a validated `LevelDefinition`.
- Rejects a spawn cell that overlaps solid terrain (`unsafe-spawn`) before creating anything.
- Builds geometry, backdrop, terrain, goal marker/sensor and coin/star instances.
- Returns `LevelRuntime` with geometry, solid bodies, goal runtime, collectibles, backdrop and the
  unimplemented-object report.
- Does not create the player, input, camera, HUD, colliders or overlaps.
- Logs ignored `bomb`/`shield`/`magnet` objects and collectible totals in development.

### TerrainFactory (`src/factories/TerrainFactory.ts`)

- One visual rectangle per JSON area.
- One static Arcade body per **solid** area (`ground`, `platform`, `block`).
- `water` has no body and is purely visual.
- Adds grass caps/blocks details without altering collision geometry.
- No per-tile bodies; no per-frame updates.

### CollectibleFactory (`src/factories/CollectibleFactory.ts`)

- One `Collectible` sprite per validated coin/star placement.
- One Arcade group for a single player/collectibles overlap.
- Bodies have gravity disabled and are immovable: pickup only, never a blocking obstacle.
- Procedural textures live in `entities/collectible-textures.ts` and can be replaced by an atlas.

### GameScene

- Selects the level and renders a load error when necessary.
- Creates the Player at the JSON feet anchor.
- Configures world/physics/camera bounds from the level dimensions.
- Registers one player/terrain collider.
- Handles fall respawn and the development R shortcut.
- Never contains level layout data.

## 5. Display and game configuration

| Setting | Value |
| --- | --- |
| Logical size | 1280×720 |
| Renderer | `Phaser.AUTO` (WebGL, Canvas fallback) |
| Scale | FIT, centered, autoRound |
| Input | keyboard, mouse, touch, 4 pointers |
| Physics | Arcade, fixed 60 Hz, gravity from player.json |
| Background | #101a2b letterbox; scene sky |

Phaser 4 has no game-level `resolution`; the canvas backing store stays 1280×720 and is CSS-scaled.
All text goes through `addUiText()` which applies `resolution = min(devicePixelRatio, 2)`. Production
keeps the bundle lean; dev adds `window.__MATIO_GAME__` (`src/core/dev-bridge.ts`) and a debug HUD.

## 6. Coordinate and anchor conventions

- Level placement uses **tile units**; X right, Y down.
- Terrain `x`/`y` is the **top-left tile**; pixel rect = tile rect × `tileSize`.
- Spawn/goal cell anchor is **bottom-center**: `(x·tile + tile/2, (y+1)·tile)`.
- Player sprite origin remains `(0.5, 1)`; `player.y` is feet.
- Player body 38×84 at offset (13,12) inside the 64×96 frame; body bottom = feet.
- Camera/world dimensions = `size × tileSize`.
- Fall respawn threshold = `worldHeight + 2·tileSize` (documented margin, not a fixed pixel).

## 7. Camera

`GameScene.configureCamera()` derives a `CameraFrame`:

- Large axes use exact world bounds `0..worldSize`.
- Axes smaller than the viewport are padded symmetrically so the level is centered instead of
  pinned top-left.
- `camera.setZoom(1)`, `setBounds(frame)`, `startFollow(player, true, 0.1, 0.1)`, then `centerOn` the
  spawn. Lerp 0.1 gives a gentle side-scroller.
- Vertical follow is active for levels taller than 720 px (all shipped levels are).
- Camera bounds prevent scrolling past the world; horizontal/vertical clamps were verified.
- Touch controls and the level header use `scrollFactor(0)` and stay screen-fixed. No extra UI camera
  or UIScene is needed in this milestone.
- Respawn re-centers the camera on the spawn immediately.

## 8. Input architecture

`InputManager` is the only module reading devices and emits `PlayerInputState`:

```ts
interface PlayerInputState {
  moveX: -1 | 0 | 1;
  jumpPressed: boolean;
  jumpHeld: boolean;
}
```

- Keyboard: Left/Right/A/D, Up/W/Space, R (dev). Arrow/Space captures prevent page scrolling.
- Touch: semi-transparent buttons fixed to the camera; shown on touch devices or when forced with
  `?touch=1` (dev) / `VITE_FORCE_TOUCH_CONTROLS=true`.
- Edge detection: pure `computePlayerInputState`; queued touch taps and released→held transitions.
- Multitouch ownership is a `Map<pointerId, control>`; global pointer-up/up-outside/move-off/game-out
  plus pause/sleep/blur release ownership. No stuck input.
- Cleanup removes keys, captures, scene listeners and DOM listeners on shutdown. Repeated restarts
  keep exactly one set of listeners and 8 key objects (verified).
- Touch controls remain fixed while the camera scrolls (`scrollFactor 0` verified in browser).

## 9. Player

Unchanged from Task 002: Arcade Sprite, acceleration/drag/max velocity, variable jump, coyote,
buffer, jump-cut, double-jump protection and procedural visual states. The entity receives only
`PlayerInputState`. Movement tuning remains in `content/config/player.json`.

## 10. External configuration and content

- `content/config/player.json` imports at build time, is validated, and controls movement/gravity.
- `content/levels/**/*.json` is discovered by eager raw glob; editing/adding JSON requires only a
  reload/rebuild. Adding `level-04.json` needs no TypeScript changes.
- Object definitions are validated but ignored in Task 003; development diagnostics report counts.
- Invalid content never silently falls back to a different level.

## 11. UI, debug and errors

- `LevelHeader` shows level name/ID/size and controls, fixed to the camera.
- `GameHud` (production + dev) shows level name, coin/star counters and collected points. It is
  camera-fixed (`scrollFactor(0)`) and only rewrites text when a counter changes.
- `ResultScene` is a separate scene fed with plain data: counts, score, rating, best records and next
  level. RETRY/NEXT LEVEL/MAIN MENU use `TextButton` (shared mouse/touch path) and a local transition
  guard.
- `DebugHud` (dev only) adds scroll, velocity, grounded/visual/coyote/buffer, input, respawns,
  collectible counts, score and gameplay state.
- `LevelErrorPanel` is a blocking screen with the requested ID, error code, message, field paths and
  BACK TO MENU. It is used for unknown/invalid/duplicate/unsafe/locked/load failures.
- All text uses the DPR-aware text factory. Theme colors live in `ui/theme.ts`.
- Loading errors are logged to console and displayed; no uncaught promise rejections exist because
  discovery is synchronous.

## 12. Cleanup and restarts

- Phaser destroys display-list objects, physics bodies and colliders on scene shutdown; the scene does
  not manually destroy them (avoids double destruction).
- `GameScene.handleShutdown` destroys `CollectionSystem`, the goal overlap collider and
  `InputManager`, guards camera teardown order (`this.cameras?.main?.stopFollow()`), and clears its
  own references.
- The loader is synchronous, so a late async result cannot mutate a dead scene.
- Retry starts a new GameScene, which creates a fresh run ledger and new collectible instances. No
  run state is carried through the Phaser scene registry.
- Verified: restarts do not duplicate bodies/listeners; collected objects and save records behave as
  documented.

## 13. Testing

- 17 Vitest files, 156 tests: level validation, player config, input resolution, jump controller,
  level geometry/camera frame, collectible geometry/content, collection ledger, scoring/rating,
  scoring config, level order/progression, level launch policy, save validation/progress/store,
  gameplay state, level repository and level selector.
- Repository/content tests read all shipped levels and assert validity, unique IDs and that no
  collectible is authored inside solid terrain.
- Phaser construction, camera/input, collection overlap, victory and save persistence are verified in
  a real browser; Phaser is not mocked.
- Background/occluded Chromium tabs throttle `requestAnimationFrame`, so deterministic browser checks
  stop `game.loop` and call `game.step(time, 16.666)` manually. This is test instrumentation only.

## 14. Collectibles and collection safety

- Coin/star JSON `{x,y}` cells are converted to **cell centers**; spawn/goal stay bottom-center.
- Keys are derived deterministically from the validated object index (`coin:0`, `star:3`, ...).
- `Collectible.collect()` is the entity-level idempotency guard: it disables the Arcade body
  immediately and delays destruction until the feedback tween finishes.
- `CollectionLedger` is the run-level guard: only the first collection of a key changes counters,
  score or HUD. Overlap can fire repeatedly without duplicate rewards.
- `CollectionSystem` owns one player/group overlap, collection feedback (floating points, larger
  star ring) and `freeze()` for victory.
- Respawn keeps the ledger and already-collected objects. Retry creates a new scene/ledger.

## 15. Score, rating and victory settlement

- `content/config/scoring.json` is validated by `validateScoringConfig()` at startup:
  coin 100, collectible star 500, completion 1000, 2-star coin ratio 0.7.
- `computeRunScore()` and `computeRatingStars()` are pure and Phaser-free. The HUD shows collected
  points without the completion bonus; the result uses the final score including the bonus.
- Rating (1..3) is separate from collectible stars. 3 stars requires non-empty coin AND collectible
  star sets and collection of all of them; 2 stars requires the configured coin ratio; otherwise 1.
  Empty levels cannot receive a perfect rating by vacuous truth.
- The goal marker gains a non-solid static sensor zone. Goal overlap flips the scene state to
  `completing` synchronously, destroys gameplay input, freezes collection, computes score/rating,
  updates the save once and starts `ResultScene` with plain data.

## 16. Progression and save data

- `content/config/level-order.json` is the only campaign order. It is structurally validated and
  cross-checked against discovered level IDs at startup.
- First launch unlocks only the first configured level. Completion unlocks the next level in order;
  the final level has no next. Replaying completed levels is allowed.
- Normal navigation checks unlocks in the menu and again in GameScene. The development `?level=`
  selector is the only bypass and is ignored in production.
- `SaveStore` (localStorage adapter + in-memory fallback) stores `saveVersion: 1`,
  `unlockedLevelIds` and per-level best records. Every load is validated; corrupt/invalid data
  recovers to first-launch data with a diagnostic.
- Unsupported versions are never overwritten (a newer build may own them); the session reports that
  progress cannot be saved.
- Best records are monotonic (`Math.max` per field). Settlement is idempotent. No wallet/currency is
  implemented in this milestone.

## 17. Android / Capacitor considerations

- `base: './'` build works from a WebView/file origin.
- Levels and player config are bundled; no server or Node APIs at runtime.
- Touch input and 4 pointers are enabled; `touch-action: none` blocks browser gestures.
- Camera zoom stays 1 to keep touch hit-testing assumptions valid.
- WebAudio still needs a first user gesture; START GAME is the natural unlock.

## 18. Decision log

| Decision | Reason |
| --- | --- |
| Eager raw `import.meta.glob` for levels | Works in dev/prod/WebView; levels are tiny; no async state |
| Repository input is raw sources | Testable in Node without Vite/Phaser mocks |
| Duplicate IDs invalidate the ID | Prevents nondeterministic content selection |
| Spawn/goal = bottom-center of cell | Matches feet-origin player and flag base; avoids tile offset bugs |
| One body per terrain rectangle | Efficient; no hundreds of tile bodies |
| Water non-solid | No swimming/damage in this milestone |
| Ignore valid future objects with dev diagnostics | Keeps future content loadable without implementing power-ups |
| Collectibles use cell centers | Art sits inside the authored tile while the player keeps its feet anchor |
| Entity flag + run ledger for collection | Overlap callbacks can repeat; score/HUD must change once |
| Respawn keeps collection, Retry resets it | Matches the "attempt" model without penalizing a fall |
| Separate scoring/rating modules | Deterministic pure rules, testable without Phaser |
| 3 stars requires non-empty collectible sets | Empty levels must not receive an accidental perfect rating |
| Goal uses a non-solid sensor zone | Reaching the flag never becomes a physical obstacle |
| Explicit `level-order.json` | Filesystem order is not gameplay design |
| Versioned, validated localStorage save | Safe first launch, corruption recovery and future migration |
| Never overwrite an unsupported save version | Protects progress written by a newer build |
| Best records use per-field `Math.max` | A weaker replay never destroys a better record |
| No persistent wallet in Task 004 | Avoids unrun replay-farming rules and shop coupling |
| Camera lerp 0.1, zoom 1 | Gentle follow; keeps touch hit-testing simple |
| Pad camera bounds for small levels | Centers small worlds instead of top-left pinning |
| Fall margin 2 tiles | Explicit level-relative value, not a screen constant |
| Keep gameplay systems out of error state | No partial invalid world |
| Dev query selector only in dev | No user-facing level menu yet; production is deterministic |

## 19. Known risks

1. Phaser 4 is young; verify APIs against bundled types/skills.
2. Canvas fallback was not exercised.
3. DPR > 1 visual sharpness is unverified.
4. Touch was verified with synthetic events and UI event emission, not physical devices.
5. Production preview loads and starts through a real browser click; the full production playthrough
   and production save write were not replayed because the dev bridge is intentionally absent.
6. Level content is bundled; no runtime level editing/hot reload beyond Vite.
7. Camera zoom is fixed at 1; `TouchControlButton.isPointerWithin` assumes zoom 1.
8. Bomb/shield/magnet object definitions remain valid but unimplemented.
9. Level design is placeholder and not tuned by a designer; collectible reachability was checked
   against the jump arc and solid-cell validation, not exhaustively played on a device.
10. Eager glob loads all level JSON at startup (acceptable now; revisit for large catalogs).
11. Persistent currency, shop and replay-farming rewards are intentionally absent.
12. Save data is local-only; clearing site data removes progress.

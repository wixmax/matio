# Architecture

## Task 007-A player transformations

`player-forms.json` schema 1 configures growth duration, visual scale and per-axis
body multipliers. Startup validation requires a positive safe integer duration,
scales in (1, 2] and enlarged body dimensions that fit the scaled frame. World body
dimensions are rounded to the nearest pixel. The procedural source frame remains
64 × 96 with origin (0.5, 1).

| Form | Visual scale | Arcade size in world pixels | Arcade source size | Source offset from frame top-left |
| --- | --- | --- | --- | --- |
| Small | 1 | 38 × 84 | 38 × 84 | (13, 12) |
| Big | 1.4 | 46 × 130 | (230/7) × (650/7) | (109/7, 22/7) |

The big form's rendered offset is (21.8, 4.4) px. Both bodies share the same feet
and horizontal center. `Player.resizeForm()` changes the existing Arcade body
in `GameScene.update()`, after the collision pass and before Arcade post-update
copies displacement to the sprite. It rebases the current and previous top-left
positions by the same shape delta. Velocity, acceleration, contact flags and
jump timers are retained. Stomp classification continues to use the prior
bottom edge and actual descent. Shrink occupies a subset of the former body at
the same anchor, including near walls and during a fall.

The collectible callback queues a request. `PlayerTransformation` owns the
physical form and any pending request, while the attempt's `ActiveEffects`
owns the single growth duration alongside shield and magnet. `EffectSystem`
checks the prospective body against cached solid terrain, full world bounds
and live enemy bodies before a pending request is applied. Edge contact is
allowed. The enemy check prevents a resize from creating a combat overlap.
An accepted pickup starts or refreshes a full 20 seconds after the frame's
effect clock advances. Countdown pauses with the scene or hidden document.

Fall respawn checks clearance at the spawn and suspends the big body when needed.
The original time continues running in that case, and the small player can
leave the obstruction and resume the remaining interval. A fresh banked pickup
remains untimed. Terminal paths dispose the effects and clear pending state.
Retry builds a fresh run. Growth never changes damage or save rules.

Bombs use the current body edge and proportional hand height. Shield aura and
flash scale around the physical center. Magnet reads the current body center,
and both overlap and pulled coins still settle via CollectionSystem.

Future animation frames and AI-generated player sprites need a consistent
bottom-center feet pivot across both forms, idle, run, jump, fall and landing.
Keep source frames untrimmed or preserve the full source frame and pivot in
atlas metadata. Update the frame-to-body mapping centrally if art dimensions
change, then recheck grounded feet, headroom and hand placement in both forms.

## Task 006-A bomb combat

`content/config/bombs.json` is validated before startup. Each GameScene run owns a
`BombSystem` and in-memory `BombInventory`. Validated level `bomb` objects become
nonblocking overlap pickups at cell centers. A full inventory leaves the pickup in
place. Falling retains inventory, collected pickups, score and live projectiles.
Retry creates a fresh run.

InputManager merges X/J and touch THROW into one press. BombSystem checks cooldown,
ammunition and active projectile count before spending. Arcade projectiles share
one texture, collide with solid terrain and bounce modestly. The fuse advances
with gameplay time. Explosion circles intersect enemy body rectangles, then call
EnemySystem for damage and EnemyLedger scoring. Victory, Game Over and shutdown
remove active bombs and explosion graphics. Both the fuse and the graphics
advance with gameplay time, so neither needs an asynchronous callback.
Future breakable blocks may separately consume explosion
positions and radii without changing enemy damage or inventory.

## Task 006-B temporary effects

Startup validates schema-1 `content/config/effects.json` as bundled configuration.
The engine-free `ActiveEffects` tracks independent durations and shield charges.
A pickup refreshes its configured duration and replenishes charges up to their cap.
The scene advances it with Phaser gameplay delta. Pause and sleep stop scene updates,
and hidden tabs skip effect updates. Fall respawn keeps the same manager and pickup
entities. Victory, Game Over and scene shutdown dispose the effects and shield visuals.
Retry constructs a fresh attempt.

The level loader places power-ups at the same tile-center anchors as coins and stars.
CollectionSystem owns overlaps and the shared entity guard, routes power-up pickups
to EffectSystem, and records scoring pickups in CollectionLedger. EnemySystem resolves
stomps first. Damage checks PlayerHealth eligibility, tries shield absorption, then
applies normal damage when eligible. Absorption starts the configured combat
invulnerability window to prevent repeated contact callbacks from spending or damaging
again in the same window.

EffectSystem pulls only the coin list from CollectibleFactory. It checks the straight
segment from coin center to player body center against existing solid rectangles expanded
by the coin body's half-extents. Close corners can block attraction. Movement uses the
configured speed and the usable fraction of the gameplay frame, with the existing overlap
body. Pulled coins stop bobbing and keep their positions when the effect ends. The magnet's
distance threshold and ordinary Arcade overlap both settle through CollectionSystem.collect.
The HUD updates effect text on whole-second or charge changes. Effects have no save model.
A future power-up can use the same run-owned clock and pickup hook, with its own gameplay
rules and visuals.

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
src/entities/             Player, Collectible, Enemy and procedural placeholder textures
src/systems/              Pure rules + Phaser-aware orchestration:
                          validators, scoring, progression, save, jump rules, geometry,
                          combat rules, player health, patrol behavior, enemy ledger,
                          LevelRepository, LevelLoader, CollectionSystem, EnemySystem, BombSystem, EffectSystem
src/factories/            Phaser construction: terrain, backdrop, goal marker,
                          collectibles and enemies
src/input/                Unified keyboard/touch input and pure input resolution
src/ui/components/        Reusable UI: text, button, HUD, header, debug/error panels
src/ui/screens/           Future composed UI screens (pause, shop)
src/types/                Phaser-free contracts (level, collectible, enemy, combat,
                          scoring, save, result, game over, ...)
src/utils/                Small helpers
src/styles/               Global page CSS
tests/                    Vitest suites and content checks
tools/                    Future developer scripts
docs/                     Design/architecture/format/workflow/asset docs
```

Import direction:

```text
core -> scenes -> entities + input + ui + systems + factories + types
systems/LevelLoader + CollectionSystem + EnemySystem + BombSystem + EffectSystem
        -> factories + entities + systems + types
                                                      (Phaser-aware orchestration)
systems (pure) -> types
factories -> types + ui/theme + systems geometry
ui/components -> theme + utils
types -> (nothing, no Phaser)
```

`types/` never imports Phaser. `LevelRepository`, `level-geometry`, validators, scoring, progression,
save rules, jump rules, combat rules, player health, patrol behavior and the enemy ledger stay
engine-free, as do `ActiveEffects` and the effect rules. Phaser-aware systems wire those rules to the game.

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
         loadLevel(scene, level) -> geometry + terrain + goal sensor +
                                    collectibles + enemies
         startPlayableLevel(...)
         OR showLevelError(failure) and return
       update():
          input -> player.tick -> enemySystem.update -> fall/respawn -> debug HUD
        player/enemy collider:
          playing -> stomp (enemy damage/bounce/score)
                   OR damage (health/knockback/invulnerability)
                   health 0 -> gameover once -> GameOverScene(data)
        goal overlap:
          playing -> completing -> settle score/save once -> ResultScene(data)
        shutdown:
          destroy EnemySystem/CollectionSystem/InputManager, stop camera follow,
          clear references
   └─ ResultScene: RETRY / NEXT LEVEL / MAIN MENU -> GameScene or MenuScene
   └─ GameOverScene: RETRY / MAIN MENU -> GameScene or MenuScene (no saves)
```

`scene.start()` stops the previous scene. A successful `GameScene` owns one Player, one
InputManager, one PlayerHealth, one CollectionSystem, one EnemySystem, one collider/overlap set and
one camera follow target. An error state owns no gameplay systems and shows only a blocking error
panel with BACK TO MENU. A failed run never writes a level record or unlocks a level.

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
                     ┌────────────┼─────────────┬──────────────┐
                     ▼            ▼             ▼              ▼
              BackdropFactory TerrainFactory GoalMarkerFactory CollectibleFactory
                                  |              | (visual+sensor)  | (group)
                          solids[] (static)      |                  |
                                  |              |                  |
                                  |       EnemyFactory (group, ground rects)
                                  |              |
                          GameScene wiring: Player, colliders, overlaps,
                          CollectionSystem, EnemySystem, PlayerHealth,
                          world bounds, camera, input, HUD
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

- Accepts a validated `LevelDefinition` plus the validated enemy registry.
- Rejects a spawn cell that overlaps solid terrain (`unsafe-spawn`) before creating anything.
- Cross-checks every enemy placement against the registry and terrain safety before instantiating
  anything; unknown archetypes or unsafe cells return an `invalid-level` failure with field paths.
- Builds geometry, backdrop, terrain, goal marker/sensor, scoring and effect pickups, and enemies.
- Returns `LevelRuntime` with geometry, solid bodies, goal runtime, pickups, enemies and backdrop.
- Does not create the player, input, camera, HUD or player-facing colliders/overlaps.
- Logs scoring collectible totals and enemy counts in development.

### TerrainFactory (`src/factories/TerrainFactory.ts`)

- One visual rectangle per JSON area.
- One static Arcade body per **solid** area (`ground`, `platform`, `block`).
- `water` has no body and is purely visual.
- Adds grass caps/blocks details without altering collision geometry.
- No per-tile bodies; no per-frame updates.

### CollectibleFactory (`src/factories/CollectibleFactory.ts`)

- One `Collectible` sprite per validated coin, star, shield, magnet or growth mushroom placement.
- One Arcade group for a single player/collectibles overlap.
- Bodies have gravity disabled and are immovable: pickup only, never a blocking obstacle.
- Procedural textures live in `entities/collectible-textures.ts` and can be replaced by an atlas.

### EnemyFactory (`src/factories/EnemyFactory.ts`)

- One `Enemy` sprite per validated placement; one dynamic physics group per level.
- Resolves archetype tuning from `content/config/enemies.json` (never inline in the entity).
- Passes solid terrain rectangles for allocation-free ledge probes.
- Procedural textures live in `entities/enemy-textures.ts`, keyed `matio-enemy-<archetype>`.

### EnemySystem (`src/systems/EnemySystem.ts`)

- Owns the enemy/terrain collider, the player/enemy collider, patrol updates and the defeat ledger.
- Classifies each contact once with `combat-rules.classifyEnemyContact`.
- Freezes combat on victory/game over and destroys its colliders on scene shutdown.
- Emits HUD events (`onChanged`, `onPlayerDamaged`) and the terminal `onPlayerDefeated`.
- Never writes save data.

### GameScene

- Selects the level and renders a load error when necessary.
- Creates the Player at the JSON feet anchor, one `PlayerHealth`, collectibles and enemies.
- Configures world/physics/camera bounds from the level dimensions.
- Registers player/terrain collision, collection/goal overlaps and delegates enemy combat to
  `EnemySystem`.
- Handles fall respawn, the development R shortcut, victory settlement and Game Over transition.
- Never contains level layout data or combat classification rules.

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
- The small player body is 38×84 at offset (13,12) inside the 64×96 frame.
  Both small and big forms align the body bottom with the feet.
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

Arcade Sprite with acceleration/drag/max velocity, variable jump, coyote, buffer, jump-cut,
double-jump protection and procedural visual states. The entity receives only `PlayerInputState`.
Movement tuning remains in `content/config/player.json`.

Task 005 adds damage presentation only: `bounce()`, `applyKnockback()`, `stun()` (a short input lock)
and `startDamageFlash()`. Hit points and invulnerability remain in the engine-free `PlayerHealth`
model (`systems/player-health.ts`); the Player never decides how much damage it takes.

## 10. External configuration and content

- `content/config/player.json` imports at build time, is validated, and controls movement/gravity.
- `content/config/enemies.json` defines archetype balance (health, speed, behavior, stompable,
  damage, score) and is validated before the game starts.
- `content/config/combat.json` defines max/starting health, invulnerability, knockback, input lock,
  damage flash, stomp bounce and top-contact tolerance.
- `content/levels/**/*.json` is discovered by eager raw glob; editing/adding JSON requires only a
  reload/rebuild. Adding `level-04.json` needs no TypeScript changes.
- Enemy placements reference an archetype by ID; LevelLoader rejects unknown IDs or unsafe cells.
- `content/config/effects.json` defines durations, shield charges, magnet radius, speed and collection distance.
- Invalid content never silently falls back to a different level.

## 11. UI, debug and errors

- `LevelHeader` shows level name/ID/size and controls, fixed to the camera.
- `GameHud` (production + dev) shows level name, coin/star counters, collected points and player
  health hearts. It is camera-fixed (`scrollFactor(0)`) and only rewrites text when a value changes.
- `ResultScene` is a separate scene fed with plain data: counts, enemy defeats/points, score, rating,
  best records and next level. RETRY/NEXT LEVEL/MAIN MENU use `TextButton` (shared mouse/touch path)
  and a local transition guard.
- `GameOverScene` is a separate scene fed with plain data. It offers RETRY and MAIN MENU only, shows
  the run score without the completion bonus and states that no record was saved.
- `DebugHud` (dev only) adds scroll, velocity, grounded/visual/coyote/buffer, input, respawns,
  collectible counts, health/invulnerability, enemy defeats/points, score and gameplay state.
- `LevelErrorPanel` is a blocking screen with the requested ID, error code, message, field paths and
  BACK TO MENU. It is used for unknown/invalid/duplicate/unsafe/locked/load failures.
- All text uses the DPR-aware text factory. Theme colors live in `ui/theme.ts`.
- Loading errors are logged to console and displayed; no uncaught promise rejections exist because
  discovery is synchronous.

## 12. Cleanup and restarts

- Phaser destroys display-list objects, physics bodies and colliders on scene shutdown; the scene does
  not manually destroy gameplay display objects.
- `GameScene.handleShutdown` destroys `EnemySystem` (its two colliders), `CollectionSystem`, the goal
  overlap, `InputManager`, guards camera teardown order (`this.cameras?.main?.stopFollow()`) and
  clears its own references.
- The loader is synchronous, so a late async result cannot mutate a dead scene.
- Retry (result or Game Over) starts a new GameScene, which creates fresh enemies, collectibles,
  ledgers and health. No run state is carried through the Phaser scene registry.
- Verified: repeated scene transitions keep exactly five colliders, eight input keys, one enemy set
  and full health; collected objects and save records behave as documented.

## 13. Testing

- 24 Vitest files, 233 tests: level validation, player config, input resolution, jump controller,
  level geometry/camera frame, collectible geometry/content, collection ledger, scoring/rating,
  scoring config, level order/progression, level launch policy, save validation/progress/store,
  gameplay state, level repository/selector, enemy config, enemy placement safety, patrol behavior,
  stomp classification, player health/invulnerability, enemy ledger and combat config.
- Repository/content tests read all shipped levels and assert validity, unique IDs, no collectible
  inside solid terrain, valid enemy archetypes, ordered patrols and solid ground below enemies.
- Phaser construction, camera/input, collection overlap, victory, enemy stomps, player damage,
  invulnerability, Game Over and save persistence are verified in a real browser; Phaser is not
  mocked.
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

## 15. Enemies, health and combat

### Enemy data and lifecycle

- `content/config/enemies.json` (schema 1) is validated by `validateEnemiesConfig()` before boot.
  Each archetype owns health, speed, behavior, stompable, contact damage and defeat score.
- Level objects of type `enemy` reference an archetype and include inclusive patrol tile columns.
  The structural validator checks types/bounds/order; LevelLoader cross-checks the registry and
  terrain (empty cell, solid ground below) before creating anything.
- `EnemyFactory` creates one dynamic `Enemy` per placement in one group; `EnemySystem` owns both
  colliders (enemy/terrain first, player/enemy second).
- `Enemy` owns health, alive state, patrol velocity and placeholder visuals. A defeated enemy
  disables its body immediately and fades out; dead enemies cannot damage or be scored twice.
- `EnemyLedger` records each defeat key once. `EnemySystem` converts it into score contributions;
  there is no second independent score accumulator.

### Patrol behavior

`systems/enemy-behaviors.ts` is pure and deterministic. A patrol step reverses at:
1. an Arcade `blocked` wall, then
2. the authored body-edge patrol bounds, then
3. a missing ground probe ahead while grounded (ledge/water safety).

The probe checks the level's solid pixel rectangles, so it allocates nothing per frame. Enemies use
Arcade velocity only; they never teleport, chase, jump or fly.

### Contact classification

`systems/combat-rules.ts` classifies each contact once:

- **stomp** requires `enemy.stompable`, downward movement this step (`body.deltaY() > 0` or positive
  velocity) and the previous-step player body bottom at/above the enemy body top within the configured
  tolerance. Arcade separation may zero velocity before the callback, so previous geometry is used.
- **damage** is every other contact, including side/rising hits, near-edge side hits and any contact
  with a non-stompable enemy (spiky). A stomp and damage never both apply to one contact.

A stomp deals exactly one damage, bounces the player with `combat.stomp.bounceVelocity`, and awards
defeat score only when health reaches zero. A two-health snail therefore requires two stomps.
Spiky health is reserved for future combat methods and is not reduced by stomping in this milestone.

### Player health and feedback

- `systems/player-health.ts` is Phaser-free: integer health clamped to `0..maxHealth`, 1000 ms
  invulnerability, explicit `tick(deltaMs)`, and a full reset for a fresh attempt.
- A damaging contact applies knockback away from the enemy, a short configurable input lock, a damage
  flash and a HUD update. Repeated contact frames cannot drain health during invulnerability.
- Health 0 flips gameplay to `gameover` once, freezes collection/combat and starts `GameOverScene`.
  A failed run writes no record, grants no completion bonus and unlocks nothing. RETRY starts a new
  scene with full health, all enemies and all collectibles.
- Falling remains Task 004 policy: respawn at the JSON spawn, no health loss, collected objects and
  run points preserved, enemy states preserved, velocity/jump timers reset.

## 16. Score, rating and victory settlement

- `content/config/scoring.json` is validated by `validateScoringConfig()` at startup:
  coin 100, collectible star 500, completion 1000, 2-star coin ratio 0.7.
- `computeRunScore()` and `computeRatingStars()` are pure and Phaser-free.
  `computeRunScoreWithEnemies()` adds the enemy contribution; with zero enemy points it returns the
  exact pre-Task-005 breakdown and total. The HUD shows collected + enemy points without the
  completion bonus; the result uses the final score including the bonus.
- Rating (1..3) is separate from collectible stars and unchanged by enemy defeats. 3 stars requires
  non-empty coin AND collectible star sets and collection of all of them; 2 stars requires the
  configured coin ratio; otherwise 1. Empty levels cannot receive a perfect rating by vacuous truth.
- The goal marker gains a non-solid static sensor zone. Goal overlap flips the scene state to
  `completing` synchronously, destroys gameplay input, freezes collection/enemies, computes
  score/rating, updates the save once and starts `ResultScene` with plain data.

## 17. Progression and save data

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

## 18. Android / Capacitor considerations

- `base: './'` build works from a WebView/file origin.
- Levels and player config are bundled; no server or Node APIs at runtime.
- Touch input and 4 pointers are enabled; `touch-action: none` blocks browser gestures.
- Camera zoom stays 1 to keep touch hit-testing assumptions valid.
- WebAudio still needs a first user gesture; START GAME is the natural unlock.

## 19. Decision log

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
| Enemies use bottom-center feet anchors | Same convention as the player/spawn; no second coordinate system |
| Patrol bounds are tile columns expanded to body-edge pixels | Authored in level units while collisions stay in pixels |
| Previous-step body bottom for stomp detection | Arcade separation can zero velocity; current Y alone is brittle |
| Stomp and damage are one exclusive branch | One contact can never both defeat an enemy and hurt the player |
| Spiky is damage-only in Task 005 | Keeps combat methods (bombs/projectiles) out of this milestone |
| Enemy score in `EnemyLedger`, merged by the scoring module | One run-score authority; no divergent accumulator |
| Zero-enemy breakdown omits `enemyPoints` | Preserves exact pre-Task-005 score/format for old levels |
| Explicit `GameOverScene` with no next level | Terminal failure cannot accidentally unlock or save progression |
| Per-enemy procedural texture key | Final sprites can replace placeholders without touching the entity |

## 20. Known risks

1. Phaser 4 is young; verify APIs against bundled types/skills.
2. Canvas fallback was not exercised.
3. DPR > 1 visual sharpness is unverified.
4. Touch was verified with synthetic events and UI event emission, not physical devices.
5. Production preview loads and starts through a real browser click; the full production playthrough
   and production save write were not replayed because the dev bridge is intentionally absent.
6. Level content is bundled; no runtime level editing/hot reload beyond Vite.
7. Camera zoom is fixed at 1; `TouchControlButton.isPointerWithin` assumes zoom 1.
8. Magnet obstruction uses a direct swept path; coins behind close corners can remain in place.
9. Level design is placeholder and not tuned by a designer; collectible/enemy reachability was checked
   against the jump arc and solid-cell validation, not exhaustively played on a device.
10. Eager glob loads all level JSON at startup (acceptable now; revisit for large catalogs).
11. Persistent currency, shop and replay-farming rewards are intentionally absent.
12. Save data is local-only; clearing site data removes progress.
13. Enemy and stomp balance (speeds, tolerance, knockback) is placeholder and only unit/browser
    verified, not play-tested on mid-range Android hardware.
14. Enemies do not respawn after falling below the world; shipped patrol bounds prevent this, but
    future content must keep enemies on solid ground.

# Architecture

## 1. Stack

| Layer | Choice | Version | Rationale |
| --- | --- | --- | --- |
| Engine | Phaser | 4.2.1 | Stable Phaser 4 release, WebGL-first renderer, MIT licensed, one runtime dependency |
| Physics | Phaser Arcade Physics | bundled | Cheap, predictable platformer collisions |
| Language | TypeScript | 7.0.2 | Strict typing; the native compiler passes `tsc --noEmit` on this project |
| Bundler | Vite | 8.3.8 | Fast dev server, HMR, small config surface |
| Tests | Vitest | 5.1.1 | Shares the Vite pipeline, Node environment for pure modules |
| Runtime | Browser / WebView | - | No backend, no SSR, no UI framework |

`package.json` pins exact versions so builds are reproducible. Upgrades are a deliberate task, not
an automatic one.

Phaser 4 specifics that matter here:

- `Phaser.AUTO` selects WebGL and falls back to Canvas. Phaser 4 deprecates the Canvas renderer;
  the fallback exists only as a safety net.
- Phaser 4 has **no** `resolution` game-config option. See section 5 for the DPR strategy.
- Phaser 4 ships its own TypeScript definitions; no `@types/phaser` package is used.
- Container hit areas are expressed in **top-left box coordinates**, not coordinates centered on
  the container origin. `TextButton` and `TouchControlButton` account for this.

## 2. Directory responsibilities

```text
public/assets/            Static runtime assets served as-is (art, audio). Empty today.
content/levels/           Source-of-truth JSON level files (contract; no loader yet).
content/config/           Validated gameplay configuration (player.json today).
src/core/                 Composition root: game config, content loading, constants, error/debug.
src/scenes/               Scene lifecycle and orchestration only.
src/entities/             Game objects with behavior (Player) and placeholder textures.
src/systems/              Reusable engine-free rules (validators, jump/coyote/buffer logic).
src/factories/            Future construction of objects from validated definitions.
src/input/                Unified keyboard/touch input, pointer ownership, pure input resolution.
src/ui/components/        Dumb reusable UI (text factory, button, debug HUD).
src/ui/screens/           Future composed UI screens (pause, victory, shop).
src/types/                Shared contracts (level, player, config, validation result).
src/utils/                Small helpers with no gameplay knowledge.
src/styles/               Global page CSS (canvas host, error overlay).
tests/                    Vitest suites and fixtures.
tools/                    Future developer scripts (content checks, asset tooling).
docs/                     Design and engineering documentation.
```

Import direction (keep it acyclic):

```text
core -> scenes -> entities + input + ui/components + systems + types
input -> systems (pure) + types + ui/theme
entities -> systems + types + player textures
ui/components -> theme + utils
systems -> types
types -> (nothing)
```

- Scenes may import systems, input, entities and UI components; systems must never import scenes,
  input, entities or UI.
- `types/` contains only types and schema constants; no Phaser imports.
- `src/core/` is the only place allowed to import every scene (composition root).
- Level JSON is never imported by TypeScript source. Player tuning JSON **is** imported at build time
  (see section 8) because it is small, versioned and must exist before Phaser boots.

## 3. Scene lifecycle

Registered order in `src/core/game-config.ts`: `BootScene`, `MenuScene`, `GameScene`. Only the
first scene starts automatically.

```text
Phaser boot
  └─ BootScene
       init() -> preload() -> create()
       create(): startup diagnostics, then scene.start('MenuScene')
  └─ MenuScene
       create(): backdrop, title, START GAME button, version label
       button pointerup -> scene.start('GameScene')
  └─ GameScene
       create(): arena, Player, InputManager, collider, bounds, HUD
       update(): inputManager.update() -> player.tick() -> reset/respawn -> HUD
       shutdown: inputManager.destroy(), HUD released
```

`scene.start()` stops the current scene and starts the target, so only one gameplay scene is active
at a time. Scene keys live in `SCENE_KEYS`; never hardcode them at call sites.

Responsibilities:

- **BootScene**: engine/startup initialization and startup-only asset loading. No gameplay.
- **MenuScene**: startup screen, menu interaction, navigation.
- **GameScene**: creates the temporary arena, wires the Player, InputManager and collider, and
  handles respawn. It contains arena presentation data for this milestone only; level content will
  move behind the JSON LevelLoader in a later task.

Every scene registers shutdown cleanup for anything it adds to global managers (keyboard captures,
window listeners, scene input listeners).

## 4. Runtime layers

```text
content JSON  ->  validator  ->  typed config / LevelDefinition
                                      |
                          factories (future) -> entities
                                      |
                   systems (jump rules, validation, future scoring)
                                      |
              scenes (orchestration, camera, lifecycle, arena)
                                      |
        input layer (keyboard + touch -> PlayerInputState)
                                      |
                          UI components/screens
```

Rules:

1. **Content** describes data. It contains no behavior.
2. **Validation** is the only trusted entry point from JSON to typed runtime data.
3. **Input** converts physical devices into a normalized snapshot. Entities never query devices.
4. **Entities** own per-instance state and behavior (movement, facing, visual state).
5. **Systems** implement reusable rules with no Phaser dependency where practical.
6. **Scenes** orchestrate and own lifecycle; they should read like a wiring diagram.
7. **UI** reads state and emits intents; it never mutates gameplay state directly.

## 5. Game configuration and display

`src/core/game-config.ts` builds the single source of truth and receives the validated player config:

| Setting | Value | Why |
| --- | --- | --- |
| Logical size | 1280×720 | 16:9 landscape-first design space |
| Renderer | `Phaser.AUTO` | WebGL when available, Canvas fallback |
| Scale mode | `Phaser.Scale.FIT` | Preserve aspect ratio; never stretch |
| Auto center | `Phaser.Scale.CENTER_BOTH` | Centered canvas in the host element |
| `autoRound` | `true` | Avoids fractional CSS sizes on low-end devices |
| Physics | Arcade, gravity from `player.json` | Tuning lives in content, not scene code |
| Physics step | fixed 60 Hz | Deterministic movement across render frame rates |
| Input | keyboard, mouse, touch, **4 pointers** | Left + right + jump + one spare |
| Background | `#101a2b` | Letterbox color around the canvas |

**DPR strategy.** Phaser 4 removed the game-level `resolution` option. The canvas backing store
renders at the logical 1280×720 size and the ScaleManager scales it with CSS. To keep text sharp,
every `Text` object is created through `addUiText()`, which sets `resolution` to
`min(devicePixelRatio, 2)`. This is a deliberate performance trade-off for a lightweight,
mobile-first game.

The dev console logs renderer, logical size, DPR and Arcade gravity on boot. Development builds also
expose `window.__MATIO_GAME__` (`src/core/dev-bridge.ts`) for debugging and verification.

## 6. Player entity and physics

`src/entities/Player.ts` extends `Phaser.Physics.Arcade.Sprite`.

### Physics body and origin

- Placeholder frames: **64×96** (`src/entities/player-textures.ts`), six procedural textures
  (idle, two run frames, rise, fall, land).
- Sprite origin: **(0.5, 1)**. `player.y` is the feet position.
- Collision body: **38×84**, offset **(13, 12)** inside the frame. Body bottom = feet.
- Body is fixed while textures swap; visuals never scale the body.
- Facing uses `flipX`; the collision body is unaffected.

Implication for respawn: `Body.reset(x, y)` synchronizes the body from the sprite but not the body
offset. `Player.respawnAt()` deliberately does **not** call `updateFromGameObject()` afterwards;
the next physics `preUpdate` applies the offset before syncing `prev/prevFrame`, so the sprite is
not shifted by the offset.

### Movement rules

- Horizontal intent is applied with `setAccelerationX(intent × acceleration)`.
- When intent is neutral, acceleration is zero and Arcade drag (`dragX = deceleration`) brings
  velocity to zero. Max horizontal velocity is capped by `maxVelocity.x`.
- World gravity supplies vertical motion. `maxVelocity.y` caps falling.
- Facing only changes when horizontal intent is non-zero.

### Jump rules

`src/systems/jump-controller.ts` is engine-free and unit-tested:

- Grounded refreshes the coyote window (100 ms by default).
- A jump press starts/refreshes the buffer window (120 ms by default).
- A jump executes only if a buffered press exists inside the coyote window and the player has not
  already jumped since leaving the ground.
- After a jump, coyote is zeroed and **not** refreshed by ground-state lag, preventing double jumps.
- Holding jump never repeats: only a new press is buffered.
- Releasing jump while rising applies `jumpCutMultiplier` (0.45) once.
- Delta applied to windows is clamped to 50 ms; focus loss drops any buffered press.

### Visual state

A small state machine selects idle / running / rising / falling / landing. Landing is a 110 ms
transition after touching ground; a jump overrides it to rising. Movement logic is independent of
textures, so final sprites/animations can replace the placeholder keys without touching physics.

## 7. Input architecture

`src/input/InputManager.ts` is the only module that reads devices. It produces a
`PlayerInputState`:

```ts
interface PlayerInputState {
  moveX: -1 | 0 | 1;
  jumpPressed: boolean; // one-frame edge or queued tap
  jumpHeld: boolean;    // true while any jump control is held
}
```

- **Keyboard**: Left/Right/A/D, Up/W/Space, R (dev only). Arrows + Space are captured to prevent
  browser scrolling. Jump keys use `JustDown` plus a held-state fallback for missed edges.
- **Touch**: `TouchControls` creates large semi-transparent buttons fixed to the camera
  (`scrollFactor 0`) in the logical 1280×720 layout. Touch controls are created only when the device
  reports touch support, or when forced with `?touch=1` (dev) or `VITE_FORCE_TOUCH_CONTROLS=true`.
- **Edge detection**: `computePlayerInputState()` (pure, tested) combines a queued press with a
  released→held transition, so holding never repeats and taps shorter than a frame still register.
- **Multitouch**: every Phaser pointer may own at most one control (`Map<pointerId, control>`).
  Global `pointerup`, `pointerupoutside`, pointer movement off the button's circle, `gameout`, scene
  pause/sleep and window blur release ownership. No input can remain stuck.
- **Cleanup**: keyboard captures and keys are removed, scene input listeners unregistered, touch
  controls destroyed, and window/document listeners removed on scene shutdown. Restarting GameScene
  repeatedly leaves exactly one listener per event and eight key objects (verified in the browser).

`src/input/input-state.ts` contains the pure direction and snapshot logic; `TouchControlButton.ts`
is the visual/hit-area primitive.

## 8. External configuration

`content/config/player.json` is the source of truth for movement tuning. It is imported by
`src/core/player-config.ts` so Vite bundles it into the app:

- Works in dev, production and a future Android WebView (no fetch, no file URL, no server).
- Is validated by `validatePlayerConfig()` (engine-free) using the shared `ValidationResult` type.
- `main.ts` refuses to start the game when invalid and renders the error paths/messages in a visible
  panel; `GameScene` uses `requirePlayerConfig()` after that check.
- Editing tuning requires a rebuild/dev reload, which is appropriate for bundled gameplay config.

Movement config (schema 1) contains: `maxSpeed`, `acceleration`, `deceleration`, `jumpVelocity`,
`gravity`, `maxFallSpeed`, `coyoteTimeMs`, `jumpBufferMs`, `jumpCutMultiplier`. Units are px/s,
px/s² and milliseconds. Validation enforces signs/ranges and rejects non-finite values.

`content/levels/` still follows the Task 001 contract (`docs/LEVEL_FORMAT.md`). The LevelLoader is
not implemented; the temporary arena is scene presentation, not level content.

## 9. Temporary arena

`GameScene` builds a one-screen test arena with static Arcade bodies:

- Two ground segments (0–700 and 840–1280 logical px) with a 140 px gap and a visible dark pit.
- Four thin platforms at four distinct heights, all high enough to walk beneath the 84 px body.
- Left/right/top world bounds collide; the bottom edge is open so falling has a consequence.
- Falling below `GAME_HEIGHT + 120` respawns the player at the spawn pad with zeroed velocity.
- The spawn pad is a visible marker at a safe distance from the touch controls.

This arena is intentionally disposable and will be replaced by JSON-driven terrain.

## 10. UI and debug tooling

- `ui/components`: reusable `TextButton`, `addUiText`, `DebugHud`. The START button's hit area was
  corrected during Task 002 to use container top-left coordinates, so the whole visual button is
  clickable rather than only its center corner.
- `DebugHud` is created only when `import.meta.env.DEV` is true. It shows velocity, grounded state,
  visual state, coyote/buffer flags, input direction and respawn count.
- Touch controls are gameplay input, not UI scenes; a future UIScene will compose pause/victory/shop.
- Theme tokens live in `ui/theme.ts`. No CSS framework.

## 11. Error handling and observability

- Invalid content is a **data** error: validators return `ValidationError[]` with JSON paths.
- Invalid startup configuration stops the game and shows a blocking panel (dev and production).
- Uncaught errors/rejections are visible in dev via the overlay.
- Renderer, version, DPR and gravity are logged once at boot in dev.
- Production builds stay quiet and small; no analytics or telemetry.

## 12. Testing strategy

- Unit tests target engine-free modules (`vitest`, Node environment).
- Current suites: level validation, player configuration validation, input resolution, jump
  controller (coyote, buffer, cut, double-jump protection, reset/clamping).
- Scenes/input are verified in a real browser: keyboard simulation, synthetic touch events,
  multitouch, release outside, restart listener counts and responsive canvas.
- **Browser automation note:** background/occluded Chromium tabs throttle `requestAnimationFrame`,
  so deterministic verification can stop `game.loop` and call `game.step(time, 16.666)` manually.
  This is a test technique only; the shipped game uses the normal loop.

## 13. Android / Capacitor considerations

- `vite.config.ts` uses `base: './'` so the build works from a `file://` or WebView origin.
- No Node-specific APIs in `src/`; all runtime code is browser-safe.
- Touch input and four active pointers are enabled; `touch-action: none` blocks browser gestures.
- Player config and (future) levels are bundled, so no asset server is required.
- WebAudio requires a user gesture; START GAME is the natural unlock point.
- No orientation lock or fullscreen yet, by design.

## 14. Decision log

| Decision | Reason |
| --- | --- |
| Phaser 4.2.1, not Phaser 3 | Latest stable; bundled types; required by the project |
| Arcade Physics | Sufficient for platformers, deterministic fixed step, low overhead |
| Player extends Arcade.Sprite | Physics body + texture swapping + future animation support |
| Sprite origin (0.5, 1), body offset (13, 12) | Feet-based positioning and stable body across visual states |
| Player receives `PlayerInputState` | Keeps entities device-agnostic and testable |
| Pure `JumpController` | Jump feel rules need deterministic unit tests, not canvas mocks |
| `player.json` imported at build time | Works in dev/production/WebView without a file server |
| Manual stepping for automated browser tests | Background tabs throttle rAF; tests need deterministic frames |
| Thin platforms in the temporary arena | Allows walking beneath while staying inside the jump arc |
| `?touch=1` + env force flag | Test touch UI on desktop without shipping it on all desktops |
| No camera follow yet | The arena fits one screen; camera work belongs with scrolling levels |

## 15. Known risks

1. Phaser 4 is young; third-party plugins/tutorials often target Phaser 3 APIs. Verify against the
   bundled types or `node_modules/phaser/skills/`.
2. The Canvas fallback is deprecated upstream and was not exercised during Task 002.
3. DPR sharpness is capped by the logical canvas; revisit when real art arrives.
4. Touch input was verified with synthetic touch events, not physical devices.
5. The temporary arena's platform layout is presentation-only and will be discarded by the
   LevelLoader; do not build content assumptions on it.
6. Player tuning is bundled at build time; runtime tuning/editor support is not implemented.
7. `TouchControlButton.isPointerWithin()` assumes camera zoom 1 (current configuration).

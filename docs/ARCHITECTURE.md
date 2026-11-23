# Architecture

## 1. Stack

| Layer | Choice | Version | Rationale |
| --- | --- | --- | --- |
| Engine | Phaser | 4.2.1 | Stable Phaser 4 release, WebGL-first renderer, MIT licensed, one dependency |
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
- Container/game-object input works through `setInteractive` with an explicit hit area.

## 2. Directory responsibilities

```text
public/assets/            Static runtime assets served as-is (art, audio). Empty today.
content/levels/           Source-of-truth JSON level files.
content/config/           Future JSON gameplay/UI configuration.
src/core/                 Composition root: game config, constants, dev error overlay.
src/scenes/               Scene lifecycle and orchestration only.
src/entities/             Future game objects with behavior (player, enemies, pickups).
src/systems/              Reusable, engine-light logic (currently level validation).
src/factories/            Future construction of objects from validated definitions.
src/input/                Future shared keyboard/touch abstraction.
src/ui/components/        Dumb reusable UI (text factory, button).
src/ui/screens/           Future composed UI screens (pause, victory, shop).
src/types/                Shared contracts (level schema, validation result).
src/utils/                Small helpers with no gameplay knowledge.
src/styles/               Global page CSS (canvas host, dev overlay).
tests/                    Vitest suites and fixtures.
tools/                    Future developer scripts (content checks, asset tooling).
docs/                     Design and engineering documentation.
```

Import direction (keep it acyclic):

```text
core -> scenes -> ui/components + systems + types
ui/components -> theme + utils
systems -> types
types -> (nothing)
```

- Scenes may import systems and UI components; systems must never import scenes or UI.
- `types/` contains only types and schema constants; no Phaser imports.
- `src/core/` is the only place allowed to import every scene (composition root).
- Content JSON is never imported by TypeScript source; it is loaded and validated at runtime.

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
       button pointerup -> scene.start('GameScene')   (mouse and touch)
  └─ GameScene
       create(): static playground placeholder
       (no update logic in Task 001)
```

`scene.start()` stops the current scene and starts the target, so only one gameplay scene is
active at a time. Scene keys live in `SCENE_KEYS`; never hardcode them at call sites.

Responsibilities:

- **BootScene**: engine/startup initialization and startup-only asset loading. No gameplay.
- **MenuScene**: startup screen, menu interaction, navigation.
- **GameScene**: gameplay orchestration. In future tasks it will request a validated level,
  build it through factories/systems, and manage the camera. It must not contain level layouts.

## 4. Runtime layers

```text
content JSON  ->  validator  ->  LevelDefinition  ->  factories  ->  entities
                                                                       |
                                                     systems (physics, scoring, enemies)
                                                                       |
                                          scenes (orchestration, camera, lifecycle)
                                                                       |
                                          UI components/screens (input + display)
```

Rules:

1. **Content** describes what a level is. It contains no behavior.
2. **Validation** is the only trusted entry point from JSON to typed runtime data.
3. **Factories** turn validated definitions into game objects; they do not decide gameplay rules.
4. **Entities** own per-instance state and behavior (movement, health, animation).
5. **Systems** implement reusable rules shared by entities (collision responses, spawning,
   scoring, object pooling).
6. **Scenes** orchestrate and own lifecycle; they should read like a wiring diagram.
7. **UI** reads state and emits intents; it never mutates gameplay state directly.

## 5. Game configuration and display

`src/core/game-config.ts` is the single source of truth:

| Setting | Value | Why |
| --- | --- | --- |
| Logical size | 1280×720 | 16:9 landscape-first design space |
| Renderer | `Phaser.AUTO` | WebGL when available, Canvas fallback |
| Scale mode | `Phaser.Scale.FIT` | Preserve aspect ratio; never stretch |
| Auto center | `Phaser.Scale.CENTER_BOTH` | Centered canvas in the host element |
| `autoRound` | `true` | Avoids fractional CSS sizes on low-end devices |
| `expandParent` | default `true` | Host fills the viewport |
| Background | `#101a2b` | Letterbox color around the canvas |
| Input | keyboard, mouse, touch, 2 pointers | Shared pointer path now; multi-touch later |
| Context menu | disabled | Avoid right-click menu over the game |

**DPR strategy.** Phaser 4 removed the game-level `resolution` option. The canvas backing store
therefore renders at the logical 1280×720 size and the ScaleManager scales it with CSS. To keep
text sharp, every `Text` object is created through `addUiText()`, which sets `resolution` to
`min(devicePixelRatio, 2)`. This is a deliberate performance trade-off for a lightweight,
mobile-first game. If art review later requires a higher canvas backing resolution, the options
are (a) render at `logical × DPR` with a matching camera zoom, or (b) upscale assets and use a
larger logical canvas. Both are explicit future decisions, not silent changes.

The dev console logs renderer, logical size and DPR on boot. `src/core/error-overlay.ts` displays
uncaught errors in dev builds only.

## 6. JSON content architecture (planned)

The contract exists now (`src/types/level.ts`, `src/systems/level-validator.ts`,
`content/levels/world-01/level-01.json`), but there is **no loader and no rendering** yet.

Planned flow for the level task:

1. Discover level files. Recommended: `import.meta.glob` with `?raw` so levels are bundled at
   build time and work inside an Android WebView without a file server. A `fetch()` loader is an
   alternative if levels must be editable after build; it requires copying `content/` into the
   served output.
2. Parse with `parseLevelJson()`; on failure, show a readable error screen listing `path` and
   `message` for each issue. Never start a scene with invalid content.
3. Pass the normalized `LevelDefinition` to factories. Factories multiply tile coordinates by
   `tileSize` and create terrain, objects and the spawn marker.
4. Configure the camera and world bounds from `size × tileSize`.
5. Keep gameplay tuning (speeds, gravity, jump force) in `content/config/` or a typed config
   module — never in level JSON and never inline in scenes.

Schema changes always bump `schemaVersion`; unknown fields are ignored for forward compatibility.

## 7. Input architecture (planned)

`src/input/` will expose one abstraction, for example:

```ts
interface InputActions {
  moveX: -1 | 0 | 1;
  jumpPressed: boolean;
  jumpHeld: boolean;
  actionPressed: boolean;
}
```

Keyboard and touch adapters both fill this structure. Entities read actions; they never query
Phaser key objects or pointer state directly. This is what makes later Android and gamepad support
cheap. Menu buttons already use Phaser pointer events, which unify mouse and touch.

## 8. Physics and gameplay integration (planned)

- Use Arcade Physics: sufficient for platformers, cheap, deterministic enough for this scope.
- Units are pixels per second for speed/acceleration and pixels per second² for gravity.
- Spawn points are tile coordinates; factories convert them to pixel positions.
- The player origin is at the feet for predictable ground alignment.
- Keep physics configuration in one module so tuning is reviewable and testable.
- Object pooling for coins/effects once levels are scrollable; avoid churn.

## 9. UI architecture

- `ui/components`: small, reusable, scene-agnostic pieces (`TextButton`, `addUiText`).
- `ui/screens`: future composed screens (pause, victory, shop) launched as overlay scenes.
- UI never imports entities or systems; it communicates through scene events/registry intents.
- Theme tokens live in `ui/theme.ts` (colors, font). No CSS framework.

## 10. Error handling and observability

- Invalid content is a **data** error: return `ValidationError[]`, surface it, do not throw for
  expected authoring mistakes.
- Uncaught runtime errors are visible in dev via the overlay.
- Renderer, version and DPR are logged once at boot in dev.
- Production builds stay quiet and small; no third-party analytics or telemetry.
- Tests must be executed before claiming success (see `DEVELOPMENT_WORKFLOW.md`).

## 11. Testing strategy

- Unit tests target engine-free modules (`vitest`, Node environment).
- The level validator is fully covered: valid example, defaults, every required field, bounds,
  enums, duplicate ids, malformed JSON, multi-error collection.
- Scene/UI behaviour is verified in a real browser during review (mouse, touch, resize). Phaser
  scenes are not unit-tested with a mocked canvas; that would test the mocks more than the game.
- Future: add a smoke test for "level loads and renders" once the loader exists.

## 12. Android / Capacitor considerations

- `vite.config.ts` uses `base: './'` so the build works from a `file://` or WebView origin.
- No Node-specific APIs in `src/`; all runtime code is browser-safe.
- Touch input is enabled from day one; `touch-action: none` on the host prevents browser gestures.
- Keep the bundle and textures small; Phaser already accounts for ~357 KB gzip.
- WebAudio requires a user gesture; the START GAME tap will be the natural unlock point.
- No orientation lock or fullscreen yet, by design.

## 13. Decision log

| Decision | Reason |
| --- | --- |
| Phaser 4.2.1, not Phaser 3 | Task requirement; latest stable; bundled types |
| TypeScript 7.0.2 | Current stable; verified with `tsc --noEmit`; no `any` needed |
| Vite 8 + Rolldown manual chunk **function** | Vite 8 no longer accepts the object form of `manualChunks` |
| Shapes/text instead of assets | Keeps Task 001 asset-free and fast to iterate |
| No physics plugin registered yet | Avoids dead configuration before Task 002 |
| No scene unit tests | Canvas-heavy code is better verified in-browser |
| Validation returns errors, not exceptions | Batch-friendly for authors and CI |
| `sourcemap: false` in production | Keeps the shipped bundle lean; dev server handles debugging |

## 14. Known risks

1. Phaser 4 is young; third-party plugins/tutorials often target Phaser 3 APIs. Always verify
   against the bundled Phaser 4 types or `node_modules/phaser/skills/`.
2. The Canvas fallback is deprecated upstream; visual bugs may only appear there.
3. DPR sharpness is capped by the logical canvas; revisit when real art arrives.
4. Fonts are system fonts; a webfont/bitmap font decision is pending and affects layout.
5. Level delivery inside an Android WebView must be decided before the loader task.
6. Phaser adds ~357 KB gzip; keep game code lean to stay under mobile budgets.

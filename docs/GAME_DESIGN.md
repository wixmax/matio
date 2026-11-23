# Game Design — Adventure Platformer

## 1. Concept

A colorful, cartoon 2D side-scrolling platformer. The player runs and jumps through handcrafted
levels, collects coins and stars, avoids or defeats enemies, and uses simple power-ups (bombs,
shields, magnets) to reach the goal. Levels are content files, not code, so new worlds can be
authored without touching gameplay systems.

The tone is bright, friendly and readable: strong silhouettes, saturated colors, thick outlines
and playful animation. The game should feel immediately understandable on a phone and precise on a
keyboard.

## 2. Target platforms

| Platform | Priority | Notes |
| --- | --- | --- |
| Desktop browser | Primary during development | Chrome/Edge/Firefox/Safari, WebGL first, Canvas fallback |
| Mobile browser | Primary product target | Landscape-first, touch controls, responsive FIT scaling |
| Android app | Later phase | Capacitor wrapper around the same web build; no engine-specific forks |
| iOS | Out of scope for now | Architecture should not block it, but nothing is promised |

Design constraints that follow from this:

- Landscape-first 1280×720 logical space.
- No hover-only interactions; every action must work with touch.
- Keep the runtime light: avoid heavy libraries, large textures and unnecessary post-processing.
- All runtime code must work inside a WebView (no Node APIs, no server assumptions).

## 3. Core gameplay loop

1. Start a level from the menu (or the level map in a later phase).
2. Move and jump through the level, reading terrain and enemy patterns.
3. Collect coins/stars, avoid hazards, optionally use power-ups.
4. Reach the goal.
5. Receive a score breakdown (coins, time, secrets) and a star rating.
6. Return to the map/menu with progress saved.

Short-term loop: moment-to-moment movement and collection.
Mid-term loop: clearing levels and improving scores.
Long-term loop: unlocking worlds, skins, achievements and daily goals.

## 4. Design pillars

1. **Readable movement.** Snappy acceleration, forgiving coyote time and jump buffering, clear
   anticipation and landing feedback.
2. **Content over code.** Levels, tuning values and UI copy live in versioned data, not in scenes.
3. **Small surface area.** Every system has one job and a clear public API. No speculative
   abstractions.
4. **Cross-input parity.** Keyboard and touch feed the same input abstraction, so gameplay code
   never branches on device type.
5. **Cartoon clarity.** Art and UI are legible at phone size; decoration never hides hazards.

## 5. Planned feature groups

These are planned, not implemented. Order may change after review.

### Movement and platforming
Run, jump, variable jump height, coyote time, jump buffer (implemented). Still planned: slopes (if
levels need them), moving platforms, one-way platforms, water behavior.

### World content
JSON-driven levels, terrain (ground, platforms, blocks, water), level goals, world map, level
themes, backgrounds and parallax.

### Collectibles and power-ups
Coins and collectible stars are implemented: JSON placement, idempotent overlap, HUD counters,
score feedback, persistent best-collection records. Bombs, shields, magnets and temporary effects
remain planned.

### Scoring and progression
Score breakdown (coins, stars, completion), 1–3 star rating, explicit level order, unlock rules,
versioned local save and a result screen are implemented. Star ratings, advanced breakdowns,
achievements and cloud save remain planned.

### Enemies
Reusable AI behaviors (patrol, chase, flyer, turret), damage rules, defeat rules and respawn logic
remain planned.

### Meta systems (later)
Shop, inventory, achievements, daily quests, daily rewards, lucky spin. These must remain optional
and modular; the core game must be fully playable without them.

### Presentation
Original character skins, animation sets, particles, music and sound effects, victory screens.

## 6. Art and audio direction

- Colorful cartoon 2D, consistent thick outlines and soft cel-style shading.
- 64 px tile grid; characters roughly 1.5–2 tiles tall.
- Transparent character sprites, no baked backgrounds or drop shadows.
- Bright, low-noise backgrounds that keep gameplay silhouettes dominant.
- Audio: short, punchy SFX and loopable music, mixed conservatively.

Details and naming rules live in [ASSET_GUIDE.md](ASSET_GUIDE.md).

## 7. Current milestone (Task 004)

Implemented: the full first gameplay loop. Start a level → collect coins/stars → reach the goal →
calculate score and 1–3 star rating → save best results → unlock the next level → retry, continue or
return to the menu. Includes a camera-fixed HUD, basic level selection with locked states, a result
screen, explicit campaign order and versioned localStorage save with validation/recovery.

In scope for this milestone: collectible/coin/star objects, overlap safety, scoring configuration,
rating policy, goal completion, progression, local persistence, result UI and level selection.

Out of scope: enemies, combat, power-ups (bomb/shield/magnet runtime), shop, persistent wallet,
achievements, daily rewards, Tiled/editor integration, ads, Android packaging and final art/audio.

Success for this milestone: collectibles are driven by JSON, each is collected once, falling keeps
collected objects, Retry restores them, victory settles exactly once, best records cannot shrink,
locked levels stay locked in production, progress survives refresh, and tests/build pass.

### Milestone history

- **Task 001** — project foundation, scene navigation, responsive config, level-data contract.
- **Task 002** — player controller, Arcade Physics and unified input.
- **Task 003** — JSON level repository/loader, terrain/collision generation, goal markers and camera.
- **Task 004** — collectibles, goal completion, scoring/rating, progression, result screen and save.

## 8. Product success criteria for the first playable

- A new player can start a level and reach the goal without instructions beyond the controls.
- Movement feels responsive on a mid-range phone at 60 fps.
- A level can be added or edited without changing TypeScript source.
- Invalid level content produces actionable errors instead of a broken scene.

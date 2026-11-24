# Game Design — Adventure Platformer

Task 007-B adds the Energy Ball. An energy flower grants a 20-second ability; C/K or
the touch FIRE control launches bouncing Energy Balls in the facing direction. A
direct hit damages an enemy immediately through the existing health/score path, with
no fuse and no radial explosion. Bombs remain independent consumables on X/J or THROW.
Holding fire does not repeat; cooldown, active-projectile and target limits apply. The
ability survives a fall, is refreshed by another flower and is cleared by Retry,
Victory and Game Over.

Task 007-A adds the growth mushroom. The player starts small and becomes big for
20 seconds once the larger body fits. Under an overhang, the pickup stays collected
and the HUD shows `PENDING GROWTH`. The timer starts when the player steps clear.
Another mushroom refreshes the interval. Health, stomp rules and knockback apply
in both forms, and damage leaves the effect running. Shields and magnets can run
at the same time. Bomb throws originate beside the current body at its hand height.

Falling preserves the reward and time remaining. At a cramped spawn the player
uses the small form until the big body fits again or the effect expires. Retry
restores the mushrooms. Victory and Game Over end the attempt's effect state.

Task 006-A adds run-specific bomb pickups and throwable Arcade projectiles.
X/J or the touch THROW control launches a bomb in the player's facing direction.
After its fuse, a radius-based explosion damages enemies through their existing
health and defeat scoring. Bombs do not damage the player or terrain.

Task 006-B adds two automatic pickups. The shield lasts up to 15 seconds and absorbs
one enemy contact that would deal damage. Stomps and contacts during invulnerability
preserve the charge. Absorption flashes and starts the configured contact invulnerability.
The magnet lasts 12 seconds and draws nearby coins along clear paths. Pulled coins grant
the same score and collection credit as overlap pickups. Each new pickup refreshes its own
duration. The shield restores its charge and both effects can run together.

The HUD displays active durations and shield charges. Falling preserves the pickup history
and the remaining effect state. Retry restores the pickups and clears effects. Victory and
Game Over end both effects. The effects themselves are never saved.

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
score feedback, persistent best-collection records. Bomb pickups and throws operate within the
current run. Shield, coin magnet and growth mushroom pickups apply temporary effects during play.
Energy flowers grant the temporary Energy Ball ability. All pickups are run-scoped; none is a
permanent inventory item.

### Scoring and progression
Score breakdown (coins, collectible stars, enemy defeats, completion), 1–3 star rating, explicit
level order, unlock rules, versioned local save and a result screen are implemented. Enemy defeats
add score but are not required for the three-star rating in this milestone. Advanced breakdowns,
achievements and cloud save remain planned.

### Enemies and combat
Implemented in Task 005: JSON archetypes (mushroom, snail, spiky), deterministic patrol behavior,
stomp classification, multi-hit enemies, non-stompable hazards, player health, invulnerability,
knockback, defeat scoring and a Game Over/retry flow. Task 006-A added bomb explosions and Task
007-B added immediate Energy Ball hits. All external damage shares the enemy health and defeat
scoring path. Still planned: chase/flyer/turret behaviors, enemy projectiles, bosses and respawning
enemies.

### Interactive blocks and pipes (planned, not implemented)
Future milestones intend big-player-only brick breaking, small-player bumping, reward blocks that
release items once, pipes and secret/underground rooms. The current `block` terrain is a plain solid
step; no interactive tile type, hit-from-below rule or item release exists yet.

### Audio (planned, not implemented)
No audio engine or assets exist. The future contract, centralized `AudioManager` responsibilities
and semantic sound IDs are documented in
[ARCHITECTURE.md](ARCHITECTURE.md#21-audio-planning-planned--not-implemented). All final audio must be
original or properly licensed.

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

## 7. Enemy combat milestone (Task 005)

Implemented: enemies and player combat. Start a level → navigate deterministic patrol enemies →
stomp stompable archetypes (snails need two hits) or avoid spiky enemies → take damage, knockback and
invulnerability on side contact → reach the goal for a score that includes coins, collectible stars,
enemy defeats and the completion bonus, or lose all health for a non-saving Game Over with Retry.

In scope for this milestone: JSON enemy archetypes and placements, patrol behavior, stomp/damage
classification, player health/invulnerability, knockback/feedback, a health HUD, defeat scoring,
Game Over/retry and three populated levels.

Out of scope: bombs, projectiles, shields, magnets, chasing/flying enemies, boss fights, permanent
lives, power-up inventory, shop, achievements, daily rewards, Tiled/editor integration, ads, Android
packaging and final art/audio.

Success for this milestone: enemies are JSON-driven and patrol safely, one contact is either a stomp
or damage (never both), spiky cannot be stomped, snails need two stomps, score is awarded once per
defeat, damage respects invulnerability, health zero ends the run once without saving, Retry restores
health/enemies/collectibles, falling keeps collections and health, and tests/typecheck/build pass.

### Milestone history

- **Task 001** — project foundation, scene navigation, responsive config, level-data contract.
- **Task 002** — player controller, Arcade Physics and unified input.
- **Task 003** — JSON level repository/loader, terrain/collision generation, goal markers and camera.
- **Task 004** — collectibles, goal completion, scoring/rating, progression, result screen and save.
- **Task 005** — enemy archetypes/patrol, stomp combat, player health/damage, health HUD and Game Over.
- **Task 006-A** — bomb pickups, throws and explosion combat.
- **Task 006-B** — temporary shield and coin magnet pickups, effects, and HUD.
- **Task 007-A** — temporary small/big transformations with feet-anchored Arcade bodies.
- **Task 007-B** — Energy Ball ability, energy-flower pickups, weapon config seam and maintainability docs.

## 8. Product success criteria for the first playable

- A new player can start a level and reach the goal without instructions beyond the controls.
- Movement feels responsive on a mid-range phone at 60 fps.
- A level can be added or edited without changing TypeScript source.
- Invalid level content produces actionable errors instead of a broken scene.

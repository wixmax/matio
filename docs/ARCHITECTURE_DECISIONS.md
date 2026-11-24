# Architecture Decisions

Concise decision records for choices that are visible in the current code. Status is `Accepted`
unless a later recorded decision supersedes it. Historical decisions from earlier milestones are
included only where the current code still depends on them.

## ADR-001 — Phaser Arcade Physics with velocity/acceleration movement

- **Context:** Browser-first platformer with predictable collisions and a future WebView target.
- **Decision:** Use Phaser 4 Arcade Physics; gameplay entities move with velocities/accelerations
  and static terrain bodies, never by manual position edits during physics.
- **Rationale:** Simple deterministic AABB collisions, small surface area, bundled with Phaser.
- **Consequences:** No slopes/one-way platforms without new code; fast projectiles can tunnel through
  very thin geometry; resizing needs body-history rebasing.
- **Evidence:** `src/scenes/GameScene.ts`, `src/entities/Player.ts`, `player-form-rules.ts`.

## ADR-002 — JSON content with startup validation

- **Context:** Levels, balance and pickups are authored content, not code.
- **Decision:** All content is versioned JSON validated before use. Invalid content blocks startup
  with visible diagnostics instead of falling back to guesses.
- **Rationale:** Content changes should not require TypeScript; failures must be actionable.
- **Consequences:** Schema changes need a version bump, migration and tests. JSON alone cannot add
  new behavior.
- **Evidence:** `content/config/*.json`, `src/systems/*-validator.ts`, `src/main.ts`.

## ADR-003 — Pure gameplay rules separate from Phaser orchestration

- **Context:** Logic must be testable in Node without mocking Phaser.
- **Decision:** Keep scoring, validation, geometry, jump, combat, patrol, projectile, collection and
  effect rules in Phaser-free modules; systems/entities wire them to the engine.
- **Rationale:** Deterministic tests, clear boundaries, easier future reuse.
- **Consequences:** Some glue code duplicates simple calls, but no rule lives twice.
- **Evidence:** `src/systems/jump-controller.ts`, `combat-rules.ts`, `projectile-rules.ts`,
  `level-geometry.ts`, `src/types/` (Phaser-free).

## ADR-004 — Shared enemy damage and one defeat ledger

- **Context:** Stomps, bombs, explosions and projectiles can all defeat enemies.
- **Decision:** External damage enters through `EnemySystem.damageEnemy()` or
  `damageEnemiesInRadius()`; both call `Enemy.takeDamage()` and record points once in
  `EnemyLedger`. No system keeps a second enemy-health or score accumulator.
- **Rationale:** One authority for health, defeat transitions and score; avoids double rewards.
- **Consequences:** New attacks must use these entry points. Defeat score is merged into the existing
  run score at settlement.
- **Evidence:** `src/systems/EnemySystem.ts`, `src/entities/Enemy.ts`, `enemy-ledger.ts`.

## ADR-005 — Collection idempotency at entity and ledger level

- **Context:** Arcade overlap callbacks can repeat within one physics step.
- **Decision:** `Collectible.collect()` disables the body and returns `false` after the first call;
  `CollectionLedger` additionally guards scored keys. Non-scoring pickups rely on the entity guard
  and route through the same `CollectionSystem.collect()` entry point.
- **Rationale:** HUD/score/timers must change once even with repeated callbacks or both magnet and
  overlap arrivals.
- **Consequences:** Never update score or HUD directly from a raw overlap.
- **Evidence:** `src/entities/Collectible.ts`, `src/systems/CollectionSystem.ts`,
  `collection-ledger.ts`.

## ADR-006 — One ActiveEffects clock per attempt

- **Context:** Shield, magnet, growth and Energy Ball are temporary and can overlap.
- **Decision:** One `ActiveEffects` instance per attempt owns independent effect durations,
  shield charges and temporary weapon-ability windows. Only gameplay delta advances it; fall
  respawn keeps it, terminal paths dispose it, Retry creates a new one.
- **Rationale:** Consistent lifecycle and pause/hidden-tab behavior; no per-effect timers.
- **Consequences:** Effect durations never persist in save data; new temporary abilities should use
  `activateAbility()` rather than adding a second clock.
- **Evidence:** `src/systems/ActiveEffects.ts`, `EffectSystem.ts`, `EnergyBallSystem.ts`.

## ADR-007 — Safe player resizing through body-history rebasing

- **Context:** Growth changes Arcade body dimensions while the player may be moving or cramped.
- **Decision:** Derive body offset from source frame metrics, apply the resize after collisions and
  before Arcade post-update, rebase current/previous body positions, and queue or suspend growth
  when clearance is missing.
- **Rationale:** Feet stay planted, stomp classification stays correct, and resizing cannot create a
  terrain or enemy overlap.
- **Consequences:** Frame/art changes require updating the central metrics; new forms must preserve
  the feet anchor and history.
- **Evidence:** `src/entities/Player.ts` (`resizeForm`), `player-form-rules.ts`,
  `PlayerTransformation.ts`, `EffectSystem.ts`.

## ADR-008 — Bombs and Energy Balls are separate mechanics

- **Context:** Both are projectiles, but their design roles differ.
- **Decision:** Keep `BombSystem` (consumable inventory, fuse, delayed radial explosion) and
  `EnergyBallSystem` (temporary ability, direct hit, bounce, no fuse, no radial explosion) separate.
  Share only the enemy-damage entry point and small pure helpers.
- **Rationale:** Their lifecycles and balance differ; a premature generic weapon framework would add
  risk without a second implemented weapon.
- **Consequences:** Some Arcade setup is similar; do not merge them without a task that needs it.
- **Evidence:** `src/systems/BombSystem.ts`, `src/systems/EnergyBallSystem.ts`, `weapons.json`.

## ADR-009 — Modest weapon extensibility: config now, code for new behavior

- **Context:** Future weapons/upgrades are expected, but only Energy Ball Level 1 exists.
- **Decision:** Define a small validated weapon registry and a pickup→weapon map. Tuning fields that
  already work (damage, speed, trajectory constants, limits, duration) live in JSON. New
  trajectories, multi-shot, pierce, tiers or persistent progression require code.
- **Rationale:** Avoid speculative plugin systems and unused Level 2/3 config while leaving a clear
  seam.
- **Consequences:** Unknown weapon IDs and pickups are rejected; adding a weapon needs a validated
  ID, runtime system/entity and tests.
- **Evidence:** `src/types/weapon.ts`, `weapons.json`, `EnergyBallSystem.ts`.

## ADR-010 — Arcade callback argument order is not assumed

- **Context:** Browser verification during Task 007-B showed a terrain collider invoking the callback
  with the solid first and the projectile second.
- **Decision:** Resolve the projectile/enemy from either callback argument and guard with
  `active`/`isAlive` before applying damage.
- **Rationale:** Phaser does not guarantee argument position for group/array pairings; assuming it
  silently breaks collisions.
- **Consequences:** Every new collider callback must use the same defensive resolution.
- **Evidence:** `EnergyBallSystem.handleTerrainHit` / `handleEnemyHit`, `EnemySystem.handleContact`.

## ADR-011 — AI-friendly documentation as part of the codebase

- **Context:** Development happens through fresh AI coding sessions with different models.
- **Decision:** Maintain a small documentation set with distinct responsibilities: status,
  architecture, mechanics, extension recipes, decisions, level format, workflow and agent rules.
- **Rationale:** Continuation must not depend on conversation history; duplicated documents drift.
- **Consequences:** Each task updates the relevant document and links instead of copying content.
- **Evidence:** `docs/PROJECT_STATUS.md`, `GAMEPLAY_MECHANICS.md`, `EXTENDING_MATIO.md`, this file,
  `AGENTS.md`.

## ADR-012 — Head bumps use previous body geometry and a per-block latch

- **Context:** Arcade separation can run before the collider callback and can zero velocity; overlap
  alone also happens on sides, landing and during growth.
- **Decision:** Classify head hits from previous-step top, current body edges, horizontal overlap,
  Arcade upward contact and actual upward movement. Latch one reaction per block and rearm only after
  real separation.
- **Rationale:** One rising contact cannot pay out repeatedly, while side/landing/growth contacts are
  rejected deterministically.
- **Consequences:** Any future block interaction must reuse `block-rules.isHeadBump()`; do not infer
  hits from velocity or raw overlap.
- **Evidence:** `src/systems/block-rules.ts`, `InteractiveBlockSystem.ts`, browser harness.

## ADR-013 — Interactive blocks are static bodies with immediate state-driven collision removal

- **Context:** A brick must stop obstructing the player, enemies, magnet paths and projectiles after
  it breaks, without rebuilding level geometry every frame.
- **Decision:** One static body per block; break disables the body and collision checks synchronously.
  Intact block bodies join existing Arcade colliders; broken bodies stay in the list but are ignored.
  Rectangle-based queries read `solidRects()` live.
- **Rationale:** Immediate deterministic collision removal, no per-frame geometry rebuilds and one
  source of block solidity.
- **Consequences:** Breaking must happen in the block system; ad-hoc body removal or parallel solid
  maps are forbidden.
- **Evidence:** `InteractiveBlock.ts`, `InteractiveBlockSystem.ts`, `GameScene.ts`.

## ADR-014 — Reward settlement uses gameplay delta, visuals stay separate

- **Context:** Tween callbacks can be delayed or skipped when a tab is hidden, the scene ends or a
  test steps frames manually; a payout must still be idempotent.
- **Decision:** The logical state transition (`unused → activating → used`) and the release timer
  live in the system and advance with gameplay delta. The emerge/settle path is scripted, and the
  pickup body is enabled only at the end. Fade/debris/bump remain visual tweens.
- **Rationale:** Deterministic one-time payout, safe terminal shutdown, no dependency on rendering.
- **Consequences:** New reward animations must not own payout logic; scene freeze completes in-flight
  releases.
- **Evidence:** `InteractiveBlockSystem.update/advanceReward/freeze`, `block-rules.ts`.

## ADR-015 — Reward pickups reuse existing pipelines and a stable key

- **Context:** A reward may be a coin, bomb, shield, magnet, growth mushroom or energy flower.
- **Decision:** Non-bomb rewards create a `Collectible` with key `reward:<authored block id>` and join
  the existing collectible group/ledger. Bomb rewards use BombSystem's pickup group and inventory.
  Reward coins add run score/count but authored coin/star totals remain the rating denominator.
- **Rationale:** One score ledger, one inventory, one effect clock and duplicate-free dynamic IDs.
- **Consequences:** Do not create a second reward inventory or score accumulator. Multi-coin/hidden
  blocks need an explicit scoring policy.
- **Evidence:** `InteractiveBlockSystem`, `CollectionSystem`, `BombSystem`, `scoring.ts`.

## ADR-016 — Weapon/explosion block interaction is deliberately absent

- **Context:** Bombs and Energy Balls already have terrain collision, and future design may let them
  affect blocks.
- **Decision:** In Task 008-A they only treat intact blocks as walls. No weapon damage or activation
  path exists.
- **Rationale:** The task defines head bumps as the only block interaction; mixing explosion damage
  would create unrequested rules and bypass the physical-contact latch.
- **Consequences:** A future task must add an explicit block-hit entry point, validation, balance and
  tests. Do not route weapon damage through `EnemySystem`.
- **Evidence:** `EnergyBallSystem`, `BombSystem`, `projectile-rules.ts`.

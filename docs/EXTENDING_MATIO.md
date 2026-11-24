# Extending Matio

Practical recipes for future AI coding agents. Read `AGENTS.md`, `docs/ARCHITECTURE.md` and
`docs/GAMEPLAY_MECHANICS.md` first, then inspect the current code before editing.

**Important:** JSON cannot create new logic. Configuration-only changes tune behavior that already
exists. New behavior, new entity types, new input actions and new lifecycle rules require TypeScript
plus tests.

## Verification before handing off

```bash
npm run verify        # typecheck + unit tests + production build
npm run dev           # browser checks
```

Browser acceptance is separate from `verify`. Scene/input/physics changes still need a real browser
check (see `docs/DEVELOPMENT_WORKFLOW.md`).

---

## 1. New collectible (scored)

**Configuration only** if it reuses the coin/star shape, but a new *type* needs code.

Files:

- `src/types/level.ts` — add the object type to `OBJECT_TYPES`.
- `src/types/collectible.ts` — decide whether it is a scored `CollectibleType` or a pickup.
- `src/systems/level-validator.ts` — usually inherits validation from the type list.
- `src/systems/level-geometry.ts` — `createCollectiblePlacements` includes the type; totals count
  only coin/star.
- `src/entities/collectible-textures.ts` — add frame/texture and procedural art.
- `content/config/scoring.json` + `src/types/scoring.ts` + `src/systems/scoring-validator.ts` if it
  awards points.
- `src/systems/scoring.ts` / `collection-ledger.ts` if it needs its own counter.
- Levels under `content/levels/`.

Lifecycle: collection must stay idempotent through `Collectible.collect()` and, if scored, the run
ledger. Respawn keeps it; Retry restores it.

Tests: validation, center anchor, totals, no solid placement, collection once, score once.
Docs: `LEVEL_FORMAT.md`, `GAMEPLAY_MECHANICS.md`.

## 2. New power-up (temporary effect)

**TypeScript required.**

Files:

- `src/types/effects.ts` — add the effect key and config contract.
- `src/core/effects-config.ts`, `src/systems/effects-config-validator.ts`,
  `content/config/effects.json` — validated tuning.
- `src/systems/ActiveEffects.ts` — independent duration/charges.
- `src/systems/EffectSystem.ts` — activation, visuals, per-frame behavior, dispose.
- `src/types/collectible.ts`, `src/entities/collectible-textures.ts`, `src/systems/level-geometry.ts`,
  `src/types/level.ts` — pickup identity/art/placement.
- `src/systems/CollectionSystem.ts` — route the pickup (keep the entity guard).
- `src/ui/components/GameHud.ts` — indicator text only when the value changes.
- `src/scenes/GameScene.ts` — terminal freeze/cleanup.

Lifecycle: one `ActiveEffects` per attempt; preserve on fall, dispose on Victory/Game Over/shutdown,
fresh on Retry. Never store effect state in save data.

Tests: config errors, duration/refresh/expiry, fall preservation, terminal cleanup. Browser:
activation, HUD, interaction with existing effects.

## 3. New weapon / projectile

**TypeScript required, even though tuning is JSON.**

Current reference implementation: Energy Ball (config-only tuning, one coded weapon).

Files:

- `content/config/weapons.json` + `src/types/weapon.ts` + `src/systems/weapon-config-validator.ts` —
  add the ID and validated fields. Unknown IDs are rejected today on purpose.
- `src/core/weapon-config.ts` — startup validation result.
- `src/systems/projectile-rules.ts` — pure spawn/cadence/collision/target decisions.
- `src/entities/EnergyBall.ts` (or a new entity) — Arcade body tuning after group insertion.
- `src/systems/EnergyBallSystem.ts` (or a new system) — ability, projectiles, colliders, cleanup.
- `src/systems/EnemySystem.ts` — reuse `damageEnemy()`; never create a second health/score ledger.
- `src/input/InputManager.ts` + `src/input/TouchControls.ts` — new action only if the task requires
  it; follow the existing edge-triggered request pattern.
- `src/scenes/GameScene.ts` — wiring, update order, freeze/destroy.
- `src/ui/components/GameHud.ts` — ability indicator.
- Levels/pickups for the new weapon.

Rules:

- Add the projectile to its group, then apply velocity/gravity/bounce (Arcade insertion can reset
  them).
- Bound lifetime, active count and targets.
- Resolve collider callback arguments in either order; Arcade does not guarantee position.
- Freeze damage and destroy projectiles on Victory/Game Over/shutdown.

Tests: config bounds, spawn geometry, cadence, bounce/wall/ceiling, lifetime, target dedupe, enemy
damage/score once, terminal cleanup.

## 4. New enemy archetype

**Configuration only** when it uses the existing `patrol` behavior.

Files:

- `content/config/enemies.json` — add health, speed, behavior `patrol`, stompable, damage, score.
- Level JSON — reference `enemyId` with feet cell and patrol columns.
- `src/entities/enemy-textures.ts` — the placeholder texture is generated automatically from the ID.

Validation: unknown IDs, non-patrol behavior values, unsafe cells and bad patrols are rejected.

Tests: extend enemy config/content tests if the new values are structurally new. Browser: anchor,
patrol bounds, terrain collision, stomp/damage, score once.

## 5. New enemy behavior

**TypeScript required.**

Files:

- `src/types/enemy.ts` — behavior union/config if needed.
- `src/systems/enemy-behaviors.ts` — add a pure deterministic resolver.
- `src/entities/Enemy.ts` — call the resolver in `tick()`.
- `src/systems/enemy-config-validator.ts` — validate the behavior value and required fields.
- `content/config/enemies.json` — use the new value only after code exists.
- Tests in `tests/enemy-behaviors.test.ts` / `tests/enemy-config.test.ts`.

Do not add a JSON behavior name expecting it to work before the resolver exists.

## 6. New player form

**TypeScript required.**

Files:

- `src/types/player-form.ts`, `content/config/player-forms.json`, `src/core/player-forms-config.ts`,
  `src/systems/player-form-config-validator.ts` — validated metrics.
- `src/systems/player-form-rules.ts` — body geometry from feet/form.
- `src/entities/Player.ts` — apply metrics without breaking feet/origin.
- `src/systems/PlayerTransformation.ts` / `EffectSystem.ts` — when and how the form is granted.
- `src/entities/player-textures.ts` — placeholder visuals.
- `src/scenes/GameScene.ts` — ensure resizing happens after collisions and before post-update.

Preserve previous/current body history, velocity, contact flags, feet anchor and ground clearance.
Test growth room, cramped respawn, movement/jump and combat in the new form.

## 7. New JSON level object

**Configuration only for an existing type**; **TypeScript required for a new type**.

Files for a new type:

- `src/types/level.ts` — `OBJECT_TYPES` and discriminated shape if it needs extra fields.
- `src/systems/level-validator.ts` — structural validation and field paths.
- `src/systems/level-geometry.ts` — pixel/anchor conversion and totals.
- The owning factory/system (collectible, enemy, block...) to instantiate it.
- `src/systems/LevelLoader.ts` — placement safety (solid overlap etc.).
- `docs/LEVEL_FORMAT.md` — document coordinates and rules.

Never cast raw JSON to a domain type. Invalid content must fail visibly, not be skipped silently.
Add tests for valid/invalid placement and for every shipped level.

## 8. Future ability/weapon upgrade

**TypeScript required.**

Today `weapons.json` already controls damage, speed, vertical launch, gravity, bounce, cooldown,
lifetime, active count, target count and duration for an implemented weapon. Those values can be
re-tuned with JSON only.

Not implemented by configuration alone:

- multiple projectiles per shot;
- alternate trajectories or homing;
- pierce/multi-target beyond the current per-projectile target set;
- upgrade tiers and selection;
- persistent inventory/progression or shop integration;
- per-character assignment.

Adding any of these requires a new validated field, code in the weapon system/entity, lifecycle
rules, tests and documentation. Do not add unused Level 2/3 definitions in advance.

---

## Configuration-only vs TypeScript (summary)

| Change | JSON only |
| --- | --- |
| Rebalance player movement | yes (`player.json`) |
| Rebalance enemies | yes (`enemies.json`) |
| Rebalance scoring/levels order | yes (`scoring.json`, `level-order.json`) |
| Rebalance effects/bombs/Energy Ball | yes (`effects.json`, `bombs.json`, `weapons.json`) |
| Add a new level / move objects | yes |
| Add a new archetype using `patrol` | yes |
| Add a new object/enemy/weapon/effect **type** | no |
| Add a new behavior, form, projection rule or upgrade tier | no |
| Add audio | no (not implemented) |

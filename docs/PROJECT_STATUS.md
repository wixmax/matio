# Project Status

## Project

- **Name:** Matio (repository package name `adventure-platformer`)
- **Genre:** original browser-first 2D side-scrolling platformer
- **Stack:** Phaser 4.2.1, TypeScript 7.0.2 (strict), Vite 8.3.8, Vitest 5.1.1, npm, JSON content
- **Runtime:** browser (WebGL with Canvas fallback), 1280×720 logical, landscape-first, touch parity
- **Development mode:** local only. No backend, no deployment, no analytics, no cloud services.
- **Git baseline for this milestone:** `396698dd4cde31533ca4b542a2544d34990db114`
  (`feat(player): add growth form and safe transformations`)
- **Task 007-B commit:** one commit on top of the baseline,
  `feat(combat): add extensible energy ball powerup`.

## Last completed task

**Task 007-B — Energy Ball combat, extensible weapons, AI documentation and audio planning.**

Implemented and verified in the working tree:

- one Energy Ball weapon defined in `content/config/weapons.json` (schema 1);
- `energy-flower` level pickups in all three levels (1 / 2 / 2);
- a temporary 20-second ability with cooldown, projectile cap and target cap;
- bouncing Arcade projectiles with wall/ceiling destruction and lifetime cleanup;
- immediate damage through `EnemySystem`/`Enemy`/`EnemyLedger`;
- C/K and touch FIRE input, one shot per press, five-pointer budget;
- `ENERGY · Ns` HUD line;
- `npm run verify`, four design/maintenance documents and this status page.

Documentation (including this file) is the only place future work is listed. Anything below
marked **planned** is not implemented.

## Current milestone status

| Area | Status |
| --- | --- |
| Movement, variable jump, coyote/buffer | Implemented |
| JSON levels, terrain, camera, respawn | Implemented |
| Coins, collectible stars, score, rating, save, progression | Implemented |
| Enemy archetypes, patrol, stomp combat, health, Game Over | Implemented |
| Bombs and explosion combat | Implemented |
| Shield, coin magnet, growth mushroom | Implemented |
| Energy flower + Energy Ball | Implemented |
| Breakable/reward blocks, pipes, secret rooms | Not started |
| Audio engine, music, SFX | Not started (contract documented only) |
| Android/Capacitor packaging | Not started |

## Existing gameplay systems

- `Player` with keyboard/touch-normalized input, acceleration, variable jump, coyote time,
  jump buffering and procedural placeholder art.
- Validated levels discovered from `content/levels/**/*.json`, one static body per terrain
  rectangle, non-solid water, goal sensor, camera follow.
- `CollectionSystem` + `CollectionLedger` for coins, stars and non-scoring pickups.
- `EnemySystem` + `Enemy` + `EnemyLedger` for patrols, stomps, player damage, health and defeat
  score.
- `BombSystem` for inventory, Arcade throws and timed explosions.
- `EffectSystem` + `ActiveEffects` for shield, magnet, growth and weapon-ability clocks.
- `PlayerTransformation` for safe small/big body resizing.
- `EnergyBallSystem` + `EnergyBall` for the Energy Ball ability.
- `GameScene` orchestration, `ResultScene`, `GameOverScene`, `MenuScene`.
- `ScoringConfig`, `SaveStore`, campaign order, result rating.

## Known verification limitations

- Touch was verified with synthetic `Touch`/`TouchEvent` events and Phaser input paths, not on a
  physical phone or Android WebView.
- Canvas-renderer fallback and DPR > 1 sharpness were not re-tested in this milestone.
- Projectile physics was verified with scripted Arcade frames and synthetic positioning, not a full
  human playthrough on mid-range mobile hardware.
- Wall/ceiling durability assumes the current 64 px tile geometry; very thin future terrain is not
  protected against sub-frame tunneling.
- There is no audio to verify because audio is intentionally unimplemented.
- Production preview is smoke-tested (boot/menu/level load); the dev bridge and level selector are
  absent there by design.

## Documentation map

- [Architecture](ARCHITECTURE.md) — module boundaries and wiring.
- [Gameplay mechanics](GAMEPLAY_MECHANICS.md) — implemented vs planned behavior.
- [Extending Matio](EXTENDING_MATIO.md) — practical extension recipes for agents.
- [Architecture decisions](ARCHITECTURE_DECISIONS.md) — concise decision records.
- [Level format](LEVEL_FORMAT.md) — schema, anchors, object types.
- [Game design](GAME_DESIGN.md) — product direction.
- [Development workflow](DEVELOPMENT_WORKFLOW.md) — verification and release safety.
- [Asset guide](ASSET_GUIDE.md) — placeholder/final art conventions.
- [Agent instructions](../AGENTS.md).

## Roadmap (planned, not implemented)

1. **Task 008-A:** interactive blocks — breakable bricks, reward blocks, hit-from-below
   interactions, item release, used-block state.
2. Pipes and secret/underground areas.
3. First centralized `AudioManager`, original SFX, then music and audio settings.
4. Enemy behavior extensions (chase, flyers, projectiles) as separate reviewed tasks.
5. Weapon/character upgrades and permanent progression only after an explicit task.
6. Android packaging through Capacitor.

The suggested audio sequencing is documented in [ARCHITECTURE.md](ARCHITECTURE.md#21-audio-planning-planned--not-implemented).

## Current architecture extension points

- `content/config/weapons.json` + `src/types/weapon.ts` — validate tuning for implemented weapon
  IDs.
- `WEAPON_PICKUP_TO_WEAPON` — maps a pickup object type to a weapon ID.
- `EnergyBallSystem` / `EnergyBall` — projectile lifecycle and per-projectile target set.
- `projectile-rules.ts` — pure spawn, cadence, terrain, target and bounds rules.
- `ActiveEffects.activateAbility()` — one clock per attempt for temporary weapon windows.
- `CollectionSystem.onWeaponPickup` — route future weapon pickups without duplicating collection
  idempotency.
- `EnemySystem.damageEnemy()` — the only external direct-hit damage entry point.

## Outstanding technical risks

- Phaser 4 is young; every API must be checked against bundled types/skills.
- No physical Android device testing.
- Arcade collision callback argument order can vary (verified during this task); handlers must
  resolve objects from either argument.
- Fast projectiles against future thin geometry may tunnel; current terrain is 64 px tiles.
- Level balance is placeholder and scripted verification does not prove feel.
- `window.__MATIO_GAME__` exists in development only; tooling must not rely on it in production.

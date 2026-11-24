# Gameplay Mechanics

This document describes **actual behavior**. Sections are split into IMPLEMENTED, PLANNED and
NOT IMPLEMENTED. Planned text is intent only; it must not be described as working.

## IMPLEMENTED

### Small player form

- Start state of every attempt.
- Arcade body 38×84 world pixels at offset (13, 12) inside the 64×96 source frame.
- Origin is (0.5, 1); `player.y` is the feet position.
- Movement uses acceleration, drag and max velocity from `content/config/player.json`.
- Variable jump height, coyote time, jump buffering and jump cut are implemented.
- Contact damage, stomp bounce, shield, magnet and weapon firing work in this form.

### Big player form

- Granted by a growth mushroom and lasts 20 seconds when there is room.
- Arcade body 46×130 world pixels; visual scale 1.4; same feet anchor as the small form.
- The body is resized in place without teleporting or changing movement physics.
- Under a low ceiling the pickup is banked; the HUD shows `PENDING GROWTH` until the player
  clears the obstruction, then the full timer starts.
- A cramped fall spawn suspends the big body while any running timer continues.
- Firing an Energy Ball uses the current body edge and hand height in both forms.

### Growth pickup

- Level object `growth-mushroom`, collected through the normal pickup overlap.
- Grants zero score and no save state.
- One growth clock per attempt; another mushroom refreshes the duration.
- Never grows through solid terrain, world bounds or a live enemy body.
- Retry/Victory/Game Over clear transformation state.

### Health and invulnerability

- Three hearts by default, configured in `content/config/combat.json`.
- Damage applies knockback, a short input lock and a damage flash.
- Invulnerability prevents repeated contact damage during its window.
- Health reaches zero exactly once and starts `GameOverScene`; no save record or unlock is written.

### Stomp combat

- A stomp requires a stompable enemy, downward movement and the previous player-body bottom at or
  above the enemy top within the tolerance.
- One contact is either a stomp or player damage, never both.
- Mushroom: 1 health, stompable, 200 defeat points.
- Snail: 2 health, stompable, 350 defeat points; the first stomp only removes one health.
- Spiky: 1 health, not stompable; stomping causes player damage. It can be defeated by bombs and
  Energy Balls.

### Enemy archetypes and patrol

- `content/config/enemies.json` defines health, speed, behavior, stompable, contact damage and
  score; level JSON only references the archetype ID.
- Patrol reverses at walls, authored tile-column bounds and missing ground ahead.
- Enemies start in an empty cell with solid ground below; the loader validates this.
- Defeat disables the body immediately and records points once through `EnemyLedger`.

### Coins and collectible stars

- JSON objects `coin` and `star`, anchored at tile centers.
- Collected once per attempt via `Collectible.collect()` and `CollectionLedger`.
- Coin 100 points, collectible star 500 points (configured).
- Falling keeps collected objects and run score; Retry restores them.
- Rating stars are separate from collectible stars.

### Bombs

- Bomb pickups fill a run-only inventory (max 5 by default).
- X/J or the touch THROW button throws an Arcade projectile.
- A fuse creates a radius explosion that damages enemies through `EnemySystem`.
- Bombs do not damage the player or terrain.
- Victory/Game Over/shutdown freeze and remove active bombs.
- Bomb behavior is unchanged by the Energy Ball feature.

### Shield

- Temporary (15 seconds by default) pickup with configured charges.
- Absorbs one eligible contact that would otherwise damage the player.
- Absorption flashes and starts the combat invulnerability window.
- Charges and time are independent of Energy Ball and growth.

### Magnet

- Temporary (12 seconds by default) pickup.
- Pulls reachable coins along a clear straight path at the configured speed.
- Pulled coins settle through `CollectionSystem.collect()`, so score and counters change once.

### Energy Ball

- Pickup: level object `energy-flower`, centered in its cell, non-solid, zero score.
- Collecting it grants or refreshes a 20-second ability (configured in `weapons.json`).
- Input: keyboard C or K, touch FIRE. THROW remains bombs.
- One shot per new press; holding does not repeat.
- Cooldown 350 ms, at most 2 active projectiles, one target per projectile.
- Launch speed 430 px/s in the facing direction with −80 px/s initial vertical velocity.
- Gravity 1100 px/s² (net, independent of world gravity), bounce 0.75 on floor/platform tops.
- Terrain policy: floor/platform top bounces; wall, block side and ceiling destroy the projectile.
  Water is non-solid, so a projectile passes through it like the player.
- Lifetime 2500 ms; projectiles outside the world are removed; damage stops on freeze.
- Each projectile damages an enemy at most once; dead enemies cannot be hit again.
- Damage goes through `EnemySystem.damageEnemy()` → `Enemy.takeDamage()` → `EnemyLedger`.
- Player health is never affected by a projectile.
- The ability does not stack damage; only Energy Ball Level 1 exists.

### Victory, Game Over, fall respawn and Retry

- Victory: goal overlap flips `playing → completing → results` once, freezes collection/enemies/
  bombs/Energy Ball, writes one validated save record and starts `ResultScene`.
- Game Over: health zero flips `playing → gameover` once, writes no record/unlock, offers RETRY and
  MAIN MENU.
- Fall respawn: feet beyond `worldHeight + 2·tileSize` returns the player to the JSON spawn; collected
  objects, run score, health, enemy states, effect timers and the Energy Ball window are preserved.
- Retry: new scene, new ledgers, full health, all enemies/pickups restored, ability cleared.

## PLANNED

These are design intentions only. None is implemented in Task 007-B.

- Big player breaks ordinary bricks when hitting them from below.
- Small player bumps appropriate bricks but cannot break them.
- Reward blocks release items and cannot pay out twice.
- Pipes transition to secret or underground areas.
- Enemy archetypes acquire special interaction behaviors (shells, kicks, unique reactions).
- Character and weapon upgrades; permanent progression and inventory.

### Intent vs implementation notes

- The design language "bricks", "reward blocks" and "pipes" currently has **no** terrain or object
  type in schema 1. `block` is currently a plain solid step, not an interactive brick.
- Weapons currently have no upgrade tiers, ammo, shop or saved state. A second weapon pickup or an
  upgrade requires TypeScript work plus a validated config entry.
- Enemy defeat by Energy Ball is implemented for existing archetypes, but there is no
  weapon-specific enemy interaction beyond immediate damage.

### Audio planning (PLANNED — NOT IMPLEMENTED)

No AudioManager, sound effect, music, audio asset, audio dependency or audio settings UI exists.
Gameplay rules must remain independent of playback, and pure modules must not call Phaser sound
APIs. The future `AudioManager` responsibilities, semantic event IDs (`player.jump`, `coin.collect`,
`enemy.defeat`, `weapon.energy.fire`, `level.complete`, …) and suggested sequencing are documented in
[ARCHITECTURE.md](ARCHITECTURE.md#21-audio-planning-planned--not-implemented). All final audio must be
original or properly licensed; no copyrighted samples.

## NOT IMPLEMENTED

- Hammer/melee combat.
- Weapon Level 2/3, permanent weapon inventory, shop or saved weapon progression.
- Breakable bricks, golden/hidden/multi-coin reward blocks, hit-from-below interactions.
- Pipes, underground rooms, moving platforms.
- Enemy shells, shell kicking, new enemy types, chasing/flying enemies, enemy projectiles, bosses.
- Character selection, final art, music, sound effects, audio settings.
- Android packaging, level editor, backend, production deployment.

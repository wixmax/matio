import Phaser from 'phaser';
import { EnergyBall } from '../entities/EnergyBall';
import { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { WeaponDefinition, WeaponId } from '../types/weapon';
import type { ActiveEffects } from './ActiveEffects';
import type { EnemySystem } from './EnemySystem';
import type { LevelGeometry } from '../types/level-runtime';
import {
  canFireEnergyBall,
  classifyProjectileTerrainContact,
  energyBallSpawn,
  isProjectileOutsideWorld,
} from './projectile-rules';
import { PALETTE } from '../ui/theme';

const WEAPON_ID: WeaponId = 'energy-ball';
const IMPACT_DURATION_MS = 180;
const WORLD_CLEANUP_MARGIN_PX = 96;

export interface EnergyBallSystemOptions {
  readonly scene: Phaser.Scene;
  readonly player: Player;
  /** Shared enemy damage entry point; keeps health/ledger ownership there. */
  readonly enemies: Pick<EnemySystem, 'damageEnemy'>;
  readonly enemyGroup: Phaser.Physics.Arcade.Group;
  readonly effects: ActiveEffects;
  readonly settings: WeaponDefinition;
  readonly world: Pick<LevelGeometry, 'worldWidth' | 'worldHeight'>;
  readonly solids: readonly Phaser.GameObjects.Rectangle[];
}

/**
 * Owns the run's Energy Ball ability and its Arcade projectiles.
 *
 * Responsibilities:
 * - activation/refresh of the temporary ability window in `ActiveEffects`;
 * - cooldown, active-projectile and target limits through pure rules;
 * - group insertion + body tuning (after insertion) and terrain/enemy colliders;
 * - immediate contact damage through `EnemySystem` (never a parallel ledger);
 * - lifetime/out-of-bounds cleanup and terminal freezing.
 *
 * The system never reads input and never writes score directly.
 */
export class EnergyBallSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly enemies: Pick<EnemySystem, 'damageEnemy'>;
  private readonly effects: ActiveEffects;
  private readonly settings: WeaponDefinition;
  private readonly world: { readonly width: number; readonly height: number };
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly terrainCollider: Phaser.Physics.Arcade.Collider;
  private readonly enemyOverlap: Phaser.Physics.Arcade.Collider;
  private readonly active = new Set<EnergyBall>();
  private readonly impacts = new Map<Phaser.GameObjects.Graphics, number>();
  private elapsedMs = 0;
  private lastFireMs = -Infinity;
  private frozen = false;

  constructor(options: EnergyBallSystemOptions) {
    this.scene = options.scene;
    this.player = options.player;
    this.enemies = options.enemies;
    this.effects = options.effects;
    this.settings = options.settings;
    this.world = { width: options.world.worldWidth, height: options.world.worldHeight };

    this.projectiles = options.scene.physics.add.group();
    this.terrainCollider = options.scene.physics.add.collider(
      this.projectiles,
      [...options.solids],
      this.handleTerrainHit,
      undefined,
      this,
    );
    this.enemyOverlap = options.scene.physics.add.overlap(
      this.projectiles,
      options.enemyGroup,
      this.handleEnemyHit,
      undefined,
      this,
    );
  }

  get weaponId(): WeaponId {
    return WEAPON_ID;
  }

  get abilityActive(): boolean {
    return !this.frozen && this.effects.isAbilityActive(WEAPON_ID);
  }

  get remainingMs(): number {
    return this.effects.abilityRemainingMs(WEAPON_ID);
  }

  get activeCount(): number {
    return this.active.size;
  }

  /** Grants or refreshes the full configured window; never stacks damage. */
  activate(): boolean {
    if (this.frozen) {
      return false;
    }

    this.effects.activateAbility(WEAPON_ID, this.settings.durationMs);
    return true;
  }

  /** Fires one projectile. A rejected attempt never spends the cooldown. */
  fire(): boolean {
    if (this.frozen) {
      return false;
    }

    if (!canFireEnergyBall(
      this.settings,
      this.effects.isAbilityActive(WEAPON_ID),
      this.active.size,
      this.elapsedMs - this.lastFireMs,
    )) {
      return false;
    }

    const direction = this.player.facingDirection;
    const spawn = energyBallSpawn(this.player.physicsBody, direction);

    if (spawn.x < 0 || spawn.x > this.world.width) {
      return false;
    }

    const ball = new EnergyBall(this.scene, spawn.x, spawn.y);

    // Insert first, then tune: Arcade applies group defaults on insertion.
    this.projectiles.add(ball);
    ball.launch(this.settings, direction, this.elapsedMs);
    this.active.add(ball);
    this.lastFireMs = this.elapsedMs;

    return true;
  }

  update(deltaMs: number): void {
    if (this.frozen || !Number.isFinite(deltaMs) || deltaMs <= 0) {
      return;
    }

    this.elapsedMs += deltaMs;
    this.updateImpacts();

    for (const ball of this.active) {
      const body = ball.body;

      if (!ball.active || !(body instanceof Phaser.Physics.Arcade.Body)) {
        this.active.delete(ball);
        ball.destroy();
        continue;
      }

      if (
        this.elapsedMs >= ball.expiresAt ||
        isProjectileOutsideWorld(body.center.x, body.center.y, this.world, WORLD_CLEANUP_MARGIN_PX)
      ) {
        this.remove(ball);
      }
    }
  }

  /** Victory/Game Over/shutdown: stop damage and remove every projectile. */
  freeze(): void {
    if (this.frozen) {
      return;
    }

    this.frozen = true;

    for (const ball of this.active) {
      if (ball.body instanceof Phaser.Physics.Arcade.Body) {
        ball.body.enable = false;
      }
      ball.destroy();
    }

    this.active.clear();

    for (const impact of this.impacts.keys()) {
      impact.destroy();
    }

    this.impacts.clear();
    this.terrainCollider.active = false;
    this.enemyOverlap.active = false;
  }

  destroy(): void {
    this.freeze();

    // Scene shutdown may already have disposed Arcade's world.
    if (this.scene.physics.world) {
      this.terrainCollider.destroy();
      this.enemyOverlap.destroy();
    }
  }

  private remove(ball: EnergyBall): void {
    if (!this.active.delete(ball)) {
      return;
    }

    if (ball.body instanceof Phaser.Physics.Arcade.Body) {
      ball.body.enable = false;
    }

    ball.destroy();
  }

  private readonly handleTerrainHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
    object1,
    object2,
  ): void => {
    if (this.frozen) {
      return;
    }

    const ball = asEnergyBall(object1) ?? asEnergyBall(object2);

    if (ball === null || !ball.active) {
      return;
    }

    const body = ball.body;

    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      return;
    }

    const contact = classifyProjectileTerrainContact({
      left: body.blocked.left,
      right: body.blocked.right,
      up: body.blocked.up,
      down: body.blocked.down,
    });

    if (contact === 'destroy') {
      this.remove(ball);
    }
  };

  private readonly handleEnemyHit: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
    object1,
    object2,
  ): void => {
    if (this.frozen) {
      return;
    }

    const ball = asEnergyBall(object1) ?? asEnergyBall(object2);
    const enemy = asEnemy(object1) ?? asEnemy(object2);

    if (ball === null || !ball.active || enemy === null || !enemy.active || !enemy.isAlive) {
      return;
    }

    if (!ball.registerTarget(enemy.enemyKey, this.settings.maxTargets)) {
      return;
    }

    this.enemies.damageEnemy(enemy, this.settings.damage);
    this.showImpact(ball.x, ball.y);

    if (ball.hitCount >= this.settings.maxTargets) {
      this.remove(ball);
    }
  };

  private showImpact(x: number, y: number): void {
    const graphic = this.scene.add.graphics().setDepth(20);
    graphic.lineStyle(4, PALETTE.sun, 0.9);
    graphic.strokeCircle(0, 0, 9);
    graphic.fillStyle(PALETTE.waterLight, 0.45);
    graphic.fillCircle(0, 0, 5);
    graphic.setPosition(x, y);
    this.impacts.set(graphic, this.elapsedMs + IMPACT_DURATION_MS);
  }

  private updateImpacts(): void {
    for (const [graphic, deadline] of this.impacts) {
      const remaining = deadline - this.elapsedMs;

      if (remaining <= 0) {
        this.impacts.delete(graphic);
        graphic.destroy();
      } else {
        const progress = 1 - remaining / IMPACT_DURATION_MS;
        graphic.setAlpha(remaining / IMPACT_DURATION_MS);
        graphic.setScale(1 + progress * 0.9);
      }
    }
  }
}

/**
 * Arcade may pass the group child as either callback argument depending on how
 * the internal collide routine pairs group members, so never assume position.
 */
function asEnergyBall(value: unknown): EnergyBall | null {
  if (value instanceof EnergyBall) {
    return value;
  }

  if (value instanceof Phaser.Physics.Arcade.Body) {
    return value.gameObject instanceof EnergyBall ? value.gameObject : null;
  }

  return null;
}

function asEnemy(value: unknown): Enemy | null {
  if (value instanceof Enemy) {
    return value;
  }

  if (value instanceof Phaser.Physics.Arcade.Body) {
    return value.gameObject instanceof Enemy ? value.gameObject : null;
  }

  return null;
}

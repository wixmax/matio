import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { EnemyRuntime } from '../factories/EnemyFactory';
import type { CombatConfig, HealthSnapshot } from '../types/combat';
import type { PixelRect } from '../types/level-runtime';
import { addUiText } from '../ui/components/ui-text';
import { PALETTE, toCssColor } from '../ui/theme';
import { classifyEnemyContact, resolveKnockbackDirection } from './combat-rules';
import { explosionIntersectsRect } from './bomb-rules';
import { resolveEnemyDamage } from './effect-rules';
import { EnemyLedger } from './enemy-ledger';
import type { PlayerHealth } from './player-health';
import { bodiesOverlap } from './player-form-rules';

export interface EnemySnapshot {
  readonly defeatedCount: number;
  readonly defeatedPoints: number;
  readonly total: number;
  readonly remaining: number;
}

export interface EnemySystemOptions {
  readonly scene: Phaser.Scene;
  readonly player: Player;
  readonly runtime: EnemyRuntime;
  readonly solids: readonly Phaser.GameObjects.GameObject[];
  readonly combat: CombatConfig;
  readonly health: PlayerHealth;
  readonly absorbPlayerDamage: () => boolean;
  readonly onChanged: (snapshot: EnemySnapshot) => void;
  readonly onPlayerDamaged: (health: HealthSnapshot) => void;
  readonly onPlayerDefeated: () => void;
}

/**
 * Enemy orchestration: patrol updates, terrain collision, contact resolution,
 * defeat ledger and combat feedback.
 *
 * Collision order is deterministic:
 * 1. terrain collider (enemies are grounded before contacts resolve),
 * 2. player/enemy collider (classify stomp vs damage exactly once per pair),
 * 3. collectible/goal overlaps remain owned by their existing systems.
 *
 * GameScene only wires this system and reacts to `onPlayerDefeated`; no combat
 * rule lives in the scene.
 */
export class EnemySystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly runtime: EnemyRuntime;
  private readonly combat: CombatConfig;
  private readonly health: PlayerHealth;
  private readonly absorbPlayerDamage: () => boolean;
  private readonly onChanged: (snapshot: EnemySnapshot) => void;
  private readonly onPlayerDamaged: (health: HealthSnapshot) => void;
  private readonly onPlayerDefeated: () => void;
  private readonly ledger = new EnemyLedger();
  private readonly terrainCollider: Phaser.Physics.Arcade.Collider;
  private readonly contactCollider: Phaser.Physics.Arcade.Collider;

  private frozen = false;

  constructor(options: EnemySystemOptions) {
    this.scene = options.scene;
    this.player = options.player;
    this.runtime = options.runtime;
    this.combat = options.combat;
    this.health = options.health;
    this.absorbPlayerDamage = options.absorbPlayerDamage;
    this.onChanged = options.onChanged;
    this.onPlayerDamaged = options.onPlayerDamaged;
    this.onPlayerDefeated = options.onPlayerDefeated;

    // Terrain first: bodies must be separated from the floor before contact
    // classification uses their previous/current positions.
    this.terrainCollider = options.scene.physics.add.collider(options.runtime.group, [
      ...options.solids,
    ]);
    this.contactCollider = options.scene.physics.add.collider(
      options.player,
      options.runtime.group,
      this.handleContact,
      undefined,
      this,
    );
  }

  get snapshot(): EnemySnapshot {
    const defeatedCount = this.ledger.defeatedCount;

    return {
      defeatedCount,
      defeatedPoints: this.ledger.points,
      total: this.runtime.totalCount,
      remaining: Math.max(0, this.runtime.totalCount - defeatedCount),
    };
  }

  get defeatedPoints(): number {
    return this.ledger.points;
  }

  /** Growth must not manufacture a new overlap with a live combat body. */
  intersectsLivingEnemy(rect: PixelRect): boolean {
    return this.runtime.enemies.some((enemy) =>
      enemy.active && enemy.isAlive && bodiesOverlap(rect, enemy.arcadeBody));
  }

  /** Shared damage entry point for external attacks, including explosions. */
  damageEnemiesInRadius(x: number, y: number, radius: number, damage: number): void {
    if (this.frozen) return;
    for (const enemy of this.runtime.enemies) {
      if (!enemy.active || !enemy.isAlive) continue;
      const body = enemy.arcadeBody;
      if (explosionIntersectsRect(x, y, radius, body)) {
        this.applyDamage(enemy, damage);
      }
    }
  }

  /**
   * Direct-hit damage for projectiles. Routes through the same health and
   * EnemyLedger path as stomps and explosions, so score settles once and dead
   * enemies cannot be damaged again.
   */
  damageEnemy(enemy: Enemy, damage: number): boolean {
    if (this.frozen || !enemy.active || !enemy.isAlive) return false;
    return this.applyDamage(enemy, damage);
  }

  /** Advances invulnerability and every living enemy's patrol. */
  update(deltaMs: number): void {
    if (this.frozen) {
      return;
    }

    this.health.tick(deltaMs);

    for (const enemy of this.runtime.enemies) {
      if (enemy.active && enemy.isAlive) {
        enemy.tick();
      }
    }
  }

  /** Stops combat updates and horizontal patrol movement. */
  freeze(): void {
    if (this.frozen) {
      return;
    }

    this.frozen = true;

    for (const enemy of this.runtime.enemies) {
      if (enemy.active) {
        enemy.stopPatrol();
      }
    }
  }

  destroy(): void {
    this.frozen = true;
    this.terrainCollider.destroy();
    this.contactCollider.destroy();
  }

  private readonly handleContact: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
    object1,
    object2,
  ): void => {
    if (this.frozen) {
      return;
    }

    const enemy = asEnemy(object1) ?? asEnemy(object2);

    if (enemy === null || !enemy.isAlive) {
      return;
    }

    const playerBody = this.player.physicsBody;
    const enemyBody = enemy.arcadeBody;

    const contact = classifyEnemyContact({
      enemyStompable: enemy.definition.stompable,
      previousPlayerTop: playerBody.prev.y,
      playerBodyHeight: playerBody.height,
      enemyTop: enemyBody.top,
      playerDeltaY: playerBody.deltaY(),
      playerVelocityY: playerBody.velocity.y,
      topContactTolerancePx: this.combat.stomp.topContactTolerancePx,
    });

    // Exactly one branch runs per contact: a stomp never also damages the
    // player, and a damaging contact never damages the enemy.
    if (contact === 'stomp') {
      this.resolveStomp(enemy);
    } else {
      this.resolvePlayerDamage(enemy);
    }
  };

  private resolveStomp(enemy: Enemy): void {
    if (this.applyDamage(enemy, 1)) {
      this.player.bounce(this.combat.stomp.bounceVelocity);
    }
  }

  private applyDamage(enemy: Enemy, amount: number): boolean {
    const result = enemy.takeDamage(amount);
    if (result.defeated) this.recordDefeat(enemy);
    return result.applied;
  }

  private resolvePlayerDamage(enemy: Enemy): void {
    const result = resolveEnemyDamage(this.health, enemy.definition.damage, this.absorbPlayerDamage);

    if (result === 'ignored' || result === 'absorbed') {
      return;
    }

    const direction = resolveKnockbackDirection(this.player.x, enemy.x);

    this.player.applyKnockback(
      direction * this.combat.player.knockbackVelocityX,
      this.combat.player.knockbackVelocityY,
    );
    this.player.stun(this.combat.player.inputLockMs);
    this.player.startDamageFlash(
      this.combat.player.damageFlashDurationMs,
      this.combat.player.damageFlashIntervalMs,
    );

    this.onPlayerDamaged(this.health.snapshot);

    if (result === 'defeated') {
      this.onPlayerDefeated();
    }
  }

  private recordDefeat(enemy: Enemy): void {
    if (!this.ledger.recordDefeat(enemy.enemyKey, enemy.definition.score)) {
      return;
    }

    if (enemy.definition.score > 0) {
      this.showDefeatFeedback(enemy.x, enemy.y, enemy.definition.score);
    }

    this.onChanged(this.snapshot);
  }

  private showDefeatFeedback(x: number, y: number, points: number): void {
    const label = addUiText(this.scene, x, y - 34, `+${points}`, {
      fontStyle: 'bold',
      fontSize: '22px',
      color: toCssColor(PALETTE.sun),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 5,
    })
      .setOrigin(0.5)
      .setDepth(12);

    this.scene.tweens.add({
      targets: label,
      y: y - 88,
      alpha: 0,
      duration: 560,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }
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

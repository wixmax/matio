import Phaser from 'phaser';
import type {
  EnemyDamageResult,
  EnemyGroundRects,
  EnemyPlacement,
  EnemyDefinition,
  EnemyPatrolWorldBounds,
} from '../types/enemy';
import { resolvePatrolStep } from '../systems/enemy-behaviors';
import { ENEMY_BODY, ensureEnemyTexture, enemyTextureKey } from './enemy-textures';

/**
 * Reusable patrolling enemy entity.
 *
 * Responsibilities:
 * - own Arcade Physics body + gravity/terrain collision state;
 * - own health, alive/dead state and hurt/defeat visuals;
 * - apply the configured movement behavior through pure resolvers.
 *
 * It never touches player health, the HUD or scoring; `EnemySystem` classifies
 * contacts and records defeat rewards.
 *
 * Conventions:
 * - origin is (0.5, 1): `enemy.y` is the feet position (same as Player);
 * - body is 44x44 at offset (10,20) inside a 64x64 frame;
 * - movement uses Arcade velocity only (no manual position edits).
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly enemyKey: string;
  readonly enemyId: string;
  readonly definition: EnemyDefinition;
  readonly patrol: EnemyPatrolWorldBounds;

  private readonly physicsBody: Phaser.Physics.Arcade.Body;
  private readonly groundRects: EnemyGroundRects;

  private currentHealth: number;
  private alive = true;
  private direction: -1 | 1 = 1;

  constructor(
    scene: Phaser.Scene,
    placement: EnemyPlacement,
    definition: EnemyDefinition,
    groundRects: EnemyGroundRects,
  ) {
    ensureEnemyTexture(scene, placement.enemyId);
    super(scene, placement.x, placement.y, enemyTextureKey(placement.enemyId));

    this.enemyKey = placement.key;
    this.enemyId = placement.enemyId;
    this.definition = definition;
    this.patrol = placement.patrol;
    this.groundRects = groundRects;
    this.currentHealth = definition.health;

    scene.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(8);

    scene.physics.add.existing(this);

    const body = this.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      throw new Error('Enemy requires a dynamic Arcade Physics body.');
    }

    this.physicsBody = body;
    body.setSize(ENEMY_BODY.width, ENEMY_BODY.height, false);
    body.setOffset(ENEMY_BODY.offsetX, ENEMY_BODY.offsetY);
    body.setCollideWorldBounds(true);
    body.setBounce(0, 0);
    body.setAllowRotation(false);
    body.setImmovable(true);
    body.setMaxVelocity(Math.max(1, definition.speed), 1_000);
  }

  get isAlive(): boolean {
    return this.alive;
  }

  get health(): number {
    return this.currentHealth;
  }

  get facingDirection(): -1 | 1 {
    return this.direction;
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.physicsBody;
  }

  /** Advances the configured patrol behavior by one frame. */
  tick(): void {
    if (!this.alive) {
      return;
    }

    const body = this.physicsBody;
    const grounded = body.blocked.down || body.touching.down;

    const step = resolvePatrolStep({
      direction: this.direction,
      speed: this.definition.speed,
      bodyLeft: body.left,
      bodyRight: body.right,
      bodyBottom: body.bottom,
      patrolLeft: this.patrol.left,
      patrolRight: this.patrol.right,
      blockedLeft: body.blocked.left,
      blockedRight: body.blocked.right,
      grounded,
      groundRects: this.groundRects,
    });

    if (step.direction !== this.direction) {
      this.direction = step.direction;
      this.setFlipX(step.direction < 0);
    }

    body.setVelocityX(step.velocityX);
  }

  /**
   * Applies damage once. Returns `defeated: true` only on the transition to
   * zero health, which is the single point where EnemySystem awards score.
   */
  takeDamage(amount: number): EnemyDamageResult {
    if (!this.alive || !Number.isFinite(amount)) {
      return { applied: false, defeated: false, remainingHealth: this.currentHealth };
    }

    const normalized = Math.trunc(amount);

    if (normalized <= 0) {
      return { applied: false, defeated: false, remainingHealth: this.currentHealth };
    }

    this.currentHealth = Math.max(0, this.currentHealth - normalized);

    if (this.currentHealth <= 0) {
      this.defeat();
      return { applied: true, defeated: true, remainingHealth: 0 };
    }

    this.playHurtFeedback();
    return { applied: true, defeated: false, remainingHealth: this.currentHealth };
  }

  /** Stops horizontal movement without defeating the enemy (victory freeze). */
  stopPatrol(): void {
    if (!this.alive) {
      return;
    }

    this.physicsBody.setVelocityX(0);
  }

  private playHurtFeedback(): void {
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.16,
      scaleY: 0.84,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private defeat(): void {
    this.alive = false;
    this.setDepth(9);
    this.physicsBody.setVelocity(0, 0);
    this.physicsBody.enable = false;

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      y: this.y - 22,
      scaleX: 0.3,
      scaleY: 0.3,
      alpha: 0,
      duration: 240,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.destroy();
      },
    });
  }
}

import Phaser from 'phaser';
import type { WeaponDefinition } from '../types/weapon';
import { ENERGY_BALL_BODY_SIZE, registerProjectileHit } from '../systems/projectile-rules';
import { ENERGY_BALL_TEXTURE, ensureEnergyBallTexture } from './energy-ball-textures';

/**
 * One bouncing Energy Ball projectile.
 *
 * The entity owns its Arcade body tuning, flight deadline and per-projectile
 * target set. Spawning, terrain policy, damage routing and cleanup stay in
 * `EnergyBallSystem` so no gameplay decision lives in a display object.
 */
export class EnergyBall extends Phaser.Physics.Arcade.Sprite {
  private readonly hitTargets = new Set<string>();
  private expiresAtMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    ensureEnergyBallTexture(scene);
    super(scene, x, y, ENERGY_BALL_TEXTURE);

    scene.add.existing(this);
    this.setOrigin(0.5);
    this.setDepth(9);

    scene.physics.add.existing(this);
  }

  /**
   * Applies validated tuning. Call this AFTER adding the sprite to its physics
   * group: Arcade group insertion can reset velocity, gravity and bounce
   * defaults, which would otherwise silently replace the configured values.
   */
  launch(settings: WeaponDefinition, direction: -1 | 1, nowMs: number): void {
    const body = this.body;

    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      throw new Error('EnergyBall requires a dynamic Arcade Physics body.');
    }

    body.setAllowGravity(true);
    body.setSize(ENERGY_BALL_BODY_SIZE, ENERGY_BALL_BODY_SIZE, true);
    body.setGravityY(settings.gravity - this.scene.physics.world.gravity.y);
    body.setBounce(0, settings.bounce);
    body.setVelocity(direction * settings.speed, settings.initialVelocityY);
    body.setCollideWorldBounds(false);

    this.expiresAtMs = nowMs + settings.lifetimeMs;
    this.setFlipX(direction < 0);
  }

  get expiresAt(): number {
    return this.expiresAtMs;
  }

  get hitCount(): number {
    return this.hitTargets.size;
  }

  /** Records one enemy key once and only while the target budget remains. */
  registerTarget(key: string, maxTargets: number): boolean {
    return registerProjectileHit(this.hitTargets, key, maxTargets);
  }
}

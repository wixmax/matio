import Phaser from 'phaser';
import type { CollectiblePickupType, CollectiblePlacement } from '../types/collectible';
import {
  COLLECTIBLE_FRAME,
  COLLECTIBLE_TEXTURES,
  ensureCollectibleTextures,
  ensureEffectPickupTexture,
  ensureStarTexture,
} from './collectible-textures';

/**
 * One score or effect pickup.
 *
 * The Arcade body is used only for overlap: gravity is disabled and the body is
 * immovable, so collectibles never block the player. `collect()` is the single
 * idempotency point; score/HUD updates happen after it returns true.
 */
export class Collectible extends Phaser.Physics.Arcade.Sprite {
  readonly collectibleKey: string;
  readonly collectibleType: CollectiblePickupType;

  private readonly arcadeBody: Phaser.Physics.Arcade.Body;
  private collected = false;
  private isPulled = false;

  constructor(scene: Phaser.Scene, placement: CollectiblePlacement) {
    if (placement.type === 'coin') {
      ensureCollectibleTextures(scene);
    } else if (placement.type === 'star') {
      ensureStarTexture(scene);
    } else {
      ensureEffectPickupTexture(scene, placement.type);
    }

    super(scene, placement.x, placement.y, COLLECTIBLE_TEXTURES[placement.type]);

    this.collectibleKey = placement.key;
    this.collectibleType = placement.type;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body;

    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      throw new Error('Collectible requires a dynamic Arcade Physics body.');
    }

    this.arcadeBody = body;
    const frame = COLLECTIBLE_FRAME[placement.type];

    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(frame.bodyWidth, frame.bodyHeight, true);

    this.setDepth(5);

    if (placement.type === 'coin' || placement.type === 'star') {
      scene.tweens.add({
        targets: this,
        y: placement.y - 8,
        duration: placement.type === 'star' ? 1100 : 850,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    if (placement.type === 'star') {
      scene.tweens.add({
        targets: this,
        angle: 360,
        duration: 6000,
        repeat: -1,
        ease: 'Linear',
      });
    }
  }

  get isCollected(): boolean {
    return this.collected;
  }

  /** Takes over the coin's bob tween and keeps its overlap body aligned. */
  moveByMagnet(x: number, y: number): void {
    if (!this.isPulled) {
      this.scene.tweens.killTweensOf(this);
      this.arcadeBody.moves = false;
      this.isPulled = true;
    }
    this.setPosition(x, y);
    this.arcadeBody.updateFromGameObject();
  }

  /**
   * Marks the collectible collected and starts its removal tween.
   * Returns false for every call after the first.
   */
  collect(): boolean {
    if (this.collected) {
      return false;
    }

    this.collected = true;

    // Disable overlap immediately; destruction is intentionally delayed until
    // the feedback tween finishes so physics callbacks never iterate a removed
    // body.
    this.arcadeBody.enable = false;
    this.scene.tweens.killTweensOf(this);
    this.setDepth(11);

    const isStar = this.collectibleType === 'star';

    this.scene.tweens.add({
      targets: this,
      y: this.y - (isStar ? 30 : 20),
      scale: isStar ? 1.75 : 1.3,
      alpha: 0,
      angle: isStar ? this.angle + 180 : this.angle,
      duration: isStar ? 300 : 180,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.destroy();
      },
    });

    return true;
  }
}

import Phaser from 'phaser';
import type {
  BlockRewardType,
  InteractiveBlockId,
  InteractiveBlocksConfig,
  InteractiveBlockState,
} from '../types/interactive-block';
import type {
  InteractiveBlockPlacement,
  PixelRect,
  RewardReleasePlan,
} from '../types/level-runtime';
import { canActivateRewardBlock } from '../systems/block-rules';
import {
  blockTextureFor,
  ensureInteractiveBlockTextures,
} from './interactive-block-textures';

/**
 * One tile-sized solid interactive block.
 *
 * The Arcade body is static and always covers the authored cell, even while the
 * visual bump tweens. Breaking disables the body immediately; destroying the
 * visual is a separate tween so collision removal is never delayed.
 */
export class InteractiveBlock extends Phaser.GameObjects.Image {
  readonly placement: InteractiveBlockPlacement;
  readonly blockId: InteractiveBlockId;
  readonly rewardType: BlockRewardType | null;
  readonly release: RewardReleasePlan | null;
  readonly rect: PixelRect;

  /** Cleared by the system once the player separates from the underside. */
  contactLatched = false;

  private readonly staticBody: Phaser.Physics.Arcade.StaticBody;
  private readonly restY: number;
  private stateValue: InteractiveBlockState = 'unused';
  private bumpTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, placement: InteractiveBlockPlacement) {
    ensureInteractiveBlockTextures(scene);
    const centerX = placement.rect.x + placement.rect.width / 2;
    const centerY = placement.rect.y + placement.rect.height / 2;

    super(scene, centerX, centerY, blockTextureFor(placement.blockId, false));

    this.placement = placement;
    this.blockId = placement.blockId;
    this.rewardType = placement.reward;
    this.release = placement.release;
    this.rect = placement.rect;
    this.restY = centerY;

    scene.add.existing(this);
    this.setDepth(4);
    // The procedural source texture is 64×64, but the solid body always matches
    // the authored level tile size.
    this.setDisplaySize(placement.rect.width, placement.rect.height);

    scene.physics.add.existing(this, true);

    const body = this.body;

    if (!(body instanceof Phaser.Physics.Arcade.StaticBody)) {
      throw new Error('InteractiveBlock requires a static Arcade Physics body.');
    }

    this.staticBody = body;
    body.setSize(placement.rect.width, placement.rect.height, true);
    body.updateFromGameObject();
  }

  get blockState(): InteractiveBlockState {
    return this.stateValue;
  }

  get isSolid(): boolean {
    return this.stateValue !== 'destroyed' && this.staticBody.enable;
  }

  get physicsBody(): Phaser.Physics.Arcade.StaticBody {
    return this.staticBody;
  }

  /** Reward blocks only: claims the single payout transition. */
  markActivating(): boolean {
    if (!canActivateRewardBlock(this.stateValue)) {
      return false;
    }

    this.stateValue = 'activating';
    return true;
  }

  /** Marks a reward block as permanently used; it stays solid. */
  markUsed(): void {
    if (this.stateValue === 'destroyed' || this.stateValue === 'used') {
      return;
    }

    this.stateValue = 'used';
    this.setTexture(blockTextureFor(this.blockId, true));

    if (this.scene && this.scene.tweens) {
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.08,
        scaleY: 0.92,
        duration: 70,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  /**
   * Breaks once: disables the body and collision checks synchronously, then
   * plays a short visual fade. Returns false for every call after the first.
   */
  markDestroyed(config: InteractiveBlocksConfig): boolean {
    if (this.stateValue === 'destroyed') {
      return false;
    }

    this.stateValue = 'destroyed';
    this.staticBody.enable = false;
    this.staticBody.checkCollision.none = true;
    this.contactLatched = false;

    this.killBump();

    if (this.scene && this.scene.tweens) {
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.18,
        scaleY: 1.18,
        alpha: 0,
        duration: config.break.durationMs,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (this.active) this.destroy();
        },
      });
    } else {
      this.setVisible(false);
    }

    return true;
  }

  /** Visual-only head bump; the physics body never moves. */
  playBump(config: InteractiveBlocksConfig): void {
    if (!this.active || this.stateValue === 'destroyed') {
      return;
    }

    this.killBump();
    this.y = this.restY;
    this.bumpTween = this.scene.tweens.add({
      targets: this,
      y: this.restY - config.bump.offsetPx,
      duration: config.bump.durationMs / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.bumpTween = null;
      },
    });
  }

  private killBump(): void {
    if (this.bumpTween !== null) {
      this.bumpTween.stop();
      this.bumpTween = null;
    }

    this.y = this.restY;
  }
}

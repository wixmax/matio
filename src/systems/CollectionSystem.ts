import Phaser from 'phaser';
import { Collectible } from '../entities/Collectible';
import { isCollectibleType, type CollectibleCounts } from '../types/collectible';
import type { EffectType } from '../types/effects';
import type { ScoringConfig } from '../types/scoring';
import { addUiText } from '../ui/components/ui-text';
import { PALETTE, toCssColor } from '../ui/theme';
import { CollectionLedger } from './collection-ledger';
import { computeCollectedPoints } from './scoring';

export interface CollectionSnapshot extends CollectibleCounts {
  /** Collected coin/star points only; the completion bonus is added at victory. */
  readonly collectedPoints: number;
}

export interface CollectionSystemOptions {
  readonly scene: Phaser.Scene;
  readonly player: Phaser.Physics.Arcade.Sprite;
  readonly collectibles: Phaser.Physics.Arcade.Group;
  readonly scoring: ScoringConfig;
  readonly onChanged: (snapshot: CollectionSnapshot) => void;
  readonly onEffectPickup: (type: EffectType) => void;
}

/**
 * Owns the player/collectibles overlap and the current-run ledger.
 *
 * Overlap safety:
 * - Every collision passes through `Collectible.collect()` (idempotent).
 * - The ledger is a second guard, so score/HUD changes happen at most once.
 * - `freeze()` blocks all collection during completion settlement.
 */
export class CollectionSystem {
  private readonly scene: Phaser.Scene;
  private readonly scoring: ScoringConfig;
  private readonly onChanged: (snapshot: CollectionSnapshot) => void;
  private readonly onEffectPickup: (type: EffectType) => void;
  private readonly overlap: Phaser.Physics.Arcade.Collider;
  private readonly ledger = new CollectionLedger();

  private frozen = false;

  constructor(options: CollectionSystemOptions) {
    this.scene = options.scene;
    this.scoring = options.scoring;
    this.onChanged = options.onChanged;
    this.onEffectPickup = options.onEffectPickup;

    this.overlap = options.scene.physics.add.overlap(
      options.player,
      options.collectibles,
      this.handleOverlap,
      undefined,
      this,
    );
  }

  get counts(): CollectibleCounts {
    return this.ledger.counts;
  }

  get snapshot(): CollectionSnapshot {
    return {
      coins: this.ledger.coins,
      stars: this.ledger.stars,
      collectedPoints: computeCollectedPoints(this.ledger.counts, this.scoring),
    };
  }

  /** Stops collection immediately. Used when completion settlement starts. */
  freeze(): void {
    this.frozen = true;
    this.overlap.active = false;
  }

  destroy(): void {
    this.freeze();
    this.overlap.destroy();
  }

  collect(target: Collectible): void {
    // The entity guard prevents duplicate tweens/destruction; the ledger guard
    // prevents duplicate score/HUD updates even if both are reached twice.
    if (this.frozen || !target.active || !target.collect()) {
      return;
    }

    const type = target.collectibleType;
    if (!isCollectibleType(type)) {
      this.onEffectPickup(type === 'growth-mushroom' ? 'growth' : type);
      return;
    }
    if (!this.ledger.collect(target.collectibleKey, type)) {
      return;
    }

    this.showCollectionFeedback(
      target.x,
      target.y,
      type,
      this.scoring.points[type],
    );
    this.onChanged(this.snapshot);
  }

  private readonly handleOverlap: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
    _player,
    target,
  ): void => {
    if (target instanceof Collectible) this.collect(target);
  };

  private showCollectionFeedback(
    x: number,
    y: number,
    type: 'coin' | 'star',
    points: number,
  ): void {
    const isStar = type === 'star';

    if (isStar) {
      const ring = this.scene.add.graphics().setDepth(11);
      ring.lineStyle(5, PALETTE.sun, 1);
      ring.strokeCircle(0, 0, 20);
      ring.setPosition(x, y);
      ring.setScale(0.5);

      this.scene.tweens.add({
        targets: ring,
        scale: 2,
        alpha: 0,
        duration: 420,
        ease: 'Quad.easeOut',
        onComplete: () => ring.destroy(),
      });
    }

    const label = addUiText(this.scene, x, y - 22, `+${points}`, {
      fontStyle: 'bold',
      fontSize: isStar ? '26px' : '20px',
      color: toCssColor(isStar ? PALETTE.sun : PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 5,
    })
      .setOrigin(0.5)
      .setDepth(12);

    this.scene.tweens.add({
      targets: label,
      y: y - (isStar ? 76 : 58),
      alpha: 0,
      duration: isStar ? 700 : 480,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}

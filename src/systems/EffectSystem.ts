import type Phaser from 'phaser';
import type { Collectible } from '../entities/Collectible';
import { COLLECTIBLE_FRAME } from '../entities/collectible-textures';
import type { Player } from '../entities/Player';
import type { EffectsConfig, EffectType } from '../types/effects';
import type { PixelRect } from '../types/level-runtime';
import { PALETTE } from '../ui/theme';
import { ActiveEffects } from './ActiveEffects';
import type { CollectionSystem } from './CollectionSystem';
import { magnetStep, reachableCoinDistance } from './effect-rules';

const SHIELD_FLASH_MS = 220;

interface EffectSystemOptions {
  readonly scene: Phaser.Scene;
  readonly player: Player;
  readonly coins: readonly Collectible[];
  readonly solids: readonly PixelRect[];
  readonly collection: CollectionSystem;
  readonly config: EffectsConfig;
}

/** Wires run-owned effect state to world visuals and coin collection. */
export class EffectSystem {
  readonly active: ActiveEffects;
  private readonly aura: Phaser.GameObjects.Ellipse;
  private readonly flash: Phaser.GameObjects.Ellipse;
  private flashRemainingMs = 0;
  private disposed = false;

  constructor(private readonly options: EffectSystemOptions) {
    this.active = new ActiveEffects(options.config);
    this.aura = options.scene.add.ellipse(0, 0, 78, 104, PALETTE.waterLight, 0.23)
      .setStrokeStyle(3, PALETTE.waterLight).setDepth(10).setVisible(false);
    this.flash = options.scene.add.ellipse(0, 0, 96, 116, PALETTE.white, 0.28)
      .setStrokeStyle(6, PALETTE.white).setDepth(10).setVisible(false);
  }

  activate(type: EffectType): void {
    if (this.disposed) return;
    this.active.activate(type);
    this.updateVisuals();
  }

  absorbContact(): boolean {
    if (!this.active.consumeShield()) return false;
    this.flashRemainingMs = SHIELD_FLASH_MS;
    this.updateVisuals();
    return true;
  }

  update(delta: number): void {
    if (this.disposed || !Number.isFinite(delta) || delta <= 0) return;

    // A partially active final frame grants only the remaining pull time.
    const pullTime = Math.min(delta, this.active.remainingMs('magnet'));
    this.active.advance(delta);
    if (pullTime > 0) this.attractCoins(pullTime);
    this.flashRemainingMs = Math.max(0, this.flashRemainingMs - delta);
    this.updateVisuals();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active.dispose();
    this.aura.destroy();
    this.flash.destroy();
  }

  private updateVisuals(): void {
    const { x, y } = this.options.player.physicsBody.center;
    this.aura.setPosition(x, y).setVisible(this.active.isActive('shield'));
    this.flash.setPosition(x, y).setVisible(this.flashRemainingMs > 0)
      .setAlpha(this.flashRemainingMs / SHIELD_FLASH_MS);
  }

  private attractCoins(delta: number): void {
    const { coins, solids, collection, player, config } = this.options;
    const { radius, attractionSpeed, collectionDistance } = config.magnet;
    const { bodyWidth, bodyHeight } = COLLECTIBLE_FRAME.coin;
    const target = player.physicsBody.center;

    for (const coin of coins) {
      if (!coin.active || coin.isCollected) continue;
      const distance = reachableCoinDistance(
        coin.x, coin.y, target, radius, bodyWidth / 2, bodyHeight / 2, solids,
      );
      if (distance === null) continue;
      const step = magnetStep(distance, collectionDistance, attractionSpeed, delta);
      if (step > 0) {
        const fraction = step / distance;
        coin.moveByMagnet(
          coin.x + (target.x - coin.x) * fraction,
          coin.y + (target.y - coin.y) * fraction,
        );
      }
      if (distance - collectionDistance <= step) collection.collect(coin);
    }
  }
}

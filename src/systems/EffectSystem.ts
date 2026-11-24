import type Phaser from 'phaser';
import type { Collectible } from '../entities/Collectible';
import { COLLECTIBLE_FRAME } from '../entities/collectible-textures';
import type { Player } from '../entities/Player';
import type { EffectsConfig, EffectType } from '../types/effects';
import type { LevelGeometry, PixelRect, WorldPoint } from '../types/level-runtime';
import type { PlayerFormsConfig } from '../types/player-form';
import { PALETTE } from '../ui/theme';
import { ActiveEffects } from './ActiveEffects';
import type { CollectionSystem } from './CollectionSystem';
import { magnetStep, reachableCoinDistance } from './effect-rules';
import { bodyAtFeet, bigForm, hasGrowthRoom, SMALL_FORM, type PlayerFormMetrics } from './player-form-rules';
import { PlayerTransformation } from './PlayerTransformation';

const SHIELD_FLASH_MS = 220;

interface EffectSystemOptions {
  readonly scene: Phaser.Scene;
  readonly player: Player;
  readonly coins: readonly Collectible[];
  /** Live solid query: broken interactive blocks disappear from this result. */
  readonly getSolids: () => readonly PixelRect[];
  readonly collection: CollectionSystem;
  readonly config: EffectsConfig;
  readonly forms: PlayerFormsConfig;
  readonly world: Pick<LevelGeometry, 'worldWidth' | 'worldHeight'>;
  readonly intersectsEnemy: (body: PixelRect) => boolean;
}

/** Wires run-owned effect state to world visuals and coin collection. */
export class EffectSystem {
  readonly active: ActiveEffects;
  readonly transformation: PlayerTransformation;
  private readonly bigMetrics: PlayerFormMetrics;
  private readonly aura: Phaser.GameObjects.Ellipse;
  private readonly flash: Phaser.GameObjects.Ellipse;
  private flashRemainingMs = 0;
  private disposed = false;

  constructor(private readonly options: EffectSystemOptions) {
    this.active = new ActiveEffects(options.config, options.forms.growth.durationMs);
    this.transformation = new PlayerTransformation(this.active);
    this.bigMetrics = bigForm(options.forms.growth);
    this.aura = options.scene.add.ellipse(0, 0, 78, 104, PALETTE.waterLight, 0.23)
      .setStrokeStyle(3, PALETTE.waterLight).setDepth(10).setVisible(false);
    this.flash = options.scene.add.ellipse(0, 0, 96, 116, PALETTE.white, 0.28)
      .setStrokeStyle(6, PALETTE.white).setDepth(10).setVisible(false);
  }

  activate(type: EffectType): void {
    if (this.disposed) return;
    if (type === 'growth') {
      this.transformation.requestGrowth();
      return;
    }
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
    const previousForm = this.transformation.form;
    this.transformation.update(this.canGrowHere);
    if (previousForm !== this.transformation.form) {
      this.options.player.resizeForm(this.transformation.form === 'big' ? this.bigMetrics : SMALL_FORM);
    }
    if (pullTime > 0) this.attractCoins(pullTime);
    this.flashRemainingMs = Math.max(0, this.flashRemainingMs - delta);
    this.updateVisuals();
  }

  /** Use the spawn's clearance even when the player fell in big form. */
  prepareRespawn(spawn: WorldPoint): void {
    const previousForm = this.transformation.form;
    this.transformation.prepareRespawn(() => this.canGrowAt(spawn));
    if (previousForm !== this.transformation.form) this.options.player.resizeForm(SMALL_FORM);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.active.dispose();
    this.transformation.dispose();
    this.aura.destroy();
    this.flash.destroy();
  }

  private canGrowAt(feet: WorldPoint): boolean {
    const body = bodyAtFeet(feet, this.bigMetrics);
    return hasGrowthRoom(body, this.options.world, this.options.getSolids()) &&
      !this.options.intersectsEnemy(body);
  }

  private readonly canGrowHere = (): boolean => this.canGrowAt(this.options.player.feet);

  private updateVisuals(): void {
    const player = this.options.player;
    const body = player.physicsBody;
    const x = body.left + body.width / 2;
    const y = body.top + body.height / 2;
    this.aura.setPosition(x, y).setScale(player.scale).setVisible(this.active.isActive('shield'));
    this.flash.setPosition(x, y).setScale(player.scale).setVisible(this.flashRemainingMs > 0)
      .setAlpha(this.flashRemainingMs / SHIELD_FLASH_MS);
  }

  private attractCoins(delta: number): void {
    const { coins, collection, player, config } = this.options;
    const solids = this.options.getSolids();
    const { radius, attractionSpeed, collectionDistance } = config.magnet;
    const { bodyWidth, bodyHeight } = COLLECTIBLE_FRAME.coin;
    const body = player.physicsBody;
    const target = { x: body.left + body.width / 2, y: body.top + body.height / 2 };

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

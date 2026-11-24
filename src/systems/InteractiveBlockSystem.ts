import Phaser from 'phaser';
import { Collectible } from '../entities/Collectible';
import { InteractiveBlock } from '../entities/InteractiveBlock';
import { INTERACTIVE_BLOCK_TEXTURES } from '../entities/interactive-block-textures';
import type { Player } from '../entities/Player';
import type { InteractiveBlockRuntime } from '../factories/InteractiveBlockFactory';
import { createReleaseCollectible } from '../factories/CollectibleFactory';
import type { InteractiveBlocksConfig } from '../types/interactive-block';
import type { CollectiblePlacement } from '../types/collectible';
import type { PixelRect, RewardReleasePlan } from '../types/level-runtime';
import type { PlayerForm } from '../types/player-form';
import {
  isFormAllowedToBreak,
  isHeadBump,
  isPlayerPressedFromBelow,
  rewardRuntimeKey,
} from './block-rules';

export interface InteractiveBlockSystemOptions {
  readonly scene: Phaser.Scene;
  readonly player: Player;
  readonly runtime: InteractiveBlockRuntime;
  readonly config: InteractiveBlocksConfig;
  readonly collectibleGroup: Phaser.Physics.Arcade.Group;
  /** Mutable live-coin list owned by the collectible runtime. */
  readonly coins: Collectible[];
  readonly getPlayerForm: () => PlayerForm;
  /** True only while the scene is actively playing (not completing/game over). */
  readonly isInteractionActive: () => boolean;
  /**
   * Bomb rewards use BombSystem's existing pickup group/overlap rather than a
   * second inventory path. Returns the pickup sprite so the block can animate it.
   */
  readonly spawnBombReward: (x: number, y: number) => Phaser.Physics.Arcade.Sprite | null;
}

type ReleaseObject = Collectible | Phaser.Physics.Arcade.Sprite;

interface InFlightReward {
  readonly block: InteractiveBlock;
  readonly object: ReleaseObject;
  readonly kind: 'collectible' | 'bomb';
  readonly plan: RewardReleasePlan;
  /** Advanced by the scene's gameplay delta, not by tween callbacks. */
  elapsedMs: number;
}

/**
 * Orchestrates interactive-block rules and feedback.
 *
 * - Owns the player/block collider and the single-contact latch.
 * - Breaks bricks through `InteractiveBlock.markDestroyed()` (body disabled
 *   immediately, visual removal separately).
 * - Releases one reward per block through the existing `Collectible` and
 *   `CollectionSystem` path; never touches score or inventory directly.
 *
 * The system does not run block physics per frame; only latch release requires
 * an update and no level geometry is rebuilt.
 */
export class InteractiveBlockSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly blocks: InteractiveBlock[];
  private readonly config: InteractiveBlocksConfig;
  private readonly collectibleGroup: Phaser.Physics.Arcade.Group;
  private readonly coins: Collectible[];
  private readonly getPlayerForm: () => PlayerForm;
  private readonly isInteractionActive: () => boolean;
  private readonly spawnBombReward: (x: number, y: number) => Phaser.Physics.Arcade.Sprite | null;
  private readonly collider: Phaser.Physics.Arcade.Collider;
  private readonly inFlight = new Map<ReleaseObject, InFlightReward>();
  private readonly temporaryObjects = new Set<Phaser.GameObjects.GameObject>();
  private frozen = false;

  constructor(options: InteractiveBlockSystemOptions) {
    this.scene = options.scene;
    this.player = options.player;
    // A private mutable copy satisfies Arcade's collider array type. Broken
    // blocks stay in it with disabled bodies, so no array rebuild is needed.
    this.blocks = [...options.runtime.blocks];
    this.config = options.config;
    this.collectibleGroup = options.collectibleGroup;
    this.coins = options.coins;
    this.getPlayerForm = options.getPlayerForm;
    this.isInteractionActive = options.isInteractionActive;
    this.spawnBombReward = options.spawnBombReward;

    this.collider = options.scene.physics.add.collider(
      options.player,
      this.blocks,
      this.handleContact,
      undefined,
      this,
    );
  }

  /** Intact block rectangles for growth/magnet obstruction queries. */
  get solidRects(): PixelRect[] {
    return this.blocks.filter((block) => block.isSolid).map((block) => block.rect);
  }

  /**
   * Advances release paths and keeps latches only while the player is still
   * pressed against the underside. Using gameplay delta makes release settlement
   * deterministic and independent of tween completion.
   */
  update(deltaMs = 1000 / 60): void {
    if (this.frozen || !Number.isFinite(deltaMs) || deltaMs <= 0) {
      return;
    }

    const body = this.player.physicsBody;

    for (const block of this.blocks) {
      if (block.contactLatched && !isPlayerPressedFromBelow(block.rect, body)) {
        block.contactLatched = false;
      }
    }

    for (const reward of [...this.inFlight.values()]) {
      this.advanceReward(reward, deltaMs);
    }
  }

  /** Stops interaction and settles any in-flight reward safely. */
  freeze(): void {
    if (this.frozen) {
      return;
    }

    this.frozen = true;
    this.collider.active = false;

    for (const block of this.blocks) {
      block.contactLatched = false;
    }

    for (const reward of [...this.inFlight.values()]) {
      this.finishRelease(reward);
    }
  }

  destroy(): void {
    this.freeze();

    if (this.scene.physics.world) {
      this.collider.destroy();
    }

    for (const object of this.temporaryObjects) {
      this.scene.tweens?.killTweensOf(object);
      object.destroy();
    }
    this.temporaryObjects.clear();

    for (const block of this.blocks) {
      this.scene.tweens?.killTweensOf(block);
    }
  }

  private readonly handleContact: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (
    object1,
    object2,
  ): void => {
    if (this.frozen || !this.isInteractionActive()) {
      return;
    }

    const block = asInteractiveBlock(object1) ?? asInteractiveBlock(object2);

    if (block === null || !block.active || !block.isSolid) {
      return;
    }

    const body = this.player.physicsBody;

    if (
      !isHeadBump({
        block: block.rect,
        playerLeft: body.left,
        playerRight: body.right,
        playerTop: body.top,
        playerBottom: body.bottom,
        previousPlayerTop: body.prev.y,
        blockedUp: body.blocked.up,
        touchingUp: body.touching.up,
      })
    ) {
      return;
    }

    // One upward contact produces exactly one reaction, even if Arcade reports
    // the same block over consecutive frames while the jump is held.
    if (block.contactLatched) {
      return;
    }

    block.contactLatched = true;
    block.playBump(this.config);

    if (block.blockId === 'reward-block') {
      this.activateReward(block);
      return;
    }

    if (isFormAllowedToBreak(block.blockId, this.getPlayerForm(), this.config)) {
      this.breakBlock(block);
    }
  };

  private activateReward(block: InteractiveBlock): void {
    const rewardType = block.rewardType;
    const plan = block.release;

    if (rewardType === null || plan === null) {
      // LevelLoader rejects this before gameplay; never lose a reward silently.
      if (import.meta.env.DEV) {
        console.warn(`[InteractiveBlockSystem] Block "${block.placement.id}" has no valid reward release plan.`);
      }
      return;
    }

    // The state transition is the logical settlement guard. The animation and
    // the pickup body are separate from it, so repeated hits can never pay out
    // twice.
    if (!block.markActivating()) {
      return;
    }

    let object: ReleaseObject;
    let kind: InFlightReward['kind'];

    if (rewardType === 'bomb') {
      // BombSystem owns its pickup group, inventory cap and overlap. Reusing it
      // avoids a second inventory or a second bomb-on-collect rule.
      const pickup = this.spawnBombReward(plan.landing.x, plan.landing.y);

      if (pickup === null) {
        if (import.meta.env.DEV) {
          console.warn(`[InteractiveBlockSystem] Could not create a bomb reward for "${block.placement.id}".`);
        }
        return;
      }

      object = pickup;
      kind = 'bomb';
    } else {
      const placement: CollectiblePlacement = {
        key: rewardRuntimeKey(block.placement.id),
        type: rewardType,
        x: plan.landing.x,
        y: plan.landing.y,
      };

      object = createReleaseCollectible(this.scene, this.collectibleGroup, placement);
      kind = 'collectible';
    }

    // The authored bob tween would fight the scripted release path.
    this.scene.tweens.killTweensOf(object);
    this.disablePickupBody(object);
    object.setPosition(plan.emerge.x, plan.emerge.y);
    object.setScale(0.4);
    object.setAlpha(0.15);
    object.setDepth(7);

    this.inFlight.set(object, { block, object, kind, plan, elapsedMs: 0 });
  }

  /**
   * Scripted two-phase release: rise above the block, then settle into the
   * reachable landing cell. The body stays disabled until the full path ends.
   */
  private advanceReward(reward: InFlightReward, deltaMs: number): void {
    const emergeDuration = this.config.reward.emergeDurationMs;
    const settleDuration = this.config.reward.settleDurationMs;
    const total = emergeDuration + settleDuration;

    reward.elapsedMs += deltaMs;

    if (reward.elapsedMs >= total) {
      this.finishRelease(reward);
      return;
    }

    const { object, plan } = reward;

    if (!object.active) {
      this.finishRelease(reward);
      return;
    }

    if (reward.elapsedMs <= emergeDuration) {
      const t = emergeDuration === 0 ? 1 : reward.elapsedMs / emergeDuration;
      const eased = 1 - (1 - t) * (1 - t);
      object.setPosition(plan.emerge.x, plan.emerge.y - this.config.reward.risePx * eased);
      object.setScale(0.4 + 0.6 * eased);
      object.setAlpha(0.15 + 0.85 * eased);
      return;
    }

    const t = settleDuration === 0 ? 1 : (reward.elapsedMs - emergeDuration) / settleDuration;
    const eased = t * t;
    object.setPosition(
      plan.emerge.x + (plan.landing.x - plan.emerge.x) * eased,
      plan.emerge.y - this.config.reward.risePx + (plan.landing.y - (plan.emerge.y - this.config.reward.risePx)) * eased,
    );
    object.setScale(1);
    object.setAlpha(1);
  }

  private breakBlock(block: InteractiveBlock): void {
    if (!block.markDestroyed(this.config)) {
      return;
    }

    const centerX = block.rect.x + block.rect.width / 2;
    const centerY = block.rect.y + block.rect.height / 2;

    for (let index = 0; index < this.config.break.debrisPieces; index += 1) {
      const angle = (Math.PI * 2 * index) / this.config.break.debrisPieces + 0.35;
      const distance = 34 + (index % 3) * 12;
      const piece = this.scene.add
        .image(centerX, centerY, INTERACTIVE_BLOCK_TEXTURES.debris)
        .setDepth(7);

      this.temporaryObjects.add(piece);

      this.scene.tweens.add({
        targets: piece,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance - 24,
        angle: 140 + index * 45,
        alpha: 0,
        duration: this.config.break.debrisLifetimeMs,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.temporaryObjects.delete(piece);
          piece.destroy();
        },
      });
    }
  }

  /** Completes a release immediately (or after its animation) exactly once. */
  private finishRelease(reward: InFlightReward): void {
    if (!this.inFlight.delete(reward.object)) {
      return;
    }

    reward.block.markUsed();

    if (!reward.object.active) {
      return;
    }

    this.scene.tweens?.killTweensOf(reward.object);
    reward.object.setPosition(reward.plan.landing.x, reward.plan.landing.y);
    reward.object.setScale(1);
    reward.object.setAlpha(1);
    reward.object.setDepth(5);
    this.enablePickupBody(reward.object);

    if (
      reward.kind === 'collectible' &&
      reward.object instanceof Collectible &&
      reward.object.collectibleType === 'coin'
    ) {
      this.coins.push(reward.object);
    }
  }

  private disablePickupBody(object: ReleaseObject): void {
    const body = object.body;

    if (body instanceof Phaser.Physics.Arcade.Body) {
      body.enable = false;
    }
  }

  private enablePickupBody(object: ReleaseObject): void {
    const body = object.body;

    if (body instanceof Phaser.Physics.Arcade.Body) {
      body.enable = true;
      body.updateFromGameObject();
    }
  }

}

function asInteractiveBlock(value: unknown): InteractiveBlock | null {
  if (value instanceof InteractiveBlock) {
    return value;
  }

  if (
    value instanceof Phaser.Physics.Arcade.Body ||
    value instanceof Phaser.Physics.Arcade.StaticBody
  ) {
    return value.gameObject instanceof InteractiveBlock ? value.gameObject : null;
  }

  return null;
}

import type { PlayerForm } from './player-form';

/**
 * Interactive block contracts (Phaser-free).
 *
 * Two archetypes are implemented in Task 008-A:
 * - `breakable-brick`: solid, bumped by every form, broken only by a configured form.
 * - `reward-block`: solid, activates once from below and releases one configured pickup.
 *
 * Tuning lives in `content/config/interactive-blocks.json`; placements live in level JSON.
 */

export const INTERACTIVE_BLOCK_SCHEMA_VERSION = 1 as const;

export const INTERACTIVE_BLOCK_IDS = ['breakable-brick', 'reward-block'] as const;

export type InteractiveBlockId = (typeof INTERACTIVE_BLOCK_IDS)[number];

/**
 * Rewards reuse the existing collectible pipeline. `star` is intentionally not
 * supported here: a block must release one configured item, not a second rating
 * currency.
 */
export const BLOCK_REWARD_TYPES = [
  'coin',
  'bomb',
  'shield',
  'magnet',
  'growth-mushroom',
  'energy-flower',
] as const;

export type BlockRewardType = (typeof BLOCK_REWARD_TYPES)[number];

export interface BlockRewardSpec {
  readonly type: BlockRewardType;
}

/**
 * A single tile-sized interactive block authored in level JSON.
 *
 * `id` is required so a released reward can derive a stable runtime key that can
 * never collide with an authored collectible key. Coordinates are the top-left
 * tile of the block, like any other one-cell solid object.
 */
export interface LevelInteractiveBlockObject {
  readonly id: string;
  readonly type: 'interactive-block';
  readonly x: number;
  readonly y: number;
  readonly blockId: InteractiveBlockId;
  readonly reward?: BlockRewardSpec;
}

/** The three logical states of a reward block; bricks use `destroyed` as well. */
export type InteractiveBlockState = 'unused' | 'activating' | 'used' | 'destroyed';

export interface InteractiveBlocksConfig {
  readonly schemaVersion: typeof INTERACTIVE_BLOCK_SCHEMA_VERSION;
  readonly bump: {
    /** One-way duration of the visual bump; the tween yoyos. */
    readonly durationMs: number;
    /** Upward visual offset in px. The physical body never moves. */
    readonly offsetPx: number;
  };
  readonly break: {
    /** Break visual fade duration in ms. */
    readonly durationMs: number;
    /** Debris tween lifetime in ms. */
    readonly debrisLifetimeMs: number;
    /** Number of debris fragments per broken block. */
    readonly debrisPieces: number;
    /** Player forms allowed to destroy a breakable brick. */
    readonly forms: readonly PlayerForm[];
  };
  readonly reward: {
    /** Time the item spends emerging above the block. */
    readonly emergeDurationMs: number;
    /** Time the item spends settling into its reachable landing cell. */
    readonly settleDurationMs: number;
    /** Extra visual rise above the emergence cell. */
    readonly risePx: number;
  };
}

export function isInteractiveBlockId(value: string): value is InteractiveBlockId {
  return (INTERACTIVE_BLOCK_IDS as readonly string[]).includes(value);
}

export function isBlockRewardType(value: string): value is BlockRewardType {
  return (BLOCK_REWARD_TYPES as readonly string[]).includes(value);
}

export function isInteractiveBlockObject(value: {
  readonly type: string;
}): value is LevelInteractiveBlockObject {
  return value.type === 'interactive-block';
}

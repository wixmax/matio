import type { EffectType } from './effects';
import type { LevelObjectType } from './level';

/**
 * Collectible contracts (Phaser-free).
 *
 * Two star concepts must stay separate:
 * - `CollectibleType` `star`: a physical object placed in level JSON.
 * - Rating stars: a 1..3 performance result computed after completion
 *   (see `types/scoring.ts` as `LevelRating`).
 */

export const COLLECTIBLE_TYPES = ['coin', 'star'] as const;

export type CollectibleType = (typeof COLLECTIBLE_TYPES)[number];

export type CollectiblePickupType = CollectibleType | EffectType;

/**
 * A validated collectible converted to world pixels.
 *
 * `x`/`y` is the CENTER of the source tile cell:
 * `(tileX + 0.5) * tileSize`, `(tileY + 0.5) * tileSize`.
 */
export interface CollectiblePlacement {
  /** Stable deterministic identity inside one level run. */
  readonly key: string;
  readonly type: CollectiblePickupType;
  readonly x: number;
  readonly y: number;
}

export interface CollectibleCounts {
  readonly coins: number;
  readonly stars: number;
}

/** Available collectibles in a level (the denominator for run counters). */
export interface CollectibleTotals {
  readonly coins: number;
  readonly stars: number;
}

export function isCollectiblePickupType(type: LevelObjectType): type is CollectiblePickupType {
  return isCollectibleType(type) || type === 'shield' || type === 'magnet';
}

export function isCollectibleType(type: LevelObjectType): type is CollectibleType {
  return type === 'coin' || type === 'star';
}

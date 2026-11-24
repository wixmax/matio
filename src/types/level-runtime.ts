import type { GridPoint, TerrainType } from './level';
import type { BlockRewardType, InteractiveBlockId } from './interactive-block';
import type { CollectibleCounts, CollectiblePlacement } from './collectible';
import type { EnemyPlacement } from './enemy';
import type { ValidationError } from './validation';

/**
 * Runtime-facing level contracts.
 *
 * This module stays free of Phaser imports so geometry and repository logic can
 * be unit-tested in Node. Phaser-specific runtime references live in
 * `src/systems/LevelLoader.ts`.
 */

/** A bundled level file: repository-relative path plus raw JSON text. */
export interface LevelSource {
  readonly path: string;
  readonly raw: string;
}

export interface LevelSummary {
  readonly id: string;
  readonly name: string;
  readonly path: string;
}

/** Pixel-space rectangle with top-left origin semantics. */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

export interface TerrainPlacement {
  readonly type: TerrainType;
  /** Top-left pixel rectangle converted from the tile area. */
  readonly rect: PixelRect;
  /** `water` is currently non-solid; every other type is solid. */
  readonly solid: boolean;
}

/**
 * Deterministic visual release path for a reward block.
 *
 * The reward rises into the cell above the block, then settles into the first
 * open cell above solid ground in the same column. The landing cell is always
 * reachable from the surface below the block; no reward is left floating above
 * a solid block.
 */
export interface RewardReleasePlan {
  /** Center of the cell directly above the block. */
  readonly emerge: WorldPoint;
  readonly emergeCell: GridPoint;
  /** Center of the first open cell above solid terrain below the block. */
  readonly landing: WorldPoint;
  readonly landingCell: GridPoint;
}

/** A validated interactive-block placement converted to world pixels. */
export interface InteractiveBlockPlacement {
  /** Stable deterministic key: `block:<authored id>`. */
  readonly key: string;
  /** Authored id; also the base of the released reward's runtime key. */
  readonly id: string;
  readonly blockId: InteractiveBlockId;
  /** Top-left cell in tile units. */
  readonly cell: GridPoint;
  /** One tile-sized solid pixel rectangle. */
  readonly rect: PixelRect;
  /** Configured reward type, or null for a breakable brick. */
  readonly reward: BlockRewardType | null;
  /** Required release plan for reward blocks; null for breakable bricks. */
  readonly release: RewardReleasePlan | null;
}

export interface LevelGeometry {
  readonly levelId: string;
  readonly tileSize: number;
  readonly worldWidth: number;
  readonly worldHeight: number;
  /** Player feet anchor: bottom-center of the spawn cell. */
  readonly spawn: WorldPoint;
  /** Goal marker anchor: bottom-center of the goal cell. */
  readonly goal: WorldPoint;
  readonly terrain: readonly TerrainPlacement[];
  /** Coin/star and effect pickup objects converted to tile-center pixel positions. */
  readonly collectibles: readonly CollectiblePlacement[];
  readonly collectibleTotals: CollectibleCounts;
  /** Enemy objects converted to feet anchors and patrol pixel bounds. */
  readonly enemies: readonly EnemyPlacement[];
  /** Interactive block placements, kept separate from static level terrain. */
  readonly interactiveBlocks: readonly InteractiveBlockPlacement[];
}

/**
 * Camera bounds/framing derived from the level size.
 *
 * `width`/`height` are at least the viewport so a small level stays centered
 * instead of being pinned to the top-left with a huge empty area.
 */
export interface CameraFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly followsX: boolean;
  readonly followsY: boolean;
}


export type LevelFailureCode =
  | 'unknown-level'
  | 'invalid-level'
  | 'duplicate-id'
  | 'unsafe-spawn'
  | 'locked-level'
  | 'load-failed';

/** A user-facing level failure. Never exposed as a partially playable level. */
export interface LevelLoadFailure {
  readonly code: LevelFailureCode;
  readonly levelId: string;
  readonly message: string;
  readonly path?: string;
  readonly details?: readonly ValidationError[];
}

export type LevelRepositoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LevelLoadFailure };

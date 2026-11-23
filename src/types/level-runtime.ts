import type { LevelObjectType, TerrainType } from './level';
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

export interface IgnoredObjectSummary {
  readonly total: number;
  readonly byType: Partial<Record<LevelObjectType, number>>;
}

export type LevelFailureCode =
  | 'unknown-level'
  | 'invalid-level'
  | 'duplicate-id'
  | 'unsafe-spawn'
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

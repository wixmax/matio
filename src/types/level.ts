/**
 * Level content contract (schema version 1).
 *
 * Coordinate system (also documented in docs/LEVEL_FORMAT.md):
 * - All placement values are TILE units, never pixels.
 * - X increases to the right, Y increases downwards, origin is the top-left.
 * - `tileSize` converts tiles to pixels at runtime and defaults to 64.
 *
 * Runtime movement values (speeds, gravity, jump force) use pixels per second
 * and will live in gameplay configuration, never in level files.
 */

import type { LevelInteractiveBlockObject } from './interactive-block';

export const LEVEL_SCHEMA_VERSION = 1 as const;
export const DEFAULT_TILE_SIZE = 64 as const;

/** Hard guard against content mistakes (typos in size, corrupt exports). */
export const MAX_LEVEL_DIMENSION = 512;

export const TERRAIN_TYPES = ['ground', 'platform', 'block', 'water'] as const;
export const OBJECT_TYPES = [
  'coin',
  'star',
  'bomb',
  'shield',
  'magnet',
  'growth-mushroom',
  'energy-flower',
  'enemy',
  'interactive-block',
] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];
export type LevelObjectType = (typeof OBJECT_TYPES)[number];

/** Object types that are not enemy or interactive-block placements. */
export type LevelItemObjectType = Exclude<LevelObjectType, 'enemy' | 'interactive-block'>;

/** Integer tile coordinate. */
export interface GridPoint {
  x: number;
  y: number;
}

/** Level footprint in tiles. */
export interface LevelSize {
  width: number;
  height: number;
}

/**
 * Rectangular terrain area in tiles.
 * `x`/`y` is the top-left tile; `width`/`height` are measured in tiles and must
 * be at least 1, with the whole area inside the level bounds.
 */
export interface LevelTerrainArea {
  type: TerrainType;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Authored patrol bounds in tile columns, inclusive.
 * `minX <= maxX`; both must fit inside the level and contain the enemy cell.
 */
export interface LevelEnemyPatrolBounds {
  minX: number;
  maxX: number;
}

/**
 * A collectible or power-up placement. `id` is optional, but when
 * present it must be unique inside the level so systems can reference objects
 * (quests, save data) reliably.
 */
export interface LevelItemObject {
  id?: string;
  type: LevelItemObjectType;
  x: number;
  y: number;
}

/**
 * An enemy placement. `x`/`y` is the cell whose bottom-center is the enemy's
 * feet anchor; `enemyId` references `content/config/enemies.json`.
 */
export interface LevelEnemyObject {
  id?: string;
  type: 'enemy';
  x: number;
  y: number;
  enemyId: string;
  patrol: LevelEnemyPatrolBounds;
}

export type LevelObject = LevelItemObject | LevelEnemyObject | LevelInteractiveBlockObject;

export function isEnemyObject(object: LevelObject): object is LevelEnemyObject {
  return object.type === 'enemy';
}

/**
 * On-disk level file shape.
 * `tileSize` and `objects` may be omitted; the validator applies the defaults.
 */
export interface LevelFile {
  schemaVersion: number;
  id: string;
  name: string;
  tileSize?: number;
  size: LevelSize;
  theme?: string;
  spawn: GridPoint;
  goal: GridPoint;
  terrain: LevelTerrainArea[];
  objects?: LevelObject[];
}

/**
 * Normalized level returned by the validator: defaults applied and every
 * required field guaranteed to exist. Gameplay code should depend on this type,
 * not on `LevelFile`.
 */
export interface LevelDefinition {
  schemaVersion: typeof LEVEL_SCHEMA_VERSION;
  id: string;
  name: string;
  tileSize: number;
  size: LevelSize;
  theme?: string;
  spawn: GridPoint;
  goal: GridPoint;
  terrain: LevelTerrainArea[];
  objects: LevelObject[];
}

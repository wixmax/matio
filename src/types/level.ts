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

export const LEVEL_SCHEMA_VERSION = 1 as const;
export const DEFAULT_TILE_SIZE = 64 as const;

/** Hard guard against content mistakes (typos in size, corrupt exports). */
export const MAX_LEVEL_DIMENSION = 512;

export const TERRAIN_TYPES = ['ground', 'platform', 'block', 'water'] as const;
export const OBJECT_TYPES = ['coin', 'star', 'bomb', 'shield', 'magnet'] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];
export type LevelObjectType = (typeof OBJECT_TYPES)[number];

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
 * A placed object. `id` is optional, but when present it must be unique inside
 * the level so systems can reference objects (quests, save data) reliably.
 */
export interface LevelObject {
  id?: string;
  type: LevelObjectType;
  x: number;
  y: number;
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

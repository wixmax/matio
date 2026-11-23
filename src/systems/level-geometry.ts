import {
  type CollectibleCounts,
  type CollectiblePlacement,
  isCollectibleType,
} from '../types/collectible';
import type {
  GridPoint,
  LevelDefinition,
  LevelObjectType,
  LevelTerrainArea,
  TerrainType,
} from '../types/level';
import type {
  CameraFrame,
  IgnoredObjectSummary,
  LevelGeometry,
  PixelRect,
  TerrainPlacement,
  WorldPoint,
} from '../types/level-runtime';

/**
 * Pure tile-to-pixel planning for levels.
 *
 * Conventions (documented in docs/LEVEL_FORMAT.md):
 * - Terrain `x`/`y` is the top-left tile of the rectangle.
 * - Spawn and goal identify a cell; their world anchor is the bottom-center of
 *   that cell. For the player this is the feet position; for the goal it is the
 *   base of the marker.
 * - Collectibles identify a cell; their world anchor is the CENTER of that
 *   cell, so placeholder art sits visually inside the authored tile.
 * - All pixel values use the level's own `tileSize`.
 */

export const SOLID_TERRAIN_TYPES: readonly TerrainType[] = ['ground', 'platform', 'block'];

export function isSolidTerrainType(type: TerrainType): boolean {
  return SOLID_TERRAIN_TYPES.includes(type);
}

export function tileRectToPixel(area: LevelTerrainArea, tileSize: number): PixelRect {
  return {
    x: area.x * tileSize,
    y: area.y * tileSize,
    width: area.width * tileSize,
    height: area.height * tileSize,
  };
}

/** Converts a spawn/goal cell into its bottom-center world anchor. */
export function cellBottomCenter(point: GridPoint, tileSize: number): WorldPoint {
  return {
    x: point.x * tileSize + tileSize / 2,
    y: (point.y + 1) * tileSize,
  };
}

/**
 * Converts a collectible cell into its center.
 *
 * Task 004 decision: collectibles use the cell center, not the bottom-center
 * convention used by the player and goal marker.
 */
export function cellCenter(point: GridPoint, tileSize: number): WorldPoint {
  return {
    x: (point.x + 0.5) * tileSize,
    y: (point.y + 0.5) * tileSize,
  };
}

export function createLevelGeometry(level: LevelDefinition): LevelGeometry {
  const tileSize = level.tileSize;

  const terrain: TerrainPlacement[] = level.terrain.map((area) => ({
    type: area.type,
    rect: tileRectToPixel(area, tileSize),
    solid: isSolidTerrainType(area.type),
  }));

  const collectibles = createCollectiblePlacements(level);

  return {
    levelId: level.id,
    tileSize,
    worldWidth: level.size.width * tileSize,
    worldHeight: level.size.height * tileSize,
    spawn: cellBottomCenter(level.spawn, tileSize),
    goal: cellBottomCenter(level.goal, tileSize),
    terrain,
    collectibles,
    collectibleTotals: countCollectiblePlacements(collectibles),
  };
}

/**
 * Builds deterministic coin/star placements.
 *
 * The key is derived from the validated object index, not from an optional
 * content ID: it is stable for a given level file and cannot collide with
 * another object's generated key.
 */
export function createCollectiblePlacements(level: LevelDefinition): CollectiblePlacement[] {
  const placements: CollectiblePlacement[] = [];

  level.objects.forEach((object, index) => {
    if (!isCollectibleType(object.type)) {
      return;
    }

    const center = cellCenter({ x: object.x, y: object.y }, level.tileSize);

    placements.push({
      key: `${object.type}:${index}`,
      type: object.type,
      x: center.x,
      y: center.y,
    });
  });

  return placements;
}

function countCollectiblePlacements(
  placements: readonly CollectiblePlacement[],
): CollectibleCounts {
  let coins = 0;
  let stars = 0;

  for (const placement of placements) {
    if (placement.type === 'coin') {
      coins += 1;
    } else {
      stars += 1;
    }
  }

  return { coins, stars };
}

/**
 * Returns the first solid terrain area covering a cell, or null.
 * Used as a safety check for spawn cells; it is not a replacement for content
 * validation.
 */
export function findSolidTerrainAtCell(
  level: LevelDefinition,
  cell: GridPoint,
): LevelTerrainArea | null {
  for (const area of level.terrain) {
    if (!isSolidTerrainType(area.type)) {
      continue;
    }

    const insideX = cell.x >= area.x && cell.x < area.x + area.width;
    const insideY = cell.y >= area.y && cell.y < area.y + area.height;

    if (insideX && insideY) {
      return area;
    }
  }

  return null;
}

/**
 * Future object policy: bomb/shield/magnet remain valid content but have no
 * runtime behavior in Task 004. Coin/star are implemented and therefore not
 * reported here.
 */
export function summarizeUnimplementedObjects(level: LevelDefinition): IgnoredObjectSummary {
  const byType: Partial<Record<LevelObjectType, number>> = {};
  let total = 0;

  for (const object of level.objects) {
    if (isCollectibleType(object.type)) {
      continue;
    }

    byType[object.type] = (byType[object.type] ?? 0) + 1;
    total += 1;
  }

  return { total, byType };
}

/**
 * Camera framing rule:
 * - Large levels use exact world bounds.
 * - Axes smaller than the viewport are padded symmetrically so the level stays
 *   centered instead of being pinned to the top-left.
 */
export function computeCameraFrame(
  worldWidth: number,
  worldHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): CameraFrame {
  const width = Math.max(worldWidth, viewportWidth);
  const height = Math.max(worldHeight, viewportHeight);

  return {
    x: (worldWidth - width) / 2,
    y: (worldHeight - height) / 2,
    width,
    height,
    followsX: worldWidth > viewportWidth,
    followsY: worldHeight > viewportHeight,
  };
}

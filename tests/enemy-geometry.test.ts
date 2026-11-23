import { describe, expect, it } from 'vitest';
import {
  cellBottomCenter,
  createCollectiblePlacements,
  createEnemyPlacements,
  createLevelGeometry,
} from '../src/systems/level-geometry';
import type { LevelDefinition } from '../src/types/level';

function createLevel(): LevelDefinition {
  return {
    schemaVersion: 1,
    id: 'enemy-geometry',
    name: 'Enemy Geometry',
    tileSize: 64,
    size: { width: 12, height: 8 },
    spawn: { x: 1, y: 6 },
    goal: { x: 10, y: 6 },
    terrain: [{ type: 'ground', x: 0, y: 7, width: 12, height: 1 }],
    objects: [
      { type: 'coin', x: 3, y: 6 },
      {
        type: 'enemy',
        enemyId: 'mushroom',
        x: 5,
        y: 6,
        patrol: { minX: 4, maxX: 7 },
      },
      {
        id: 'snail-01',
        type: 'enemy',
        enemyId: 'snail',
        x: 9,
        y: 6,
        patrol: { minX: 8, maxX: 10 },
      },
    ],
  };
}

describe('enemy geometry - anchors and patrol bounds', () => {
  it('uses bottom-center feet anchors, matching spawn/goal', () => {
    expect(cellBottomCenter({ x: 5, y: 6 }, 64)).toEqual({ x: 352, y: 448 });

    const placements = createEnemyPlacements(createLevel());

    expect(placements[0]).toEqual({
      key: 'enemy:1',
      enemyId: 'mushroom',
      x: 352,
      y: 448,
      patrol: { left: 256, right: 512 },
    });
    expect(placements[1]?.key).toBe('enemy:2');
  });

  it('converts inclusive tile columns into body-edge pixel extents', () => {
    const placements = createEnemyPlacements(createLevel());

    expect(placements[0]?.patrol).toEqual({ left: 4 * 64, right: 8 * 64 });
    expect(placements[1]?.patrol).toEqual({ left: 8 * 64, right: 11 * 64 });
  });

  it('keeps enemy placements out of the collectible list', () => {
    const level = createLevel();
    const collectibles = createCollectiblePlacements(level);

    expect(collectibles).toEqual([{ key: 'coin:0', type: 'coin', x: 224, y: 416 }]);
  });

  it('exposes enemies on the geometry without changing scoring totals', () => {
    const geometry = createLevelGeometry(createLevel());

    expect(geometry.enemies).toHaveLength(2);
    expect(geometry.enemies[0]?.enemyId).toBe('mushroom');
    expect(geometry.collectibleTotals).toEqual({ coins: 1, stars: 0 });
  });

  it('produces deterministic keys and placements', () => {
    const level = createLevel();

    expect(createEnemyPlacements(level)).toEqual(createEnemyPlacements(level));
    expect(new Set(createEnemyPlacements(level).map((placement) => placement.key)).size).toBe(2);
  });

  it('returns no enemy placements for a zero-enemy level', () => {
    const level: LevelDefinition = {
      ...createLevel(),
      objects: [{ type: 'coin', x: 3, y: 6 }],
    };

    expect(createEnemyPlacements(level)).toEqual([]);
    expect(createLevelGeometry(level).enemies).toEqual([]);
  });
});

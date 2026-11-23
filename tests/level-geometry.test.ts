import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cellBottomCenter,
  cellCenter,
  computeCameraFrame,
  createCollectiblePlacements,
  createLevelGeometry,
  findSolidTerrainAtCell,
  isSolidTerrainType,
  tileRectToPixel,
} from '../src/systems/level-geometry';
import { parseLevelJson } from '../src/systems/level-validator';
import type { LevelDefinition } from '../src/types/level';

const LEVEL_01_PATH = fileURLToPath(
  new URL('../content/levels/world-01/level-01.json', import.meta.url),
);

function createTestLevel(): LevelDefinition {
  return {
    schemaVersion: 1,
    id: 'test-level-01',
    name: 'Test Level',
    tileSize: 64,
    size: { width: 10, height: 6 },
    theme: 'meadow',
    spawn: { x: 1, y: 4 },
    goal: { x: 8, y: 4 },
    terrain: [
      { type: 'ground', x: 0, y: 5, width: 10, height: 1 },
      { type: 'water', x: 3, y: 5, width: 2, height: 1 },
      { type: 'platform', x: 4, y: 2, width: 2, height: 1 },
      { type: 'block', x: 2, y: 4, width: 1, height: 1 },
    ],
    objects: [
      { type: 'coin', x: 3, y: 3 },
      { type: 'coin', x: 4, y: 3 },
      { id: 'star-01', type: 'star', x: 5, y: 2 },
    ],
  };
}

describe('level geometry - coordinates', () => {
  it('converts tile rectangles into top-left pixel rectangles', () => {
    expect(
      tileRectToPixel({ type: 'ground', x: 2, y: 3, width: 4, height: 2 }, 64),
    ).toEqual({ x: 128, y: 192, width: 256, height: 128 });
  });

  it('uses bottom-center of the cell for spawn and goal anchors', () => {
    expect(cellBottomCenter({ x: 2, y: 12 }, 64)).toEqual({ x: 160, y: 832 });
    expect(cellBottomCenter({ x: 0, y: 0 }, 32)).toEqual({ x: 16, y: 32 });
  });

  it('uses the cell center for collectible anchors', () => {
    expect(cellCenter({ x: 2, y: 12 }, 64)).toEqual({ x: 160, y: 800 });
    expect(cellCenter({ x: 0, y: 0 }, 32)).toEqual({ x: 16, y: 16 });
  });

  it('derives world dimensions, spawn, goal and rectangle sizes', () => {
    const geometry = createLevelGeometry(createTestLevel());

    expect(geometry.tileSize).toBe(64);
    expect(geometry.worldWidth).toBe(640);
    expect(geometry.worldHeight).toBe(384);
    expect(geometry.spawn).toEqual({ x: 96, y: 320 });
    expect(geometry.goal).toEqual({ x: 544, y: 320 });
    expect(geometry.terrain[0]).toEqual({
      type: 'ground',
      solid: true,
      rect: { x: 0, y: 320, width: 640, height: 64 },
    });
    expect(geometry.terrain[1]?.solid).toBe(false);
    expect(geometry.collectibleTotals).toEqual({ coins: 2, stars: 1 });
    expect(geometry.collectibles[0]).toEqual({
      key: 'coin:0',
      type: 'coin',
      x: 224,
      y: 224,
    });
  });

  it('aligns the shipped level 01 spawn with the top of its ground', () => {
    const json = readFileSync(LEVEL_01_PATH, 'utf8');
    const parsed = parseLevelJson(json);

    expect(parsed.ok).toBe(true);

    if (!parsed.ok) {
      throw new Error(JSON.stringify(parsed.errors));
    }

    const geometry = createLevelGeometry(parsed.value);
    const ground = geometry.terrain.find((placement) => placement.type === 'ground');

    expect(geometry.worldWidth).toBe(2560);
    expect(geometry.worldHeight).toBe(960);
    expect(geometry.spawn).toEqual({ x: 352, y: 832 });
    expect(geometry.goal).toEqual({ x: 2208, y: 832 });
    expect(ground?.rect.y).toBe(geometry.spawn.y);
  });
});

describe('level geometry - terrain classification', () => {
  it('treats ground, platform and block as solid and water as non-solid', () => {
    expect(isSolidTerrainType('ground')).toBe(true);
    expect(isSolidTerrainType('platform')).toBe(true);
    expect(isSolidTerrainType('block')).toBe(true);
    expect(isSolidTerrainType('water')).toBe(false);
  });

  it('detects a spawn cell inside solid terrain but ignores water', () => {
    const level = createTestLevel();

    expect(findSolidTerrainAtCell(level, level.spawn)).toBeNull();
    expect(findSolidTerrainAtCell(level, { x: 2, y: 4 })?.type).toBe('block');
    expect(findSolidTerrainAtCell(level, { x: 1, y: 5 })?.type).toBe('ground');

    const waterOnly: LevelDefinition = {
      ...level,
      terrain: [{ type: 'water', x: 3, y: 5, width: 2, height: 1 }],
    };

    expect(findSolidTerrainAtCell(waterOnly, { x: 3, y: 5 })).toBeNull();
  });

  it('includes shield and magnet pickups but leaves bomb creation to BombSystem', () => {
    const level = createTestLevel();
    const placements = createCollectiblePlacements({
      ...level,
      objects: [
        ...level.objects,
        { type: 'bomb', x: 6, y: 3 },
        { id: 'shield-01', type: 'shield', x: 7, y: 3 },
        { type: 'magnet', x: 8, y: 3 },
      ],
    });

    expect(placements.slice(-2)).toEqual([
      { key: 'shield:4', type: 'shield', x: 480, y: 224 },
      { key: 'magnet:5', type: 'magnet', x: 544, y: 224 },
    ]);
    expect(placements.map(({ type }) => type)).toEqual(['coin', 'coin', 'star', 'shield', 'magnet']);
  });

  it('builds deterministic placements for coins and stars only', () => {
    const level = createTestLevel();
    const placements = createCollectiblePlacements({
      ...level,
      objects: [...level.objects, { type: 'bomb', x: 6, y: 3 }],
    });

    expect(placements).toEqual([
      { key: 'coin:0', type: 'coin', x: 224, y: 224 },
      { key: 'coin:1', type: 'coin', x: 288, y: 224 },
      { key: 'star:2', type: 'star', x: 352, y: 160 },
    ]);
    expect(createCollectiblePlacements(level)).toEqual(placements);
  });
});

describe('camera framing', () => {
  it('uses exact bounds for a large world', () => {
    expect(computeCameraFrame(2560, 960, 1280, 720)).toEqual({
      x: 0,
      y: 0,
      width: 2560,
      height: 960,
      followsX: true,
      followsY: true,
    });
  });

  it('pads both axes to center a world smaller than the viewport', () => {
    expect(computeCameraFrame(800, 600, 1280, 720)).toEqual({
      x: -240,
      y: -60,
      width: 1280,
      height: 720,
      followsX: false,
      followsY: false,
    });
  });

  it('pads only the axis that is smaller than the viewport', () => {
    expect(computeCameraFrame(2000, 600, 1280, 720)).toEqual({
      x: 0,
      y: -60,
      width: 2000,
      height: 720,
      followsX: true,
      followsY: false,
    });
  });
});

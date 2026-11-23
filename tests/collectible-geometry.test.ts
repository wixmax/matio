import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  cellCenter,
  createCollectiblePlacements,
  createLevelGeometry,
  findSolidTerrainAtCell,
  summarizeUnimplementedObjects,
} from '../src/systems/level-geometry';
import { parseLevelJson } from '../src/systems/level-validator';
import type { LevelDefinition } from '../src/types/level';

const LEVELS_ROOT = fileURLToPath(new URL('../content/levels', import.meta.url));

function collectLevelPaths(directory: string): string[] {
  const paths: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...collectLevelPaths(path));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      paths.push(path);
    }
  }

  return paths;
}

function parseLevel(path: string): LevelDefinition {
  const parsed = parseLevelJson(readFileSync(path, 'utf8'));

  if (!parsed.ok) {
    throw new Error(`${path}: ${JSON.stringify(parsed.errors)}`);
  }

  return parsed.value;
}

function createTestLevel(): LevelDefinition {
  return {
    schemaVersion: 1,
    id: 'collectible-test',
    name: 'Collectible Test',
    tileSize: 64,
    size: { width: 10, height: 6 },
    spawn: { x: 1, y: 4 },
    goal: { x: 8, y: 4 },
    terrain: [
      { type: 'ground', x: 0, y: 5, width: 10, height: 1 },
      { type: 'platform', x: 4, y: 2, width: 2, height: 1 },
    ],
    objects: [
      { type: 'coin', x: 3, y: 3 },
      { type: 'star', x: 5, y: 2 },
      { type: 'bomb', x: 6, y: 3 },
      { id: 'shield-01', type: 'shield', x: 7, y: 3 },
    ],
  };
}

describe('collectible geometry - tile centers', () => {
  it('uses tile centers, not bottom-center anchors', () => {
    expect(cellCenter({ x: 2, y: 12 }, 64)).toEqual({ x: 160, y: 800 });
    expect(cellCenter({ x: 0, y: 0 }, 64)).toEqual({ x: 32, y: 32 });
    expect(cellCenter({ x: 3, y: 4 }, 32)).toEqual({ x: 112, y: 144 });
  });

  it('keeps stable deterministic keys derived from validated object indexes', () => {
    const level = createTestLevel();
    const placements = createCollectiblePlacements(level);

    expect(placements).toEqual([
      { key: 'coin:0', type: 'coin', x: 224, y: 224 },
      { key: 'star:1', type: 'star', x: 352, y: 160 },
    ]);
    expect(createCollectiblePlacements(level)).toEqual(placements);
    expect(new Set(placements.map((placement) => placement.key)).size).toBe(placements.length);
  });

  it('reports unimplemented object types separately from collectibles', () => {
    const summary = summarizeUnimplementedObjects(createTestLevel());

    expect(summary.total).toBe(2);
    expect(summary.byType).toEqual({ bomb: 1, shield: 1 });
  });

  it('computes collectible totals from validated placements', () => {
    const geometry = createLevelGeometry(createTestLevel());

    expect(geometry.collectibleTotals).toEqual({ coins: 1, stars: 1 });
  });
});

describe('collectible content - shipped levels', () => {
  const levelPaths = collectLevelPaths(LEVELS_ROOT);

  it('finds all three shipped levels', () => {
    expect(levelPaths.length).toBeGreaterThanOrEqual(3);
  });

  for (const path of levelPaths) {
    it(`${path.split(/[\\/]/).pop()} has reachable authoring coordinates`, () => {
      const level = parseLevel(path);
      const placements = createCollectiblePlacements(level);

      expect(placements.length).toBeGreaterThan(0);
      expect(level.objects.filter((object) => object.type === 'coin').length).toBeGreaterThan(0);
      expect(level.objects.filter((object) => object.type === 'star').length).toBeGreaterThan(0);

      for (const object of level.objects) {
        // No collectible (or future object) may be authored inside a solid tile.
        expect(findSolidTerrainAtCell(level, object)).toBeNull();
      }

      for (const placement of placements) {
        expect(placement.x).toBeGreaterThan(0);
        expect(placement.x).toBeLessThan(level.size.width * level.tileSize);
        expect(placement.y).toBeGreaterThan(0);
        expect(placement.y).toBeLessThan(level.size.height * level.tileSize);
      }
    });
  }

  it('derives level 01 collectible counts from its JSON objects', () => {
    const level = parseLevel(join(LEVELS_ROOT, 'world-01', 'level-01.json'));
    const geometry = createLevelGeometry(level);

    expect(geometry.collectibleTotals.coins).toBe(12);
    expect(geometry.collectibleTotals.stars).toBe(2);
    expect(geometry.collectibles[0]).toEqual({
      key: 'coin:0',
      type: 'coin',
      x: 6.5 * 64,
      y: 11.5 * 64,
    });
  });
});

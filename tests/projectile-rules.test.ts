import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import weaponConfig from '../content/config/weapons.json';
import {
  canFireEnergyBall,
  classifyProjectileTerrainContact,
  energyBallSpawn,
  isProjectileOutsideWorld,
  registerProjectileHit,
} from '../src/systems/projectile-rules';
import {
  cellCenter,
  createCollectiblePlacements,
  createLevelGeometry,
  findSolidTerrainAtCell,
} from '../src/systems/level-geometry';
import { parseLevelJson } from '../src/systems/level-validator';
import type { LevelDefinition } from '../src/types/level';

const ENERGY_BALL = weaponConfig.weapons['energy-ball'];
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

const levelPath = (name: string) => join(LEVELS_ROOT, 'world-01', name);

describe('energy ball spawn geometry', () => {
  const small = { x: 100, y: 200, width: 38, height: 84 };
  const big = { x: 96, y: 154, width: 46, height: 130 };

  it('spawns outside the small body in the facing direction at hand height', () => {
    expect(energyBallSpawn(small, 1)).toEqual({ x: 150, y: 200 + 84 * 0.42 });
    expect(energyBallSpawn(small, -1)).toEqual({ x: 88, y: 200 + 84 * 0.42 });
  });

  it('uses the current big body geometry without intersecting it', () => {
    const right = energyBallSpawn(big, 1);
    const left = energyBallSpawn(big, -1);

    expect(right.x - 10).toBeGreaterThan(big.x + big.width);
    expect(left.x + 10).toBeLessThan(big.x);
    expect(right.y).toBe(154 + 130 * 0.42);
  });
});

describe('firing eligibility', () => {
  it('requires an active ability', () => {
    expect(canFireEnergyBall(ENERGY_BALL, false, 0, 10_000)).toBe(false);
    expect(canFireEnergyBall(ENERGY_BALL, true, 0, 10_000)).toBe(true);
  });

  it('allows a shot exactly at the cooldown boundary and rejects earlier ones', () => {
    expect(canFireEnergyBall(ENERGY_BALL, true, 0, ENERGY_BALL.cooldownMs - 1)).toBe(false);
    expect(canFireEnergyBall(ENERGY_BALL, true, 0, ENERGY_BALL.cooldownMs)).toBe(true);
  });

  it('rejects a full projectile set', () => {
    expect(canFireEnergyBall(ENERGY_BALL, true, ENERGY_BALL.maxActiveProjectiles - 1, 500)).toBe(true);
    expect(canFireEnergyBall(ENERGY_BALL, true, ENERGY_BALL.maxActiveProjectiles, 500)).toBe(false);
  });
});

describe('terrain contact classification', () => {
  it('bounces from a floor or platform top', () => {
    expect(classifyProjectileTerrainContact({
      left: false, right: false, up: false, down: true,
    })).toBe('bounce');
  });

  it('destroys on both wall sides and on a ceiling', () => {
    expect(classifyProjectileTerrainContact({
      left: true, right: false, up: false, down: false,
    })).toBe('destroy');
    expect(classifyProjectileTerrainContact({
      left: false, right: true, up: false, down: false,
    })).toBe('destroy');
    expect(classifyProjectileTerrainContact({
      left: false, right: false, up: true, down: false,
    })).toBe('destroy');
  });

  it('prefers destruction for corner contacts and ignores unrelated frames', () => {
    expect(classifyProjectileTerrainContact({
      left: false, right: true, up: false, down: true,
    })).toBe('destroy');
    expect(classifyProjectileTerrainContact({
      left: false, right: false, up: false, down: false,
    })).toBe('none');
  });
});

describe('projectile target accounting', () => {
  it('accepts each enemy key once per projectile', () => {
    const targets = new Set<string>();

    expect(registerProjectileHit(targets, 'enemy:1', 2)).toBe(true);
    expect(registerProjectileHit(targets, 'enemy:1', 2)).toBe(false);
    expect(registerProjectileHit(targets, 'enemy:2', 2)).toBe(true);
    expect(targets.size).toBe(2);
  });

  it('never exceeds maxTargets', () => {
    const targets = new Set<string>();

    expect(registerProjectileHit(targets, 'enemy:1', 1)).toBe(true);
    expect(registerProjectileHit(targets, 'enemy:2', 1)).toBe(false);
  });
});

describe('out-of-world cleanup', () => {
  const world = { width: 1280, height: 720 };

  it('keeps in-bounds projectiles and removes escaped ones', () => {
    expect(isProjectileOutsideWorld(640, 360, world)).toBe(false);
    expect(isProjectileOutsideWorld(-97, 360, world)).toBe(true);
    expect(isProjectileOutsideWorld(1377, 360, world)).toBe(true);
    expect(isProjectileOutsideWorld(640, 817, world)).toBe(true);
  });
});

describe('energy-flower level content', () => {
  const expectedFlowers = new Map([
    ['level-01.json', 1],
    ['level-02.json', 2],
    ['level-03.json', 2],
  ]);

  for (const path of collectLevelPaths(LEVELS_ROOT)) {
    it(`${path.split(/[\\/]/).pop()} has no energy flower inside solid terrain`, () => {
      const level = parseLevel(path);
      const flowers = level.objects.filter((object) => object.type === 'energy-flower');

      expect(flowers.length).toBe(expectedFlowers.get(path.split(/[\\/]/).pop() ?? '') ?? 0);

      for (const flower of flowers) {
        expect(findSolidTerrainAtCell(level, flower)).toBeNull();
      }
    });
  }

  it('places flowers as centered, non-scoring collectible pickups', () => {
    const level = parseLevel(levelPath('level-02.json'));
    const geometry = createLevelGeometry(level);
    const flowers = createCollectiblePlacements(level).filter(({ type }) => type === 'energy-flower');

    expect(flowers).toEqual([
      { key: 'energy-flower:36', type: 'energy-flower', ...cellCenter({ x: 21, y: 14 }, 64) },
      { key: 'energy-flower:37', type: 'energy-flower', ...cellCenter({ x: 46, y: 14 }, 64) },
    ]);
    expect(geometry.collectibleTotals.coins).toBe(26);
    expect(geometry.collectibleTotals.stars).toBe(3);
  });

  it('keeps the existing campaign levels and achievement totals unchanged', () => {
    const levelOne = parseLevel(levelPath('level-01.json'));
    const levelThree = parseLevel(levelPath('level-03.json'));

    expect(levelOne.objects.filter(({ type }) => type === 'energy-flower')).toHaveLength(1);
    expect(levelThree.objects.filter(({ type }) => type === 'energy-flower')).toHaveLength(2);
    expect(createLevelGeometry(levelOne).collectibleTotals).toEqual({ coins: 12, stars: 2 });
    expect(createLevelGeometry(levelThree).collectibleTotals).toEqual({ coins: 29, stars: 4 });
  });
});

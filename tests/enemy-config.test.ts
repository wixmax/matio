import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  validateEnemiesConfig,
  validateEnemyPlacements,
} from '../src/systems/enemy-config-validator';
import { parseLevelJson } from '../src/systems/level-validator';
import type { EnemiesConfig, EnemyDefinition } from '../src/types/enemy';
import type { LevelDefinition } from '../src/types/level';
import type { ValidationError, ValidationResult } from '../src/types/validation';

const CONTENT_ROOT = fileURLToPath(new URL('../content', import.meta.url));
const LEVELS_ROOT = join(CONTENT_ROOT, 'levels');
const ENEMIES_CONFIG_PATH = join(CONTENT_ROOT, 'config', 'enemies.json');

function readEnemiesConfig(): EnemiesConfig {
  const result = validateEnemiesConfig(
    JSON.parse(readFileSync(ENEMIES_CONFIG_PATH, 'utf8')) as unknown,
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.errors));
  }

  return result.value;
}

function errorsOf<T>(result: ValidationResult<T>): ValidationError[] {
  if (result.ok) {
    throw new Error('Expected validation to fail, but it succeeded.');
  }

  return result.errors;
}

function pathsOf<T>(result: ValidationResult<T>): string[] {
  return errorsOf(result).map((error) => error.path);
}

function definition(overrides: Partial<EnemyDefinition> = {}): EnemyDefinition {
  return {
    health: 1,
    speed: 50,
    behavior: 'patrol',
    stompable: true,
    damage: 1,
    score: 100,
    ...overrides,
  };
}

function createLevel(): LevelDefinition {
  return {
    schemaVersion: 1,
    id: 'enemy-test',
    name: 'Enemy Test',
    tileSize: 64,
    size: { width: 20, height: 10 },
    spawn: { x: 1, y: 8 },
    goal: { x: 18, y: 8 },
    terrain: [{ type: 'ground', x: 0, y: 9, width: 20, height: 1 }],
    objects: [
      {
        type: 'enemy',
        enemyId: 'mushroom',
        x: 5,
        y: 8,
        patrol: { minX: 4, maxX: 7 },
      },
    ],
  };
}

function configWith(enemies: Record<string, EnemyDefinition>): EnemiesConfig {
  return { schemaVersion: 1, enemies };
}

describe('enemy configuration - shipped file', () => {
  it('validates content/config/enemies.json and exposes the three archetypes', () => {
    const config = readEnemiesConfig();

    expect(config.schemaVersion).toBe(1);
    expect(Object.keys(config.enemies).sort()).toEqual(['mushroom', 'snail', 'spiky']);
    expect(config.enemies.mushroom).toEqual({
      health: 1,
      speed: 55,
      behavior: 'patrol',
      stompable: true,
      damage: 1,
      score: 200,
    });
    expect(config.enemies.snail?.health).toBe(2);
    expect(config.enemies.snail?.score).toBe(350);
    expect(config.enemies.spiky?.stompable).toBe(false);
    expect(config.enemies.spiky?.score).toBe(0);
  });
});

describe('enemy configuration - validation errors', () => {
  it('rejects a non-object root and an unsupported schema version', () => {
    expect(validateEnemiesConfig(null).ok).toBe(false);
    expect(pathsOf(validateEnemiesConfig([]))).toEqual(['$']);

    const result = validateEnemiesConfig({ schemaVersion: 2, enemies: {} });
    expect(errorsOf(result)).toContainEqual({
      path: '$.schemaVersion',
      message: 'unsupported schema version 2; this build supports version 1.',
    });
  });

  it('rejects unknown behaviors and non-boolean stompable values', () => {
    const result = validateEnemiesConfig({
      schemaVersion: 1,
      enemies: {
        flyer: { ...definition(), behavior: 'fly' },
        blob: { ...definition(), stompable: 'yes' },
      },
    });
    const paths = pathsOf(result);

    expect(paths).toContain('$.enemies.flyer.behavior');
    expect(paths).toContain('$.enemies.blob.stompable');
  });

  it('rejects negative or zero health, speeds and scores', () => {
    const result = validateEnemiesConfig({
      schemaVersion: 1,
      enemies: {
        broken: {
          health: -1,
          speed: 0,
          behavior: 'patrol',
          stompable: true,
          damage: -2,
          score: -5,
        },
      },
    });
    const paths = pathsOf(result);

    expect(paths).toContain('$.enemies.broken.health');
    expect(paths).toContain('$.enemies.broken.speed');
    expect(paths).toContain('$.enemies.broken.damage');
    expect(paths).toContain('$.enemies.broken.score');
  });

  it('rejects non-integer health/damage/score and non-finite speed', () => {
    const result = validateEnemiesConfig({
      schemaVersion: 1,
      enemies: {
        broken: {
          health: 1.5,
          speed: Number.POSITIVE_INFINITY,
          behavior: 'patrol',
          stompable: true,
          damage: 0.5,
          score: 10.5,
        },
      },
    });
    const paths = pathsOf(result);

    expect(paths).toContain('$.enemies.broken.health');
    expect(paths).toContain('$.enemies.broken.speed');
    expect(paths).toContain('$.enemies.broken.damage');
    expect(paths).toContain('$.enemies.broken.score');
  });

  it('rejects malformed archetype ids and definitions', () => {
    const result = validateEnemiesConfig({
      schemaVersion: 1,
      enemies: {
        'Bad Id': definition(),
        missing: { health: 1 },
      },
    });
    const paths = pathsOf(result);

    expect(paths).toContain('$.enemies.Bad Id');
    expect(paths).toContain('$.enemies.missing.speed');
    expect(paths).toContain('$.enemies.missing.behavior');
    expect(paths).toContain('$.enemies.missing.stompable');
  });

  it('ignores unknown extra fields for forward compatibility', () => {
    const result = validateEnemiesConfig({
      schemaVersion: 1,
      enemies: { mushroom: { ...definition(), futureField: true } },
    });

    expect(result.ok).toBe(true);
  });
});

describe('enemy placement - registry and terrain safety', () => {
  const config = configWith({ mushroom: definition() });

  it('accepts an enemy in an empty cell above solid ground', () => {
    expect(validateEnemyPlacements(createLevel(), config)).toEqual([]);
  });

  it('rejects an unknown archetype reference', () => {
    const level = createLevel();
    const errors = validateEnemyPlacements(
      {
        ...level,
        objects: [{ ...level.objects[0], type: 'enemy', enemyId: 'ghost' }],
      } as LevelDefinition,
      config,
    );

    expect(errors.map((error) => error.path)).toContain('$.objects[0].enemyId');
  });

  it('rejects a cell inside solid terrain and a cell without ground below', () => {
    const level = createLevel();
    const insideSolid: LevelDefinition = {
      ...level,
      objects: [{ type: 'enemy', enemyId: 'mushroom', x: 5, y: 9, patrol: { minX: 5, maxX: 5 } }],
    };
    const floating: LevelDefinition = {
      ...level,
      objects: [{ type: 'enemy', enemyId: 'mushroom', x: 5, y: 6, patrol: { minX: 5, maxX: 5 } }],
    };

    expect(validateEnemyPlacements(insideSolid, config).map((error) => error.path)).toContain(
      '$.objects[0]',
    );
    expect(validateEnemyPlacements(floating, config).map((error) => error.path)).toContain(
      '$.objects[0]',
    );
  });

  it('rejects patrol bounds that exclude the enemy cell', () => {
    const level = createLevel();
    const errors = validateEnemyPlacements(
      {
        ...level,
        objects: [{ type: 'enemy', enemyId: 'mushroom', x: 5, y: 8, patrol: { minX: 6, maxX: 7 } }],
      },
      config,
    );

    expect(errors.map((error) => error.path)).toContain('$.objects[0].patrol');
  });
});

describe('enemy placement - shipped levels', () => {
  const config = readEnemiesConfig();

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

  const levelPaths = collectLevelPaths(LEVELS_ROOT);

  for (const path of levelPaths) {
    it(`${path.split(/[\\/]/).pop()} has valid enemy placements`, () => {
      const level = parseLevel(path);

      expect(validateEnemyPlacements(level, config)).toEqual([]);

      for (const object of level.objects) {
        if (object.type !== 'enemy') {
          continue;
        }

        expect(config.enemies[object.enemyId]).toBeDefined();
        expect(object.patrol.minX).toBeLessThanOrEqual(object.x);
        expect(object.patrol.maxX).toBeGreaterThanOrEqual(object.x);
      }
    });
  }

  it('ships the requested enemy counts and archetype mix', () => {
    const level01 = parseLevel(join(LEVELS_ROOT, 'world-01', 'level-01.json'));
    const level02 = parseLevel(join(LEVELS_ROOT, 'world-01', 'level-02.json'));
    const level03 = parseLevel(join(LEVELS_ROOT, 'world-01', 'level-03.json'));

    const ids = (level: LevelDefinition): string[] =>
      level.objects.filter((object) => object.type === 'enemy').map((object) => object.enemyId);

    expect(ids(level01).sort()).toEqual(['mushroom', 'mushroom', 'snail']);
    expect(ids(level02).filter((id) => id === 'mushroom')).toHaveLength(3);
    expect(ids(level02).filter((id) => id === 'snail')).toHaveLength(2);
    expect(ids(level02).filter((id) => id === 'spiky')).toHaveLength(1);
    expect(ids(level03)).toContain('mushroom');
    expect(ids(level03)).toContain('snail');
    expect(ids(level03)).toContain('spiky');
  });

  it('never places an enemy on the player spawn cell', () => {
    for (const path of levelPaths) {
      const level = parseLevel(path);
      const spawnEnemies = level.objects.filter(
        (object) =>
          object.type === 'enemy' && object.x === level.spawn.x && object.y === level.spawn.y,
      );

      expect(spawnEnemies).toEqual([]);
    }
  });
});

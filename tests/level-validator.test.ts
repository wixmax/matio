import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseLevelJson, validateLevel } from '../src/systems/level-validator';
import type { LevelFile } from '../src/types/level';
import type { ValidationError, ValidationResult } from '../src/types/validation';

const EXAMPLE_LEVEL_PATH = fileURLToPath(
  new URL('../content/levels/world-01/level-01.json', import.meta.url),
);

function createValidLevel(): LevelFile {
  return {
    schemaVersion: 1,
    id: 'test-level-01',
    name: 'Test Level',
    size: { width: 20, height: 10 },
    spawn: { x: 1, y: 8 },
    goal: { x: 18, y: 8 },
    terrain: [{ type: 'ground', x: 0, y: 9, width: 20, height: 1 }],
    objects: [{ type: 'coin', x: 3, y: 7 }],
  };
}

function errorsOf<T>(result: ValidationResult<T>): ValidationError[] {
  if (result.ok) {
    throw new Error('Expected validation to fail, but it succeeded.');
  }

  return result.errors;
}

function errorPaths<T>(result: ValidationResult<T>): string[] {
  return errorsOf(result).map((error) => error.path);
}

describe('validateLevel - valid content', () => {
  it('accepts the level shipped in content/levels', () => {
    const json = readFileSync(EXAMPLE_LEVEL_PATH, 'utf8');
    const result = parseLevelJson(json);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(`Example level failed validation: ${JSON.stringify(result.errors)}`);
    }

    expect(result.value.id).toBe('world-01-level-01');
    expect(result.value.name).toBe('Green Introduction');
    expect(result.value.schemaVersion).toBe(1);
    expect(result.value.tileSize).toBe(64);
    expect(result.value.size).toEqual({ width: 40, height: 15 });
    expect(result.value.terrain).toHaveLength(5);
    expect(result.value.objects.length).toBeGreaterThanOrEqual(5);
    expect(result.value.objects.some((object) => object.id === 'star-01')).toBe(true);
  });

  it('applies defaults for tileSize and objects', () => {
    const result = validateLevel(createValidLevel());

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(JSON.stringify(result.errors));
    }

    expect(result.value.tileSize).toBe(64);
    expect(result.value.objects).toEqual([{ type: 'coin', x: 3, y: 7 }]);
  });

  it('allows an empty terrain array and an empty object list', () => {
    const level = { ...createValidLevel(), terrain: [], objects: [] };
    const result = validateLevel(level);

    expect(result.ok).toBe(true);
  });

  it('ignores unknown fields for forward compatibility', () => {
    const level = { ...createValidLevel(), futureField: 'ignored' };
    const result = validateLevel(level);

    expect(result.ok).toBe(true);
  });
});

describe('validateLevel - invalid content', () => {
  it('rejects non-object roots', () => {
    for (const input of [null, [], 'level', 42]) {
      const result = validateLevel(input);

      expect(result.ok).toBe(false);
      expect(errorPaths(result)).toEqual(['$']);
    }
  });

  it('reports missing required fields', () => {
    const result = validateLevel({ size: { width: 20, height: 10 } });
    const paths = errorPaths(result);

    expect(paths).toContain('$.schemaVersion');
    expect(paths).toContain('$.id');
    expect(paths).toContain('$.name');
    expect(paths).toContain('$.spawn');
    expect(paths).toContain('$.goal');
    expect(paths).toContain('$.terrain');
  });

  it('rejects an unsupported schema version', () => {
    const result = validateLevel({ ...createValidLevel(), schemaVersion: 2 });
    const errors = errorsOf(result);

    expect(errors).toContainEqual({
      path: '$.schemaVersion',
      message: 'unsupported schema version 2; this build supports version 1.',
    });
  });

  it('rejects a non-kebab-case level id', () => {
    const result = validateLevel({ ...createValidLevel(), id: 'World 01 Level 01' });

    expect(errorPaths(result)).toContain('$.id');
  });

  it('rejects a non-integer spawn coordinate', () => {
    const level = { ...createValidLevel(), spawn: { x: 1.5, y: 8 } };
    const result = validateLevel(level);

    expect(errorPaths(result)).toContain('$.spawn.x');
  });

  it('rejects a spawn point outside the level bounds', () => {
    const level = { ...createValidLevel(), spawn: { x: 20, y: 10 } };
    const result = validateLevel(level);
    const paths = errorPaths(result);

    expect(paths).toContain('$.spawn.x');
    expect(paths).toContain('$.spawn.y');
  });

  it('rejects an unsupported terrain type', () => {
    const level = {
      ...createValidLevel(),
      terrain: [{ type: 'lava', x: 0, y: 9, width: 20, height: 1 }],
    };
    const result = validateLevel(level);
    const errors = errorsOf(result);

    expect(errorPaths(result)).toContain('$.terrain[0].type');
    expect(errors[0]?.message).toContain('must be one of: ground, platform, block, water');
  });

  it('rejects terrain that overflows the level bounds', () => {
    const level = {
      ...createValidLevel(),
      terrain: [{ type: 'ground', x: 15, y: 8, width: 10, height: 4 }],
    };
    const result = validateLevel(level);
    const paths = errorPaths(result);

    expect(paths).toContain('$.terrain[0].width');
    expect(paths).toContain('$.terrain[0].height');
  });

  it('rejects an object with an unknown type and non-integer coordinate', () => {
    const level = {
      ...createValidLevel(),
      objects: [{ type: 'gem', x: 2.5, y: 5 }],
    };
    const result = validateLevel(level);
    const paths = errorPaths(result);

    expect(paths).toContain('$.objects[0].type');
    expect(paths).toContain('$.objects[0].x');
  });

  it('rejects duplicate object ids', () => {
    const level = {
      ...createValidLevel(),
      objects: [
        { id: 'coin-a', type: 'coin', x: 2, y: 5 },
        { id: 'coin-a', type: 'coin', x: 3, y: 5 },
      ],
    };
    const result = validateLevel(level);
    const errors = errorsOf(result);

    expect(errors).toContainEqual({
      path: '$.objects[1].id',
      message: 'duplicate object id "coin-a"; it is already used by objects[0].',
    });
  });

  it('collects multiple independent errors in one pass', () => {
    const level = {
      schemaVersion: 1,
      id: 'Bad Id',
      name: '',
      size: { width: 0, height: 10 },
      spawn: { x: 0, y: 0 },
      goal: { x: 0, y: 0 },
      terrain: 'ground',
    };
    const result = validateLevel(level);
    const paths = errorPaths(result);

    expect(paths).toContain('$.id');
    expect(paths).toContain('$.name');
    expect(paths).toContain('$.size.width');
    expect(paths).toContain('$.terrain');
  });

  it('rejects malformed JSON with a parse error', () => {
    const result = parseLevelJson('{ "schemaVersion": 1, ');
    const errors = errorsOf(result);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toBe('$');
    expect(errors[0]?.message).toContain('is not valid JSON');
  });
});

describe('validateLevel - enemy objects', () => {
  function levelWithEnemy(enemy: Record<string, unknown>): LevelFile {
    return {
      ...createValidLevel(),
      objects: [{ type: 'enemy', x: 5, y: 7, enemyId: 'mushroom', patrol: { minX: 4, maxX: 7 }, ...enemy }],
    };
  }

  it('accepts an enemy object with ordered patrol bounds containing its cell', () => {
    const result = validateLevel(levelWithEnemy({}));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.objects[0]).toEqual({
        type: 'enemy',
        x: 5,
        y: 7,
        enemyId: 'mushroom',
        patrol: { minX: 4, maxX: 7 },
      });
    }
  });

  it('rejects a missing patrol object', () => {
    const level = levelWithEnemy({});
    const withoutPatrol = {
      ...level,
      objects: [{ type: 'enemy', x: 5, y: 7, enemyId: 'mushroom' }],
    };
    const result = validateLevel(withoutPatrol);

    expect(errorPaths(result)).toContain('$.objects[0].patrol');
  });

  it('rejects unordered patrol bounds', () => {
    const result = validateLevel(levelWithEnemy({ patrol: { minX: 7, maxX: 4 } }));

    expect(errorPaths(result)).toContain('$.objects[0].patrol.maxX');
  });

  it('rejects patrol bounds that exclude the enemy cell', () => {
    const result = validateLevel(levelWithEnemy({ patrol: { minX: 6, maxX: 7 } }));

    expect(errorPaths(result)).toContain('$.objects[0].patrol');
  });

  it('rejects patrol columns outside the level and non-integer coordinates', () => {
    const result = validateLevel(levelWithEnemy({ patrol: { minX: -1, maxX: 20.5 } }));
    const paths = errorPaths(result);

    expect(paths).toContain('$.objects[0].patrol.minX');
    expect(paths).toContain('$.objects[0].patrol.maxX');
  });

  it('rejects a missing or non-kebab-case enemyId', () => {
    expect(errorPaths(validateLevel(levelWithEnemy({ enemyId: undefined })))).toContain(
      '$.objects[0].enemyId',
    );
    expect(errorPaths(validateLevel(levelWithEnemy({ enemyId: 'Mushroom Enemy' })))).toContain(
      '$.objects[0].enemyId',
    );
  });

  it('rejects duplicate IDs shared by an enemy and a collectible', () => {
    const level: LevelFile = {
      ...createValidLevel(),
      objects: [
        { id: 'shared-id', type: 'coin', x: 3, y: 7 },
        {
          id: 'shared-id',
          type: 'enemy',
          x: 5,
          y: 7,
          enemyId: 'mushroom',
          patrol: { minX: 4, maxX: 7 },
        },
      ],
    };
    const result = validateLevel(level);

    expect(errorPaths(result)).toContain('$.objects[1].id');
  });
});

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validatePlayerConfig } from '../src/systems/player-config-validator';
import type { PlayerConfig } from '../src/types/player-config';
import type { ValidationError, ValidationResult } from '../src/types/validation';

const PLAYER_CONFIG_PATH = fileURLToPath(new URL('../content/config/player.json', import.meta.url));

function createValidConfig(): PlayerConfig {
  return {
    schemaVersion: 1,
    movement: {
      maxSpeed: 260,
      acceleration: 1800,
      deceleration: 2200,
      jumpVelocity: -600,
      gravity: 1600,
      maxFallSpeed: 900,
      coyoteTimeMs: 100,
      jumpBufferMs: 120,
      jumpCutMultiplier: 0.45,
    },
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

describe('validatePlayerConfig - valid content', () => {
  it('accepts the configuration shipped in content/config', () => {
    const json = readFileSync(PLAYER_CONFIG_PATH, 'utf8');
    const result = validatePlayerConfig(JSON.parse(json));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(JSON.stringify(result.errors));
    }

    expect(result.value.schemaVersion).toBe(1);
    expect(result.value.movement).toEqual(createValidConfig().movement);
  });

  it('accepts the documented boundary values', () => {
    const config = createValidConfig();
    config.movement.maxSpeed = 2000;
    config.movement.jumpVelocity = -3000;
    config.movement.coyoteTimeMs = 0;
    config.movement.jumpBufferMs = 0;
    config.movement.jumpCutMultiplier = 1;

    expect(validatePlayerConfig(config).ok).toBe(true);
  });

  it('ignores unknown fields for forward compatibility', () => {
    const config = { ...createValidConfig(), futureField: 'ignored' };

    expect(validatePlayerConfig(config).ok).toBe(true);
  });
});

describe('validatePlayerConfig - invalid content', () => {
  it('rejects non-object roots', () => {
    for (const input of [null, [], 'player', 42]) {
      const result = validatePlayerConfig(input);

      expect(result.ok).toBe(false);
      expect(errorPaths(result)).toEqual(['$']);
    }
  });

  it('reports missing required objects', () => {
    const result = validatePlayerConfig({});
    const paths = errorPaths(result);

    expect(paths).toContain('$.schemaVersion');
    expect(paths).toContain('$.movement');
  });

  it('rejects an unsupported schema version', () => {
    const config = { ...createValidConfig(), schemaVersion: 2 };
    const result = validatePlayerConfig(config);

    expect(errorsOf(result)).toContainEqual({
      path: '$.schemaVersion',
      message: 'unsupported schema version 2; this build supports version 1.',
    });
  });

  it('rejects non-finite numbers', () => {
    const config = createValidConfig();
    config.movement.acceleration = Number.NaN;
    config.movement.maxFallSpeed = Number.POSITIVE_INFINITY;
    const result = validatePlayerConfig(config);
    const paths = errorPaths(result);

    expect(paths).toContain('$.movement.acceleration');
    expect(paths).toContain('$.movement.maxFallSpeed');
  });

  it('enforces movement limits and signs', () => {
    const config = createValidConfig();
    config.movement.maxSpeed = 0;
    config.movement.jumpVelocity = 100;
    config.movement.gravity = 0;
    config.movement.coyoteTimeMs = -1;
    config.movement.jumpBufferMs = 1001;
    config.movement.jumpCutMultiplier = 1.5;

    const result = validatePlayerConfig(config);
    const paths = errorPaths(result);

    expect(paths).toContain('$.movement.maxSpeed');
    expect(paths).toContain('$.movement.jumpVelocity');
    expect(paths).toContain('$.movement.gravity');
    expect(paths).toContain('$.movement.coyoteTimeMs');
    expect(paths).toContain('$.movement.jumpBufferMs');
    expect(paths).toContain('$.movement.jumpCutMultiplier');
  });

  it('reports a missing movement value by path', () => {
    const config = createValidConfig();
    const movement: Record<string, number> = { ...config.movement };
    delete movement.deceleration;

    const result = validatePlayerConfig({ ...config, movement });
    const errors = errorsOf(result);

    expect(errors).toContainEqual({
      path: '$.movement.deceleration',
      message: 'is required.',
    });
  });

  it('collects multiple errors in one pass', () => {
    const result = validatePlayerConfig({
      schemaVersion: 1,
      movement: {
        maxSpeed: 'fast',
        acceleration: -1,
      },
    });
    const paths = errorPaths(result);

    expect(paths).toContain('$.movement.maxSpeed');
    expect(paths).toContain('$.movement.acceleration');
    expect(paths).toContain('$.movement.deceleration');
    expect(paths).toContain('$.movement.jumpVelocity');
  });
});

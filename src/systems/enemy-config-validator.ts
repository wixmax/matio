import { findSolidTerrainAtCell } from './level-geometry';
import {
  ENEMY_BEHAVIORS,
  ENEMY_CONFIG_SCHEMA_VERSION,
  type EnemiesConfig,
  type EnemyDefinition,
} from '../types/enemy';
import {
  isEnemyObject,
  type LevelDefinition,
  type LevelEnemyObject,
} from '../types/level';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Validation for `content/config/enemies.json` (schema version 1) plus the
 * level-side cross-check that an authored `enemyId` exists.
 *
 * Engine-free on purpose: balance configuration is validated at startup and in
 * unit tests without Phaser.
 */

type UnknownRecord = Record<string, unknown>;

const ARCHETYPE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_HEALTH = 999;
const MAX_SPEED = 2_000;
const MAX_DAMAGE = 999;
const MAX_SCORE = 1_000_000;

export function validateEnemiesConfig(input: unknown): ValidationResult<EnemiesConfig> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'must be a JSON object.' }] };
  }

  const errors: ValidationError[] = [];

  const schemaVersion = readInteger(input, 'schemaVersion', '$', errors, { min: 1 });
  if (schemaVersion !== undefined && schemaVersion !== ENEMY_CONFIG_SCHEMA_VERSION) {
    errors.push({
      path: '$.schemaVersion',
      message: `unsupported schema version ${schemaVersion}; this build supports version ${ENEMY_CONFIG_SCHEMA_VERSION}.`,
    });
  }

  const enemies = readEnemies(input.enemies, '$.enemies', errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      schemaVersion: ENEMY_CONFIG_SCHEMA_VERSION,
      enemies: enemies ?? {},
    },
  };
}

/**
 * Cross-references enemy placements against the validated archetype registry
 * and safe terrain. Called by LevelLoader before any enemy instance is built.
 */
export function validateEnemyPlacements(
  level: LevelDefinition,
  config: EnemiesConfig,
): ValidationError[] {
  const errors: ValidationError[] = [];

  level.objects.forEach((object, index) => {
    if (!isEnemyObject(object)) {
      return;
    }

    const path = `$.objects[${index}]`;
    validatePlacement(object, path, level, config, errors);
  });

  return errors;
}

function validatePlacement(
  object: LevelEnemyObject,
  path: string,
  level: LevelDefinition,
  config: EnemiesConfig,
  errors: ValidationError[],
): void {
  if (!Object.prototype.hasOwnProperty.call(config.enemies, object.enemyId)) {
    errors.push({
      path: `${path}.enemyId`,
      message: `unknown enemy archetype "${object.enemyId}"; add it to content/config/enemies.json.`,
    });
  }

  if (object.patrol.minX > object.x || object.patrol.maxX < object.x) {
    errors.push({
      path: `${path}.patrol`,
      message: `patrol bounds must contain the enemy cell x=${object.x} (received ${object.patrol.minX}..${object.patrol.maxX}).`,
    });
  }

  if (findSolidTerrainAtCell(level, object) !== null) {
    errors.push({
      path,
      message: `enemy cell (${object.x}, ${object.y}) overlaps solid terrain; place it in an empty cell above a solid surface.`,
    });
    return;
  }

  const below = findSolidTerrainAtCell(level, { x: object.x, y: object.y + 1 });
  if (below === null) {
    errors.push({
      path,
      message: `enemy cell (${object.x}, ${object.y}) has no solid terrain directly below; patrol edges would fall.`,
    });
  }
}

function readEnemies(
  value: unknown,
  path: string,
  errors: ValidationError[],
): Readonly<Record<string, EnemyDefinition>> | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'is required and must be an object of archetype definitions.' });
    return undefined;
  }

  const enemies: Record<string, EnemyDefinition> = {};

  for (const [archetypeId, rawDefinition] of Object.entries(value)) {
    const entryPath = `${path}.${archetypeId}`;

    if (!ARCHETYPE_ID_PATTERN.test(archetypeId)) {
      errors.push({
        path: entryPath,
        message: 'archetype IDs must be lowercase kebab-case (for example "mushroom" or "armored-beetle").',
      });
    }

    if (!isRecord(rawDefinition)) {
      errors.push({ path: entryPath, message: 'must be an enemy definition object.' });
      continue;
    }

    const definition = readDefinition(rawDefinition, entryPath, errors);
    if (definition !== undefined) {
      enemies[archetypeId] = definition;
    }
  }

  return enemies;
}

function readDefinition(
  input: UnknownRecord,
  path: string,
  errors: ValidationError[],
): EnemyDefinition | undefined {
  const health = readInteger(input, 'health', path, errors, { min: 1, max: MAX_HEALTH });
  const speed = readNumber(input, 'speed', path, errors, { minExclusive: 0, max: MAX_SPEED });
  const behavior = readEnum(input, 'behavior', path, ENEMY_BEHAVIORS, errors);
  const stompable = readBoolean(input, 'stompable', path, errors);
  const damage = readInteger(input, 'damage', path, errors, { min: 0, max: MAX_DAMAGE });
  const score = readInteger(input, 'score', path, errors, { min: 0, max: MAX_SCORE });

  if (
    health === undefined ||
    speed === undefined ||
    behavior === undefined ||
    stompable === undefined ||
    damage === undefined ||
    score === undefined
  ) {
    return undefined;
  }

  return { health, speed, behavior, stompable, damage, score };
}

function readInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
  rules: { min?: number; max?: number } = {},
): number | undefined {
  const fieldPath = `${path}.${key}`;
  const value = record[key];

  if (value === undefined) {
    errors.push({ path: fieldPath, message: 'is required.' });
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    errors.push({
      path: fieldPath,
      message: `must be an integer (received ${describeValue(value)}).`,
    });
    return undefined;
  }

  if (rules.min !== undefined && value < rules.min) {
    errors.push({
      path: fieldPath,
      message: `must be greater than or equal to ${rules.min} (received ${value}).`,
    });
    return undefined;
  }

  if (rules.max !== undefined && value > rules.max) {
    errors.push({
      path: fieldPath,
      message: `must be less than or equal to ${rules.max} (received ${value}).`,
    });
    return undefined;
  }

  return value;
}

function readNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
  rules: { minExclusive?: number; max?: number } = {},
): number | undefined {
  const fieldPath = `${path}.${key}`;
  const value = record[key];

  if (value === undefined) {
    errors.push({ path: fieldPath, message: 'is required.' });
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({
      path: fieldPath,
      message: `must be a finite number (received ${describeValue(value)}).`,
    });
    return undefined;
  }

  if (rules.minExclusive !== undefined && value <= rules.minExclusive) {
    errors.push({
      path: fieldPath,
      message: `must be greater than ${rules.minExclusive} (received ${value}).`,
    });
    return undefined;
  }

  if (rules.max !== undefined && value > rules.max) {
    errors.push({
      path: fieldPath,
      message: `must be less than or equal to ${rules.max} (received ${value}).`,
    });
    return undefined;
  }

  return value;
}

function readBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
): boolean | undefined {
  const fieldPath = `${path}.${key}`;
  const value = record[key];

  if (value === undefined) {
    errors.push({ path: fieldPath, message: 'is required.' });
    return undefined;
  }

  if (typeof value !== 'boolean') {
    errors.push({
      path: fieldPath,
      message: `must be a boolean (received ${describeValue(value)}).`,
    });
    return undefined;
  }

  return value;
}

function readEnum<T extends string>(
  record: UnknownRecord,
  key: string,
  path: string,
  allowed: readonly T[],
  errors: ValidationError[],
): T | undefined {
  const fieldPath = `${path}.${key}`;
  const value = record[key];

  if (value === undefined) {
    errors.push({ path: fieldPath, message: 'is required.' });
    return undefined;
  }

  if (typeof value !== 'string' || !allowed.some((entry) => entry === value)) {
    errors.push({
      path: fieldPath,
      message: `must be one of: ${allowed.join(', ')} (received ${describeValue(value)}).`,
    });
    return undefined;
  }

  return value as T;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'an array';
  }

  switch (typeof value) {
    case 'string':
      return `"${value}"`;
    case 'number':
    case 'boolean':
      return String(value);
    case 'object':
      return 'an object';
    case 'undefined':
      return 'undefined';
    default:
      return typeof value;
  }
}

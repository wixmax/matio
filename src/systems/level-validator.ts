import {
  DEFAULT_TILE_SIZE,
  LEVEL_SCHEMA_VERSION,
  MAX_LEVEL_DIMENSION,
  OBJECT_TYPES,
  TERRAIN_TYPES,
  type GridPoint,
  type LevelDefinition,
  type LevelEnemyPatrolBounds,
  type LevelObject,
  type LevelSize,
  type LevelTerrainArea,
} from '../types/level';
import {
  BLOCK_REWARD_TYPES,
  INTERACTIVE_BLOCK_IDS,
  isBlockRewardType,
  type BlockRewardSpec,
  type LevelInteractiveBlockObject,
} from '../types/interactive-block';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Structural + semantic validation for level JSON (schema version 1).
 *
 * This module is engine-free on purpose: it can run in unit tests, in a future
 * level editor, or in a build-time content check without booting Phaser.
 *
 * Design choices:
 * - All errors are collected, so content authors fix a batch at a time.
 * - Unknown extra fields are ignored for forward compatibility; breaking shape
 *   changes require a new `schemaVersion`.
 * - Values are normalized (defaults applied) only when no errors exist.
 */

const LEVEL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENEMY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type UnknownRecord = Record<string, unknown>;

interface IntegerRules {
  min?: number;
  max?: number;
}

interface StringRules {
  pattern?: RegExp;
  patternHint?: string;
}

export function validateLevel(input: unknown): ValidationResult<LevelDefinition> {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ path: '$', message: `must be a JSON object (received ${describeValue(input)}).` }],
    };
  }

  const errors: ValidationError[] = [];

  const schemaVersion = readInteger(input, 'schemaVersion', '$', errors, { min: 1 });
  if (schemaVersion !== undefined && schemaVersion !== LEVEL_SCHEMA_VERSION) {
    errors.push({
      path: '$.schemaVersion',
      message: `unsupported schema version ${schemaVersion}; this build supports version ${LEVEL_SCHEMA_VERSION}.`,
    });
  }

  const id = readString(input, 'id', '$', errors, {
    pattern: LEVEL_ID_PATTERN,
    patternHint: 'lowercase kebab-case (for example "world-01-level-01")',
  });

  const name = readString(input, 'name', '$', errors);

  const tileSize =
    readOptionalInteger(input, 'tileSize', '$', errors, { min: 1, max: 256 }) ?? DEFAULT_TILE_SIZE;

  const size = readSize(input.size, '$.size', errors);

  const spawn = readPoint(input.spawn, '$.spawn', size, errors);
  const goal = readPoint(input.goal, '$.goal', size, errors);

  const terrain = readTerrain(input.terrain, '$.terrain', size, errors);
  const objects = readObjects(input.objects, '$.objects', size, errors);

  const theme = readOptionalString(input, 'theme', '$', errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Fallbacks below are unreachable: this object is only exposed when
  // `errors` is empty, which means every required field passed validation.
  return {
    ok: true,
    value: {
      schemaVersion: LEVEL_SCHEMA_VERSION,
      id: id ?? '',
      name: name ?? '',
      tileSize,
      size: size ?? { width: 0, height: 0 },
      ...(theme === undefined ? {} : { theme }),
      spawn: spawn ?? { x: 0, y: 0 },
      goal: goal ?? { x: 0, y: 0 },
      terrain: terrain ?? [],
      objects: objects ?? [],
    },
  };
}

/** Parses raw JSON text and validates it. JSON syntax errors become validation errors. */
export function parseLevelJson(text: string): ValidationResult<LevelDefinition> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return {
      ok: false,
      errors: [{ path: '$', message: `is not valid JSON: ${reason}` }],
    };
  }

  return validateLevel(parsed);
}

function readSize(value: unknown, path: string, errors: ValidationError[]): LevelSize | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'is required and must be an object with width and height.' });
    return undefined;
  }

  const width = readInteger(value, 'width', path, errors, { min: 1, max: MAX_LEVEL_DIMENSION });
  const height = readInteger(value, 'height', path, errors, { min: 1, max: MAX_LEVEL_DIMENSION });

  if (width === undefined || height === undefined) {
    return undefined;
  }

  return { width, height };
}

function readPoint(
  value: unknown,
  path: string,
  size: LevelSize | undefined,
  errors: ValidationError[],
): GridPoint | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'is required and must be an object with x and y.' });
    return undefined;
  }

  const x = readInteger(value, 'x', path, errors, { min: 0 });
  const y = readInteger(value, 'y', path, errors, { min: 0 });

  if (size !== undefined) {
    if (x !== undefined && x >= size.width) {
      errors.push({
        path: `${path}.x`,
        message: `must be inside the level (0 <= x < ${size.width}); received ${x}.`,
      });
    }

    if (y !== undefined && y >= size.height) {
      errors.push({
        path: `${path}.y`,
        message: `must be inside the level (0 <= y < ${size.height}); received ${y}.`,
      });
    }
  }

  if (x === undefined || y === undefined) {
    return undefined;
  }

  return { x, y };
}

function readTerrain(
  value: unknown,
  path: string,
  size: LevelSize | undefined,
  errors: ValidationError[],
): LevelTerrainArea[] | undefined {
  if (value === undefined) {
    errors.push({ path, message: 'is required and must be an array of terrain areas.' });
    return undefined;
  }

  if (!Array.isArray(value)) {
    errors.push({ path, message: `must be an array (received ${describeValue(value)}).` });
    return [];
  }

  const areas: LevelTerrainArea[] = [];

  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;

    if (!isRecord(entry)) {
      errors.push({ path: entryPath, message: 'must be a terrain area object.' });
      return;
    }

    const type = readEnum(entry, 'type', entryPath, TERRAIN_TYPES, errors);
    const x = readInteger(entry, 'x', entryPath, errors, { min: 0 });
    const y = readInteger(entry, 'y', entryPath, errors, { min: 0 });
    const width = readInteger(entry, 'width', entryPath, errors, { min: 1 });
    const height = readInteger(entry, 'height', entryPath, errors, { min: 1 });

    if (size !== undefined && x !== undefined && width !== undefined && x + width > size.width) {
      errors.push({
        path: `${entryPath}.width`,
        message: `terrain area exceeds the level width (x + width must be <= ${size.width}); received ${x} + ${width}.`,
      });
    }

    if (size !== undefined && y !== undefined && height !== undefined && y + height > size.height) {
      errors.push({
        path: `${entryPath}.height`,
        message: `terrain area exceeds the level height (y + height must be <= ${size.height}); received ${y} + ${height}.`,
      });
    }

    if (type === undefined || x === undefined || y === undefined || width === undefined || height === undefined) {
      return;
    }

    areas.push({ type, x, y, width, height });
  });

  return areas;
}

function readObjects(
  value: unknown,
  path: string,
  size: LevelSize | undefined,
  errors: ValidationError[],
): LevelObject[] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push({ path, message: `must be an array (received ${describeValue(value)}).` });
    return [];
  }

  const objects: LevelObject[] = [];
  const firstIndexById = new Map<string, number>();

  value.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;

    if (!isRecord(entry)) {
      errors.push({ path: entryPath, message: 'must be an object.' });
      return;
    }

    const type = readEnum(entry, 'type', entryPath, OBJECT_TYPES, errors);
    const x = readInteger(entry, 'x', entryPath, errors, { min: 0 });
    const y = readInteger(entry, 'y', entryPath, errors, { min: 0 });
    const id = readOptionalString(entry, 'id', entryPath, errors);

    if (size !== undefined) {
      if (x !== undefined && x >= size.width) {
        errors.push({
          path: `${entryPath}.x`,
          message: `must be inside the level (0 <= x < ${size.width}); received ${x}.`,
        });
      }

      if (y !== undefined && y >= size.height) {
        errors.push({
          path: `${entryPath}.y`,
          message: `must be inside the level (0 <= y < ${size.height}); received ${y}.`,
        });
      }
    }

    if (id !== undefined) {
      const previousIndex = firstIndexById.get(id);

      if (previousIndex !== undefined) {
        errors.push({
          path: `${entryPath}.id`,
          message: `duplicate object id "${id}"; it is already used by objects[${previousIndex}].`,
        });
      } else {
        firstIndexById.set(id, index);
      }
    }

    if (type === undefined || x === undefined || y === undefined) {
      return;
    }

    if (type === 'enemy') {
      const enemyId = readString(entry, 'enemyId', entryPath, errors, {
        pattern: ENEMY_ID_PATTERN,
        patternHint: 'a lowercase kebab-case archetype id from content/config/enemies.json',
      });
      const patrol = readEnemyPatrol(entry.patrol, `${entryPath}.patrol`, x, size, errors);

      if (enemyId === undefined || patrol === undefined) {
        return;
      }

      objects.push(
        id === undefined
          ? { type, x, y, enemyId, patrol }
          : { id, type, x, y, enemyId, patrol },
      );
      return;
    }

    if (type === 'interactive-block') {
      const block = readInteractiveBlock(entry, entryPath, id, x, y, errors);

      if (block !== undefined) {
        objects.push(block);
      }
      return;
    }

    objects.push(id === undefined ? { type, x, y } : { id, type, x, y });
  });

  return objects;
}

/**
 * Interactive blocks require an explicit id because it is also the basis of the
 * released reward's stable runtime key. Breakable bricks cannot declare a
 * reward; reward blocks must declare exactly one supported reward type.
 */
function readInteractiveBlock(
  entry: UnknownRecord,
  path: string,
  id: string | undefined,
  x: number,
  y: number,
  errors: ValidationError[],
): LevelInteractiveBlockObject | undefined {
  const blockId = readEnum(entry, 'blockId', path, INTERACTIVE_BLOCK_IDS, errors);

  if (id === undefined) {
    errors.push({ path: `${path}.id`, message: 'is required for an interactive-block object.' });
  }

  let reward: BlockRewardSpec | undefined;

  if (blockId === 'breakable-brick') {
    if (entry.reward !== undefined) {
      errors.push({
        path: `${path}.reward`,
        message: 'is not supported on a breakable-brick; use a reward-block instead.',
      });
    }
  } else if (blockId === 'reward-block') {
    reward = readBlockReward(entry.reward, `${path}.reward`, errors);
  }

  if (id === undefined || blockId === undefined) {
    return undefined;
  }

  if (blockId === 'reward-block' && reward === undefined) {
    return undefined;
  }

  return reward === undefined
    ? { id, type: 'interactive-block', x, y, blockId }
    : { id, type: 'interactive-block', x, y, blockId, reward };
}

function readBlockReward(
  value: unknown,
  path: string,
  errors: ValidationError[],
): BlockRewardSpec | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'is required for a reward-block and must be an object with a type.' });
    return undefined;
  }

  const typeValue = value.type;

  if (typeof typeValue !== 'string' || !isBlockRewardType(typeValue)) {
    errors.push({
      path: `${path}.type`,
      message: `must be one of: ${BLOCK_REWARD_TYPES.join(', ')} (received ${describeValue(typeValue)}).`,
    });
    return undefined;
  }

  return { type: typeValue };
}

/**
 * Enemy patrol bounds are inclusive tile columns. They must be ordered, inside
 * the level and contain the enemy's own column so JSON cannot describe an
 * unreachable/contradictory patrol.
 */
function readEnemyPatrol(
  value: unknown,
  path: string,
  enemyX: number,
  size: LevelSize | undefined,
  errors: ValidationError[],
): LevelEnemyPatrolBounds | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'is required and must be an object with minX and maxX.' });
    return undefined;
  }

  const maxColumn = size === undefined ? undefined : size.width - 1;
  const minX = readInteger(value, 'minX', path, errors, { min: 0, max: maxColumn });
  const maxX = readInteger(value, 'maxX', path, errors, { min: 0, max: maxColumn });

  if (minX === undefined || maxX === undefined) {
    return undefined;
  }

  if (minX > maxX) {
    errors.push({
      path: `${path}.maxX`,
      message: `must be greater than or equal to patrol.minX (${minX}); received ${maxX}.`,
    });
    return undefined;
  }

  if (enemyX < minX || enemyX > maxX) {
    errors.push({
      path,
      message: `must contain the enemy cell x=${enemyX} (received ${minX}..${maxX}).`,
    });
    return undefined;
  }

  return { minX, maxX };
}

function readInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
  rules: IntegerRules = {},
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

function readOptionalInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
  rules: IntegerRules = {},
): number | undefined {
  if (record[key] === undefined) {
    return undefined;
  }

  return readInteger(record, key, path, errors, rules);
}

function readString(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
  rules: StringRules = {},
): string | undefined {
  const fieldPath = `${path}.${key}`;
  const value = record[key];

  if (value === undefined) {
    errors.push({ path: fieldPath, message: 'is required.' });
    return undefined;
  }

  if (typeof value !== 'string') {
    errors.push({
      path: fieldPath,
      message: `must be a string (received ${describeValue(value)}).`,
    });
    return undefined;
  }

  if (value.trim().length === 0) {
    errors.push({ path: fieldPath, message: 'must not be empty.' });
    return undefined;
  }

  if (rules.pattern !== undefined && !rules.pattern.test(value)) {
    errors.push({
      path: fieldPath,
      message: `must be ${rules.patternHint ?? 'in the expected format'} (received "${value}").`,
    });
    return undefined;
  }

  return value;
}

function readOptionalString(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
): string | undefined {
  if (record[key] === undefined) {
    return undefined;
  }

  return readString(record, key, path, errors);
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

  if (!isOneOf(value, allowed)) {
    errors.push({
      path: fieldPath,
      message: `must be one of: ${allowed.join(', ')} (received ${describeValue(value)}).`,
    });
    return undefined;
  }

  return value;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.some((entry) => entry === value);
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

import {
  PLAYER_CONFIG_SCHEMA_VERSION,
  type PlayerConfig,
  type PlayerMovementConfig,
} from '../types/player-config';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Validation for `content/config/player.json` (schema version 1).
 *
 * Engine-free so it can run in tests and CI. All errors are collected before
 * returning; defaults are not invented for gameplay tuning.
 *
 * The upper bounds are sanity guards against content typos (for example a
 * gravity value accidentally entered in milliseconds), not gameplay limits.
 */

type UnknownRecord = Record<string, unknown>;

interface NumberRule {
  readonly min?: number;
  readonly max?: number;
  readonly exclusiveMin?: boolean;
  readonly exclusiveMax?: boolean;
}

const MOVEMENT_RULES = {
  maxSpeed: { min: 0, exclusiveMin: true, max: 2000 },
  acceleration: { min: 0, exclusiveMin: true, max: 10000 },
  deceleration: { min: 0, exclusiveMin: true, max: 10000 },
  jumpVelocity: { min: -3000, max: 0, exclusiveMax: true },
  gravity: { min: 0, exclusiveMin: true, max: 5000 },
  maxFallSpeed: { min: 0, exclusiveMin: true, max: 5000 },
  coyoteTimeMs: { min: 0, max: 1000 },
  jumpBufferMs: { min: 0, max: 1000 },
  jumpCutMultiplier: { min: 0, max: 1, exclusiveMin: true },
} satisfies Record<keyof PlayerMovementConfig, NumberRule>;

export function validatePlayerConfig(input: unknown): ValidationResult<PlayerConfig> {
  if (!isRecord(input)) {
    return {
      ok: false,
      errors: [{ path: '$', message: 'must be a JSON object.' }],
    };
  }

  const errors: ValidationError[] = [];

  const schemaVersion = readNumber(input, 'schemaVersion', '$', errors, { min: 1 });
  if (schemaVersion !== undefined && schemaVersion !== PLAYER_CONFIG_SCHEMA_VERSION) {
    errors.push({
      path: '$.schemaVersion',
      message: `unsupported schema version ${schemaVersion}; this build supports version ${PLAYER_CONFIG_SCHEMA_VERSION}.`,
    });
  }

  const movementInput = input.movement;
  const movementRecord = isRecord(movementInput) ? movementInput : null;

  if (movementRecord === null) {
    errors.push({
      path: '$.movement',
      message: 'is required and must be an object containing movement tuning values.',
    });
  }

  const readMovementValue = (key: keyof PlayerMovementConfig): number => {
    if (movementRecord === null) {
      return 0;
    }

    return readNumber(movementRecord, key, '$.movement', errors, MOVEMENT_RULES[key]);
  };

  // Values are only exposed when `errors` is empty; the zero values below are
  // therefore unreachable placeholders that keep the return type honest.
  const movement: PlayerMovementConfig = {
    maxSpeed: readMovementValue('maxSpeed'),
    acceleration: readMovementValue('acceleration'),
    deceleration: readMovementValue('deceleration'),
    jumpVelocity: readMovementValue('jumpVelocity'),
    gravity: readMovementValue('gravity'),
    maxFallSpeed: readMovementValue('maxFallSpeed'),
    coyoteTimeMs: readMovementValue('coyoteTimeMs'),
    jumpBufferMs: readMovementValue('jumpBufferMs'),
    jumpCutMultiplier: readMovementValue('jumpCutMultiplier'),
  };

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      schemaVersion: PLAYER_CONFIG_SCHEMA_VERSION,
      movement,
    },
  };
}

function readNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
  rules: NumberRule = {},
): number {
  const fieldPath = `${path}.${key}`;
  const value = record[key];

  if (value === undefined) {
    errors.push({ path: fieldPath, message: 'is required.' });
    return 0;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({
      path: fieldPath,
      message: `must be a finite number (received ${describeValue(value)}).`,
    });
    return 0;
  }

  if (rules.min !== undefined) {
    const invalid = rules.exclusiveMin === true ? value <= rules.min : value < rules.min;
    if (invalid) {
      const comparison = rules.exclusiveMin === true ? 'greater than' : 'greater than or equal to';
      errors.push({
        path: fieldPath,
        message: `must be ${comparison} ${rules.min} (received ${value}).`,
      });
      return 0;
    }
  }

  if (rules.max !== undefined) {
    const invalid = rules.exclusiveMax === true ? value >= rules.max : value > rules.max;
    if (invalid) {
      const comparison = rules.exclusiveMax === true ? 'less than' : 'less than or equal to';
      errors.push({
        path: fieldPath,
        message: `must be ${comparison} ${rules.max} (received ${value}).`,
      });
      return 0;
    }
  }

  return value;
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

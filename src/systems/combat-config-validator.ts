import {
  COMBAT_SCHEMA_VERSION,
  type CombatConfig,
  type CombatPlayerConfig,
  type CombatStompConfig,
} from '../types/combat';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Validation for `content/config/combat.json` (schema version 1).
 *
 * Engine-free and side-effect free. If this file is invalid the game must not
 * start, because health/damage values would silently fall back to guesses.
 */

type UnknownRecord = Record<string, unknown>;

const MAX_HEALTH = 99;
const MAX_INVULNERABILITY_MS = 60_000;
const MAX_INPUT_LOCK_MS = 5_000;
const MAX_KNOCKBACK = 5_000;
const MAX_FLASH_MS = 10_000;
const MAX_STOMP_BOUNCE = 5_000;
const MAX_TOP_TOLERANCE_PX = 128;

export function validateCombatConfig(input: unknown): ValidationResult<CombatConfig> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'must be a JSON object.' }] };
  }

  const errors: ValidationError[] = [];

  const schemaVersion = readInteger(input, 'schemaVersion', '$', errors, { min: 1 });
  if (schemaVersion !== undefined && schemaVersion !== COMBAT_SCHEMA_VERSION) {
    errors.push({
      path: '$.schemaVersion',
      message: `unsupported schema version ${schemaVersion}; this build supports version ${COMBAT_SCHEMA_VERSION}.`,
    });
  }

  const player = readPlayer(input.player, '$.player', errors);
  const stomp = readStomp(input.stomp, '$.stomp', errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const safePlayer: CombatPlayerConfig = player ?? {
    maxHealth: 1,
    startingHealth: 1,
    invulnerabilityMs: 0,
    knockbackVelocityX: 0,
    knockbackVelocityY: 0,
    inputLockMs: 0,
    damageFlashDurationMs: 0,
    damageFlashIntervalMs: 0,
  };
  const safeStomp: CombatStompConfig = stomp ?? {
    bounceVelocity: 0,
    topContactTolerancePx: 0,
  };

  return {
    ok: true,
    value: {
      schemaVersion: COMBAT_SCHEMA_VERSION,
      player: safePlayer,
      stomp: safeStomp,
    },
  };
}

function readPlayer(
  value: unknown,
  path: string,
  errors: ValidationError[],
): CombatPlayerConfig | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'is required and must be an object with player combat settings.' });
    return undefined;
  }

  const maxHealth = readInteger(value, 'maxHealth', path, errors, { min: 1, max: MAX_HEALTH });
  const startingHealth = readInteger(value, 'startingHealth', path, errors, {
    min: 1,
    max: MAX_HEALTH,
  });
  const invulnerabilityMs = readInteger(value, 'invulnerabilityMs', path, errors, {
    min: 0,
    max: MAX_INVULNERABILITY_MS,
  });
  const knockbackVelocityX = readInteger(value, 'knockbackVelocityX', path, errors, {
    min: -MAX_KNOCKBACK,
    max: MAX_KNOCKBACK,
  });
  const knockbackVelocityY = readInteger(value, 'knockbackVelocityY', path, errors, {
    min: -MAX_KNOCKBACK,
    max: MAX_KNOCKBACK,
  });
  const inputLockMs = readInteger(value, 'inputLockMs', path, errors, {
    min: 0,
    max: MAX_INPUT_LOCK_MS,
  });
  const damageFlashDurationMs = readInteger(value, 'damageFlashDurationMs', path, errors, {
    min: 0,
    max: MAX_FLASH_MS,
  });
  const damageFlashIntervalMs = readInteger(value, 'damageFlashIntervalMs', path, errors, {
    min: 1,
    max: MAX_FLASH_MS,
  });

  if (
    maxHealth === undefined ||
    startingHealth === undefined ||
    invulnerabilityMs === undefined ||
    knockbackVelocityX === undefined ||
    knockbackVelocityY === undefined ||
    inputLockMs === undefined ||
    damageFlashDurationMs === undefined ||
    damageFlashIntervalMs === undefined
  ) {
    return undefined;
  }

  if (startingHealth > maxHealth) {
    errors.push({
      path: `${path}.startingHealth`,
      message: `must be less than or equal to player.maxHealth (${maxHealth}); received ${startingHealth}.`,
    });
    return undefined;
  }

  return {
    maxHealth,
    startingHealth,
    invulnerabilityMs,
    knockbackVelocityX,
    knockbackVelocityY,
    inputLockMs,
    damageFlashDurationMs,
    damageFlashIntervalMs,
  };
}

function readStomp(
  value: unknown,
  path: string,
  errors: ValidationError[],
): CombatStompConfig | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'is required and must be an object with stomp settings.' });
    return undefined;
  }

  const bounceVelocity = readInteger(value, 'bounceVelocity', path, errors, {
    min: -MAX_STOMP_BOUNCE,
    max: 0,
  });
  const topContactTolerancePx = readInteger(value, 'topContactTolerancePx', path, errors, {
    min: 0,
    max: MAX_TOP_TOLERANCE_PX,
  });

  if (bounceVelocity === undefined || topContactTolerancePx === undefined) {
    return undefined;
  }

  return { bounceVelocity, topContactTolerancePx };
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

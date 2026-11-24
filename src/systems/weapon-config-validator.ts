import {
  WEAPON_IDS,
  WEAPON_SCHEMA_VERSION,
  isWeaponId,
  type WeaponConfig,
  type WeaponDefinition,
  type WeaponId,
} from '../types/weapon';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Engine-free validation for `content/config/weapons.json` (schema 1).
 *
 * Bounds are gameplay-safety limits, not balance targets:
 * - a projectile must never be stationary, inverted or able to live forever;
 * - bounce stays a coefficient, cooldowns/limits stay small integers;
 * - unknown weapon IDs are rejected because each weapon needs runtime code.
 */

type WeaponField = keyof WeaponDefinition;

interface FieldRule {
  readonly min: number;
  readonly max: number;
  readonly integer: boolean;
}

const FIELD_RULES: Readonly<Record<WeaponField, FieldRule>> = {
  damage: { min: 1, max: 99, integer: true },
  speed: { min: 1, max: 3000, integer: false },
  initialVelocityY: { min: -3000, max: 3000, integer: false },
  gravity: { min: 0, max: 6000, integer: false },
  bounce: { min: 0, max: 1, integer: false },
  cooldownMs: { min: 0, max: 60000, integer: true },
  lifetimeMs: { min: 1, max: 60000, integer: true },
  maxActiveProjectiles: { min: 1, max: 20, integer: true },
  maxTargets: { min: 1, max: 20, integer: true },
  durationMs: { min: 1, max: 120000, integer: true },
};

const WEAPON_FIELDS = Object.keys(FIELD_RULES) as WeaponField[];

export function validateWeaponConfig(input: unknown): ValidationResult<WeaponConfig> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'must be an object.' }] };
  }

  const errors: ValidationError[] = [];

  if (input.schemaVersion !== WEAPON_SCHEMA_VERSION) {
    errors.push({ path: '$.schemaVersion', message: `unsupported schema version; expected ${WEAPON_SCHEMA_VERSION}.` });
  }

  const weapons = input.weapons;

  if (!isRecord(weapons)) {
    return { ok: false, errors: [...errors, { path: '$.weapons', message: 'must be an object.' }] };
  }

  for (const key of Object.keys(weapons)) {
    if (!isWeaponId(key)) {
      errors.push({
        path: `$.weapons.${key}`,
        message: `unsupported weapon id "${key}"; this build supports: ${WEAPON_IDS.join(', ')}.`,
      });
    }
  }

  const normalized: Partial<Record<WeaponId, WeaponDefinition>> = {};

  for (const id of WEAPON_IDS) {
    const entry = weapons[id];

    if (!isRecord(entry)) {
      errors.push({ path: `$.weapons.${id}`, message: 'is required and must be an object.' });
      continue;
    }

    const values: Partial<Record<WeaponField, number>> = {};

    for (const field of WEAPON_FIELDS) {
      const rule = FIELD_RULES[field];
      const value = entry[field];

      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        (rule.integer && !Number.isSafeInteger(value)) ||
        value < rule.min ||
        value > rule.max
      ) {
        errors.push({
          path: `$.weapons.${id}.${field}`,
          message: `must be ${rule.integer ? 'an integer' : 'a finite number'} from ${rule.min} to ${rule.max}.`,
        });
        continue;
      }

      values[field] = value;
    }

    if (WEAPON_FIELDS.every((field) => values[field] !== undefined)) {
      // Every field was individually validated above, so the partial record is
      // complete here; the cast expresses that local invariant without `any`.
      normalized[id] = values as WeaponDefinition;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      schemaVersion: WEAPON_SCHEMA_VERSION,
      weapons: normalized as Record<WeaponId, WeaponDefinition>,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

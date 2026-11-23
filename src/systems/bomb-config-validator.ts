import type { BombConfig } from '../types/bomb';
import type { ValidationError, ValidationResult } from '../types/validation';

const LIMITS = {
  maxInventory: [1, 99], initialInventory: [0, 99], throwVelocityX: [1, 3000],
  throwVelocityY: [-3000, -1], gravity: [0, 5000], fuseMs: [1, 60000],
  explosionRadius: [1, 1000], damage: [1, 99], throwCooldownMs: [0, 60000],
  maxActiveBombs: [1, 20],
} as const;

export function validateBombConfig(input: unknown): ValidationResult<BombConfig> {
  const errors: ValidationError[] = [];
  if (!isRecord(input)) return { ok: false, errors: [{ path: '$', message: 'must be an object.' }] };
  if (input.schemaVersion !== 1) errors.push({ path: '$.schemaVersion', message: 'unsupported schema version; expected 1.' });
  if (!isRecord(input.bomb)) return { ok: false, errors: [...errors, { path: '$.bomb', message: 'must be an object.' }] };
  const values: Record<string, number> = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const value = input.bomb[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      errors.push({ path: `$.bomb.${key}`, message: `must be an integer from ${min} to ${max}.` });
    } else values[key] = value;
  }
  if ((values.initialInventory ?? 0) > (values.maxInventory ?? Infinity)) {
    errors.push({ path: '$.bomb.initialInventory', message: 'must not exceed maxInventory.' });
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { schemaVersion: 1, bomb: values as unknown as BombConfig['bomb'] } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

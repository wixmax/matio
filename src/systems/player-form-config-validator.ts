import type { PlayerFormsConfig } from '../types/player-form';
import type { ValidationError, ValidationResult } from '../types/validation';
import { bigForm, PLAYER_FRAME_HEIGHT, PLAYER_FRAME_WIDTH, SMALL_FORM } from './player-form-rules';

export function validatePlayerFormsConfig(input: unknown): ValidationResult<PlayerFormsConfig> {
  const errors: ValidationError[] = [];
  if (!isRecord(input)) return { ok: false, errors: [{ path: '$', message: 'must be an object.' }] };
  if (input.schemaVersion !== 1) {
    errors.push({ path: '$.schemaVersion', message: 'unsupported schema version; expected 1.' });
  }
  const growth = input.growth;
  if (!isRecord(growth)) {
    errors.push({ path: '$.growth', message: 'must be an object.' });
    return { ok: false, errors };
  }

  const durationMs = growth.durationMs;
  const validDuration = typeof durationMs === 'number' && Number.isSafeInteger(durationMs) && durationMs > 0;
  if (!validDuration) {
    errors.push({ path: '$.growth.durationMs', message: 'must be a positive safe integer.' });
  }
  const visualScale = readScale('visualScale', growth, errors);
  const bodyWidthMultiplier = readScale('bodyWidthMultiplier', growth, errors);
  const bodyHeightMultiplier = readScale('bodyHeightMultiplier', growth, errors);

  if (!validDuration || visualScale === undefined || bodyWidthMultiplier === undefined ||
      bodyHeightMultiplier === undefined) return { ok: false, errors };

  const value = { durationMs, visualScale, bodyWidthMultiplier, bodyHeightMultiplier };
  const body = bigForm(value);
  if (body.width <= SMALL_FORM.width || body.width > visualScale * PLAYER_FRAME_WIDTH) {
    errors.push({ path: '$.growth.bodyWidthMultiplier', message: 'must enlarge the body within the scaled frame.' });
  }
  if (body.height <= SMALL_FORM.height || body.height > visualScale * PLAYER_FRAME_HEIGHT) {
    errors.push({ path: '$.growth.bodyHeightMultiplier', message: 'must enlarge the body within the scaled frame.' });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { schemaVersion: 1, growth: value } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readScale(key: string, growth: Record<string, unknown>, errors: ValidationError[]): number | undefined {
  const value = growth[key];
  if (typeof value === 'number' && value > 1 && value <= 2) return value;
  errors.push({ path: `$.growth.${key}`, message: 'must be a finite number greater than 1 and at most 2.' });
  return undefined;
}

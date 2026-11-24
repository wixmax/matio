import {
  INTERACTIVE_BLOCK_SCHEMA_VERSION,
  type InteractiveBlocksConfig,
} from '../types/interactive-block';
import type { PlayerForm } from '../types/player-form';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Engine-free validation for `content/config/interactive-blocks.json`.
 *
 * All timings and visual offsets are finite bounds. The break-form list is
 * explicit so gameplay permission never depends on an implicit default.
 */

const PLAYER_FORMS: readonly PlayerForm[] = ['small', 'big'];

export function validateInteractiveBlocksConfig(
  input: unknown,
): ValidationResult<InteractiveBlocksConfig> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'must be an object.' }] };
  }

  const errors: ValidationError[] = [];

  if (input.schemaVersion !== INTERACTIVE_BLOCK_SCHEMA_VERSION) {
    errors.push({
      path: '$.schemaVersion',
      message: `unsupported schema version; expected ${INTERACTIVE_BLOCK_SCHEMA_VERSION}.`,
    });
  }

  const bump = readRecord(input.bump, '$.bump', errors);
  const breakRules = readRecord(input.break, '$.break', errors);
  const reward = readRecord(input.reward, '$.reward', errors);

  const bumpDuration = bump && readNumber(bump, 'durationMs', '$.bump', errors, 1, 2000, true);
  const bumpOffset = bump && readNumber(bump, 'offsetPx', '$.bump', errors, 0, 32, false);

  const breakDuration = breakRules && readNumber(breakRules, 'durationMs', '$.break', errors, 1, 4000, true);
  const debrisLifetime = breakRules &&
    readNumber(breakRules, 'debrisLifetimeMs', '$.break', errors, 1, 10000, true);
  const debrisPieces = breakRules && readNumber(breakRules, 'debrisPieces', '$.break', errors, 1, 24, true);
  const forms = breakRules && readBreakForms(breakRules.forms, '$.break.forms', errors);

  const emergeDuration = reward && readNumber(reward, 'emergeDurationMs', '$.reward', errors, 1, 5000, true);
  const settleDuration = reward && readNumber(reward, 'settleDurationMs', '$.reward', errors, 1, 5000, true);
  const risePx = reward && readNumber(reward, 'risePx', '$.reward', errors, 0, 64, false);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Every read above produced a value when errors is empty; the non-null
  // assertions express that local invariant instead of an unsafe cast.
  return {
    ok: true,
    value: {
      schemaVersion: INTERACTIVE_BLOCK_SCHEMA_VERSION,
      bump: { durationMs: bumpDuration!, offsetPx: bumpOffset! },
      break: {
        durationMs: breakDuration!,
        debrisLifetimeMs: debrisLifetime!,
        debrisPieces: debrisPieces!,
        forms: forms!,
      },
      reward: {
        emergeDurationMs: emergeDuration!,
        settleDurationMs: settleDuration!,
        risePx: risePx!,
      },
    },
  };
}

function readBreakForms(
  value: unknown,
  path: string,
  errors: ValidationError[],
): readonly PlayerForm[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push({ path, message: 'must be a non-empty array of player forms.' });
    return undefined;
  }

  const forms: PlayerForm[] = [];

  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || !PLAYER_FORMS.includes(entry as PlayerForm)) {
      errors.push({
        path: `${path}[${index}]`,
        message: `must be one of: ${PLAYER_FORMS.join(', ')}.`,
      });
      return;
    }

    const form = entry as PlayerForm;

    if (forms.includes(form)) {
      errors.push({ path: `${path}[${index}]`, message: `duplicate form "${form}".` });
      return;
    }

    forms.push(form);
  });

  return forms.length > 0 ? forms : undefined;
}

function readRecord(
  value: unknown,
  path: string,
  errors: ValidationError[],
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'must be an object.' });
    return undefined;
  }

  return value;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
  errors: ValidationError[],
  min: number,
  max: number,
  integer: boolean,
): number | undefined {
  const value = record[key];
  const label = integer ? 'an integer' : 'a finite number';

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (integer && !Number.isSafeInteger(value)) ||
    value < min ||
    value > max
  ) {
    errors.push({ path: `${path}.${key}`, message: `must be ${label} from ${min} to ${max}.` });
    return undefined;
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import {
  SCORING_SCHEMA_VERSION,
  type ScoringConfig,
  type ScoringPoints,
  type ScoringRatingConfig,
} from '../types/scoring';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Validation for `content/config/scoring.json` (schema version 1).
 *
 * Engine-free and side-effect free. Score points are integers so score
 * arithmetic is deterministic; the ratio is a finite number in 0..1.
 */

type UnknownRecord = Record<string, unknown>;

const MAX_POINTS = 1_000_000;

export function validateScoringConfig(input: unknown): ValidationResult<ScoringConfig> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'must be a JSON object.' }] };
  }

  const errors: ValidationError[] = [];

  const schemaVersion = readInteger(input, 'schemaVersion', '$', errors, { min: 1 });
  if (schemaVersion !== undefined && schemaVersion !== SCORING_SCHEMA_VERSION) {
    errors.push({
      path: '$.schemaVersion',
      message: `unsupported schema version ${schemaVersion}; this build supports version ${SCORING_SCHEMA_VERSION}.`,
    });
  }

  const points = readPoints(input.points, '$.points', errors);
  const rating = readRating(input.rating, '$.rating', errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  // Unreachable placeholders: values are only exposed when `errors` is empty.
  const safePoints: ScoringPoints = points ?? { coin: 0, star: 0, levelComplete: 0 };
  const safeRating: ScoringRatingConfig = rating ?? { twoStarMinCoinRatio: 0 };

  return {
    ok: true,
    value: {
      schemaVersion: SCORING_SCHEMA_VERSION,
      points: safePoints,
      rating: safeRating,
    },
  };
}

function readPoints(
  value: unknown,
  path: string,
  errors: ValidationError[],
): ScoringPoints | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'is required and must be an object with coin, star and levelComplete points.' });
    return undefined;
  }

  const coin = readInteger(value, 'coin', path, errors, { min: 0, max: MAX_POINTS });
  const star = readInteger(value, 'star', path, errors, { min: 0, max: MAX_POINTS });
  const levelComplete = readInteger(value, 'levelComplete', path, errors, {
    min: 0,
    max: MAX_POINTS,
  });

  if (coin === undefined || star === undefined || levelComplete === undefined) {
    return undefined;
  }

  return { coin, star, levelComplete };
}

function readRating(
  value: unknown,
  path: string,
  errors: ValidationError[],
): ScoringRatingConfig | undefined {
  if (!isRecord(value)) {
    errors.push({ path, message: 'is required and must be an object with twoStarMinCoinRatio.' });
    return undefined;
  }

  const ratio = readNumber(value, 'twoStarMinCoinRatio', path, errors, { min: 0, max: 1 });

  if (ratio === undefined) {
    return undefined;
  }

  return { twoStarMinCoinRatio: ratio };
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
    errors.push({ path: fieldPath, message: `must be an integer (received ${describeValue(value)}).` });
    return undefined;
  }

  if (rules.min !== undefined && value < rules.min) {
    errors.push({ path: fieldPath, message: `must be greater than or equal to ${rules.min} (received ${value}).` });
    return undefined;
  }

  if (rules.max !== undefined && value > rules.max) {
    errors.push({ path: fieldPath, message: `must be less than or equal to ${rules.max} (received ${value}).` });
    return undefined;
  }

  return value;
}

function readNumber(
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

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ path: fieldPath, message: `must be a finite number (received ${describeValue(value)}).` });
    return undefined;
  }

  if (rules.min !== undefined && value < rules.min) {
    errors.push({ path: fieldPath, message: `must be greater than or equal to ${rules.min} (received ${value}).` });
    return undefined;
  }

  if (rules.max !== undefined && value > rules.max) {
    errors.push({ path: fieldPath, message: `must be less than or equal to ${rules.max} (received ${value}).` });
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

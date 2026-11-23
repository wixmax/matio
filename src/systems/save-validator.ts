import { SAVE_VERSION, type LevelRecord, type SaveData } from '../types/save';
import type { LevelRating } from '../types/scoring';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Validation for untrusted local save data.
 *
 * localStorage is user-editable and can survive version changes, so nothing is
 * cast to `SaveData`. Unknown level IDs are rejected instead of silently kept:
 * the save store can then recover with a visible diagnostic.
 */

type UnknownRecord = Record<string, unknown>;

export function validateSaveData(
  input: unknown,
  knownLevelIds: readonly string[],
): ValidationResult<SaveData> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'must be a JSON object.' }] };
  }

  const errors: ValidationError[] = [];
  const knownLevels = new Set(knownLevelIds);

  const saveVersion = input.saveVersion;

  if (saveVersion === undefined) {
    errors.push({ path: '$.saveVersion', message: 'is required.' });
  } else if (!Number.isInteger(saveVersion) || saveVersion !== SAVE_VERSION) {
    errors.push({
      path: '$.saveVersion',
      message: `unsupported save version ${describeValue(saveVersion)}; this build supports version ${SAVE_VERSION}.`,
    });
  }

  const unlockedLevelIds = readUnlockedLevelIds(input.unlockedLevelIds, knownLevels, errors);
  const levels = readLevels(input.levels, knownLevels, errors);

  if (errors.length > 0 || unlockedLevelIds === undefined || levels === undefined) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      saveVersion: SAVE_VERSION,
      unlockedLevelIds,
      levels,
    },
  };
}

function readUnlockedLevelIds(
  value: unknown,
  knownLevels: ReadonlySet<string>,
  errors: ValidationError[],
): string[] | undefined {
  if (!Array.isArray(value)) {
    errors.push({ path: '$.unlockedLevelIds', message: 'is required and must be an array of level IDs.' });
    return undefined;
  }

  const ids: string[] = [];
  const seen = new Set<string>();

  value.forEach((entry, index) => {
    const entryPath = `$.unlockedLevelIds[${index}]`;

    if (typeof entry !== 'string' || entry.trim().length === 0) {
      errors.push({ path: entryPath, message: 'must be a non-empty level ID string.' });
      return;
    }

    if (!knownLevels.has(entry)) {
      errors.push({ path: entryPath, message: `references unknown level ID "${entry}".` });
      return;
    }

    if (seen.has(entry)) {
      errors.push({ path: entryPath, message: `duplicate unlocked level ID "${entry}".` });
      return;
    }

    seen.add(entry);
    ids.push(entry);
  });

  return ids;
}

function readLevels(
  value: unknown,
  knownLevels: ReadonlySet<string>,
  errors: ValidationError[],
): Record<string, LevelRecord> | undefined {
  if (!isRecord(value)) {
    errors.push({ path: '$.levels', message: 'is required and must be an object keyed by level ID.' });
    return undefined;
  }

  const records: Record<string, LevelRecord> = {};

  for (const [levelId, recordValue] of Object.entries(value)) {
    const recordPath = `$.levels["${levelId}"]`;

    if (!knownLevels.has(levelId)) {
      errors.push({ path: recordPath, message: `references unknown level ID "${levelId}".` });
      continue;
    }

    if (!isRecord(recordValue)) {
      errors.push({ path: recordPath, message: 'must be a level record object.' });
      continue;
    }

    const completed = readBoolean(recordValue, 'completed', recordPath, errors);
    const bestScore = readInteger(recordValue, 'bestScore', recordPath, errors, { min: 0 });
    const bestRatingStars = readRating(recordValue, 'bestRatingStars', recordPath, errors);
    const bestCollectedCoins = readInteger(recordValue, 'bestCollectedCoins', recordPath, errors, {
      min: 0,
    });
    const bestCollectedStars = readInteger(recordValue, 'bestCollectedStars', recordPath, errors, {
      min: 0,
    });

    if (
      completed === undefined ||
      bestScore === undefined ||
      bestRatingStars === undefined ||
      bestCollectedCoins === undefined ||
      bestCollectedStars === undefined
    ) {
      continue;
    }

    records[levelId] = {
      completed,
      bestScore,
      bestRatingStars,
      bestCollectedCoins,
      bestCollectedStars,
    };
  }

  return records;
}

function readBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
): boolean | undefined {
  const value = record[key];

  if (typeof value !== 'boolean') {
    errors.push({ path: `${path}.${key}`, message: 'is required and must be a boolean.' });
    return undefined;
  }

  return value;
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

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    errors.push({ path: fieldPath, message: 'is required and must be an integer.' });
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

function readRating(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationError[],
): LevelRating | undefined {
  const value = readInteger(record, key, path, errors, { min: 1, max: 3 });

  if (value === 1 || value === 2 || value === 3) {
    return value;
  }

  return undefined;
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

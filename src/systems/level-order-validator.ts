import { LEVEL_ORDER_SCHEMA_VERSION, type LevelOrderConfig } from '../types/progression';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Structural validation for `content/config/level-order.json`.
 *
 * Referenced IDs are checked against the level repository separately, because
 * this module must stay usable without Vite's level glob.
 */

const LEVEL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LEVELS = 512;

export function validateLevelOrderConfig(input: unknown): ValidationResult<LevelOrderConfig> {
  if (!isRecord(input)) {
    return { ok: false, errors: [{ path: '$', message: 'must be a JSON object.' }] };
  }

  const errors: ValidationError[] = [];
  const schemaVersion = input.schemaVersion;

  if (schemaVersion === undefined) {
    errors.push({ path: '$.schemaVersion', message: 'is required.' });
  } else if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    errors.push({ path: '$.schemaVersion', message: 'must be an integer greater than or equal to 1.' });
  } else if (schemaVersion !== LEVEL_ORDER_SCHEMA_VERSION) {
    errors.push({
      path: '$.schemaVersion',
      message: `unsupported schema version ${String(schemaVersion)}; this build supports version ${LEVEL_ORDER_SCHEMA_VERSION}.`,
    });
  }

  const levels = readLevels(input.levels, errors);

  if (errors.length > 0 || levels === undefined) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { schemaVersion: LEVEL_ORDER_SCHEMA_VERSION, levels },
  };
}

function readLevels(value: unknown, errors: ValidationError[]): string[] | undefined {
  if (!Array.isArray(value)) {
    errors.push({ path: '$.levels', message: 'is required and must be an array of level IDs.' });
    return undefined;
  }

  if (value.length === 0) {
    errors.push({ path: '$.levels', message: 'must contain at least one level ID.' });
    return undefined;
  }

  if (value.length > MAX_LEVELS) {
    errors.push({ path: '$.levels', message: `must contain at most ${MAX_LEVELS} level IDs.` });
  }

  const levels: string[] = [];
  const firstIndexById = new Map<string, number>();

  value.forEach((entry, index) => {
    const entryPath = `$.levels[${index}]`;

    if (typeof entry !== 'string' || entry.trim().length === 0) {
      errors.push({ path: entryPath, message: 'must be a non-empty level ID string.' });
      return;
    }

    if (!LEVEL_ID_PATTERN.test(entry)) {
      errors.push({
        path: entryPath,
        message: `must be lowercase kebab-case (for example "world-01-level-01"); received "${entry}".`,
      });
      return;
    }

    const previousIndex = firstIndexById.get(entry);

    if (previousIndex !== undefined) {
      errors.push({
        path: entryPath,
        message: `duplicate level ID "${entry}"; it already appears at levels[${previousIndex}].`,
      });
      return;
    }

    firstIndexById.set(entry, index);
    levels.push(entry);
  });

  return levels;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

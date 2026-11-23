import type { EffectsConfig } from '../types/effects';
import type { ValidationError, ValidationResult } from '../types/validation';

export function validateEffectsConfig(input: unknown): ValidationResult<EffectsConfig> {
  if (!isRecord(input)) return { ok: false, errors: [{ path: '$', message: 'must be an object.' }] };

  const errors: ValidationError[] = [];
  if (input.schemaVersion !== 1) {
    errors.push({ path: '$.schemaVersion', message: 'unsupported schema version; expected 1.' });
  }

  const shield = readSection('shield');
  const magnet = readSection('magnet');
  const shieldDuration = readPositive(shield, 'shield', 'durationMs');
  const maxCharges = readPositive(shield, 'shield', 'maxCharges', true);
  const chargesPerPickup = readPositive(shield, 'shield', 'chargesPerPickup', true);
  const magnetDuration = readPositive(magnet, 'magnet', 'durationMs');
  const radius = readPositive(magnet, 'magnet', 'radius');
  const attractionSpeed = readPositive(magnet, 'magnet', 'attractionSpeed');
  const collectionDistance = readPositive(magnet, 'magnet', 'collectionDistance');

  if (maxCharges !== undefined && chargesPerPickup !== undefined && chargesPerPickup > maxCharges) {
    errors.push({ path: '$.shield.chargesPerPickup', message: 'must not exceed maxCharges.' });
  }
  if (radius !== undefined && collectionDistance !== undefined && collectionDistance > radius) {
    errors.push({ path: '$.magnet.collectionDistance', message: 'must not exceed radius.' });
  }

  if (
    errors.length > 0 || shieldDuration === undefined || maxCharges === undefined ||
    chargesPerPickup === undefined || magnetDuration === undefined || radius === undefined ||
    attractionSpeed === undefined || collectionDistance === undefined
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      schemaVersion: 1,
      shield: { durationMs: shieldDuration, maxCharges, chargesPerPickup },
      magnet: { durationMs: magnetDuration, radius, attractionSpeed, collectionDistance },
    },
  };

  function readSection(key: 'shield' | 'magnet'): Record<string, unknown> | undefined {
    const value = isRecord(input) ? input[key] : undefined;
    if (isRecord(value)) return value;
    errors.push({ path: `$.${key}`, message: 'must be an object.' });
    return undefined;
  }

  function readPositive(
    section: Record<string, unknown> | undefined,
    name: string,
    key: string,
    integer = false,
  ): number | undefined {
    if (section === undefined) return undefined;
    const value = section[key];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0 &&
      (!integer || Number.isSafeInteger(value))) return value;
    errors.push({
      path: `$.${name}.${key}`,
      message: integer ? 'must be a positive safe integer.' : 'must be a finite positive number.',
    });
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

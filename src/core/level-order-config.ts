import rawLevelOrder from '../../content/config/level-order.json';
import { validateLevelOrderConfig } from '../systems/level-order-validator';
import type { LevelOrderConfig } from '../types/progression';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Build-time campaign order. Never inferred from filesystem iteration.
 * Cross-checking referenced IDs against the repository happens in `main.ts`.
 */

const configResult = validateLevelOrderConfig(rawLevelOrder);

export function getLevelOrderResult(): ValidationResult<LevelOrderConfig> {
  return configResult;
}

export function requireLevelOrder(): LevelOrderConfig {
  if (!configResult.ok) {
    throw new Error(`Invalid content/config/level-order.json:\n${formatLevelOrderErrors(configResult.errors)}`);
  }

  return configResult.value;
}

export function formatLevelOrderErrors(errors: readonly ValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join('\n');
}

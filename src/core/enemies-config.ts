import rawEnemiesConfig from '../../content/config/enemies.json';
import { validateEnemiesConfig } from '../systems/enemy-config-validator';
import type { EnemiesConfig } from '../types/enemy';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Build-time enemy configuration.
 *
 * Imported directly like player.json/scoring.json so dev, production and a
 * future WebView behave identically without fetch or filesystem access.
 */

const configResult = validateEnemiesConfig(rawEnemiesConfig);

export function getEnemiesConfigResult(): ValidationResult<EnemiesConfig> {
  return configResult;
}

export function requireEnemiesConfig(): EnemiesConfig {
  if (!configResult.ok) {
    throw new Error(
      `Invalid content/config/enemies.json:\n${formatEnemiesConfigErrors(configResult.errors)}`,
    );
  }

  return configResult.value;
}

export function formatEnemiesConfigErrors(errors: readonly ValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join('\n');
}

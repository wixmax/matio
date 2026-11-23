import rawScoringConfig from '../../content/config/scoring.json';
import { validateScoringConfig } from '../systems/scoring-validator';
import type { ScoringConfig } from '../types/scoring';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Build-time scoring configuration.
 *
 * Imported directly (like player.json) so dev, production and a future WebView
 * behave identically without fetch or filesystem access.
 */

const configResult = validateScoringConfig(rawScoringConfig);

export function getScoringConfigResult(): ValidationResult<ScoringConfig> {
  return configResult;
}

export function requireScoringConfig(): ScoringConfig {
  if (!configResult.ok) {
    throw new Error(`Invalid content/config/scoring.json:\n${formatScoringConfigErrors(configResult.errors)}`);
  }

  return configResult.value;
}

export function formatScoringConfigErrors(errors: readonly ValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join('\n');
}

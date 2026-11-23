import rawCombatConfig from '../../content/config/combat.json';
import { validateCombatConfig } from '../systems/combat-config-validator';
import type { CombatConfig } from '../types/combat';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Build-time combat configuration (health, invulnerability, knockback, stomp).
 * Validated at startup; invalid values block the game instead of guessing.
 */

const configResult = validateCombatConfig(rawCombatConfig);

export function getCombatConfigResult(): ValidationResult<CombatConfig> {
  return configResult;
}

export function requireCombatConfig(): CombatConfig {
  if (!configResult.ok) {
    throw new Error(
      `Invalid content/config/combat.json:\n${formatCombatConfigErrors(configResult.errors)}`,
    );
  }

  return configResult.value;
}

export function formatCombatConfigErrors(errors: readonly ValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join('\n');
}

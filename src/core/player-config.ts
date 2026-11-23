import rawPlayerConfig from '../../content/config/player.json';
import { validatePlayerConfig } from '../systems/player-config-validator';
import type { PlayerConfig } from '../types/player-config';
import type { ValidationError, ValidationResult } from '../types/validation';

/**
 * Build-time loading of external player tuning.
 *
 * `content/config/player.json` is imported directly so Vite bundles it into the
 * application. That works identically in dev, production and a future Android
 * WebView (no fetch, no file-system URL, no server dependency). Editing tuning
 * requires a rebuild or a dev-server reload, which is intentional for this
 * content type.
 *
 * Validation is performed once when this module is evaluated. `main.ts` checks
 * the result and refuses to start the game with invalid content; `GameScene`
 * uses `requirePlayerConfig()` because gameplay only exists after that check.
 */

const configResult = validatePlayerConfig(rawPlayerConfig);

export function getPlayerConfigResult(): ValidationResult<PlayerConfig> {
  return configResult;
}

export function requirePlayerConfig(): PlayerConfig {
  if (!configResult.ok) {
    throw new Error(`Invalid content/config/player.json:\n${formatPlayerConfigErrors(configResult.errors)}`);
  }

  return configResult.value;
}

export function formatPlayerConfigErrors(errors: readonly ValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join('\n');
}

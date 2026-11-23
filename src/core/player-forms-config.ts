import rawConfig from '../../content/config/player-forms.json';
import { validatePlayerFormsConfig } from '../systems/player-form-config-validator';

const result = validatePlayerFormsConfig(rawConfig);

export function getPlayerFormsConfigResult() {
  return result;
}

export function requirePlayerFormsConfig() {
  if (!result.ok) {
    const details = result.errors.map(({ path, message }) => `${path}: ${message}`).join(', ');
    throw new Error(`Invalid content/config/player-forms.json: ${details}`);
  }
  return result.value;
}

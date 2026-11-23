import rawConfig from '../../content/config/effects.json';
import { validateEffectsConfig } from '../systems/effects-config-validator';

const result = validateEffectsConfig(rawConfig);

export function getEffectsConfigResult() {
  return result;
}

export function requireEffectsConfig() {
  if (!result.ok) {
    const details = result.errors.map(({ path, message }) => `${path}: ${message}`).join(', ');
    throw new Error(`Invalid content/config/effects.json: ${details}`);
  }
  return result.value;
}

import rawConfig from '../../content/config/weapons.json';
import { validateWeaponConfig } from '../systems/weapon-config-validator';

const result = validateWeaponConfig(rawConfig);

export function getWeaponConfigResult() {
  return result;
}

export function requireWeaponConfig() {
  if (!result.ok) {
    const details = result.errors.map(({ path, message }) => `${path}: ${message}`).join(', ');
    throw new Error(`Invalid content/config/weapons.json: ${details}`);
  }

  return result.value;
}

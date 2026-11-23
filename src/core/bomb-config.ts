import rawConfig from '../../content/config/bombs.json';
import { validateBombConfig } from '../systems/bomb-config-validator';

const result = validateBombConfig(rawConfig);
export function getBombConfigResult() { return result; }
export function requireBombConfig() {
  if (!result.ok) throw new Error(`Invalid content/config/bombs.json: ${result.errors.map((e) => `${e.path}: ${e.message}`).join(', ')}`);
  return result.value;
}

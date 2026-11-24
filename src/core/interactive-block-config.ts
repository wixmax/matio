import rawConfig from '../../content/config/interactive-blocks.json';
import { validateInteractiveBlocksConfig } from '../systems/block-config-validator';

const result = validateInteractiveBlocksConfig(rawConfig);

export function getInteractiveBlocksConfigResult() {
  return result;
}

export function requireInteractiveBlocksConfig() {
  if (!result.ok) {
    const details = result.errors.map(({ path, message }) => `${path}: ${message}`).join(', ');
    throw new Error(`Invalid content/config/interactive-blocks.json: ${details}`);
  }

  return result.value;
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateCombatConfig } from '../src/systems/combat-config-validator';
import type { ValidationResult } from '../src/types/validation';

const COMBAT_CONFIG_PATH = fileURLToPath(
  new URL('../content/config/combat.json', import.meta.url),
);

function pathsOf<T>(result: ValidationResult<T>): string[] {
  if (result.ok) {
    throw new Error('Expected validation to fail, but it succeeded.');
  }

  return result.errors.map((error) => error.path);
}

function validConfig(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    player: {
      maxHealth: 3,
      startingHealth: 3,
      invulnerabilityMs: 1000,
      knockbackVelocityX: 280,
      knockbackVelocityY: -320,
      inputLockMs: 160,
      damageFlashDurationMs: 700,
      damageFlashIntervalMs: 110,
    },
    stomp: {
      bounceVelocity: -420,
      topContactTolerancePx: 18,
    },
  };
}

describe('combat configuration - shipped file', () => {
  it('validates content/config/combat.json', () => {
    const result = validateCombatConfig(
      JSON.parse(readFileSync(COMBAT_CONFIG_PATH, 'utf8')) as unknown,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.player.maxHealth).toBe(3);
      expect(result.value.player.startingHealth).toBe(3);
      expect(result.value.player.invulnerabilityMs).toBe(1000);
      expect(result.value.stomp.bounceVelocity).toBeLessThan(0);
    }
  });
});

describe('combat configuration - invalid values', () => {
  it('rejects non-object roots and unsupported schema versions', () => {
    expect(validateCombatConfig('combat').ok).toBe(false);
    expect(pathsOf(validateCombatConfig({ ...validConfig(), schemaVersion: 2 }))).toContain(
      '$.schemaVersion',
    );
  });

  it('requires the player and stomp sections', () => {
    const config = validConfig();
    delete config.player;
    delete config.stomp;
    const paths = pathsOf(validateCombatConfig(config));

    expect(paths).toContain('$.player');
    expect(paths).toContain('$.stomp');
  });

  it('rejects starting health above maximum health', () => {
    const config = validConfig();
    config.player = { ...(config.player as object), startingHealth: 5 };

    expect(pathsOf(validateCombatConfig(config))).toContain('$.player.startingHealth');
  });

  it('rejects negative/zero health, invulnerability and timings', () => {
    const config = validConfig();
    config.player = {
      ...(config.player as object),
      maxHealth: 0,
      startingHealth: 0,
      invulnerabilityMs: -1,
      inputLockMs: -1,
      damageFlashIntervalMs: 0,
    };
    const paths = pathsOf(validateCombatConfig(config));

    expect(paths).toContain('$.player.maxHealth');
    expect(paths).toContain('$.player.startingHealth');
    expect(paths).toContain('$.player.invulnerabilityMs');
    expect(paths).toContain('$.player.inputLockMs');
    expect(paths).toContain('$.player.damageFlashIntervalMs');
  });

  it('rejects non-integer knockback and flash values', () => {
    const config = validConfig();
    config.player = {
      ...(config.player as object),
      knockbackVelocityX: 1.5,
      knockbackVelocityY: Number.POSITIVE_INFINITY,
      damageFlashDurationMs: 2.5,
    };
    const paths = pathsOf(validateCombatConfig(config));

    expect(paths).toContain('$.player.knockbackVelocityX');
    expect(paths).toContain('$.player.knockbackVelocityY');
    expect(paths).toContain('$.player.damageFlashDurationMs');
  });

  it('rejects a downward stomp bounce', () => {
    const config = validConfig();
    config.stomp = { ...(config.stomp as object), bounceVelocity: 100 };

    expect(pathsOf(validateCombatConfig(config))).toContain('$.stomp.bounceVelocity');
  });

  it('rejects a negative or oversized stomp tolerance', () => {
    const config = validConfig();
    config.stomp = { ...(config.stomp as object), topContactTolerancePx: -1 };

    expect(pathsOf(validateCombatConfig(config))).toContain('$.stomp.topContactTolerancePx');

    config.stomp = { ...(config.stomp as object), topContactTolerancePx: 500 };
    expect(pathsOf(validateCombatConfig(config))).toContain('$.stomp.topContactTolerancePx');
  });
});

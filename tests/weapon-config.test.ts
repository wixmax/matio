import { describe, expect, it } from 'vitest';
import effectsConfig from '../content/config/effects.json';
import forms from '../content/config/player-forms.json';
import weaponConfig from '../content/config/weapons.json';
import { ActiveEffects } from '../src/systems/ActiveEffects';
import { validateEffectsConfig } from '../src/systems/effects-config-validator';
import { validateWeaponConfig } from '../src/systems/weapon-config-validator';

const validWeapons = validateWeaponConfig(weaponConfig);
if (!validWeapons.ok) throw new Error(JSON.stringify(validWeapons.errors));

const validEffects = validateEffectsConfig(effectsConfig);
if (!validEffects.ok) throw new Error(JSON.stringify(validEffects.errors));

const energyBall = weaponConfig.weapons['energy-ball'];
const fieldValue = (field: string, value: unknown) => ({
  ...weaponConfig,
  weapons: {
    ...weaponConfig.weapons,
    'energy-ball': { ...energyBall, [field]: value },
  },
});
const createEffects = () => new ActiveEffects(validEffects.value, forms.growth.durationMs);

describe('weapon configuration', () => {
  it('accepts the shipped schema-1 tuning', () => {
    expect(validWeapons).toEqual({ ok: true, value: weaponConfig });
    expect(energyBall).toEqual({
      damage: 1,
      speed: 430,
      initialVelocityY: -80,
      gravity: 1100,
      bounce: 0.75,
      cooldownMs: 350,
      lifetimeMs: 2500,
      maxActiveProjectiles: 2,
      maxTargets: 1,
      durationMs: 20000,
    });
  });

  it('rejects non-object content and unsupported versions', () => {
    expect(validateWeaponConfig(null).ok).toBe(false);
    expect(validateWeaponConfig({ ...weaponConfig, schemaVersion: 2 }).ok).toBe(false);
    expect(validateWeaponConfig({ schemaVersion: 1 }).ok).toBe(false);
  });

  it('requires the implemented weapon and rejects unknown weapon ids', () => {
    const missing = validateWeaponConfig({ ...weaponConfig, weapons: {} });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.map(({ path }) => path)).toContain('$.weapons.energy-ball');

    const unknown = validateWeaponConfig({
      ...weaponConfig,
      weapons: { ...weaponConfig.weapons, laser: energyBall },
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors.map(({ path }) => path)).toContain('$.weapons.laser');
  });

  it.each([
    ['speed', 0],
    ['speed', Number.POSITIVE_INFINITY],
    ['speed', 3001],
    ['gravity', Number.NaN],
    ['gravity', -1],
    ['gravity', 6001],
    ['initialVelocityY', Number.NEGATIVE_INFINITY],
    ['bounce', -0.1],
    ['bounce', 1.01],
    ['damage', 0],
    ['damage', 1.5],
    ['cooldownMs', -1],
    ['cooldownMs', 1.5],
    ['lifetimeMs', 0],
    ['lifetimeMs', 60_001],
    ['maxActiveProjectiles', 0],
    ['maxActiveProjectiles', 21],
    ['maxTargets', 0],
    ['maxTargets', 21],
    ['durationMs', 0],
    ['durationMs', 120_001],
  ])('rejects invalid %s = %j with a field path', (field, value) => {
    const result = validateWeaponConfig(fieldValue(field, value));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: `$.weapons.energy-ball.${field}` }),
      );
    }
  });

  it('reports every invalid field in one pass', () => {
    const result = validateWeaponConfig({
      ...weaponConfig,
      weapons: { 'energy-ball': { ...energyBall, damage: 0, bounce: 2, durationMs: 0 } },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map(({ path }) => path)).toEqual(
        expect.arrayContaining([
          '$.weapons.energy-ball.damage',
          '$.weapons.energy-ball.bounce',
          '$.weapons.energy-ball.durationMs',
        ]),
      );
    }
  });
});

describe('temporary ability clock', () => {
  it('activates, refreshes and expires independently of other effects', () => {
    const effects = createEffects();

    expect(effects.isAbilityActive('energy-ball')).toBe(false);
    effects.activateAbility('energy-ball', 20_000);
    effects.activate('shield');
    effects.advance(5_000);

    expect(effects.abilityRemainingMs('energy-ball')).toBe(15_000);
    expect(effects.remainingMs('shield')).toBe(10_000);

    effects.advance(10_000);
    effects.activateAbility('energy-ball', 20_000);
    expect(effects.abilityRemainingMs('energy-ball')).toBe(20_000);
    expect(effects.remainingMs('shield')).toBe(0);

    effects.advance(20_000);
    expect(effects.isAbilityActive('energy-ball')).toBe(false);
  });

  it('ignores invalid durations and time steps without losing the remaining window', () => {
    const effects = createEffects();
    effects.activateAbility('energy-ball', 20_000);

    effects.activateAbility('energy-ball', 0);
    effects.activateAbility('energy-ball', Number.NaN);
    effects.advance(Number.NaN);
    effects.advance(-100);

    expect(effects.abilityRemainingMs('energy-ball')).toBe(20_000);
  });

  it('clears abilities on reset and after disposal', () => {
    const effects = createEffects();
    effects.activateAbility('energy-ball', 20_000);
    effects.reset();
    expect(effects.isAbilityActive('energy-ball')).toBe(false);

    effects.activateAbility('energy-ball', 20_000);
    effects.dispose();
    expect(effects.isAbilityActive('energy-ball')).toBe(false);
    effects.activateAbility('energy-ball', 20_000);
    expect(effects.abilityRemainingMs('energy-ball')).toBe(0);
  });
});

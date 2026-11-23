import { describe, expect, it } from 'vitest';
import rawConfig from '../content/config/bombs.json';
import { validateBombConfig } from '../src/systems/bomb-config-validator';
import { BombInventory } from '../src/systems/bomb-inventory';
import { canThrowBomb, explosionIntersectsRect } from '../src/systems/bomb-rules';

describe('bomb configuration', () => {
  it('accepts shipped values', () => expect(validateBombConfig(rawConfig).ok).toBe(true));
  it('rejects unsupported schema and invalid limits', () => {
    expect(validateBombConfig({ ...rawConfig, schemaVersion: 2 }).ok).toBe(false);
    expect(validateBombConfig({ ...rawConfig, bomb: { ...rawConfig.bomb, initialInventory: 6 } }).ok).toBe(false);
    expect(validateBombConfig({ ...rawConfig, bomb: { ...rawConfig.bomb, fuseMs: 0, explosionRadius: -1 } }).ok).toBe(false);
  });
});

describe('run inventory', () => {
  it('caps pickups, spends once, preserves on fall and resets on retry', () => {
    const inventory = new BombInventory(2, 0);
    expect(inventory.spend()).toBe(false);
    expect(inventory.add()).toBe(true);
    expect(inventory.add()).toBe(true);
    expect(inventory.add()).toBe(false);
    expect(inventory.quantity).toBe(2);
    expect(inventory.spend()).toBe(true);
    expect(inventory.quantity).toBe(1);
    inventory.reset();
    expect(inventory.quantity).toBe(0);
  });
});

describe('explosion geometry', () => {
  const target = { x: 100, y: 100, width: 40, height: 40 };
  it('includes bodies within or partially crossing the radius', () => {
    expect(explosionIntersectsRect(100, 100, 1, target)).toBe(true);
    expect(explosionIntersectsRect(90, 120, 11, target)).toBe(true);
    expect(explosionIntersectsRect(0, 0, 30, target)).toBe(false);
  });
});

describe('throw eligibility', () => {
  const settings = rawConfig.bomb;

  it('allows a throw exactly at the cooldown boundary', () => {
    expect(canThrowBomb(settings, true, 1, 349)).toBe(false);
    expect(canThrowBomb(settings, true, 1, 350)).toBe(true);
  });

  it('rejects a full projectile set after the cooldown has ended', () => {
    expect(canThrowBomb(settings, true, 2, 500)).toBe(true);
    expect(canThrowBomb(settings, true, 3, 500)).toBe(false);
  });

  it('rejects empty inventory even when all other conditions pass', () => {
    expect(canThrowBomb(settings, false, 0, 500)).toBe(false);
  });
});

describe('bomb configuration error paths', () => {
  it.each([
    ['maxInventory', 0], ['fuseMs', 0], ['explosionRadius', Infinity],
    ['damage', 0], ['maxActiveBombs', 21], ['throwVelocityY', 1],
    ['gravity', Number.NaN], ['throwCooldownMs', -1],
  ])('identifies invalid %s', (field, value) => {
    const result = validateBombConfig({ ...rawConfig, bomb: { ...rawConfig.bomb, [field]: value } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map(({ path }) => path)).toContain('$.bomb.' + field);
  });
});

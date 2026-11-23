import { describe, expect, it, vi } from 'vitest';
import combatConfig from '../content/config/combat.json';
import config from '../content/config/effects.json';
import forms from '../content/config/player-forms.json';
import { ActiveEffects } from '../src/systems/ActiveEffects';
import { validateEffectsConfig } from '../src/systems/effects-config-validator';
import { isMagnetPathClear, magnetStep, reachableCoinDistance, resolveEnemyDamage } from '../src/systems/effect-rules';
import { PlayerHealth } from '../src/systems/player-health';

const valid = validateEffectsConfig(config);
if (!valid.ok) throw new Error(JSON.stringify(valid.errors));
const tuning = valid.value;
const createEffects = () => new ActiveEffects(tuning, forms.growth.durationMs);

describe('effects config', () => {
  it('loads the shipped v1 tuning', () => {
    expect(valid).toEqual({ ok: true, value: config });
  });

  it.each([
    [{ ...config, schemaVersion: undefined }, '$.schemaVersion'],
    [{ ...config, schemaVersion: 2 }, '$.schemaVersion'],
    [{ ...config, shield: null }, '$.shield'],
    [{ ...config, shield: { ...config.shield, durationMs: 0 } }, '$.shield.durationMs'],
    [{ ...config, magnet: { ...config.magnet, durationMs: NaN } }, '$.magnet.durationMs'],
    [{ ...config, magnet: { ...config.magnet, radius: -1 } }, '$.magnet.radius'],
    [{ ...config, magnet: { ...config.magnet, attractionSpeed: Infinity } }, '$.magnet.attractionSpeed'],
    [{ ...config, magnet: { ...config.magnet, attractionSpeed: 0 } }, '$.magnet.attractionSpeed'],
    [{ ...config, shield: { ...config.shield, maxCharges: 1.5 } }, '$.shield.maxCharges'],
    [{ ...config, shield: { ...config.shield, chargesPerPickup: 2 } }, '$.shield.chargesPerPickup'],
    [{ ...config, shield: { ...config.shield, chargesPerPickup: -1 } }, '$.shield.chargesPerPickup'],
    [{ ...config, magnet: { ...config.magnet, collectionDistance: 0 } }, '$.magnet.collectionDistance'],
    [{ ...config, magnet: { ...config.magnet, collectionDistance: 181 } }, '$.magnet.collectionDistance'],
  ])('rejects malformed tuning at %j', (value, path) => {
    const result = validateEffectsConfig(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ path }));
  });
});

describe('active effects', () => {
  it('activates both effects with independent durations and refreshes from the configured duration', () => {
    const effects = createEffects();
    expect(effects.isActive('shield')).toBe(false);
    effects.activate('shield');
    effects.activate('magnet');
    effects.advance(3500);
    expect(effects.remainingMs('shield')).toBe(11500);
    expect(effects.remainingMs('magnet')).toBe(8500);
    effects.activate('magnet');
    expect(effects.remainingMs('magnet')).toBe(12000);
    expect(effects.remainingMs('shield')).toBe(11500);
    effects.activate('shield');
    expect(effects.remainingMs('shield')).toBe(15000);
    expect(effects.shieldCharges).toBe(1);
  });

  it('expires independently, clamps durations to zero and clears expired charges', () => {
    const effects = createEffects();
    effects.activate('shield');
    effects.activate('magnet');
    effects.advance(12000);
    expect(effects.isActive('magnet')).toBe(false);
    expect(effects.isActive('shield')).toBe(true);
    effects.advance(10000);
    expect(effects.remainingMs('shield')).toBe(0);
    expect(effects.shieldCharges).toBe(0);
    expect(effects.consumeShield()).toBe(false);
  });

  it('keeps remaining time and charges without a simulation tick', () => {
    const effects = createEffects();
    effects.activate('shield');
    effects.advance(250);
    vi.useFakeTimers();
    try {
      vi.advanceTimersByTime(30_000);
      effects.advance(NaN);
      effects.advance(-100);
      expect(effects.remainingMs('shield')).toBe(14750);
      expect(effects.shieldCharges).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes the shield on its final charge and restores it via a new pickup', () => {
    const effects = createEffects();
    effects.activate('shield');
    expect(effects.consumeShield()).toBe(true);
    expect(effects.consumeShield()).toBe(false);
    expect(effects.isActive('shield')).toBe(false);
    effects.activate('shield');
    expect(effects.shieldCharges).toBe(1);
    expect(effects.remainingMs('shield')).toBe(15000);
  });

  it('clears state on reset, permits a fresh activation and ignores calls after disposal', () => {
    const effects = createEffects();
    effects.activate('shield');
    effects.activate('magnet');
    effects.reset();
    expect(effects.isActive('shield')).toBe(false);
    expect(effects.isActive('magnet')).toBe(false);
    effects.activate('shield');
    expect(effects.isActive('shield')).toBe(true);
    effects.dispose();
    effects.activate('shield');
    effects.activate('magnet');
    effects.advance(100);
    expect(effects.consumeShield()).toBe(false);
    expect(effects.remainingMs('magnet')).toBe(0);
  });
});

describe('shield damage priority', () => {
  it('absorbs eligible damage and prevents repeated overlaps from spending another charge', () => {
    const effects = new ActiveEffects({ ...tuning, shield: { ...tuning.shield, maxCharges: 2 } }, forms.growth.durationMs);
    const health = new PlayerHealth(combatConfig.player);
    const absorb = () => effects.consumeShield();
    effects.activate('shield');
    effects.activate('shield');
    expect(resolveEnemyDamage(health, 1, absorb)).toBe('absorbed');
    expect(health.health).toBe(3);
    expect(effects.shieldCharges).toBe(1);
    expect(resolveEnemyDamage(health, 1, absorb)).toBe('ignored');
    expect(effects.shieldCharges).toBe(1);
  });

  it('keeps the shield during existing invulnerability and ignores invalid damage', () => {
    const effects = createEffects();
    const health = new PlayerHealth(combatConfig.player);
    const absorb = vi.fn(() => effects.consumeShield());
    effects.activate('shield');
    expect(resolveEnemyDamage(health, 0, absorb)).toBe('ignored');
    health.damage(1);
    expect(resolveEnemyDamage(health, 1, absorb)).toBe('ignored');
    expect(absorb).not.toHaveBeenCalled();
    expect(effects.shieldCharges).toBe(1);
  });

  it('applies normal damage once the shield expires', () => {
    const effects = createEffects();
    const health = new PlayerHealth(combatConfig.player);
    effects.activate('shield');
    effects.advance(15000);
    expect(resolveEnemyDamage(health, 1, () => effects.consumeShield())).toBe('damaged');
    expect(health.health).toBe(2);
    health.tick(combatConfig.player.invulnerabilityMs);
    expect(resolveEnemyDamage(health, 2, () => effects.consumeShield())).toBe('defeated');
  });
});

describe('magnet geometry and motion', () => {
  const target = { x: 120, y: 48 };
  const wall = { x: 64, y: 32, width: 16, height: 64 };

  it('selects nearby, reachable coins and leaves out distant or blocked coins', () => {
    expect(reachableCoinDistance(24, 48, target, 180, 13, 13, [])).toBe(96);
    expect(reachableCoinDistance(24, 48, target, 95, 13, 13, [])).toBeNull();
    expect(reachableCoinDistance(24, 48, target, 180, 13, 13, [wall])).toBeNull();
  });

  it('checks the swept body at corners and works for vertical and reverse paths', () => {
    expect(isMagnetPathClear(24, 22, { x: 120, y: 22 }, 13, 13, [wall])).toBe(false);
    expect(isMagnetPathClear(24, 18, { x: 120, y: 18 }, 13, 13, [wall])).toBe(true);
    expect(isMagnetPathClear(120, 48, { x: 24, y: 48 }, 13, 13, [wall])).toBe(false);
    expect(isMagnetPathClear(72, 0, { x: 72, y: 120 }, 13, 13, [wall])).toBe(false);
    expect(isMagnetPathClear(24, 70, { x: 120, y: -40 }, 0, 0, [wall])).toBe(true);
  });

  it('moves at the configured speed independent of time slices and does not overshoot', () => {
    const advance = (distance: number, ms: number) => distance - magnetStep(distance, 20, 450, ms);
    const single = advance(150, 100);
    const split = [10, 20, 30, 40].reduce(advance, 150);
    expect(single).toBeCloseTo(split);
    expect(single).toBe(105);
    expect(advance(30, 100)).toBe(20);
    expect(advance(20, 100)).toBe(20);
  });
});

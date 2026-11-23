import { describe, expect, it } from 'vitest';
import { PlayerHealth } from '../src/systems/player-health';
import type { CombatPlayerConfig } from '../src/types/combat';

const CONFIG: CombatPlayerConfig = {
  maxHealth: 3,
  startingHealth: 3,
  invulnerabilityMs: 1000,
  knockbackVelocityX: 280,
  knockbackVelocityY: -320,
  inputLockMs: 160,
  damageFlashDurationMs: 700,
  damageFlashIntervalMs: 110,
};

describe('player health - damage and clamping', () => {
  it('starts at the configured health', () => {
    const health = new PlayerHealth(CONFIG);

    expect(health.health).toBe(3);
    expect(health.maxHealth).toBe(3);
    expect(health.invulnerable).toBe(false);
  });

  it('applies one damage and starts invulnerability', () => {
    const health = new PlayerHealth(CONFIG);
    const result = health.damage(1);

    expect(result.applied).toBe(true);
    expect(result.died).toBe(false);
    expect(health.health).toBe(2);
    expect(health.invulnerable).toBe(true);
    expect(health.snapshot.invulnerableRemainingMs).toBe(1000);
  });

  it('blocks every additional hit during invulnerability', () => {
    const health = new PlayerHealth(CONFIG);

    health.damage(1);
    const second = health.damage(1);

    expect(second.applied).toBe(false);
    expect(health.health).toBe(2);
  });

  it('accepts damage again after the invulnerability window expires', () => {
    const health = new PlayerHealth(CONFIG);

    health.damage(1);
    health.tick(999);
    expect(health.damage(1).applied).toBe(false);
    expect(health.health).toBe(2);

    health.tick(1);
    expect(health.invulnerable).toBe(false);
    expect(health.damage(1).applied).toBe(true);
    expect(health.health).toBe(1);
  });

  it('never exceeds maximum or falls below zero', () => {
    const health = new PlayerHealth({ ...CONFIG, startingHealth: 2 });

    // No healing API exists; this only asserts the constructor clamp.
    expect(health.health).toBe(2);

    health.damage(5);
    expect(health.health).toBe(0);
    expect(health.isDead).toBe(true);

    health.tick(5000);
    expect(health.health).toBe(0);
    expect(health.damage(1).applied).toBe(false);
  });

  it('reports death exactly on the hit that reaches zero', () => {
    const health = new PlayerHealth({ ...CONFIG, startingHealth: 1 });
    const result = health.damage(1);

    expect(result.applied).toBe(true);
    expect(result.died).toBe(true);
    expect(health.health).toBe(0);
  });

  it('ignores zero, negative and non-finite damage', () => {
    const health = new PlayerHealth(CONFIG);

    expect(health.damage(0).applied).toBe(false);
    expect(health.damage(-1).applied).toBe(false);
    expect(health.damage(Number.NaN).applied).toBe(false);
    expect(health.health).toBe(3);
    expect(health.invulnerable).toBe(false);
  });

  it('restores maximum health and clears invulnerability on a fresh attempt', () => {
    const health = new PlayerHealth({ ...CONFIG, startingHealth: 2 });

    health.damage(1);
    expect(health.health).toBe(1);
    expect(health.invulnerable).toBe(true);

    health.reset();

    expect(health.health).toBe(3);
    expect(health.invulnerable).toBe(false);
    expect(health.isDead).toBe(false);
  });

  it('handles non-finite tick deltas without corrupting the timer', () => {
    const health = new PlayerHealth(CONFIG);

    health.damage(1);
    health.tick(Number.NaN);

    expect(health.snapshot.invulnerableRemainingMs).toBe(1000);
  });
});

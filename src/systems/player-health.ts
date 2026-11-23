import type {
  DamageResult,
  HealthSnapshot,
  CombatPlayerConfig,
} from '../types/combat';

/**
 * Engine-free player health model.
 *
 * Time is advanced explicitly with `tick(deltaMs)` so invulnerability is
 * deterministic in tests and independent of wall-clock time.
 *
 * Invariants:
 * - health is always an integer in `0..maxHealth`;
 * - invulnerability blocks damage for `invulnerabilityMs` after a hit;
 * - a full attempt reset restores maximum health and clears invulnerability;
 * - reaching zero health is terminal for the caller (no healing is modelled).
 */
export class PlayerHealth {
  private readonly maxHealthValue: number;
  private readonly invulnerabilityDurationMs: number;
  private currentHealth: number;
  private invulnerableRemainingMs = 0;

  constructor(config: CombatPlayerConfig) {
    this.maxHealthValue = Math.max(1, Math.trunc(config.maxHealth));
    this.currentHealth = clamp(Math.trunc(config.startingHealth), 0, this.maxHealthValue);
    this.invulnerabilityDurationMs = Math.max(0, Math.trunc(config.invulnerabilityMs));
  }

  get health(): number {
    return this.currentHealth;
  }

  get maxHealth(): number {
    return this.maxHealthValue;
  }

  get invulnerable(): boolean {
    return this.invulnerableRemainingMs > 0;
  }

  get isDead(): boolean {
    return this.currentHealth <= 0;
  }

  get snapshot(): HealthSnapshot {
    return {
      health: this.currentHealth,
      maxHealth: this.maxHealthValue,
      invulnerable: this.invulnerable,
      invulnerableRemainingMs: this.invulnerableRemainingMs,
    };
  }

  /** Advances the invulnerability timer by one frame. */
  tick(deltaMs: number): void {
    if (this.invulnerableRemainingMs <= 0 || !Number.isFinite(deltaMs)) {
      return;
    }

    this.invulnerableRemainingMs = Math.max(0, this.invulnerableRemainingMs - deltaMs);
  }

  canTakeDamage(amount: number): boolean {
    return Number.isFinite(amount) && Math.trunc(amount) > 0 && !this.isDead && !this.invulnerable;
  }

  startInvulnerability(): void {
    this.invulnerableRemainingMs = this.isDead ? 0 : this.invulnerabilityDurationMs;
  }

  /** Applies damage unless invulnerable. Never goes below zero. */
  damage(amount: number): DamageResult {
    if (!this.canTakeDamage(amount)) {
      return this.result(false);
    }

    this.currentHealth = clamp(this.currentHealth - Math.trunc(amount), 0, this.maxHealthValue);
    this.startInvulnerability();

    return this.result(true);
  }

  /** Restores a fresh attempt: maximum health and no invulnerability. */
  reset(): void {
    this.currentHealth = this.maxHealthValue;
    this.invulnerableRemainingMs = 0;
  }

  private result(applied: boolean): DamageResult {
    return {
      applied,
      died: this.currentHealth <= 0,
      ...this.snapshot,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

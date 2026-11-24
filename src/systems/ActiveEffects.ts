import type { EffectsConfig, EffectType } from '../types/effects';
import type { WeaponId } from '../types/weapon';

interface EffectState {
  remainingMs: number;
  charges: number;
}

/**
 * One instance per attempt. Only the caller's gameplay delta advances time.
 *
 * Besides shield/magnet/growth, it is the single clock for temporary weapon
 * abilities. Durations come from validated weapon configuration, not from this
 * class, so weapon tuning stays in `content/config/weapons.json`.
 */
export class ActiveEffects {
  private readonly entries: Record<EffectType, EffectState> = {
    shield: { remainingMs: 0, charges: 0 },
    magnet: { remainingMs: 0, charges: 0 },
    growth: { remainingMs: 0, charges: 0 },
  };
  private readonly states = Object.values(this.entries);
  private readonly abilities = new Map<WeaponId, number>();
  private disposed = false;

  constructor(
    private readonly config: EffectsConfig,
    private readonly growthDurationMs: number,
  ) {}

  activate(type: EffectType): void {
    if (this.disposed) return;
    const effect = this.entries[type];
    effect.remainingMs = type === 'growth' ? this.growthDurationMs : this.config[type].durationMs;

    if (type === 'shield') {
      const { maxCharges, chargesPerPickup } = this.config.shield;
      effect.charges = Math.min(maxCharges, effect.charges + chargesPerPickup);
    }
  }

  isActive(type: EffectType): boolean {
    return this.remainingMs(type) > 0;
  }

  remainingMs(type: EffectType): number {
    return this.entries[type].remainingMs;
  }

  /** Grants or refreshes a weapon ability window with a validated duration. */
  activateAbility(id: WeaponId, durationMs: number): void {
    if (this.disposed || !Number.isFinite(durationMs) || durationMs <= 0) return;
    this.abilities.set(id, durationMs);
  }

  abilityRemainingMs(id: WeaponId): number {
    return this.abilities.get(id) ?? 0;
  }

  isAbilityActive(id: WeaponId): boolean {
    return this.abilityRemainingMs(id) > 0;
  }

  get shieldCharges(): number {
    return this.entries.shield.charges;
  }

  advance(deltaMs: number): void {
    if (this.disposed || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    for (const effect of this.states) {
      effect.remainingMs = Math.max(0, effect.remainingMs - deltaMs);
      if (effect.remainingMs === 0) effect.charges = 0;
    }
    for (const [id, remaining] of this.abilities) {
      const next = Math.max(0, remaining - deltaMs);
      if (next === 0) this.abilities.delete(id);
      else this.abilities.set(id, next);
    }
  }

  consumeShield(): boolean {
    const shield = this.entries.shield;
    if (shield.charges === 0) return false;
    shield.charges -= 1;
    if (shield.charges === 0) shield.remainingMs = 0;
    return true;
  }

  reset(): void {
    for (const effect of this.states) {
      effect.remainingMs = 0;
      effect.charges = 0;
    }
    this.abilities.clear();
  }

  dispose(): void {
    this.reset();
    this.disposed = true;
  }
}

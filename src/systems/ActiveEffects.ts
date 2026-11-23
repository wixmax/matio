import type { EffectsConfig, EffectType } from '../types/effects';

interface EffectState {
  remainingMs: number;
  charges: number;
}

/** One instance per attempt. Only the caller's gameplay delta advances time. */
export class ActiveEffects {
  private readonly entries: Record<EffectType, EffectState> = {
    shield: { remainingMs: 0, charges: 0 },
    magnet: { remainingMs: 0, charges: 0 },
    growth: { remainingMs: 0, charges: 0 },
  };
  private readonly states = Object.values(this.entries);
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

  get shieldCharges(): number {
    return this.entries.shield.charges;
  }

  advance(deltaMs: number): void {
    if (this.disposed || !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    for (const effect of this.states) {
      effect.remainingMs = Math.max(0, effect.remainingMs - deltaMs);
      if (effect.remainingMs === 0) effect.charges = 0;
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
  }

  dispose(): void {
    this.reset();
    this.disposed = true;
  }
}

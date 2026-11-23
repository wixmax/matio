import type { EffectsConfig, EffectType } from '../types/effects';

interface EffectState {
  remainingMs: number;
  charges: number;
}

const EFFECT_TYPES = ['shield', 'magnet'] as const satisfies readonly EffectType[];

/** One instance per attempt. Only the caller's gameplay delta advances time. */
export class ActiveEffects {
  private readonly entries: Record<EffectType, EffectState> = {
    shield: { remainingMs: 0, charges: 0 },
    magnet: { remainingMs: 0, charges: 0 },
  };
  private disposed = false;

  constructor(private readonly config: EffectsConfig) {}

  activate(type: EffectType): void {
    if (this.disposed) return;
    const effect = this.entries[type];
    effect.remainingMs = this.config[type].durationMs;

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
    for (const type of EFFECT_TYPES) {
      const effect = this.entries[type];
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
    for (const type of EFFECT_TYPES) {
      this.entries[type].remainingMs = 0;
      this.entries[type].charges = 0;
    }
  }

  dispose(): void {
    this.reset();
    this.disposed = true;
  }
}

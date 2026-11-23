export type EffectType = 'shield' | 'magnet';

export interface EffectsConfig {
  readonly schemaVersion: 1;
  readonly shield: {
    readonly durationMs: number;
    readonly maxCharges: number;
    readonly chargesPerPickup: number;
  };
  readonly magnet: {
    readonly durationMs: number;
    readonly radius: number;
    readonly attractionSpeed: number;
    readonly collectionDistance: number;
  };
}

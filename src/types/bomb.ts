export interface BombConfig {
  readonly schemaVersion: 1;
  readonly bomb: {
    readonly maxInventory: number;
    readonly initialInventory: number;
    readonly throwVelocityX: number;
    readonly throwVelocityY: number;
    readonly gravity: number;
    readonly fuseMs: number;
    readonly explosionRadius: number;
    readonly damage: number;
    readonly throwCooldownMs: number;
    readonly maxActiveBombs: number;
  };
}

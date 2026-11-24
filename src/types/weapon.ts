/**
 * Weapon contracts (Phaser-free).
 *
 * Only Energy Ball Level 1 exists. The registry shape is intentionally small:
 * tuning lives in `content/config/weapons.json`, while weapon-specific runtime
 * behavior (trajectory, multi-shot, visual variants) still requires TypeScript.
 *
 * Units: `speed`/`initialVelocityY` use px/s, `gravity` px/s², timings use ms.
 */

export const WEAPON_SCHEMA_VERSION = 1 as const;

export const WEAPON_IDS = ['energy-ball'] as const;

export type WeaponId = (typeof WEAPON_IDS)[number];

export interface WeaponDefinition {
  /** Damage applied per accepted enemy hit (integer). */
  readonly damage: number;
  /** Horizontal launch speed in px/s, always applied in the facing direction. */
  readonly speed: number;
  /** Initial vertical velocity in px/s (negative moves up). */
  readonly initialVelocityY: number;
  /** Net downward acceleration in px/s², independent of world gravity config. */
  readonly gravity: number;
  /** Vertical restitution applied on floor/platform contact, 0..1. */
  readonly bounce: number;
  /** Minimum time between accepted shots in ms. */
  readonly cooldownMs: number;
  /** Maximum projectile flight time in ms. */
  readonly lifetimeMs: number;
  /** Concurrent projectiles allowed for this weapon. */
  readonly maxActiveProjectiles: number;
  /** Enemies a single projectile may damage before it is consumed. */
  readonly maxTargets: number;
  /** Temporary ability window granted by one pickup, in ms. */
  readonly durationMs: number;
}

export interface WeaponConfig {
  readonly schemaVersion: typeof WEAPON_SCHEMA_VERSION;
  readonly weapons: Readonly<Record<WeaponId, WeaponDefinition>>;
}

/**
 * Pickup object types that grant a weapon ability. Each maps to exactly one
 * weapon ID; adding a second weapon still requires code plus a registry entry.
 */
export const WEAPON_PICKUP_TYPES = ['energy-flower'] as const;

export type WeaponPickupType = (typeof WEAPON_PICKUP_TYPES)[number];

export const WEAPON_PICKUP_TO_WEAPON: Readonly<Record<WeaponPickupType, WeaponId>> = {
  'energy-flower': 'energy-ball',
};

export function isWeaponId(value: string): value is WeaponId {
  return (WEAPON_IDS as readonly string[]).includes(value);
}

export function isWeaponPickupType(value: string): value is WeaponPickupType {
  return (WEAPON_PICKUP_TYPES as readonly string[]).includes(value);
}

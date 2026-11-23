/**
 * Combat configuration and pure combat contracts (Phaser-free).
 *
 * `content/config/combat.json` owns player health, invulnerability, knockback,
 * stomp tolerance and feedback timings. Rules live in `systems/combat-rules.ts`
 * and `systems/player-health.ts`.
 */

export const COMBAT_SCHEMA_VERSION = 1 as const;

export interface CombatPlayerConfig {
  readonly maxHealth: number;
  /** Health at the start of a fresh attempt (1..maxHealth). */
  readonly startingHealth: number;
  /** Damage immunity window after a successful hit, in milliseconds. */
  readonly invulnerabilityMs: number;
  /** Horizontal knockback speed (px/s) applied away from the enemy. */
  readonly knockbackVelocityX: number;
  /** Vertical knockback speed (px/s); negative values push upwards. */
  readonly knockbackVelocityY: number;
  /** Brief input lock after a hit (ms); movement resumes afterwards. */
  readonly inputLockMs: number;
  /** Total duration of the damage flash (ms). */
  readonly damageFlashDurationMs: number;
  /** Flash toggle interval (ms). */
  readonly damageFlashIntervalMs: number;
}

export interface CombatStompConfig {
  /** Upward player velocity after a successful stomp (px/s, negative = up). */
  readonly bounceVelocity: number;
  /**
   * Vertical tolerance used with the previous-frame player body bottom to
   * decide whether a contact is a top contact (px).
   */
  readonly topContactTolerancePx: number;
}

export interface CombatConfig {
  readonly schemaVersion: typeof COMBAT_SCHEMA_VERSION;
  readonly player: CombatPlayerConfig;
  readonly stomp: CombatStompConfig;
}

/** Contact classification for one player/enemy collision step. */
export type EnemyContactKind = 'stomp' | 'damage';

export interface EnemyContactInput {
  /** True when the enemy archetype accepts regular stomp damage. */
  readonly enemyStompable: boolean;
  /** Player body top in the previous physics step. */
  readonly previousPlayerTop: number;
  /** Player body height in pixels. */
  readonly playerBodyHeight: number;
  /** Enemy body top in the current step. */
  readonly enemyTop: number;
  /** Vertical distance moved down during the last physics step. */
  readonly playerDeltaY: number;
  /** Current vertical velocity after Arcade separation (may already be 0). */
  readonly playerVelocityY: number;
  readonly topContactTolerancePx: number;
}

export interface HealthSnapshot {
  readonly health: number;
  readonly maxHealth: number;
  readonly invulnerable: boolean;
  readonly invulnerableRemainingMs: number;
}

export interface DamageResult extends HealthSnapshot {
  readonly applied: boolean;
  readonly died: boolean;
}

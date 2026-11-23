/**
 * External player tuning contract (schema version 1).
 *
 * The source of truth is `content/config/player.json`, imported and validated at
 * build time. Values are gameplay tuning, not visual constants.
 *
 * Units:
 * - speed / velocity: pixels per second (px/s)
 * - acceleration / deceleration / gravity: pixels per second squared (px/s²)
 * - coyote / buffer windows: milliseconds
 */

export const PLAYER_CONFIG_SCHEMA_VERSION = 1 as const;

export interface PlayerMovementConfig {
  /** Maximum horizontal speed, both directions (px/s). */
  maxSpeed: number;
  /** Horizontal acceleration while a direction is held (px/s²). */
  acceleration: number;
  /** Horizontal deceleration while no direction is held (px/s²). */
  deceleration: number;
  /** Initial vertical velocity of a jump (px/s, negative = upwards). */
  jumpVelocity: number;
  /** World gravity applied to the player (px/s², positive = downwards). */
  gravity: number;
  /** Terminal falling speed (px/s, positive). */
  maxFallSpeed: number;
  /** Grace period to jump after leaving a ledge (ms). */
  coyoteTimeMs: number;
  /** How long a jump press is remembered before landing (ms). */
  jumpBufferMs: number;
  /** Multiplier applied to upward velocity when jump is released early (0..1]. */
  jumpCutMultiplier: number;
}

export interface PlayerConfig {
  schemaVersion: typeof PLAYER_CONFIG_SCHEMA_VERSION;
  movement: PlayerMovementConfig;
}

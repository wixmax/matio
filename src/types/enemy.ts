/**
 * Enemy configuration and runtime contracts (Phaser-free).
 *
 * `content/config/enemies.json` owns every balance value (health, speed, score).
 * Enemy entities never hardcode archetype tuning.
 */

export const ENEMY_CONFIG_SCHEMA_VERSION = 1 as const;

/**
 * Behaviors implemented by `systems/enemy-behaviors.ts`.
 *
 * Adding a behavior name here is not enough to make it work: a matching pure
 * resolver and Enemy integration are required. JSON can only select existing
 * behavior implementations.
 */
export const ENEMY_BEHAVIORS = ['patrol'] as const;

export type EnemyBehavior = (typeof ENEMY_BEHAVIORS)[number];

export interface EnemyDefinition {
  /** Hit points. A stomp deals one damage; snails need two stomps. */
  readonly health: number;
  /** Horizontal patrol speed in px/s. */
  readonly speed: number;
  readonly behavior: EnemyBehavior;
  /** Whether a top contact can damage the enemy. Spiky enemies are false. */
  readonly stompable: boolean;
  /** Player health removed by a non-stomp contact. */
  readonly damage: number;
  /** Run score awarded once when the enemy is defeated. */
  readonly score: number;
}

export interface EnemiesConfig {
  readonly schemaVersion: typeof ENEMY_CONFIG_SCHEMA_VERSION;
  /** Archetype ID (kebab-case) -> definition. */
  readonly enemies: Readonly<Record<string, EnemyDefinition>>;
}

/**
 * Horizontal patrol extents in world pixels, measured from body edge to body
 * edge. Authored as tile columns `minX..maxX` (inclusive) and converted with:
 *
 *   left  = minX * tileSize
 *   right = (maxX + 1) * tileSize
 */
export interface EnemyPatrolWorldBounds {
  readonly left: number;
  readonly right: number;
}

/**
 * A validated enemy converted to world pixels.
 *
 * `x`/`y` is the bottom-center (feet) anchor of the authored cell, matching the
 * player and goal convention. Collectibles keep their separate cell-center
 * convention.
 */
export interface EnemyPlacement {
  /** Stable deterministic identity inside one level run. */
  readonly key: string;
  readonly enemyId: string;
  readonly x: number;
  readonly y: number;
  readonly patrol: EnemyPatrolWorldBounds;
}

/** Minimal axis-aligned rectangle used for allocation-free ledge probing. */
export interface EnemyGroundRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Solid terrain rectangles used for allocation-free ledge probing. */
export type EnemyGroundRects = readonly EnemyGroundRect[];

/** Result of one patrol simulation step. */
export interface PatrolStepResult {
  readonly direction: -1 | 1;
  readonly velocityX: number;
}

export interface EnemyDamageResult {
  readonly applied: boolean;
  readonly defeated: boolean;
  readonly remainingHealth: number;
}

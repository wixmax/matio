import type {
  EnemyGroundRects,
  PatrolStepResult,
} from '../types/enemy';

/**
 * Pure patrol behavior shared by every archetype.
 *
 * Rules, in deterministic order:
 * 1. Reverse when Arcade reports a blocking wall on the current side.
 * 2. Reverse at the authored patrol bounds (body edge extents).
 * 3. Reverse when grounded and the next step has no solid terrain below
 *    (ledge/water safety). The probe uses the level's solid rectangles, so it
 *    allocates nothing per frame.
 *
 * The resolver returns a velocity but never teleports the body; Arcade Physics
 * remains the only thing that moves enemies.
 */

export interface PatrolStepInput {
  readonly direction: -1 | 1;
  readonly speed: number;
  readonly bodyLeft: number;
  readonly bodyRight: number;
  readonly bodyBottom: number;
  readonly patrolLeft: number;
  readonly patrolRight: number;
  readonly blockedLeft: boolean;
  readonly blockedRight: boolean;
  readonly grounded: boolean;
  readonly groundRects: EnemyGroundRects;
}

/** Distance ahead of the body edge used for the ledge probe (px). */
const EDGE_PROBE_AHEAD_PX = 2;

/** Distance below the feet used for the ledge probe (px). */
const EDGE_PROBE_BELOW_PX = 2;

export function resolvePatrolStep(input: PatrolStepInput): PatrolStepResult {
  let direction = input.direction;

  if (input.blockedLeft) {
    direction = 1;
  } else if (input.blockedRight) {
    direction = -1;
  }

  if (direction === -1 && input.bodyLeft <= input.patrolLeft) {
    direction = 1;
  } else if (direction === 1 && input.bodyRight >= input.patrolRight) {
    direction = -1;
  }

  if (input.grounded && input.groundRects.length > 0) {
    const probeX =
      direction === 1
        ? input.bodyRight + EDGE_PROBE_AHEAD_PX
        : input.bodyLeft - EDGE_PROBE_AHEAD_PX;
    const probeY = input.bodyBottom + EDGE_PROBE_BELOW_PX;

    if (!hasGroundAt(input.groundRects, probeX, probeY)) {
      direction = direction === 1 ? -1 : 1;
    }
  }

  return {
    direction,
    velocityX: direction * Math.max(0, input.speed),
  };
}

/** True when the point lies inside at least one solid terrain rectangle. */
export function hasGroundAt(
  rects: EnemyGroundRects,
  x: number,
  y: number,
): boolean {
  for (const rect of rects) {
    if (
      x >= rect.x &&
      x < rect.x + rect.width &&
      y >= rect.y &&
      y < rect.y + rect.height
    ) {
      return true;
    }
  }

  return false;
}

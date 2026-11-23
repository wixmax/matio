import type { EnemyContactInput, EnemyContactKind } from '../types/combat';

/**
 * Pure enemy-contact classification shared by all archetypes.
 *
 * A stomp requires BOTH:
 * 1. the player actually moved down this physics step, and
 * 2. the previous-step player body bottom was at or above the enemy body top
 *    (within a configured tolerance).
 *
 * Checking only the current body positions or only downward velocity is
 * unreliable: Arcade separation can zero `velocity.y` before the collision
 * callback, and a player falling beside an enemy can overlap it horizontally
 * while descending. Using the previous-step bottom together with the enemy top
 * distinguishes a true top contact from a side contact.
 *
 * Non-stompable archetypes (spiky) always resolve as damage, even on a clean
 * top contact.
 */
export function classifyEnemyContact(input: EnemyContactInput): EnemyContactKind {
  if (!input.enemyStompable) {
    return 'damage';
  }

  const descending = input.playerDeltaY > 0 || input.playerVelocityY > 0;

  if (!descending) {
    return 'damage';
  }

  const tolerance = Math.max(0, input.topContactTolerancePx);
  const previousPlayerBottom = input.previousPlayerTop + input.playerBodyHeight;

  return previousPlayerBottom <= input.enemyTop + tolerance ? 'stomp' : 'damage';
}

/**
 * Horizontal knockback direction: push the player away from the enemy.
 * Ties push right so the result is deterministic.
 */
export function resolveKnockbackDirection(
  playerCenterX: number,
  enemyCenterX: number,
): -1 | 1 {
  return playerCenterX < enemyCenterX ? -1 : 1;
}

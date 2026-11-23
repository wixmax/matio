import type { MoveDirection, PlayerInputState } from '../types/player';

/**
 * Pure input resolution used by InputManager and covered by unit tests.
 */

export interface InputSources {
  readonly leftHeld: boolean;
  readonly rightHeld: boolean;
  readonly jumpHeld: boolean;
  /** A press that occurred since the previous poll (touch taps, queued events). */
  readonly jumpEvent: boolean;
  readonly previousJumpHeld: boolean;
}

/**
 * Left + right resolves to neutral deterministically, which prevents the player
 * from drifting or jittering when both directions are held.
 */
export function resolveMoveDirection(leftHeld: boolean, rightHeld: boolean): MoveDirection {
  if (leftHeld === rightHeld) {
    return 0;
  }

  return leftHeld ? -1 : 1;
}

/**
 * Builds the normalized snapshot for the Player.
 *
 * `jumpPressed` is true when a queued press exists or when the jump control
 * transitions from released to held. Holding the control does not repeat it.
 */
export function computePlayerInputState(sources: InputSources): PlayerInputState {
  return {
    moveX: resolveMoveDirection(sources.leftHeld, sources.rightHeld),
    jumpPressed: sources.jumpEvent || (sources.jumpHeld && !sources.previousJumpHeld),
    jumpHeld: sources.jumpHeld,
  };
}

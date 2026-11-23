/**
 * Pure player-facing contracts shared by the entity, input layer and debug UI.
 * This module must stay free of Phaser imports so it can be used in Node tests.
 */

/** Horizontal intent. Left + right always resolves to `0` (neutral). */
export type MoveDirection = -1 | 0 | 1;

/**
 * Normalized input snapshot consumed by the Player entity.
 *
 * `jumpPressed` is a one-frame edge (or a queued tap from touch), while
 * `jumpHeld` stays true for as long as any jump control is held. The Player
 * never knows which physical device produced these values.
 */
export interface PlayerInputState {
  readonly moveX: MoveDirection;
  readonly jumpPressed: boolean;
  readonly jumpHeld: boolean;
}

export type PlayerVisualState = 'idle' | 'running' | 'rising' | 'falling' | 'landing';

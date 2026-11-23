/**
 * Minimal gameplay flow model.
 *
 * The scene owns the value; this module only documents the legal states and
 * keeps the "exactly once" completion rule testable without Phaser.
 */
export type GameplayState =
  | 'loading'
  | 'playing'
  | 'completing'
  | 'results'
  | 'gameover'
  | 'error';

/** Collection and goal overlaps may only start a completion from `playing`. */
export function canStartCompletion(state: GameplayState): boolean {
  return state === 'playing';
}

/**
 * Terminal failure may only start once, from `playing`. A victory or an
 * existing Game Over can never transition again.
 */
export function canStartGameOver(state: GameplayState): boolean {
  return state === 'playing';
}

/** Input/collection updates only run while actively playing. */
export function isGameplayActive(state: GameplayState): boolean {
  return state === 'playing';
}

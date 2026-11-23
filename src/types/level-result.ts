import type { LevelRating } from './scoring';

/**
 * Plain data passed from GameScene to ResultScene.
 *
 * It contains no Phaser references so it stays valid after the gameplay scene
 * shuts down and all of its display objects are destroyed.
 */
export interface LevelResultData {
  readonly levelId: string;
  readonly levelName: string;
  readonly collectedCoins: number;
  readonly totalCoins: number;
  readonly collectedStars: number;
  readonly totalCollectibleStars: number;
  /** Final score including the one-time level completion bonus. */
  readonly score: number;
  /** Rating for this run (1..3). */
  readonly ratingStars: LevelRating;
  /** Best rating ever saved for this level. */
  readonly bestRatingStars: LevelRating;
  /** Best score ever saved for this level. */
  readonly bestScore: number;
  readonly isNewBest: boolean;
  /** Next level in the explicit order, or null for the final level. */
  readonly nextLevelId: string | null;
  /** False when localStorage is unavailable or a write failed. */
  readonly progressSaved: boolean;
}

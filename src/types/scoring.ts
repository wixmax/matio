/** Version for `content/config/scoring.json`. */
export const SCORING_SCHEMA_VERSION = 1 as const;

/** Victory rating. Distinct from collectible stars placed in a level. */
export type LevelRating = 1 | 2 | 3;

export interface ScoringPoints {
  readonly coin: number;
  readonly star: number;
  readonly levelComplete: number;
}

export interface ScoringRatingConfig {
  /** Fraction (0..1) of coins required for a 2-star rating. */
  readonly twoStarMinCoinRatio: number;
}

export interface ScoringConfig {
  readonly schemaVersion: typeof SCORING_SCHEMA_VERSION;
  readonly points: ScoringPoints;
  readonly rating: ScoringRatingConfig;
}

export interface RunCollectibleCounts {
  readonly coins: number;
  readonly stars: number;
}

export interface RunScoreBreakdown {
  readonly coinPoints: number;
  readonly starPoints: number;
  /**
   * Enemy defeat points. Omitted when the run has no defeats so a zero-enemy
   * level keeps the exact pre-Task-005 breakdown shape and total.
   */
  readonly enemyPoints?: number;
  readonly completionPoints: number;
  readonly total: number;
}

export interface RatingInput {
  readonly collectedCoins: number;
  readonly totalCoins: number;
  readonly collectedStars: number;
  readonly totalStars: number;
}

import type {
  LevelRating,
  RatingInput,
  RunCollectibleCounts,
  RunScoreBreakdown,
  ScoringConfig,
} from '../types/scoring';

/**
 * Deterministic score and rating rules.
 *
 * Score points come exclusively from validated configuration; this module has
 * no Phaser dependency. Rating stars are performance stars and are unrelated to
 * collectible stars placed in level JSON.
 */

export function computeRunScore(
  counts: RunCollectibleCounts,
  config: ScoringConfig,
): RunScoreBreakdown {
  const coins = normalizeCount(counts.coins);
  const stars = normalizeCount(counts.stars);

  const coinPoints = coins * config.points.coin;
  const starPoints = stars * config.points.star;
  const completionPoints = config.points.levelComplete;

  return {
    coinPoints,
    starPoints,
    completionPoints,
    total: coinPoints + starPoints + completionPoints,
  };
}

/** Score earned by collected objects only; the completion bonus is not added. */
export function computeCollectedPoints(
  counts: RunCollectibleCounts,
  config: ScoringConfig,
): number {
  return (
    normalizeCount(counts.coins) * config.points.coin +
    normalizeCount(counts.stars) * config.points.star
  );
}

/**
 * Rating policy (configurable ratio, fixed 1..3 bounds):
 * - 3 stars: at least one coin and one collectible star exist, and every one
 *   was collected. Requiring non-empty sets prevents empty levels from being
 *   "perfect" by vacuous truth.
 * - 2 stars: at least one coin exists and the collected coin ratio reaches the
 *   configured threshold.
 * - 1 star: any successful completion. A level with only stars can never award
 *   more than 1 star because the 2/3-star rules are coin-driven.
 */
export function computeRatingStars(input: RatingInput, config: ScoringConfig): LevelRating {
  const totalCoins = normalizeCount(input.totalCoins);
  const totalStars = normalizeCount(input.totalStars);
  const collectedCoins = clampCollected(input.collectedCoins, totalCoins);
  const collectedStars = clampCollected(input.collectedStars, totalStars);

  if (
    totalCoins > 0 &&
    totalStars > 0 &&
    collectedCoins === totalCoins &&
    collectedStars === totalStars
  ) {
    return 3;
  }

  if (totalCoins > 0) {
    const ratio = collectedCoins / totalCoins;

    if (ratio >= clampRatio(config.rating.twoStarMinCoinRatio)) {
      return 2;
    }
  }

  return 1;
}

function normalizeCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function clampCollected(value: number, total: number): number {
  return Math.min(total, normalizeCount(value));
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

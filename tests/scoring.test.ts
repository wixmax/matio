import { describe, expect, it } from 'vitest';
import { computeCollectedPoints, computeRatingStars, computeRunScore } from '../src/systems/scoring';
import type { ScoringConfig } from '../src/types/scoring';

const CONFIG: ScoringConfig = {
  schemaVersion: 1,
  points: { coin: 100, star: 500, levelComplete: 1000 },
  rating: { twoStarMinCoinRatio: 0.7 },
};

describe('score - deterministic calculation', () => {
  it('matches the documented example (5 coins + 2 stars + completion)', () => {
    expect(computeRunScore({ coins: 5, stars: 2 }, CONFIG)).toEqual({
      coinPoints: 500,
      starPoints: 1000,
      completionPoints: 1000,
      total: 2500,
    });
  });

  it('awards the completion bonus even with no collectibles', () => {
    expect(computeRunScore({ coins: 0, stars: 0 }, CONFIG).total).toBe(1000);
  });

  it('separates collected points from the completion bonus', () => {
    expect(computeCollectedPoints({ coins: 5, stars: 2 }, CONFIG)).toBe(1500);
  });

  it('clamps invalid counts instead of producing negative scores', () => {
    const breakdown = computeRunScore({ coins: -3, stars: Number.NaN }, CONFIG);

    expect(breakdown.coinPoints).toBe(0);
    expect(breakdown.starPoints).toBe(0);
    expect(breakdown.total).toBe(1000);
  });

  it('is deterministic for repeated calls', () => {
    expect(computeRunScore({ coins: 7, stars: 1 }, CONFIG)).toEqual(
      computeRunScore({ coins: 7, stars: 1 }, CONFIG),
    );
  });
});

describe('rating - 1..3 policy', () => {
  it('gives one star for a plain completion', () => {
    expect(
      computeRatingStars(
        { collectedCoins: 0, totalCoins: 10, collectedStars: 0, totalStars: 2 },
        CONFIG,
      ),
    ).toBe(1);
  });

  it('gives two stars at the configured coin ratio', () => {
    expect(
      computeRatingStars(
        { collectedCoins: 7, totalCoins: 10, collectedStars: 0, totalStars: 2 },
        CONFIG,
      ),
    ).toBe(2);
  });

  it('stays at one star just below the ratio', () => {
    expect(
      computeRatingStars(
        { collectedCoins: 6, totalCoins: 10, collectedStars: 1, totalStars: 2 },
        CONFIG,
      ),
    ).toBe(1);
  });

  it('gives three stars only when every coin and collectible star is collected', () => {
    expect(
      computeRatingStars(
        { collectedCoins: 10, totalCoins: 10, collectedStars: 2, totalStars: 2 },
        CONFIG,
      ),
    ).toBe(3);

    expect(
      computeRatingStars(
        { collectedCoins: 10, totalCoins: 10, collectedStars: 1, totalStars: 2 },
        CONFIG,
      ),
    ).toBe(2);
  });

  it('cannot award 2 or 3 stars when the level has no coins', () => {
    expect(
      computeRatingStars(
        { collectedCoins: 0, totalCoins: 0, collectedStars: 2, totalStars: 2 },
        CONFIG,
      ),
    ).toBe(1);
    expect(
      computeRatingStars(
        { collectedCoins: 0, totalCoins: 0, collectedStars: 0, totalStars: 0 },
        CONFIG,
      ),
    ).toBe(1);
  });

  it('cannot award 3 stars when the level has no collectible stars', () => {
    expect(
      computeRatingStars(
        { collectedCoins: 10, totalCoins: 10, collectedStars: 0, totalStars: 0 },
        CONFIG,
      ),
    ).toBe(2);
  });

  it('clamps collected counts to the available totals', () => {
    expect(
      computeRatingStars(
        { collectedCoins: 99, totalCoins: 10, collectedStars: 99, totalStars: 2 },
        CONFIG,
      ),
    ).toBe(3);
  });

  it('never returns a rating outside 1..3', () => {
    const ratings = [
      computeRatingStars(
        { collectedCoins: 0, totalCoins: 0, collectedStars: 0, totalStars: 0 },
        CONFIG,
      ),
      computeRatingStars(
        { collectedCoins: 10, totalCoins: 10, collectedStars: 2, totalStars: 2 },
        CONFIG,
      ),
    ];

    for (const rating of ratings) {
      expect(rating).toBeGreaterThanOrEqual(1);
      expect(rating).toBeLessThanOrEqual(3);
    }
  });

  it('honours a changed ratio from configuration', () => {
    const strict: ScoringConfig = { ...CONFIG, rating: { twoStarMinCoinRatio: 1 } };

    expect(
      computeRatingStars(
        { collectedCoins: 9, totalCoins: 10, collectedStars: 0, totalStars: 2 },
        strict,
      ),
    ).toBe(1);
    expect(
      computeRatingStars(
        { collectedCoins: 10, totalCoins: 10, collectedStars: 0, totalStars: 2 },
        strict,
      ),
    ).toBe(2);
  });
});

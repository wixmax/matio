import { describe, expect, it } from 'vitest';
import { applyLevelCompletion } from '../src/systems/save-progress';
import type { LevelOrderConfig } from '../src/types/progression';
import type { SaveData } from '../src/types/save';

const ORDER: LevelOrderConfig = {
  schemaVersion: 1,
  levels: ['world-01-level-01', 'world-01-level-02', 'world-01-level-03'],
};

const EMPTY_SAVE: SaveData = {
  saveVersion: 1,
  unlockedLevelIds: ['world-01-level-01'],
  levels: {},
};

describe('applyLevelCompletion - records and unlocks', () => {
  it('records the first completion and unlocks the next level', () => {
    const update = applyLevelCompletion(
      EMPTY_SAVE,
      {
        levelId: 'world-01-level-01',
        score: 2500,
        ratingStars: 3,
        collectedCoins: 12,
        collectedStars: 2,
      },
      ORDER,
    );

    expect(update.recorded).toBe(true);
    expect(update.isNewBest).toBe(true);
    expect(update.nextLevelId).toBe('world-01-level-02');
    expect(update.save.unlockedLevelIds).toEqual([
      'world-01-level-01',
      'world-01-level-02',
    ]);
    expect(update.save.levels['world-01-level-01']).toEqual({
      completed: true,
      bestScore: 2500,
      bestRatingStars: 3,
      bestCollectedCoins: 12,
      bestCollectedStars: 2,
    });
  });

  it('keeps the best result when a replay is worse', () => {
    const first = applyLevelCompletion(
      EMPTY_SAVE,
      {
        levelId: 'world-01-level-01',
        score: 2500,
        ratingStars: 3,
        collectedCoins: 12,
        collectedStars: 2,
      },
      ORDER,
    );

    const second = applyLevelCompletion(
      first.save,
      {
        levelId: 'world-01-level-01',
        score: 1200,
        ratingStars: 1,
        collectedCoins: 2,
        collectedStars: 0,
      },
      ORDER,
    );

    expect(second.isNewBest).toBe(false);
    expect(second.record).toEqual(first.record);
  });

  it('improves records monotonically across replays', () => {
    const first = applyLevelCompletion(
      EMPTY_SAVE,
      {
        levelId: 'world-01-level-01',
        score: 1000,
        ratingStars: 1,
        collectedCoins: 0,
        collectedStars: 0,
      },
      ORDER,
    );

    const second = applyLevelCompletion(
      first.save,
      {
        levelId: 'world-01-level-01',
        score: 3100,
        ratingStars: 2,
        collectedCoins: 7,
        collectedStars: 1,
      },
      ORDER,
    );

    expect(second.isNewBest).toBe(true);
    expect(second.record).toEqual({
      completed: true,
      bestScore: 3100,
      bestRatingStars: 2,
      bestCollectedCoins: 7,
      bestCollectedStars: 1,
    });
  });

  it('does not lower an independently higher best rating or collection count', () => {
    const first = applyLevelCompletion(
      EMPTY_SAVE,
      {
        levelId: 'world-01-level-01',
        score: 3000,
        ratingStars: 3,
        collectedCoins: 12,
        collectedStars: 2,
      },
      ORDER,
    );

    const second = applyLevelCompletion(
      first.save,
      {
        levelId: 'world-01-level-01',
        score: 3200,
        ratingStars: 2,
        collectedCoins: 10,
        collectedStars: 1,
      },
      ORDER,
    );

    expect(second.record.bestScore).toBe(3200);
    expect(second.record.bestRatingStars).toBe(3);
    expect(second.record.bestCollectedCoins).toBe(12);
    expect(second.record.bestCollectedStars).toBe(2);
  });

  it('is idempotent when the same completion is applied twice', () => {
    const input = {
      levelId: 'world-01-level-01',
      score: 2500,
      ratingStars: 3 as const,
      collectedCoins: 12,
      collectedStars: 2,
    };
    const first = applyLevelCompletion(EMPTY_SAVE, input, ORDER);
    const second = applyLevelCompletion(first.save, input, ORDER);

    expect(second.save).toEqual(first.save);
    expect(second.isNewBest).toBe(false);
  });

  it('records and unlocks a level completed out of order through the dev selector', () => {
    const update = applyLevelCompletion(
      EMPTY_SAVE,
      {
        levelId: 'world-01-level-03',
        score: 1000,
        ratingStars: 1,
        collectedCoins: 0,
        collectedStars: 0,
      },
      ORDER,
    );

    expect(update.save.unlockedLevelIds).toEqual([
      'world-01-level-01',
      'world-01-level-03',
    ]);
    expect(update.recorded).toBe(true);
  });

  it('handles the final level without inventing a next level', () => {    const update = applyLevelCompletion(
      {
        saveVersion: 1,
        unlockedLevelIds: ['world-01-level-01', 'world-01-level-02', 'world-01-level-03'],
        levels: {},
      },
      {
        levelId: 'world-01-level-03',
        score: 4000,
        ratingStars: 2,
        collectedCoins: 20,
        collectedStars: 3,
      },
      ORDER,
    );

    expect(update.nextLevelId).toBeNull();
    expect(update.save.unlockedLevelIds).toEqual([
      'world-01-level-01',
      'world-01-level-02',
      'world-01-level-03',
    ]);
  });

  it('does not record a level outside the campaign order', () => {
    const update = applyLevelCompletion(
      EMPTY_SAVE,
      {
        levelId: 'world-02-level-01',
        score: 5000,
        ratingStars: 3,
        collectedCoins: 10,
        collectedStars: 2,
      },
      ORDER,
    );

    expect(update.recorded).toBe(false);
    expect(update.nextLevelId).toBeNull();
    expect(update.save).toEqual(EMPTY_SAVE);
  });
});

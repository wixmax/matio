import type { LevelOrderConfig } from '../types/progression';
import type { LevelCompletionInput, LevelRecord, SaveData } from '../types/save';
import type { LevelRating } from '../types/scoring';
import { getNextLevelId, sortLevelIdsByOrder } from './progression';

export interface CompletionUpdate {
  readonly save: SaveData;
  readonly record: LevelRecord;
  readonly isNewBest: boolean;
  readonly nextLevelId: string | null;
  /** False when the level is not part of the explicit campaign order. */
  readonly recorded: boolean;
}

const EMPTY_RECORD: LevelRecord = {
  completed: true,
  bestScore: 0,
  bestRatingStars: 1,
  bestCollectedCoins: 0,
  bestCollectedStars: 0,
};

/**
 * Applies a completed run to a save.
 *
 * Pure and idempotent: every best field uses `Math.max`, so replaying a level
 * with a worse result never reduces a record, and applying the same result
 * twice produces the same save. Unlocking is driven only by the explicit level
 * order.
 */
export function applyLevelCompletion(
  save: SaveData,
  input: LevelCompletionInput,
  order: LevelOrderConfig,
): CompletionUpdate {
  const previous = save.levels[input.levelId];
  const nextLevelId = getNextLevelId(order, input.levelId);
  const inCampaign = order.levels.includes(input.levelId);

  if (!inCampaign) {
    return {
      save,
      record: previous ?? EMPTY_RECORD,
      isNewBest: false,
      nextLevelId: null,
      recorded: false,
    };
  }

  const record: LevelRecord = {
    completed: true,
    bestScore: Math.max(previous?.bestScore ?? 0, input.score),
    bestRatingStars: maxRating(previous?.bestRatingStars ?? 1, input.ratingStars),
    bestCollectedCoins: Math.max(previous?.bestCollectedCoins ?? 0, input.collectedCoins),
    bestCollectedStars: Math.max(previous?.bestCollectedStars ?? 0, input.collectedStars),
  };

  const unlockedLevelIds = sortLevelIdsByOrder(
    [
      ...save.unlockedLevelIds,
      input.levelId,
      ...(nextLevelId === null ? [] : [nextLevelId]),
    ],
    order,
  );

  return {
    save: {
      saveVersion: save.saveVersion,
      unlockedLevelIds,
      levels: { ...save.levels, [input.levelId]: record },
    },
    record,
    isNewBest: previous === undefined || input.score > previous.bestScore,
    nextLevelId,
    recorded: true,
  };
}

function maxRating(current: LevelRating, incoming: LevelRating): LevelRating {
  return current >= incoming ? current : incoming;
}

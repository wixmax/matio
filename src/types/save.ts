import type { LevelRating } from './scoring';

/** Current local save schema version. Bump only with a migration. */
export const SAVE_VERSION = 1 as const;

/**
 * Best records for one completed level.
 *
 * Every field is monotonic: replaying a level can only improve records.
 * Collectible star counts here refer to physical collectibles, never rating.
 */
export interface LevelRecord {
  readonly completed: boolean;
  readonly bestScore: number;
  readonly bestRatingStars: LevelRating;
  readonly bestCollectedCoins: number;
  readonly bestCollectedStars: number;
}

/**
 * Versioned local save.
 *
 * No Phaser objects, scene references or transient run state are stored.
 * `levels` only contains entries for levels that have been completed.
 */
export interface SaveData {
  readonly saveVersion: typeof SAVE_VERSION;
  readonly unlockedLevelIds: readonly string[];
  readonly levels: Readonly<Record<string, LevelRecord>>;
}

export interface LevelCompletionInput {
  readonly levelId: string;
  readonly score: number;
  readonly ratingStars: LevelRating;
  readonly collectedCoins: number;
  readonly collectedStars: number;
}

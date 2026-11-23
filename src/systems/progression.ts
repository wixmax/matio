import type { LevelOrderConfig } from '../types/progression';
import type { ValidationError } from '../types/validation';

/**
 * Pure progression rules. Navigation lives in scenes; unlock decisions live
 * here so they can be unit-tested and reused by the menu, GameScene and result
 * screen.
 */

/** The first configured level is always unlocked for a new save. */
export function createInitialUnlockedLevelIds(order: LevelOrderConfig): string[] {
  const first = order.levels[0];

  return first === undefined ? [] : [first];
}

export function isLevelUnlocked(
  unlockedLevelIds: readonly string[],
  levelId: string,
): boolean {
  return unlockedLevelIds.includes(levelId);
}

/** Next level in explicit order, or null for the final level / unknown ID. */
export function getNextLevelId(order: LevelOrderConfig, levelId: string): string | null {
  const index = order.levels.indexOf(levelId);

  if (index < 0) {
    return null;
  }

  return order.levels[index + 1] ?? null;
}

/** Adds the next level (if any) and normalizes the list to campaign order. */
export function unlockLevelAfterCompletion(
  unlockedLevelIds: readonly string[],
  order: LevelOrderConfig,
  completedLevelId: string,
): string[] {
  const nextLevelId = getNextLevelId(order, completedLevelId);
  const requested = nextLevelId === null ? [...unlockedLevelIds] : [...unlockedLevelIds, nextLevelId];

  return sortLevelIdsByOrder(requested, order);
}

/** Filters unknown IDs and orders the list exactly as the campaign does. */
export function sortLevelIdsByOrder(
  levelIds: readonly string[],
  order: LevelOrderConfig,
): string[] {
  const requested = new Set(levelIds);

  return order.levels.filter((levelId) => requested.has(levelId));
}

/**
 * Cross-checks the explicit order against discovered level IDs.
 *
 * Filesystem discovery order is never used as gameplay order; this validation
 * only guarantees that every configured ID exists.
 */
export function validateLevelOrderReferences(
  order: LevelOrderConfig,
  availableLevelIds: readonly string[],
): ValidationError[] {
  const available = new Set(availableLevelIds);
  const errors: ValidationError[] = [];

  order.levels.forEach((levelId, index) => {
    if (!available.has(levelId)) {
      errors.push({
        path: `$.levels[${index}]`,
        message: `references level "${levelId}", which is not available in content/levels.`,
      });
    }
  });

  return errors;
}

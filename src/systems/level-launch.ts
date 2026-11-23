import { DEFAULT_LEVEL_ID } from '../core/level-config';

export interface LevelLaunchRequest {
  readonly levelId: string;
  /**
   * True only for the development `?level=` selector. That selector is the one
   * documented path allowed to open a level whose progression lock is closed.
   */
  readonly bypassLock: boolean;
}

const LEVEL_QUERY_PARAM = 'level';

/**
 * Decides which level GameScene should load.
 *
 * Priority:
 * 1. Development `?level=` selector (dev only; overrides menu navigation so the
 *    documented debug URL always works, and bypasses progression locks).
 * 2. Explicit scene data (menu/result/retry navigation).
 * 3. Central default level.
 *
 * Production ignores query parameters entirely, so a crafted URL cannot skip
 * progression.
 */
export function resolveLevelLaunch(
  explicitLevelId: string | undefined,
  search: string,
  isDev: boolean,
): LevelLaunchRequest {
  if (isDev) {
    const requested = new URLSearchParams(search).get(LEVEL_QUERY_PARAM)?.trim();

    if (requested !== undefined && requested.length > 0) {
      return { levelId: requested, bypassLock: true };
    }
  }

  const explicit = explicitLevelId?.trim();

  if (explicit !== undefined && explicit.length > 0) {
    return { levelId: explicit, bypassLock: false };
  }

  return { levelId: DEFAULT_LEVEL_ID, bypassLock: false };
}

/**
 * Central level selection and camera/fall behavior constants.
 * Keeping the default ID here prevents scattered hardcoded strings.
 */

export const DEFAULT_LEVEL_ID = 'world-01-level-01';
export const LEVEL_QUERY_PARAM = 'level';

/** Camera follow smoothing (0..1); 0.1 is a gentle side-scroller lerp. */
export const CAMERA_FOLLOW_LERP_X = 0.1;
export const CAMERA_FOLLOW_LERP_Y = 0.1;

/** Respawn when feet are this many tiles below the JSON-defined world height. */
export const FALL_RESPAWN_MARGIN_TILES = 2;

/**
 * Development level selector: `?level=world-01-level-02`.
 * Production builds always use the default level.
 */
export function resolveRequestedLevelId(search: string, isDev: boolean): string {
  if (!isDev) {
    return DEFAULT_LEVEL_ID;
  }

  const requested = new URLSearchParams(search).get(LEVEL_QUERY_PARAM)?.trim();

  return requested !== undefined && requested.length > 0 ? requested : DEFAULT_LEVEL_ID;
}

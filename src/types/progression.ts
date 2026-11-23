/** Version for `content/config/level-order.json`. */
export const LEVEL_ORDER_SCHEMA_VERSION = 1 as const;

/**
 * Explicit gameplay order. It is never inferred from file names or the
 * filesystem; a level missing from this list is not part of the campaign.
 */
export interface LevelOrderConfig {
  readonly schemaVersion: typeof LEVEL_ORDER_SCHEMA_VERSION;
  readonly levels: readonly string[];
}

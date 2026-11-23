import Phaser from 'phaser';
import type { LevelDefinition } from '../types/level';
import type {
  IgnoredObjectSummary,
  LevelGeometry,
  LevelLoadFailure,
} from '../types/level-runtime';
import { createLevelBackdrop } from '../factories/BackdropFactory';
import { createGoalMarker } from '../factories/GoalMarkerFactory';
import { createTerrain } from '../factories/TerrainFactory';
import { createLevelGeometry, findSolidTerrainAtCell, summarizeIgnoredObjects } from './level-geometry';

export interface LevelRuntime {
  readonly geometry: LevelGeometry;
  /** Static bodies that should be collided with the player. */
  readonly solids: Phaser.GameObjects.Rectangle[];
  readonly goal: Phaser.GameObjects.Container;
  readonly backdrop: Phaser.GameObjects.Graphics;
  readonly ignoredObjects: IgnoredObjectSummary;
}

export type LevelLoadResult =
  | { readonly ok: true; readonly runtime: LevelRuntime }
  | { readonly ok: false; readonly error: LevelLoadFailure };

/**
 * Phaser-aware level orchestration: converts a validated definition into
 * geometry, placeholder visuals, static bodies and a goal marker.
 *
 * It deliberately does not create the player, input, camera or colliders; those
 * are GameScene's wiring responsibilities.
 */
export function loadLevel(scene: Phaser.Scene, level: LevelDefinition): LevelLoadResult {
  const blockingTerrain = findSolidTerrainAtCell(level, level.spawn);

  if (blockingTerrain !== null) {
    return {
      ok: false,
      error: {
        code: 'unsafe-spawn',
        levelId: level.id,
        message: `Spawn cell (${level.spawn.x}, ${level.spawn.y}) overlaps solid ${blockingTerrain.type} terrain in level "${level.id}".`,
        details: [
          {
            path: '$.spawn',
            message: 'must point to an empty cell above solid ground.',
          },
        ],
      },
    };
  }

  const geometry = createLevelGeometry(level);
  const backdrop = createLevelBackdrop(scene, level);
  const terrain = createTerrain(scene, geometry);
  const goal = createGoalMarker(scene, geometry.goal);
  const ignoredObjects = summarizeIgnoredObjects(level);

  if (import.meta.env.DEV && ignoredObjects.total > 0) {
    console.info(
      `[LevelLoader] Level "${level.id}" contains ${ignoredObjects.total} object(s) (${formatObjectSummary(ignoredObjects)}); collectibles are not implemented yet, so they are ignored.`,
    );
  }

  return {
    ok: true,
    runtime: {
      geometry,
      solids: terrain.solids,
      goal,
      backdrop,
      ignoredObjects,
    },
  };
}

function formatObjectSummary(summary: IgnoredObjectSummary): string {
  return Object.entries(summary.byType)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');
}

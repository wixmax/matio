import Phaser from 'phaser';
import type { LevelDefinition } from '../types/level';
import type {
  IgnoredObjectSummary,
  LevelGeometry,
  LevelLoadFailure,
} from '../types/level-runtime';
import { createLevelBackdrop } from '../factories/BackdropFactory';
import { createCollectibles, type CollectibleRuntime } from '../factories/CollectibleFactory';
import { createGoalMarker, type GoalRuntime } from '../factories/GoalMarkerFactory';
import { createTerrain } from '../factories/TerrainFactory';
import {
  createLevelGeometry,
  findSolidTerrainAtCell,
  summarizeUnimplementedObjects,
} from './level-geometry';

export interface LevelRuntime {
  readonly geometry: LevelGeometry;
  /** Static bodies that should be collided with the player. */
  readonly solids: Phaser.GameObjects.Rectangle[];
  readonly goal: GoalRuntime;
  readonly backdrop: Phaser.GameObjects.Graphics;
  /** Coin/star instances and the group used for overlap. */
  readonly collectibles: CollectibleRuntime;
  /** Valid future object types (bomb/shield/magnet) deliberately not created. */
  readonly unimplementedObjects: IgnoredObjectSummary;
}

export type LevelLoadResult =
  | { readonly ok: true; readonly runtime: LevelRuntime }
  | { readonly ok: false; readonly error: LevelLoadFailure };

/**
 * Phaser-aware level orchestration: converts a validated definition into
 * geometry, placeholder visuals, static bodies, collectibles and a goal
 * marker/sensor.
 *
 * It deliberately does not create the player, input, camera, HUD or colliders;
 * those are GameScene's wiring responsibilities.
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
  const collectibles = createCollectibles(scene, geometry.collectibles);
  const unimplementedObjects = summarizeUnimplementedObjects(level);

  if (import.meta.env.DEV) {
    if (unimplementedObjects.total > 0) {
      console.info(
        `[LevelLoader] Level "${level.id}" contains ${unimplementedObjects.total} unimplemented object(s) (${formatObjectSummary(unimplementedObjects)}); they are preserved in JSON but not instantiated.`,
      );
    }

    console.info(
      `[LevelLoader] Level "${level.id}" collectibles: ${geometry.collectibleTotals.coins} coin(s), ${geometry.collectibleTotals.stars} collectible star(s).`,
    );
  }

  return {
    ok: true,
    runtime: {
      geometry,
      solids: terrain.solids,
      goal,
      backdrop,
      collectibles,
      unimplementedObjects,
    },
  };
}

function formatObjectSummary(summary: IgnoredObjectSummary): string {
  return Object.entries(summary.byType)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');
}

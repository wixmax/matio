import Phaser from 'phaser';
import type { EnemiesConfig } from '../types/enemy';
import type { LevelDefinition } from '../types/level';
import type {
  LevelGeometry,
  LevelLoadFailure,
} from '../types/level-runtime';
import { createLevelBackdrop } from '../factories/BackdropFactory';
import { createCollectibles, type CollectibleRuntime } from '../factories/CollectibleFactory';
import { createEnemies, type EnemyRuntime } from '../factories/EnemyFactory';
import { createGoalMarker, type GoalRuntime } from '../factories/GoalMarkerFactory';
import { createTerrain } from '../factories/TerrainFactory';
import { validateEnemyPlacements } from './enemy-config-validator';
import {
  createLevelGeometry,
  findSolidTerrainAtCell,
  solidTerrainRects,
} from './level-geometry';

export interface LevelRuntime {
  readonly geometry: LevelGeometry;
  /** Static bodies that should be collided with the player. */
  readonly solids: Phaser.GameObjects.Rectangle[];
  readonly goal: GoalRuntime;
  readonly backdrop: Phaser.GameObjects.Graphics;
  /** Score/effect pickup instances and the group used for overlap. */
  readonly collectibles: CollectibleRuntime;
  /** Enemy instances and the dynamic group used for collision/overlap. */
  readonly enemies: EnemyRuntime;
}

export interface LevelLoadOptions {
  /** Validated archetype registry used to resolve `enemyId` references. */
  readonly enemies: EnemiesConfig;
}

export type LevelLoadResult =
  | { readonly ok: true; readonly runtime: LevelRuntime }
  | { readonly ok: false; readonly error: LevelLoadFailure };

/**
 * Phaser-aware level orchestration: converts a validated definition into
 * geometry, placeholder visuals, static bodies, collectibles, enemies and a
 * goal marker/sensor.
 *
 * It deliberately does not create the player, input, camera, HUD or gameplay
 * colliders; those are GameScene/EnemySystem wiring responsibilities.
 */
export function loadLevel(
  scene: Phaser.Scene,
  level: LevelDefinition,
  options: LevelLoadOptions,
): LevelLoadResult {
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

  const enemyIssues = validateEnemyPlacements(level, options.enemies);

  if (enemyIssues.length > 0) {
    return {
      ok: false,
      error: {
        code: 'invalid-level',
        levelId: level.id,
        message: `Level "${level.id}" contains invalid enemy placement data.`,
        details: enemyIssues,
      },
    };
  }

  const blockedPickupIndex = level.objects.findIndex((object) =>
    (object.type === 'bomb' || object.type === 'shield' || object.type === 'magnet' ||
      object.type === 'growth-mushroom') &&
    findSolidTerrainAtCell(level, object) !== null,
  );
  const blockedPickup = level.objects[blockedPickupIndex];
  if (blockedPickup !== undefined) {
    return {
      ok: false,
      error: {
        code: 'invalid-level',
        levelId: level.id,
        message: `Level "${level.id}" contains a ${blockedPickup.type} pickup inside solid terrain.`,
        details: [{
          path: `$.objects[${blockedPickupIndex}]`,
          message: `cell (${blockedPickup.x}, ${blockedPickup.y}) must be empty.`,
        }],
      },
    };
  }

  const geometry = createLevelGeometry(level);
  const backdrop = createLevelBackdrop(scene, level);
  const terrain = createTerrain(scene, geometry);
  const goal = createGoalMarker(scene, geometry.goal);
  const collectibles = createCollectibles(scene, geometry.collectibles);
  const enemies = createEnemies(
    scene,
    geometry.enemies,
    options.enemies,
    solidTerrainRects(geometry),
  );
  if (import.meta.env.DEV) {
    console.info(
      `[LevelLoader] Level "${level.id}" collectibles: ${geometry.collectibleTotals.coins} coin(s), ${geometry.collectibleTotals.stars} collectible star(s); enemies: ${enemies.totalCount}.`,
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
      enemies,
    },
  };
}

import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import type { EnemiesConfig, EnemyGroundRects, EnemyPlacement } from '../types/enemy';

export interface EnemyRuntime {
  /** Dynamic physics group used for terrain collision and player overlap. */
  readonly group: Phaser.Physics.Arcade.Group;
  readonly enemies: readonly Enemy[];
  readonly totalCount: number;
}

/**
 * Instantiates validated enemy placements. The group exists even for levels
 * without enemies so scene wiring has no special case.
 */
export function createEnemies(
  scene: Phaser.Scene,
  placements: readonly EnemyPlacement[],
  config: EnemiesConfig,
  groundRects: EnemyGroundRects,
): EnemyRuntime {
  const group = scene.physics.add.group();
  const enemies = placements.map((placement) => {
    const definition = config.enemies[placement.enemyId];

    if (definition === undefined) {
      // LevelLoader rejects unknown archetypes before reaching the factory.
      throw new Error(`Enemy archetype "${placement.enemyId}" is not configured.`);
    }

    return new Enemy(scene, placement, definition, groundRects);
  });

  for (const enemy of enemies) {
    group.add(enemy);
  }

  return { group, enemies, totalCount: enemies.length };
}

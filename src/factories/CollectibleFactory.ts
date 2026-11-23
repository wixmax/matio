import Phaser from 'phaser';
import type { CollectiblePlacement } from '../types/collectible';
import { Collectible } from '../entities/Collectible';

export interface CollectibleRuntime {
  /** Physics group used by one player/collectibles overlap. */
  readonly group: Phaser.Physics.Arcade.Group;
}

/**
 * Instantiates validated placements. The group exists even for empty levels so
 * GameScene wiring has no special case.
 */
export function createCollectibles(
  scene: Phaser.Scene,
  placements: readonly CollectiblePlacement[],
): CollectibleRuntime {
  const group = scene.physics.add.group({ allowGravity: false, immovable: true });
  const instances = placements.map((placement) => new Collectible(scene, placement));

  for (const instance of instances) {
    group.add(instance);
  }

  return { group };
}

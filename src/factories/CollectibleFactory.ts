import Phaser from 'phaser';
import type { CollectiblePlacement } from '../types/collectible';
import { Collectible } from '../entities/Collectible';

export interface CollectibleRuntime {
  /** Physics group used by one player/collectibles overlap. */
  readonly group: Phaser.Physics.Arcade.Group;
  /**
   * Mutable list of live coins for the magnet. Block-released coins are appended
   * so they use the same attraction/collection path as authored coins.
   */
  readonly coins: Collectible[];
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

  return { group, coins: instances.filter((instance) => instance.collectibleType === 'coin') };
}

/**
 * Creates a block-released pickup and inserts it into the shared collectible
 * group. The caller disables its body during the emergence animation.
 */
export function createReleaseCollectible(
  scene: Phaser.Scene,
  group: Phaser.Physics.Arcade.Group,
  placement: CollectiblePlacement,
): Collectible {
  const collectible = new Collectible(scene, placement);
  group.add(collectible);
  return collectible;
}

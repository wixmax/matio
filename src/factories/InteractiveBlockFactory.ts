import Phaser from 'phaser';
import { InteractiveBlock } from '../entities/InteractiveBlock';
import type { InteractiveBlockPlacement } from '../types/level-runtime';

export interface InteractiveBlockRuntime {
  readonly blocks: readonly InteractiveBlock[];
  /**
   * The same instances exposed as collider targets. Broken blocks stay in the
   * array with a disabled body, so Arcade skips them without rebuilding arrays.
   */
  readonly bodies: readonly InteractiveBlock[];
}

/** Instantiates validated interactive-block placements with procedural art. */
export function createInteractiveBlocks(
  scene: Phaser.Scene,
  placements: readonly InteractiveBlockPlacement[],
): InteractiveBlockRuntime {
  const blocks = placements.map((placement) => new InteractiveBlock(scene, placement));

  return { blocks, bodies: blocks };
}

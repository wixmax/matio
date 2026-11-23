import Phaser from 'phaser';
import type { LevelGeometry, TerrainPlacement } from '../types/level-runtime';
import { PALETTE } from '../ui/theme';

export interface TerrainRuntime {
  /** Solid rectangles that need a player collider. */
  readonly solids: Phaser.GameObjects.Rectangle[];
}

/**
 * Creates placeholder visuals and one static Arcade body per solid area.
 *
 * Data geometry and rendering are separate: the body is always exactly the
 * JSON-derived rectangle; decorative strips never receive physics.
 */
export function createTerrain(
  scene: Phaser.Scene,
  geometry: LevelGeometry,
): TerrainRuntime {
  const solids: Phaser.GameObjects.Rectangle[] = [];

  for (const placement of geometry.terrain) {
    switch (placement.type) {
      case 'ground':
        solids.push(createGround(scene, placement));
        break;
      case 'platform':
        solids.push(createPlatform(scene, placement));
        break;
      case 'block':
        solids.push(createBlock(scene, placement));
        break;
      case 'water':
        createWater(scene, placement);
        break;
    }
  }

  return { solids };
}

function createGround(
  scene: Phaser.Scene,
  placement: TerrainPlacement,
): Phaser.GameObjects.Rectangle {
  const { rect } = placement;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  const body = scene.add
    .rectangle(centerX, centerY, rect.width, rect.height, PALETTE.soil)
    .setStrokeStyle(4, PALETTE.ink);
  scene.physics.add.existing(body, true);

  const capHeight = Math.min(20, rect.height);
  scene.add
    .rectangle(centerX, rect.y + capHeight / 2, rect.width, capHeight, PALETTE.grass)
    .setDepth(1);
  scene.add
    .rectangle(centerX, rect.y + capHeight + 3, rect.width, 6, PALETTE.grassDark)
    .setDepth(1);

  return body;
}

function createPlatform(
  scene: Phaser.Scene,
  placement: TerrainPlacement,
): Phaser.GameObjects.Rectangle {
  const { rect } = placement;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  const body = scene.add
    .rectangle(centerX, centerY, rect.width, rect.height, PALETTE.stone)
    .setStrokeStyle(4, PALETTE.ink);
  scene.physics.add.existing(body, true);

  const capHeight = Math.min(10, rect.height);
  scene.add
    .rectangle(centerX, rect.y + capHeight / 2, rect.width, capHeight, PALETTE.grass)
    .setDepth(1);

  return body;
}

function createBlock(
  scene: Phaser.Scene,
  placement: TerrainPlacement,
): Phaser.GameObjects.Rectangle {
  const { rect } = placement;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  const body = scene.add
    .rectangle(centerX, centerY, rect.width, rect.height, PALETTE.stoneDark)
    .setStrokeStyle(4, PALETTE.ink);
  scene.physics.add.existing(body, true);

  // Inner inset makes blocks readable as blocks rather than small platforms.
  scene.add
    .rectangle(centerX, centerY, Math.max(8, rect.width - 18), Math.max(8, rect.height - 18), PALETTE.stone)
    .setDepth(1);

  return body;
}

function createWater(scene: Phaser.Scene, placement: TerrainPlacement): void {
  const { rect } = placement;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  scene.add
    .rectangle(centerX, centerY, rect.width, rect.height, PALETTE.water, 0.72)
    .setStrokeStyle(3, PALETTE.waterLight, 0.8)
    .setDepth(2);

  scene.add
    .rectangle(centerX, rect.y + 5, rect.width, 10, PALETTE.waterLight, 0.85)
    .setDepth(3);
}

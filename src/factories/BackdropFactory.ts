import Phaser from 'phaser';
import type { LevelDefinition } from '../types/level';
import { PALETTE } from '../ui/theme';

interface HillColors {
  readonly far: number;
  readonly near: number;
}

const DEFAULT_HILLS: HillColors = { far: PALETTE.hillFar, near: PALETTE.hillNear };

const THEME_HILLS: Readonly<Record<string, HillColors>> = {
  meadow: DEFAULT_HILLS,
  cliffs: { far: PALETTE.cliffHillFar, near: PALETTE.cliffHillNear },
  valley: { far: PALETTE.valleyHillFar, near: PALETTE.valleyHillNear },
};

/**
 * Procedural, world-space backdrop. One Graphics object per level; it scrolls
 * with the camera and is intentionally cheap placeholder art.
 */
export function createLevelBackdrop(
  scene: Phaser.Scene,
  level: LevelDefinition,
): Phaser.GameObjects.Graphics {
  const worldWidth = level.size.width * level.tileSize;
  const worldHeight = level.size.height * level.tileSize;
  const hills = THEME_HILLS[level.theme ?? 'meadow'] ?? DEFAULT_HILLS;
  const graphics = scene.add.graphics().setDepth(-10);

  const sunX = Math.min(worldWidth - 220, 980);
  const sunY = worldHeight * 0.28;

  graphics.fillStyle(PALETTE.sunGlow, 0.28);
  graphics.fillCircle(sunX, sunY, 140);
  graphics.fillStyle(PALETTE.sun, 1);
  graphics.fillCircle(sunX, sunY, 76);

  for (let x = 160, index = 0; x < worldWidth; x += 720, index += 1) {
    const cloudY = worldHeight * (0.16 + (index % 3) * 0.1);
    drawCloud(graphics, x, cloudY, index % 2 === 0 ? 1 : 0.78);
  }

  for (let x = 120; x < worldWidth + 400; x += 760) {
    graphics.fillStyle(hills.far, 1);
    graphics.fillEllipse(x, worldHeight + 40, 940, 500);

    graphics.fillStyle(hills.near, 1);
    graphics.fillEllipse(x + 260, worldHeight + 50, 760, 380);
  }

  return graphics;
}

function drawCloud(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  alpha: number,
): void {
  graphics.fillStyle(PALETTE.cloud, alpha);
  graphics.fillCircle(x, y, 34);
  graphics.fillCircle(x + 42, y - 12, 46);
  graphics.fillCircle(x + 92, y + 2, 30);
  graphics.fillRect(x, y, 94, 34);
}

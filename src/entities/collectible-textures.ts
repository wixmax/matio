import Phaser from 'phaser';
import type { CollectibleType } from '../types/collectible';
import { PALETTE } from '../ui/theme';

/**
 * Procedural placeholder collectible art.
 *
 * Frame sizes and texture keys are stable so future sprite-atlas replacement
 * only changes this module; entity/physics code stays untouched.
 */

export const COLLECTIBLE_FRAME = {
  coin: { width: 40, height: 40, bodyWidth: 26, bodyHeight: 26 },
  star: { width: 48, height: 48, bodyWidth: 32, bodyHeight: 32 },
} as const;

export const COLLECTIBLE_TEXTURES: Readonly<Record<CollectibleType, string>> = {
  coin: 'matio-collectible-coin',
  star: 'matio-collectible-star',
};

export function ensureCollectibleTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(COLLECTIBLE_TEXTURES.coin)) {
    return;
  }

  drawCoinTexture(scene);
}

function drawCoinTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(COLLECTIBLE_TEXTURES.coin)) {
    return;
  }

  const graphics = scene.add.graphics();
  const centerX = COLLECTIBLE_FRAME.coin.width / 2;
  const centerY = COLLECTIBLE_FRAME.coin.height / 2;

  graphics.fillStyle(PALETTE.ink, 1);
  graphics.fillCircle(centerX, centerY, 17);
  graphics.fillStyle(PALETTE.sun, 1);
  graphics.fillCircle(centerX, centerY, 14);
  graphics.fillStyle(PALETTE.accent, 1);
  graphics.fillCircle(centerX, centerY, 10);
  graphics.fillStyle(PALETTE.sunGlow, 0.95);
  graphics.fillCircle(centerX - 4, centerY - 4, 4);
  graphics.lineStyle(2, PALETTE.accentDark, 1);
  graphics.strokeCircle(centerX, centerY, 11);

  graphics.generateTexture(
    COLLECTIBLE_TEXTURES.coin,
    COLLECTIBLE_FRAME.coin.width,
    COLLECTIBLE_FRAME.coin.height,
  );
  graphics.destroy();
}

/**
 * The star texture is created lazily too. It is kept in a separate function so a
 * future atlas can replace only the texture keys.
 */
export function ensureStarTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(COLLECTIBLE_TEXTURES.star)) {
    return;
  }

  const graphics = scene.add.graphics();
  const centerX = COLLECTIBLE_FRAME.star.width / 2;
  const centerY = COLLECTIBLE_FRAME.star.height / 2;

  graphics.fillStyle(PALETTE.ink, 1);
  graphics.fillPoints(starPoints(centerX, centerY, 22, 10), true);
  graphics.fillStyle(PALETTE.accent, 1);
  graphics.fillPoints(starPoints(centerX, centerY, 18, 8), true);
  graphics.fillStyle(PALETTE.sun, 1);
  graphics.fillPoints(starPoints(centerX, centerY - 1, 12, 5.5), true);

  graphics.generateTexture(
    COLLECTIBLE_TEXTURES.star,
    COLLECTIBLE_FRAME.star.width,
    COLLECTIBLE_FRAME.star.height,
  );
  graphics.destroy();
}

function starPoints(
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number,
): Phaser.Math.Vector2[] {
  const points: Phaser.Math.Vector2[] = [];
  const step = Math.PI / 5;

  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + index * step;

    points.push(
      new Phaser.Math.Vector2(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius,
      ),
    );
  }

  return points;
}

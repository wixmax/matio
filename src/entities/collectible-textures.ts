import Phaser from 'phaser';
import type { CollectiblePickupType } from '../types/collectible';
import type { EffectType } from '../types/effects';
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
  shield: { width: 40, height: 40, bodyWidth: 30, bodyHeight: 32 },
  magnet: { width: 40, height: 40, bodyWidth: 30, bodyHeight: 32 },
} as const;

export const COLLECTIBLE_TEXTURES: Readonly<Record<CollectiblePickupType, string>> = {
  coin: 'matio-collectible-coin',
  star: 'matio-collectible-star',
  shield: 'matio-collectible-shield',
  magnet: 'matio-collectible-magnet',
};

export function ensureEffectPickupTexture(scene: Phaser.Scene, type: EffectType): void {
  const key = COLLECTIBLE_TEXTURES[type];
  if (scene.textures.exists(key)) return;

  const graphics = scene.add.graphics();
  if (type === 'shield') {
    const outline = [
      new Phaser.Math.Vector2(6, 7), new Phaser.Math.Vector2(20, 3), new Phaser.Math.Vector2(34, 7),
      new Phaser.Math.Vector2(32, 25), new Phaser.Math.Vector2(20, 37), new Phaser.Math.Vector2(8, 25),
    ];
    graphics.fillStyle(PALETTE.waterLight);
    graphics.fillPoints(outline, true);
    graphics.lineStyle(3, PALETTE.ink);
    graphics.strokePoints(outline, true);
    graphics.lineStyle(3, PALETTE.white);
    graphics.lineBetween(20, 11, 20, 26);
    graphics.lineBetween(14, 18, 26, 18);
  } else {
    graphics.fillStyle(PALETTE.ink);
    graphics.fillRoundedRect(4, 6, 32, 30, 10);
    graphics.fillStyle(PALETTE.player);
    graphics.fillRoundedRect(7, 7, 26, 26, 8);
    graphics.fillStyle(PALETTE.ink);
    graphics.fillRect(16, 6, 8, 17);
    graphics.fillStyle(PALETTE.white);
    graphics.fillRect(7, 9, 9, 7);
    graphics.fillRect(24, 9, 9, 7);
  }
  const frame = COLLECTIBLE_FRAME[type];
  graphics.generateTexture(key, frame.width, frame.height);
  graphics.destroy();
}

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

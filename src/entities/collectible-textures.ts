import Phaser from 'phaser';
import type { CollectiblePickupType } from '../types/collectible';
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
  'growth-mushroom': { width: 40, height: 40, bodyWidth: 30, bodyHeight: 32 },
  'energy-flower': { width: 40, height: 40, bodyWidth: 30, bodyHeight: 32 },
} as const;

export const COLLECTIBLE_TEXTURES: Readonly<Record<CollectiblePickupType, string>> = {
  coin: 'matio-collectible-coin',
  star: 'matio-collectible-star',
  shield: 'matio-collectible-shield',
  magnet: 'matio-collectible-magnet',
  'growth-mushroom': 'matio-collectible-growth-mushroom',
  'energy-flower': 'matio-collectible-energy-flower',
};

/** Effect/power-up/weapon pickups share one procedural drawing entry point. */
export type NonScoringPickupType = Exclude<CollectiblePickupType, 'coin' | 'star'>;

export function ensureEffectPickupTexture(scene: Phaser.Scene, type: NonScoringPickupType): void {
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
  } else if (type === 'magnet') {
    graphics.fillStyle(PALETTE.ink);
    graphics.fillRoundedRect(4, 6, 32, 30, 10);
    graphics.fillStyle(PALETTE.player);
    graphics.fillRoundedRect(7, 7, 26, 26, 8);
    graphics.fillStyle(PALETTE.ink);
    graphics.fillRect(16, 6, 8, 17);
    graphics.fillStyle(PALETTE.white);
    graphics.fillRect(7, 9, 9, 7);
    graphics.fillRect(24, 9, 9, 7);
  } else if (type === 'energy-flower') {
    // Stem, leaves and a glowing core: readable over grass and stone.
    graphics.lineStyle(4, PALETTE.grassDark);
    graphics.lineBetween(20, 38, 20, 22);
    graphics.fillStyle(PALETTE.grass);
    graphics.fillEllipse(12, 30, 15, 8);
    graphics.fillEllipse(28, 28, 15, 8);
    graphics.fillStyle(PALETTE.waterLight, 0.35);
    graphics.fillCircle(20, 15, 16);
    graphics.fillStyle(PALETTE.accent);
    for (let petal = 0; petal < 6; petal += 1) {
      const angle = (Math.PI / 3) * petal;
      graphics.fillCircle(20 + Math.cos(angle) * 9, 15 + Math.sin(angle) * 9, 6);
    }
    graphics.fillStyle(PALETTE.sun);
    graphics.fillCircle(20, 15, 7);
    graphics.fillStyle(PALETTE.white);
    graphics.fillCircle(17, 12, 2.4);
    graphics.lineStyle(2, PALETTE.ink, 0.85);
    graphics.strokeCircle(20, 15, 8);
  } else {
    graphics.fillStyle(PALETTE.ink);
    graphics.fillRoundedRect(10, 18, 20, 18, 6);
    graphics.fillRoundedRect(2, 4, 36, 24, 11);
    graphics.fillStyle(PALETTE.white);
    graphics.fillRoundedRect(13, 23, 14, 10, 4);
    graphics.fillStyle(PALETTE.accentDark);
    graphics.fillRoundedRect(5, 7, 30, 18, 8);
    graphics.fillStyle(PALETTE.white);
    graphics.fillCircle(13, 17, 3);
    graphics.fillCircle(22, 12, 3);
    graphics.fillCircle(28, 18, 2);
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

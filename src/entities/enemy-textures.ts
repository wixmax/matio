import Phaser from 'phaser';
import { PALETTE } from '../ui/theme';

/**
 * Procedural placeholder enemy frames.
 *
 * Every frame is 64x64 with the feet at the bottom edge, matching the player's
 * feet-origin convention. The Arcade body is 44x44 at offset (10,20), so the
 * body bottom equals the sprite `y` (the authored feet anchor).
 *
 * Texture key = `matio-enemy-<archetypeId>`. If a texture with that key already
 * exists (an atlas or AI-generated sprite loaded in BootScene), generation is
 * skipped, so final art can replace placeholders without touching the entity.
 */

export const ENEMY_FRAME_WIDTH = 64;
export const ENEMY_FRAME_HEIGHT = 64;

export const ENEMY_BODY = {
  width: 44,
  height: 44,
  offsetX: 10,
  offsetY: 20,
} as const;

const ENEMY_TEXTURE_PREFIX = 'matio-enemy-';

export function enemyTextureKey(enemyId: string): string {
  return `${ENEMY_TEXTURE_PREFIX}${enemyId}`;
}

/** Generates the placeholder texture for an archetype if it is missing. */
export function ensureEnemyTexture(scene: Phaser.Scene, enemyId: string): void {
  const key = enemyTextureKey(enemyId);

  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.add.graphics();
  drawEnemy(graphics, enemyId);
  graphics.generateTexture(key, ENEMY_FRAME_WIDTH, ENEMY_FRAME_HEIGHT);
  graphics.destroy();
}

function drawEnemy(graphics: Phaser.GameObjects.Graphics, enemyId: string): void {
  switch (enemyId) {
    case 'mushroom':
      drawMushroom(graphics);
      break;
    case 'snail':
      drawSnail(graphics);
      break;
    case 'spiky':
      drawSpiky(graphics);
      break;
    default:
      drawFallback(graphics);
      break;
  }
}

function drawEyes(
  graphics: Phaser.GameObjects.Graphics,
  leftX: number,
  rightX: number,
  y: number,
): void {
  graphics.fillStyle(PALETTE.white, 1);
  graphics.fillCircle(leftX, y, 4.5);
  graphics.fillCircle(rightX, y, 4.5);
  graphics.fillStyle(PALETTE.ink, 1);
  graphics.fillCircle(leftX + 1, y, 2.4);
  graphics.fillCircle(rightX + 1, y, 2.4);
}

function drawMushroom(graphics: Phaser.GameObjects.Graphics): void {
  const ink = PALETTE.ink;

  // Stem.
  graphics.fillStyle(ink, 1);
  graphics.fillRoundedRect(19, 34, 26, 28, 10);
  graphics.fillStyle(0xfff0d2, 1);
  graphics.fillRoundedRect(22, 37, 20, 24, 8);

  // Cap.
  graphics.fillStyle(ink, 1);
  graphics.fillRoundedRect(4, 12, 56, 30, 15);
  graphics.fillStyle(PALETTE.enemyMushroom, 1);
  graphics.fillRoundedRect(7, 14, 50, 25, 12);
  graphics.fillStyle(PALETTE.enemyMushroomDark, 1);
  graphics.fillRoundedRect(7, 31, 50, 8, 5);

  // Cap spots.
  graphics.fillStyle(PALETTE.white, 0.95);
  graphics.fillCircle(20, 23, 5);
  graphics.fillCircle(40, 20, 4);
  graphics.fillCircle(48, 28, 3);

  // Face on the stem.
  drawEyes(graphics, 28, 38, 48);
  graphics.lineStyle(2, ink, 1);
  graphics.beginPath();
  graphics.arc(33, 53, 5, 0.1 * Math.PI, 0.9 * Math.PI);
  graphics.strokePath();
}

function drawSnail(graphics: Phaser.GameObjects.Graphics): void {
  const ink = PALETTE.ink;

  // Foot/body.
  graphics.fillStyle(ink, 1);
  graphics.fillRoundedRect(7, 48, 51, 14, 7);
  graphics.fillStyle(0xf6e6c8, 1);
  graphics.fillRoundedRect(10, 50, 45, 9, 4);

  // Shell.
  graphics.fillStyle(ink, 1);
  graphics.fillCircle(27, 38, 21);
  graphics.fillStyle(PALETTE.enemySnail, 1);
  graphics.fillCircle(27, 38, 18);
  graphics.fillStyle(PALETTE.enemySnailDark, 1);
  graphics.fillCircle(27, 38, 8);
  graphics.lineStyle(2.5, 0xd9ffe3, 0.9);
  graphics.beginPath();
  graphics.arc(27, 38, 13, 0.2 * Math.PI, 1.6 * Math.PI);
  graphics.strokePath();

  // Head and eye stalks at the front (right).
  graphics.fillStyle(ink, 1);
  graphics.fillCircle(47, 47, 9);
  graphics.fillStyle(0xf6e6c8, 1);
  graphics.fillCircle(47, 47, 6.5);
  graphics.lineStyle(2, ink, 1);
  graphics.lineBetween(46, 43, 43, 33);
  graphics.lineBetween(50, 43, 53, 33);
  graphics.fillStyle(ink, 1);
  graphics.fillCircle(43, 32, 3);
  graphics.fillCircle(53, 32, 3);
  drawEyes(graphics, 45, 51, 47);
}

function drawSpiky(graphics: Phaser.GameObjects.Graphics): void {
  const ink = PALETTE.ink;

  // Spikes first so the body overlaps their bases.
  graphics.fillStyle(ink, 1);
  for (const angle of [-90, -50, -10, 30, 70, 110, 150, 190, 230, 270]) {
    const radians = (angle * Math.PI) / 180;
    const tipX = 32 + Math.cos(radians) * 30;
    const tipY = 40 + Math.sin(radians) * 30;
    const leftX = 32 + Math.cos(radians + 0.22) * 17;
    const leftY = 40 + Math.sin(radians + 0.22) * 17;
    const rightX = 32 + Math.cos(radians - 0.22) * 17;
    const rightY = 40 + Math.sin(radians - 0.22) * 17;

    graphics.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);
  }

  // Body.
  graphics.fillStyle(ink, 1);
  graphics.fillCircle(32, 40, 23);
  graphics.fillStyle(PALETTE.enemySpiky, 1);
  graphics.fillCircle(32, 40, 20);
  graphics.fillStyle(PALETTE.enemySpikyDark, 1);
  graphics.fillEllipse(32, 49, 30, 12);

  drawEyes(graphics, 25, 37, 38);
  graphics.lineStyle(2, ink, 1);
  graphics.beginPath();
  graphics.arc(31, 47, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  graphics.strokePath();
}

function drawFallback(graphics: Phaser.GameObjects.Graphics): void {
  const ink = PALETTE.ink;

  graphics.fillStyle(ink, 1);
  graphics.fillRoundedRect(7, 20, 50, 43, 14);
  graphics.fillStyle(PALETTE.enemyFallback, 1);
  graphics.fillRoundedRect(10, 23, 44, 37, 11);
  graphics.fillStyle(PALETTE.accentDark, 1);
  graphics.fillRoundedRect(10, 49, 44, 11, 6);

  drawEyes(graphics, 25, 37, 38);
  graphics.lineStyle(2, ink, 1);
  graphics.beginPath();
  graphics.arc(31, 45, 6, 0.15 * Math.PI, 0.85 * Math.PI);
  graphics.strokePath();
}

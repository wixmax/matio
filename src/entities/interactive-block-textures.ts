import Phaser from 'phaser';
import type { InteractiveBlockId } from '../types/interactive-block';
import { PALETTE } from '../ui/theme';

/**
 * Procedural interactive-block art.
 *
 * All textures are generated once per scene and reused. Final art can replace
 * these keys without touching block state or physics code.
 */

export const BLOCK_FRAME_SIZE = 64;
export const BLOCK_DEBRIS_SIZE = 12;

export const INTERACTIVE_BLOCK_TEXTURES = {
  'breakable-brick': 'matio-block-breakable-brick',
  'reward-block': 'matio-block-reward',
  used: 'matio-block-used',
  debris: 'matio-block-debris',
} as const;

export function blockTextureFor(blockId: InteractiveBlockId, used: boolean): string {
  if (blockId === 'breakable-brick') {
    return INTERACTIVE_BLOCK_TEXTURES['breakable-brick'];
  }

  return used ? INTERACTIVE_BLOCK_TEXTURES.used : INTERACTIVE_BLOCK_TEXTURES['reward-block'];
}

export function ensureInteractiveBlockTextures(scene: Phaser.Scene): void {
  ensureBrickTexture(scene);
  ensureRewardTexture(scene);
  ensureUsedTexture(scene);
  ensureDebrisTexture(scene);
}

function ensureBrickTexture(scene: Phaser.Scene): void {
  const key = INTERACTIVE_BLOCK_TEXTURES['breakable-brick'];
  if (scene.textures.exists(key)) return;

  const graphics = scene.make.graphics({ x: 0, y: 0 });
  const size = BLOCK_FRAME_SIZE;

  graphics.fillStyle(PALETTE.ink, 1);
  graphics.fillRoundedRect(1, 1, size - 2, size - 2, 9);
  graphics.fillStyle(PALETTE.blockBrick, 1);
  graphics.fillRoundedRect(5, 5, size - 10, size - 10, 6);

  // Offset mortar rows make the brick pattern readable at gameplay scale.
  graphics.lineStyle(3, PALETTE.blockBrickDark, 0.9);
  graphics.lineBetween(5, 22, size - 5, 22);
  graphics.lineBetween(5, 42, size - 5, 42);
  graphics.lineBetween(21, 5, 21, 22);
  graphics.lineBetween(42, 22, 42, 42);
  graphics.lineBetween(21, 42, 21, size - 5);

  graphics.fillStyle(PALETTE.accentLight, 0.35);
  graphics.fillRect(8, 8, size - 16, 5);
  graphics.fillStyle(PALETTE.white, 0.22);
  graphics.fillRect(9, 11, 14, 3);

  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

function ensureRewardTexture(scene: Phaser.Scene): void {
  const key = INTERACTIVE_BLOCK_TEXTURES['reward-block'];
  if (scene.textures.exists(key)) return;

  const graphics = scene.make.graphics({ x: 0, y: 0 });
  const size = BLOCK_FRAME_SIZE;
  const center = size / 2;

  graphics.fillStyle(PALETTE.ink, 1);
  graphics.fillRoundedRect(1, 1, size - 2, size - 2, 9);
  graphics.fillStyle(PALETTE.blockReward, 1);
  graphics.fillRoundedRect(5, 5, size - 10, size - 10, 6);
  graphics.lineStyle(3, PALETTE.blockRewardDark, 1);
  graphics.strokeRoundedRect(9, 9, size - 18, size - 18, 5);

  // An original four-point sparkle marks a reward without borrowing a glyph.
  drawSparkle(graphics, center, center, 17, 6, PALETTE.white);
  drawSparkle(graphics, center, center, 10, 4, PALETTE.ink);
  graphics.fillStyle(PALETTE.white, 1);
  graphics.fillCircle(center - 11, center - 11, 3);
  graphics.fillCircle(center + 11, center + 11, 2);

  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

function ensureUsedTexture(scene: Phaser.Scene): void {
  const key = INTERACTIVE_BLOCK_TEXTURES.used;
  if (scene.textures.exists(key)) return;

  const graphics = scene.make.graphics({ x: 0, y: 0 });
  const size = BLOCK_FRAME_SIZE;

  graphics.fillStyle(PALETTE.ink, 1);
  graphics.fillRoundedRect(1, 1, size - 2, size - 2, 9);
  graphics.fillStyle(PALETTE.blockUsed, 1);
  graphics.fillRoundedRect(5, 5, size - 10, size - 10, 6);
  graphics.fillStyle(PALETTE.blockUsedDark, 0.75);
  graphics.fillRoundedRect(12, 12, size - 24, size - 24, 4);
  graphics.lineStyle(2, PALETTE.ink, 0.55);
  graphics.strokeRoundedRect(12, 12, size - 24, size - 24, 4);
  graphics.fillStyle(PALETTE.ink, 0.4);
  graphics.fillCircle(size / 2, size / 2, 4);

  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

function ensureDebrisTexture(scene: Phaser.Scene): void {
  const key = INTERACTIVE_BLOCK_TEXTURES.debris;
  if (scene.textures.exists(key)) return;

  const graphics = scene.make.graphics({ x: 0, y: 0 });
  const size = BLOCK_DEBRIS_SIZE;

  graphics.fillStyle(PALETTE.ink, 1);
  graphics.fillRoundedRect(0, 0, size, size, 3);
  graphics.fillStyle(PALETTE.blockBrick, 1);
  graphics.fillRoundedRect(2, 2, size - 4, size - 4, 2);
  graphics.fillStyle(PALETTE.accentLight, 0.5);
  graphics.fillRect(3, 3, size - 8, 2);

  graphics.generateTexture(key, size, size);
  graphics.destroy();
}

function drawSparkle(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  outer: number,
  inner: number,
  color: number,
): void {
  const points: Phaser.Math.Vector2[] = [];

  for (let index = 0; index < 8; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 4;
    points.push(new Phaser.Math.Vector2(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius));
  }

  graphics.fillStyle(color, 1);
  graphics.fillPoints(points, true);
}

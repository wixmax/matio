import Phaser from 'phaser';
import { PLAYER_FRAME_HEIGHT, PLAYER_FRAME_WIDTH } from '../systems/player-form-rules';
import { PALETTE } from '../ui/theme';

/**
 * Procedural placeholder frames for the player.
 *
 * Every frame is 64x96 with the feet at the bottom edge and the character
 * centered horizontally. The Player's Arcade body is smaller than the frame and
 * offset to the feet (see player-form-rules). When real sprites arrive, only the
 * texture keys and this module change; movement/physics code stays untouched.
 */

export const PLAYER_TEXTURES = {
  idle: 'matio-player-idle',
  runA: 'matio-player-run-a',
  runB: 'matio-player-run-b',
  rise: 'matio-player-rise',
  fall: 'matio-player-fall',
  land: 'matio-player-land',
} as const;

type PlayerPose = 'idle' | 'run-a' | 'run-b' | 'rise' | 'fall' | 'land';

const FRAME_POSES: ReadonlyArray<{ readonly textureKey: string; readonly pose: PlayerPose }> = [
  { textureKey: PLAYER_TEXTURES.idle, pose: 'idle' },
  { textureKey: PLAYER_TEXTURES.runA, pose: 'run-a' },
  { textureKey: PLAYER_TEXTURES.runB, pose: 'run-b' },
  { textureKey: PLAYER_TEXTURES.rise, pose: 'rise' },
  { textureKey: PLAYER_TEXTURES.fall, pose: 'fall' },
  { textureKey: PLAYER_TEXTURES.land, pose: 'land' },
];

const INK = PALETTE.ink;
const SKIN = 0xffd7b0;
const GROUND_Y = PLAYER_FRAME_HEIGHT;
const CENTER_X = PLAYER_FRAME_WIDTH / 2;

/** Generates any missing placeholder textures. Textures are game-global. */
export function ensurePlayerTextures(scene: Phaser.Scene): void {
  for (const frame of FRAME_POSES) {
    if (scene.textures.exists(frame.textureKey)) {
      continue;
    }

    const graphics = scene.add.graphics();
    drawPose(graphics, frame.pose);
    graphics.generateTexture(frame.textureKey, PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT);
    graphics.destroy();
  }
}

function drawPose(graphics: Phaser.GameObjects.Graphics, pose: PlayerPose): void {
  switch (pose) {
    case 'idle':
      drawLegs(graphics, 22, 36, 78, 12, GROUND_Y - 9);
      drawArms(graphics, 8, 52, 10, 22, 46, 52, 10, 22);
      drawBody(graphics, 46, 42, 0);
      drawHead(graphics, CENTER_X, 26, 22);
      break;

    case 'run-a':
      drawLegs(graphics, 18, 40, 76, 14, GROUND_Y - 9);
      drawArms(graphics, 6, 58, 12, 16, 48, 46, 10, 24);
      drawBody(graphics, 46, 42, 2);
      drawHead(graphics, CENTER_X + 2, 26, 22);
      break;

    case 'run-b':
      drawLegs(graphics, 24, 34, 80, 10, GROUND_Y - 9);
      drawArms(graphics, 6, 46, 10, 24, 48, 58, 12, 16);
      drawBody(graphics, 46, 42, -1);
      drawHead(graphics, CENTER_X - 1, 26, 22);
      break;

    case 'rise':
      drawLegs(graphics, 24, 34, 78, 8, GROUND_Y - 14);
      drawArms(graphics, 6, 26, 10, 26, 48, 26, 10, 26);
      drawBody(graphics, 44, 44, 0);
      drawHead(graphics, CENTER_X, 23, 22);
      break;

    case 'fall':
      drawLegs(graphics, 14, 44, 76, 14, GROUND_Y - 9);
      drawArms(graphics, 2, 52, 16, 10, 46, 52, 16, 10);
      drawBody(graphics, 46, 42, 0);
      drawHead(graphics, CENTER_X, 26, 22);
      break;

    case 'land':
      drawLegs(graphics, 16, 40, 76, 10, GROUND_Y - 9);
      drawArms(graphics, 4, 62, 12, 16, 48, 62, 12, 16);
      drawBody(graphics, 58, 30, 0);
      drawHead(graphics, CENTER_X, 40, 20);
      break;
  }
}

function drawBody(
  graphics: Phaser.GameObjects.Graphics,
  topY: number,
  height: number,
  leanX: number,
): void {
  const x = CENTER_X + leanX;

  // Outline, fill and a darker lower band for the cartoon cel look.
  graphics.fillStyle(INK, 1);
  graphics.fillRoundedRect(x - 22, topY - 2, 44, height + 4, 16);
  graphics.fillStyle(PALETTE.player, 1);
  graphics.fillRoundedRect(x - 19, topY, 38, height, 14);
  graphics.fillStyle(PALETTE.playerDark, 1);
  graphics.fillRoundedRect(x - 19, topY + height - 11, 38, 11, 8);

  // Scarf: accent color and a tail to the left so facing reads when flipped.
  graphics.fillStyle(INK, 1);
  graphics.fillRoundedRect(x - 21, topY - 8, 42, 11, 5);
  graphics.fillStyle(PALETTE.accent, 1);
  graphics.fillRoundedRect(x - 19, topY - 6, 38, 7, 3);
  graphics.fillStyle(PALETTE.accentDark, 1);
  graphics.fillTriangle(x - 18, topY - 4, x - 32, topY + 10, x - 16, topY + 4);
}

function drawHead(
  graphics: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  // Head with ink outline.
  graphics.fillStyle(INK, 1);
  graphics.fillCircle(centerX, centerY, radius + 2);
  graphics.fillStyle(SKIN, 1);
  graphics.fillCircle(centerX, centerY, radius);

  // Hair cap (upper half circle) and a brim facing right.
  graphics.fillStyle(INK, 1);
  graphics.beginPath();
  graphics.arc(centerX, centerY - 1, radius, Math.PI, Math.PI * 2);
  graphics.lineTo(centerX + radius, centerY - 1);
  graphics.closePath();
  graphics.fillPath();
  graphics.fillRoundedRect(centerX + radius - 10, centerY - 10, 17, 7, 3);

  // Face features (shifted right to imply facing right; flipping mirrors them).
  graphics.fillStyle(INK, 1);
  graphics.fillCircle(centerX - 2, centerY + 3, 2.8);
  graphics.fillCircle(centerX + 9, centerY + 3, 2.8);
  graphics.fillStyle(PALETTE.white, 0.85);
  graphics.fillCircle(centerX - 1, centerY + 2, 0.9);
  graphics.fillCircle(centerX + 10, centerY + 2, 0.9);

  graphics.lineStyle(2.5, INK, 1);
  graphics.beginPath();
  graphics.arc(centerX + 3, centerY + 8, 5, 0.15 * Math.PI, 0.85 * Math.PI);
  graphics.strokePath();

  // Cheek highlight, also asymmetric.
  graphics.fillStyle(PALETTE.white, 0.28);
  graphics.fillEllipse(centerX + 14, centerY + 10, 7, 5);
}

function drawArms(
  graphics: Phaser.GameObjects.Graphics,
  leftX: number,
  leftY: number,
  leftWidth: number,
  leftHeight: number,
  rightX: number,
  rightY: number,
  rightWidth: number,
  rightHeight: number,
): void {
  drawLimb(graphics, leftX, leftY, leftWidth, leftHeight);
  drawLimb(graphics, rightX, rightY, rightWidth, rightHeight);
}

function drawLegs(
  graphics: Phaser.GameObjects.Graphics,
  leftX: number,
  rightX: number,
  topY: number,
  height: number,
  shoeY: number,
): void {
  drawLimb(graphics, leftX, topY, 10, height);
  drawLimb(graphics, rightX, topY, 10, height);

  graphics.fillStyle(INK, 1);
  graphics.fillRoundedRect(leftX - 4, shoeY, 18, 8, 4);
  graphics.fillRoundedRect(rightX - 4, shoeY, 18, 8, 4);
}

function drawLimb(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  graphics.fillStyle(INK, 1);
  graphics.fillRoundedRect(x - 2, y - 2, width + 4, height + 4, 7);
  graphics.fillStyle(PALETTE.playerDark, 1);
  graphics.fillRoundedRect(x, y, width, height, 5);
}

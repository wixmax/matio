import Phaser from 'phaser';
import { PALETTE } from '../ui/theme';

/**
 * Procedural energy-ball placeholder art. One texture is generated per scene
 * and reused by every projectile; no per-frame texture work exists.
 */

export const ENERGY_BALL_TEXTURE = 'matio-energy-ball';

export const ENERGY_BALL_FRAME = { width: 30, height: 30 } as const;

export function ensureEnergyBallTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(ENERGY_BALL_TEXTURE)) {
    return;
  }

  const graphics = scene.add.graphics();
  const center = ENERGY_BALL_FRAME.width / 2;

  graphics.fillStyle(PALETTE.waterLight, 0.32);
  graphics.fillCircle(center, center, 14);
  graphics.fillStyle(PALETTE.accent, 0.9);
  graphics.fillCircle(center, center, 10);
  graphics.fillStyle(PALETTE.sun, 1);
  graphics.fillCircle(center, center, 7);
  graphics.fillStyle(PALETTE.white, 0.95);
  graphics.fillCircle(center - 2, center - 2, 2.6);
  graphics.lineStyle(2, PALETTE.ink, 0.8);
  graphics.strokeCircle(center, center, 10);

  graphics.generateTexture(ENERGY_BALL_TEXTURE, ENERGY_BALL_FRAME.width, ENERGY_BALL_FRAME.height);
  graphics.destroy();
}

import Phaser from 'phaser';
import type { WorldPoint } from '../types/level-runtime';
import { addUiText } from '../ui/components/ui-text';
import { PALETTE, toCssColor } from '../ui/theme';

/**
 * Placeholder goal marker. It is intentionally visual-only in this milestone;
 * completion, scoring and progression belong to later tasks.
 */
export function createGoalMarker(
  scene: Phaser.Scene,
  goal: WorldPoint,
): Phaser.GameObjects.Container {
  const container = scene.add.container(goal.x, goal.y).setDepth(6);
  const graphics = scene.add.graphics();

  // Base pad.
  graphics.fillStyle(PALETTE.accent, 0.45);
  graphics.fillEllipse(0, -4, 82, 18);
  graphics.lineStyle(3, PALETTE.accentDark, 0.9);
  graphics.strokeEllipse(0, -4, 82, 18);

  // Pole.
  graphics.fillStyle(PALETTE.ink, 1);
  graphics.fillRoundedRect(-4, -104, 8, 102, 3);
  graphics.fillStyle(PALETTE.mutedText, 1);
  graphics.fillRoundedRect(-2, -102, 4, 98, 2);

  // Flag.
  graphics.fillStyle(PALETTE.accent, 1);
  graphics.fillRoundedRect(2, -98, 44, 26, 5);
  graphics.fillStyle(PALETTE.accentLight, 1);
  graphics.fillRoundedRect(5, -95, 38, 10, 4);
  graphics.lineStyle(3, PALETTE.ink, 1);
  graphics.strokeRoundedRect(2, -98, 44, 26, 5);

  const label = addUiText(scene, 0, -118, 'GOAL', {
    fontStyle: 'bold',
    fontSize: '14px',
    color: toCssColor(PALETTE.white),
    stroke: toCssColor(PALETTE.ink),
    strokeThickness: 5,
  }).setOrigin(0.5, 1);

  container.add([graphics, label]);

  return container;
}

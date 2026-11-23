import Phaser from 'phaser';
import type { WorldPoint } from '../types/level-runtime';
import { addUiText } from '../ui/components/ui-text';
import { PALETTE, toCssColor } from '../ui/theme';

export interface GoalRuntime {
  /** Existing visual marker. */
  readonly marker: Phaser.GameObjects.Container;
  /** Non-solid overlap sensor positioned at the flag base. */
  readonly sensor: Phaser.GameObjects.Zone;
}

const SENSOR_WIDTH = 96;
const SENSOR_HEIGHT = 140;

/**
 * Placeholder goal marker plus a non-blocking completion sensor.
 *
 * The sensor is a static Arcade body used exclusively with `overlap`, never a
 * collider, so reaching the flag cannot block the player. The marker remains
 * purely visual and positioned by the JSON goal cell.
 */
export function createGoalMarker(scene: Phaser.Scene, goal: WorldPoint): GoalRuntime {
  const marker = scene.add.container(goal.x, goal.y).setDepth(6);
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

  marker.add([graphics, label]);

  const sensor = scene.add.zone(
    goal.x,
    goal.y - SENSOR_HEIGHT / 2,
    SENSOR_WIDTH,
    SENSOR_HEIGHT,
  );
  scene.physics.add.existing(sensor, true);

  return { marker, sensor };
}

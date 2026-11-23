import Phaser from 'phaser';
import { UI_FONT } from '../theme';
import { getTextResolution } from '../../utils/display';

/**
 * Creates a Phaser Text object with the project font defaults.
 *
 * Text is the only primitive currently rendered at device-pixel resolution, so
 * the resolution factor is applied here instead of being repeated in scenes.
 */
export function addUiText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, content, {
    fontFamily: UI_FONT,
    ...style,
    resolution: getTextResolution(),
  });
}

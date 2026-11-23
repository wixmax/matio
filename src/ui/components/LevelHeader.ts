import Phaser from 'phaser';
import type { LevelDefinition } from '../../types/level';
import { PALETTE, toCssColor } from '../theme';
import { addUiText } from './ui-text';

/**
 * Small camera-fixed level header. It is not a full HUD/screen system; it keeps
 * level identity and controls readable while the world scrolls.
 */
export class LevelHeader {
  constructor(scene: Phaser.Scene, level: LevelDefinition) {
    addUiText(scene, 24, 14, level.name, {
      fontStyle: 'bold',
      fontSize: '25px',
      color: toCssColor(PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 7,
    })
      .setScrollFactor(0)
      .setDepth(2100);

    addUiText(
      scene,
      26,
      48,
      `${level.id} · ${level.size.width}×${level.size.height} tiles · JSON level`,
      {
        fontStyle: 'bold',
        fontSize: '15px',
        color: toCssColor(PALETTE.inkSoft),
      },
    )
      .setScrollFactor(0)
      .setDepth(2100);

    addUiText(
      scene,
      26,
      72,
      import.meta.env.DEV
        ? 'MOVE: LEFT/RIGHT or A/D   ·   JUMP: SPACE or W/UP   ·   RESET: R (dev)'
        : 'MOVE: LEFT/RIGHT or A/D   ·   JUMP: SPACE or W/UP',
      {
        fontStyle: 'bold',
        fontSize: '14px',
        color: toCssColor(PALETTE.inkSoft),
      },
    )
      .setScrollFactor(0)
      .setDepth(2100);
  }
}

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../../core/constants';
import type { LevelLoadFailure } from '../../types/level-runtime';
import { PALETTE, toCssColor } from '../theme';
import { TextButton } from './TextButton';
import { addUiText } from './ui-text';

export interface LevelErrorPanelOptions {
  readonly failure: LevelLoadFailure;
  readonly onBackToMenu: () => void;
}

/**
 * Minimal blocking error view for invalid/missing levels. Gameplay systems are
 * never started when this panel is shown.
 */
export class LevelErrorPanel {
  constructor(scene: Phaser.Scene, options: LevelErrorPanelOptions) {
    const { failure } = options;

    scene.add
      .rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2,
        GAME_WIDTH,
        GAME_HEIGHT,
        PALETTE.background,
        1,
      )
      .setScrollFactor(0)
      .setDepth(3990);

    scene.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 1040, 560, 0x0b1220, 1)
      .setStrokeStyle(3, PALETTE.player, 0.85)
      .setScrollFactor(0)
      .setDepth(3991);

    addUiText(scene, GAME_WIDTH / 2, 142, 'LEVEL LOAD ERROR', {
      fontStyle: 'bold',
      fontSize: '36px',
      color: toCssColor(PALETTE.player),
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(4000);

    addUiText(scene, GAME_WIDTH / 2, 196, `level: ${failure.levelId}   [${failure.code}]`, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '18px',
      color: toCssColor(PALETTE.mutedText),
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(4000);

    addUiText(scene, GAME_WIDTH / 2, 244, failure.message, {
      fontSize: '22px',
      color: toCssColor(PALETTE.white),
      align: 'center',
      wordWrap: { width: 920 },
    })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(4000);

    addUiText(scene, 130, 330, buildDetails(failure), {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '15px',
      color: toCssColor(PALETTE.mutedText),
      lineSpacing: 5,
      wordWrap: { width: 1020 },
    })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(4000);

    new TextButton(scene, GAME_WIDTH / 2, 600, {
      label: 'BACK TO MENU',
      width: 320,
      height: 76,
      fontSize: 26,
      onClick: () => options.onBackToMenu(),
    })
      .setScrollFactor(0)
      .setDepth(4000);
  }
}

function buildDetails(failure: LevelLoadFailure): string {
  const lines: string[] = [];

  if (failure.path !== undefined) {
    lines.push(`File: ${failure.path}`);
  }

  for (const error of failure.details ?? []) {
    lines.push(`${error.path}: ${error.message}`);
  }

  if (lines.length === 0) {
    lines.push('Check content/levels and the ?level= selector, then reload the game.');
  }

  if (lines.length > 10) {
    lines.splice(10, lines.length - 10, '…');
  }

  return lines.join('\n');
}

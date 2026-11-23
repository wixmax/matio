import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/constants';
import type { GameOverData } from '../types/game-over';
import { PALETTE, toCssColor } from '../ui/theme';
import { TextButton } from '../ui/components/TextButton';
import { addUiText } from '../ui/components/ui-text';

/**
 * Terminal failure screen.
 *
 * Retry starts a brand-new GameScene with the same level, which rebuilds
 * collectibles, enemies and player health while leaving save data untouched.
 * There is intentionally no NEXT LEVEL button: a failed run never unlocks or
 * records progression.
 */
export class GameOverScene extends Phaser.Scene {
  private dataToShow: GameOverData | null = null;
  private leaving = false;
  private buttons: TextButton[] = [];

  constructor() {
    super(SCENE_KEYS.GAME_OVER);
  }

  init(data?: GameOverData): void {
    this.dataToShow = data ?? null;
    this.leaving = false;
    this.buttons = [];
  }

  create(): void {
    const data = this.dataToShow;

    if (data === null) {
      this.scene.start(SCENE_KEYS.MENU);
      return;
    }

    this.cameras.main.setBackgroundColor(PALETTE.background);
    this.drawBackdrop();

    const centerX = GAME_WIDTH / 2;
    const panel = this.add
      .rectangle(centerX, GAME_HEIGHT / 2, 900, 560, 0x0b1220, 0.97)
      .setStrokeStyle(4, PALETTE.player, 0.9);

    panel.setDepth(1);

    addUiText(this, centerX, 96, 'GAME OVER', {
      fontStyle: 'bold',
      fontSize: '52px',
      color: toCssColor(PALETTE.player),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 10,
    })
      .setOrigin(0.5)
      .setDepth(2);

    addUiText(this, centerX, 154, data.levelName, {
      fontStyle: 'bold',
      fontSize: '24px',
      color: toCssColor(PALETTE.accentLight),
    })
      .setOrigin(0.5)
      .setDepth(2);

    addUiText(this, centerX, 198, 'Out of health!', {
      fontStyle: 'bold',
      fontSize: '20px',
      color: toCssColor(PALETTE.mutedText),
    })
      .setOrigin(0.5)
      .setDepth(2);

    this.drawStatRow(284, 'COINS', `${data.collectedCoins} / ${data.totalCoins}`);
    this.drawStatRow(
      326,
      'COLLECTIBLE STARS',
      `${data.collectedStars} / ${data.totalCollectibleStars}`,
    );
    this.drawStatRow(368, 'ENEMIES DEFEATED', `${data.enemiesDefeated} / ${data.totalEnemies}`);
    this.drawStatRow(410, 'ENEMY SCORE', String(data.enemyPoints));
    this.drawStatRow(452, 'SCORE (NO COMPLETION BONUS)', String(data.score));

    addUiText(this, centerX, 500, 'This run did not unlock the next level or update best records.', {
      fontStyle: 'bold',
      fontSize: '16px',
      color: toCssColor(PALETTE.mutedText),
    })
      .setOrigin(0.5)
      .setDepth(2);

    this.drawButtons(data);
  }

  private drawStatRow(y: number, label: string, value: string): void {
    addUiText(this, 350, y, label, {
      fontStyle: 'bold',
      fontSize: '19px',
      color: toCssColor(PALETTE.mutedText),
    })
      .setOrigin(0, 0.5)
      .setDepth(2);

    addUiText(this, 930, y, value, {
      fontStyle: 'bold',
      fontSize: '21px',
      color: toCssColor(PALETTE.white),
    })
      .setOrigin(1, 0.5)
      .setDepth(2);
  }

  private drawButtons(data: GameOverData): void {
    const specs: Array<{ label: string; action: () => void }> = [
      {
        label: 'RETRY',
        action: () => this.scene.start(SCENE_KEYS.GAME, { levelId: data.levelId }),
      },
      { label: 'MAIN MENU', action: () => this.scene.start(SCENE_KEYS.MENU) },
    ];

    const buttonWidth = 280;
    const gap = 32;
    const totalWidth = specs.length * buttonWidth + (specs.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + buttonWidth / 2;

    specs.forEach((spec, index) => {
      const button = new TextButton(this, startX + index * (buttonWidth + gap), 588, {
        label: spec.label,
        width: buttonWidth,
        height: 72,
        fontSize: 25,
        onClick: () => this.leave(spec.action),
      });

      button.setDepth(3);
      this.buttons.push(button);
    });
  }

  private leave(action: () => void): void {
    if (this.leaving) {
      return;
    }

    this.leaving = true;

    for (const button of this.buttons) {
      button.setEnabled(false);
    }

    action();
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics().setDepth(0);

    graphics.fillStyle(PALETTE.playerDark, 0.16);
    graphics.fillCircle(140, 110, 220);
    graphics.fillCircle(GAME_WIDTH - 120, GAME_HEIGHT - 80, 260);
    graphics.fillStyle(PALETTE.player, 0.07);
    graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 340);
  }
}

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/constants';
import type { LevelResultData } from '../types/level-result';
import { PALETTE, toCssColor } from '../ui/theme';
import { TextButton } from '../ui/components/TextButton';
import { addUiText } from '../ui/components/ui-text';
import { formatRatingStars } from '../ui/components/rating-stars';

/**
 * Victory result screen.
 *
 * Receives plain data only (no Phaser references) so it stays valid after
 * GameScene shuts down. Every button uses TextButton, which shares one pointer
 * path for mouse and touch, and a local `leaving` guard prevents double
 * transitions from one interaction.
 */
export class ResultScene extends Phaser.Scene {
  private result: LevelResultData | null = null;
  private leaving = false;
  private buttons: TextButton[] = [];

  constructor() {
    super(SCENE_KEYS.RESULT);
  }

  init(data?: LevelResultData): void {
    this.result = data ?? null;
    this.leaving = false;
    this.buttons = [];
  }

  create(): void {
    const result = this.result;

    if (result === null) {
      this.scene.start(SCENE_KEYS.MENU);
      return;
    }

    this.cameras.main.setBackgroundColor(PALETTE.background);
    this.drawBackdrop();

    const centerX = GAME_WIDTH / 2;
    const panel = this.add
      .rectangle(centerX, GAME_HEIGHT / 2, 900, 580, 0x0b1220, 0.97)
      .setStrokeStyle(4, PALETTE.accent, 0.9);

    panel.setDepth(1);

    addUiText(this, centerX, 96, 'LEVEL COMPLETE', {
      fontStyle: 'bold',
      fontSize: '42px',
      color: toCssColor(PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 9,
    })
      .setOrigin(0.5)
      .setDepth(2);

    addUiText(this, centerX, 148, result.levelName, {
      fontStyle: 'bold',
      fontSize: '24px',
      color: toCssColor(PALETTE.accentLight),
    })
      .setOrigin(0.5)
      .setDepth(2);

    addUiText(this, centerX, 196, formatRatingStars(result.ratingStars), {
      fontSize: '58px',
      color: toCssColor(PALETTE.sun),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 7,
    })
      .setOrigin(0.5)
      .setDepth(2);

    this.drawStatRow(296, 'COINS', `${result.collectedCoins} / ${result.totalCoins}`);
    this.drawStatRow(338, 'COLLECTIBLE STARS', `${result.collectedStars} / ${result.totalCollectibleStars}`);
    this.drawStatRow(380, 'SCORE', String(result.score));
    this.drawStatRow(422, 'BEST SCORE', String(result.bestScore));
    this.drawStatRow(464, 'BEST RATING', formatRatingStars(result.bestRatingStars));

    if (result.isNewBest) {
      addUiText(this, centerX, 500, 'NEW BEST SCORE!', {
        fontStyle: 'bold',
        fontSize: '20px',
        color: toCssColor(PALETTE.sun),
      })
        .setOrigin(0.5)
        .setDepth(2);
    }

    if (!result.progressSaved) {
      addUiText(this, centerX, 534, 'Progress could not be saved to localStorage.', {
        fontStyle: 'bold',
        fontSize: '15px',
        color: toCssColor(PALETTE.player),
      })
        .setOrigin(0.5)
        .setDepth(2);
    }

    this.drawButtons(result);
  }

  private drawStatRow(y: number, label: string, value: string): void {
    addUiText(this, 350, y, label, {
      fontStyle: 'bold',
      fontSize: '20px',
      color: toCssColor(PALETTE.mutedText),
    })
      .setOrigin(0, 0.5)
      .setDepth(2);

    addUiText(this, 930, y, value, {
      fontStyle: 'bold',
      fontSize: '22px',
      color: toCssColor(PALETTE.white),
    })
      .setOrigin(1, 0.5)
      .setDepth(2);
  }

  private drawButtons(result: LevelResultData): void {
    const specs: Array<{ label: string; action: () => void }> = [
      {
        label: 'RETRY',
        action: () => this.scene.start(SCENE_KEYS.GAME, { levelId: result.levelId }),
      },
    ];

    if (result.nextLevelId !== null) {
      const nextLevelId = result.nextLevelId;

      specs.push({
        label: 'NEXT LEVEL',
        action: () => this.scene.start(SCENE_KEYS.GAME, { levelId: nextLevelId }),
      });
    }

    specs.push({ label: 'MAIN MENU', action: () => this.scene.start(SCENE_KEYS.MENU) });

    const buttonWidth = 250;
    const gap = 28;
    const totalWidth = specs.length * buttonWidth + (specs.length - 1) * gap;
    const startX = GAME_WIDTH / 2 - totalWidth / 2 + buttonWidth / 2;

    specs.forEach((spec, index) => {
      const button = new TextButton(this, startX + index * (buttonWidth + gap), 588, {
        label: spec.label,
        width: buttonWidth,
        height: 72,
        fontSize: 23,
        onClick: () => {
          this.leave(spec.action);
        },
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

    graphics.fillStyle(PALETTE.skyDeep, 0.22);
    graphics.fillCircle(140, 110, 220);
    graphics.fillCircle(GAME_WIDTH - 120, GAME_HEIGHT - 80, 260);
    graphics.fillStyle(PALETTE.sun, 0.08);
    graphics.fillCircle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 340);
  }
}


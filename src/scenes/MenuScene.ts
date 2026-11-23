import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/constants';
import { PALETTE, toCssColor } from '../ui/theme';
import { addUiText } from '../ui/components/ui-text';
import { TextButton } from '../ui/components/TextButton';

/**
 * MenuScene - temporary startup screen.
 *
 * All visuals are placeholder shapes, intentionally generated in code so the
 * milestone does not depend on art assets. The scene only orchestrates layout
 * and navigation; it owns no gameplay state.
 */
export class MenuScene extends Phaser.Scene {
  private startButton: TextButton | null = null;
  private isStarting = false;

  constructor() {
    super(SCENE_KEYS.MENU);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.sky);

    this.drawBackdrop();
    this.drawTitle();
    this.drawStartButton();
    this.drawVersionLabel();
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();

    // Sun with a soft halo.
    graphics.fillStyle(PALETTE.sunGlow, 0.35);
    graphics.fillCircle(1055, 145, 150);
    graphics.fillStyle(PALETTE.sun, 1);
    graphics.fillCircle(1055, 145, 88);

    // Clouds made of overlapping circles (renderer agnostic, no gradients).
    graphics.fillStyle(PALETTE.cloud, 0.9);
    graphics.fillCircle(185, 150, 44);
    graphics.fillCircle(245, 138, 58);
    graphics.fillCircle(312, 156, 40);
    graphics.fillRect(185, 150, 127, 42);

    graphics.fillStyle(PALETTE.cloud, 0.75);
    graphics.fillCircle(690, 105, 34);
    graphics.fillCircle(740, 92, 46);
    graphics.fillCircle(792, 108, 30);
    graphics.fillRect(690, 102, 102, 32);

    // Rolling hills behind the play area.
    graphics.fillStyle(PALETTE.hillFar, 1);
    graphics.fillEllipse(210, GAME_HEIGHT + 40, 900, 420);
    graphics.fillEllipse(790, GAME_HEIGHT + 40, 820, 360);
    graphics.fillEllipse(1260, GAME_HEIGHT + 40, 760, 300);

    graphics.fillStyle(PALETTE.hillNear, 1);
    graphics.fillEllipse(60, GAME_HEIGHT + 60, 760, 340);
    graphics.fillEllipse(650, GAME_HEIGHT + 60, 880, 300);

    // Ground band.
    graphics.fillStyle(PALETTE.soil, 1);
    graphics.fillRect(0, 640, GAME_WIDTH, GAME_HEIGHT - 640);
    graphics.fillStyle(PALETTE.grass, 1);
    graphics.fillRect(0, 616, GAME_WIDTH, 32);
    graphics.fillStyle(PALETTE.grassDark, 1);
    graphics.fillRect(0, 648, GAME_WIDTH, 6);
  }

  private drawTitle(): void {
    const centerX = GAME_WIDTH / 2;
    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontStyle: 'bold',
      fontSize: '78px',
      color: toCssColor(PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 14,
      align: 'center',
    };

    // Hard offset shadow keeps the cartoon look without a blur filter.
    addUiText(this, centerX + 6, 166 + 7, 'Adventure Platformer', {
      ...titleStyle,
      color: toCssColor(PALETTE.ink),
      strokeThickness: 14,
    }).setOrigin(0.5);

    addUiText(this, centerX, 166, 'Adventure Platformer', titleStyle).setOrigin(0.5);

    addUiText(this, centerX, 246, 'A colorful cartoon platformer', {
      fontSize: '26px',
      color: toCssColor(PALETTE.inkSoft),
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private drawStartButton(): void {
    this.startButton = new TextButton(this, GAME_WIDTH / 2, 445, {
      label: 'START GAME',
      width: 400,
      height: 104,
      fontSize: 38,
      onClick: () => this.startGame(),
    });

    addUiText(this, GAME_WIDTH / 2, 520, 'Click or tap to start', {
      fontSize: '20px',
      color: toCssColor(PALETTE.inkSoft),
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setAlpha(0.8);
  }

  private drawVersionLabel(): void {
    addUiText(this, GAME_WIDTH - 28, GAME_HEIGHT - 22, `v${__APP_VERSION__} · development build`, {
      fontSize: '18px',
      color: toCssColor(PALETTE.mutedText),
    })
      .setOrigin(1, 1)
      .setAlpha(0.8);
  }

  private startGame(): void {
    if (this.isStarting) {
      return;
    }

    this.isStarting = true;
    this.startButton?.setEnabled(false);
    this.scene.start(SCENE_KEYS.GAME);
  }
}

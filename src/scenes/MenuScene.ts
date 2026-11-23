import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/constants';
import { requireLevelOrder } from '../core/level-order-config';
import { getLevelRepository } from '../core/level-repository';
import { getSaveStore } from '../core/save-store';
import { isLevelUnlocked } from '../systems/progression';
import type { LevelOrderConfig } from '../types/progression';
import type { SaveData } from '../types/save';
import { PALETTE, toCssColor } from '../ui/theme';
import { formatRatingStars } from '../ui/components/rating-stars';
import { TextButton } from '../ui/components/TextButton';
import { addUiText } from '../ui/components/ui-text';

/**
 * MenuScene - start screen and basic level select.
 *
 * The menu reads the versioned local save to show locked/unlocked state and best
 * ratings. It never writes save data. Locked cards are disabled buttons, so
 * production UI cannot start a level whose progression lock is closed.
 */
export class MenuScene extends Phaser.Scene {
  private startButton: TextButton | null = null;
  private levelButtons: TextButton[] = [];
  private isStarting = false;

  constructor() {
    super(SCENE_KEYS.MENU);
  }

  create(): void {
    this.isStarting = false;
    this.startButton = null;
    this.levelButtons = [];

    this.cameras.main.setBackgroundColor(PALETTE.sky);

    const order = requireLevelOrder();
    const loadedSave = getSaveStore().load();

    if (loadedSave.diagnostic !== undefined) {
      console.warn(`[SaveStore] ${loadedSave.diagnostic}`);
    }

    const save = loadedSave.data;

    this.drawBackdrop();
    this.drawTitle();
    this.drawStartButton(order, save);
    this.drawLevelSelect(order, save);
    this.drawFooter();
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
      fontSize: '62px',
      color: toCssColor(PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 12,
      align: 'center',
    };

    // Hard offset shadow keeps the cartoon look without a blur filter.
    addUiText(this, centerX + 5, 89 + 6, 'Adventure Platformer', {
      ...titleStyle,
      color: toCssColor(PALETTE.ink),
    }).setOrigin(0.5);

    addUiText(this, centerX, 89, 'Adventure Platformer', titleStyle).setOrigin(0.5);

    addUiText(this, centerX, 148, 'Collect coins, grab stars, reach the goal', {
      fontSize: '23px',
      color: toCssColor(PALETTE.inkSoft),
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private drawStartButton(order: LevelOrderConfig, save: SaveData): void {
    const firstUnlockedId =
      order.levels.find((levelId) => isLevelUnlocked(save.unlockedLevelIds, levelId)) ??
      order.levels[0];

    this.startButton = new TextButton(this, GAME_WIDTH / 2, 238, {
      label: 'START GAME',
      width: 400,
      height: 86,
      fontSize: 34,
      onClick: () => this.start(firstUnlockedId),
    });

    if (firstUnlockedId === undefined) {
      this.startButton.setEnabled(false);
    }

    addUiText(this, GAME_WIDTH / 2, 290, 'Starts your first unlocked level', {
      fontSize: '16px',
      color: toCssColor(PALETTE.inkSoft),
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setAlpha(0.85);
  }

  private drawLevelSelect(order: LevelOrderConfig, save: SaveData): void {
    const repository = getLevelRepository();
    const centerX = GAME_WIDTH / 2;

    addUiText(this, centerX, 326, 'SELECT LEVEL', {
      fontStyle: 'bold',
      fontSize: '20px',
      color: toCssColor(PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 5,
    }).setOrigin(0.5);

    const cardWidth = 340;
    const cardHeight = 104;
    const gap = 44;
    const columns = Math.min(3, Math.max(1, order.levels.length));
    const totalWidth = columns * cardWidth + (columns - 1) * gap;
    const startX = centerX - totalWidth / 2 + cardWidth / 2;

    order.levels.forEach((levelId, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const levelResult = repository.getLevel(levelId);
      const levelName = levelResult.ok ? levelResult.value.name : levelId;
      const unlocked = isLevelUnlocked(save.unlockedLevelIds, levelId);
      const record = save.levels[levelId];
      const number = String(index + 1).padStart(2, '0');

      const subtitle = !unlocked
        ? 'LOCKED'
        : record === undefined
          ? 'NOT COMPLETED'
          : `BEST ${record.bestScore} · ${formatRatingStars(record.bestRatingStars)}`;

      const button = new TextButton(
        this,
        startX + column * (cardWidth + gap),
        400 + row * (cardHeight + 20),
        {
          label: `${number} · ${levelName}`,
          subtitle,
          width: cardWidth,
          height: cardHeight,
          fontSize: 21,
          subtitleFontSize: 16,
          onClick: () => this.start(levelId),
        },
      );

      if (!unlocked || !levelResult.ok) {
        button.setEnabled(false);
      }

      this.levelButtons.push(button);
    });

    addUiText(this, centerX, 478, 'Locked levels unlock in order when you complete the previous level', {
      fontSize: '15px',
      color: toCssColor(PALETTE.inkSoft),
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setAlpha(0.85);
  }

  private drawFooter(): void {
    addUiText(this, GAME_WIDTH - 28, GAME_HEIGHT - 22, `v${__APP_VERSION__} · development build`, {
      fontSize: '18px',
      color: toCssColor(PALETTE.mutedText),
    })
      .setOrigin(1, 1)
      .setAlpha(0.8);
  }

  private start(levelId: string | undefined): void {
    if (this.isStarting || levelId === undefined) {
      return;
    }

    this.isStarting = true;
    this.startButton?.setEnabled(false);

    for (const button of this.levelButtons) {
      button.setEnabled(false);
    }

    this.scene.start(SCENE_KEYS.GAME, { levelId });
  }
}

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/constants';
import { PALETTE, toCssColor } from '../ui/theme';
import { addUiText } from '../ui/components/ui-text';
import { DEFAULT_TILE_SIZE } from '../types/level';

const GROUND_TOP = 560;

/**
 * GameScene - development playground.
 *
 * Task 001 scope: a static, non-interactive placeholder that proves navigation
 * works and gives Task 002 a canvas to build movement on. It intentionally does
 * NOT read level JSON yet, and contains no physics, enemies or collectibles.
 *
 * Level layout data must never be hardcoded here; the block below is scene
 * presentation (background + ground band), not game content.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.sky);

    this.drawBackdrop();
    this.drawGround();
    this.drawPlayerPlaceholder(420, GROUND_TOP);
    this.drawLabels();
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(PALETTE.sunGlow, 0.3);
    graphics.fillCircle(1090, 150, 130);
    graphics.fillStyle(PALETTE.sun, 1);
    graphics.fillCircle(1090, 150, 72);

    graphics.fillStyle(PALETTE.cloud, 0.85);
    graphics.fillCircle(250, 140, 38);
    graphics.fillCircle(300, 128, 50);
    graphics.fillCircle(356, 146, 34);
    graphics.fillRect(250, 140, 106, 36);

    graphics.fillStyle(PALETTE.hillFar, 1);
    graphics.fillEllipse(280, GAME_HEIGHT + 20, 980, 420);
    graphics.fillEllipse(880, GAME_HEIGHT + 20, 900, 360);

    graphics.fillStyle(PALETTE.hillNear, 1);
    graphics.fillEllipse(120, GAME_HEIGHT + 30, 780, 320);
    graphics.fillEllipse(720, GAME_HEIGHT + 30, 900, 280);
  }

  private drawGround(): void {
    const graphics = this.add.graphics();
    const groundHeight = GAME_HEIGHT - GROUND_TOP;

    graphics.fillStyle(PALETTE.soil, 1);
    graphics.fillRect(0, GROUND_TOP, GAME_WIDTH, groundHeight);

    graphics.fillStyle(PALETTE.grass, 1);
    graphics.fillRect(0, GROUND_TOP, GAME_WIDTH, 24);

    graphics.fillStyle(PALETTE.grassDark, 1);
    graphics.fillRect(0, GROUND_TOP + 24, GAME_WIDTH, 8);

    // Subtle 64px tile seams: a visual reminder of the level grid contract.
    graphics.lineStyle(2, PALETTE.soilDark, 0.5);
    for (let x = DEFAULT_TILE_SIZE; x < GAME_WIDTH; x += DEFAULT_TILE_SIZE) {
      graphics.beginPath();
      graphics.moveTo(x, GROUND_TOP + 32);
      graphics.lineTo(x, GAME_HEIGHT);
      graphics.strokePath();
    }

    for (let y = GROUND_TOP + DEFAULT_TILE_SIZE; y < GAME_HEIGHT; y += DEFAULT_TILE_SIZE) {
      graphics.beginPath();
      graphics.moveTo(0, y);
      graphics.lineTo(GAME_WIDTH, y);
      graphics.strokePath();
    }
  }

  /**
   * Placeholder character drawn from shapes. The container is anchored at the
   * character's feet, which is the convention future physics bodies will use.
   */
  private drawPlayerPlaceholder(x: number, feetY: number): void {
    const player = this.add.container(x, feetY);
    const graphics = this.add.graphics();

    // Contact shadow.
    graphics.fillStyle(PALETTE.ink, 0.18);
    graphics.fillEllipse(0, -2, 96, 22);

    // Feet.
    graphics.fillStyle(PALETTE.ink, 1);
    graphics.fillRoundedRect(-30, -20, 26, 20, 9);
    graphics.fillRoundedRect(4, -20, 26, 20, 9);

    // Body and arms.
    graphics.fillStyle(PALETTE.playerDark, 1);
    graphics.fillRoundedRect(-36, -92, 72, 76, 22);
    graphics.fillStyle(PALETTE.player, 1);
    graphics.fillRoundedRect(-31, -95, 62, 70, 20);

    graphics.fillStyle(PALETTE.playerDark, 1);
    graphics.fillRoundedRect(-48, -78, 18, 34, 9);
    graphics.fillRoundedRect(30, -78, 18, 34, 9);

    // Head with cartoon outline.
    graphics.fillStyle(PALETTE.ink, 1);
    graphics.fillCircle(0, -124, 38);
    graphics.fillStyle(0xffd7b0, 1);
    graphics.fillCircle(0, -126, 32);

    // Face.
    graphics.fillStyle(PALETTE.ink, 1);
    graphics.fillCircle(-11, -130, 4.5);
    graphics.fillCircle(11, -130, 4.5);
    graphics.lineStyle(3.5, PALETTE.ink, 1);
    graphics.beginPath();
    graphics.arc(0, -120, 11, 0.2 * Math.PI, 0.8 * Math.PI);
    graphics.strokePath();

    // Cheek highlight.
    graphics.fillStyle(PALETTE.white, 0.35);
    graphics.fillEllipse(-22, -140, 12, 16);

    player.add(graphics);
  }

  private drawLabels(): void {
    addUiText(this, 48, 40, 'DEVELOPMENT PLAYGROUND', {
      fontStyle: 'bold',
      fontSize: '34px',
      color: toCssColor(PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 9,
    });

    addUiText(
      this,
      50,
      88,
      'Task 001 placeholder · player movement and physics arrive in Task 002',
      {
        fontStyle: 'bold',
        fontSize: '20px',
        color: toCssColor(PALETTE.inkSoft),
      },
    );
  }
}

import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/constants';
import { requirePlayerConfig } from '../core/player-config';
import { Player } from '../entities/Player';
import { InputManager } from '../input/InputManager';
import { DEFAULT_TILE_SIZE } from '../types/level';
import { DebugHud } from '../ui/components/DebugHud';
import { addUiText } from '../ui/components/ui-text';
import { PALETTE, toCssColor } from '../ui/theme';

/**
 * GameScene - playable movement prototype (Task 002).
 *
 * The arena below is temporary scene presentation, not level content. It exists
 * to exercise gravity, collisions, platforms, the gap/respawn flow and touch
 * controls. A future LevelLoader will replace it with validated JSON terrain.
 */

const GROUND_TOP = 620;
const GROUND_HEIGHT = GAME_HEIGHT - GROUND_TOP;
const PLATFORM_HEIGHT = 10;
const SPAWN = { x: 340, y: GROUND_TOP - 4 } as const;
const RESPAWN_BELOW_Y = GAME_HEIGHT + 120;

const GROUND_SEGMENTS = [
  { x: 0, width: 700 },
  { x: 840, width: GAME_WIDTH - 840 },
] as const;

/**
 * [x, topY, width] - four distinct heights. Platforms are thin and high enough
 * that the 84px collision body (top at ground-84) can walk beneath them, while
 * the ground-level ones stay inside the default jump arc (~112px rise).
 */
const PLATFORMS = [
  { x: 420, topY: 514, width: 180 },
  { x: 640, topY: 440, width: 120 },
  { x: 880, topY: 505, width: 140 },
  { x: 1100, topY: 470, width: 160 },
] as const;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private inputManager!: InputManager;
  private debugHud: DebugHud | null = null;
  private respawnCount = 0;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    const playerConfig = requirePlayerConfig();

    this.cameras.main.setBackgroundColor(PALETTE.sky);

    this.drawBackdrop();
    const staticSurfaces = this.createArena();
    this.drawSpawnMarker();
    this.drawWorldBoundary();

    // Left/right/top block movement; the bottom is intentionally open so the
    // gap has a real consequence and the respawn check can run.
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT, true, true, true, false);

    this.player = new Player(this, SPAWN.x, SPAWN.y, playerConfig.movement);
    this.physics.add.collider(this.player, staticSurfaces);

    this.inputManager = new InputManager(this, {
      enableResetKey: import.meta.env.DEV,
      onFocusLost: () => this.player.cancelBufferedJump(),
    });

    this.drawLabels();

    if (import.meta.env.DEV) {
      this.debugHud = new DebugHud(this);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  override update(_time: number, delta: number): void {
    this.inputManager.update();

    const input = this.inputManager.getInputState();
    this.player.tick(delta, input);

    if (this.inputManager.consumeResetRequest() || this.player.y > RESPAWN_BELOW_Y) {
      this.respawnPlayer();
    }

    this.debugHud?.update({
      velocityX: this.player.velocityX,
      velocityY: this.player.velocityY,
      grounded: this.player.grounded,
      visualState: this.player.visualState,
      coyoteAvailable: this.player.coyoteAvailable,
      jumpBuffered: this.player.jumpBuffered,
      moveX: input.moveX,
      respawns: this.respawnCount,
    });
  }

  private respawnPlayer(): void {
    this.player.respawnAt(SPAWN.x, SPAWN.y);
    this.respawnCount += 1;
  }

  private handleShutdown(): void {
    this.inputManager.destroy();
    this.debugHud = null;
  }

  private createArena(): Phaser.GameObjects.Rectangle[] {
    const solids: Phaser.GameObjects.Rectangle[] = [];

    // Dark pit behind the gap, drawn first so the missing ground reads clearly.
    const gapStart = GROUND_SEGMENTS[0].x + GROUND_SEGMENTS[0].width;
    const gapWidth = GROUND_SEGMENTS[1].x - gapStart;

    this.add
      .rectangle(gapStart + gapWidth / 2, GROUND_TOP + GROUND_HEIGHT / 2, gapWidth, GROUND_HEIGHT, 0x1a2634)
      .setDepth(0);

    for (const segment of GROUND_SEGMENTS) {
      const centerX = segment.x + segment.width / 2;

      const ground = this.add
        .rectangle(centerX, GROUND_TOP + GROUND_HEIGHT / 2, segment.width, GROUND_HEIGHT, PALETTE.soil)
        .setStrokeStyle(4, PALETTE.ink);
      this.physics.add.existing(ground, true);
      solids.push(ground);

      // Grass cap and seam line are purely visual; the body stays rectangular.
      this.add.rectangle(centerX, GROUND_TOP + 11, segment.width, 22, PALETTE.grass).setDepth(1);
      this.add.rectangle(centerX, GROUND_TOP + 25, segment.width, 6, PALETTE.grassDark).setDepth(1);
    }

    for (const platform of PLATFORMS) {
      const centerX = platform.x + platform.width / 2;

      const body = this.add
        .rectangle(
          centerX,
          platform.topY + PLATFORM_HEIGHT / 2,
          platform.width,
          PLATFORM_HEIGHT,
          PALETTE.soilDark,
        )
        .setStrokeStyle(4, PALETTE.ink);
      this.physics.add.existing(body, true);
      solids.push(body);

      this.add
        .rectangle(centerX, platform.topY + 4, platform.width, 8, PALETTE.grass)
        .setDepth(1);
    }

    this.drawGroundSeams();

    return solids;
  }

  private drawGroundSeams(): void {
    const seams = this.add.graphics().setDepth(1);

    seams.lineStyle(2, PALETTE.soilDark, 0.5);

    for (let x = DEFAULT_TILE_SIZE; x < GAME_WIDTH; x += DEFAULT_TILE_SIZE) {
      const inGap = x > GROUND_SEGMENTS[0].width && x < GROUND_SEGMENTS[1].x;

      if (inGap) {
        continue;
      }

      seams.beginPath();
      seams.moveTo(x, GROUND_TOP + 32);
      seams.lineTo(x, GAME_HEIGHT);
      seams.strokePath();
    }
  }

  private drawSpawnMarker(): void {
    const marker = this.add.graphics().setDepth(-1);

    marker.fillStyle(PALETTE.accent, 0.4);
    marker.fillEllipse(SPAWN.x, GROUND_TOP - 5, 88, 20);
    marker.lineStyle(3, PALETTE.accentDark, 0.8);
    marker.strokeEllipse(SPAWN.x, GROUND_TOP - 5, 88, 20);

    addUiText(this, SPAWN.x, GROUND_TOP - 118, 'SPAWN', {
      fontStyle: 'bold',
      fontSize: '14px',
      color: toCssColor(PALETTE.accentDark),
    }).setOrigin(0.5, 1);
  }

  private drawWorldBoundary(): void {
    const boundary = this.add.graphics().setDepth(5);

    boundary.lineStyle(3, PALETTE.ink, 0.3);
    boundary.strokeRect(2, 2, GAME_WIDTH - 4, GAME_HEIGHT - 4);
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

  private drawLabels(): void {
    addUiText(this, 40, 26, 'MOVEMENT PLAYGROUND', {
      fontStyle: 'bold',
      fontSize: '30px',
      color: toCssColor(PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 8,
    });

    addUiText(this, 42, 68, 'Task 002 · Arcade Physics · temporary test arena', {
      fontStyle: 'bold',
      fontSize: '18px',
      color: toCssColor(PALETTE.inkSoft),
    });

    addUiText(
      this,
      42,
      94,
      import.meta.env.DEV
        ? 'MOVE: LEFT/RIGHT or A/D   ·   JUMP: SPACE or W/UP   ·   RESET: R (dev)'
        : 'MOVE: LEFT/RIGHT or A/D   ·   JUMP: SPACE or W/UP',
      {
        fontStyle: 'bold',
        fontSize: '17px',
        color: toCssColor(PALETTE.inkSoft),
      },
    );
  }
}

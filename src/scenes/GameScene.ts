import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/constants';
import {
  CAMERA_FOLLOW_LERP_X,
  CAMERA_FOLLOW_LERP_Y,
  FALL_RESPAWN_MARGIN_TILES,
  resolveRequestedLevelId,
} from '../core/level-config';
import { getLevelRepository } from '../core/level-repository';
import { requirePlayerConfig } from '../core/player-config';
import { Player } from '../entities/Player';
import { InputManager } from '../input/InputManager';
import { computeCameraFrame } from '../systems/level-geometry';
import { loadLevel } from '../systems/LevelLoader';
import type { LevelDefinition } from '../types/level';
import type { LevelGeometry, LevelLoadFailure } from '../types/level-runtime';
import { DebugHud } from '../ui/components/DebugHud';
import { LevelErrorPanel } from '../ui/components/LevelErrorPanel';
import { LevelHeader } from '../ui/components/LevelHeader';
import { PALETTE } from '../ui/theme';

/**
 * GameScene - JSON-driven level orchestration.
 *
 * Responsibilities in Task 003:
 * - select/load a validated level,
 * - build terrain/goal/backdrop through the loader,
 * - spawn the existing Player at the JSON feet anchor,
 * - wire colliders, world bounds, camera follow and input,
 * - respawn on falls and handle loading errors.
 *
 * The scene contains no level layout data. Adding a level requires only a JSON
 * file under content/levels/.
 */
export class GameScene extends Phaser.Scene {
  private player: Player | null = null;
  private inputManager: InputManager | null = null;
  private debugHud: DebugHud | null = null;
  private level: LevelDefinition | null = null;
  private geometry: LevelGeometry | null = null;
  private respawnCount = 0;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  create(): void {
    const requestedId = resolveRequestedLevelId(window.location.search, import.meta.env.DEV);
    const repository = getLevelRepository();

    if (import.meta.env.DEV) {
      const diagnostics = repository.getDiagnostics();

      if (diagnostics.length > 0) {
        console.warn(`[LevelRepository] Content diagnostics:\n${diagnostics.join('\n')}`);
      }
    }

    const levelResult = repository.getLevel(requestedId);

    if (!levelResult.ok) {
      this.showLevelError(levelResult.error);
      return;
    }

    const level = levelResult.value;
    let loadResult: ReturnType<typeof loadLevel>;

    try {
      loadResult = loadLevel(this, level);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      this.showLevelError({
        code: 'load-failed',
        levelId: level.id,
        message: `Failed to build level "${level.id}": ${reason}`,
      });
      return;
    }

    if (!loadResult.ok) {
      this.showLevelError(loadResult.error);
      return;
    }

    this.startPlayableLevel(level, loadResult.runtime.geometry, loadResult.runtime.solids);
  }

  override update(_time: number, delta: number): void {
    if (this.player === null || this.inputManager === null || this.geometry === null) {
      return;
    }

    this.inputManager.update();

    const input = this.inputManager.getInputState();
    this.player.tick(delta, input);

    const fallLimit =
      this.geometry.worldHeight + FALL_RESPAWN_MARGIN_TILES * this.geometry.tileSize;

    if (this.inputManager.consumeResetRequest() || this.player.y > fallLimit) {
      this.respawnPlayer();
    }

    const camera = this.cameras.main;

    this.debugHud?.update({
      levelId: this.level?.id ?? '',
      levelName: this.level?.name ?? '',
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
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

  private startPlayableLevel(
    level: LevelDefinition,
    geometry: LevelGeometry,
    solids: Phaser.GameObjects.Rectangle[],
  ): void {
    const playerConfig = requirePlayerConfig();

    this.level = level;
    this.geometry = geometry;
    this.cameras.main.setBackgroundColor(PALETTE.sky);

    // Left/right/top are blocked; the bottom stays open so gaps and water are
    // real hazards and the JSON-relative fall check can run.
    this.physics.world.setBounds(
      0,
      0,
      geometry.worldWidth,
      geometry.worldHeight,
      true,
      true,
      true,
      false,
    );

    this.player = new Player(this, geometry.spawn.x, geometry.spawn.y, playerConfig.movement);
    this.physics.add.collider(this.player, solids);

    this.configureCamera(geometry, this.player);

    this.inputManager = new InputManager(this, {
      enableResetKey: import.meta.env.DEV,
      onFocusLost: () => this.player?.cancelBufferedJump(),
    });

    new LevelHeader(this, level);

    if (import.meta.env.DEV) {
      this.debugHud = new DebugHud(this);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private configureCamera(geometry: LevelGeometry, player: Player): void {
    const frame = computeCameraFrame(
      geometry.worldWidth,
      geometry.worldHeight,
      GAME_WIDTH,
      GAME_HEIGHT,
    );
    const camera = this.cameras.main;

    camera.setZoom(1);
    camera.setBounds(frame.x, frame.y, frame.width, frame.height);
    camera.startFollow(player, true, CAMERA_FOLLOW_LERP_X, CAMERA_FOLLOW_LERP_Y);
    camera.centerOn(player.x, player.y);
  }

  private respawnPlayer(): void {
    if (this.player === null || this.geometry === null) {
      return;
    }

    const spawn = this.geometry.spawn;

    this.player.respawnAt(spawn.x, spawn.y);
    this.cameras.main.centerOn(spawn.x, spawn.y);
    this.respawnCount += 1;
  }

  private showLevelError(failure: LevelLoadFailure): void {
    const details = failure.details?.map((error) => `${error.path}: ${error.message}`).join('; ');

    console.error(`[GameScene] ${failure.message}${details ? ` ${details}` : ''}`);

    this.cameras.main.setBackgroundColor(PALETTE.background);
    this.cameras.main.stopFollow();

    new LevelErrorPanel(this, {
      failure,
      onBackToMenu: () => this.scene.start(SCENE_KEYS.MENU),
    });
  }

  private handleShutdown(): void {
    this.inputManager?.destroy();
    this.inputManager = null;

    // The camera manager may already be shutting down when a scene restarts.
    this.cameras?.main?.stopFollow();

    this.debugHud = null;
    this.player = null;
    this.geometry = null;
    this.level = null;
  }
}

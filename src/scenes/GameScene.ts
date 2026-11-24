import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../core/constants';
import {
  CAMERA_FOLLOW_LERP_X,
  CAMERA_FOLLOW_LERP_Y,
  FALL_RESPAWN_MARGIN_TILES,
} from '../core/level-config';
import { requireCombatConfig } from '../core/combat-config';
import { requireBombConfig } from '../core/bomb-config';
import { requireEffectsConfig } from '../core/effects-config';
import { requireEnemiesConfig } from '../core/enemies-config';
import { requireInteractiveBlocksConfig } from '../core/interactive-block-config';
import { requirePlayerConfig } from '../core/player-config';
import { requirePlayerFormsConfig } from '../core/player-forms-config';
import { requireWeaponConfig } from '../core/weapon-config';
import { getLevelRepository } from '../core/level-repository';
import { getSaveStore } from '../core/save-store';
import { requireScoringConfig } from '../core/scoring-config';
import { Player } from '../entities/Player';
import { InputManager } from '../input/InputManager';
import { CollectionSystem } from '../systems/CollectionSystem';
import { EnemySystem } from '../systems/EnemySystem';
import { BombSystem } from '../systems/BombSystem';
import { EffectSystem } from '../systems/EffectSystem';
import { EnergyBallSystem } from '../systems/EnergyBallSystem';
import { InteractiveBlockSystem } from '../systems/InteractiveBlockSystem';
import {
  canStartCompletion,
  canStartGameOver,
  isGameplayActive,
  type GameplayState,
} from '../systems/gameplay-state';
import { computeCameraFrame, solidTerrainRects } from '../systems/level-geometry';
import { resolveLevelLaunch } from '../systems/level-launch';
import { loadLevel, type LevelLoadResult, type LevelRuntime } from '../systems/LevelLoader';
import { PlayerHealth } from '../systems/player-health';
import { isLevelUnlocked } from '../systems/progression';
import {
  computeCollectedPoints,
  computeRatingStars,
  computeRunScoreWithEnemies,
} from '../systems/scoring';
import type { GameOverData } from '../types/game-over';
import type { LevelDefinition } from '../types/level';
import type { LevelResultData } from '../types/level-result';
import type { LevelGeometry, LevelLoadFailure } from '../types/level-runtime';
import { DebugHud } from '../ui/components/DebugHud';
import { GameHud } from '../ui/components/GameHud';
import { LevelErrorPanel } from '../ui/components/LevelErrorPanel';
import { LevelHeader } from '../ui/components/LevelHeader';
import { PALETTE } from '../ui/theme';

export interface GameSceneData {
  /** Explicit level chosen by the menu, result screen or retry. */
  readonly levelId?: string;
}

/**
 * GameScene - level orchestration and the gameplay loop.
 *
 * Responsibilities in Task 004:
 * - select a validated level (progression-checked unless using the dev selector),
 * - build terrain/goal/collectibles through LevelLoader,
 * - spawn the player, wire colliders, overlap, camera, input and HUD,
 * - respawn on falls without resetting this run's collected objects,
 * - settle one completion exactly once and hand plain data to ResultScene.
 *
 * Level layout and tuning never live here; both come from validated JSON.
 */
export class GameScene extends Phaser.Scene {
  private player: Player | null = null;
  private inputManager: InputManager | null = null;
  private debugHud: DebugHud | null = null;
  private gameHud: GameHud | null = null;
  private level: LevelDefinition | null = null;
  private geometry: LevelGeometry | null = null;
  private collectionSystem: CollectionSystem | null = null;
  private enemySystem: EnemySystem | null = null;
  private bombSystem: BombSystem | null = null;
  private effectSystem: EffectSystem | null = null;
  private energyBallSystem: EnergyBallSystem | null = null;
  private interactiveBlockSystem: InteractiveBlockSystem | null = null;
  private health: PlayerHealth | null = null;

  private explicitLevelId: string | undefined;
  private state: GameplayState = 'loading';
  private respawnCount = 0;

  constructor() {
    super(SCENE_KEYS.GAME);
  }

  init(data?: GameSceneData): void {
    this.explicitLevelId = data?.levelId;
    this.state = 'loading';
    this.respawnCount = 0;
    this.player = null;
    this.inputManager = null;
    this.debugHud = null;
    this.gameHud = null;
    this.level = null;
    this.geometry = null;
    this.collectionSystem = null;
    this.enemySystem = null;
    this.bombSystem = null;
    this.effectSystem = null;
    this.energyBallSystem = null;
    this.interactiveBlockSystem = null;
    this.health = null;
  }

  create(): void {
    const launch = resolveLevelLaunch(
      this.explicitLevelId,
      window.location.search,
      import.meta.env.DEV,
    );
    const repository = getLevelRepository();

    if (import.meta.env.DEV) {
      const diagnostics = repository.getDiagnostics();

      if (diagnostics.length > 0) {
        console.warn(`[LevelRepository] Content diagnostics:\n${diagnostics.join('\n')}`);
      }
    }

    const levelResult = repository.getLevel(launch.levelId);

    if (!levelResult.ok) {
      this.showLevelError(levelResult.error);
      return;
    }

    const level = levelResult.value;

    if (!launch.bypassLock) {
      const loadedSave = getSaveStore().load();

      if (loadedSave.diagnostic !== undefined) {
        console.warn(`[SaveStore] ${loadedSave.diagnostic}`);
      }

      if (!isLevelUnlocked(loadedSave.data.unlockedLevelIds, level.id)) {
        this.showLevelError({
          code: 'locked-level',
          levelId: level.id,
          message: `Level "${level.id}" is locked. Complete the previous level in the campaign order to unlock it.`,
        });
        return;
      }
    }

    let loadResult: LevelLoadResult;

    try {
      loadResult = loadLevel(this, level, { enemies: requireEnemiesConfig() });
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

    this.startPlayableLevel(level, loadResult.runtime);
  }

  override update(_time: number, delta: number): void {
    if (
      !isGameplayActive(this.state) ||
      this.player === null ||
      this.inputManager === null ||
      this.geometry === null
    ) {
      return;
    }

    this.inputManager.update();

    const input = this.inputManager.getInputState();
    this.player.tick(delta, input);
    this.interactiveBlockSystem?.update(delta);
    this.enemySystem?.update(delta);
    this.bombSystem?.update(delta);
    this.energyBallSystem?.update(delta);

    const fallLimit =
      this.geometry.worldHeight + FALL_RESPAWN_MARGIN_TILES * this.geometry.tileSize;

    if (this.inputManager.consumeResetRequest() || this.player.physicsBody.bottom > fallLimit) {
      this.respawnPlayer();
    }

    if (this.effectSystem !== null && !document.hidden) {
      this.effectSystem.update(delta);
      this.gameHud?.updateEffects(this.effectSystem.active, this.effectSystem.transformation.pending);
    }
    if (this.inputManager.consumeThrowRequest()) this.bombSystem?.throw();
    if (this.inputManager.consumeFireRequest()) this.energyBallSystem?.fire();

    this.gameHud?.updateWeapon(this.energyBallSystem?.remainingMs ?? 0);

    const camera = this.cameras.main;
    const snapshot = this.debugHud === null ? null : this.collectionSystem?.snapshot;
    const enemySnapshot = this.debugHud === null ? null : this.enemySystem?.snapshot;

    this.debugHud?.update({
      levelId: this.level?.id ?? '',
      levelName: this.level?.name ?? '',
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      velocityX: this.player.velocityX,
      velocityY: this.player.velocityY,
      grounded: this.player.grounded,
      visualState: this.player.visualState,
      form: this.effectSystem?.transformation.form ?? 'small',
      growthPending: this.effectSystem?.transformation.pending ?? false,
      coyoteAvailable: this.player.coyoteAvailable,
      jumpBuffered: this.player.jumpBuffered,
      moveX: input.moveX,
      respawns: this.respawnCount,
      coins: snapshot?.coins ?? 0,
      totalCoins: this.geometry.collectibleTotals.coins,
      stars: snapshot?.stars ?? 0,
      totalStars: this.geometry.collectibleTotals.stars,
      score: this.currentCollectedScore(),
      health: this.health?.health ?? 0,
      maxHealth: this.health?.maxHealth ?? 0,
      invulnerable: this.health?.invulnerable ?? false,
      enemiesDefeated: enemySnapshot?.defeatedCount ?? 0,
      totalEnemies: enemySnapshot?.total ?? 0,
      enemyPoints: enemySnapshot?.defeatedPoints ?? 0,
      gameplayState: this.state,
    });
  }

  private startPlayableLevel(level: LevelDefinition, runtime: LevelRuntime): void {
    const playerConfig = requirePlayerConfig();
    const scoring = requireScoringConfig();
    const combat = requireCombatConfig();

    this.level = level;
    this.geometry = runtime.geometry;
    this.health = new PlayerHealth(combat.player);
    this.state = 'playing';

    // A previous completion may have paused the shared Arcade world.
    this.physics.resume();
    this.cameras.main.setBackgroundColor(PALETTE.sky);

    // Left/right/top are blocked; the bottom stays open so gaps and water are
    // real hazards and the JSON-relative fall check can run.
    this.physics.world.setBounds(
      0,
      0,
      runtime.geometry.worldWidth,
      runtime.geometry.worldHeight,
      true,
      true,
      true,
      false,
    );

    this.player = new Player(
      this,
      runtime.geometry.spawn.x,
      runtime.geometry.spawn.y,
      playerConfig.movement,
    );
    this.physics.add.collider(this.player, runtime.solids);

    this.gameHud = new GameHud(
      this,
      level.name,
      runtime.geometry.collectibleTotals,
      this.health.health,
      this.health.maxHealth,
    );

    this.collectionSystem = new CollectionSystem({
      scene: this,
      player: this.player,
      collectibles: runtime.collectibles.group,
      scoring,
      onChanged: () => this.updateHud(),
      onEffectPickup: (type) => this.effectSystem?.activate(type),
      onWeaponPickup: (weaponId) => {
        if (weaponId === this.energyBallSystem?.weaponId) this.energyBallSystem.activate();
      },
    });

    this.interactiveBlockSystem = new InteractiveBlockSystem({
      scene: this,
      player: this.player,
      runtime: runtime.interactiveBlocks,
      config: requireInteractiveBlocksConfig(),
      collectibleGroup: runtime.collectibles.group,
      coins: runtime.collectibles.coins,
      getPlayerForm: () => this.effectSystem?.transformation.form ?? 'small',
      isInteractionActive: () => this.state === 'playing',
      spawnBombReward: (x, y) => this.bombSystem?.spawnRewardPickup(x, y) ?? null,
    });

    this.effectSystem = new EffectSystem({
      scene: this,
      player: this.player,
      coins: runtime.collectibles.coins,
      getSolids: () => [
        ...solidTerrainRects(runtime.geometry),
        ...(this.interactiveBlockSystem?.solidRects ?? []),
      ],
      collection: this.collectionSystem,
      config: requireEffectsConfig(),
      forms: requirePlayerFormsConfig(),
      world: runtime.geometry,
      intersectsEnemy: (body) => this.enemySystem?.intersectsLivingEnemy(body) ?? false,
    });

    // Intact interactive blocks are real solids for enemies and projectiles.
    // Broken bricks keep their disabled body in the array, so Arcade ignores
    // them without rebuilding any collider.
    const collidableSolids = [...runtime.solids, ...runtime.interactiveBlocks.bodies];

    this.physics.add.overlap(
      this.player,
      runtime.goal.sensor,
      this.handleGoalReached,
    );

    this.enemySystem = new EnemySystem({
      scene: this,
      player: this.player,
      runtime: runtime.enemies,
      solids: collidableSolids,
      combat,
      health: this.health,
      absorbPlayerDamage: () => this.effectSystem?.absorbContact() ?? false,
      onChanged: () => this.updateHud(),
      onPlayerDamaged: () => this.updateHud(),
      onPlayerDefeated: () => this.handlePlayerDefeated(),
    });
    this.bombSystem = new BombSystem(this, level, this.player, this.enemySystem,
      collidableSolids, requireBombConfig(), () => this.updateHud());

    this.energyBallSystem = new EnergyBallSystem({
      scene: this,
      player: this.player,
      enemies: this.enemySystem,
      enemyGroup: runtime.enemies.group,
      effects: this.effectSystem.active,
      settings: requireWeaponConfig().weapons['energy-ball'],
      world: runtime.geometry,
      solids: collidableSolids,
    });

    this.configureCamera(runtime.geometry, this.player);

    this.inputManager = new InputManager(this, {
      enableResetKey: import.meta.env.DEV,
      onFocusLost: () => this.player?.cancelBufferedJump(),
    });

    new LevelHeader(this, level);

    if (import.meta.env.DEV) {
      this.debugHud = new DebugHud(this);
    }

    this.updateHud();

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

  private updateHud(): void {
    if (this.collectionSystem === null || this.health === null) {
      return;
    }

    const snapshot = this.collectionSystem.snapshot;

    this.gameHud?.update({
      coins: snapshot.coins,
      stars: snapshot.stars,
      score: this.currentCollectedScore(),
      health: this.health.health,
      maxHealth: this.health.maxHealth,
      bombs: this.bombSystem?.inventory.quantity ?? 0,
    });
  }

  /** Coin/star/enemy points only; victory adds the completion bonus later. */
  private currentCollectedScore(): number {
    if (this.collectionSystem === null) {
      return 0;
    }

    const snapshot = this.collectionSystem.snapshot;

    return computeCollectedPoints(
      { coins: snapshot.coins, stars: snapshot.stars },
      requireScoringConfig(),
      this.enemySystem?.defeatedPoints ?? 0,
    );
  }

  private respawnPlayer(): void {
    if (this.player === null || this.geometry === null) {
      return;
    }

    const spawn = this.geometry.spawn;

    // Collection state is intentionally untouched: falling does not refund or
    // reset coins/stars and the score for this attempt is preserved.
    this.effectSystem?.prepareRespawn(spawn);
    this.player.respawnAt(spawn.x, spawn.y);
    this.cameras.main.centerOn(spawn.x, spawn.y);
    this.respawnCount += 1;
  }

  /**
   * Goal overlap handler. State is flipped synchronously before any work so a
   * second overlap in the same physics step cannot settle the level twice.
   */
  private readonly handleGoalReached = (): void => {
    if (
      !canStartCompletion(this.state) ||
      this.level === null ||
      this.geometry === null ||
      this.collectionSystem === null
    ) {
      return;
    }

    this.state = 'completing';

    const level = this.level;
    const geometry = this.geometry;
    const collection = this.collectionSystem;
    const snapshot = collection.snapshot;
    const enemySnapshot = this.enemySystem?.snapshot;

    collection.freeze();
    this.stopEffects();
    this.bombSystem?.freeze();
    this.energyBallSystem?.freeze();
    this.enemySystem?.freeze();
    this.interactiveBlockSystem?.freeze();
    this.inputManager?.destroy();
    this.inputManager = null;
    this.player?.stopMotion();

    const scoring = requireScoringConfig();
    const enemyPoints = enemySnapshot?.defeatedPoints ?? 0;
    const score = computeRunScoreWithEnemies(
      { coins: snapshot.coins, stars: snapshot.stars },
      enemyPoints,
      scoring,
    ).total;
    const ratingStars = computeRatingStars(
      {
        collectedCoins: snapshot.coins,
        totalCoins: geometry.collectibleTotals.coins,
        collectedStars: snapshot.stars,
        totalStars: geometry.collectibleTotals.stars,
      },
      scoring,
    );

    const settlement = getSaveStore().recordCompletion({
      levelId: level.id,
      score,
      ratingStars,
      collectedCoins: snapshot.coins,
      collectedStars: snapshot.stars,
    });

    if (!settlement.writeOk && settlement.diagnostic !== undefined) {
      console.warn(`[SaveStore] ${settlement.diagnostic}`);
    }

    const result: LevelResultData = {
      levelId: level.id,
      levelName: level.name,
      collectedCoins: snapshot.coins,
      totalCoins: geometry.collectibleTotals.coins,
      collectedStars: snapshot.stars,
      totalCollectibleStars: geometry.collectibleTotals.stars,
      enemiesDefeated: enemySnapshot?.defeatedCount ?? 0,
      totalEnemies: enemySnapshot?.total ?? 0,
      enemyPoints,
      score,
      ratingStars,
      bestRatingStars: settlement.update.record.bestRatingStars,
      bestScore: settlement.update.record.bestScore,
      isNewBest: settlement.update.isNewBest,
      nextLevelId:
        settlement.loadStatus === 'unsupported-version'
          ? null
          : settlement.update.nextLevelId,
      progressSaved: settlement.writeOk,
    };

    this.state = 'results';
    this.scene.start(SCENE_KEYS.RESULT, result);
  };

  /**
   * Terminal failure handler. The state flip happens synchronously so a second
   * contact in the same physics step cannot start another Game Over, and all
   * collection/combat is frozen before the scene changes.
   */
  private handlePlayerDefeated(): void {
    if (
      !canStartGameOver(this.state) ||
      this.level === null ||
      this.collectionSystem === null ||
      this.health === null
    ) {
      return;
    }

    this.state = 'gameover';

    const collection = this.collectionSystem;
    const enemySnapshot = this.enemySystem?.snapshot;
    const snapshot = collection.snapshot;

    collection.freeze();
    this.stopEffects();
    this.bombSystem?.freeze();
    this.energyBallSystem?.freeze();
    this.enemySystem?.freeze();
    this.interactiveBlockSystem?.freeze();
    this.inputManager?.destroy();
    this.inputManager = null;
    this.player?.stopMotion();

    const data: GameOverData = {
      levelId: this.level.id,
      levelName: this.level.name,
      collectedCoins: snapshot.coins,
      totalCoins: this.geometry?.collectibleTotals.coins ?? 0,
      collectedStars: snapshot.stars,
      totalCollectibleStars: this.geometry?.collectibleTotals.stars ?? 0,
      enemiesDefeated: enemySnapshot?.defeatedCount ?? 0,
      totalEnemies: enemySnapshot?.total ?? 0,
      enemyPoints: enemySnapshot?.defeatedPoints ?? 0,
      score: computeCollectedPoints(
        { coins: snapshot.coins, stars: snapshot.stars },
        requireScoringConfig(),
        enemySnapshot?.defeatedPoints ?? 0,
      ),
    };

    this.scene.start(SCENE_KEYS.GAME_OVER, data);
  }

  private showLevelError(failure: LevelLoadFailure): void {
    this.state = 'error';

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
    // The scene owns the remaining bodies and display objects. Explicit
    // systems release their callbacks, effects and input listeners here.
    this.enemySystem?.destroy();
    this.bombSystem?.destroy();
    this.energyBallSystem?.destroy();
    this.interactiveBlockSystem?.destroy();
    this.collectionSystem?.destroy();
    this.stopEffects();
    this.bombSystem = null;
    this.energyBallSystem = null;
    this.interactiveBlockSystem = null;
    this.enemySystem = null;
    this.collectionSystem = null;
    this.health = null;

    this.inputManager?.destroy();
    this.inputManager = null;

    // The camera manager may already be shutting down when a scene restarts.
    this.cameras?.main?.stopFollow();

    this.debugHud = null;
    this.gameHud = null;
    this.player = null;
    this.geometry = null;
    this.level = null;
    this.state = 'loading';
  }

  private stopEffects(): void {
    if (this.effectSystem === null) return;
    this.effectSystem.dispose();
    // On SHUTDOWN Phaser may already have destroyed the scene's text objects.
    if (this.state === 'results' || this.state === 'completing' || this.state === 'gameover') {
      this.gameHud?.updateEffects(this.effectSystem.active);
    }
    this.effectSystem = null;
  }
}

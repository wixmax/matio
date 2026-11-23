import Phaser from 'phaser';
import { APP_NAME, GAME_HEIGHT, GAME_WIDTH } from './constants';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { GameScene } from '../scenes/GameScene';
import { ResultScene } from '../scenes/ResultScene';
import { PALETTE } from '../ui/theme';
import type { PlayerConfig } from '../types/player-config';

/**
 * Builds the single source of truth for the Phaser game configuration.
 *
 * Design notes:
 * - Landscape-first 1280x720 logical space, fitted (never stretched) into the
 *   viewport while preserving the 16:9 aspect ratio.
 * - `Phaser.AUTO` picks WebGL and falls back to the Canvas renderer when WebGL
 *   is unavailable, so the game still boots on restrictive devices.
 * - Arcade Physics is enabled here with gravity sourced from validated external
 *   configuration (`content/config/player.json`), never from scene code.
 * - Four active pointers allow left + right + jump + one spare simultaneously.
 */
export function createGameConfig(playerConfig: PlayerConfig): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game-root',
    title: APP_NAME,
    version: __APP_VERSION__,
    backgroundColor: PALETTE.background,
    banner: true,
    disableContextMenu: true,
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    input: {
      keyboard: true,
      mouse: true,
      touch: true,
      gamepad: false,
      activePointers: 4,
      windowEvents: true,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: playerConfig.movement.gravity },
        debug: false,
        fixedStep: true,
        fps: 60,
      },
    },
    scene: [BootScene, MenuScene, GameScene, ResultScene, GameOverScene],
    callbacks: {
      postBoot: (game) => {
        if (!import.meta.env.DEV) {
          return;
        }

        const renderer =
          game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer ? 'WebGL' : 'Canvas';
        const dpr = window.devicePixelRatio || 1;

        console.info(
          `[${APP_NAME}] v${__APP_VERSION__} | ${renderer} | ${GAME_WIDTH}x${GAME_HEIGHT} logical | DPR ${dpr} | Arcade gravity ${playerConfig.movement.gravity}px/s²`,
        );
      },
    },
  };
}

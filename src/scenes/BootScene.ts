import Phaser from 'phaser';
import { SCENE_KEYS } from '../core/constants';

/**
 * BootScene - the first scene in the game.
 *
 * Responsibilities:
 * - Perform engine-level initialization that must happen before any UI exists.
 * - Load only the assets required by the startup screen (currently none: the
 *   menu is drawn with Phaser shapes/text, so no network requests are needed).
 * - Hand control to MenuScene.
 *
 * It must never contain gameplay logic.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.BOOT);
  }

  preload(): void {
    // Intentional no-op for Task 001.
    // Future startup assets (logo, font, tiny UI atlas) are registered here.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error(`[BootScene] Failed to load startup asset: ${file.src}`);
    });
  }

  create(): void {
    if (import.meta.env.DEV) {
      console.info('[BootScene] Initialization complete. Starting MenuScene.');
    }

    this.scene.start(SCENE_KEYS.MENU);
  }
}

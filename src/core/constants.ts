/**
 * Global, engine-facing constants.
 *
 * Gameplay tuning values (speed, gravity, jump force, ...) must not live here:
 * they belong in content configuration once those systems exist. This module only
 * holds values that describe the application itself.
 */

/** Logical resolution of the game. All scene coordinates use this space. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const APP_NAME = 'Adventure Platformer';

/** Stable scene keys shared by configuration and scene transitions. */
export const SCENE_KEYS = {
  BOOT: 'BootScene',
  MENU: 'MenuScene',
  GAME: 'GameScene',
  RESULT: 'ResultScene',
} as const;

export type SceneKey = (typeof SCENE_KEYS)[keyof typeof SCENE_KEYS];

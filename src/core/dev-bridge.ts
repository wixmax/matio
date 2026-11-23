import type Phaser from 'phaser';

/**
 * Development-only access to the running game for debugging and automated
 * browser verification. It is never installed in production builds.
 *
 * Example (browser console):
 *   window.__MATIO_GAME__.scene.getScene('GameScene')
 */
declare global {
  interface Window {
    __MATIO_GAME__?: Phaser.Game;
  }
}

export function exposeGameForDebug(game: Phaser.Game): void {
  if (!import.meta.env.DEV) {
    return;
  }

  window.__MATIO_GAME__ = game;
  console.info('[Matio] Dev bridge: window.__MATIO_GAME__');
}

export function removeGameDebugBridge(): void {
  if (!import.meta.env.DEV) {
    return;
  }

  delete window.__MATIO_GAME__;
}

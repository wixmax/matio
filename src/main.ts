import Phaser from 'phaser';
import './styles/main.css';
import { createGameConfig } from './core/game-config';
import { installDevErrorOverlay, showBlockingError } from './core/error-overlay';
import { formatPlayerConfigErrors, getPlayerConfigResult } from './core/player-config';
import { exposeGameForDebug, removeGameDebugBridge } from './core/dev-bridge';

installDevErrorOverlay();

const playerConfigResult = getPlayerConfigResult();

if (!playerConfigResult.ok) {
  const detail = formatPlayerConfigErrors(playerConfigResult.errors);

  console.error(`[Matio] Invalid player configuration:\n${detail}`);
  showBlockingError('Invalid player configuration', detail);
} else {
  const game = new Phaser.Game(createGameConfig(playerConfigResult.value));

  exposeGameForDebug(game);

  // Keep Vite HMR from leaking a second canvas / game loop during development.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      removeGameDebugBridge();
      game.destroy(true);
    });
  }
}

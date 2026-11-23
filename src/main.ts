import Phaser from 'phaser';
import './styles/main.css';
import { createGameConfig } from './core/game-config';
import { installDevErrorOverlay } from './core/error-overlay';

installDevErrorOverlay();

const game = new Phaser.Game(createGameConfig());

// Keep Vite HMR from leaking a second canvas / game loop during development.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}

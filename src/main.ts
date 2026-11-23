import Phaser from 'phaser';
import './styles/main.css';
import { createGameConfig } from './core/game-config';
import { installDevErrorOverlay, showBlockingError } from './core/error-overlay';
import { getLevelOrderResult } from './core/level-order-config';
import { getLevelRepository } from './core/level-repository';
import { formatPlayerConfigErrors, getPlayerConfigResult } from './core/player-config';
import { getScoringConfigResult } from './core/scoring-config';
import { exposeGameForDebug, removeGameDebugBridge } from './core/dev-bridge';
import { validateLevelOrderReferences } from './systems/progression';

installDevErrorOverlay();

const playerConfigResult = getPlayerConfigResult();
const scoringConfigResult = getScoringConfigResult();
const levelOrderResult = getLevelOrderResult();
const problems: string[] = [];

if (!playerConfigResult.ok) {
  problems.push(`content/config/player.json\n${formatPlayerConfigErrors(playerConfigResult.errors)}`);
}

if (!scoringConfigResult.ok) {
  problems.push(
    `content/config/scoring.json\n${scoringConfigResult.errors
      .map((error) => `${error.path}: ${error.message}`)
      .join('\n')}`,
  );
}

if (!levelOrderResult.ok) {
  problems.push(
    `content/config/level-order.json\n${levelOrderResult.errors
      .map((error) => `${error.path}: ${error.message}`)
      .join('\n')}`,
  );
} else {
  const repository = getLevelRepository();
  const referenceErrors = validateLevelOrderReferences(
    levelOrderResult.value,
    repository.listLevels().map((level) => level.id),
  );

  if (referenceErrors.length > 0) {
    problems.push(
      `content/config/level-order.json\n${referenceErrors
        .map((error) => `${error.path}: ${error.message}`)
        .join('\n')}`,
    );
  }
}

if (problems.length > 0) {
  const detail = problems.join('\n\n');

  console.error(`[Matio] Invalid content configuration:\n${detail}`);
  showBlockingError('Invalid content configuration', detail);
} else if (playerConfigResult.ok && scoringConfigResult.ok && levelOrderResult.ok) {
  const game = new Phaser.Game(createGameConfig(playerConfigResult.value));

  exposeGameForDebug(game);

  // Keep Vite HMR from leaking a second canvas / game loop during development.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      removeGameDebugBridge();
      game.destroy(true);
    });
  }
} else {
  // Defensive: a result should never fail while `problems` is empty.
  showBlockingError('Invalid content configuration', 'Unknown configuration validation failure.');
}

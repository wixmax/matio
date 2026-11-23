import Phaser from 'phaser';
import { GAME_WIDTH } from '../../core/constants';
import type { CollectibleTotals } from '../../types/collectible';
import { PALETTE, toCssColor } from '../theme';
import { addUiText } from './ui-text';

export interface GameHudSnapshot {
  readonly coins: number;
  readonly stars: number;
  readonly score: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly bombs: number;
}

/**
 * Camera-fixed gameplay HUD: level name, coin/star counters, collected score
 * and player health.
 *
 * Score shown here includes enemy defeat points but excludes the one-time
 * completion bonus, which is added on the result screen. Text is rewritten only
 * when a value actually changes.
 */
export class GameHud {
  private readonly scene: Phaser.Scene;
  private readonly totals: CollectibleTotals;
  private readonly countersText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly bombsText: Phaser.GameObjects.Text;

  private lastCounters = '';
  private lastScore = '';
  private lastHealth = '';
  private lastBombs = '';

  constructor(
    scene: Phaser.Scene,
    levelName: string,
    totals: CollectibleTotals,
    initialHealth: number,
    maxHealth: number,
  ) {
    this.scene = scene;
    this.totals = totals;

    const centerX = GAME_WIDTH - 24 - 235;
    const background = scene.add.graphics().setScrollFactor(0).setDepth(2100);

    background.fillStyle(PALETTE.ink, 0.42);
    background.fillRoundedRect(centerX - 235, 10, 470, 120, 16);
    background.lineStyle(3, PALETTE.white, 0.25);
    background.strokeRoundedRect(centerX - 235, 10, 470, 120, 16);

    addUiText(scene, centerX, 18, levelName, {
      fontStyle: 'bold',
      fontSize: '16px',
      color: toCssColor(PALETTE.mutedText),
    })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2110);

    this.countersText = addUiText(scene, centerX, 38, '', {
      fontStyle: 'bold',
      fontSize: '22px',
      color: toCssColor(PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 4,
    })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2110);

    this.scoreText = addUiText(scene, centerX, 68, '', {
      fontStyle: 'bold',
      fontSize: '16px',
      color: toCssColor(PALETTE.sun),
    })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2110);

    this.healthText = addUiText(scene, centerX, 92, '', {
      fontStyle: 'bold',
      fontSize: '18px',
      color: toCssColor(PALETTE.player),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 3,
    })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(2110);

    this.bombsText = addUiText(scene, centerX + 135, 92, '', {
      fontStyle: 'bold', fontSize: '18px', color: toCssColor(PALETTE.sun),
      stroke: toCssColor(PALETTE.ink), strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2110);

    this.update(
      { coins: 0, stars: 0, score: 0, health: initialHealth, maxHealth, bombs: 0 },
      false,
    );
  }

  update(snapshot: GameHudSnapshot, pulse = true): void {
    const counters = `COINS ${snapshot.coins}/${this.totals.coins}    STARS ${snapshot.stars}/${this.totals.stars}`;
    const score = `SCORE ${snapshot.score}`;
    const health = formatHealth(snapshot.health, snapshot.maxHealth);
    const bombs = `BOMBS × ${snapshot.bombs}`;

    if (
      counters === this.lastCounters &&
      score === this.lastScore &&
      health === this.lastHealth && bombs === this.lastBombs
    ) {
      return;
    }

    const countersChanged = this.lastCounters.length > 0 && counters !== this.lastCounters;

    this.lastCounters = counters;
    this.lastScore = score;
    this.lastHealth = health;
    this.lastBombs = bombs;

    this.countersText.setText(counters);
    this.scoreText.setText(score);
    this.healthText.setText(health);
    this.bombsText.setText(bombs);

    if (pulse && countersChanged) {
      this.scene.tweens.killTweensOf(this.countersText);
      this.countersText.setScale(1.1);
      this.scene.tweens.add({
        targets: this.countersText,
        scale: 1,
        duration: 160,
        ease: 'Quad.easeOut',
      });
    }
  }
}

function formatHealth(health: number, maxHealth: number): string {
  const max = Math.max(0, Math.trunc(maxHealth));
  const current = Math.min(max, Math.max(0, Math.trunc(health)));
  const filled = '♥'.repeat(current);
  const empty = '♡'.repeat(Math.max(0, max - current));

  return `HEALTH ${filled}${empty}`;
}

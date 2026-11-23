import Phaser from 'phaser';
import { GAME_WIDTH } from '../../core/constants';
import type { CollectibleTotals } from '../../types/collectible';
import { PALETTE, toCssColor } from '../theme';
import { addUiText } from './ui-text';

export interface GameHudSnapshot {
  readonly coins: number;
  readonly stars: number;
  readonly score: number;
}

/**
 * Camera-fixed gameplay HUD: level name, coin/star counters and collected score.
 * Score shown here excludes the one-time completion bonus, which is added on
 * the result screen.
 */
export class GameHud {
  private readonly scene: Phaser.Scene;
  private readonly totals: CollectibleTotals;
  private readonly countersText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;

  private lastCounters = '';

  constructor(scene: Phaser.Scene, levelName: string, totals: CollectibleTotals) {
    this.scene = scene;
    this.totals = totals;

    const centerX = GAME_WIDTH - 24 - 235;
    const background = scene.add.graphics().setScrollFactor(0).setDepth(2100);

    background.fillStyle(PALETTE.ink, 0.42);
    background.fillRoundedRect(centerX - 235, 10, 470, 88, 16);
    background.lineStyle(3, PALETTE.white, 0.25);
    background.strokeRoundedRect(centerX - 235, 10, 470, 88, 16);

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

    this.update({ coins: 0, stars: 0, score: 0 }, false);
  }

  update(snapshot: GameHudSnapshot, pulse = true): void {
    const counters = `COINS ${snapshot.coins}/${this.totals.coins}    STARS ${snapshot.stars}/${this.totals.stars}`;
    const score = `SCORE ${snapshot.score}`;

    if (counters === this.lastCounters) {
      return;
    }

    const gained = pulse && this.lastCounters.length > 0;

    this.lastCounters = counters;
    this.countersText.setText(counters);
    this.scoreText.setText(score);

    if (gained) {
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

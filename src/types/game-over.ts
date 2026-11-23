/**
 * Plain data passed from GameScene to GameOverScene.
 *
 * It contains no Phaser references and no completion bonus: a failed run never
 * writes a level record, unlocks a level or awards victory rewards.
 */
export interface GameOverData {
  readonly levelId: string;
  readonly levelName: string;
  readonly collectedCoins: number;
  readonly totalCoins: number;
  readonly collectedStars: number;
  readonly totalCollectibleStars: number;
  readonly enemiesDefeated: number;
  readonly totalEnemies: number;
  readonly enemyPoints: number;
  /** Collected/enemy points only; the completion bonus is not granted. */
  readonly score: number;
}

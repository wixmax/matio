/**
 * Engine-free enemy-defeat ledger.
 *
 * Mirrors `CollectionLedger`: Phaser callbacks can repeat inside one physics
 * step, so defeat points must be recorded at most once per enemy key. The
 * ledger is the authority for the enemy contribution to the run score, which is
 * then fed into the existing score/rating functions instead of keeping a second
 * independent score total.
 */
export class EnemyLedger {
  private readonly defeated = new Map<string, number>();
  private totalPoints = 0;

  /** Returns true only for the first defeat of a key during this run. */
  recordDefeat(key: string, points: number): boolean {
    if (this.defeated.has(key)) {
      return false;
    }

    const normalized = normalizePoints(points);

    this.defeated.set(key, normalized);
    this.totalPoints += normalized;

    return true;
  }

  has(key: string): boolean {
    return this.defeated.has(key);
  }

  get defeatedCount(): number {
    return this.defeated.size;
  }

  get points(): number {
    return this.totalPoints;
  }
}

function normalizePoints(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

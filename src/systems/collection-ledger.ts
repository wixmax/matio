import type { CollectibleCounts, CollectibleType } from '../types/collectible';

/**
 * Engine-free run ledger.
 *
 * The ledger is the authoritative "already collected" guard. Phaser overlap
 * callbacks may fire several times for one object (or for two collectibles in
 * the same physics step), so collection must be idempotent before any score or
 * HUD update happens.
 */
export class CollectionLedger {
  private readonly collected = new Map<string, CollectibleType>();
  private coinCount = 0;
  private starCount = 0;

  /** Returns true only for the first collection of a key during this run. */
  collect(key: string, type: CollectibleType): boolean {
    if (this.collected.has(key)) {
      return false;
    }

    this.collected.set(key, type);

    if (type === 'coin') {
      this.coinCount += 1;
    } else {
      this.starCount += 1;
    }

    return true;
  }

  has(key: string): boolean {
    return this.collected.has(key);
  }

  get coins(): number {
    return this.coinCount;
  }

  get stars(): number {
    return this.starCount;
  }

  get counts(): CollectibleCounts {
    return { coins: this.coinCount, stars: this.starCount };
  }

  get size(): number {
    return this.collected.size;
  }
}

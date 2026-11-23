import { describe, expect, it } from 'vitest';
import { CollectionLedger } from '../src/systems/collection-ledger';

describe('CollectionLedger - idempotent collection', () => {
  it('collects each key at most once even when overlap fires repeatedly', () => {
    const ledger = new CollectionLedger();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      ledger.collect('coin:0', 'coin');
    }

    expect(ledger.coins).toBe(1);
    expect(ledger.stars).toBe(0);
    expect(ledger.size).toBe(1);
    expect(ledger.has('coin:0')).toBe(true);
  });

  it('returns true only for the first collection', () => {
    const ledger = new CollectionLedger();

    expect(ledger.collect('star:3', 'star')).toBe(true);
    expect(ledger.collect('star:3', 'star')).toBe(false);
    expect(ledger.collect('coin:3', 'coin')).toBe(true);
  });

  it('tracks coins and collectible stars independently', () => {
    const ledger = new CollectionLedger();

    ledger.collect('coin:0', 'coin');
    ledger.collect('coin:1', 'coin');
    ledger.collect('star:2', 'star');

    expect(ledger.coins).toBe(2);
    expect(ledger.stars).toBe(1);
    expect(ledger.counts).toEqual({ coins: 2, stars: 1 });
  });

  it('starts empty for a fresh attempt (retry creates a new ledger)', () => {
    const firstAttempt = new CollectionLedger();
    firstAttempt.collect('coin:0', 'coin');

    const retryAttempt = new CollectionLedger();

    expect(retryAttempt.size).toBe(0);
    expect(retryAttempt.counts).toEqual({ coins: 0, stars: 0 });
    expect(firstAttempt.counts).toEqual({ coins: 1, stars: 0 });
  });
});

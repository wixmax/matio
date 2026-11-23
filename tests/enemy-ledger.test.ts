import { describe, expect, it } from 'vitest';
import { EnemyLedger } from '../src/systems/enemy-ledger';

describe('enemy ledger - defeat rewards once', () => {
  it('records the first defeat and ignores duplicates', () => {
    const ledger = new EnemyLedger();

    expect(ledger.recordDefeat('enemy:0', 200)).toBe(true);
    expect(ledger.recordDefeat('enemy:0', 200)).toBe(false);
    expect(ledger.defeatedCount).toBe(1);
    expect(ledger.points).toBe(200);
  });

  it('sums different enemies and keeps the count', () => {
    const ledger = new EnemyLedger();

    ledger.recordDefeat('enemy:0', 200);
    ledger.recordDefeat('enemy:1', 350);
    ledger.recordDefeat('enemy:2', 0);

    expect(ledger.defeatedCount).toBe(3);
    expect(ledger.points).toBe(550);
  });

  it('normalizes invalid point values instead of corrupting the total', () => {
    const ledger = new EnemyLedger();

    ledger.recordDefeat('a', -100);
    ledger.recordDefeat('b', Number.NaN);
    ledger.recordDefeat('c', 120.9);

    expect(ledger.points).toBe(120);
  });

  it('reports repeated queries deterministically', () => {
    const ledger = new EnemyLedger();
    ledger.recordDefeat('enemy:0', 200);

    expect(ledger.has('enemy:0')).toBe(true);
    expect(ledger.has('enemy:1')).toBe(false);
    expect(ledger.points).toBe(200);
    expect(ledger.points).toBe(200);
  });
});

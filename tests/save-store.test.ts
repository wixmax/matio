import { describe, expect, it } from 'vitest';
import {
  SaveStore,
  SAVE_STORAGE_KEY,
  type SaveStorage,
} from '../src/systems/save-store';
import type { LevelOrderConfig } from '../src/types/progression';
import type { LevelCompletionInput } from '../src/types/save';

const ORDER: LevelOrderConfig = {
  schemaVersion: 1,
  levels: ['world-01-level-01', 'world-01-level-02', 'world-01-level-03'],
};

class FakeStorage implements SaveStorage {
  readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error('read blocked');
    }

    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('quota exceeded');
    }

    this.values.set(key, value);
  }
}

function completion(overrides: Partial<LevelCompletionInput> = {}): LevelCompletionInput {
  return {
    levelId: 'world-01-level-01',
    score: 2500,
    ratingStars: 3,
    collectedCoins: 12,
    collectedStars: 2,
    ...overrides,
  };
}

function createStore(storage: SaveStorage | null): SaveStore {
  return new SaveStore(storage, ORDER, SAVE_STORAGE_KEY);
}

describe('SaveStore - first launch and roundtrip', () => {
  it('creates a first-launch save with only the first level unlocked', () => {
    const result = createStore(new FakeStorage()).load();

    expect(result.status).toBe('new');
    expect(result.data.unlockedLevelIds).toEqual(['world-01-level-01']);
    expect(result.data.levels).toEqual({});
  });

  it('saves and loads progression', () => {
    const storage = new FakeStorage();
    const store = createStore(storage);
    const settlement = store.recordCompletion(completion());

    expect(settlement.writeOk).toBe(true);
    expect(storage.values.get(SAVE_STORAGE_KEY)).toContain('"bestScore":2500');

    const reloaded = createStore(storage).load();

    expect(reloaded.status).toBe('loaded');
    expect(reloaded.data.unlockedLevelIds).toEqual([
      'world-01-level-01',
      'world-01-level-02',
    ]);
    expect(reloaded.data.levels['world-01-level-01']?.bestScore).toBe(2500);
  });

  it('preserves the best record when a replay is worse', () => {
    const storage = new FakeStorage();
    createStore(storage).recordCompletion(completion());

    const store = createStore(storage);
    store.recordCompletion(
      completion({
        score: 900,
        ratingStars: 1,
        collectedCoins: 1,
        collectedStars: 0,
      }),
    );

    const reloaded = createStore(storage).load();

    expect(reloaded.data.levels['world-01-level-01']).toEqual({
      completed: true,
      bestScore: 2500,
      bestRatingStars: 3,
      bestCollectedCoins: 12,
      bestCollectedStars: 2,
    });
  });

  it('settles the same completion twice without duplication', () => {
    const storage = new FakeStorage();
    const store = createStore(storage);

    store.recordCompletion(completion());
    store.recordCompletion(completion());

    const reloaded = createStore(storage).load();

    expect(reloaded.data.levels['world-01-level-01']?.bestScore).toBe(2500);
    expect(reloaded.data.unlockedLevelIds).toEqual([
      'world-01-level-01',
      'world-01-level-02',
    ]);
  });
});

describe('SaveStore - recovery and storage failures', () => {
  it('recovers from corrupt JSON with a diagnostic', () => {
    const storage = new FakeStorage();
    storage.values.set(SAVE_STORAGE_KEY, '{ not json');

    const result = createStore(storage).load();

    expect(result.status).toBe('recovered');
    expect(result.diagnostic).toContain('not valid JSON');
    expect(result.data.unlockedLevelIds).toEqual(['world-01-level-01']);
    expect(result.data.levels).toEqual({});
  });

  it('recovers from structurally invalid version-1 data', () => {
    const storage = new FakeStorage();
    storage.values.set(
      SAVE_STORAGE_KEY,
      JSON.stringify({ saveVersion: 1, unlockedLevelIds: ['unknown'], levels: {} }),
    );

    const result = createStore(storage).load();

    expect(result.status).toBe('recovered');
    expect(result.diagnostic).toContain('unknown level ID');
    expect(result.data.unlockedLevelIds).toEqual(['world-01-level-01']);
  });

  it('adds the initial unlock to a valid save that lost it', () => {
    const storage = new FakeStorage();
    storage.values.set(
      SAVE_STORAGE_KEY,
      JSON.stringify({ saveVersion: 1, unlockedLevelIds: [], levels: {} }),
    );

    const result = createStore(storage).load();

    expect(result.status).toBe('loaded');
    expect(result.data.unlockedLevelIds).toEqual(['world-01-level-01']);
  });

  it('derives unlocks from completed level records', () => {
    const storage = new FakeStorage();
    storage.values.set(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        saveVersion: 1,
        unlockedLevelIds: [],
        levels: {
          'world-01-level-03': {
            completed: true,
            bestScore: 1000,
            bestRatingStars: 1,
            bestCollectedCoins: 0,
            bestCollectedStars: 0,
          },
        },
      }),
    );

    const result = createStore(storage).load();

    expect(result.data.unlockedLevelIds).toEqual([
      'world-01-level-01',
      'world-01-level-03',
    ]);
  });

  it('does not overwrite an unsupported save version', () => {
    const storage = new FakeStorage();
    const newerSave = JSON.stringify({ saveVersion: 99, unlockedLevelIds: [], levels: {} });
    storage.values.set(SAVE_STORAGE_KEY, newerSave);

    const store = createStore(storage);
    const loaded = store.load();

    expect(loaded.status).toBe('unsupported-version');
    expect(loaded.data.unlockedLevelIds).toEqual(['world-01-level-01']);

    const settlement = store.recordCompletion(completion());

    expect(settlement.writeOk).toBe(false);
    expect(storage.values.get(SAVE_STORAGE_KEY)).toBe(newerSave);
  });

  it('runs in memory when storage is unavailable', () => {
    const store = createStore(null);

    expect(store.load().status).toBe('storage-unavailable');

    const settlement = store.recordCompletion(completion());

    expect(settlement.writeOk).toBe(false);
    expect(settlement.update.save.levels['world-01-level-01']?.bestScore).toBe(2500);

    const again = store.load();

    expect(again.data.levels['world-01-level-01']?.bestScore).toBe(2500);
  });

  it('survives read errors without throwing', () => {
    const storage = new FakeStorage();
    storage.failReads = true;

    const store = createStore(storage);
    const result = store.load();

    expect(result.status).toBe('storage-unavailable');
    expect(result.diagnostic).toContain('read blocked');
    expect(store.load().data.unlockedLevelIds).toEqual(['world-01-level-01']);
  });

  it('survives write failures and keeps session progress in memory', () => {
    const storage = new FakeStorage();
    storage.failWrites = true;

    const store = createStore(storage);
    const settlement = store.recordCompletion(completion());

    expect(settlement.writeOk).toBe(false);
    expect(settlement.diagnostic).toContain('written');

    const reloaded = store.load();

    expect(reloaded.data.levels['world-01-level-01']?.bestScore).toBe(2500);
  });

  it('refuses to write invalid save data', () => {
    const store = createStore(new FakeStorage());
    const result = store.save({
      saveVersion: 1,
      unlockedLevelIds: ['world-99'],
      levels: {},
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostic).toContain('unknown level ID');
  });
});

import { describe, expect, it } from 'vitest';
import { validateSaveData } from '../src/systems/save-validator';
import type { SaveData } from '../src/types/save';

const KNOWN = ['world-01-level-01', 'world-01-level-02', 'world-01-level-03'] as const;

function createSave(): SaveData {
  return {
    saveVersion: 1,
    unlockedLevelIds: ['world-01-level-01', 'world-01-level-02'],
    levels: {
      'world-01-level-01': {
        completed: true,
        bestScore: 2500,
        bestRatingStars: 3,
        bestCollectedCoins: 12,
        bestCollectedStars: 2,
      },
    },
  };
}

function errorPaths(input: unknown): string[] {
  const result = validateSaveData(input, KNOWN);

  return result.ok ? [] : result.errors.map((error) => error.path);
}

describe('validateSaveData - valid data', () => {
  it('accepts a complete save', () => {
    const result = validateSaveData(createSave(), KNOWN);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value).toEqual(createSave());
    }
  });

  it('accepts an empty level record map and empty unlock list', () => {
    const result = validateSaveData(
      { saveVersion: 1, unlockedLevelIds: [], levels: {} },
      KNOWN,
    );

    expect(result.ok).toBe(true);
  });

  it('ignores unknown extra fields', () => {
    expect(validateSaveData({ ...createSave(), future: true }, KNOWN).ok).toBe(true);
  });
});

describe('validateSaveData - invalid data', () => {
  it('rejects non-object roots', () => {
    for (const input of [null, [], 'save', 1]) {
      expect(errorPaths(input)).toEqual(['$']);
    }
  });

  it('rejects missing and unsupported versions', () => {
    expect(errorPaths({})).toContain('$.saveVersion');

    const result = validateSaveData({ ...createSave(), saveVersion: 2 }, KNOWN);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContainEqual({
        path: '$.saveVersion',
        message: 'unsupported save version 2; this build supports version 1.',
      });
    }
  });

  it('rejects unknown or duplicate unlocked level IDs', () => {
    const paths = errorPaths({
      ...createSave(),
      unlockedLevelIds: ['world-01-level-01', 'world-01-level-01', 'world-99'],
    });

    expect(paths).toContain('$.unlockedLevelIds[1]');
    expect(paths).toContain('$.unlockedLevelIds[2]');
  });

  it('rejects unknown record keys and missing record fields', () => {
    const paths = errorPaths({
      saveVersion: 1,
      unlockedLevelIds: ['world-01-level-01'],
      levels: {
        'world-99': {},
        'world-01-level-01': { completed: true, bestScore: 100 },
      },
    });

    expect(paths).toContain('$.levels["world-99"]');
    expect(paths).toContain('$.levels["world-01-level-01"].bestRatingStars');
    expect(paths).toContain('$.levels["world-01-level-01"].bestCollectedCoins');
    expect(paths).toContain('$.levels["world-01-level-01"].bestCollectedStars');
  });

  it('rejects invalid numeric values and ratings outside 1..3', () => {
    const paths = errorPaths({
      saveVersion: 1,
      unlockedLevelIds: ['world-01-level-01'],
      levels: {
        'world-01-level-01': {
          completed: true,
          bestScore: -1,
          bestRatingStars: 4,
          bestCollectedCoins: 1.5,
          bestCollectedStars: 'many',
        },
      },
    });

    expect(paths).toContain('$.levels["world-01-level-01"].bestScore');
    expect(paths).toContain('$.levels["world-01-level-01"].bestRatingStars');
    expect(paths).toContain('$.levels["world-01-level-01"].bestCollectedCoins');
    expect(paths).toContain('$.levels["world-01-level-01"].bestCollectedStars');
  });
});

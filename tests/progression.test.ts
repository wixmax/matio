import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateLevelOrderConfig } from '../src/systems/level-order-validator';
import {
  createInitialUnlockedLevelIds,
  getNextLevelId,
  isLevelUnlocked,
  sortLevelIdsByOrder,
  unlockLevelAfterCompletion,
  validateLevelOrderReferences,
} from '../src/systems/progression';
import type { LevelOrderConfig } from '../src/types/progression';

const ORDER_PATH = fileURLToPath(new URL('../content/config/level-order.json', import.meta.url));

const ORDER: LevelOrderConfig = {
  schemaVersion: 1,
  levels: ['world-01-level-01', 'world-01-level-02', 'world-01-level-03'],
};

function errorPaths(input: unknown): string[] {
  const result = validateLevelOrderConfig(input);

  return result.ok ? [] : result.errors.map((error) => error.path);
}

describe('level order - shipped configuration', () => {
  it('accepts content/config/level-order.json', () => {
    const result = validateLevelOrderConfig(JSON.parse(readFileSync(ORDER_PATH, 'utf8')));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(JSON.stringify(result.errors));
    }

    expect(result.value.levels).toEqual(ORDER.levels);
  });

  it('references only levels with a deterministic unique order', () => {
    expect(new Set(ORDER.levels).size).toBe(ORDER.levels.length);
    expect(validateLevelOrderReferences(ORDER, ORDER.levels)).toEqual([]);
  });
});

describe('level order validation - invalid content', () => {
  it('rejects non-object roots and missing arrays', () => {
    expect(errorPaths(null)).toEqual(['$']);
    expect(errorPaths({})).toContain('$.schemaVersion');
    expect(errorPaths({})).toContain('$.levels');
  });

  it('rejects unsupported versions', () => {
    const result = validateLevelOrderConfig({ ...ORDER, schemaVersion: 2 });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContainEqual({
        path: '$.schemaVersion',
        message: 'unsupported schema version 2; this build supports version 1.',
      });
    }
  });

  it('rejects an empty order', () => {
    expect(errorPaths({ schemaVersion: 1, levels: [] })).toContain('$.levels');
  });

  it('rejects duplicate and malformed IDs', () => {
    const paths = errorPaths({
      schemaVersion: 1,
      levels: ['world-01-level-01', 'world-01-level-01', 'World 02', 42],
    });

    expect(paths).toContain('$.levels[1]');
    expect(paths).toContain('$.levels[2]');
    expect(paths).toContain('$.levels[3]');
  });

  it('reports missing level references clearly', () => {
    const errors = validateLevelOrderReferences(ORDER, ['world-01-level-01']);

    expect(errors).toEqual([
      {
        path: '$.levels[1]',
        message: 'references level "world-01-level-02", which is not available in content/levels.',
      },
      {
        path: '$.levels[2]',
        message: 'references level "world-01-level-03", which is not available in content/levels.',
      },
    ]);
  });
});

describe('progression - unlock rules', () => {
  it('unlocks only the first level for a new save', () => {
    expect(createInitialUnlockedLevelIds(ORDER)).toEqual(['world-01-level-01']);
  });

  it('checks unlock state without filesystem ordering', () => {
    expect(isLevelUnlocked(['world-01-level-01'], 'world-01-level-01')).toBe(true);
    expect(isLevelUnlocked(['world-01-level-01'], 'world-01-level-02')).toBe(false);
  });

  it('returns the next level in explicit order', () => {
    expect(getNextLevelId(ORDER, 'world-01-level-01')).toBe('world-01-level-02');
    expect(getNextLevelId(ORDER, 'world-01-level-02')).toBe('world-01-level-03');
    expect(getNextLevelId(ORDER, 'world-01-level-03')).toBeNull();
    expect(getNextLevelId(ORDER, 'not-in-order')).toBeNull();
  });

  it('unlocks the next level after a completion and keeps campaign order', () => {
    const unlocked = unlockLevelAfterCompletion(
      ['world-01-level-03', 'world-01-level-01'],
      ORDER,
      'world-01-level-01',
    );

    expect(unlocked).toEqual(['world-01-level-01', 'world-01-level-02', 'world-01-level-03']);
  });

  it('does not invent a level after the final level', () => {
    expect(
      unlockLevelAfterCompletion(['world-01-level-01', 'world-01-level-02'], ORDER, 'world-01-level-02'),
    ).toEqual(['world-01-level-01', 'world-01-level-02', 'world-01-level-03']);
    expect(
      unlockLevelAfterCompletion(
        ['world-01-level-01', 'world-01-level-02', 'world-01-level-03'],
        ORDER,
        'world-01-level-03',
      ),
    ).toEqual(['world-01-level-01', 'world-01-level-02', 'world-01-level-03']);
  });

  it('filters unknown IDs and normalizes ordering', () => {
    expect(
      sortLevelIdsByOrder(['world-01-level-03', 'unknown', 'world-01-level-01'], ORDER),
    ).toEqual(['world-01-level-01', 'world-01-level-03']);
  });
});

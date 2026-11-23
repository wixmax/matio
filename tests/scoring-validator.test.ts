import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateScoringConfig } from '../src/systems/scoring-validator';
import type { ScoringConfig } from '../src/types/scoring';

const SCORING_PATH = fileURLToPath(new URL('../content/config/scoring.json', import.meta.url));

function createConfig(): ScoringConfig {
  return {
    schemaVersion: 1,
    points: { coin: 100, star: 500, levelComplete: 1000 },
    rating: { twoStarMinCoinRatio: 0.7 },
  };
}

function errorPaths(input: unknown): string[] {
  const result = validateScoringConfig(input);

  return result.ok ? [] : result.errors.map((error) => error.path);
}

describe('validateScoringConfig - shipped content', () => {
  it('accepts content/config/scoring.json', () => {
    const result = validateScoringConfig(JSON.parse(readFileSync(SCORING_PATH, 'utf8')));

    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error(JSON.stringify(result.errors));
    }

    expect(result.value).toEqual(createConfig());
  });

  it('accepts boundary values and ignores unknown fields', () => {
    const boundaries: ScoringConfig = {
      ...createConfig(),
      points: { coin: 0, star: 1_000_000, levelComplete: 1_000_000 },
      rating: { twoStarMinCoinRatio: 0 },
    };

    expect(validateScoringConfig({ ...boundaries, future: true }).ok).toBe(true);

    const upper: ScoringConfig = {
      ...createConfig(),
      rating: { twoStarMinCoinRatio: 1 },
    };

    expect(validateScoringConfig(upper).ok).toBe(true);
  });
});

describe('validateScoringConfig - invalid content', () => {
  it('rejects non-object roots', () => {
    for (const input of [null, [], 'scoring', 12]) {
      expect(errorPaths(input)).toEqual(['$']);
    }
  });

  it('reports missing sections', () => {
    const paths = errorPaths({});

    expect(paths).toContain('$.schemaVersion');
    expect(paths).toContain('$.points');
    expect(paths).toContain('$.rating');
  });

  it('rejects an unsupported schema version', () => {
    const result = validateScoringConfig({ ...createConfig(), schemaVersion: 2 });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors).toContainEqual({
        path: '$.schemaVersion',
        message: 'unsupported schema version 2; this build supports version 1.',
      });
    }
  });

  it('requires integer points within bounds', () => {
    const config = createConfig();
    const paths = errorPaths({
      ...config,
      points: { coin: -1, star: 10.5, levelComplete: 1_000_001 },
    });

    expect(paths).toContain('$.points.coin');
    expect(paths).toContain('$.points.star');
    expect(paths).toContain('$.points.levelComplete');
  });

  it('requires a finite ratio between 0 and 1', () => {
    for (const ratio of [-0.1, 1.1, Number.NaN, '0.5']) {
      const config = createConfig();

      expect(
        errorPaths({
          ...config,
          rating: { twoStarMinCoinRatio: ratio },
        }),
      ).toContain('$.rating.twoStarMinCoinRatio');
    }
  });
});

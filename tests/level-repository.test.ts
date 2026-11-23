import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LevelRepository } from '../src/systems/LevelRepository';
import { validateLevel } from '../src/systems/level-validator';
import type { LevelDefinition } from '../src/types/level';
import type { LevelSource } from '../src/types/level-runtime';

const LEVELS_ROOT = fileURLToPath(new URL('../content/levels', import.meta.url));

function collectLevelSources(directory: string): LevelSource[] {
  const sources: LevelSource[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      sources.push(...collectLevelSources(path));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      sources.push({ path, raw: readFileSync(path, 'utf8') });
    }
  }

  return sources;
}

function createMinimalLevel(id: string): LevelDefinition {
  return {
    schemaVersion: 1,
    id,
    name: `Level ${id}`,
    tileSize: 64,
    size: { width: 20, height: 10 },
    spawn: { x: 1, y: 8 },
    goal: { x: 18, y: 8 },
    terrain: [{ type: 'ground', x: 0, y: 9, width: 20, height: 1 }],
    objects: [],
  };
}

function errorsOf(result: ReturnType<LevelRepository['getLevel']>) {
  if (result.ok) {
    throw new Error('Expected level loading to fail, but it succeeded.');
  }

  return result.error;
}

describe('LevelRepository - bundled levels', () => {
  it('discovers every shipped level and validates it', () => {
    const sources = collectLevelSources(LEVELS_ROOT);
    const repository = LevelRepository.fromSources(sources);

    expect(sources.length).toBeGreaterThanOrEqual(3);
    expect(repository.getDiagnostics()).toEqual([]);
    const ids = repository.listLevels().map((level) => level.id);

    expect(ids).toContain('world-01-level-01');
    expect(ids).toContain('world-01-level-02');
    expect(ids).toContain('world-01-level-03');
    expect(new Set(ids).size).toBe(ids.length);

    for (const summary of repository.listLevels()) {
      const result = repository.getLevel(summary.id);

      expect(result.ok).toBe(true);

      if (result.ok) {
        expect(result.value.id).toBe(summary.id);
        expect(result.value.name).toBe(summary.name);
      }
    }
  });

  it('loads level 01 by ID with its normalized definition', () => {
    const repository = LevelRepository.fromSources(collectLevelSources(LEVELS_ROOT));
    const result = repository.getLevel('world-01-level-01');

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.tileSize).toBe(64);
      expect(result.value.size).toEqual({ width: 40, height: 15 });
      expect(result.value.terrain).toHaveLength(5);
      expect(result.value.objects).toHaveLength(5);
    }
  });

  it('returns a meaningful error for an unknown ID and lists available levels', () => {
    const repository = LevelRepository.fromSources(collectLevelSources(LEVELS_ROOT));
    const error = errorsOf(repository.getLevel('world-01-level-99'));

    expect(error.code).toBe('unknown-level');
    expect(error.levelId).toBe('world-01-level-99');
    expect(error.message).toContain('Unknown level "world-01-level-99"');
    expect(error.message).toContain('world-01-level-01');
    expect(error.message).toContain('world-01-level-03');
  });
});

describe('LevelRepository - failure handling', () => {
  it('rejects duplicate level IDs and removes the ambiguous ID', () => {
    const first = createMinimalLevel('duplicate-level');
    const second = createMinimalLevel('duplicate-level');
    const repository = LevelRepository.fromSources([
      { path: 'levels/a.json', raw: JSON.stringify(first) },
      { path: 'levels/b.json', raw: JSON.stringify(second) },
    ]);

    const error = errorsOf(repository.getLevel('duplicate-level'));

    expect(error.code).toBe('duplicate-id');
    expect(error.message).toContain('levels/a.json');
    expect(error.message).toContain('levels/b.json');
    expect(repository.listLevels()).toEqual([]);
    expect(repository.getDiagnostics()).toHaveLength(1);
  });

  it('reports invalid content with the declared ID and field paths', () => {
    const invalid = { ...createMinimalLevel('broken-level'), name: '', size: { width: 0, height: 10 } };
    const repository = LevelRepository.fromSources([
      { path: 'levels/broken.json', raw: JSON.stringify(invalid) },
    ]);

    const error = errorsOf(repository.getLevel('broken-level'));

    expect(error.code).toBe('invalid-level');
    expect(error.levelId).toBe('broken-level');
    expect(error.path).toBe('levels/broken.json');
    expect(error.details?.map((entry) => entry.path)).toContain('$.name');
    expect(error.details?.map((entry) => entry.path)).toContain('$.size.width');
    expect(repository.listLevels()).toEqual([]);
  });

  it('reports unsupported schema versions through the existing validator', () => {
    const invalid = { ...createMinimalLevel('future-level'), schemaVersion: 2 };
    const repository = LevelRepository.fromSources([
      { path: 'levels/future.json', raw: JSON.stringify(invalid) },
    ]);
    const error = errorsOf(repository.getLevel('future-level'));

    expect(error.code).toBe('invalid-level');
    expect(error.details?.some((entry) => entry.message.includes('unsupported schema version 2'))).toBe(
      true,
    );
  });

  it('handles malformed JSON without crashing or exposing a level', () => {
    const repository = LevelRepository.fromSources([
      { path: 'levels/malformed.json', raw: '{ "schemaVersion": 1, ' },
    ]);

    expect(repository.listLevels()).toEqual([]);
    expect(repository.getDiagnostics()).toHaveLength(1);
    expect(errorsOf(repository.getLevel('anything')).code).toBe('unknown-level');
  });

  it('sorts level summaries by ID regardless of source order', () => {
    const repository = LevelRepository.fromSources([
      { path: 'z.json', raw: JSON.stringify(createMinimalLevel('z-level')) },
      { path: 'a.json', raw: JSON.stringify(createMinimalLevel('a-level')) },
    ]);

    expect(repository.listLevels().map((level) => level.id)).toEqual(['a-level', 'z-level']);
  });

  it('keeps validation behavior delegated to the existing validator', () => {
    const level = createMinimalLevel('valid-level');

    expect(validateLevel(level).ok).toBe(true);
    expect(LevelRepository.fromSources([{ path: 'x.json', raw: JSON.stringify(level) }]).getLevel('valid-level').ok).toBe(true);
  });
});

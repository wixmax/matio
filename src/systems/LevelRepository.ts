import type { LevelDefinition } from '../types/level';
import type {
  LevelLoadFailure,
  LevelRepositoryResult,
  LevelSource,
  LevelSummary,
} from '../types/level-runtime';
import { parseLevelJson } from './level-validator';

interface RepositoryEntry {
  readonly level: LevelDefinition;
  readonly path: string;
}

/**
 * Discovers and exposes validated levels by ID.
 *
 * Input is a list of raw JSON sources, which keeps this class independent of
 * Vite and easy to test. `src/core/level-repository.ts` supplies the bundled
 * sources through `import.meta.glob`.
 *
 * Behavior:
 * - All sources are parsed once with the existing schema validator.
 * - Duplicate IDs make that ID unavailable (ambiguous content is never loaded).
 * - Unknown IDs return the list of available IDs.
 * - Invalid unrelated files are recorded as diagnostics but do not crash the app.
 */
export class LevelRepository {
  private readonly levels = new Map<string, RepositoryEntry>();
  private readonly failures = new Map<string, LevelLoadFailure>();
  private readonly summaries: LevelSummary[] = [];
  private readonly diagnostics: string[] = [];

  private constructor() {}

  static fromSources(sources: readonly LevelSource[]): LevelRepository {
    const repository = new LevelRepository();
    repository.build(sources);

    return repository;
  }

  getLevel(id: string): LevelRepositoryResult<LevelDefinition> {
    const entry = this.levels.get(id);

    if (entry !== undefined) {
      return { ok: true, value: entry.level };
    }

    const failure = this.failures.get(id);

    if (failure !== undefined) {
      return { ok: false, error: failure };
    }

    const available = this.summaries.map((summary) => summary.id);
    const availableText =
      available.length > 0 ? ` Available levels: ${available.join(', ')}.` : ' No levels are available.';

    return {
      ok: false,
      error: {
        code: 'unknown-level',
        levelId: id,
        message: `Unknown level "${id}".${availableText}`,
      },
    };
  }

  listLevels(): readonly LevelSummary[] {
    return [...this.summaries];
  }

  /** Human-readable content problems for development logging. */
  getDiagnostics(): readonly string[] {
    return this.diagnostics;
  }

  private build(sources: readonly LevelSource[]): void {
    const orderedSources = [...sources].sort((a, b) => a.path.localeCompare(b.path));

    for (const source of orderedSources) {
      const parsed = parseLevelJson(source.raw);
      const declaredId = readDeclaredId(source.raw);

      if (!parsed.ok) {
        const levelId = declaredId ?? source.path;
        const failure: LevelLoadFailure = {
          code: 'invalid-level',
          levelId,
          message: declaredId
            ? `Level "${declaredId}" is invalid (${source.path}).`
            : `A level file is invalid (${source.path}).`,
          path: source.path,
          details: parsed.errors,
        };

        if (declaredId !== undefined) {
          this.recordFailure(declaredId, failure);
        } else {
          this.diagnostics.push(formatDiagnostic(failure));
        }

        continue;
      }

      const level = parsed.value;
      const existing = this.levels.get(level.id);

      if (existing !== undefined || this.failures.has(level.id)) {
        const firstPath = existing?.path ?? this.failures.get(level.id)?.path ?? 'another file';
        const failure: LevelLoadFailure = {
          code: 'duplicate-id',
          levelId: level.id,
          message: `Duplicate level id "${level.id}" in ${source.path}; already defined in ${firstPath}.`,
          path: source.path,
        };

        this.recordFailure(level.id, failure);
        continue;
      }

      this.levels.set(level.id, { level, path: source.path });
      this.summaries.push({ id: level.id, name: level.name, path: source.path });
    }

    this.summaries.sort((a, b) => a.id.localeCompare(b.id));
  }

  private recordFailure(id: string, failure: LevelLoadFailure): void {
    // Ambiguous or invalid content must never be playable, even if an earlier
    // file with the same ID was valid.
    this.levels.delete(id);

    const summaryIndex = this.summaries.findIndex((summary) => summary.id === id);
    if (summaryIndex >= 0) {
      this.summaries.splice(summaryIndex, 1);
    }

    this.failures.set(id, failure);
    this.diagnostics.push(formatDiagnostic(failure));
  }
}

function readDeclaredId(raw: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      'id' in parsed &&
      typeof parsed.id === 'string' &&
      parsed.id.trim().length > 0
    ) {
      return parsed.id;
    }
  } catch {
    // Malformed JSON has no addressable ID; the parse error is reported instead.
  }

  return undefined;
}

function formatDiagnostic(failure: LevelLoadFailure): string {
  const details = failure.details?.map((error) => `${error.path}: ${error.message}`).join('; ');

  return details ? `${failure.message} ${details}` : failure.message;
}

import { LevelRepository } from '../systems/LevelRepository';
import type { LevelSource } from '../types/level-runtime';

/**
 * Bundled level discovery.
 *
 * `import.meta.glob` runs at build time, so every JSON file under
 * `content/levels/` is embedded in the application. This works in dev,
 * production preview and a future Android WebView without a server or Node
 * filesystem access.
 *
 * The glob is eager because levels are tiny; artwork is never loaded here.
 * Adding `content/levels/world-01/level-04.json` is enough to register a new
 * level (its JSON `id` must be unique).
 */
const bundledLevelSources = import.meta.glob<string>('/content/levels/**/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});

let repository: LevelRepository | null = null;

export function getLevelRepository(): LevelRepository {
  if (repository === null) {
    const sources: LevelSource[] = Object.entries(bundledLevelSources)
      .map(([path, raw]) => ({ path, raw }))
      .sort((a, b) => a.path.localeCompare(b.path));

    repository = LevelRepository.fromSources(sources);
  }

  return repository;
}

/** Exposed for diagnostics/tests; mirrors the bundled glob keys. */
export function getBundledLevelPaths(): readonly string[] {
  return Object.keys(bundledLevelSources).sort();
}

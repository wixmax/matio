import type { LevelOrderConfig } from '../types/progression';
import type { CompletionUpdate } from './save-progress';
import type { LevelCompletionInput, SaveData } from '../types/save';
import { SAVE_VERSION } from '../types/save';
import { validateSaveData } from './save-validator';
import { applyLevelCompletion } from './save-progress';
import { createInitialUnlockedLevelIds, sortLevelIdsByOrder } from './progression';

/** Minimal storage contract so tests can inject a fake localStorage. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_STORAGE_KEY = 'matio.save.v1';

export type SaveLoadStatus =
  | 'new'
  | 'loaded'
  | 'recovered'
  | 'storage-unavailable'
  | 'unsupported-version';

export interface SaveLoadResult {
  readonly data: SaveData;
  readonly status: SaveLoadStatus;
  readonly diagnostic?: string;
}

export interface SaveWriteResult {
  readonly ok: boolean;
  readonly diagnostic?: string;
}

export interface CompletionSettlement {
  readonly update: CompletionUpdate;
  readonly writeOk: boolean;
  readonly loadStatus: SaveLoadStatus;
  readonly diagnostic?: string;
}

/**
 * localStorage-backed save store with safe fallbacks.
 *
 * Guarantees:
 * - Missing save: sensible first-launch data (first campaign level unlocked).
 * - Corrupt/invalid save: recover to first-launch data and log a diagnostic.
 * - Unsupported version: never overwrite it (a newer build may use it); the
 *   session runs on first-launch data and reports that progress is not saved.
 * - Storage unavailable or throwing: the game keeps running on an in-memory
 *   save; no storage exception reaches gameplay.
 */
export class SaveStore {
  private memory: SaveData;
  private readonly initial: SaveData;
  private storage: SaveStorage | null;
  private writesBlocked = false;
  private storageDiagnostic: string | undefined;

  constructor(
    storage: SaveStorage | null,
    private readonly order: LevelOrderConfig,
    private readonly storageKey: string = SAVE_STORAGE_KEY,
  ) {
    this.initial = createEmptySave(order);
    this.memory = this.initial;
    this.storage = storage;
  }

  load(): SaveLoadResult {
    if (this.storage === null) {
      return {
        data: this.memory,
        status: 'storage-unavailable',
        diagnostic: this.storageDiagnostic ?? 'localStorage is unavailable; progress will not persist.',
      };
    }

    let raw: string | null;

    try {
      raw = this.storage.getItem(this.storageKey);
    } catch (error) {
      this.disableStorage(`Failed to read localStorage: ${describeError(error)}`);
      return {
        data: this.memory,
        status: 'storage-unavailable',
        diagnostic: this.storageDiagnostic,
      };
    }

    if (raw === null) {
      this.memory = this.initial;
      return { data: this.memory, status: 'new' };
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      this.memory = this.initial;
      return this.recover(`Save data is not valid JSON (${describeError(error)}); starting fresh.`);
    }

    const version = readSaveVersion(parsed);

    if (version !== undefined && version !== SAVE_VERSION) {
      // Keep the newer file intact; only this session falls back.
      this.writesBlocked = true;
      this.memory = this.initial;
      return {
        data: this.memory,
        status: 'unsupported-version',
        diagnostic: `Save version ${version} is not supported by this build (expected ${SAVE_VERSION}); existing data was left untouched and progress will not be saved.`,
      };
    }

    const validated = validateSaveData(parsed, this.order.levels);

    if (!validated.ok) {
      const details = validated.errors.map((error) => `${error.path}: ${error.message}`).join('; ');
      this.memory = this.initial;
      return this.recover(`Save data is invalid (${details}); starting fresh.`);
    }

    this.memory = this.normalize(validated.value);
    return { data: this.memory, status: 'loaded' };
  }

  save(data: SaveData): SaveWriteResult {
    const validated = validateSaveData(data, this.order.levels);

    if (!validated.ok) {
      const details = validated.errors.map((error) => `${error.path}: ${error.message}`).join('; ');
      return { ok: false, diagnostic: `Refused to write invalid save data: ${details}` };
    }

    const normalized = this.normalize(validated.value);
    this.memory = normalized;

    if (this.writesBlocked) {
      return {
        ok: false,
        diagnostic: 'A newer save version exists in storage; this build did not overwrite it.',
      };
    }

    if (this.storage === null) {
      return {
        ok: false,
        diagnostic: this.storageDiagnostic ?? 'localStorage is unavailable; progress is kept for this session only.',
      };
    }

    try {
      this.storage.setItem(this.storageKey, JSON.stringify(normalized));
      return { ok: true };
    } catch (error) {
      this.disableStorage(`Failed to write localStorage: ${describeError(error)}`);
      return {
        ok: false,
        diagnostic: 'Progress could not be written to localStorage; it is kept for this session only.',
      };
    }
  }

  /** Loads, applies exactly one completion, writes once and reports the result. */
  recordCompletion(input: LevelCompletionInput): CompletionSettlement {
    const loaded = this.load();
    const update = applyLevelCompletion(loaded.data, input, this.order);

    if (!update.recorded) {
      return {
        update,
        writeOk: false,
        loadStatus: loaded.status,
        diagnostic: `Level "${input.levelId}" is not part of content/config/level-order.json; progress was not saved.`,
      };
    }

    const written = this.save(update.save);

    return {
      update,
      writeOk: written.ok,
      loadStatus: loaded.status,
      ...(written.diagnostic === undefined ? {} : { diagnostic: written.diagnostic }),
    };
  }

  private recover(diagnostic: string): SaveLoadResult {
    return { data: this.memory, status: 'recovered', diagnostic };
  }

  private disableStorage(diagnostic: string): void {
    this.storage = null;
    this.storageDiagnostic = diagnostic;
  }

  private normalize(save: SaveData): SaveData {
    const requiredUnlocks = [
      ...createInitialUnlockedLevelIds(this.order),
      ...Object.entries(save.levels)
        .filter(([, record]) => record.completed)
        .map(([levelId]) => levelId),
    ];
    const unlockedLevelIds = sortLevelIdsByOrder(
      [...requiredUnlocks, ...save.unlockedLevelIds],
      this.order,
    );

    return {
      saveVersion: save.saveVersion,
      unlockedLevelIds,
      levels: { ...save.levels },
    };
  }
}

function createEmptySave(order: LevelOrderConfig): SaveData {
  return {
    saveVersion: SAVE_VERSION,
    unlockedLevelIds: createInitialUnlockedLevelIds(order),
    levels: {},
  };
}

function readSaveVersion(input: unknown): number | undefined {
  if (typeof input === 'object' && input !== null && !Array.isArray(input) && 'saveVersion' in input) {
    const version = input.saveVersion;

    if (typeof version === 'number' && Number.isFinite(version)) {
      return version;
    }
  }

  return undefined;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

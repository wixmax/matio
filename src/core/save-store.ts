import { requireLevelOrder } from './level-order-config';
import { SaveStore, SAVE_STORAGE_KEY, type SaveStorage } from '../systems/save-store';

/**
 * Browser save singleton.
 *
 * `localStorage` availability is probed once; private-mode/security errors fall
 * back to an in-memory save so gameplay never throws because of storage.
 */

let store: SaveStore | null = null;

export function getSaveStore(): SaveStore {
  if (store !== null) {
    return store;
  }

  const order = requireLevelOrder();

  store = new SaveStore(readBrowserStorage(), order, SAVE_STORAGE_KEY);

  return store;
}

function readBrowserStorage(): SaveStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;
    const probeKey = 'matio.storage-probe';

    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);

    return storage;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.warn(`[SaveStore] localStorage is unavailable (${reason}); progress will not persist.`);

    return null;
  }
}

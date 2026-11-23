/**
 * Error surfaces.
 *
 * - `installDevErrorOverlay()` shows uncaught errors and rejections in dev only.
 * - `showBlockingError()` always renders a visible panel (used for startup
 *   configuration failures, where a blank canvas would otherwise hide the cause).
 */

const OVERLAY_CLASS = 'dev-error-overlay';
const MAX_ENTRIES = 6;

let panel: HTMLDivElement | null = null;
let entryCount = 0;

export function showBlockingError(title: string, detail: string): void {
  if (typeof document === 'undefined' || entryCount >= MAX_ENTRIES) {
    return;
  }

  entryCount += 1;

  if (panel === null) {
    panel = document.createElement('div');
    panel.className = OVERLAY_CLASS;
    panel.setAttribute('role', 'alert');
    document.body.append(panel);
  }

  const entry = document.createElement('section');
  const heading = document.createElement('h2');
  const body = document.createElement('pre');

  heading.textContent = title;
  body.textContent = detail;
  entry.append(heading, body);
  panel.append(entry);
}

export function installDevErrorOverlay(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', (event) => {
    const location = event.filename ? `\n${event.filename}:${event.lineno}:${event.colno}` : '';
    showBlockingError('Uncaught error', `${event.message}${location}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason =
      event.reason instanceof Error
        ? event.reason.stack ?? event.reason.message
        : String(event.reason);

    showBlockingError('Unhandled promise rejection', reason);
  });
}

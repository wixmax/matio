/**
 * Development-only error surface.
 *
 * A blank canvas is the most common failure mode for a Phaser game (bad import,
 * renderer failure, unresolved asset). In dev builds we surface uncaught errors
 * on top of the game so the cause is visible without opening DevTools.
 * Production builds do not install this overlay.
 */

const OVERLAY_CLASS = 'dev-error-overlay';

export function installDevErrorOverlay(): void {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  let overlay: HTMLDivElement | null = null;
  let shownCount = 0;

  const show = (title: string, detail: string): void => {
    if (shownCount >= 5) {
      return;
    }

    shownCount += 1;

    if (overlay === null) {
      overlay = document.createElement('div');
      overlay.className = OVERLAY_CLASS;
      document.body.append(overlay);
    }

    const heading = document.createElement('h2');
    heading.textContent = title;

    const body = document.createElement('pre');
    body.textContent = detail;

    overlay.append(heading, body);
  };

  window.addEventListener('error', (event) => {
    const location = event.filename ? `\n${event.filename}:${event.lineno}:${event.colno}` : '';
    show('Uncaught error', `${event.message}${location}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason);
    show('Unhandled promise rejection', reason);
  });
}

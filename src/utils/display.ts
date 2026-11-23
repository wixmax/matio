/**
 * Display helpers.
 *
 * Resolution strategy (see docs/ARCHITECTURE.md):
 * Phaser 4 has no `resolution` game-config option, so the canvas backing store
 * renders at the logical 1280x720 game size and the ScaleManager fits it to the
 * viewport with CSS. Device pixel ratio is therefore handled explicitly for
 * rendered Text (the only DPI-sensitive primitive we draw today).
 */

const MAX_TEXT_RESOLUTION = 2;

/**
 * Text resolution factor, clamped to keep very high-DPR phones from allocating
 * oversized text textures while still looking crisp on typical 2x/3x screens.
 */
export function getTextResolution(): number {
  if (typeof window === 'undefined') {
    return 1;
  }

  const devicePixelRatio = window.devicePixelRatio || 1;

  return Math.min(Math.max(devicePixelRatio, 1), MAX_TEXT_RESOLUTION);
}

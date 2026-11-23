/**
 * Shared visual tokens for placeholder UI and scene composition.
 *
 * These are deliberately data-only (no Phaser imports) so they can be reused by
 * UI components, scenes and tests. Final art will replace most of these shapes,
 * but the palette remains the single source of truth for UI colors.
 */

export const PALETTE = {
  background: 0x101a2b,

  sky: 0x8ed6f7,
  skyDeep: 0x5fb6ea,
  sun: 0xffe38a,
  sunGlow: 0xfff2c4,
  cloud: 0xffffff,

  hillFar: 0xa9dd9b,
  hillNear: 0x74c07a,

  grass: 0x62c24f,
  grassDark: 0x3f8f3a,
  soil: 0x8a5a3b,
  soilDark: 0x633d27,

  ink: 0x1b2a41,
  inkSoft: 0x31445f,
  white: 0xffffff,
  black: 0x000000,

  accent: 0xffa64d,
  accentDark: 0xd97a24,
  accentLight: 0xffc98a,

  player: 0xff6b6b,
  playerDark: 0xc94a4a,

  mutedText: 0xdfe9f5,
} as const;

/** Font stack used by every Text object until a bitmap/webfont is introduced. */
export const UI_FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Convert a Phaser integer color to a CSS hex string for Text styles. */
export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

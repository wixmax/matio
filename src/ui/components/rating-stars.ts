/** Filled/empty star glyphs for a 1..3 rating (presentation helper). */
export function formatRatingStars(rating: number): string {
  const filled = Math.max(0, Math.min(3, Math.trunc(rating)));

  return '\u2605'.repeat(filled) + '\u2606'.repeat(3 - filled);
}

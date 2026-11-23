/**
 * Generic result type for content validation.
 *
 * Validation never throws for expected content problems: callers receive either
 * a normalized value or a list of field-level errors that can be surfaced in a
 * loader UI, console or CI output.
 */

export interface ValidationError {
  /** JSON-style path to the offending value, e.g. `$.terrain[2].width`. */
  path: string;
  /** Human-readable reason, starting with the problem (no path duplication). */
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: ValidationError[] };

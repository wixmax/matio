/**
 * Deterministic jump rules, independent of Phaser and of rendering FPS.
 *
 * Responsibilities:
 * - Coyote time: jump shortly after walking off a ledge.
 * - Jump buffering: remember a press just before landing.
 * - Edge-only jumps: holding the button never re-triggers a jump.
 * - Variable jump height: cut upward velocity once when jump is released early.
 * - Ground-lag protection: a body that is still reported as grounded during the
 *   first frames of a jump must not allow a second jump.
 *
 * The controller consumes deltas in milliseconds and clamps them, so a paused
 * tab or a long frame cannot keep coyote/buffer windows alive indefinitely.
 */

export interface JumpTimingConfig {
  /** Initial jump velocity, negative for upwards (px/s). */
  jumpVelocity: number;
  coyoteTimeMs: number;
  jumpBufferMs: number;
  /** Multiplier applied once to upward velocity when jump is released early. */
  jumpCutMultiplier: number;
}

/** Longest frame time applied to timing windows (ms). */
export const MAX_TIMING_STEP_MS = 50;

export class JumpController {
  private coyoteRemainingMs = 0;
  private bufferRemainingMs = 0;
  private jumpQueued = false;
  private jumpedSinceGrounded = false;
  private jumpCutAvailable = false;

  constructor(private readonly tuning: JumpTimingConfig) {}

  /**
   * Advances the timing windows. Must be called once per frame before
   * `consumeJump`.
   */
  update(deltaMs: number, grounded: boolean, jumpPressed: boolean): void {
    const stepMs = Math.min(Math.max(deltaMs, 0), MAX_TIMING_STEP_MS);

    if (grounded) {
      // While the body is still reported as grounded after a jump, do not
      // refresh coyote time: that would enable an unintended double jump.
      if (!this.jumpedSinceGrounded) {
        this.coyoteRemainingMs = this.tuning.coyoteTimeMs;
      }
    } else {
      this.jumpedSinceGrounded = false;
      this.coyoteRemainingMs = Math.max(0, this.coyoteRemainingMs - stepMs);
    }

    if (jumpPressed) {
      this.bufferRemainingMs = this.tuning.jumpBufferMs;
    } else {
      this.bufferRemainingMs = Math.max(0, this.bufferRemainingMs - stepMs);
    }

    this.jumpQueued =
      !this.jumpedSinceGrounded && this.bufferRemainingMs > 0 && this.coyoteRemainingMs > 0;
  }

  /** Returns true exactly once per valid jump request. */
  consumeJump(): boolean {
    if (!this.jumpQueued) {
      return false;
    }

    this.jumpQueued = false;
    this.bufferRemainingMs = 0;
    this.coyoteRemainingMs = 0;
    this.jumpedSinceGrounded = true;
    this.jumpCutAvailable = true;

    return true;
  }

  /**
   * Returns the replacement vertical velocity when the jump must be cut,
   * otherwise null. The cut is applied at most once per jump.
   */
  getJumpCutVelocity(velocityY: number, jumpHeld: boolean): number | null {
    if (!this.jumpCutAvailable) {
      return null;
    }

    if (velocityY >= 0) {
      this.jumpCutAvailable = false;
      return null;
    }

    if (jumpHeld) {
      return null;
    }

    this.jumpCutAvailable = false;

    return velocityY * this.tuning.jumpCutMultiplier;
  }

  /** Clears a buffered press (for example when the browser loses focus). */
  cancelBufferedJump(): void {
    this.bufferRemainingMs = 0;
    this.jumpQueued = false;
  }

  reset(): void {
    this.coyoteRemainingMs = 0;
    this.bufferRemainingMs = 0;
    this.jumpQueued = false;
    this.jumpedSinceGrounded = false;
    this.jumpCutAvailable = false;
  }

  get coyoteAvailable(): boolean {
    return this.coyoteRemainingMs > 0;
  }

  get bufferActive(): boolean {
    return this.bufferRemainingMs > 0;
  }

  get jumpVelocity(): number {
    return this.tuning.jumpVelocity;
  }
}

import { describe, expect, it } from 'vitest';
import {
  JumpController,
  MAX_TIMING_STEP_MS,
  type JumpTimingConfig,
} from '../src/systems/jump-controller';

const TUNING: JumpTimingConfig = {
  jumpVelocity: -600,
  coyoteTimeMs: 100,
  jumpBufferMs: 120,
  jumpCutMultiplier: 0.45,
};

const FRAME_MS = 16;

function createController(): JumpController {
  return new JumpController(TUNING);
}

function step(
  controller: JumpController,
  grounded: boolean,
  jumpPressed = false,
  deltaMs = FRAME_MS,
): boolean {
  controller.update(deltaMs, grounded, jumpPressed);

  return controller.consumeJump();
}

/** Runs `count` airborne frames without a jump press. */
function airborneFrames(controller: JumpController, count: number): void {
  for (let i = 0; i < count; i += 1) {
    controller.update(FRAME_MS, false, false);
  }
}

describe('JumpController - jumping', () => {
  it('jumps when grounded and pressed', () => {
    const controller = createController();

    expect(step(controller, true, true)).toBe(true);
  });

  it('does not jump in midair without coyote time', () => {
    const controller = createController();

    controller.update(FRAME_MS, true, false);
    airborneFrames(controller, 7);

    expect(step(controller, false, true)).toBe(false);
  });

  it('allows a jump within the coyote window', () => {
    const controller = createController();

    controller.update(FRAME_MS, true, false);
    airborneFrames(controller, 3);

    expect(controller.coyoteAvailable).toBe(true);
    expect(step(controller, false, true)).toBe(true);
    expect(controller.coyoteAvailable).toBe(false);
  });

  it('does not repeat a jump while the button stays held', () => {
    const controller = createController();

    expect(step(controller, true, true)).toBe(true);

    // The physics body can still report grounded for a frame after jumping.
    expect(step(controller, true, true)).toBe(false);
    expect(step(controller, false, true)).toBe(false);
    expect(step(controller, false, true)).toBe(false);
  });

  it('prevents a double jump caused by ground-state lag', () => {
    const controller = createController();

    expect(step(controller, true, true)).toBe(true);
    // Mashing jump on the frame where the body is still "grounded" must fail.
    expect(step(controller, true, true)).toBe(false);
    // And the buffered press must not fire after leaving the ground.
    expect(step(controller, false, false)).toBe(false);
    expect(step(controller, false, false)).toBe(false);
  });

  it('requires a new press after landing', () => {
    const controller = createController();

    expect(step(controller, true, true)).toBe(true);
    airborneFrames(controller, 10);

    // Landing with no press: no jump.
    expect(step(controller, true, false)).toBe(false);
    // A new deliberate press works.
    expect(step(controller, true, true)).toBe(true);
  });
});

describe('JumpController - buffering', () => {
  it('remembers a press shortly before landing', () => {
    const controller = createController();

    controller.update(FRAME_MS, true, false);
    airborneFrames(controller, 6);

    // Press in the air, before landing.
    expect(step(controller, false, true)).toBe(false);
    expect(controller.bufferActive).toBe(true);

    airborneFrames(controller, 3);

    // Landing frame consumes the buffer.
    expect(step(controller, true, false)).toBe(true);
  });

  it('expires the buffer when landing takes too long', () => {
    const controller = createController();

    controller.update(FRAME_MS, true, false);
    airborneFrames(controller, 7);
    expect(step(controller, false, true)).toBe(false);
    expect(controller.bufferActive).toBe(true);

    airborneFrames(controller, 8);

    expect(controller.bufferActive).toBe(false);
    expect(step(controller, true, false)).toBe(false);
  });

  it('drops a buffered press on focus loss', () => {
    const controller = createController();

    controller.update(FRAME_MS, true, false);
    airborneFrames(controller, 7);
    controller.update(FRAME_MS, false, true);
    controller.cancelBufferedJump();

    expect(controller.bufferActive).toBe(false);
    expect(step(controller, true, false)).toBe(false);
  });
});

describe('JumpController - variable jump height', () => {
  it('cuts upward velocity once when jump is released early', () => {
    const controller = createController();

    expect(step(controller, true, true)).toBe(true);
    expect(controller.getJumpCutVelocity(-600, true)).toBeNull();
    expect(controller.getJumpCutVelocity(-600, false)).toBe(-270);
    expect(controller.getJumpCutVelocity(-500, false)).toBeNull();
  });

  it('does not cut after the apex', () => {
    const controller = createController();

    expect(step(controller, true, true)).toBe(true);
    expect(controller.getJumpCutVelocity(10, false)).toBeNull();
    expect(controller.getJumpCutVelocity(-500, false)).toBeNull();
  });
});

describe('JumpController - lifecycle', () => {
  it('clears all windows on reset', () => {
    const controller = createController();

    controller.update(FRAME_MS, true, false);
    controller.update(FRAME_MS, false, true);
    controller.reset();

    expect(controller.coyoteAvailable).toBe(false);
    expect(controller.bufferActive).toBe(false);
    expect(step(controller, true, true)).toBe(true);
  });

  it('clamps a very large frame delta when advancing windows', () => {
    const controller = createController();

    controller.update(FRAME_MS, true, false);
    controller.update(10_000, false, false);

    expect(MAX_TIMING_STEP_MS).toBe(50);
    expect(controller.coyoteAvailable).toBe(true);
  });
});

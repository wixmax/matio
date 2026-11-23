import { describe, expect, it } from 'vitest';
import { computePlayerInputState, resolveMoveDirection } from '../src/input/input-state';

describe('resolveMoveDirection', () => {
  it('returns neutral when nothing is held', () => {
    expect(resolveMoveDirection(false, false)).toBe(0);
  });

  it('resolves single directions', () => {
    expect(resolveMoveDirection(true, false)).toBe(-1);
    expect(resolveMoveDirection(false, true)).toBe(1);
  });

  it('resolves left + right to neutral deterministically', () => {
    expect(resolveMoveDirection(true, true)).toBe(0);
  });
});

describe('computePlayerInputState', () => {
  it('builds a neutral snapshot without input', () => {
    expect(
      computePlayerInputState({
        leftHeld: false,
        rightHeld: false,
        jumpHeld: false,
        jumpEvent: false,
        previousJumpHeld: false,
      }),
    ).toEqual({ moveX: 0, jumpPressed: false, jumpHeld: false });
  });

  it('reports a jump edge when the control transitions to held', () => {
    const state = computePlayerInputState({
      leftHeld: false,
      rightHeld: false,
      jumpHeld: true,
      jumpEvent: false,
      previousJumpHeld: false,
    });

    expect(state.jumpPressed).toBe(true);
    expect(state.jumpHeld).toBe(true);
  });

  it('does not repeat a jump while the control stays held', () => {
    const state = computePlayerInputState({
      leftHeld: false,
      rightHeld: false,
      jumpHeld: true,
      jumpEvent: false,
      previousJumpHeld: true,
    });

    expect(state.jumpPressed).toBe(false);
  });

  it('preserves a queued touch press even if the control is already released', () => {
    const state = computePlayerInputState({
      leftHeld: false,
      rightHeld: false,
      jumpHeld: false,
      jumpEvent: true,
      previousJumpHeld: false,
    });

    expect(state.jumpPressed).toBe(true);
    expect(state.jumpHeld).toBe(false);
  });

  it('mixes left/right and jump independently for multitouch', () => {
    const state = computePlayerInputState({
      leftHeld: false,
      rightHeld: true,
      jumpHeld: true,
      jumpEvent: true,
      previousJumpHeld: false,
    });

    expect(state.moveX).toBe(1);
    expect(state.jumpPressed).toBe(true);
    expect(state.jumpHeld).toBe(true);
  });
});

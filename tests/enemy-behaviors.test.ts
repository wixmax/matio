import { describe, expect, it } from 'vitest';
import {
  hasGroundAt,
  resolvePatrolStep,
  type PatrolStepInput,
} from '../src/systems/enemy-behaviors';
import type { EnemyGroundRect } from '../src/types/enemy';

const GROUND: EnemyGroundRect = { x: 0, y: 512, width: 640, height: 64 };

function input(overrides: Partial<PatrolStepInput> = {}): PatrolStepInput {
  return {
    direction: 1,
    speed: 55,
    bodyLeft: 100,
    bodyRight: 144,
    bodyBottom: 512,
    patrolLeft: 64,
    patrolRight: 576,
    blockedLeft: false,
    blockedRight: false,
    grounded: true,
    groundRects: [GROUND],
    ...overrides,
  };
}

describe('patrol behavior - direction and speed', () => {
  it('moves right when facing right and inside the patrol bounds', () => {
    expect(resolvePatrolStep(input())).toEqual({ direction: 1, velocityX: 55 });
  });

  it('moves left when facing left and inside the patrol bounds', () => {
    expect(resolvePatrolStep(input({ direction: -1, bodyLeft: 200, bodyRight: 244 }))).toEqual({
      direction: -1,
      velocityX: -55,
    });
  });

  it('never returns a NaN/negative speed magnitude', () => {
    expect(resolvePatrolStep(input({ speed: -10 })).velocityX).toBe(0);
  });
});

describe('patrol behavior - boundaries and obstacles', () => {
  it('reverses at the right patrol bound without moving by position', () => {
    expect(
      resolvePatrolStep(input({ direction: 1, bodyLeft: 530, bodyRight: 576 })),
    ).toEqual({ direction: -1, velocityX: -55 });
  });

  it('reverses at the left patrol bound', () => {
    expect(
      resolvePatrolStep(input({ direction: -1, bodyLeft: 64, bodyRight: 108 })),
    ).toEqual({ direction: 1, velocityX: 55 });
  });

  it('reverses away from a blocking wall reported by Arcade Physics', () => {
    expect(resolvePatrolStep(input({ blockedLeft: true }))).toEqual({
      direction: 1,
      velocityX: 55,
    });
    expect(
      resolvePatrolStep(input({ direction: -1, blockedRight: true })),
    ).toEqual({ direction: -1, velocityX: -55 });
  });

  it('keeps the current direction when both sides are blocked (deterministic)', () => {
    const result = resolvePatrolStep(input({ blockedLeft: true, blockedRight: true }));

    expect(result.direction).toBe(1);
  });
});

describe('patrol behavior - ledge safety', () => {
  it('detects ground below a point', () => {
    expect(hasGroundAt([GROUND], 10, 520)).toBe(true);
    expect(hasGroundAt([GROUND], 10, 400)).toBe(false);
    expect(hasGroundAt([GROUND], 700, 520)).toBe(false);
    expect(hasGroundAt([], 10, 520)).toBe(false);
  });

  it('reverses before walking off the right edge of a platform', () => {
    const narrow: EnemyGroundRect = { x: 0, y: 512, width: 160, height: 64 };
    // Body right edge is 2px short of the platform edge: the probe at 162 is
    // already over empty space.
    const result = resolvePatrolStep(
      input({ direction: 1, bodyLeft: 116, bodyRight: 160, groundRects: [narrow] }),
    );

    expect(result.direction).toBe(-1);
  });

  it('reverses before walking off the left edge of a platform', () => {
    const narrow: EnemyGroundRect = { x: 64, y: 512, width: 160, height: 64 };
    const result = resolvePatrolStep(
      input({ direction: -1, bodyLeft: 64, bodyRight: 108, groundRects: [narrow] }),
    );

    expect(result.direction).toBe(1);
  });

  it('does not probe ledges while airborne', () => {
    const result = resolvePatrolStep(
      input({ grounded: false, groundRects: [], direction: 1 }),
    );

    expect(result.direction).toBe(1);
  });
});

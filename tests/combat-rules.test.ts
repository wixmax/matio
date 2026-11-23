import { describe, expect, it } from 'vitest';
import {
  classifyEnemyContact,
  resolveKnockbackDirection,
} from '../src/systems/combat-rules';
import type { EnemyContactInput } from '../src/types/combat';

function input(overrides: Partial<EnemyContactInput> = {}): EnemyContactInput {
  return {
    enemyStompable: true,
    previousPlayerTop: 100,
    playerBodyHeight: 84,
    enemyTop: 180,
    playerDeltaY: 16,
    playerVelocityY: 0,
    topContactTolerancePx: 18,
    ...overrides,
  };
}

describe('stomp classification - top contacts', () => {
  it('accepts a downward contact whose previous feet were above the enemy top', () => {
    expect(classifyEnemyContact(input())).toBe('stomp');
  });

  it('accepts a contact at the configured tolerance edge', () => {
    // previous bottom = 100 + 84 = 184; enemy top + tolerance = 180 + 18 = 198.
    expect(classifyEnemyContact(input({ previousPlayerTop: 114 }))).toBe('stomp');
  });

  it('accepts a downward step even when Arcade already zeroed velocity', () => {
    expect(classifyEnemyContact(input({ playerVelocityY: 0, playerDeltaY: 16 }))).toBe('stomp');
  });
});

describe('stomp classification - rejected contacts', () => {
  it('rejects side contact while standing/running (no downward step)', () => {
    expect(classifyEnemyContact(input({ playerDeltaY: 0, playerVelocityY: 0 }))).toBe('damage');
  });

  it('rejects rising contact from below', () => {
    expect(
      classifyEnemyContact(input({ playerDeltaY: -16, playerVelocityY: -400 })),
    ).toBe('damage');
  });

  it('rejects a fall beside an enemy whose top was already above the feet', () => {
    // Previous bottom = 284, enemy top = 180: the player was already beside/below
    // the enemy top, so it is not a top contact.
    expect(classifyEnemyContact(input({ previousPlayerTop: 200 }))).toBe('damage');
  });

  it('rejects a near-edge side contact that is below the top tolerance', () => {
    expect(
      classifyEnemyContact(input({ previousPlayerTop: 120, topContactTolerancePx: 18 })),
    ).toBe('damage');
  });

  it('rejects stomping a non-stompable (spiky) enemy even from above', () => {
    expect(classifyEnemyContact(input({ enemyStompable: false }))).toBe('damage');
  });
});

describe('knockback direction', () => {
  it('pushes the player away from the enemy on both sides', () => {
    expect(resolveKnockbackDirection(100, 200)).toBe(-1);
    expect(resolveKnockbackDirection(300, 200)).toBe(1);
    expect(resolveKnockbackDirection(200, 200)).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { canStartCompletion, isGameplayActive } from '../src/systems/gameplay-state';
import type { GameplayState } from '../src/systems/gameplay-state';

const STATES: GameplayState[] = ['loading', 'playing', 'completing', 'results', 'error'];

describe('gameplay state - completion gate', () => {
  it('allows a completion only from the playing state', () => {
    for (const state of STATES) {
      expect(canStartCompletion(state)).toBe(state === 'playing');
    }
  });

  it('keeps input/collection updates active only while playing', () => {
    for (const state of STATES) {
      expect(isGameplayActive(state)).toBe(state === 'playing');
    }
  });

  it('prevents a second completion after the state moves to completing/results', () => {
    expect(canStartCompletion('playing')).toBe(true);
    expect(canStartCompletion('completing')).toBe(false);
    expect(canStartCompletion('results')).toBe(false);
  });
});
